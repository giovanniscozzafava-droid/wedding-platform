// ============================================================================
// CATALOGO ALBUM DESIGNALBUM — sorgente unica di verità (commerciale 2022).
// Dati reali estratti dal catalogo 2022 + registro ordini.
// Usato da: configuratore copertina (coppia), mockup 3D, FotoLab (coda stampa).
//
// Modello & materiale separati: MODELLO = forma + decoro (categoria);
// MATERIALE = superficie (texture reale + PBR + sua palette colori);
// COLORE = tinta. Ogni modello può montare tutti i materiali (default).
// Backward-compat: Cover.fabric = chiave MATERIALE.
// ============================================================================

export type Cover = {
  model?: string
  fabric?: string          // = chiave MATERIALE (Tessuto copertina)
  color?: string           // hex per il rendering
  colorKey?: string        // chiave colore catalogo (per FotoLab: nome da ordinare)
  box?: string             // chiave BOX/contenitore
  format?: Format          // verticale / orizzontale / quadrato (scelta primaria)
  sizeKey?: string         // misura reale scelta (es. portrait:30x40)
  photo_url?: string | null
  title?: string
}

export type Format = 'square' | 'portrait' | 'landscape'
// decoro = come si caratterizza la copertina nel 3D
export type Decoro = 'plate' | 'ottone' | 'floral' | 'frame' | 'print' | 'photo' | 'swarovski' | 'strap'

export type PBR = {
  roughness: number; metalness: number; clearcoat?: number; clearcoatRoughness?: number
  reflectivity?: number; bumpScale: number; repeat: number; sheen?: number
}
export type ColorDef = { key: string; label: string; hex: string }
export type Material = { key: string; label: string; swatch: string; texture: string; pbr: PBR; colors: ColorDef[] }
export type Category = { key: string; label: string }
export type Model = { key: string; label: string; category: string; format: Format; decoro: Decoro; blurb: string; materials?: string[] }

