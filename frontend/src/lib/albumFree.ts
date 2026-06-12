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

export function removeFreeEl(els: FreeEl[], id: string): FreeEl[] { return els.filter((e) => e.id !== id) }
export function updateFreeEl(els: FreeEl[], id: string, patch: Partial<FreeEl>): FreeEl[] {
  return els.map((e) => (e.id === id ? { ...e, ...patch } : e))
}
export function bringToFront(els: FreeEl[], id: string): FreeEl[] {
  const el = els.find((e) => e.id === id); if (!el) return els
  return [...els.filter((e) => e.id !== id), el]
}
