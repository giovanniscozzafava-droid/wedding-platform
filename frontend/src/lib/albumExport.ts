// Export dell'album impaginato. Disegna ogni slot con crop/zoom/abbondanza coerenti
// con l'anteprima (stessa geometria) e lo inserisce nel PDF a misura reale (mm).
// Modalità: pagine singole (con abbondanza per la stampa) o spread (per revisione).
// JPG per pagina in uno ZIP.
import { getFormat } from './albumFormats'
import { framesForPage, type AlbumPage } from './albumEngine'
import { slotRect, sourceRect, pageBox, coverScaleForRotation, DEFAULT_CELL, MARGIN_MM, GUTTER_MM, BLEED_MM, type Cell } from './albumGeometry'

// Disegna l'immagine nel rettangolo (dx,dy,w,h) con crop (sourceRect) + rotazione FOTO cell.r
// dentro la cornice ferma: clip al rettangolo + rotazione attorno al centro + scala-cover, così
// non restano angoli vuoti e stampa/anteprima coincidono. r=0 → drawImage identico a prima.
function drawCellImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, w: number, h: number, cell: Cell) {
  const sr = sourceRect(img.width, img.height, w / h, cell)
  const r = cell?.r ?? 0
  const sh = cell?.fh ? -1 : 1, sv = cell?.fv ? -1 : 1 // specchia orizzontale/verticale
  if (!r && sh === 1 && sv === 1) { ctx.drawImage(img, sr.sx, sr.sy, sr.sw, sr.sh, dx, dy, w, h); return }
  const k = coverScaleForRotation(r, w / h)
  ctx.save()
  ctx.beginPath(); ctx.rect(dx, dy, w, h); ctx.clip()
  ctx.translate(dx + w / 2, dy + h / 2)
  if (r) ctx.rotate((r * Math.PI) / 180)
  ctx.scale(k * sh, k * sv)
  ctx.drawImage(img, sr.sx, sr.sy, sr.sw, sr.sh, -w / 2, -h / 2, w, h)
  ctx.restore()
}

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
  drawCellImage(ctx, img, 0, 0, c.width, c.height, cell)
  return c.toDataURL('image/jpeg', q)
}

type SFrame = { x: number; y: number; w: number; h: number }
const FULL_FRAME: SFrame = { x: 0, y: 0, w: 1, h: 1 }
// Foto a PIENA TAVOLA con cornice libera (frame 0..1 dello spread). pageWpx = larghezza UNA pagina.
// side 'both' = tavola intera (canvas 2*pageWpx); 'L'/'R' = una facciata (canvas pageWpx).
function drawFramedSpread(ctx: CanvasRenderingContext2D, img: HTMLImageElement, pageWpx: number, hpx: number, cell: Cell, frame: SFrame, side: 'both' | 'L' | 'R') {
  const fullWpx = pageWpx * 2
  const fw = frame.w * fullWpx, fh = frame.h * hpx
  const fx = frame.x * fullWpx, fy = frame.y * hpx
  const sr = sourceRect(img.width, img.height, fw / fh, cell)
  if (side === 'both') { ctx.drawImage(img, sr.sx, sr.sy, sr.sw, sr.sh, fx, fy, fw, fh); return }
  const off = side === 'L' ? 0 : -pageWpx
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, pageWpx, hpx); ctx.clip()
  ctx.drawImage(img, sr.sx, sr.sy, sr.sw, sr.sh, fx + off, fy, fw, fh)
  ctx.restore()
}
function framedSpreadDataUrl(img: HTMLImageElement, pageWpx: number, hpx: number, cell: Cell, frame: SFrame, side: 'both' | 'L' | 'R'): string {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(side === 'both' ? pageWpx * 2 : pageWpx)); c.height = Math.max(1, Math.round(hpx))
  drawFramedSpread(c.getContext('2d')!, img, pageWpx, hpx, cell, frame, side)
  return c.toDataURL('image/png') // PNG: fuori dalla cornice resta trasparente (mostra le pagine sotto)
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
    drawCellImage(ctx, img, -elWpx / 2, -elHpx / 2, elWpx, elHpx, el.cell)
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

