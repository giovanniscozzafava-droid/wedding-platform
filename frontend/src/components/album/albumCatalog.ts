// ============================================================================
// CATALOGO ALBUM — sorgente unica di verità (DesignAlbum).
// Usato da: configuratore copertina (coppia), mockup 3D, e FotoLab (coda stampa).
// Logica catalogo: ogni MODELLO indossa TUTTI i tessuti; ogni tessuto ha la sua
// palette di COLORI. Il modello definisce forma (format) + decoro.
// ============================================================================

export type Cover = {
  model?: string
  fabric?: string
  color?: string          // hex, per il rendering (retro-compatibile)
  colorKey?: string        // chiave colore catalogo (per FotoLab: nome da ordinare)
  photo_url?: string | null
  title?: string
}

export type GrainKey = 'leather' | 'leatherCoarse' | 'sparkle' | 'quilt' | 'weave' | 'fine'
export type Format = 'square' | 'portrait' | 'landscape'
// decoro: come si caratterizza la copertina nel 3D
//  plate=placca alluminio · floral=stampa a secco floreale · frame=cornice incisa
//  photo=foto incassata in copertina · strap=chiusura coloniale a laccio
export type Decoro = 'plate' | 'floral' | 'frame' | 'photo' | 'strap'

export type PBR = {
  roughness: number; metalness: number; clearcoat?: number; clearcoatRoughness?: number
  reflectivity?: number; normalScale: number; repeat: number; sparkle?: boolean
}

export type ColorDef = { key: string; label: string; hex: string }
export type Fabric = { key: string; label: string; swatch: string; grain: GrainKey; pbr: PBR; palette: string[] }
export type Model = { key: string; label: string; blurb: string; format: Format; decoro: Decoro; fabrics?: string[] }

export const COLORS: Record<string, ColorDef> = {
  'bianco-neve':       { key: 'bianco-neve',       label: 'Bianco Neve',       hex: '#f1ede6' },
  'nero':              { key: 'nero',              label: 'Nero',              hex: '#1c1c1e' },
  'grigio':            { key: 'grigio',            label: 'Grigio / Gray',     hex: '#9a9893' },
  'ecru':              { key: 'ecru',              label: 'Ecru',              hex: '#e3d8c6' },
  'cipria':            { key: 'cipria',            label: 'Cipria',            hex: '#e3c4bd' },
  'tortora':           { key: 'tortora',           label: 'Tortora',           hex: '#b3a394' },
  'taupe':             { key: 'taupe',             label: 'Taupe',             hex: '#8b7e70' },
  'rosso-lacca':       { key: 'rosso-lacca',       label: 'Rosso Lacca',       hex: '#a81f2b' },
  'rosa-indiano':      { key: 'rosa-indiano',      label: 'Rosa Indiano',      hex: '#c43b6e' },
  'orchidea':          { key: 'orchidea',          label: 'Orchidea',          hex: '#c44f86' },
  'dahlia':            { key: 'dahlia',            label: 'Dahlia',            hex: '#8c2b4d' },
  'turchese':          { key: 'turchese',          label: 'Turchese',          hex: '#1f7fa3' },
  'bruco':             { key: 'bruco',             label: 'Bruco',             hex: '#94b836' },
  'lichen':            { key: 'lichen',            label: 'Lichen',            hex: '#7a895a' },
  'lime':              { key: 'lime',              label: 'Lime',              hex: '#c7d365' },
  'ananas':            { key: 'ananas',            label: 'Ananas',            hex: '#e3c247' },
  'emerald':           { key: 'emerald',           label: 'Emerald',           hex: '#2da568' },
  'orange':            { key: 'orange',            label: 'Orange',            hex: '#df612a' },
  'quercia-bianca':    { key: 'quercia-bianca',    label: 'Quercia Bianca',    hex: '#d8cdb9' },
  'quercia-naturale':  { key: 'quercia-naturale',  label: 'Quercia Naturale',  hex: '#c6a473' },
  'quercia-rossa':     { key: 'quercia-rossa',     label: 'Quercia Rossa',     hex: '#b35a44' },
  'volanato-bruno':    { key: 'volanato-bruno',    label: 'Volanato Bruno',    hex: '#6b4731' },
  'volanato-naturale': { key: 'volanato-naturale', label: 'Volanato Naturale', hex: '#c5a06e' },
  'volanato-arancio':  { key: 'volanato-arancio',  label: 'Volanato Arancio',  hex: '#cb772d' },
  'volanato-senape':   { key: 'volanato-senape',   label: 'Volanato Senape',   hex: '#c5963a' },
  'volanato-rosso':    { key: 'volanato-rosso',    label: 'Volanato Rosso',    hex: '#9a3a31' },
  'volanato-verde':    { key: 'volanato-verde',    label: 'Volanato Verde',    hex: '#6c7a3d' },
  'cuoio-anticato':    { key: 'cuoio-anticato',    label: 'Anticato',          hex: '#774830' },
  'cuoio-cognac':      { key: 'cuoio-cognac',      label: 'Cognac',            hex: '#985729' },
  'bronzo':            { key: 'bronzo',            label: 'Bronzo',            hex: '#7c5d3c' },
  'rame':              { key: 'rame',              label: 'Rame',              hex: '#9a5b34' },
  'sabbia':            { key: 'sabbia',            label: 'Sabbia',            hex: '#cdbfa3' },
  'perla':             { key: 'perla',             label: 'Perla',             hex: '#dcd5c7' },
  'gloss-gold':        { key: 'gloss-gold',        label: 'Gloss Gold',        hex: '#c9a24a' },
  'gloss-silver':      { key: 'gloss-silver',      label: 'Gloss Silver',      hex: '#c7ccd1' },
  'gloss-dark-blue':   { key: 'gloss-dark-blue',   label: 'Gloss Dark Blue',   hex: '#23306a' },
  'gloss-violet':      { key: 'gloss-violet',      label: 'Gloss Violet',      hex: '#8a4fae' },
  'gloss-arancio':     { key: 'gloss-arancio',     label: 'Gloss Arancio',     hex: '#e2622a' },
  'gloss-rosso':       { key: 'gloss-rosso',       label: 'Gloss Rosso',       hex: '#c0202c' },
  'gloss-rosa':        { key: 'gloss-rosa',        label: 'Gloss Rosa Indiano',hex: '#d23d77' },
}

