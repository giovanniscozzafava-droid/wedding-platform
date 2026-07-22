// Formati social + PREMODELLI del carosello. Un premodello dispone gli slot-foto sulla STRIP
// continua (coordinate 0..1 dell'intera strip larga N slide): la coppia/pro sostituisce solo la
// foto in ogni slot, oppure passa a "mano libera" e li muove con gli stessi strumenti dell'album.
import { DEFAULT_CELL } from './albumGeometry'
import type { FreeEl } from './albumFree'

export type CarouselFormat = { key: string; label: string; w: number; h: number }
// w×h in PIXEL della singola slide (l'export affetta la strip in blocchi di w).
export const CAROUSEL_FORMATS: CarouselFormat[] = [
  { key: 'IG_PORTRAIT', label: 'Instagram verticale · 1080×1350', w: 1080, h: 1350 },
  { key: 'IG_SQUARE',   label: 'Instagram quadrato · 1080×1080',  w: 1080, h: 1080 },
  { key: 'IG_STORY',    label: 'Storia / Reel · 1080×1920',        w: 1080, h: 1920 },
]
export const DEFAULT_CAROUSEL_FORMAT = 'IG_PORTRAIT'
export function getCarouselFormat(key: string): CarouselFormat {
  return CAROUSEL_FORMATS.find((f) => f.key === key) ?? CAROUSEL_FORMATS[0]!
}

function uid(): string {
  try { return crypto.randomUUID() } catch { return `c-${Date.now()}-${Math.floor(Math.random() * 1e9)}` }
}
const cell = () => ({ ...DEFAULT_CELL })
const el = (mediaId: string, x: number, y: number, w: number, h: number): FreeEl => ({ id: uid(), mediaId, x, y, w, h, rot: 0, cell: cell() })

export type CarouselModel = {
  key: string
  label: string
  hint: string
  group?: 'base' | 'editoriale'
  // Numero di foto usate dal premodello per N slide (per capire quante servono).
  photosFor: (n: number) => number
  // Costruisce gli slot sulla strip (0..1 su tutta la larghezza). `ids` = foto disponibili in
  // ordine; gli slot in eccesso restano vuoti (mediaId '').
  build: (n: number, ids: string[]) => FreeEl[]
}

type Style = { rot?: number; border?: FreeEl['border']; shadow?: boolean }
// Rettangolo in coordinate LOCALI della singola slide (0..1): x/w = frazione larghezza slide,
// y/h = frazione altezza. Lo trasformo in coord. strip: x_strip = (k + x)/n, w_strip = w/n.
type Rect = { x: number; y: number; w: number; h: number } & Style
const white = { w: 12, color: '#ffffff' }
const dark = { w: 3, color: '#111111' }
const gx = 0.02, gy = 0.02   // gutter locale

const styled = (base: FreeEl, s: Style): FreeEl => ({ ...base, rot: s.rot ?? 0, border: s.border, shadow: s.shadow })
// Dispone gli stessi `rects` su OGNI slide (layout ripetuto). Consuma rects.length foto per slide.
function tile(n: number, ids: string[], rects: Rect[]): FreeEl[] {
  const out: FreeEl[] = []
  let p = 0
  for (let k = 0; k < n; k++) for (const r of rects) out.push(styled(el(ids[p++] ?? '', (k + r.x) / n, r.y, r.w / n, r.h), r))
  return out
}
const model = (key: string, label: string, hint: string, rects: Rect[], group: 'base' | 'editoriale' = 'base'): CarouselModel => ({
  key, label, hint, group, photosFor: (n) => n * rects.length, build: (n, ids) => tile(n, ids, rects),
})

const hh = (1 - gy) / 2, ww = (1 - gx) / 2, w3 = (1 - 2 * gx) / 3, h3 = (1 - 2 * gy) / 3
const hair = 0.004 // gutter finissimo (dittici editoriali)

