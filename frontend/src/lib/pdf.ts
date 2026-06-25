// Helper pdf.js condivisi per il catalogo album sfogliabile (riusa il worker già in uso
// per le piantine — vedi floorPlan.ts). Render di una pagina PDF su canvas/dataURL.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjsLib.PDFDocumentProxy

export async function loadPdf(src: ArrayBuffer | Uint8Array | string): Promise<PdfDoc> {
  const params = typeof src === 'string' ? { url: src } : { data: src }
  return pdfjsLib.getDocument(params as any).promise
}

// Renderizza una pagina (1-based) su un canvas, lato lungo ~maxDim px.
export async function renderPdfPage(pdf: PdfDoc, pageNum: number, maxDim = 1400): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(3, Math.max(0.5, maxDim / Math.max(base.width, base.height)))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

export async function renderPdfPageDataUrl(pdf: PdfDoc, pageNum: number, maxDim = 1400, quality = 0.85): Promise<string> {
  const canvas = await renderPdfPage(pdf, pageNum, maxDim)
  return canvas.toDataURL('image/jpeg', quality)
}

// Aspect ratio (w/h) della prima pagina — per decidere "gira il telefono".
export async function pdfPageAspect(pdf: PdfDoc, pageNum = 1): Promise<number> {
  const page = await pdf.getPage(pageNum)
  const vp = page.getViewport({ scale: 1 })
  return vp.width / vp.height
}
