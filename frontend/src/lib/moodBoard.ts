// Modello "mini Canva" per la moodboard: una tela con elementi liberi di 4 tipi
// (immagine, testo, forma, icona/ghirigoro). Tutte funzioni PURE → testabili.
// Coordinate in frazioni di tela 0..1 (top-left + size), come nell'impaginatore.

export type MoodKind = 'image' | 'text' | 'shape' | 'icon'
export type MoodEl = {
  id: string; kind: MoodKind
  x: number; y: number; w: number; h: number; rot: number; z: number
  src?: string                                   // image
  frame?: 'polaroid'                             // cornice immagine (polaroid = bordo bianco + base)
  radius?: number                                // 0..0.5 raggio angoli immagine (0.5 = cerchio)
  blur?: number                                  // sfocatura px
  opacity?: number                               // 0..1
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
// Forme primitive (renderizzate dal componente; le "complesse" sono calcolate lì).
export const SHAPES = ['rect', 'rounded', 'circle', 'oval', 'triangle', 'diamond', 'heart', 'arch', 'line', 'starburst', 'badge', 'banner', 'frame', 'blob'] as const
export type ShapeName = typeof SHAPES[number]

// Ghirigori / decori come path SVG su viewBox 0 0 100 100 (tratto, non riempiti).
export const FLOURISHES: { name: string; path: string }[] = [
  { name: 'ramo', path: 'M10 90 C 30 70, 35 40, 50 20 M50 40 C 60 35, 70 38, 78 30 M40 55 C 30 52, 22 55, 14 48 M55 60 C 66 56, 74 60, 82 52 M35 72 C 26 70, 18 73, 12 66' },
  { name: 'onda', path: 'M5 50 C 20 30, 35 70, 50 50 S 80 30, 95 50' },
  { name: 'cuore-linea', path: 'M50 78 C 20 55, 22 25, 50 38 C 78 25, 80 55, 50 78 Z' },
  { name: 'corona', path: 'M20 70 C 5 50, 18 22, 50 18 C 82 22, 95 50, 80 70 M20 70 L80 70' },
  { name: 'divisore', path: 'M5 50 H38 M62 50 H95 M50 42 L56 50 L50 58 L44 50 Z' },
  { name: 'stella', path: 'M50 12 L58 40 L88 40 L63 58 L72 86 L50 68 L28 86 L37 58 L12 40 L42 40 Z' },
  { name: 'foglie', path: 'M50 90 L50 30 M50 45 C 38 40, 32 30, 33 20 C 45 22, 50 32, 50 45 M50 45 C 62 40, 68 30, 67 20 C 55 22, 50 32, 50 45 M50 62 C 40 58, 35 50, 36 42 M50 62 C 60 58, 65 50, 64 42' },
  { name: 'fiocco', path: 'M50 50 C 35 30, 15 35, 25 50 C 15 65, 35 70, 50 50 C 65 70, 85 65, 75 50 C 85 35, 65 30, 50 50 Z' },
  { name: 'alloro-sx', path: 'M70 90 C 40 75, 25 45, 30 14 M44 60 C 32 60, 24 54, 22 44 M40 72 C 28 73, 20 68, 17 58 M50 47 C 39 46, 32 39, 31 29 M58 35 C 48 33, 42 26, 42 16' },
  { name: 'alloro-dx', path: 'M30 90 C 60 75, 75 45, 70 14 M56 60 C 68 60, 76 54, 78 44 M60 72 C 72 73, 80 68, 83 58 M50 47 C 61 46, 68 39, 69 29 M42 35 C 52 33, 58 26, 58 16' },
  { name: 'angolo', path: 'M8 50 L8 8 L50 8 M8 20 C 22 20, 30 12, 30 8' },
  { name: 'scintille', path: 'M30 30 L30 14 M22 22 L38 22 M70 40 L70 26 M63 33 L77 33 M52 72 L52 60 M46 66 L58 66' },
  { name: 'freccia', path: 'M8 50 H86 M72 38 L88 50 L72 62' },
  { name: 'sottolineato', path: 'M6 56 C 28 44, 72 44, 94 56 M14 62 C 34 54, 66 54, 86 62' },
  { name: 'spirale', path: 'M50 50 C 50 42, 62 42, 62 52 C 62 66, 42 66, 42 50 C 42 30, 70 30, 70 54 C 70 82, 30 82, 30 48' },
  { name: 'archetto', path: 'M12 64 C 12 34, 88 34, 88 64 M6 64 H94' },
]

// Sfondi a gradiente (sfumature curate). board.bg accetta qualsiasi background CSS.
export const GRADIENTS: { label: string; css: string }[] = [
  { label: 'Crema oro', css: 'linear-gradient(135deg, #fbf6ec 0%, #ecd9b0 100%)' },
  { label: 'Cipria', css: 'linear-gradient(135deg, #fdeee9 0%, #e8c4bd 100%)' },
  { label: 'Salvia', css: 'linear-gradient(135deg, #eef2e8 0%, #c3d0b6 100%)' },
  { label: 'Blu polvere', css: 'linear-gradient(135deg, #eef1f5 0%, #b9c6d8 100%)' },
  { label: 'Terracotta', css: 'linear-gradient(135deg, #f7e7d8 0%, #cf9b7a 100%)' },
  { label: 'Notte', css: 'linear-gradient(135deg, #2a3340 0%, #11161d 100%)' },
  { label: 'Bagliore', css: 'radial-gradient(circle at 50% 28%, #fff7e8 0%, #e7cf9f 60%, #cdaf78 100%)' },
  { label: 'Pesca', css: 'linear-gradient(160deg, #ffe9d6 0%, #ffc9c0 55%, #e7a9b6 100%)' },
  { label: 'Avorio', css: 'linear-gradient(135deg, #ffffff 0%, #f1ece1 100%)' },
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
  {
    label: 'Distintivo',
    build: (imgs) => ({ bg: '#20302a', els: [
      { id: uid(), kind: 'shape', name: 'badge', fill: '#cba14a', x: 0.24, y: 0.12, w: 0.52, h: 0.52, rot: 0, z: 1 },
      { id: uid(), kind: 'image', src: imgs[0] ?? '', x: 0.31, y: 0.19, w: 0.38, h: 0.38, rot: 0, z: 2, radius: 0.5 },
      { id: uid(), kind: 'text', text: 'SAVE THE DATE', x: 0.2, y: 0.68, w: 0.6, h: 0.07, rot: 0, z: 3, color: '#f0e4c6', font: 'Inter, sans-serif', align: 'center', weight: 700 },
      { id: uid(), kind: 'shape', name: 'line', fill: '#cba14a', x: 0.4, y: 0.762, w: 0.2, h: 0.004, rot: 0, z: 3 },
      { id: uid(), kind: 'text', text: 'est. 2026', x: 0.3, y: 0.78, w: 0.4, h: 0.05, rot: 0, z: 3, color: '#cba14a', font: 'Georgia, serif', align: 'center', weight: 400, italic: true },
    ] }),
  },
  {
    label: 'Sunburst',
    build: (imgs) => ({ bg: '#f3e6cf', els: [
      { id: uid(), kind: 'shape', name: 'starburst', fill: '#e0b15a', x: 0.12, y: 0.07, w: 0.76, h: 0.76, rot: 0, z: 1 },
      { id: uid(), kind: 'image', src: imgs[0] ?? '', x: 0.27, y: 0.22, w: 0.46, h: 0.46, rot: 0, z: 2, radius: 0.5 },
      { id: uid(), kind: 'text', text: 'THE BEST DAY', x: 0.15, y: 0.79, w: 0.7, h: 0.08, rot: 0, z: 3, color: '#7a4a2b', font: 'Playfair Display, serif', align: 'center', weight: 700 },
    ] }),
  },
  {
    label: 'Art déco',
    build: (imgs) => ({ bg: '#16202b', els: [
      { id: uid(), kind: 'shape', name: 'frame', fill: '#c8a24a', x: 0.06, y: 0.06, w: 0.88, h: 0.88, rot: 0, z: 1 },
      { id: uid(), kind: 'image', src: imgs[0] ?? '', x: 0.14, y: 0.14, w: 0.72, h: 0.46, rot: 0, z: 2 },
      { id: uid(), kind: 'text', text: 'ÉLÉGANCE', x: 0.1, y: 0.64, w: 0.8, h: 0.09, rot: 0, z: 3, color: '#e7cf94', font: 'Georgia, serif', align: 'center', weight: 700 },
      { id: uid(), kind: 'shape', name: 'line', fill: '#c8a24a', x: 0.3, y: 0.745, w: 0.4, h: 0.005, rot: 0, z: 3 },
      { id: uid(), kind: 'text', text: 'a timeless celebration', x: 0.2, y: 0.77, w: 0.6, h: 0.05, rot: 0, z: 3, color: '#b9a06a', font: 'Inter, sans-serif', align: 'center', weight: 400 },
    ] }),
  },
  {
    label: 'Nastro',
    build: (imgs) => ({ bg: '#fbf3e8', els: [
      { id: uid(), kind: 'image', src: imgs[0] ?? '', x: 0.08, y: 0.1, w: 0.84, h: 0.5, rot: 0, z: 1, radius: 0.04 },
      { id: uid(), kind: 'shape', name: 'banner', fill: '#c2506a', x: 0.1, y: 0.5, w: 0.8, h: 0.16, rot: 0, z: 2 },
      { id: uid(), kind: 'text', text: 'celebrate', x: 0.18, y: 0.525, w: 0.64, h: 0.1, rot: 0, z: 3, color: '#ffffff', font: '"Brush Script MT", cursive', align: 'center', weight: 400 },
      { id: uid(), kind: 'image', src: imgs[1] ?? '', x: 0.1, y: 0.72, w: 0.38, h: 0.22, rot: -2, z: 1, frame: 'polaroid' },
      { id: uid(), kind: 'image', src: imgs[2] ?? '', x: 0.52, y: 0.72, w: 0.38, h: 0.22, rot: 2, z: 1, frame: 'polaroid' },
    ] }),
  },
  {
    label: 'Arco',
    build: (imgs) => ({ bg: '#efe7da', els: [
      { id: uid(), kind: 'shape', name: 'arch', fill: '#d8c3a0', x: 0.22, y: 0.08, w: 0.56, h: 0.66, rot: 0, z: 1 },
      { id: uid(), kind: 'image', src: imgs[0] ?? '', x: 0.255, y: 0.1, w: 0.49, h: 0.6, rot: 0, z: 2 },
      { id: uid(), kind: 'icon', name: 'Leaf', fill: '#9bae8a', x: 0.1, y: 0.5, w: 0.12, h: 0.12, rot: -20, z: 3 },
      { id: uid(), kind: 'icon', name: 'Leaf', fill: '#9bae8a', x: 0.78, y: 0.3, w: 0.12, h: 0.12, rot: 20, z: 3 },
      { id: uid(), kind: 'text', text: 'Sofia & Marco', x: 0.15, y: 0.78, w: 0.7, h: 0.08, rot: 0, z: 4, color: '#6b5b3e', font: 'Playfair Display, serif', align: 'center', weight: 600 },
    ] }),
  },
]

// ── STILI DI IMPAGINAZIONE (dinamici: usano TUTTE le foto) ───────────────────
// Veri stili "di moda": ritagli/collage, polaroid, editoriale e rivista. Dispongono
// tutte le immagini con il "justified" (righe a larghezza piena), poi l'utente rifinisce.
type Rect = { x: number; y: number; w: number; h: number }
const rowsFor = (n: number, vr: number) => Math.max(1, Math.min(n, Math.round(Math.sqrt(n / Math.max(0.4, vr)))))
const distribute = (n: number, R: number) => { const base = Math.floor(n / R), ex = n % R; return Array.from({ length: R }, (_, r) => base + (r < ex ? 1 : 0)) }
function justified(n: number, rect: Rect, aspect: number, g: number): Rect[] {
  const out: Rect[] = []; if (n <= 0) return out
  const vr = aspect * (rect.w / Math.max(0.001, rect.h))
  const R = rowsFor(n, vr); const counts = distribute(n, R)
  const rowH = (rect.h - g * (R + 1)) / R
  for (let r = 0; r < R; r++) {
    const c = Math.max(1, counts[r] ?? 1); const cellW = (rect.w - g * (c + 1)) / c
    const y = rect.y + g + r * (rowH + g)
    for (let i = 0; i < c; i++) out.push({ x: rect.x + g + i * (cellW + g), y, w: cellW, h: rowH })
  }
  return out
}
const FB: Rect = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }
const imgEl = (src: string, s: Rect, z: number, rot = 0, frame?: 'polaroid'): MoodEl => ({ id: uid(), kind: 'image', src, x: s.x, y: s.y, w: s.w, h: s.h, rot, z, frame })
const jitter = (i: number, amp = 4) => ((i * 41) % (amp * 2 + 1)) - amp // -amp..+amp deterministico

