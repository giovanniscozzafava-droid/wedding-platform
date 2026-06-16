// Modello "elemento libero" stile Canva: ogni foto è un riquadro che sposti,
// ridimensioni, ruoti liberamente sulla pagina; con SMART GUIDES (centro, margini,
// bordi, allineamento con gli altri elementi). Tutte funzioni PURE → testabili.
import { framesForPage, type AlbumPage } from './albumEngine'
import { DEFAULT_CELL, MARGIN_MM, type Cell, type Frame } from './albumGeometry'
import { getFormat } from './albumFormats'

export type FreeBorder = { w: number; color: string } // w in mm
export type FreeEl = {
  id: string; mediaId: string
  x: number; y: number; w: number; h: number  // frazioni pagina 0..1 (top-left + size)
  rot: number                                   // gradi
  cell: Cell                                     // crop interno al riquadro
  border?: FreeBorder | null
  shadow?: boolean
}

export const MIN_EL = 0.04
export const SNAP_THR = 0.012 // soglia aggancio (frazione pagina)

function uid(): string {
  try { return crypto.randomUUID() } catch { return `e-${Date.now()}-${Math.floor(Math.random() * 1e9)}` }
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

// Converte il layout a template in elementi liberi (per poi muoverli a piacere).
export function toFreeElements(page: AlbumPage, formatKey: string): FreeEl[] {
  const fmt = getFormat(formatKey)
  const mx = MARGIN_MM / fmt.w, my = MARGIN_MM / fmt.h
  const cw = 1 - 2 * mx, ch = 1 - 2 * my
  const g = 0.004 // micro-gutter
  const frames = framesForPage(page)
  const out: FreeEl[] = []
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i] as Frame
    const mediaId = page.mediaIds[i]
    if (!mediaId) continue
    out.push({
      id: uid(), mediaId,
      x: mx + fr.x * cw + g, y: my + fr.y * ch + g,
      w: Math.max(MIN_EL, fr.w * cw - 2 * g), h: Math.max(MIN_EL, fr.h * ch - 2 * g),
      rot: 0, cell: page.cells?.[i] ?? { ...DEFAULT_CELL },
    })
  }
  return out
}

export function newFreeEl(mediaId: string): FreeEl {
  return { id: uid(), mediaId, x: 0.3, y: 0.3, w: 0.4, h: 0.4, rot: 0, cell: { ...DEFAULT_CELL } }
}

