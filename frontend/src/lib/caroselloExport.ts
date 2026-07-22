// Export "seamless carousel": disegna la STRIP continua (una AlbumPage libera larga N*slide)
// su un unico canvas N*slideW × slideH, poi la affetta in N slide slideW×slideH → ZIP di JPG
// numerati. Gli elementi che attraversano il confine tra due slide restano continui = swipe
// continuo su Instagram. Riusa drawPageInto dell'album (stesso renderer di crop/rotazione).
import type { AlbumPage } from './albumEngine'
import { drawPageInto, ExportCancelled, type UrlResolver } from './albumExport'
import { getFontFamily, type TextEl } from './caroselloModels'

// Avvolge il testo alla larghezza `maxW` (rispettando anche gli \n espliciti).
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of (text || '').split('\n')) {
    const words = para.split(' ')
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w } else line = test
    }
    out.push(line)
  }
  return out
}

// Disegna i blocchi di testo sul canvas (coord. strip 0..1). W/H = dimensioni canvas.
function drawTexts(ctx: CanvasRenderingContext2D, texts: TextEl[], W: number, H: number) {
  for (const t of texts) {
    if (!t.text) continue
    const bw = t.w * W, bh = t.h * H, sizePx = Math.max(4, t.size * H)
    ctx.save()
    ctx.translate(t.x * W + bw / 2, t.y * H + bh / 2)
    if (t.rot) ctx.rotate((t.rot * Math.PI) / 180)
    if (t.bg) { ctx.fillStyle = t.bg; ctx.fillRect(-bw / 2, -bh / 2, bw, bh) }
    ctx.fillStyle = t.color
    ctx.textBaseline = 'top'
    ctx.textAlign = t.align
    ctx.font = `${t.italic ? 'italic ' : ''}${t.weight} ${sizePx}px ${getFontFamily(t.font)}`
    try { if (t.letter) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${t.letter}em` } catch { /* non supportato */ }
    const lh = sizePx * (t.line ?? 1.15)
    const lines = wrapLines(ctx, t.text, bw)
    const totalH = lines.length * lh
    const y0 = t.valign === 'middle' ? -totalH / 2 : t.valign === 'bottom' ? bh / 2 - totalH : -bh / 2
    const xa = t.align === 'left' ? -bw / 2 : t.align === 'right' ? bw / 2 : 0
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i]!, xa, y0 + i * lh)
    ctx.restore()
  }
}

// Assicura che i font display/sans siano caricati prima di disegnarli su canvas.
async function ensureFonts() {
  try {
    await Promise.all([
      (document as any).fonts?.load?.("700 40px 'Fraunces Variable'"),
      (document as any).fonts?.load?.("400 40px 'Inter Variable'"),
    ])
    await (document as any).fonts?.ready
  } catch { /* best effort */ }
}

// Disegna l'intera strip su un canvas N*slideW × slideH (non affettato). Riusabile per anteprima.
export async function renderCaroselloStrip(strip: AlbumPage, slideW: number, slideH: number, n: number, resolve: UrlResolver, texts: TextEl[] = []): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(slideW * n))
  c.height = Math.max(1, Math.round(slideH))
  const ctx = c.getContext('2d')!
  ctx.fillStyle = strip.bg ?? '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  // pxPerMm serve solo allo spessore dei bordi degli elementi liberi: valore coerente col pixel.
  await drawPageInto(ctx, strip, 0, c.width, c.height, slideW / 100, resolve, null)
  if (texts.length) { await ensureFonts(); drawTexts(ctx, texts, c.width, c.height) }
  return c
}

// Esporta UNA SOLA slide (k) della strip come singolo JPG (o blob). Utile per rigenerare/scaricare
// una tavola specifica senza rifare tutto il carosello.
export async function exportCaroselloSlide(
  strip: AlbumPage, slideW: number, slideH: number, n: number, k: number, resolve: UrlResolver,
  opts: { texts?: TextEl[]; filename?: string; returnBlob?: boolean } = {},
): Promise<Blob | void> {
  const { texts = [], filename = `slide-${String(k + 1).padStart(2, '0')}.jpg`, returnBlob = false } = opts
  const big = await renderCaroselloStrip(strip, slideW, slideH, n, resolve, texts)
  const c = document.createElement('canvas'); c.width = slideW; c.height = slideH
  c.getContext('2d')!.drawImage(big, k * slideW, 0, slideW, slideH, 0, 0, slideW, slideH)
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.92))
  if (returnBlob) return blob
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

export async function exportCaroselloZip(
  strip: AlbumPage, slideW: number, slideH: number, n: number, resolve: UrlResolver,
  opts: { texts?: TextEl[]; filename?: string; returnBlob?: boolean; onProgress?: (done: number, total: number) => void; onZip?: (p: number) => void; shouldCancel?: () => boolean } = {},
): Promise<Blob | void> {
  const { texts = [], filename = 'carosello.zip', returnBlob = false, onProgress, onZip, shouldCancel } = opts
  const { default: JSZip } = await import('jszip')
  const big = await renderCaroselloStrip(strip, slideW, slideH, n, resolve, texts)
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
