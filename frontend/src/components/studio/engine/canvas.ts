import type { Pt, Tool } from './types'

export const uidgen = () => 'l' + Math.abs((Date.now() ^ (performance.now() * 1000)) | 0).toString(36) + Math.floor(performance.now() % 9999).toString(36)
// vincola il punto finale: forme perfette (quadrato/cerchio) o angoli a 45° con Shift
export function constrainEnd(a: Pt, b: Pt, tool: Tool, shift: boolean): Pt {
  if (!shift) return b
  const dx = b.x - a.x, dy = b.y - a.y
  if (tool === 'line' || tool === 'arrow') { const len = Math.hypot(dx, dy); const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len } }
  const side = Math.max(Math.abs(dx), Math.abs(dy)); return { x: a.x + Math.sign(dx || 1) * side, y: a.y + Math.sign(dy || 1) * side }
}
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.crossOrigin = 'anonymous'; i.src = src })
}
export function newCanvas(w: number, h: number): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
