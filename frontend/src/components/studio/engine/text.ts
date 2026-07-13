import type { TextObj } from './types'

// a-capo per larghezza (rispetta i \n espliciti) — usato per rasterizzare il testo in export/salvataggio.
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue }
    const words = para.split(' '); let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w } else line = test
    }
    out.push(line)
  }
  return out
}
export function drawTextObj(ctx: CanvasRenderingContext2D, t: TextObj) {
  if (!t.text.trim()) return
  ctx.save(); ctx.fillStyle = t.color; ctx.textBaseline = 'top'; ctx.font = `${t.size}px "${t.font}"`; ctx.textAlign = t.align
  const lh = t.size * 1.25
  const ax = t.align === 'center' ? t.x + t.w / 2 : t.align === 'right' ? t.x + t.w : t.x
  wrapLines(ctx, t.text, t.w).forEach((ln, i) => ctx.fillText(ln, ax, t.y + i * lh))
  ctx.restore()
}