// PREFORMAT EDITORIALI (stile rivista): molto bianco, asimmetria, foto ancorate. Ogni slide
// ripete lo stesso schema → basta inserire le foto. [key, label, hint, rects locali slide 0..1].
const ED: [string, string, string, Rect[]][] = [
  ['ed-full', 'pieno', 'Foto a tutta slide, drammatica.', [{ x: 0, y: 0, w: 1, h: 1 }]],
  ['ed-masthead', 'testata', 'Foto in basso, alto libero per il titolo.', [{ x: 0, y: 0.34, w: 1, h: 0.66 }]],
  ['ed-colL', 'colonna sx', 'Colonna verticale a sinistra, aria a destra.', [{ x: 0.06, y: 0.08, w: 0.5, h: 0.84 }]],
  ['ed-colR', 'colonna dx', 'Colonna verticale a destra, aria a sinistra.', [{ x: 0.44, y: 0.08, w: 0.5, h: 0.84 }]],
  ['ed-center', 'quadro centrale', 'Riquadro centrato con molto respiro.', [{ x: 0.2, y: 0.24, w: 0.6, h: 0.44 }]],
  ['ed-bottom', 'ancorata basso', 'Foto ancorata al bordo inferiore.', [{ x: 0, y: 0.5, w: 1, h: 0.5 }]],
  ['ed-top', 'ancorata alto', 'Foto ancorata al bordo superiore.', [{ x: 0, y: 0, w: 1, h: 0.5 }]],
  ['ed-portrait', 'ritratto', 'Ritratto verticale con ampi margini laterali.', [{ x: 0.22, y: 0.06, w: 0.56, h: 0.88 }]],
  ['ed-corner', 'angolo', 'Piccola foto in alto a sinistra, resto vuoto.', [{ x: 0.06, y: 0.07, w: 0.42, h: 0.42 }]],
  ['ed-diptych', 'dittico', 'Due foto con filo sottilissimo di stacco.', [{ x: 0, y: 0, w: 0.5 - hair, h: 1 }, { x: 0.5 + hair, y: 0, w: 0.5 - hair, h: 1 }]],
  ['ed-triptych', 'trittico', 'Una grande + due strette a destra.', [{ x: 0, y: 0, w: 0.56, h: 1 }, { x: 0.58, y: 0, w: 0.42, h: 0.5 - hair }, { x: 0.58, y: 0.5 + hair, w: 0.42, h: 0.5 - hair }]],
  ['ed-contact', 'provinato', 'Sei mini-foto a contatto: griglia 3×2.', [
    { x: 0.05, y: 0.1, w: 0.28, h: 0.36 }, { x: 0.36, y: 0.1, w: 0.28, h: 0.36 }, { x: 0.67, y: 0.1, w: 0.28, h: 0.36 },
    { x: 0.05, y: 0.54, w: 0.28, h: 0.36 }, { x: 0.36, y: 0.54, w: 0.28, h: 0.36 }, { x: 0.67, y: 0.54, w: 0.28, h: 0.36 },
  ]],
  ['ed-band', 'banda', 'Fascia orizzontale centrata, tanto bianco.', [{ x: 0, y: 0.34, w: 1, h: 0.32 }]],
  ['ed-mini', 'minimal', 'Immagine piccola centrata: massimo respiro.', [{ x: 0.28, y: 0.3, w: 0.44, h: 0.34 }]],
  ['ed-hairline', 'filo', 'Foto piena con cornice a filo scuro.', [{ x: 0.04, y: 0.03, w: 0.92, h: 0.94, border: { w: 2, color: '#111111' } }]],
  ['ed-offset', 'sfalsata', 'Due foto orizzontali sfalsate in diagonale.', [{ x: 0, y: 0.06, w: 0.7, h: 0.42 }, { x: 0.3, y: 0.52, w: 0.7, h: 0.42 }]],
  ['ed-sign', 'firma', 'Ritratto a sinistra, colonna destra per il testo.', [{ x: 0.05, y: 0.06, w: 0.55, h: 0.88 }]],
  ['ed-row3', 'terzine', 'Tre foto in fila in alto, basso libero.', [{ x: 0.03, y: 0.1, w: 0.3, h: 0.34 }, { x: 0.35, y: 0.1, w: 0.3, h: 0.34 }, { x: 0.67, y: 0.1, w: 0.3, h: 0.34 }]],
  ['ed-air', 'respiro alto', 'Foto in basso con aria in alto.', [{ x: 0, y: 0.2, w: 1, h: 0.8 }]],
  ['ed-two', 'doppio ritratto', 'Due ritratti affiancati con margini.', [{ x: 0.06, y: 0.14, w: 0.42, h: 0.72 }, { x: 0.52, y: 0.14, w: 0.42, h: 0.72 }]],
  ['ed-Lbig', 'L', 'Grande in alto + piccola in basso a sinistra.', [{ x: 0, y: 0, w: 1, h: 0.62 }, { x: 0.06, y: 0.68, w: 0.44, h: 0.26 }]],
  ['ed-bleedL', 'sanguina sx', 'Foto che sborda a sinistra, colonna vuota a destra.', [{ x: 0, y: 0, w: 0.68, h: 1 }]],
  ['ed-bleedR', 'sanguina dx', 'Foto che sborda a destra, colonna vuota a sinistra.', [{ x: 0.32, y: 0, w: 0.68, h: 1 }]],
  ['ed-frameXL', 'cornice ampia', 'Foto con cornice bianca molto larga.', [{ x: 0.12, y: 0.1, w: 0.76, h: 0.8 }]],
]
const EDITORIAL_MODELS: CarouselModel[] = ED.map(([k, l, h, r]) => model(k, l, h, r, 'editoriale'))