// helper per costruire colori con chiave unica per materiale
const C = (mat: string, label: string, hex: string): ColorDef => ({ key: `${mat}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, hex })

// ---------------------------------------------------------------------------
// MATERIALI (pag. 115-127) — texture reale in /public/textures/materials/<key>.jpg
// ---------------------------------------------------------------------------
export const MATERIALS: Material[] = [
  { key: 'alcantara', label: 'Alcantara', texture: 'alcantara', swatch: '#e8d8c4',
    pbr: { roughness: 0.86, metalness: 0, clearcoat: 0, bumpScale: 0.04, repeat: 2.2, sheen: 0.4 },
    colors: [
      C('alcantara','Crema','#e8d8c4'), C('alcantara','Grigio Perla','#c4b8a8'), C('alcantara','Beige','#d4c49c'),
      C('alcantara','Cipria','#dcc4b0'), C('alcantara','Mogano','#8c6c54'), C('alcantara','Siena','#a87854'),
      C('alcantara','Giallo Ocra','#d4b878'), C('alcantara','Albicocca','#e8c89c'), C('alcantara','Arancio','#e89454'),
      C('alcantara','Orchidea','#cf8fc0'), C('alcantara','Rosso','#a8223c'), C('alcantara','Lime','#cdd86a'),
      C('alcantara','Smoke','#b8b0a0'), C('alcantara','Verde Acqua','#4cb878'), C('alcantara','Bluette','#2b7c9c'),
      C('alcantara','Grigio','#b8b8b8'),
    ] },
  { key: 'sequoia', label: 'Sequoia', texture: 'sequoia', swatch: '#c9a574',
    pbr: { roughness: 0.62, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.6, bumpScale: 0.05, repeat: 1.8 },
    colors: [
      C('sequoia','Camel','#c9a574'), C('sequoia','Nuage','#d4c4b0'), C('sequoia','Cielo','#b8d4e0'),
      C('sequoia','Aloe','#c4d8a4'), C('sequoia','Tortora','#d0c8bc'), C('sequoia','Terra','#c89a78'),
      C('sequoia','Cuoio','#a9722f'), C('sequoia','Mango','#e07a3c'), C('sequoia','Cioccolato','#5c4434'),
    ] },
  { key: 'acero', label: 'Acero', texture: 'acero', swatch: '#d4c09c',
    pbr: { roughness: 0.6, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.6, bumpScale: 0.05, repeat: 1.8 },
    colors: [
      C('acero','Naturale','#d4c09c'), C('acero','Grigio','#cfc7bf'), C('acero','Beige','#dcc8a8'),
      C('acero','Nocciola','#b8944c'), C('acero','Taupe','#9c8c78'), C('acero','Glicine','#b8a4d4'),
      C('acero','Ciliegio','#9a3a31'), C('acero','Celeste','#b8d8e8'), C('acero','Brown','#7c5c4c'),
      C('acero','Cioccolato','#5c3c2c'), C('acero','Nero','#2a2a2a'), C('acero','Blu','#1a3c6c'),
    ] },
  { key: 'pelle', label: 'Pelle', texture: 'pelle', swatch: '#e3d8c6',
    pbr: { roughness: 0.5, metalness: 0, clearcoat: 0.14, clearcoatRoughness: 0.5, bumpScale: 0.035, repeat: 2.0 },
    colors: [
      C('pelle','Bianco Neve','#f1ede6'), C('pelle','Ecru','#e3d8c6'), C('pelle','Tortora','#c8b8a8'),
      C('pelle','Gesso','#e0d8cc'), C('pelle','Gray','#cfcccc'), C('pelle','Confetto','#ecd0dc'),
      C('pelle','Orchidea','#b89cd4'), C('pelle','Rosso','#a8223c'), C('pelle','Dark Blue','#1a2b4a'),
      C('pelle','Nero','#262626'),
    ] },
  { key: 'velu-arte', label: 'Velù Artè', texture: 'velu-arte', swatch: '#f0e8dc',
    pbr: { roughness: 0.78, metalness: 0, clearcoat: 0, bumpScale: 0.05, repeat: 2.4, sheen: 0.8 },
    colors: [
      C('velu-arte','Panna','#f0e8dc'), C('velu-arte','Polvere','#d4c8b8'), C('velu-arte','Rosa Antico','#d89880'),
      C('velu-arte','Grigio','#d0d0cc'), C('velu-arte','Cielo','#c8d8d4'), C('velu-arte','Tortora','#b8a894'),
      C('velu-arte','Pavone','#1a8c6c'), C('velu-arte','Blu','#2b5b8c'), C('velu-arte','Smeraldo','#1a7c5c'),
    ] },
  { key: 'soft-touch', label: 'Soft Touch', texture: 'soft-touch', swatch: '#d4c09c',
    pbr: { roughness: 0.82, metalness: 0, clearcoat: 0, bumpScale: 0.025, repeat: 2.0 },
    colors: [
      C('soft-touch','Bianco','#f0f0f0'), C('soft-touch','Sabbia','#d4c09c'), C('soft-touch','Tortora','#b8b0a8'),
      C('soft-touch','Grigio','#d0c8c0'), C('soft-touch','Marrone','#7c6854'), C('soft-touch','Rosa','#f0d4e0'),
      C('soft-touch','Celeste','#c8e0f0'), C('soft-touch','Nero','#2a2a2a'),
    ] },
  { key: 'suade', label: 'Suade', texture: 'suade', swatch: '#c8c8c8',
    pbr: { roughness: 0.88, metalness: 0, clearcoat: 0, bumpScale: 0.05, repeat: 2.2, sheen: 0.5 },
    colors: [
      C('suade','Bianco','#f0f0f0'), C('suade','Crema','#e8d8c8'), C('suade','Grigio','#c8c8c8'),
      C('suade','Grafite','#6f6f6f'), C('suade','Bronzo','#9c8474'), C('suade','Cioccolato','#7c5644'),
      C('suade','Nero','#2a2a2a'),
    ] },
  { key: 'safir', label: 'Safir', texture: 'safir', swatch: '#d8c8a8',
    pbr: { roughness: 0.66, metalness: 0, clearcoat: 0.05, bumpScale: 0.04, repeat: 2.0 },
    colors: [
      C('safir','Pietra','#d8c8a8'), C('safir','Sabbia','#d4b894'), C('safir','Corda','#b89878'),
      C('safir','Terra','#c8a878'), C('safir','Grano','#a89454'), C('safir','Celeste','#7cb8d4'),
      C('safir','Acquamarina','#4ca8a8'), C('safir','Bluette','#2b7c9c'), C('safir','Verde','#5c8c4c'),
      C('safir','Tabacco','#7c5c4c'), C('safir','Moka','#6f5444'),
    ] },
  { key: 'crazy', label: 'Crazy', texture: 'crazy', swatch: '#a89878',
    pbr: { roughness: 0.55, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.45, bumpScale: 0.06, repeat: 1.6 },
    colors: [
      C('crazy','Bianco','#f0f0f0'), C('crazy','Grigio','#d0c8c0'), C('crazy','Camel','#d4b894'),
      C('crazy','Tortora','#a89878'), C('crazy','Verde','#7c9c54'), C('crazy','Cuoio','#7c5c4c'),
      C('crazy','Cioccolato','#5c3c2c'), C('crazy','Nero','#2a2a2a'),
    ] },
  { key: 'juta', label: 'Juta', texture: 'juta', swatch: '#e8d8c4',
    pbr: { roughness: 0.92, metalness: 0, clearcoat: 0, bumpScale: 0.07, repeat: 3.0 },
    colors: [
      C('juta','Neve','#f0e8dc'), C('juta','Platino','#d4c8b8'), C('juta','Canapa','#e8d8c4'),
      C('juta','Castagno','#a88c6c'), C('juta','Calendula','#e89854'), C('juta','Ciliegia','#b8223c'),
      C('juta','Tiffany','#7cb8b8'), C('juta','Turchese','#3cb8c8'), C('juta','Denim','#5c6c8c'),
    ] },
  { key: 'metal', label: 'Metal', texture: 'metal', swatch: '#d4b878',
    pbr: { roughness: 0.42, metalness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.25, reflectivity: 0.8, bumpScale: 0.03, repeat: 2.0 },
    colors: [
      C('metal','Silver','#e2e2e2'), C('metal','Gold','#d4b878'), C('metal','Crema','#e0d4bc'),
      C('metal','Sabbia','#d4c49c'), C('metal','Rosa','#f0c4d8'), C('metal','Celeste','#c8e0f0'),
      C('metal','Lavanda','#d4b8e0'), C('metal','Orchidea','#e0b8d8'), C('metal','Oceano','#2b4c6c'),
      C('metal','Corteccia','#9c6c54'),
    ] },
  { key: 'skill', label: 'Skill', texture: 'skill', swatch: '#d4c8a8',
    pbr: { roughness: 0.6, metalness: 0, clearcoat: 0.08, bumpScale: 0.04, repeat: 2.0 },
    colors: [
      C('skill','Bianco','#f0f0f0'), C('skill','Ecru','#d4c8a8'), C('skill','Aloe','#7ca84c'),
      C('skill','Grigio','#d0c8c0'), C('skill','Tortora','#b8a894'), C('skill','Rosso','#a8223c'),
      C('skill','Dark Blue','#1a2b4a'), C('skill','Testa di Moro','#3a2a22'), C('skill','Nero','#2a2a2a'),
    ] },
]

// ---------------------------------------------------------------------------
// CATEGORIE + MODELLI
// ---------------------------------------------------------------------------
export const CATEGORIES: Category[] = [
  { key: 'base', label: 'Classici' },
  { key: 'wood', label: 'Wood Collection' },
  { key: 'ottone', label: 'Ottone / Alluminio' },
  { key: 'sposi', label: 'Personalizzato Sposi' },
  { key: 'laserati', label: 'Laserati' },
  { key: 'stampati', label: 'Stampati' },
  { key: 'swarovski', label: 'Swarovski' },
  { key: 'eventi', label: 'Eventi' },
]

export const MODELS: Model[] = [
  // Classici (base, lavorazione rimboccata + piastrina logo) — il workhorse
  { key: 'rimboccato', label: 'Rimboccato 2', category: 'base', format: 'portrait', decoro: 'plate', blurb: 'Classico rimboccato con piastrina logo. Qualsiasi materiale.' },
  { key: 'blocco-libro', label: 'Blocco a Libro', category: 'base', format: 'portrait', decoro: 'plate', blurb: 'Rilegatura blocco a libro, copertina pulita.' },

  // Wood Collection (Pelle di Legno)
  { key: 'brand', label: 'Brand', category: 'wood', format: 'portrait', decoro: 'frame', blurb: 'Pelle di legno, cornice incisa.' },
  { key: 'trilogy', label: 'Trilogy', category: 'wood', format: 'portrait', decoro: 'photo', blurb: 'Trittico foto incassate.' },
  { key: 'almond', label: 'Almond', category: 'wood', format: 'portrait', decoro: 'plate', blurb: 'Pelle di legno con placca.' },
  { key: 'claire', label: 'Claire', category: 'wood', format: 'portrait', decoro: 'frame', blurb: 'Cornice incisa, pelle di legno.' },
  { key: 'thea', label: 'Thea', category: 'wood', format: 'portrait', decoro: 'frame', blurb: 'Decoro inciso essenziale.' },
  { key: 'adel', label: 'Adel', category: 'wood', format: 'portrait', decoro: 'plate', blurb: 'Placca centrale, pelle di legno.' },
  { key: 'elsie', label: 'Elsie', category: 'wood', format: 'portrait', decoro: 'plate', blurb: 'Placca, linea essenziale.' },

  // Ottone nichelato / Alluminio
  { key: 'vega', label: 'Vega', category: 'ottone', format: 'portrait', decoro: 'ottone', blurb: 'Iniziali in ottone nichelato.' },
  { key: 'diez', label: 'Diez', category: 'ottone', format: 'portrait', decoro: 'ottone', blurb: 'Placca ottone/alluminio.' },
  { key: 'comete', label: 'Comete', category: 'ottone', format: 'portrait', decoro: 'ottone', blurb: 'Placca metallo, decoro essenziale.' },
  { key: 'plaza', label: 'Plaza', category: 'ottone', format: 'portrait', decoro: 'ottone', blurb: 'Fascia/placca alluminio.' },

  // Personalizzato Sposi / Cristalwhite (foto in copertina)
  { key: 'andromeda', label: 'Andromeda', category: 'sposi', format: 'landscape', decoro: 'photo', blurb: 'Foto incassata, panoramico.' },
  { key: 'cassiopea', label: 'Cassiopea', category: 'sposi', format: 'landscape', decoro: 'photo', blurb: 'Foto a fascia, panoramico.' },
  { key: 'chloe', label: 'Chloe', category: 'sposi', format: 'portrait', decoro: 'photo', blurb: 'Foto personalizzata in copertina.' },
  { key: 'graphic-touch', label: 'Graphic Touch', category: 'sposi', format: 'portrait', decoro: 'photo', blurb: 'Grafica + foto personalizzata.' },
  { key: 'charme', label: 'Charme', category: 'sposi', format: 'portrait', decoro: 'photo', blurb: 'Cristalwhite, foto in copertina.' },
  { key: 'azulejo', label: 'Azulejo', category: 'sposi', format: 'portrait', decoro: 'photo', blurb: 'Cristalwhite decorato.' },
  { key: 'hera', label: 'Hera', category: 'sposi', format: 'portrait', decoro: 'photo', blurb: 'Cristalwhite, foto.' },
  { key: 'canvas', label: 'Canvas', category: 'sposi', format: 'portrait', decoro: 'photo', blurb: 'Stampa integrale su canvas.' },
  { key: 'frame-cristalplex', label: 'Frame Cristalplex', category: 'sposi', format: 'portrait', decoro: 'photo', blurb: 'Foto incassata in plexi.' },
  { key: 'frame-plexy', label: 'Frame Plexy', category: 'sposi', format: 'portrait', decoro: 'photo', blurb: 'Cornice plexi lucida.' },

  // Laserati
  { key: 'betulla', label: 'Betulla', category: 'laserati', format: 'portrait', decoro: 'frame', blurb: 'Incisione laser.' },
  { key: 'dream', label: 'Dream', category: 'laserati', format: 'portrait', decoro: 'frame', blurb: 'Decoro laser onirico.' },

  // Stampati
  { key: 'amelie', label: 'Amelie', category: 'stampati', format: 'portrait', decoro: 'print', blurb: 'Stampa decorativa all-over.' },
  { key: 'darling', label: 'Darling', category: 'stampati', format: 'portrait', decoro: 'print', blurb: 'Motivo stampato.' },
  { key: 'sirene', label: 'Sirene', category: 'stampati', format: 'portrait', decoro: 'print', blurb: 'Onde e intrecci stampati.' },
  { key: 'frejus', label: 'Frejus', category: 'stampati', format: 'portrait', decoro: 'print', blurb: 'Stampa geometrica.' },
  { key: 'dhyana', label: 'Dhyana', category: 'stampati', format: 'portrait', decoro: 'print', blurb: 'Volute stampate a secco.' },

  // Swarovski
  { key: 'diez-sw', label: 'Diez Swarovski', category: 'swarovski', format: 'portrait', decoro: 'swarovski', blurb: 'Placca con cristalli Swarovski.' },
  { key: 'xante-sw', label: 'Xante Swarovski', category: 'swarovski', format: 'portrait', decoro: 'swarovski', blurb: 'Decoro cristalli Swarovski.' },
  { key: 'bouquet-sw', label: 'Bouquet Swarovski', category: 'swarovski', format: 'portrait', decoro: 'swarovski', blurb: 'Bouquet di cristalli.' },
  { key: 'ninfea-sw', label: 'Ninfea Swarovski', category: 'swarovski', format: 'portrait', decoro: 'swarovski', blurb: 'Floreale + cristalli.' },

  // Eventi (bimbi, comunioni, 18°, compleanni) — canvas/foto tematica
  { key: 'bimbi', label: 'Bimbi (Canvas)', category: 'eventi', format: 'portrait', decoro: 'photo', blurb: 'Linea bimbi, stampa integrale tematica.' },
  { key: 'comunione', label: 'Comunione', category: 'eventi', format: 'portrait', decoro: 'photo', blurb: 'Canvas comunione.' },
  { key: 'diciottesimo', label: '18° / Evento', category: 'eventi', format: 'portrait', decoro: 'photo', blurb: 'Evento, foto in copertina.' },
]

// ---------------------------------------------------------------------------
// BOX / CONTENITORI (Packaging, pag. 97-113). Specifiche dimensionali: da definire.
// ---------------------------------------------------------------------------
export type Box = { key: string; label: string; blurb: string }
export const BOXES: Box[] = [
  { key: 'nessuno', label: 'Nessuna', blurb: 'Album senza contenitore.' },
  { key: 'wood-clak', label: 'Wood Clak', blurb: 'Cofanetto in legno, apertura a clak.' },
  { key: 'wood-duo', label: 'Wood Duo', blurb: 'Box legno per album + parentale.' },
  { key: 'wood-case', label: 'Wood Case', blurb: 'Custodia legno, anche trasparente.' },
  { key: 'twin-box', label: 'Twin Box', blurb: 'Box doppio (album + USB).' },
  { key: 'valigetta', label: 'Valigetta / Scatola', blurb: 'Valigetta rivestita o scatola.' },
]

// ---------------------------------------------------------------------------
// FORMATI + MISURE reali (tabella pag. 66 del catalogo). Scelta PRIMARIA.
// ---------------------------------------------------------------------------
export type SizeDef = { key: string; label: string; w: number; h: number } // cm
export type FormatDef = { key: Format; label: string; hint: string; sizes: SizeDef[] }
const S = (fmt: string, w: number, h: number): SizeDef => ({ key: `${fmt}:${w}x${h}`, label: `${w}×${h} cm`, w, h })
export const FORMATS: FormatDef[] = [
  { key: 'portrait', label: 'Verticale', hint: 'Ritratti, sposi in piedi', sizes: [
    S('portrait',15,20), S('portrait',20,30), S('portrait',22.5,30), S('portrait',25,35), S('portrait',30,40), S('portrait',35,45),
  ] },
  { key: 'landscape', label: 'Orizzontale', hint: 'Paesaggi, doppie pagine', sizes: [
    S('landscape',20,15), S('landscape',24,18), S('landscape',30,20), S('landscape',35,25), S('landscape',35,30), S('landscape',40,30), S('landscape',45,35),
  ] },
  { key: 'square', label: 'Quadrato', hint: 'Equilibrato, moderno', sizes: [
    S('square',15,15), S('square',20,20), S('square',25,25), S('square',30,30), S('square',35,35), S('square',38,38), S('square',40,40),
  ] },
]
export const sizeByKey = (k?: string): SizeDef | undefined => {
  for (const f of FORMATS) { const s = f.sizes.find((x) => x.key === k); if (s) return s }
  return undefined
}
export const sizesForFormat = (f?: Format): SizeDef[] => FORMATS.find((x) => x.key === f)?.sizes ?? []
export const formatLabel = (f?: Format): string => FORMATS.find((x) => x.key === f)?.label || '—'
export const defaultSizeKey = (f: Format): string => {
  const fav: Record<Format, string> = { portrait: 'portrait:30x40', landscape: 'landscape:40x30', square: 'square:30x30' }
  return fav[f]
}
// dimensioni 3D (unità scena) derivate dalla misura reale scelta → proporzioni vere
export function coverDims(cover?: Cover): { w: number; h: number; d: number } {
  let rw = 22.5, rh = 30
  const s = sizeByKey(cover?.sizeKey)
  if (s) { rw = s.w; rh = s.h }
  else {
    const f = cover?.format || modelByKey(cover?.model)?.format || 'portrait'
    if (f === 'landscape') { rw = 40; rh = 30 } else if (f === 'square') { rw = 30; rh = 30 } else { rw = 22.5; rh = 30 }
  }
  const k = 2.85 / Math.max(rw, rh)
  // spessore album ~ cresce un filo coi formati grandi
  const d = 0.42 + Math.min(0.18, (Math.max(rw, rh) - 20) * 0.006)
  return { w: rw * k, h: rh * k, d }
}
export const coverFormat = (cover?: Cover): Format =>
  cover?.format || sizeByKey(cover?.sizeKey)?.key.split(':')[0] as Format || modelByKey(cover?.model)?.format || 'portrait'

// ---- lookup ----
const _colorMap: Record<string, ColorDef> = {}
for (const m of MATERIALS) for (const c of m.colors) _colorMap[c.key] = c
export const COLORS = _colorMap

export const materialByKey = (k?: string): Material | undefined => MATERIALS.find((m) => m.key === k)
export const modelByKey = (k?: string): Model | undefined => MODELS.find((m) => m.key === k)
export const boxByKey = (k?: string): Box | undefined => BOXES.find((b) => b.key === k)
export const categoryLabel = (k?: string): string => CATEGORIES.find((c) => c.key === k)?.label || k || ''

export function materialsForModel(modelKey?: string): Material[] {
  const m = modelByKey(modelKey)
  if (!m?.materials) return MATERIALS
  return MATERIALS.filter((x) => m.materials!.includes(x.key))
}
export function paletteFor(materialKey?: string): ColorDef[] {
  return materialByKey(materialKey)?.colors ?? []
}
export const modelsByCategory = (cat: string): Model[] => MODELS.filter((m) => m.category === cat)

// etichette leggibili per FotoLab
export const modelLabel = (k?: string) => modelByKey(k)?.label || k || '—'
export const materialLabel = (k?: string) => materialByKey(k)?.label || k || '—'
export const colorLabel = (cover: Pick<Cover, 'colorKey' | 'color'>) =>
  (cover.colorKey && COLORS[cover.colorKey]?.label) || (cover.color ? 'Personalizzato' : '—')
export const boxLabel = (k?: string) => boxByKey(k)?.label || (k && k !== 'nessuno' ? k : '—')

export function coverSummary(cover?: Cover): string {
  if (!cover) return '—'
  const parts = [modelLabel(cover.model), materialLabel(cover.fabric), colorLabel(cover)]
  if (cover.box && cover.box !== 'nessuno') parts.push(`box ${boxLabel(cover.box)}`)
  return parts.join(' · ')
}