function styleCollage(imgs: string[]): MoodBoard {
  const s = justified(imgs.length, { x: 0.02, y: 0.02, w: 0.96, h: 0.96 }, 1, 0.012)
  return { bg: '#f3ede3', els: imgs.map((src, i) => imgEl(src, s[i] ?? FB, i + 1, jitter(i, 4))) }
}
function stylePolaroid(imgs: string[]): MoodBoard {
  const s = justified(imgs.length, { x: 0.03, y: 0.03, w: 0.94, h: 0.94 }, 1, 0.045)
  return { bg: '#ece7df', els: imgs.map((src, i) => imgEl(src, s[i] ?? FB, i + 1, jitter(i, 5), 'polaroid')) }
}
function styleGriglia(imgs: string[]): MoodBoard {
  const s = justified(imgs.length, { x: 0, y: 0, w: 1, h: 1 }, 1, 0.012)
  return { bg: '#ffffff', els: imgs.map((src, i) => imgEl(src, s[i] ?? FB, i + 1)) }
}
function styleEditoriale(imgs: string[]): MoodBoard {
  if (imgs.length <= 1) return styleGriglia(imgs)
  const g = 0.014, heroW = imgs.length >= 4 ? 0.56 : 0.62
  const hero: Rect = { x: g, y: 0.12, w: heroW, h: 0.86 }
  const right: Rect = { x: g + heroW + g, y: 0.12, w: 1 - (g + heroW + g) - g, h: 0.86 }
  const rest = justified(imgs.length - 1, right, 1, g)
  return { bg: '#ffffff', els: [
    { id: uid(), kind: 'text', text: 'MOOD', x: g, y: 0.015, w: 0.6, h: 0.085, rot: 0, z: 100, color: '#1f1b16', font: 'Playfair Display, serif', align: 'left', weight: 700 },
    imgEl(imgs[0]!, hero, 1),
    ...imgs.slice(1).map((src, i) => imgEl(src, rest[i] ?? FB, i + 2)),
  ] }
}
function styleRivista(imgs: string[]): MoodBoard {
  const g = 0.014
  const grid = justified(imgs.length, { x: g, y: 0.16, w: 1 - 2 * g, h: 0.82 }, 1, g)
  return { bg: '#f5f2ec', els: [
    { id: uid(), kind: 'text', text: 'EDITORIAL', x: g, y: 0.03, w: 0.7, h: 0.08, rot: 0, z: 100, color: '#1f1b16', font: 'Georgia, serif', align: 'left', weight: 700 },
    { id: uid(), kind: 'shape', name: 'line', fill: '#1f1b16', x: g, y: 0.125, w: 1 - 2 * g, h: 0.004, rot: 0, z: 99 },
    ...imgs.map((src, i) => imgEl(src, grid[i] ?? FB, i + 1)),
  ] }
}