function pageNumText(pdf: any, n: number, cx: number, y: number) {
  pdf.setFontSize(8); pdf.setTextColor(120, 120, 120); pdf.text(String(n), cx, y, { align: 'center' })
}

export class ExportCancelled extends Error { constructor() { super('export_cancelled'); this.name = 'ExportCancelled' } }

export async function exportAlbumPdf(pages: AlbumPage[], formatKey: string, resolve: UrlResolver, opts: { mode?: PdfMode; dpi?: number; filename?: string; bleed?: boolean; cutMarks?: boolean; pageNumbers?: boolean; onProgress?: (done: number, total: number) => void; shouldCancel?: () => boolean } = {}) {
  const { mode = 'pages', dpi = 150, filename = 'album.pdf', bleed = false, cutMarks = false, pageNumbers = false, onProgress, shouldCancel } = opts
  const f = getFormat(formatKey)
  const { default: jsPDF } = await import('jspdf')

  if (mode === 'spreads') {
    // LA TAVOLA È UN UNICO FOGLIO: larghezza = 2× pagina (es. 30×40 → 60×40). La linea
    // centrale è solo la piega (dorso), non un confine. L'abbondanza è sui 4 bordi ESTERNI
    // del foglio (mai sul dorso); i crocini segnano il trim della tavola intera.
    const b = bleed ? BLEED_MM : 0
    const trimW = f.w * 2, trimH = f.h
    const sheetW = trimW + 2 * b, sheetH = trimH + 2 * b
    const land = sheetW >= sheetH
    const pdf = new jsPDF({ orientation: land ? 'landscape' : 'portrait', unit: 'mm', format: [sheetW, sheetH] })
    for (let i = 0; i < pages.length; i += 2) {
      if (shouldCancel?.()) throw new ExportCancelled()
      if (i > 0) pdf.addPage([sheetW, sheetH], land ? 'landscape' : 'portrait')
      pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, sheetW, sheetH, 'F')
      if (pages[i]!.tavolaFree) {
        // TAVOLA UNICA: gli elementi liberi coprono l'intera tavola (largh. 2×W)
        await renderFreePage(pdf, pages[i]!, trimW, trimH, b, b, resolve, dpi)
      } else {
        await renderPageInto(pdf, pages[i]!, f.w, f.h, b, b, resolve, dpi, 0)
        if (pages[i + 1]) await renderPageInto(pdf, pages[i + 1]!, f.w, f.h, b + f.w, b, resolve, dpi, 0)
        const spS = pages[i]?.spreadImage
        if (spS) { try { const img = await loadImage(resolve(spS.mediaId)); const data = framedSpreadDataUrl(img, f.w * dpi / 25.4, f.h * dpi / 25.4, spS.cell, spS.frame ?? FULL_FRAME, 'both'); pdf.addImage(data, 'PNG', b, b, trimW, trimH) } catch { /* ignora foto mancante */ } }
      }
      if (cutMarks && b > 0) drawCutMarks(pdf, 0, 0, trimW, trimH, b)
      if (pageNumbers) { pageNumText(pdf, i + 1, b + f.w / 2, b + f.h - 5); if (pages[i + 1]) pageNumText(pdf, i + 2, b + f.w + f.w / 2, b + f.h - 5) }
      onProgress?.(Math.floor(i / 2) + 1, Math.ceil(pages.length / 2))
    }
    pdf.save(filename)
    return
  }

  // pagine singole: con abbondanza per la stampa (pagina ingrandita di 2*bleed)
  const b = bleed ? BLEED_MM : 0
  const box = pageBox(f.w, f.h, b)
  const pdf = new jsPDF({ orientation: box.w >= box.h ? 'landscape' : 'portrait', unit: 'mm', format: [box.w, box.h] })
  for (let i = 0; i < pages.length; i++) {
    if (shouldCancel?.()) throw new ExportCancelled()
    if (i > 0) pdf.addPage([box.w, box.h], box.w >= box.h ? 'landscape' : 'portrait')
    await renderPageInto(pdf, pages[i]!, f.w, f.h, 0, 0, resolve, dpi, b)
    // foto a piena tavola: questa facciata mostra la metà sx (pagina pari) o dx (pagina dispari)
    const spLeft = pages[i - (i % 2)]?.spreadImage
    if (spLeft) { try { const img = await loadImage(resolve(spLeft.mediaId)); const data = framedSpreadDataUrl(img, f.w * dpi / 25.4, f.h * dpi / 25.4, spLeft.cell, spLeft.frame ?? FULL_FRAME, i % 2 === 0 ? 'L' : 'R'); pdf.addImage(data, 'PNG', b, b, f.w, f.h) } catch { /* ignora */ } }
    if (cutMarks && b > 0) drawCutMarks(pdf, 0, 0, f.w, f.h, b)
    if (pageNumbers) pageNumText(pdf, i + 1, box.w / 2, box.h - 5 - b)
    onProgress?.(i + 1, pages.length)
  }
  pdf.save(filename)
}