export const CAROUSEL_MODELS: CarouselModel[] = [
  // — layout ripetuto per slide (basta inserire le foto) —
  model('one', 'Piena · una per slide', 'Una foto a tutta slide: racconto pulito e forte.', [{ x: 0, y: 0, w: 1, h: 1 }]),
  model('framed', 'Cornice editoriale', 'Foto con margine su sfondo: stile rivista.', [{ x: 0.07, y: 0.055, w: 0.86, h: 0.89 }]),
  model('stack2', 'Due impilate · 2 foto', 'Due foto una sopra l’altra per slide.', [{ x: 0, y: 0, w: 1, h: hh }, { x: 0, y: hh + gy, w: 1, h: hh }]),
  model('cols2', 'Due affiancate · 2 foto', 'Due foto verticali fianco a fianco.', [{ x: 0, y: 0, w: ww, h: 1 }, { x: ww + gx, y: 0, w: ww, h: 1 }]),
  model('grid4', 'Griglia 2×2 · 4 foto', 'Quattro foto a griglia per slide: tanti momenti.', [
    { x: 0, y: 0, w: ww, h: hh }, { x: ww + gx, y: 0, w: ww, h: hh },
    { x: 0, y: hh + gy, w: ww, h: hh }, { x: ww + gx, y: hh + gy, w: ww, h: hh },
  ]),
  model('grid6', 'Griglia 2×3 · 6 foto', 'Sei foto a griglia per slide: massimo racconto.', [
    { x: 0, y: 0, w: ww, h: h3 }, { x: ww + gx, y: 0, w: ww, h: h3 },
    { x: 0, y: h3 + gy, w: ww, h: h3 }, { x: ww + gx, y: h3 + gy, w: ww, h: h3 },
    { x: 0, y: 2 * (h3 + gy), w: ww, h: h3 }, { x: ww + gx, y: 2 * (h3 + gy), w: ww, h: h3 },
  ]),
  model('bands3', 'Tre bande verticali', 'Tre foto verticali affiancate.', [
    { x: 0, y: 0, w: w3, h: 1 }, { x: w3 + gx, y: 0, w: w3, h: 1 }, { x: 2 * (w3 + gx), y: 0, w: w3, h: 1 },
  ]),
  model('heroBottom', 'Hero + striscia', 'Una grande in alto, una bassa sotto.', [{ x: 0, y: 0, w: 1, h: 0.66 }, { x: 0, y: 0.66 + gy, w: 1, h: 0.34 - gy }]),
  model('heroTop', 'Striscia + hero', 'Una bassa in alto, una grande sotto.', [{ x: 0, y: 0, w: 1, h: 0.34 - gy }, { x: 0, y: 0.34, w: 1, h: 0.66 }]),
  model('polaroid', 'Polaroid', 'Foto con bordo bianco e ombra, leggermente storta.', [{ x: 0.11, y: 0.09, w: 0.78, h: 0.64, border: white, shadow: true, rot: -2.5 }]),
  model('passepartout', 'Passepartout', 'Foto piccola centrata su sfondo: molto respiro.', [{ x: 0.16, y: 0.18, w: 0.68, h: 0.54 }]),
  model('Lcollage', 'Collage a L', 'Una grande a sinistra + due piccole a destra.', [
    { x: 0, y: 0, w: 0.6 - gx, h: 1 }, { x: 0.6, y: 0, w: 0.4, h: hh }, { x: 0.6, y: hh + gy, w: 0.4, h: hh },
  ]),
  model('bigSmall', 'Grande + piccola', 'Una grande + una piccola centrata di fianco.', [{ x: 0, y: 0, w: 0.64 - gx, h: 1 }, { x: 0.64, y: 0.22, w: 0.36, h: 0.56 }]),
  model('captionTop', 'Foto + didascalia', 'Foto in alto, spazio sotto per il testo (a mano).', [{ x: 0.06, y: 0.06, w: 0.88, h: 0.6 }]),
  model('duoOffset', 'Duo sfalsato', 'Due foto sovrapposte in diagonale, con ombra.', [{ x: 0.06, y: 0.05, w: 0.58, h: 0.5, shadow: true }, { x: 0.36, y: 0.45, w: 0.58, h: 0.5, shadow: true }]),
  model('scrapbook4', 'Scrapbook', 'Quattro foto sparse e storte, stile album ritagli.', [
    { x: 0.05, y: 0.05, w: 0.44, h: 0.44, rot: -4, border: white, shadow: true },
    { x: 0.5, y: 0.08, w: 0.44, h: 0.44, rot: 3, border: white, shadow: true },
    { x: 0.06, y: 0.5, w: 0.44, h: 0.44, rot: 2.5, border: white, shadow: true },
    { x: 0.5, y: 0.52, w: 0.44, h: 0.44, rot: -3, border: white, shadow: true },
  ]),
  model('filmstrip', 'Provini', 'Tre mini-foto in fila per slide, su sfondo: come un provino.', [
    { x: 0.02, y: 0.37, w: 0.3, h: 0.26 }, { x: 0.35, y: 0.37, w: 0.3, h: 0.26 }, { x: 0.68, y: 0.37, w: 0.3, h: 0.26 },
  ]),
  model('magazine', 'Rivista', 'Hero grande in alto + due foto in basso.', [
    { x: 0, y: 0, w: 1, h: 0.7 }, { x: 0.05, y: 0.74, w: 0.42, h: 0.2 }, { x: 0.53, y: 0.74, w: 0.42, h: 0.2 },
  ]),
  model('thickBorder', 'Bordo grosso', 'Foto piena con cornice scura marcata.', [{ x: 0.05, y: 0.04, w: 0.9, h: 0.92, border: { w: 6, color: '#111111' } }]),

  // — strip-wide (attraversano le slide): l’effetto seamless più forte —
  {
    key: 'pano', label: 'Panoramica unica', hint: 'Una sola foto larghissima su tutte le slide: lo swipe la scorre. Effetto wow.',
    photosFor: () => 1, build: (_n, ids) => [el(ids[0] ?? '', 0, 0, 1, 1)],
  },
  {
    key: 'panoTop', label: 'Panoramica + ritratti', hint: 'Una panoramica in alto su tutte le slide, sotto una foto per slide.',
    photosFor: (n) => 1 + n,
    build: (n, ids) => {
      const out: FreeEl[] = [el(ids[0] ?? '', 0, 0, 1, 0.6)]
      for (let k = 0; k < n; k++) out.push(el(ids[1 + k] ?? '', k / n, 0.6 + gy, 1 / n, 0.4 - gy))
      return out
    },
  },
  {
    key: 'mosaic', label: 'Mosaico ritmato', hint: 'Alterna una foto piena e due impilate slide dopo slide.',
    photosFor: (n) => n + Math.floor(n / 2),
    build: (n, ids) => {
      const out: FreeEl[] = []; let p = 0
      for (let k = 0; k < n; k++) {
        if (k % 2 === 0) out.push(el(ids[p++] ?? '', k / n, 0, 1 / n, 1))
        else { out.push(el(ids[p++] ?? '', k / n, 0, 1 / n, hh)); out.push(el(ids[p++] ?? '', k / n, hh + gy, 1 / n, hh)) }
      }
      return out
    },
  },
  {
    key: 'cover', label: 'Copertina + foto', hint: 'Prima slide libera per il titolo, poi una foto per slide.', group: 'base',
    photosFor: (n) => Math.max(0, n - 1),
    build: (n, ids) => Array.from({ length: Math.max(0, n - 1) }, (_, i) => el(ids[i] ?? '', (i + 1) / n, 0, 1 / n, 1)),
  },
  ...EDITORIAL_MODELS,
]

