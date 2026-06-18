// Formati album professionali. width/height in mm = UNA pagina (facciata).
// Lo spread (doppia pagina) è largo 2× la pagina singola.
export type AlbumFormat = {
  key: string
  label: string
  category: 'Quadrato' | 'Orizzontale' | 'Verticale' | 'Panoramico' | 'Proof'
  w: number // mm, pagina singola
  h: number // mm
}

export const ALBUM_FORMATS: AlbumFormat[] = [
  { key: 'SQ_30',     label: 'Quadrato 30×30',     category: 'Quadrato',    w: 300, h: 300 },
  { key: 'SQ_25',     label: 'Quadrato 25×25',     category: 'Quadrato',    w: 250, h: 250 },
  { key: 'SQ_20',     label: 'Quadrato 20×20',     category: 'Quadrato',    w: 200, h: 200 },
  { key: 'LAND_30x20', label: 'Orizzontale 30×20',  category: 'Orizzontale', w: 300, h: 200 },
  { key: 'LAND_25x35', label: 'Orizzontale 25×35',  category: 'Orizzontale', w: 350, h: 250 },
  { key: 'LAND_35x25', label: 'Orizzontale 35×25',  category: 'Orizzontale', w: 350, h: 250 },
  { key: 'LAND_40x30', label: 'Orizzontale 40×30',  category: 'Orizzontale', w: 400, h: 300 },
  { key: 'PORT_20x30', label: 'Verticale 20×30',    category: 'Verticale',   w: 200, h: 300 },
  { key: 'PORT_24x30', label: 'Verticale 24×30',    category: 'Verticale',   w: 240, h: 300 },
  { key: 'PORT_30x40', label: 'Verticale 30×40',    category: 'Verticale',   w: 300, h: 400 },
  { key: 'PANO_45x22', label: 'Panoramico 45×22',   category: 'Panoramico',  w: 450, h: 220 },
  { key: 'PANO_40x20', label: 'Panoramico 40×20',   category: 'Panoramico',  w: 400, h: 200 },
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