// JPG per pagina dentro uno ZIP (una facciata = un'immagine). Senza abbondanza.
// Disegna una pagina dentro il riquadro (ox,0,wpx,hpx) del contesto dato.
async function drawPageInto(ctx: CanvasRenderingContext2D, page: AlbumPage, ox: number, wpx: number, hpx: number, pxPerMm: number, resolve: UrlResolver, pageNumber: number | null) {
  ctx.fillStyle = page.mode === 'free' ? (page.bg ?? '#ffffff') : '#ffffff'; ctx.fillRect(ox, 0, wpx, hpx)
  if (page.mode === 'free') {
    for (const el of page.elements ?? []) {
      const elWpx = el.w * wpx, elHpx = el.h * hpx
      const cxp = ox + (el.x + el.w / 2) * wpx, cyp = (el.y + el.h / 2) * hpx
      ctx.save(); ctx.translate(cxp, cyp); ctx.rotate((el.rot * Math.PI) / 180)
      if (el.shadow) { ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = 0.03 * Math.min(elWpx, elHpx); ctx.shadowOffsetY = 0.012 * elHpx }
      try { const img = await loadImage(resolve(el.mediaId)); drawCellImage(ctx, img, -elWpx / 2, -elHpx / 2, elWpx, elHpx, el.cell) } catch { ctx.fillStyle = '#ebebeb'; ctx.fillRect(-elWpx / 2, -elHpx / 2, elWpx, elHpx) }
      ctx.shadowColor = 'transparent'
      if (el.border) { ctx.lineWidth = Math.max(1, el.border.w * pxPerMm); ctx.strokeStyle = el.border.color; ctx.strokeRect(-elWpx / 2, -elHpx / 2, elWpx, elHpx) }
      ctx.restore()
    }
  } else {
    const f = { w: wpx / pxPerMm, h: hpx / pxPerMm }
    const frames = framesForPage(page)
    for (let i = 0; i < frames.length; i++) {
      const fr = frames[i]!; const mediaId = page.mediaIds[i]
      const cell = page.cells?.[i] ?? DEFAULT_CELL
      const r = slotRect(fr, f.w, f.h, { margin: MARGIN_MM, gutter: GUTTER_MM, bleed: 0 })
      const x = ox + r.x * pxPerMm, y = r.y * pxPerMm, w = r.w * pxPerMm, h = r.h * pxPerMm
      if (!mediaId) { ctx.fillStyle = '#eee'; ctx.fillRect(x, y, w, h); continue }
      try { const img = await loadImage(resolve(mediaId)); drawCellImage(ctx, img, x, y, w, h, cell) } catch { ctx.fillStyle = '#ebebeb'; ctx.fillRect(x, y, w, h) }
    }
  }
  if (pageNumber != null) { ctx.fillStyle = '#888'; ctx.font = `${Math.round(hpx * 0.02)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(String(pageNumber), ox + wpx / 2, hpx - hpx * 0.02) }
}

// JPG: 'pages' = una immagine per pagina (tavola divisa); 'spreads' = tavola intera (2 pagine affiancate).
export async function exportAlbumJpgZip(pages: AlbumPage[], formatKey: string, resolve: UrlResolver, opts: { dpi?: number; filename?: string; pageNumbers?: boolean; mode?: PdfMode; onProgress?: (done: number, total: number) => void; onZip?: (percent: number) => void; shouldCancel?: () => boolean } = {}) {
  const { dpi = 150, filename = 'album-jpg.zip', pageNumbers = false, mode = 'pages', onProgress, onZip, shouldCancel } = opts
  const f = getFormat(formatKey)
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const pxPerMm = dpi / 25.4
  const wpx = Math.round(f.w * pxPerMm), hpx = Math.round(f.h * pxPerMm)
  if (mode === 'spreads') {
    for (let s = 0; s < pages.length; s += 2) {
      if (shouldCancel?.()) throw new ExportCancelled()
      const lp = pages[s]!, rp = pages[s + 1]
      const c = document.createElement('canvas')
      c.width = wpx * (rp || lp.tavolaFree ? 2 : 1); c.height = hpx
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
      if (lp.tavolaFree) {
        // TAVOLA UNICA: una sola superficie libera larga 2×W
        await drawPageInto(ctx, lp, 0, wpx * 2, hpx, pxPerMm, resolve, pageNumbers ? s + 1 : null)
      } else {
        await drawPageInto(ctx, lp, 0, wpx, hpx, pxPerMm, resolve, pageNumbers ? s + 1 : null)
        if (rp) await drawPageInto(ctx, rp, wpx, wpx, hpx, pxPerMm, resolve, pageNumbers ? s + 2 : null)
        if (lp.spreadImage && rp) { try { const img = await loadImage(resolve(lp.spreadImage.mediaId)); drawFramedSpread(ctx, img, wpx, hpx, lp.spreadImage.cell, lp.spreadImage.frame ?? FULL_FRAME, 'both') } catch { /* ignora */ } }
      }
      const blob: Blob = await new Promise((res) => c.toBlob((b2) => res(b2!), 'image/jpeg', 0.92))
      zip.file(`tavola-${String(s / 2 + 1).padStart(3, '0')}.jpg`, blob)
      onProgress?.(Math.floor(s / 2) + 1, Math.ceil(pages.length / 2))
    }
  } else {
    for (let p = 0; p < pages.length; p++) {
      if (shouldCancel?.()) throw new ExportCancelled()
      const c = document.createElement('canvas')
      c.width = wpx; c.height = hpx
      const ctx = c.getContext('2d')!
      await drawPageInto(ctx, pages[p]!, 0, wpx, hpx, pxPerMm, resolve, pageNumbers ? p + 1 : null)
      const spLeft = pages[p - (p % 2)]?.spreadImage
      if (spLeft) { try { const img = await loadImage(resolve(spLeft.mediaId)); drawFramedSpread(ctx, img, wpx, hpx, spLeft.cell, spLeft.frame ?? FULL_FRAME, p % 2 === 0 ? 'L' : 'R') } catch { /* ignora */ } }
      const blob: Blob = await new Promise((res) => c.toBlob((b2) => res(b2!), 'image/jpeg', 0.92))
      zip.file(`pagina-${String(p + 1).padStart(3, '0')}.jpg`, blob)
      onProgress?.(p + 1, pages.length)
    }
  }
  if (shouldCancel?.()) throw new ExportCancelled()
  // Compressione ZIP finale: su album grandi a 240 DPI può durare parecchi secondi. Riporto la
  // percentuale così la barra non resta "ferma al 100%" senza feedback.
  onZip?.(0)
  const out = await zip.generateAsync({ type: 'blob' }, (meta) => onZip?.(Math.round(meta.percent)))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(out); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}