export function getModel(key: string): CarouselModel {
  return CAROUSEL_MODELS.find((m) => m.key === key) ?? CAROUSEL_MODELS[0]!
}

// ── IMPAGINAZIONI PER SINGOLA TAVOLA, RAGGRUPPATE PER NUMERO DI FOTO ─────────────
// Il fotografo sceglie QUANTE foto ha su una tavola e riceve diverse impaginazioni per quel numero.
// rects in coord LOCALI della slide (0..1); vengono rimappati sulla tavola k dalla pagina.
export type SlideLayout = { key: string; label: string; rects: Rect[] }

// Griglia generica cols×rows dentro il riquadro (x0,y0,W,H) con gutter uniforme.
const grid = (cols: number, rows: number, x0 = 0, y0 = 0, W = 1, H = 1): Rect[] => {
  const w = (W - (cols - 1) * gx) / cols, h = (H - (rows - 1) * gy) / rows
  const out: Rect[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * (w + gx), y: y0 + r * (h + gy), w, h })
  return out
}
const rowL = (k: number, y = 0, h = 1, x0 = 0, W = 1): Rect[] => grid(k, 1, x0, y, W, h)
const colL = (k: number, x = 0, w = 1, y0 = 0, H = 1): Rect[] => grid(1, k, x, y0, w, H)

