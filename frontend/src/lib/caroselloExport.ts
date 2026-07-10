// Export "seamless carousel": disegna la STRIP continua (una AlbumPage libera larga N*slide)
// su un unico canvas N*slideW × slideH, poi la affetta in N slide slideW×slideH → ZIP di JPG
// numerati. Gli elementi che attraversano il confine tra due slide restano continui = swipe
// continuo su Instagram. Riusa drawPageInto dell'album (stesso renderer di crop/rotazione).
import type { AlbumPage } from './albumEngine'
import { drawPageInto, ExportCancelled, type UrlResolver } from './albumExport'

// Disegna l'intera strip su un canvas N*slideW × slideH (non affettato). Riusabile per anteprima.
export async function renderCaroselloStrip(strip: AlbumPage, slideW: number, slideH: number, n: number, resolve: UrlResolver): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(slideW * n))
  c.height = Math.max(1, Math.round(slideH))
  const ctx = c.getContext('2d')!
  ctx.fillStyle = strip.bg ?? '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  // pxPerMm serve solo allo spessore dei bordi degli elementi liberi: valore coerente col pixel.
  await drawPageInto(ctx, strip, 0, c.width, c.height, slideW / 100, resolve, null)
  return c
}

export async function exportCaroselloZip(
  strip: AlbumPage, slideW: number, slideH: number, n: number, resolve: UrlResolver,
  opts: { filename?: string; returnBlob?: boolean; onProgress?: (done: number, total: number) => void; onZip?: (p: number) => void; shouldCancel?: () => boolean } = {},
): Promise<Blob | void> {
  const { filename = 'carosello.zip', returnBlob = false, onProgress, onZip, shouldCancel } = opts
  const { default: JSZip } = await import('jszip')
  const big = await renderCaroselloStrip(strip, slideW, slideH, n, resolve)
  const zip = new JSZip()
  for (let k = 0; k < n; k++) {
    if (shouldCancel?.()) throw new ExportCancelled()
    const c = document.createElement('canvas')
    c.width = slideW; c.height = slideH
    // affetta la k-esima slide dalla strip (drawImage src-rect → dest 0,0)
    c.getContext('2d')!.drawImage(big, k * slideW, 0, slideW, slideH, 0, 0, slideW, slideH)
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.92))
    zip.file(`slide-${String(k + 1).padStart(2, '0')}.jpg`, blob)
    onProgress?.(k + 1, n)
  }
  onZip?.(0)
  const out = await zip.generateAsync({ type: 'blob' }, (m) => onZip?.(Math.round(m.percent)))
  if (returnBlob) return out
  const a = document.createElement('a')
  a.href = URL.createObjectURL(out); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}