const hexOf = (k: string): string => COLORS[k]?.hex ?? '#cccccc'

const GENERAL = ['bianco-neve','nero','grigio','ecru','cipria','tortora','taupe','rosso-lacca',
  'rosa-indiano','orchidea','dahlia','turchese','bruco','lichen','lime','ananas','emerald','orange']
const CUOIO = ['quercia-bianca','quercia-naturale','quercia-rossa','volanato-bruno','volanato-naturale',
  'volanato-arancio','volanato-senape','volanato-rosso','volanato-verde','cuoio-anticato','cuoio-cognac']
const GLOSS = ['gloss-gold','gloss-silver','gloss-dark-blue','gloss-violet','gloss-arancio','gloss-rosso','gloss-rosa']

export const FABRICS: Fabric[] = [
  { key: 'pelle',     label: 'Pelle',     swatch: hexOf('bianco-neve'), grain: 'leather',
    palette: GENERAL, pbr: { roughness: 0.55, metalness: 0,    clearcoat: 0.12, clearcoatRoughness: 0.55, normalScale: 0.42, repeat: 2.0 } },
  { key: 'cuoio',     label: 'Cuoio',     swatch: hexOf('quercia-naturale'), grain: 'leatherCoarse',
    palette: CUOIO,   pbr: { roughness: 0.74, metalness: 0,    clearcoat: 0.04, clearcoatRoughness: 0.7,  normalScale: 0.95, repeat: 1.6 } },
  { key: 'glitter',   label: 'Glitter',   swatch: hexOf('perla'), grain: 'sparkle',
    palette: ['bianco-neve','grigio','nero','bronzo','perla','rosa-indiano','rosso-lacca'],
    pbr: { roughness: 0.40, metalness: 0.35, clearcoat: 0.25, clearcoatRoughness: 0.3, normalScale: 0.45, repeat: 3.0, sparkle: true } },
  { key: 'capitonne', label: 'Capitonné', swatch: hexOf('rame'), grain: 'quilt',
    palette: ['bianco-neve','rame','grigio','bronzo','tortora','taupe'],
    pbr: { roughness: 0.50, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.4, normalScale: 0.9, repeat: 1.0 } },
  { key: 'panama',    label: 'Panama',    swatch: hexOf('sabbia'), grain: 'weave',
    palette: ['sabbia','bronzo','bianco-neve','tortora','taupe'],
    pbr: { roughness: 0.62, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.6, normalScale: 0.85, repeat: 2.4 } },
  { key: 'gloss',     label: 'Gloss',     swatch: hexOf('gloss-gold'), grain: 'fine',
    palette: GLOSS,   pbr: { roughness: 0.07, metalness: 0, clearcoat: 1.0, clearcoatRoughness: 0.04, reflectivity: 1.0, normalScale: 0.12, repeat: 2.0 } },
]