export const SLIDE_LAYOUTS: Record<number, SlideLayout[]> = {
  1: [
    { key: '1-full', label: 'Piena', rects: [{ x: 0, y: 0, w: 1, h: 1 }] },
    { key: '1-margin', label: 'Con margine', rects: [{ x: 0.07, y: 0.055, w: 0.86, h: 0.89 }] },
    { key: '1-portrait', label: 'Ritratto', rects: [{ x: 0.2, y: 0.07, w: 0.6, h: 0.86 }] },
    { key: '1-bottom', label: 'Ancorata basso', rects: [{ x: 0, y: 0.34, w: 1, h: 0.66 }] },
    { key: '1-passe', label: 'Passepartout', rects: [{ x: 0.18, y: 0.22, w: 0.64, h: 0.5 }] },
    { key: '1-polaroid', label: 'Polaroid', rects: [{ x: 0.11, y: 0.09, w: 0.78, h: 0.68, border: white, shadow: true, rot: -2.5 }] },
    { key: '1-hairline', label: 'Filo', rects: [{ x: 0.05, y: 0.04, w: 0.9, h: 0.92, border: dark }] },
  ],
  2: [
    { key: '2-cols', label: 'Affiancate', rects: rowL(2) },
    { key: '2-rows', label: 'Impilate', rects: colL(2) },
    { key: '2-bigL', label: 'Grande + piccola', rects: [{ x: 0, y: 0, w: 0.64, h: 1 }, { x: 0.66, y: 0.24, w: 0.34, h: 0.52 }] },
    { key: '2-offset', label: 'Sfalsate', rects: [{ x: 0.04, y: 0.05, w: 0.6, h: 0.5, shadow: true }, { x: 0.36, y: 0.45, w: 0.6, h: 0.5, shadow: true }] },
    { key: '2-dip', label: 'Dittico a filo', rects: [{ x: 0, y: 0, w: 0.498, h: 1 }, { x: 0.502, y: 0, w: 0.498, h: 1 }] },
    { key: '2-polas', label: 'Due polaroid', rects: [{ x: 0.03, y: 0.08, w: 0.5, h: 0.62, border: white, shadow: true, rot: -3 }, { x: 0.47, y: 0.3, w: 0.5, h: 0.62, border: white, shadow: true, rot: 3 }] },
  ],
  3: [
    { key: '3-bands', label: 'Tre bande', rects: rowL(3) },
    { key: '3-rows', label: 'Tre righe', rects: colL(3) },
    { key: '3-Lbig', label: 'Grande + due', rects: [{ x: 0, y: 0, w: 0.6, h: 1 }, ...colL(2, 0.62, 0.38) as Rect[]] },
    { key: '3-strip', label: 'Provini', rects: [{ x: 0.02, y: 0.37, w: 0.3, h: 0.26 }, { x: 0.35, y: 0.37, w: 0.3, h: 0.26 }, { x: 0.68, y: 0.37, w: 0.3, h: 0.26 }] },
    { key: '3-topbig', label: 'Grande sopra', rects: [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.62, w: 0.49, h: 0.38 }, { x: 0.51, y: 0.62, w: 0.49, h: 0.38 }] },
    { key: '3-scrap', label: 'Scrapbook', rects: [{ x: 0.03, y: 0.06, w: 0.5, h: 0.5, border: white, shadow: true, rot: -4 }, { x: 0.5, y: 0.02, w: 0.46, h: 0.46, border: white, shadow: true, rot: 3 }, { x: 0.25, y: 0.5, w: 0.5, h: 0.46, border: white, shadow: true, rot: -2 }] },
  ],
  4: [
    { key: '4-grid', label: 'Griglia 2×2', rects: grid(2, 2) },
    { key: '4-row', label: 'In fila', rects: rowL(4) },
    { key: '4-bigL', label: 'Grande + tre', rects: [{ x: 0, y: 0, w: 0.6, h: 1 }, ...colL(3, 0.62, 0.38) as Rect[]] },
    { key: '4-topstrip', label: '1 + fila di 3', rects: [{ x: 0, y: 0, w: 1, h: 0.62 }, ...rowL(3, 0.64, 0.36) as Rect[]] },
    { key: '4-scrap', label: 'Scrapbook', rects: [{ x: 0.04, y: 0.05, w: 0.44, h: 0.44, border: white, shadow: true, rot: -4 }, { x: 0.5, y: 0.08, w: 0.44, h: 0.44, border: white, shadow: true, rot: 3 }, { x: 0.06, y: 0.5, w: 0.44, h: 0.44, border: white, shadow: true, rot: 2.5 }, { x: 0.5, y: 0.52, w: 0.44, h: 0.44, border: white, shadow: true, rot: -3 }] },
  ],
  5: [
    { key: '5-2-3', label: '2 sopra · 3 sotto', rects: [...rowL(2, 0, 0.49) as Rect[], ...rowL(3, 0.51, 0.49) as Rect[]] },
    { key: '5-bigL', label: 'Grande + quattro', rects: [{ x: 0, y: 0, w: 0.6, h: 1 }, ...grid(2, 2, 0.62, 0, 0.38, 1) as Rect[]] },
    { key: '5-3-2', label: '3 sopra · 2 sotto', rects: [...rowL(3, 0, 0.49) as Rect[], ...rowL(2, 0.51, 0.49) as Rect[]] },
    { key: '5-row', label: 'In fila', rects: rowL(5) },
  ],
  6: [
    { key: '6-2x3', label: 'Griglia 2×3', rects: grid(2, 3) },
    { key: '6-3x2', label: 'Griglia 3×2', rects: grid(3, 2) },
    { key: '6-bigL', label: 'Grande + cinque', rects: [{ x: 0, y: 0, w: 0.62, h: 1 }, ...grid(1, 5, 0.64, 0, 0.36, 1) as Rect[]] },
    { key: '6-contact', label: 'Provinato', rects: grid(3, 2, 0.04, 0.1, 0.92, 0.8) },
  ],
}

