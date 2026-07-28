// Sistema interno di ridimensionamento/compressione immagini per l'upload.
// Garantisce che ogni foto stia SOTTO un limite di byte (i bucket Storage hanno un cap),
// così non si prendono più errori 413 "Payload too large".
//
// Perché serve un fix robusto: su Safari/iPadOS l'encoding WebP NON è supportato e
// `canvas.toBlob(cb, 'image/webp')` restituisce un PNG (lossless, spesso 3-8MB) → sforava il cap.
// Qui accettiamo il WebP SOLO se il MIME è davvero image/webp e sta sotto il limite; altrimenti
// ripieghiamo su JPEG a qualità calante e, se ancora troppo grande, riduciamo le dimensioni.

export type ResizedImage = { blob: Blob; ext: 'webp' | 'jpg'; contentType: string }

const toBlobAsync = (canvas: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), type, q))

async function decode(file: File): Promise<HTMLImageElement> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
}

/**
 * Ridimensiona e comprime `file` restando SOTTO `maxBytes`.
 * @param maxBytes tetto in byte (default 1,8MB: margine sotto i bucket da 2MB)
 * @param maxDim lato lungo massimo in px (default 1400)
 */
export async function resizeImageUnder(file: File, maxBytes = 1_800_000, maxDim = 1400, quality = 0.8): Promise<ResizedImage> {
  const img = await decode(file)
  const ratio = Math.min(1, maxDim / Math.max(img.width || maxDim, img.height || maxDim))
  const w = Math.max(1, Math.round((img.width || maxDim) * ratio))
  const h = Math.max(1, Math.round((img.height || maxDim) * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)

  // WebP solo se il browser lo produce DAVVERO (Safari ritorna PNG per webp non supportato).
  const webp = await toBlobAsync(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp' && webp.size > 0 && webp.size <= maxBytes) {
    return { blob: webp, ext: 'webp', contentType: 'image/webp' }
  }
  // JPEG a qualità calante finché sta sotto il cap.
  for (const q of [quality, 0.7, 0.6, 0.5, 0.4]) {
    const jpeg = await toBlobAsync(canvas, 'image/jpeg', q)
    if (jpeg && jpeg.size > 0 && jpeg.size <= maxBytes) {
      return { blob: jpeg, ext: 'jpg', contentType: 'image/jpeg' }
    }
  }
  // Foto enorme: riduci ancora le dimensioni (fino a 900px) e riprova.
  if (maxDim > 900) return resizeImageUnder(file, maxBytes, Math.round(maxDim * 0.7), 0.7)
  const last = await toBlobAsync(canvas, 'image/jpeg', 0.4)
  if (!last) throw new Error('Impossibile generare immagine compressa')
  return { blob: last, ext: 'jpg', contentType: 'image/jpeg' }
}
