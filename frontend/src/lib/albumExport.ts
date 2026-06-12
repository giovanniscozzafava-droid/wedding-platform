// Export dell'album impaginato. Disegna ogni slot con crop/zoom/abbondanza coerenti
// con l'anteprima (stessa geometria) e lo inserisce nel PDF a misura reale (mm).
// Modalità: pagine singole (con abbondanza per la stampa) o spread (per revisione).
// JPG per pagina in uno ZIP.
import { getFormat } from './albumFormats'
import { framesForPage, type AlbumPage } from './albumEngine'
import { slotRect, sourceRect, pageBox, DEFAULT_CELL, MARGIN_MM, GUTTER_MM, BLEED_MM, type Cell } from './albumGeometry'

export type UrlResolver = (mediaId: string) => string

// URL del proxy edge che restituisce l'ORIGINALE Drive in alta risoluzione (autorizzato dal grant).
export function hiResProxyUrl(supabaseUrl: string, anonKey: string, grant: string, mediaId: string): string {
  return `${supabaseUrl}/functions/v1/album-image?t=${encodeURIComponent(grant)}&m=${encodeURIComponent(mediaId)}&apikey=${encodeURIComponent(anonKey)}`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('img'))
    img.src = url
  })
}

// disegna `img` (con crop/zoom della cella) su un canvas wpx×hpx → dataURL JPEG
function cropDataUrl(img: HTMLImageElement, wpx: number, hpx: number, cell: Cell, q = 0.92): string {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(wpx)); c.height = Math.max(1, Math.round(hpx))
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
  const sr = sourceRect(img.width, img.height, c.width / c.height, cell)
  ctx.drawImage(img, sr.sx, sr.sy, sr.sw, sr.sh, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', q)
}

// disegna un elemento libero (crop + rotazione + bordo + ombra) come immagine ruotata
async function drawFreeElement(pdf: any, el: import('./albumFree').FreeEl, pageX: number, pageY: number, fmtW: number, fmtH: number, resolve: UrlResolver, dpi: number) {
  const pxPerMm = dpi / 25.4
  const elWmm = el.w * fmtW, elHmm = el.h * fmtH
  const elWpx = Math.max(1, elWmm * pxPerMm), elHpx = Math.max(1, elHmm * pxPerMm)
  const th = (el.rot * Math.PI) / 180
  const bw = Math.abs(elWpx * Math.cos(th)) + Math.abs(elHpx * Math.sin(th))
  const bh = Math.abs(elWpx * Math.sin(th)) + Math.abs(elHpx * Math.cos(th))
  const c = document.createElement('canvas'); c.width = Math.ceil(bw); c.height = Math.ceil(bh)
  const ctx = c.getContext('2d')!
  ctx.translate(c.width / 2, c.height / 2); ctx.rotate(th)
  if (el.shadow) { ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = 0.03 * Math.min(elWpx, elHpx); ctx.shadowOffsetY = 0.012 * elHpx }
  try {
    const img = await loadImage(resolve(el.mediaId))
    const sr = sourceRect(img.width, img.height, elWpx / elHpx, el.cell)
    ctx.drawImage(img, sr.sx, sr.sy, sr.sw, sr.sh, -elWpx / 2, -elHpx / 2, elWpx, elHpx)
  } catch { ctx.fillStyle = '#ebebeb'; ctx.fillRect(-elWpx / 2, -elHpx / 2, elWpx, elHpx) }
  ctx.shadowColor = 'transparent'
  if (el.border) { ctx.lineWidth = Math.max(1, el.border.w * pxPerMm); ctx.strokeStyle = el.border.color; ctx.strokeRect(-elWpx / 2 + ctx.lineWidth / 2, -elHpx / 2 + ctx.lineWidth / 2, elWpx - ctx.lineWidth, elHpx - ctx.lineWidth) }
  const data = c.toDataURL('image/jpeg', 0.92)
  const cxMm = pageX + (el.x + el.w / 2) * fmtW, cyMm = pageY + (el.y + el.h / 2) * fmtH
  const bwMm = bw / pxPerMm, bhMm = bh / pxPerMm
  pdf.addImage(data, 'JPEG', cxMm - bwMm / 2, cyMm - bhMm / 2, bwMm, bhMm)
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', ''); const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const v = parseInt(n.slice(0, 6) || 'ffffff', 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

async function renderFreePage(pdf: any, page: AlbumPage, fmtW: number, fmtH: number, ox: number, oy: number, resolve: UrlResolver, dpi: number) {
  const [r, g, b] = hexRgb(page.bg ?? '#ffffff')
  pdf.setFillColor(r, g, b); pdf.rect(ox, oy, fmtW, fmtH, 'F')
  for (const el of page.elements ?? []) await drawFreeElement(pdf, el, ox, oy, fmtW, fmtH, resolve, dpi)
}

async function renderPageInto(pdf: any, page: AlbumPage, fmtW: number, fmtH: number, ox: number, oy: number, resolve: UrlResolver, dpi: number, bleed: number) {
  if (page.mode === 'free') { await renderFreePage(pdf, page, fmtW, fmtH, ox, oy, resolve, dpi); return }
  const frames = framesForPage(page)
  const pxPerMm = dpi / 25.4
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i]!; const mediaId = page.mediaIds[i]
    const cell = page.cells?.[i] ?? DEFAULT_CELL
    const r = slotRect(fr, fmtW, fmtH, { margin: MARGIN_MM, gutter: GUTTER_MM, bleed })
    const x = ox + r.x, y = oy + r.y
    if (!mediaId) { pdf.setFillColor(238, 238, 238); pdf.rect(x, y, r.w, r.h, 'F'); continue }
    try {
      const img = await loadImage(resolve(mediaId))
      const data = cropDataUrl(img, r.w * pxPerMm, r.h * pxPerMm, cell)
      pdf.addImage(data, 'JPEG', x, y, r.w, r.h)
    } catch {
      pdf.setFillColor(235, 235, 235); pdf.rect(x, y, r.w, r.h, 'F')
    }
  }
}