export const MODELS: Model[] = [
  { key: 'quadra',   label: 'Quadra',    blurb: 'Minimal, placca alluminio.',        format: 'square',    decoro: 'plate' },
  { key: 'ninfea',   label: 'Ninfea',    blurb: 'Decoro floreale a secco.',          format: 'portrait',  decoro: 'floral' },
  { key: 'vega',     label: 'Vega',      blurb: 'Iniziali in ottone, placca.',       format: 'portrait',  decoro: 'plate' },
  { key: 'satin',    label: 'Satin',     blurb: 'Geometrico, fascia alluminio.',     format: 'portrait',  decoro: 'plate' },
  { key: 'elektra',  label: 'Elektra',   blurb: 'Soffioni floreali a secco.',        format: 'portrait',  decoro: 'floral' },
  { key: 'artemis',  label: 'Artemis',   blurb: 'Decoro floreale stampato a secco.', format: 'portrait',  decoro: 'floral' },
  { key: 'cordelia', label: 'Cordelia',  blurb: 'Motivi floreali a secco.',          format: 'portrait',  decoro: 'floral' },
  { key: 'leda',     label: 'Leda',      blurb: 'Cornice incisa classica.',          format: 'portrait',  decoro: 'frame' },
  { key: 'roman',    label: 'Roman',     blurb: 'Cornice e nervature a costa.',       format: 'portrait',  decoro: 'frame' },
  { key: 'solar',    label: 'Solar',     blurb: 'Incisioni gotiche a mano.',          format: 'portrait',  decoro: 'frame' },
  { key: 'idria',    label: 'Idria',     blurb: 'Chiusura coloniale, solo cuoio/pelle.', format: 'portrait', decoro: 'strap', fabrics: ['pelle','cuoio'] },
  { key: 'kalea',    label: 'Kalea',     blurb: 'Chiusura a laccio, decoro inciso.',  format: 'portrait',  decoro: 'strap' },
  { key: 'andromeda',label: 'Andromeda', blurb: 'Foto incassata, formato panoramico.',format: 'landscape', decoro: 'photo' },
  { key: 'frame',    label: 'Frame',     blurb: 'Foto incassata in plexi.',          format: 'portrait',  decoro: 'photo' },
]

// ---- helper ----
export const fabricByKey = (k?: string): Fabric | undefined => FABRICS.find((f) => f.key === k)
export const modelByKey = (k?: string): Model | undefined => MODELS.find((m) => m.key === k)

export function paletteFor(fabricKey?: string): ColorDef[] {
  const fab = fabricByKey(fabricKey)
  if (!fab) return []
  return fab.palette.map((c) => COLORS[c]).filter((c): c is ColorDef => !!c)
}

// tessuti ammessi da un modello (default: tutti)
export function fabricsForModel(modelKey?: string): Fabric[] {
  const m = modelByKey(modelKey)
  if (!m?.fabrics) return FABRICS
  return FABRICS.filter((f) => m.fabrics!.includes(f.key))
}

// etichette leggibili per FotoLab
export const modelLabel = (k?: string) => modelByKey(k)?.label || k || '—'
export const fabricLabel = (k?: string) => fabricByKey(k)?.label || k || '—'
export const colorLabel = (cover: Pick<Cover, 'colorKey' | 'color'>) =>
  (cover.colorKey && COLORS[cover.colorKey]?.label) || (cover.color ? 'Personalizzato' : '—')

// descrizione compatta copertina (coda stampa FotoLab)
export function coverSummary(cover?: Cover): string {
  if (!cover) return '—'
  return `${modelLabel(cover.model)} · ${fabricLabel(cover.fabric)} · ${colorLabel(cover)}`
}