// Numero massimo di foto per cui offriamo impaginazioni pronte (oltre, si compone a mano).
export const MAX_LAYOUT_PHOTOS = 6

// Costruisce gli elementi di UN layout sulla tavola k: le foto `ids` (in ordine) riempiono i rects.
export function buildSlideLayoutEls(rects: Rect[], n: number, k: number, ids: string[]): FreeEl[] {
  return rects.map((r, i) => styled(el(ids[i] ?? '', (k + r.x) / n, r.y, r.w / n, r.h), r))
}

// ── TESTO ─────────────────────────────────────────────────────────────────────
// Blocco di testo sulla strip (stesse coordinate 0..1 delle foto). size = frazione dell'ALTEZZA
// slide → scala con l'anteprima e con l'export.
export const CAROUSEL_FONTS: { key: string; label: string; family: string }[] = [
  { key: 'display', label: 'Serif', family: "'Fraunces Variable', Georgia, serif" },
  { key: 'sans', label: 'Sans', family: "'Inter Variable', system-ui, sans-serif" },
]
export const getFontFamily = (k: string) => CAROUSEL_FONTS.find((f) => f.key === k)?.family ?? CAROUSEL_FONTS[0]!.family

export type TextEl = {
  id: string; kind: 'text'; text: string
  x: number; y: number; w: number; h: number; rot: number
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle' | 'bottom'
  color: string; font: string; size: number; weight: number
  italic?: boolean; bg?: string | null; line?: number; letter?: number
}
export function newText(patch: Partial<TextEl> = {}): TextEl {
  return { id: uid(), kind: 'text', text: 'Testo', x: 0.04, y: 0.06, w: 0.3, h: 0.14, rot: 0, align: 'left', valign: 'top', color: '#111111', font: 'display', size: 0.07, weight: 600, ...patch }
}
export const TEXT_PRESETS: { label: string; patch: Partial<TextEl> }[] = [
  { label: 'Titolo', patch: { text: 'Il tuo titolo', font: 'display', size: 0.12, weight: 700, w: 0.34, h: 0.24, line: 1.02 } },
  { label: 'Sottotitolo', patch: { text: 'Sottotitolo', font: 'sans', size: 0.05, weight: 500, w: 0.32, h: 0.1 } },
  { label: 'Didascalia', patch: { text: 'didascalia', font: 'sans', size: 0.032, weight: 400, w: 0.28, h: 0.08, color: '#444444' } },
  { label: 'Firma studio', patch: { text: '@iltuostudio', font: 'sans', size: 0.03, weight: 600, w: 0.24, h: 0.06, letter: 0.08 } },
  { label: 'Testo semplice', patch: { text: 'Testo', font: 'sans', size: 0.04, weight: 400, w: 0.3, h: 0.1 } },
]

