// Utility per l'editor foto: carica un'immagine (CORS-clean via proxy), applica
// flip su una dataURL "di lavoro" e produce il ritaglio finale come Blob JPEG.

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () => reject(new Error('Immagine non caricabile')))
    img.src = src
  })
}

const rad = (deg: number) => (deg * Math.PI) / 180

function rotatedBox(w: number, h: number, deg: number) {
  const r = rad(deg)
  return {
    width: Math.abs(Math.cos(r) * w) + Math.abs(Math.sin(r) * h),
    height: Math.abs(Math.sin(r) * w) + Math.abs(Math.cos(r) * h),
  }
}

// Applica i flip alla sorgente e restituisce una dataURL "di lavoro" (sempre
// CORS-clean) su cui il Cropper opera. Senza flip restituisce la stessa src.
export async function bakeFlips(img: HTMLImageElement, flipH: boolean, flipV: boolean): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.translate(flipH ? canvas.width : 0, flipV ? canvas.height : 0)
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.95)
}

type Px = { x: number; y: number; width: number; height: number }

// Produce il ritaglio finale come Blob JPEG. `pixelCrop` è in coordinate immagine
// (da react-easy-crop, con la stessa `rotation`).
export async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Px,
  rotation = 0,
  quality = 0.92,
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const box = rotatedBox(image.naturalWidth, image.naturalHeight, rotation)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(box.width)
  canvas.height = Math.round(box.height)
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rad(rotation))
  ctx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2)
  ctx.drawImage(image, 0, 0)

  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(pixelCrop.width))
  out.height = Math.max(1, Math.round(pixelCrop.height))
  const octx = out.getContext('2d')!
  octx.drawImage(
    canvas,
    Math.round(pixelCrop.x), Math.round(pixelCrop.y), out.width, out.height,
    0, 0, out.width, out.height,
  )
  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('Export non riuscito'))), 'image/jpeg', quality)
  })
}