export type PdfMode = 'pages' | 'spreads'

// crocini di taglio agli angoli del trim (pagina nominale dentro l'abbondanza)
function drawCutMarks(pdf: any, ox: number, oy: number, pageW: number, pageH: number, b: number) {
  const len = Math.min(6, b + 3) // mm
  pdf.setDrawColor(0); pdf.setLineWidth(0.2)
  const tx = ox + b, ty = oy + b, rx = ox + b + pageW, by = oy + b + pageH
  // 4 angoli, due segmenti ciascuno (fuori dal trim)
  const seg = (x1: number, y1: number, x2: number, y2: number) => pdf.line(x1, y1, x2, y2)
  seg(tx - len, ty, tx, ty); seg(tx, ty - len, tx, ty)           // alto-sx
  seg(rx, ty, rx + len, ty); seg(rx, ty - len, rx, ty)           // alto-dx
  seg(tx - len, by, tx, by); seg(tx, by, tx, by + len)           // basso-sx
  seg(rx, by, rx + len, by); seg(rx, by, rx, by + len)           // basso-dx
}

export async function exportAlbumPdf(pages: AlbumPage[], formatKey: string, resolve: UrlResolver, opts: { mode?: PdfMode; dpi?: number; filename?: string; bleed?: boolean; cutMarks?: boolean } = {}) {
  const { mode = 'pages', dpi = 150, filename = 'album.pdf', bleed = false, cutMarks = false } = opts
  const f = getFormat(formatKey)
  const { default: jsPDF } = await import('jspdf')

  if (mode === 'spreads') {
    // spread = revisione: niente abbondanza (sarebbe nel dorso). Pagine affiancate.
    const sw = f.w * 2, sh = f.h
    const pdf = new jsPDF({ orientation: sw >= sh ? 'landscape' : 'portrait', unit: 'mm', format: [sw, sh] })
    for (let i = 0; i < pages.length; i += 2) {
      if (i > 0) pdf.addPage([sw, sh], sw >= sh ? 'landscape' : 'portrait')
      await renderPageInto(pdf, pages[i]!, f.w, f.h, 0, 0, resolve, dpi, 0)
      if (pages[i + 1]) await renderPageInto(pdf, pages[i + 1]!, f.w, f.h, f.w, 0, resolve, dpi, 0)
    }
    pdf.save(filename)
    return
  }

  // pagine singole: con abbondanza per la stampa (pagina ingrandita di 2*bleed)
  const b = bleed ? BLEED_MM : 0
  const box = pageBox(f.w, f.h, b)
  const pdf = new jsPDF({ orientation: box.w >= box.h ? 'landscape' : 'portrait', unit: 'mm', format: [box.w, box.h] })
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage([box.w, box.h], box.w >= box.h ? 'landscape' : 'portrait')
    await renderPageInto(pdf, pages[i]!, f.w, f.h, 0, 0, resolve, dpi, b)
    if (cutMarks && b > 0) drawCutMarks(pdf, 0, 0, f.w, f.h, b)
  }
  pdf.save(filename)
}

