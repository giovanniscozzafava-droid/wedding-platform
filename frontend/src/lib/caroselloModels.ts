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

const hh = (1 - gy) / 2, ww = (1 - gx) / 2, w3 = (1 - 2 * gx) / 3
const hair = 0.004 // gutter finissimo (dittici editoriali)

// PREFORMAT EDITORIALI (stile rivista/Vogue): molto bianco, asimmetria, foto ancorate. Ogni slide
// ripete lo stesso schema → basta inserire le foto. [key, label, hint, rects locali slide 0..1].
const ED: [string, string, string, Rect[]][] = [
  ['ed-full', 'Vogue · pieno', 'Foto a tutta slide, drammatica.', [{ x: 0, y: 0, w: 1, h: 1 }]],
  ['ed-masthead', 'Vogue · testata', 'Foto in basso, alto libero per il titolo.', [{ x: 0, y: 0.34, w: 1, h: 0.66 }]],
  ['ed-colL', 'Vogue · colonna sx', 'Colonna verticale a sinistra, aria a destra.', [{ x: 0.06, y: 0.08, w: 0.5, h: 0.84 }]],
  ['ed-colR', 'Vogue · colonna dx', 'Colonna verticale a destra, aria a sinistra.', [{ x: 0.44, y: 0.08, w: 0.5, h: 0.84 }]],
  ['ed-center', 'Vogue · quadro centrale', 'Riquadro centrato con molto respiro.', [{ x: 0.2, y: 0.24, w: 0.6, h: 0.44 }]],
  ['ed-bottom', 'Vogue · ancorata basso', 'Foto ancorata al bordo inferiore.', [{ x: 0, y: 0.5, w: 1, h: 0.5 }]],
  ['ed-top', 'Vogue · ancorata alto', 'Foto ancorata al bordo superiore.', [{ x: 0, y: 0, w: 1, h: 0.5 }]],
  ['ed-portrait', 'Vogue · ritratto', 'Ritratto verticale con ampi margini laterali.', [{ x: 0.22, y: 0.06, w: 0.56, h: 0.88 }]],
  ['ed-corner', 'Vogue · angolo', 'Piccola foto in alto a sinistra, resto vuoto.', [{ x: 0.06, y: 0.07, w: 0.42, h: 0.42 }]],
  ['ed-diptych', 'Vogue · dittico', 'Due foto con filo sottilissimo di stacco.', [{ x: 0, y: 0, w: 0.5 - hair, h: 1 }, { x: 0.5 + hair, y: 0, w: 0.5 - hair, h: 1 }]],
  ['ed-triptych', 'Vogue · trittico', 'Una grande + due strette a destra.', [{ x: 0, y: 0, w: 0.56, h: 1 }, { x: 0.58, y: 0, w: 0.42, h: 0.5 - hair }, { x: 0.58, y: 0.5 + hair, w: 0.42, h: 0.5 - hair }]],
  ['ed-contact', 'Vogue · provinato', 'Sei mini-foto a contatto: griglia 3×2.', [
    { x: 0.05, y: 0.1, w: 0.28, h: 0.36 }, { x: 0.36, y: 0.1, w: 0.28, h: 0.36 }, { x: 0.67, y: 0.1, w: 0.28, h: 0.36 },
    { x: 0.05, y: 0.54, w: 0.28, h: 0.36 }, { x: 0.36, y: 0.54, w: 0.28, h: 0.36 }, { x: 0.67, y: 0.54, w: 0.28, h: 0.36 },
  ]],
  ['ed-band', 'Vogue · banda', 'Fascia orizzontale centrata, tanto bianco.', [{ x: 0, y: 0.34, w: 1, h: 0.32 }]],
  ['ed-mini', 'Vogue · minimal', 'Immagine piccola centrata: massimo respiro.', [{ x: 0.28, y: 0.3, w: 0.44, h: 0.34 }]],
  ['ed-hairline', 'Vogue · filo', 'Foto piena con cornice a filo scuro.', [{ x: 0.04, y: 0.03, w: 0.92, h: 0.94, border: { w: 2, color: '#111111' } }]],
  ['ed-offset', 'Vogue · sfalsata', 'Due foto orizzontali sfalsate in diagonale.', [{ x: 0, y: 0.06, w: 0.7, h: 0.42 }, { x: 0.3, y: 0.52, w: 0.7, h: 0.42 }]],
  ['ed-sign', 'Vogue · firma', 'Ritratto a sinistra, colonna destra per il testo.', [{ x: 0.05, y: 0.06, w: 0.55, h: 0.88 }]],
  ['ed-row3', 'Vogue · terzine', 'Tre foto in fila in alto, basso libero.', [{ x: 0.03, y: 0.1, w: 0.3, h: 0.34 }, { x: 0.35, y: 0.1, w: 0.3, h: 0.34 }, { x: 0.67, y: 0.1, w: 0.3, h: 0.34 }]],
  ['ed-air', 'Vogue · respiro alto', 'Foto in basso con aria in alto.', [{ x: 0, y: 0.2, w: 1, h: 0.8 }]],
  ['ed-two', 'Vogue · doppio ritratto', 'Due ritratti affiancati con margini.', [{ x: 0.06, y: 0.14, w: 0.42, h: 0.72 }, { x: 0.52, y: 0.14, w: 0.42, h: 0.72 }]],
  ['ed-Lbig', 'Vogue · L', 'Grande in alto + piccola in basso a sinistra.', [{ x: 0, y: 0, w: 1, h: 0.62 }, { x: 0.06, y: 0.68, w: 0.44, h: 0.26 }]],
  ['ed-bleedL', 'Vogue · sanguina sx', 'Foto che sborda a sinistra, colonna vuota a destra.', [{ x: 0, y: 0, w: 0.68, h: 1 }]],
  ['ed-bleedR', 'Vogue · sanguina dx', 'Foto che sborda a destra, colonna vuota a sinistra.', [{ x: 0.32, y: 0, w: 0.68, h: 1 }]],
  ['ed-frameXL', 'Vogue · cornice ampia', 'Foto con cornice bianca molto larga.', [{ x: 0.12, y: 0.1, w: 0.76, h: 0.8 }]],
]
const EDITORIAL_MODELS: CarouselModel[] = ED.map(([k, l, h, r]) => model(k, l, h, r, 'editoriale'))

export const CAROUSEL_MODELS: CarouselModel[] = [
  // — layout ripetuto per slide (basta inserire le foto) —
  model('one', 'Piena · una per slide', 'Una foto a tutta slide: racconto pulito e forte.', [{ x: 0, y: 0, w: 1, h: 1 }]),
  model('framed', 'Cornice editoriale', 'Foto con margine su sfondo: stile rivista.', [{ x: 0.07, y: 0.055, w: 0.86, h: 0.89 }]),
  model('stack2', 'Due impilate', 'Due foto una sopra l’altra per slide.', [{ x: 0, y: 0, w: 1, h: hh }, { x: 0, y: hh + gy, w: 1, h: hh }]),
  model('cols2', 'Due affiancate', 'Due foto verticali fianco a fianco.', [{ x: 0, y: 0, w: ww, h: 1 }, { x: ww + gx, y: 0, w: ww, h: 1 }]),
  model('grid4', 'Griglia 2×2', 'Quattro foto a griglia per slide: tanti momenti.', [
    { x: 0, y: 0, w: ww, h: hh }, { x: ww + gx, y: 0, w: ww, h: hh },
    { x: 0, y: hh + gy, w: ww, h: hh }, { x: ww + gx, y: hh + gy, w: ww, h: hh },
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
]
