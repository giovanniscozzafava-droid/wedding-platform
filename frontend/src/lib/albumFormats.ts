// Formati album professionali. width/height in mm = UNA pagina (facciata).
// Lo spread (doppia pagina) è largo 2× la pagina singola.
export type AlbumFormat = {
  key: string
  label: string
  category: 'Quadrato' | 'Orizzontale' | 'Verticale' | 'Panoramico' | 'Proof'
  w: number // mm, pagina singola
  h: number // mm
}

// NB: w/h = UNA pagina (facciata). La TAVOLA stampata è un foglio unico largo 2×w (la riga
// centrale è solo la piega). Le etichette mostrano "pagina · TAVOLA 2w×h" per chiarezza.
export const ALBUM_FORMATS: AlbumFormat[] = [
  { key: 'SQ_30',     label: 'Pagina 30×30 · tavola 60×30',  category: 'Quadrato',    w: 300, h: 300 },
  { key: 'SQ_25',     label: 'Pagina 25×25 · tavola 50×25',  category: 'Quadrato',    w: 250, h: 250 },
  { key: 'SQ_20',     label: 'Pagina 20×20 · tavola 40×20',  category: 'Quadrato',    w: 200, h: 200 },
  { key: 'LAND_30x20', label: 'Pagina 30×20 · tavola 60×20', category: 'Orizzontale', w: 300, h: 200 },
  { key: 'LAND_35x25', label: 'Pagina 35×25 · tavola 70×25', category: 'Orizzontale', w: 350, h: 250 },
  { key: 'LAND_40x30', label: 'Pagina 40×30 · tavola 80×30', category: 'Orizzontale', w: 400, h: 300 },
  { key: 'PORT_20x30', label: 'Pagina 20×30 · tavola 40×30', category: 'Verticale',   w: 200, h: 300 },
  { key: 'PORT_24x30', label: 'Pagina 24×30 · tavola 48×30', category: 'Verticale',   w: 240, h: 300 },
  { key: 'LAND_25x35', label: 'Pagina 25×35 · tavola 50×35', category: 'Verticale',   w: 250, h: 350 },
  { key: 'PORT_30x40', label: 'Pagina 30×40 · tavola 60×40', category: 'Verticale',   w: 300, h: 400 },
  { key: 'PANO_45x22', label: 'Pagina 45×22 · tavola 90×22', category: 'Panoramico',  w: 450, h: 220 },
  { key: 'PANO_40x20', label: 'Pagina 40×20 · tavola 80×20', category: 'Panoramico',  w: 400, h: 200 },
  { key: 'A4_PORT',   label: 'A4 verticale (proof)', category: 'Proof',       w: 210, h: 297 },
  { key: 'A4_LAND',   label: 'A4 orizzontale (proof)', category: 'Proof',     w: 297, h: 210 },
]

export const DEFAULT_FORMAT = 'SQ_30'

export function getFormat(key: string): AlbumFormat {
  return ALBUM_FORMATS.find((f) => f.key === key) ?? ALBUM_FORMATS[0]!
}

// aspetto pagina singola (w/h). >1 = orizzontale, <1 = verticale, =1 quadrato.
export function pageAspect(key: string): number {
  const f = getFormat(key)
  return f.w / f.h
}
