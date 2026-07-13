// Timbri decorativi di qualità per lo Studio immagine — arte vettoriale (bezier) verificata.
// I tracciati sono generati/verificati fuori dall'app (scratchpad/stamps.mjs) e baked in JSON:
// spazio locale centrato (-100..100, y giù). Reso con Path2D su canvas (fill o stroke).
import STAMP_DATA from './studioStamps.data.json'

export type StampPath = { d: string; w?: number }   // w presente => stroke, assente => fill
export type StampDef = { id: string; label: string; group: string; paths: StampPath[] }

export const STAMPS: StampDef[] = STAMP_DATA as StampDef[]
export const STAMP_GROUPS: string[] = [...new Set(STAMPS.map((s) => s.group))]
const BY_ID = new Map(STAMPS.map((s) => [s.id, s]))
export const DEFAULT_STAMP = STAMPS[0]?.id ?? 'leaf-round'

// cache dei Path2D compilati per timbro (evita il re-parse a ogni "dab")
const cache = new Map<string, { p: Path2D; fill: boolean; w: number }[]>()
function compiled(id: string) {
  let c = cache.get(id)
  if (c) return c
  const def = BY_ID.get(id)
  c = (def?.paths ?? []).map((pt) => ({ p: new Path2D(pt.d), fill: pt.w === undefined, w: pt.w ?? 4 }))
  cache.set(id, c)
  return c
}

// Disegna il timbro centrato in (x,y), scalato al raggio R, in tinta unita `color`.
export function drawStamp(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, R: number, color: string, alpha = 1) {
  const list = compiled(id)
  if (!list.length) return
  const s = R / 100
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const it of list) {
    if (it.fill) ctx.fill(it.p)
    else { ctx.lineWidth = it.w; ctx.stroke(it.p) }
  }
  ctx.restore()
}
