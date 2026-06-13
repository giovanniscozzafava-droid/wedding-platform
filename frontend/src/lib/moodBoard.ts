// Modello "mini Canva" per la moodboard: una tela con elementi liberi di 4 tipi
// (immagine, testo, forma, icona/ghirigoro). Tutte funzioni PURE → testabili.
// Coordinate in frazioni di tela 0..1 (top-left + size), come nell'impaginatore.

export type MoodKind = 'image' | 'text' | 'shape' | 'icon'
export type MoodEl = {
  id: string; kind: MoodKind
  x: number; y: number; w: number; h: number; rot: number; z: number
  src?: string                                   // image
  text?: string; color?: string; font?: string   // text
  align?: 'left' | 'center' | 'right'; weight?: number; italic?: boolean
  name?: string; fill?: string                    // shape / icon / flourish (name = chiave registro)
}
export type MoodBoard = { bg: string; els: MoodEl[] }

export const MIN_EL = 0.05
export const SNAP_THR = 0.014
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
function uid(): string { try { return crypto.randomUUID() } catch { return `m-${Date.now()}-${Math.floor(Math.random() * 1e9)}` } }

export function emptyBoard(): MoodBoard { return { bg: '#faf6ef', els: [] } }
const topZ = (els: MoodEl[]) => (els.length ? Math.max(...els.map((e) => e.z)) + 1 : 1)

// ── fabbriche elementi ──────────────────────────────────────────────────────
export function addImage(b: MoodBoard, src: string): MoodBoard {
  const el: MoodEl = { id: uid(), kind: 'image', src, x: 0.28, y: 0.28, w: 0.32, h: 0.32, rot: 0, z: topZ(b.els) }
  return { ...b, els: [...b.els, el] }
}
export function addText(b: MoodBoard, text = 'Il vostro mood'): MoodBoard {
  const el: MoodEl = { id: uid(), kind: 'text', text, x: 0.22, y: 0.4, w: 0.56, h: 0.12, rot: 0, z: topZ(b.els), color: '#6b5b3e', font: 'Playfair Display, serif', align: 'center', weight: 600 }
  return { ...b, els: [...b.els, el] }
}
export function addShape(b: MoodBoard, name: string, fill = '#d8c6a0'): MoodBoard {
  const el: MoodEl = { id: uid(), kind: 'shape', name, fill, x: 0.4, y: 0.4, w: 0.2, h: 0.2, rot: 0, z: topZ(b.els) }
  return { ...b, els: [...b.els, el] }
}
export function addIcon(b: MoodBoard, name: string, fill = '#b8923f'): MoodBoard {
  const el: MoodEl = { id: uid(), kind: 'icon', name, fill, x: 0.44, y: 0.44, w: 0.12, h: 0.12, rot: 0, z: topZ(b.els) }
  return { ...b, els: [...b.els, el] }
}