export function moveEl(el: FreeEl, x: number, y: number): FreeEl {
  return { ...el, x: clamp(x, -el.w + 0.03, 1 - 0.03), y: clamp(y, -el.h + 0.03, 1 - 0.03) }
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'
// Ridimensiona tenendo fisso l'angolo opposto. (nx,ny) = nuova posizione dell'angolo trascinato.
export function resizeEl(el: FreeEl, corner: Corner, nx: number, ny: number): FreeEl {
  const right = el.x + el.w, bottom = el.y + el.h
  let x = el.x, y = el.y, w = el.w, h = el.h
  if (corner === 'se') { w = nx - el.x; h = ny - el.y }
  else if (corner === 'ne') { w = nx - el.x; y = Math.min(ny, bottom - MIN_EL); h = bottom - y }
  else if (corner === 'sw') { x = Math.min(nx, right - MIN_EL); w = right - x; h = ny - el.y }
  else { x = Math.min(nx, right - MIN_EL); w = right - x; y = Math.min(ny, bottom - MIN_EL); h = bottom - y }
  w = Math.max(MIN_EL, w); h = Math.max(MIN_EL, h)
  return { ...el, x, y, w, h }
}

// Rotazione con aggancio a 0/15/30/45/90… entro 4°.
export function snapAngle(deg: number): number {
  let d = ((deg % 360) + 360) % 360
  for (const a of [0, 45, 90, 135, 180, 225, 270, 315, 360]) if (Math.abs(d - a) <= 4) { d = a % 360; return d }
  const near = Math.round(d / 15) * 15
  if (Math.abs(d - near) <= 2) d = near % 360
  return d
}

export type Snap = { x: number; y: number; vGuides: number[]; hGuides: number[] }
// Smart guides: aggancia left/center/right (x) e top/middle/bottom (y) a pagina,
// margini, e bordi/centri degli altri elementi. Ritorna posizione agganciata + guide da disegnare.
export function snapMove(el: FreeEl, others: FreeEl[], marginX: number, marginY: number, thr = SNAP_THR): Snap {
  const xTargets = [0, marginX, 0.5, 1 - marginX, 1]
  const yTargets = [0, marginY, 0.5, 1 - marginY, 1]
  for (const o of others) { xTargets.push(o.x, o.x + o.w / 2, o.x + o.w); yTargets.push(o.y, o.y + o.h / 2, o.y + o.h) }

  const vGuides: number[] = [], hGuides: number[] = []
  let dx = 0, bestX = thr
  for (const cand of [el.x, el.x + el.w / 2, el.x + el.w]) {
    for (const t of xTargets) { const d = t - cand; if (Math.abs(d) < bestX) { bestX = Math.abs(d); dx = d } }
  }
  if (bestX < thr) { for (const cand of [el.x + dx, el.x + el.w / 2 + dx, el.x + el.w + dx]) for (const t of xTargets) if (Math.abs(t - cand) < 1e-4) vGuides.push(t) }

  let dy = 0, bestY = thr
  for (const cand of [el.y, el.y + el.h / 2, el.y + el.h]) {
    for (const t of yTargets) { const d = t - cand; if (Math.abs(d) < bestY) { bestY = Math.abs(d); dy = d } }
  }
  if (bestY < thr) { for (const cand of [el.y + dy, el.y + el.h / 2 + dy, el.y + el.h + dy]) for (const t of yTargets) if (Math.abs(t - cand) < 1e-4) hGuides.push(t) }

  return { x: el.x + (bestX < thr ? dx : 0), y: el.y + (bestY < thr ? dy : 0), vGuides: [...new Set(vGuides)], hGuides: [...new Set(hGuides)] }
}

// ── SPAZIATURA UGUALE (stile Canva) ─────────────────────────────────────────
// Quando trascini una foto tra/accanto ad altre, aggancia in modo che il margine
// a sinistra sia uguale a quello a destra (e sopra=sotto), così la spaziatura tra
// le foto è "perfetta". Restituisce i segmenti di gap da disegnare come riferimento.
export type GapMark = { axis: 'x' | 'y'; a: number; b: number; cross: number } // a..b lungo l'asse, a metà 'cross'
export type Spacing = { x: number; y: number; marks: GapMark[] }
function overlap(a0: number, a1: number, b0: number, b1: number): number { return Math.min(a1, b1) - Math.max(a0, b0) }

// Distanze (margini) verso il vicino più prossimo su OGNI lato — SEMPRE, anche senza aggancio.
// Servono a mostrare in continuo i righelli viola/rosa mentre si sposta una foto, per allineare.
export function neighborGaps(el: FreeEl, others: FreeEl[]): GapMark[] {
  const out: GapMark[] = []
  const row = others.filter((o) => overlap(el.y, el.y + el.h, o.y, o.y + o.h) > 0.25 * Math.min(el.h, o.h))
  const left = row.filter((o) => o.x + o.w <= el.x + 1e-4).sort((a, b) => (b.x + b.w) - (a.x + a.w))[0]
  const right = row.filter((o) => o.x >= el.x + el.w - 1e-4).sort((a, b) => a.x - b.x)[0]
  if (left) { const cross = (Math.max(el.y, left.y) + Math.min(el.y + el.h, left.y + left.h)) / 2; out.push({ axis: 'x', a: left.x + left.w, b: el.x, cross }) }
  if (right) { const cross = (Math.max(el.y, right.y) + Math.min(el.y + el.h, right.y + right.h)) / 2; out.push({ axis: 'x', a: el.x + el.w, b: right.x, cross }) }
  const col = others.filter((o) => overlap(el.x, el.x + el.w, o.x, o.x + o.w) > 0.25 * Math.min(el.w, o.w))
  const up = col.filter((o) => o.y + o.h <= el.y + 1e-4).sort((a, b) => (b.y + b.h) - (a.y + a.h))[0]
  const down = col.filter((o) => o.y >= el.y + el.h - 1e-4).sort((a, b) => a.y - b.y)[0]
  if (up) { const cross = (Math.max(el.x, up.x) + Math.min(el.x + el.w, up.x + up.w)) / 2; out.push({ axis: 'y', a: up.y + up.h, b: el.y, cross }) }
  if (down) { const cross = (Math.max(el.x, down.x) + Math.min(el.x + el.w, down.x + down.w)) / 2; out.push({ axis: 'y', a: el.y + el.h, b: down.y, cross }) }
  return out
}

// Bordo bianco "standard" tra le foto (frazione di pagina) quando non c'è ancora
// un gutter di riferimento sulla pagina. ~1.8% del lato.
export const GUTTER = 0.02

// Gap (bordi bianchi) già presenti tra coppie di foto che si sovrappongono sull'asse opposto.
function refGaps(others: FreeEl[], axis: 'x' | 'y'): number[] {
  const res: number[] = []
  for (let i = 0; i < others.length; i++) {
    for (let j = 0; j < others.length; j++) {
      if (i === j) continue
      const a = others[i]!, b = others[j]!
      if (axis === 'x') { if (overlap(a.y, a.y + a.h, b.y, b.y + b.h) <= 0) continue; const g = b.x - (a.x + a.w); if (g > 1e-4) res.push(g) }
      else { if (overlap(a.x, a.x + a.w, b.x, b.x + b.w) <= 0) continue; const g = b.y - (a.y + a.h); if (g > 1e-4) res.push(g) }
    }
  }
  return res
}
// Il gutter di riferimento più vicino al gap corrente (default = GUTTER): così tutti i
// bordi bianchi finiscono per avere gli STESSI millimetri.
function nearestGutter(g: number, refs: number[]): number {
  let best = GUTTER, bd = Math.abs(g - GUTTER)
  for (const r of refs) { const d = Math.abs(g - r); if (d < bd) { bd = d; best = r } }
  return best
}

// Aggancia: (1) margine sx=dx / sopra=sotto quando si è tra due foto; (2) altrimenti
// fa coincidere il bordo bianco con il gutter standard / quello già usato sulla pagina.
export function spacingSnap(el: FreeEl, others: FreeEl[], thr = SNAP_THR): Spacing {
  let x = el.x, y = el.y
  const marks: GapMark[] = []
  // ── asse X: vicini sulla stessa "riga" (si sovrappongono in verticale) ──
  const row = others.filter((o) => overlap(el.y, el.y + el.h, o.y, o.y + o.h) > 0.3 * Math.min(el.h, o.h))
  const left = row.filter((o) => o.x + o.w <= el.x + thr).sort((a, b) => (b.x + b.w) - (a.x + a.w))[0]
  const right = row.filter((o) => o.x >= el.x + el.w - thr).sort((a, b) => a.x - b.x)[0]
  const xrefs = refGaps(others, 'x')
  if (left && right) {
    const target = ((left.x + left.w) + right.x - el.w) / 2
    if (Math.abs(el.x - target) < thr) {
      x = target
      const cross = (Math.max(el.y, left.y, right.y) + Math.min(el.y + el.h, left.y + left.h, right.y + right.h)) / 2
      marks.push({ axis: 'x', a: left.x + left.w, b: x, cross }, { axis: 'x', a: x + el.w, b: right.x, cross })
    }
  } else if (left) {
    const tg = nearestGutter(el.x - (left.x + left.w), xrefs); const tx = left.x + left.w + tg
    if (Math.abs(el.x - tx) < thr) { x = tx; const cross = (Math.max(el.y, left.y) + Math.min(el.y + el.h, left.y + left.h)) / 2; marks.push({ axis: 'x', a: left.x + left.w, b: x, cross }) }
  } else if (right) {
    const tg = nearestGutter(right.x - (el.x + el.w), xrefs); const tx = right.x - tg - el.w
    if (Math.abs(el.x - tx) < thr) { x = tx; const cross = (Math.max(el.y, right.y) + Math.min(el.y + el.h, right.y + right.h)) / 2; marks.push({ axis: 'x', a: x + el.w, b: right.x, cross }) }
  }
  // ── asse Y: vicini sulla stessa "colonna" (si sovrappongono in orizzontale) ──
  const col = others.filter((o) => overlap(el.x, el.x + el.w, o.x, o.x + o.w) > 0.3 * Math.min(el.w, o.w))
  const up = col.filter((o) => o.y + o.h <= el.y + thr).sort((a, b) => (b.y + b.h) - (a.y + a.h))[0]
  const down = col.filter((o) => o.y >= el.y + el.h - thr).sort((a, b) => a.y - b.y)[0]
  const yrefs = refGaps(others, 'y')
  if (up && down) {
    const target = ((up.y + up.h) + down.y - el.h) / 2
    if (Math.abs(el.y - target) < thr) {
      y = target
      const cross = (Math.max(el.x, up.x, down.x) + Math.min(el.x + el.w, up.x + up.w, down.x + down.w)) / 2
      marks.push({ axis: 'y', a: up.y + up.h, b: y, cross }, { axis: 'y', a: y + el.h, b: down.y, cross })
    }
  } else if (up) {
    const tg = nearestGutter(el.y - (up.y + up.h), yrefs); const ty = up.y + up.h + tg
    if (Math.abs(el.y - ty) < thr) { y = ty; const cross = (Math.max(el.x, up.x) + Math.min(el.x + el.w, up.x + up.w)) / 2; marks.push({ axis: 'y', a: up.y + up.h, b: y, cross }) }
  } else if (down) {
    const tg = nearestGutter(down.y - (el.y + el.h), yrefs); const ty = down.y - tg - el.h
    if (Math.abs(el.y - ty) < thr) { y = ty; const cross = (Math.max(el.x, down.x) + Math.min(el.x + el.w, down.x + down.w)) / 2; marks.push({ axis: 'y', a: y + el.h, b: down.y, cross }) }
  }
  return { x, y, marks }
}

// Sposta in blocco gli elementi con id in `ids` di (dx,dy) (clamp come moveEl).
export function moveManyBy(els: FreeEl[], ids: string[], dx: number, dy: number): FreeEl[] {
  const set = new Set(ids)
  return els.map((e) => (set.has(e.id) ? moveEl(e, e.x + dx, e.y + dy) : e))
}

export function removeFreeEl(els: FreeEl[], id: string): FreeEl[] { return els.filter((e) => e.id !== id) }
export function removeManyFree(els: FreeEl[], ids: string[]): FreeEl[] { const set = new Set(ids); return els.filter((e) => !set.has(e.id)) }
export function updateFreeEl(els: FreeEl[], id: string, patch: Partial<FreeEl>): FreeEl[] {
  return els.map((e) => (e.id === id ? { ...e, ...patch } : e))
}
export function bringToFront(els: FreeEl[], id: string): FreeEl[] {
  const el = els.find((e) => e.id === id); if (!el) return els
  return [...els.filter((e) => e.id !== id), el]
}