// ── PRESET PRONTI ────────────────────────────────────────────────────────────
// Composizioni FINITE (foto + testo già messi): la coppia/pro sostituisce solo le foto e cambia
// i testi. Diversi dai "modelli" (che dispongono solo le foto). build → { elements, texts }.
export type CarouselPreset = {
  key: string; label: string; hint: string
  build: (n: number, ids: string[]) => { elements: FreeEl[]; texts: TextEl[] }
}
// foto slot in slide k (coord LOCALI slide 0..1); testo in slide k (coord locali)
const sp = (id: string, k: number, n: number, lx: number, ly: number, lw: number, lh: number): FreeEl => el(id ?? '', (k + lx) / n, ly, lw / n, lh)
const stx = (k: number, n: number, patch: Partial<TextEl>, lx: number, ly: number, lw: number, lh: number): TextEl => newText({ ...patch, x: (k + lx) / n, y: ly, w: lw / n, h: lh })

export const CAROUSEL_PRESETS: CarouselPreset[] = [
  {
    key: 'cover-story', label: 'Copertina + racconto', hint: '1ª slide con titolo grande sulla foto, poi una foto per slide.',
    build: (n, ids) => {
      const elements: FreeEl[] = [], texts: TextEl[] = []
      for (let k = 0; k < n; k++) elements.push(sp(ids[k] ?? '', k, n, 0, 0, 1, 1))
      texts.push(stx(0, n, { text: 'IL TITOLO', font: 'display', size: 0.12, weight: 800, color: '#ffffff', align: 'left', valign: 'bottom', line: 1.0, letter: 0.01 }, 0.06, 0.52, 0.88, 0.28))
      texts.push(stx(0, n, { text: 'un sottotitolo che introduce', font: 'sans', size: 0.035, weight: 500, color: '#ffffff', align: 'left', valign: 'bottom' }, 0.06, 0.86, 0.88, 0.1))
      return { elements, texts }
    },
  },
  {
    key: 'cover-clean', label: 'Copertina pulita', hint: '1ª slide di solo testo (titolo centrato), poi una foto per slide.',
    build: (n, ids) => {
      const elements: FreeEl[] = [], texts: TextEl[] = []
      for (let k = 1; k < n; k++) elements.push(sp(ids[k - 1] ?? '', k, n, 0, 0, 1, 1))
      texts.push(stx(0, n, { text: 'Il titolo', font: 'display', size: 0.1, weight: 700, color: '#111111', align: 'center', valign: 'middle', line: 1.05 }, 0.1, 0.3, 0.8, 0.28))
      texts.push(stx(0, n, { text: 'sottotitolo', font: 'sans', size: 0.035, weight: 500, color: '#111111', align: 'center' }, 0.1, 0.6, 0.8, 0.1))
      texts.push(stx(0, n, { text: '@iltuostudio', font: 'sans', size: 0.028, weight: 600, color: '#111111', align: 'center', valign: 'bottom', letter: 0.06 }, 0.1, 0.9, 0.8, 0.06))
      return { elements, texts }
    },
  },
  {
    key: 'captions', label: 'Foto + didascalie', hint: 'Una foto per slide con una didascalia in basso.',
    build: (n, ids) => {
      const elements: FreeEl[] = [], texts: TextEl[] = []
      for (let k = 0; k < n; k++) { elements.push(sp(ids[k] ?? '', k, n, 0, 0, 1, 1)); texts.push(stx(k, n, { text: 'Didascalia', font: 'sans', size: 0.03, weight: 600, color: '#ffffff', align: 'left', valign: 'bottom', bg: '#00000066' }, 0.04, 0.86, 0.7, 0.1)) }
      return { elements, texts }
    },
  },
  {
    key: 'editorial-titles', label: 'Editoriale con titoli', hint: 'Foto in basso, titolo nello spazio bianco in alto.',
    build: (n, ids) => {
      const elements: FreeEl[] = [], texts: TextEl[] = []
      for (let k = 0; k < n; k++) { elements.push(sp(ids[k] ?? '', k, n, 0, 0.34, 1, 0.66)); texts.push(stx(k, n, { text: 'Titolo', font: 'display', size: 0.08, weight: 700, color: '#111111', align: 'left', valign: 'middle', line: 1.02 }, 0.06, 0.03, 0.88, 0.28)) }
      return { elements, texts }
    },
  },
  {
    key: 'numbered', label: 'Lista numerata', hint: 'Foto + numero grande + breve testo per ogni slide.',
    build: (n, ids) => {
      const elements: FreeEl[] = [], texts: TextEl[] = []
      for (let k = 0; k < n; k++) {
        elements.push(sp(ids[k] ?? '', k, n, 0.04, 0.2, 0.92, 0.58))
        texts.push(stx(k, n, { text: String(k + 1).padStart(2, '0'), font: 'display', size: 0.14, weight: 800, color: '#111111', align: 'left', valign: 'top' }, 0.05, 0.03, 0.4, 0.16))
        texts.push(stx(k, n, { text: 'Un punto del racconto', font: 'sans', size: 0.032, weight: 500, color: '#111111', align: 'left', valign: 'top' }, 0.05, 0.82, 0.9, 0.14))
      }
      return { elements, texts }
    },
  },
  {
    key: 'quote', label: 'Citazione', hint: '1ª slide con una frase grande, poi foto con cornice.',
    build: (n, ids) => {
      const elements: FreeEl[] = [], texts: TextEl[] = []
      const py = 0.08
      for (let k = 1; k < n; k++) elements.push(sp(ids[k - 1] ?? '', k, n, 0.08, py, 0.84, 1 - 2 * py))
      texts.push(stx(0, n, { text: '“La frase che resta.”', font: 'display', size: 0.075, weight: 600, italic: true, color: '#111111', align: 'center', valign: 'middle', line: 1.15 }, 0.08, 0.2, 0.84, 0.5))
      texts.push(stx(0, n, { text: '— autore', font: 'sans', size: 0.03, weight: 500, color: '#111111', align: 'center' }, 0.08, 0.74, 0.84, 0.08))
      return { elements, texts }
    },
  },
  {
    key: 'magazine', label: 'Rivista', hint: 'Hero + due foto piccole + titolo per ogni slide.',
    build: (n, ids) => {
      const elements: FreeEl[] = [], texts: TextEl[] = []
      let p = 0
      for (let k = 0; k < n; k++) {
        elements.push(sp(ids[p++] ?? '', k, n, 0, 0, 1, 0.62))
        elements.push(sp(ids[p++] ?? '', k, n, 0.04, 0.66, 0.44, 0.3))
        elements.push(sp(ids[p++] ?? '', k, n, 0.52, 0.66, 0.44, 0.3))
        texts.push(stx(k, n, { text: 'Titolo', font: 'display', size: 0.055, weight: 700, color: '#ffffff', align: 'left', valign: 'bottom', bg: '#00000055' }, 0.04, 0.48, 0.7, 0.12))
      }
      return { elements, texts }
    },
  },
]
export function getPreset(key: string): CarouselPreset | undefined { return CAROUSEL_PRESETS.find((p) => p.key === key) }