function styleTableau(imgs: string[]): MoodBoard {
  const g = 0.018, top = 0.17
  const grid = justified(imgs.length, { x: 0.07, y: top, w: 0.86, h: 0.97 - top }, 0.82, g)
  return { bg: '#f7f1e6', els: [
    { id: uid(), kind: 'text', text: 'Tableau de mariage', x: 0.1, y: 0.05, w: 0.8, h: 0.06, rot: 0, z: 200, color: '#6b5b3e', font: 'Playfair Display, serif', align: 'center', weight: 600 },
    { id: uid(), kind: 'text', text: 'i nostri tavoli', x: 0.3, y: 0.115, w: 0.4, h: 0.035, rot: 0, z: 200, color: '#9a875f', font: 'Georgia, serif', align: 'center', weight: 400, italic: true },
    { id: uid(), kind: 'icon', name: 'Leaf', fill: '#a8b5a2', x: 0.05, y: 0.045, w: 0.07, h: 0.07, rot: -20, z: 200 },
    { id: uid(), kind: 'icon', name: 'Leaf', fill: '#a8b5a2', x: 0.88, y: 0.045, w: 0.07, h: 0.07, rot: 20, z: 200 },
    ...imgs.map((src, i) => imgEl(src, grid[i] ?? FB, i + 1, jitter(i, 2))),
  ] }
}

export const LAYOUT_STYLES: { key: string; label: string; build: (imgs: string[]) => MoodBoard }[] = [
  { key: 'collage', label: 'Ritagli', build: styleCollage },
  { key: 'polaroid', label: 'Polaroid', build: stylePolaroid },
  { key: 'editoriale', label: 'Moda · editoriale', build: styleEditoriale },
  { key: 'rivista', label: 'Moda · rivista', build: styleRivista },
  { key: 'tableau', label: 'Tableau mariage', build: styleTableau },
  { key: 'griglia', label: 'Griglia', build: styleGriglia },
]
