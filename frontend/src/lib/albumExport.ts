// Export dell'album impaginato. Disegna ogni slot con cover-crop su canvas e lo
// inserisce nel PDF a misura reale (mm) per il formato scelto. Modalità: pagine
// singole o spread (doppia pagina). In alternativa, JPG per pagina dentro uno ZIP.
import { getFormat } from './albumFormats'
import { framesForPage, type AlbumPage } from './albumEngine'

const GUTTER_MM = 4 // distanza tra le foto
const MARGIN_MM = 8 // margine pagina

export type UrlResolver = (mediaId: string) => string

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('img'))
    img.src = url
  })
}

// disegna `img` su un canvas wpx×hpx con cover-crop, ritorna dataURL JPEG
function coverDataUrl(img: HTMLImageElement, wpx: number, hpx: number, q = 0.9): string {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(wpx)); c.height = Math.max(1, Math.round(hpx))
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
  const ir = img.width / img.height, tr = c.width / c.height
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (ir > tr) { sw = img.height * tr; sx = (img.width - sw) / 2 }
  else { sh = img.width / tr; sy = (img.height - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', q)
}

// Rende UNA pagina (facciata) dentro un rettangolo del PDF a partire da (ox,oy) mm.
async function renderPageInto(pdf: any, page: AlbumPage, fmtW: number, fmtH: number, ox: number, oy: number, resolve: UrlResolver, dpi: number) {
  const frames = framesForPage(page)
  const innerW = fmtW - 2 * MARGIN_MM, innerH = fmtH - 2 * MARGIN_MM
  const pxPerMm = dpi / 25.4
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i]!; const mediaId = page.mediaIds[i]
    const x = ox + MARGIN_MM + fr.x * innerW + (fr.x > 0 ? GUTTER_MM / 2 : 0)
    const y = oy + MARGIN_MM + fr.y * innerH + (fr.y > 0 ? GUTTER_MM / 2 : 0)
    const w = fr.w * innerW - (fr.x + fr.w < 1 ? GUTTER_MM / 2 : 0) - (fr.x > 0 ? GUTTER_MM / 2 : 0)
    const h = fr.h * innerH - (fr.y + fr.h < 1 ? GUTTER_MM / 2 : 0) - (fr.y > 0 ? GUTTER_MM / 2 : 0)
    if (!mediaId) { pdf.setFillColor(238, 238, 238); pdf.rect(x, y, w, h, 'F'); continue }
    try {
      const img = await loadImage(resolve(mediaId))
      const data = coverDataUrl(img, w * pxPerMm, h * pxPerMm)
      pdf.addImage(data, 'JPEG', x, y, w, h)
    } catch {
      pdf.setFillColor(235, 235, 235); pdf.rect(x, y, w, h, 'F')
    }
  }
}

export type PdfMode = 'pages' | 'spreads'

export async function exportAlbumPdf(pages: AlbumPage[], formatKey: string, resolve: UrlResolver, opts: { mode?: PdfMode; dpi?: number; filename?: string } = {}) {
  const { mode = 'pages', dpi = 150, filename = 'album.pdf' } = opts
  const f = getFormat(formatKey)
  const { default: jsPDF } = await import('jspdf')

  if (mode === 'spreads') {
    const sw = f.w * 2, sh = f.h
    const pdf = new jsPDF({ orientation: sw >= sh ? 'landscape' : 'portrait', unit: 'mm', format: [sw, sh] })
    for (let i = 0; i < pages.length; i += 2) {
      if (i > 0) pdf.addPage([sw, sh], sw >= sh ? 'landscape' : 'portrait')
      await renderPageInto(pdf, pages[i]!, f.w, f.h, 0, 0, resolve, dpi)
      if (pages[i + 1]) await renderPageInto(pdf, pages[i + 1]!, f.w, f.h, f.w, 0, resolve, dpi)
    }
    pdf.save(filename)
    return
  }

  const pdf = new jsPDF({ orientation: f.w >= f.h ? 'landscape' : 'portrait', unit: 'mm', format: [f.w, f.h] })
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage([f.w, f.h], f.w >= f.h ? 'landscape' : 'portrait')
    await renderPageInto(pdf, pages[i]!, f.w, f.h, 0, 0, resolve, dpi)
  }
  pdf.save(filename)
}

// JPG per pagina dentro uno ZIP (una facciata = un'immagine).
export async function exportAlbumJpgZip(pages: AlbumPage[], formatKey: string, resolve: UrlResolver, opts: { dpi?: number; filename?: string } = {}) {
  const { dpi = 150, filename = 'album-jpg.zip' } = opts
  const f = getFormat(formatKey)
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const pxPerMm = dpi / 25.4
  const innerScale = 1
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!
    const c = document.createElement('canvas')
    c.width = Math.round(f.w * pxPerMm * innerScale); c.height = Math.round(f.h * pxPerMm * innerScale)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
    const frames = framesForPage(page)
    const mPx = MARGIN_MM * pxPerMm, gPx = GUTTER_MM * pxPerMm
    const innerW = c.width - 2 * mPx, innerH = c.height - 2 * mPx
    for (let i = 0; i < frames.length; i++) {
      const fr = frames[i]!; const mediaId = page.mediaIds[i]
      const x = mPx + fr.x * innerW + (fr.x > 0 ? gPx / 2 : 0)
      const y = mPx + fr.y * innerH + (fr.y > 0 ? gPx / 2 : 0)
      const w = fr.w * innerW - (fr.x + fr.w < 1 ? gPx / 2 : 0) - (fr.x > 0 ? gPx / 2 : 0)
      const h = fr.h * innerH - (fr.y + fr.h < 1 ? gPx / 2 : 0) - (fr.y > 0 ? gPx / 2 : 0)
      if (!mediaId) { ctx.fillStyle = '#eee'; ctx.fillRect(x, y, w, h); continue }
      try {
        const img = await loadImage(resolve(mediaId))
        const ir = img.width / img.height, tr = w / h
        let sx = 0, sy = 0, sw = img.width, sh = img.height
        if (ir > tr) { sw = img.height * tr; sx = (img.width - sw) / 2 } else { sh = img.width / tr; sy = (img.height - sh) / 2 }
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
      } catch { ctx.fillStyle = '#ebebeb'; ctx.fillRect(x, y, w, h) }
    }
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.9))
    zip.file(`pagina-${String(p + 1).padStart(3, '0')}.jpg`, blob)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(out); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}