// JPG per pagina dentro uno ZIP (una facciata = un'immagine). Senza abbondanza.
export async function exportAlbumJpgZip(pages: AlbumPage[], formatKey: string, resolve: UrlResolver, opts: { dpi?: number; filename?: string } = {}) {
  const { dpi = 150, filename = 'album-jpg.zip' } = opts
  const f = getFormat(formatKey)
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const pxPerMm = dpi / 25.4
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!
    const c = document.createElement('canvas')
    c.width = Math.round(f.w * pxPerMm); c.height = Math.round(f.h * pxPerMm)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = page.mode === 'free' ? (page.bg ?? '#ffffff') : '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
    if (page.mode === 'free') {
      for (const el of page.elements ?? []) {
        const elWpx = el.w * c.width, elHpx = el.h * c.height
        const cxp = (el.x + el.w / 2) * c.width, cyp = (el.y + el.h / 2) * c.height
        ctx.save(); ctx.translate(cxp, cyp); ctx.rotate((el.rot * Math.PI) / 180)
        if (el.shadow) { ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = 0.03 * Math.min(elWpx, elHpx); ctx.shadowOffsetY = 0.012 * elHpx }
        try { const img = await loadImage(resolve(el.mediaId)); const sr = sourceRect(img.width, img.height, elWpx / elHpx, el.cell); ctx.drawImage(img, sr.sx, sr.sy, sr.sw, sr.sh, -elWpx / 2, -elHpx / 2, elWpx, elHpx) } catch { ctx.fillStyle = '#ebebeb'; ctx.fillRect(-elWpx / 2, -elHpx / 2, elWpx, elHpx) }
        ctx.shadowColor = 'transparent'
        if (el.border) { ctx.lineWidth = Math.max(1, el.border.w * pxPerMm); ctx.strokeStyle = el.border.color; ctx.strokeRect(-elWpx / 2, -elHpx / 2, elWpx, elHpx) }
        ctx.restore()
      }
      const blobF: Blob = await new Promise((res) => c.toBlob((b2) => res(b2!), 'image/jpeg', 0.92))
      zip.file(`pagina-${String(p + 1).padStart(3, '0')}.jpg`, blobF)
      continue
    }
    const frames = framesForPage(page)
    for (let i = 0; i < frames.length; i++) {
      const fr = frames[i]!; const mediaId = page.mediaIds[i]
      const cell = page.cells?.[i] ?? DEFAULT_CELL
      const r = slotRect(fr, f.w, f.h, { margin: MARGIN_MM, gutter: GUTTER_MM, bleed: 0 })
      const x = r.x * pxPerMm, y = r.y * pxPerMm, w = r.w * pxPerMm, h = r.h * pxPerMm
      if (!mediaId) { ctx.fillStyle = '#eee'; ctx.fillRect(x, y, w, h); continue }
      try {
        const img = await loadImage(resolve(mediaId))
        const sr = sourceRect(img.width, img.height, w / h, cell)
        ctx.drawImage(img, sr.sx, sr.sy, sr.sw, sr.sh, x, y, w, h)
      } catch { ctx.fillStyle = '#ebebeb'; ctx.fillRect(x, y, w, h) }
    }
    const blob: Blob = await new Promise((res) => c.toBlob((b2) => res(b2!), 'image/jpeg', 0.92))
    zip.file(`pagina-${String(p + 1).padStart(3, '0')}.jpg`, blob)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(out); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}
