// Lettura e normalizzazione della piantina sala da FOTO o PDF, poi upload come
// immagine nel bucket 'floor-plans'. Il PDF viene "letto" (renderizzato) lato
// client con pdf.js e convertito in immagine, così la proiezione nel tableau è
// sempre un'immagine semplice da disegnare.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { supabase } from '@/lib/supabase'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const MAX_DIM = 1800 // lato lungo massimo dell'immagine proiettata

export type FloorPlanImage = { blob: Blob; ratio: number; width: number; height: number }

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', q = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob fallito'))), type, q))
}

// Disegna un'immagine già caricata su canvas rimpicciolendola entro MAX_DIM.
function drawScaled(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_DIM / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw; canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch) // sfondo bianco (PDF/PNG trasparenti)
  ctx.drawImage(src, 0, 0, cw, ch)
  return canvas
}

async function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error('Immagine non leggibile'))
      im.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Immagine senza dimensioni')
    return drawScaled(img, img.naturalWidth, img.naturalHeight)
  } finally { URL.revokeObjectURL(url) }
}

async function pdfFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const page = await pdf.getPage(1) // prima pagina
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(3, Math.max(1, MAX_DIM / Math.max(base.width, base.height)))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  await pdf.cleanup()
  return canvas
}

// Punto d'ingresso: accetta foto (jpg/png/webp/heic via browser) o PDF.
export async function fileToFloorPlanImage(file: File): Promise<FloorPlanImage> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const canvas = isPdf ? await pdfFileToCanvas(file) : await imageFileToCanvas(file)
  const blob = await canvasToBlob(canvas)
  return { blob, width: canvas.width, height: canvas.height, ratio: +(canvas.width / canvas.height).toFixed(4) }
}

// Converte + carica nel bucket pubblico, ritorna URL pubblico e proporzione.
export async function uploadFloorPlan(file: File, stamp: number): Promise<{ image_url: string; ratio: number }> {
  const { data: au } = await supabase.auth.getUser()
  const uid = au?.user?.id
  if (!uid) throw new Error('Non autenticato')
  const fp = await fileToFloorPlanImage(file)
  const path = `${uid}/${stamp}-${Math.round(fp.ratio * 1000)}.jpg`
  const { error } = await supabase.storage.from('floor-plans').upload(path, fp.blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data: pub } = supabase.storage.from('floor-plans').getPublicUrl(path)
  return { image_url: pub.publicUrl, ratio: fp.ratio }
}