// ── operazioni ──────────────────────────────────────────────────────────────
export function moveEl(el: MoodEl, x: number, y: number): MoodEl {
  return { ...el, x: clamp(x, -el.w + 0.04, 1 - 0.04), y: clamp(y, -el.h + 0.04, 1 - 0.04) }
}
export type Corner = 'nw' | 'ne' | 'sw' | 'se'
export function resizeEl(el: MoodEl, corner: Corner, nx: number, ny: number): MoodEl {
  const right = el.x + el.w, bottom = el.y + el.h
  let x = el.x, y = el.y, w = el.w, h = el.h
  if (corner === 'se') { w = nx - el.x; h = ny - el.y }
  else if (corner === 'ne') { w = nx - el.x; y = Math.min(ny, bottom - MIN_EL); h = bottom - y }
  else if (corner === 'sw') { x = Math.min(nx, right - MIN_EL); w = right - x; h = ny - el.y }
  else { x = Math.min(nx, right - MIN_EL); w = right - x; y = Math.min(ny, bottom - MIN_EL); h = bottom - y }
  return { ...el, x, y, w: Math.max(MIN_EL, w), h: Math.max(MIN_EL, h) }
}
export function snapAngle(deg: number): number {
  const d = ((deg % 360) + 360) % 360
  for (const a of [0, 45, 90, 135, 180, 225, 270, 315, 360]) if (Math.abs(d - a) <= 4) return a % 360
  const near = Math.round(d / 15) * 15
  return Math.abs(d - near) <= 2 ? near % 360 : d
}
export type Snap = { x: number; y: number; vGuides: number[]; hGuides: number[] }
export function snapMove(el: MoodEl, others: MoodEl[], thr = SNAP_THR): Snap {
  const xs = [0, 0.5, 1], ys = [0, 0.5, 1]
  for (const o of others) { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h) }
  const vG: number[] = [], hG: number[] = []
  let dx = 0, bx = thr
  for (const c of [el.x, el.x + el.w / 2, el.x + el.w]) for (const t of xs) { const d = t - c; if (Math.abs(d) < bx) { bx = Math.abs(d); dx = d } }
  if (bx < thr) for (const c of [el.x + dx, el.x + el.w / 2 + dx, el.x + el.w + dx]) for (const t of xs) if (Math.abs(t - c) < 1e-4) vG.push(t)
  let dy = 0, by = thr
  for (const c of [el.y, el.y + el.h / 2, el.y + el.h]) for (const t of ys) { const d = t - c; if (Math.abs(d) < by) { by = Math.abs(d); dy = d } }
  if (by < thr) for (const c of [el.y + dy, el.y + el.h / 2 + dy, el.y + el.h + dy]) for (const t of ys) if (Math.abs(t - c) < 1e-4) hG.push(t)
  return { x: el.x + (bx < thr ? dx : 0), y: el.y + (by < thr ? dy : 0), vGuides: [...new Set(vG)], hGuides: [...new Set(hG)] }
}
export function updateEl(els: MoodEl[], id: string, patch: Partial<MoodEl>): MoodEl[] { return els.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
export function removeEl(els: MoodEl[], id: string): MoodEl[] { return els.filter((e) => e.id !== id) }
export function bringFront(els: MoodEl[], id: string): MoodEl[] { const m = topZ(els); return els.map((e) => (e.id === id ? { ...e, z: m } : e)) }
export function sendBack(els: MoodEl[], id: string): MoodEl[] { const lo = Math.min(...els.map((e) => e.z)) - 1; return els.map((e) => (e.id === id ? { ...e, z: lo } : e)) }
export function duplicateEl(els: MoodEl[], id: string): { els: MoodEl[]; newId: string | null } {
  const src = els.find((e) => e.id === id); if (!src) return { els, newId: null }
  const copy: MoodEl = { ...src, id: uid(), x: Math.min(0.9, src.x + 0.03), y: Math.min(0.9, src.y + 0.03), z: topZ(els) }
  return { els: [...els, copy], newId: copy.id }
}

// ── cataloghi (forme + ghirigori SVG) ───────────────────────────────────────
// Forme primitive (renderizzate dal componente).
export const SHAPES = ['rect', 'rounded', 'circle', 'heart', 'line', 'arch'] as const
export type ShapeName = typeof SHAPES[number]

// Ghirigori / decori botanici come path SVG su viewBox 0 0 100 100.
export const FLOURISHES: { name: string; path: string }[] = [
  { name: 'ramo', path: 'M10 90 C 30 70, 35 40, 50 20 M50 40 C 60 35, 70 38, 78 30 M40 55 C 30 52, 22 55, 14 48 M55 60 C 66 56, 74 60, 82 52 M35 72 C 26 70, 18 73, 12 66' },
  { name: 'onda', path: 'M5 50 C 20 30, 35 70, 50 50 S 80 30, 95 50' },
  { name: 'cuore-linea', path: 'M50 78 C 20 55, 22 25, 50 38 C 78 25, 80 55, 50 78 Z' },
  { name: 'corona', path: 'M20 70 C 5 50, 18 22, 50 18 C 82 22, 95 50, 80 70 M20 70 L80 70' },
  { name: 'divisore', path: 'M5 50 H38 M62 50 H95 M50 42 L56 50 L50 58 L44 50 Z' },
  { name: 'stella', path: 'M50 12 L58 40 L88 40 L63 58 L72 86 L50 68 L28 86 L37 58 L12 40 L42 40 Z' },
  { name: 'foglie', path: 'M50 90 L50 30 M50 45 C 38 40, 32 30, 33 20 C 45 22, 50 32, 50 45 M50 45 C 62 40, 68 30, 67 20 C 55 22, 50 32, 50 45 M50 62 C 40 58, 35 50, 36 42 M50 62 C 60 58, 65 50, 64 42' },
  { name: 'fiocco', path: 'M50 50 C 35 30, 15 35, 25 50 C 15 65, 35 70, 50 50 C 65 70, 85 65, 75 50 C 85 35, 65 30, 50 50 Z' },
]

// Palette curate per testi/forme/sfondo.
export const MOOD_PALETTE = ['#6b5b3e', '#b8923f', '#d8c6a0', '#a8b5a2', '#c98b7a', '#8a9bb0', '#3f3a34', '#ffffff', '#faf6ef', '#e7ddc9']
export const MOOD_FONTS: { label: string; css: string }[] = [
  { label: 'Elegante', css: 'Playfair Display, serif' },
  { label: 'Pulito', css: 'Inter, system-ui, sans-serif' },
  { label: 'Corsivo', css: '"Brush Script MT", cursive' },
  { label: 'Classico', css: 'Georgia, serif' },
]

// ── preset "carini" pronti all'uso ──────────────────────────────────────────
export const PRESETS: { label: string; build: (imgs: string[]) => MoodBoard }[] = [
  {
    label: 'Romantico',
    build: (imgs) => ({
      bg: '#faf3ee', els: [
        { id: uid(), kind: 'image', src: imgs[0] ?? '', x: 0.06, y: 0.08, w: 0.42, h: 0.5, rot: -3, z: 1 },
        { id: uid(), kind: 'image', src: imgs[1] ?? '', x: 0.54, y: 0.12, w: 0.4, h: 0.34, rot: 2, z: 2 },
        { id: uid(), kind: 'image', src: imgs[2] ?? '', x: 0.55, y: 0.5, w: 0.38, h: 0.4, rot: -2, z: 3 },
        { id: uid(), kind: 'text', text: 'noi due', x: 0.08, y: 0.64, w: 0.4, h: 0.16, rot: 0, z: 4, color: '#9a7b56', font: '"Brush Script MT", cursive', align: 'center', weight: 400 },
        { id: uid(), kind: 'icon', name: 'Heart', fill: '#c98b7a', x: 0.27, y: 0.82, w: 0.08, h: 0.08, rot: 0, z: 5 },
      ],
    }),
  },
  {
    label: 'Minimal',
    build: (imgs) => ({
      bg: '#f4f2ee', els: [
        { id: uid(), kind: 'image', src: imgs[0] ?? '', x: 0.08, y: 0.1, w: 0.4, h: 0.8, rot: 0, z: 1 },
        { id: uid(), kind: 'image', src: imgs[1] ?? '', x: 0.54, y: 0.1, w: 0.38, h: 0.38, rot: 0, z: 2 },
        { id: uid(), kind: 'text', text: 'MOOD', x: 0.54, y: 0.56, w: 0.38, h: 0.1, rot: 0, z: 3, color: '#3f3a34', font: 'Inter, sans-serif', align: 'left', weight: 700 },
        { id: uid(), kind: 'shape', name: 'line', fill: '#b8923f', x: 0.54, y: 0.7, w: 0.38, h: 0.02, rot: 0, z: 4 },
      ],
    }),
  },
  {
    label: 'Botanico',
    build: (imgs) => ({
      bg: '#f1f3ed', els: [
        { id: uid(), kind: 'image', src: imgs[0] ?? '', x: 0.3, y: 0.18, w: 0.4, h: 0.46, rot: 0, z: 2 },
        { id: uid(), kind: 'shape', name: 'arch', fill: '#dfe6d6', x: 0.28, y: 0.14, w: 0.44, h: 0.56, rot: 0, z: 1 },
        { id: uid(), kind: 'icon', name: 'Leaf', fill: '#7f9a6e', x: 0.16, y: 0.5, w: 0.12, h: 0.12, rot: -20, z: 3 },
        { id: uid(), kind: 'icon', name: 'Flower2', fill: '#a8b5a2', x: 0.72, y: 0.34, w: 0.12, h: 0.12, rot: 15, z: 3 },
        { id: uid(), kind: 'text', text: 'green & natural', x: 0.25, y: 0.74, w: 0.5, h: 0.1, rot: 0, z: 4, color: '#5e6b52', font: 'Georgia, serif', align: 'center', weight: 500, italic: true },
      ],
    }),
  },
]
