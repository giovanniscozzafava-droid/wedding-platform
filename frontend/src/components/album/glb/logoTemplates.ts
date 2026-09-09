// I TEMPLATE DEI LOGHI DEL CATALOGO DesignAlbum (pag. 34–37): i dati vivono in logoZones.json
// (condiviso con scripts/album-swatches/extract-logo-ornaments.py, che cancella le zone del testo
// campione dal ritaglio a 300 dpi per ottenere l'ornamento). Qui solo i tipi e l'accesso tipizzato.
import zones from '@/components/album/glb/logoZones.json'

export type ZoneRole = 'names' | 'names-amp' | 'names-caps' | 'name1' | 'name2' | 'e' | 'date' | 'date-words' | 'year' | 'day' | 'month-year'
  | 'initials' | 'initials-tight' | 'initial1' | 'initial2' | 'initials-amp' | 'fixed'
export type TextZone = {
  role: ZoneRole
  x: number; y: number; w: number; h: number       // frazioni del riquadro, origine in alto a sinistra
  font: string                                     // famiglia (public/fonts/logo, Google Fonts OFL)
  weight?: number
  sizeFactor?: number                              // corpo = h × sizeFactor (default 0.8)
  letterSpacing?: number                           // in em
  align?: 'left' | 'center' | 'right'
  rotate?: number                                  // gradi
  color?: [number, number, number]                 // colore fisso (rosso/grigio del catalogo); altrimenti l'inchiostro scelto
  text?: string                                    // per role 'fixed'
}
export type LogoTemplate = {
  aspect: number                                   // h / w del riquadro
  ornament: boolean                                // c'è un ornamento estratto (public/album-logos/<code>.png)
  ornamentKeepsColor?: boolean                     // ornamento a colori (ghirlande): non si tinge
  zones: TextZone[]
  note?: string
  fidelity: 'esatto' | 'vicino'                    // font identificato / commerciale sostituito dal più simile
}

const raw = zones as unknown as Record<string, LogoTemplate | string>
export const LOGO_TEMPLATES: Record<string, LogoTemplate> = Object.fromEntries(
  Object.entries(raw).filter(([k, v]) => k !== '_' && typeof v === 'object'),
) as Record<string, LogoTemplate>

export const hasLogoTemplate = (code?: string | null): boolean => !!code && !!LOGO_TEMPLATES[code]
