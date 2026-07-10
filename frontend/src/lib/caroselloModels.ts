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
  // Numero di foto usate dal premodello per N slide (per capire quante servono).
  photosFor: (n: number) => number
  // Costruisce gli slot sulla strip (0..1 su tutta la larghezza). `ids` = foto disponibili in
  // ordine; gli slot in eccesso restano vuoti (mediaId '').
  build: (n: number, ids: string[]) => FreeEl[]
}

// slot pieno-slide k (full bleed)
const fullSlide = (k: number, n: number, id: string) => el(id, k / n, 0, 1 / n, 1)

export const CAROUSEL_MODELS: CarouselModel[] = [
  {
    key: 'pano',
    label: 'Panoramica unica',
    hint: 'Una sola foto larga su tutte le slide: lo swipe la scorre. Effetto wow.',
    photosFor: () => 1,
    build: (_n, ids) => [el(ids[0] ?? '', 0, 0, 1, 1)],
  },
  {
    key: 'one',
    label: 'Una foto per slide',
    hint: 'Una foto a tutta slide per ciascuna: racconto pulito.',
    photosFor: (n) => n,
    build: (n, ids) => Array.from({ length: n }, (_, k) => fullSlide(k, n, ids[k] ?? '')),
  },
  {
    key: 'framed',
    label: 'Foto con cornice',
    hint: 'Una foto per slide con margine su sfondo: stile editoriale.',
    photosFor: (n) => n,
    build: (n, ids) => {
      const px = 0.08 / n, py = 0.08
      return Array.from({ length: n }, (_, k) => el(ids[k] ?? '', k / n + px, py, 1 / n - 2 * px, 1 - 2 * py))
    },
  },
  {
    key: 'stack2',
    label: 'Due per slide',
    hint: 'Due foto impilate per slide: il doppio del racconto.',
    photosFor: (n) => n * 2,
    build: (n, ids) => {
      const g = 0.006
      const out: FreeEl[] = []
      for (let k = 0; k < n; k++) {
        out.push(el(ids[k * 2] ?? '', k / n, 0, 1 / n, 0.5 - g))
        out.push(el(ids[k * 2 + 1] ?? '', k / n, 0.5 + g, 1 / n, 0.5 - g))
      }
      return out
    },
  },
  {
    key: 'cover',
    label: 'Copertina + foto',
    hint: 'Prima slide libera per il titolo, poi una foto per slide.',
    photosFor: (n) => Math.max(0, n - 1),
    build: (n, ids) => Array.from({ length: n - 1 }, (_, i) => fullSlide(i + 1, n, ids[i] ?? '')),
  },
]

export function getModel(key: string): CarouselModel {
  return CAROUSEL_MODELS.find((m) => m.key === key) ?? CAROUSEL_MODELS[1]!
}
