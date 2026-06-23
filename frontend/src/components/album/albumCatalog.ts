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
  // --- ordine completo (calcolatore) ---
  pages?: number           // n. interni (fogli)
  blockType?: 'photo' | 'bookflat'  // blocco digitale fotografico / book flat cartoncino
  parents?: boolean        // album genitori (2 mini)
  finishes?: string[]      // rifiniture: swarovski|targhetta|iniziali|data|logo
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
export type ColorDef = { key: string; label: string; hex: string; tex?: string }
export type Material = { key: string; label: string; swatch: string; texture: string; pbr: PBR; colors: ColorDef[]; albedo?: boolean }
export type Category = { key: string; label: string }
export type Model = { key: string; label: string; category: string; format: Format; decoro: Decoro; blurb: string; materials?: string[] }

// helper per costruire colori con chiave unica per materiale
const C = (mat: string, label: string, hex: string): ColorDef => ({ key: `${mat}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, hex })
// colore-essenza legno (albedo fotografico reale, texture Higgsfield)
const Cw = (label: string, hex: string, tex: string): ColorDef => ({ key: `wood:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, hex, tex })

// ---------------------------------------------------------------------------
// MATERIALI (pag. 115-127) — texture reale in /public/textures/materials/<key>.jpg
// ---------------------------------------------------------------------------
export const MATERIALS: Material[] = [
  { key: 'wood', label: 'Legno (Wood)', texture: 'acero', swatch: '#8a5c38', albedo: true,
    pbr: { roughness: 0.5, metalness: 0, clearcoat: 0.14, clearcoatRoughness: 0.4, bumpScale: 0.05, repeat: 1 },
    colors: [
      Cw('Noce', '#8a5c38', '/textures/wood/noce.jpg'),
      Cw('Rovere', '#c79a63', '/textures/wood/rovere.jpg'),
      Cw('Ciliegio', '#a0512f', '/textures/wood/ciliegio.jpg'),
      Cw('Okumè', '#c98a5e', '/textures/wood/okume.jpg'),
      Cw('Moka', '#4a3526', '/textures/wood/moka.jpg'),
      Cw('Ulivo', '#8a7a4a', '/textures/wood/ulivo.jpg'),
    ] },
  { key: 'alcantara', label: 'Alcantara', texture: 'alcantara', swatch: '#e8d8c4',
    pbr: { roughness: 0.86, metalness: 0, clearcoat: 0, bumpScale: 0.04, repeat: 2.2, sheen: 0.4 },
    colors: [
      C('alcantara','Crema','#f0e1c8'),
      C('alcantara','Grigio Perla','#e7daca'),
      C('alcantara','Beige','#f0dfbf'),
      C('alcantara','Cipria','#f2d9bb'),
      C('alcantara','Mogano','#c28f66'),
      C('alcantara','Siena','#885d4a'),
      C('alcantara','Giallo Ocra','#e2b466'),
      C('alcantara','Albicocca','#dda16f'),
      C('alcantara','Pesca','#c5896d'),
      C('alcantara','Arancio','#d67227'),
      C('alcantara','Geranio','#d86045'),
      C('alcantara','Orchidea','#de5c8e'),
      C('alcantara','Rosso','#d82d43'),
      C('alcantara','Malva','#d2667c'),
      C('alcantara','Lime','#e7e082'),
      C('alcantara','Smoke','#e9dcc1'),
      C('alcantara','Verde Acqua','#6f9a77'),
      C('alcantara','Bluette','#1c5367'),
      C('alcantara','Grigio','#979292'),
    ] },
  { key: 'sequoia', label: 'Sequoia', texture: 'sequoia', swatch: '#c9a574',
    pbr: { roughness: 0.62, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.6, bumpScale: 0.05, repeat: 1.8 },
    colors: [
      C('sequoia','Camel','#e2d1b5'),
      C('sequoia','Nuage','#edc7b4'),
      C('sequoia','Pietra','#bdb5a9'),
      C('sequoia','Aloe','#b7ba7f'),
      C('sequoia','Cielo','#b6c9cf'),
      C('sequoia','Tormalina','#818f8f'),
      C('sequoia','Terra','#ba845c'),
      C('sequoia','Mango','#65493e'),
      C('sequoia','Cuoio','#c7ba99'),
      C('sequoia','Cioccolato','#beb18b'),
    ] },
  { key: 'acero', label: 'Acero', texture: 'acero', swatch: '#d4c09c',
    pbr: { roughness: 0.6, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.6, bumpScale: 0.1, repeat: 1.8 },
    colors: [
      C('acero','Grigio','#d3d4ce'),
      C('acero','Beige','#cabdad'),
      C('acero','Nocciola','#c4aa9d'),
      C('acero','Taupe','#93867d'),
      C('acero','Naturale','#d8b189'),
      C('acero','Glicine','#8682b7'),
      C('acero','Pink','#be6d9b'),
      C('acero','Ciliegio','#c8895d'),
      C('acero','Celeste','#a3c4ec'),
      C('acero','Rosa','#fdbbb3'),
      C('acero','Brown','#766157'),
      C('acero','Azzurro','#078ca1'),
      C('acero','Verde','#c8c459'),
      C('acero','Chocolate','#4c463c'),
      C('acero','Cobalto','#0969b4'),
      C('acero','Giallo','#fdbe4f'),
      C('acero','Nero','#45413b'),
      C('acero','Blu','#3a63a0'),
      C('acero','Arancio','#e57c52'),
    ] },
  { key: 'pelle', label: 'Pelle', texture: 'pelle', swatch: '#e3d8c6',
    pbr: { roughness: 0.5, metalness: 0, clearcoat: 0.14, clearcoatRoughness: 0.5, bumpScale: 0.035, repeat: 2.0 },
    colors: [
      C('pelle','Ecru','#9b8975'),
      C('pelle','Bianco Neve','#dad2c8'),
      C('pelle','Tortora','#685447'),
      C('pelle','Gesso','#ada59a'),
      C('pelle','Rosso','#920030'),
      C('pelle','Gray','#bbb2a2'),
      C('pelle','Dark Blue','#050a1c'),
      C('pelle','Confetto','#d5b3b1'),
      C('pelle','Nero','#191813'),
      C('pelle','Orchidea','#684661'),
    ] },
  { key: 'velu-arte', label: 'Velù Artè', texture: 'velu-arte', swatch: '#f0e8dc',
    pbr: { roughness: 0.78, metalness: 0, clearcoat: 0, bumpScale: 0.05, repeat: 2.4, sheen: 0.8 },
    colors: [
      C('velu-arte','Panna','#d5cfbc'),
      C('velu-arte','Polvere','#a29486'),
      C('velu-arte','Rosa Antico','#b69389'),
      C('velu-arte','Grigio','#888882'),
      C('velu-arte','Cielo','#a6b0ab'),
      C('velu-arte','Tortora','#5e5342'),
      C('velu-arte','Aloe','#086940'),
      C('velu-arte','Pavone','#065e54'),
      C('velu-arte','Blue','#1f4a77'),
      C('velu-arte','Smeraldo','#000000'),
    ] },
  { key: 'soft-touch', label: 'Soft Touch', texture: 'soft-touch', swatch: '#d4c09c',
    pbr: { roughness: 0.82, metalness: 0, clearcoat: 0, bumpScale: 0.025, repeat: 2.0 },
    colors: [
      C('soft-touch','Bianco','#d4d0c6'),
      C('soft-touch','Tortora','#31241c'),
      C('soft-touch','Grigio','#9f9287'),
      C('soft-touch','Marrone','#170e0c'),
      C('soft-touch','Sabbia','#a38c76'),
      C('soft-touch','Nero','#080808'),
      C('soft-touch','Rosa','#efcfdc'),
      C('soft-touch','Celeste','#cfe2f0'),
    ] },
  { key: 'suade', label: 'Suade', texture: 'suade', swatch: '#c8c8c8',
    pbr: { roughness: 0.88, metalness: 0, clearcoat: 0, bumpScale: 0.05, repeat: 2.2, sheen: 0.5 },
    colors: [
      C('suade','Grafite','#b1a672'),
      C('suade','Bianco','#dcd6cc'),
      C('suade','Grigio','#96884d'),
      C('suade','Crema','#b89d82'),
      C('suade','Nero','#999065'),
      C('suade','Bronzo','#726356'),
      C('suade','Chocolate','#a69e70'),
    ] },
  { key: 'safir', label: 'Safir', texture: 'safir', swatch: '#d8c8a8',
    pbr: { roughness: 0.66, metalness: 0, clearcoat: 0.05, bumpScale: 0.09, repeat: 2.0 },
    colors: [
      C('safir','Petra','#628e79'),
      C('safir','Sabbia','#7ca692'),
      C('safir','Celeste','#1f362c'),
      C('safir','Terra','#c9a878'),
      C('safir','Grano','#a2774f'),
      C('safir','Bluette','#092838'),
      C('safir','Corda','#fcfbfb'),
      C('safir','Mele','#73452b'),
      C('safir','Acquamarina','#20644e'),
      C('safir','Carta da Zucchero','#b9c6d2'),
      C('safir','Tortora','#53352c'),
      C('safir','Verde','#2b201a'),
      C('safir','Rosa','#351f10'),
      C('safir','Tabacco','#312222'),
      C('safir','Grigio','#1c110c'),
      C('safir','Moka','#fdfcfa'),
    ] },
  { key: 'crazy', label: 'Crazy', texture: 'crazy', swatch: '#a89878',
    pbr: { roughness: 0.55, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.45, bumpScale: 0.1, repeat: 1.6 },
    colors: [
      C('crazy','Bianco','#ebeae6'),
      C('crazy','Grigio','#c4c4c4'),
      C('crazy','Naturale','#ceb194'),
      C('crazy','Camel','#d2b08b'),
      C('crazy','Verde','#6d5e41'),
      C('crazy','Tortora','#77533c'),
      C('crazy','Cuoio','#8a5b42'),
      C('crazy','Cioccolato','#543925'),
      C('crazy','Blu','#050507'),
      C('crazy','Nero','#372d23'),
    ] },
  { key: 'juta', label: 'Juta', texture: 'juta', swatch: '#e8d8c4',
    pbr: { roughness: 0.92, metalness: 0, clearcoat: 0, bumpScale: 0.16, repeat: 2.2 },
    colors: [
      C('juta','Neve','#ced0bb'),
      C('juta','Platino','#bcbdb2'),
      C('juta','Canapa','#3b4c42'),
      C('juta','Castano','#645748'),
      C('juta','Calendula','#7c9088'),
      C('juta','Ciliegia','#6d1b23'),
      C('juta','Tiffany','#6f6b2f'),
      C('juta','Turchese','#414f5a'),
      C('juta','Trifoglio','#60b6bf'),
      C('juta','Denim','#071c1f'),
    ] },
  { key: 'metal', label: 'Metal', texture: 'metal', swatch: '#d4b878',
    pbr: { roughness: 0.42, metalness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.25, reflectivity: 0.8, bumpScale: 0.03, repeat: 2.0 },
    colors: [
      C('metal','Silver','#0d3d5b'),
      C('metal','Crema','#154868'),
      C('metal','Sabbia','#cfd1ce'),
      C('metal','Gold','#d4b878'),
      C('metal','Rosa','#061722'),
      C('metal','Celeste','#c3b18a'),
      C('metal','Lavanda','#cccbd9'),
      C('metal','Orchidea','#e0becf'),
      C('metal','Oceano','#325369'),
      C('metal','Corteccia','#52362a'),
    ] },
  { key: 'skill', label: 'Skill', texture: 'skill', swatch: '#d4c8a8',
    pbr: { roughness: 0.6, metalness: 0, clearcoat: 0.08, bumpScale: 0.04, repeat: 2.0 },
    colors: [
      C('skill','Aloe','#475227'),
      C('skill','Bianco','#d7d3cd'),
      C('skill','Rosso','#750329'),
      C('skill','Grigio','#998e92'),
      C('skill','Testa di Moro','#190f0e'),
      C('skill','Gesso','#d7cdc3'),
      C('skill','Dark Blue','#132333'),
      C('skill','Ecru','#a4988a'),
      C('skill','Nero','#0d0d0c'),
      C('skill','Tortora','#695c54'),
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
  { key: 'famiglia', label: 'Famiglia' },
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

  // Famiglia — album da conservare in casa, ritratti di famiglia
  { key: 'family-classic', label: 'Famiglia Classico', category: 'famiglia', format: 'portrait', decoro: 'plate', blurb: 'Album di famiglia rimboccato con placca. Qualsiasi materiale.' },
  { key: 'family-canvas', label: 'Famiglia Foto', category: 'famiglia', format: 'landscape', decoro: 'photo', blurb: 'Ritratto di famiglia in copertina.' },
  { key: 'family-frame', label: 'Famiglia Cornice', category: 'famiglia', format: 'portrait', decoro: 'frame', blurb: 'Cornice incisa, per generazioni.' },
  { key: 'family-wood', label: 'Famiglia Wood', category: 'famiglia', format: 'square', decoro: 'frame', blurb: 'Pelle di legno, formato quadrato.' },
]

// ---------------------------------------------------------------------------
// LAYOUT per modello (fedele alle schede 2D) → guida il 3D.
// ---------------------------------------------------------------------------
export type Layout =
  | 'plate' | 'plain' | 'monogram' | 'fascia' | 'fascia-ornament' | 'oblique'
  | 'swarovski-line' | 'swarovski-cluster' | 'photo-vertical' | 'photo-panoramic'
  | 'photo-small' | 'photo-full' | 'trilogy' | 'print' | 'laser'
export const MODEL_LAYOUT: Record<string, Layout> = {
  rimboccato: 'plate', 'blocco-libro': 'plain',
  brand: 'monogram', trilogy: 'trilogy', almond: 'oblique', claire: 'fascia', thea: 'laser', adel: 'plate', elsie: 'photo-small',
  vega: 'monogram', diez: 'swarovski-line', comete: 'fascia-ornament', plaza: 'fascia',
  andromeda: 'photo-vertical', cassiopea: 'photo-panoramic', chloe: 'photo-vertical', 'graphic-touch': 'photo-small',
  charme: 'photo-vertical', azulejo: 'print', hera: 'photo-panoramic', canvas: 'photo-full',
  'frame-cristalplex': 'photo-vertical', 'frame-plexy': 'photo-vertical',
  betulla: 'laser', dream: 'laser',
  amelie: 'print', darling: 'print', sirene: 'print', frejus: 'print', dhyana: 'print',
  'diez-sw': 'swarovski-line', 'xante-sw': 'swarovski-cluster', 'bouquet-sw': 'swarovski-cluster', 'ninfea-sw': 'swarovski-cluster',
  bimbi: 'photo-full', comunione: 'photo-full', diciottesimo: 'photo-vertical',
  'family-classic': 'plate', 'family-canvas': 'photo-panoramic', 'family-frame': 'laser', 'family-wood': 'laser',
}
const _decoroToLayout: Record<Decoro, Layout> = { plate: 'plate', ottone: 'plate', floral: 'laser', frame: 'laser', print: 'print', photo: 'photo-vertical', swarovski: 'swarovski-cluster', strap: 'plate' }
export function modelLayout(k?: string): Layout {
  if (k && MODEL_LAYOUT[k]) return MODEL_LAYOUT[k]!
  const d = modelByKey(k)?.decoro
  return d ? _decoroToLayout[d] : 'plate'
}
// modelli che di default montano il LEGNO (Wood Collection / Ottone su legno / Swarovski su legno)
export const WOOD_MODELS = new Set<string>([
  'brand', 'trilogy', 'almond', 'claire', 'thea', 'adel', 'elsie',
  'vega', 'diez', 'comete', 'plaza', 'andromeda', 'cassiopea',
  'diez-sw', 'xante-sw', 'family-canvas', 'family-frame', 'family-wood',
])
export const isWoodModel = (k?: string): boolean => !!k && WOOD_MODELS.has(k)

// mockup FOTOREALISTICI (Higgsfield) per modello — anteprima reale fedele alle schede
export const MODEL_MOCKUP: Record<string, boolean> = {
  claire: true, comete: true, almond: true, brand: true, trilogy: true, vega: true,
  'diez-sw': true, andromeda: true, rimboccato: true,
  cassiopea: true, elsie: true, amelie: true, betulla: true, hera: true, canvas: true, 'bouquet-sw': true, adel: true,
}
export const mockupFor = (k?: string): string | null => (k && MODEL_MOCKUP[k]) ? `/textures/mockups/${k}.jpg` : null

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
  const d = 0.56 + Math.min(0.26, (Math.max(rw, rh) - 20) * 0.009)
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

// ---------------------------------------------------------------------------
// LISTINO REALE DesignAlbum (in vigore 15/02/2022 — listino 30/03/2022).
// Prezzo copertina = TIER del modello (BASIC/ROYAL/PRIME/TOP) × GRUPPO materiale
// × MISURA. + box (packaging) + personalizzazioni + copie. Tutti i numeri reali.
// ---------------------------------------------------------------------------
export type Tier = 'BASIC' | 'ROYAL' | 'PRIME' | 'TOP'
// tier per modello (dalla colonna TIP. del listino, pag.1-3)
export const MODEL_TIER: Record<string, Tier> = {
  rimboccato: 'BASIC', 'blocco-libro': 'BASIC',
  brand: 'ROYAL', trilogy: 'ROYAL', almond: 'PRIME', claire: 'TOP', thea: 'TOP', adel: 'PRIME', elsie: 'ROYAL',
  vega: 'TOP', diez: 'ROYAL', comete: 'ROYAL', plaza: 'ROYAL',
  andromeda: 'ROYAL', cassiopea: 'ROYAL', chloe: 'ROYAL', 'graphic-touch': 'ROYAL', charme: 'ROYAL',
  azulejo: 'ROYAL', hera: 'ROYAL', canvas: 'BASIC', 'frame-cristalplex': 'ROYAL', 'frame-plexy': 'ROYAL',
  betulla: 'ROYAL', dream: 'ROYAL',
  amelie: 'BASIC', darling: 'BASIC', sirene: 'BASIC', frejus: 'ROYAL', dhyana: 'ROYAL',
  'diez-sw': 'TOP', 'xante-sw': 'ROYAL', 'bouquet-sw': 'ROYAL', 'ninfea-sw': 'ROYAL',
  bimbi: 'BASIC', comunione: 'BASIC', diciottesimo: 'ROYAL',
  'family-classic': 'BASIC', 'family-canvas': 'ROYAL', 'family-frame': 'ROYAL', 'family-wood': 'ROYAL',
}
export const modelTier = (k?: string): Tier => (k && MODEL_TIER[k]) || 'BASIC'
// gruppo materiale (4 listini): A=base, B, C, D=sequoia
const MATERIAL_GROUP: Record<string, 'A' | 'B' | 'C' | 'D'> = {
  wood: 'A', juta: 'A', skill: 'A', safir: 'A', alcantara: 'A', acero: 'A',
  'soft-touch': 'B', suade: 'B', metal: 'B', crazy: 'B',
  pelle: 'C', 'velu-arte': 'C', sequoia: 'D',
}
// prezzo gruppo A per colonna-misura × tier [BASIC,ROYAL,PRIME,TOP] (pag.1-3)
const GROUP_A: number[][] = [
  [30, 40, 50, 60],   // 0  15x20 / 15x15
  [30, 40, 50, 60],   // 1  20x15
  [35, 45, 55, 65],   // 2  20x20 / 25x25
  [45, 55, 65, 75],   // 3  20x30
  [45, 55, 65, 75],   // 4  22x30 / 24x18
  [55, 65, 75, 85],   // 5  30x20
  [60, 70, 80, 90],   // 6  30x30
  [80, 105, 115, 125],// 7  25x35 / 35x25
  [90, 115, 125, 135],// 8  35x30 / 35x35
  [125, 150, 160, 170],// 9 30x40
  [115, 140, 150, 160],// 10 40x30
  [115, 140, 150, 160],// 11
  [140, 165, 175, 185],// 12 35x45 / 45x35
  [140, 165, 175, 185],// 13 38x38
  [150, 175, 185, 195],// 14 40x40
]
const GROUP_SUPP: Record<'A' | 'B' | 'C' | 'D', number> = { A: 0, B: 10, C: 30, D: 40 }
const SIZE_COL: Record<string, number> = {
  'portrait:15x20': 0, 'portrait:20x30': 3, 'portrait:22.5x30': 4, 'portrait:25x35': 7, 'portrait:30x40': 9, 'portrait:35x45': 12,
  'landscape:20x15': 1, 'landscape:24x18': 4, 'landscape:30x20': 5, 'landscape:35x25': 7, 'landscape:35x30': 8, 'landscape:40x30': 10, 'landscape:45x35': 12,
  'square:15x15': 0, 'square:20x20': 2, 'square:25x25': 2, 'square:30x30': 6, 'square:35x35': 8, 'square:38x38': 13, 'square:40x40': 14,
}
// box (packaging) — prezzo ~30x40 ROYAL (pag.5-7), scalato per misura
const BOX_REF: Record<string, number> = { nessuno: 0, 'wood-clak': 110, 'wood-duo': 90, 'wood-case': 100, 'twin-box': 110, valigetta: 40 }
const TIDX: Record<Tier, number> = { BASIC: 0, ROYAL: 1, PRIME: 2, TOP: 3 }
// blocco interno: prezzo per facciata (pag.8). photo = stampa+montaggio LUX; book = cartoncino book-flat
const PHOTO_UNIT = [1.3, 1.4, 1.5, 2.7, 2.7, 3, 3.2, 3.7, 3.9, 4.6, 3.7, 4.2, 6.5, 6, 5.5]
const BOOK_UNIT = [1, 1, 1, 1.5, 1.5, 1.5, 2, 2, 2, 2.5, 2, 2, 2.5, 2.5, 2.5]
// album genitori (2 mini, coppia ~ incl. blocco) — stima da listino coordinati per gruppo
const MINI_SUPP: Record<'A' | 'B' | 'C' | 'D', number> = { A: 60, B: 75, C: 95, D: 110 }
// rifiniture / personalizzazioni (pag.9)
export const FINISHES: { key: string; label: string; amount: number }[] = [
  { key: 'swarovski', label: 'Linea/decoro Swarovski', amount: 30 },
  { key: 'targhetta', label: 'Targhetta ottone (Diez/Plaza)', amount: 30 },
  { key: 'iniziali', label: 'Iniziali ottone nichelato (2)', amount: 36 },
  { key: 'data', label: 'Aggiunta data', amount: 10 },
  { key: 'logo', label: 'Logo da catalogo', amount: 20 },
]

export const PRICING = { extraCopyFactor: 0.45, logoFromCatalog: 20, dataSposo: 10 }

export type PriceLine = { label: string; amount: number }
export type PriceBreakdown = { lines: PriceLine[]; unit: number; copies: number; total: number; tier: Tier }

export function coverPrice(cover?: Cover, copies = 1): PriceBreakdown {
  const tier = modelTier(cover?.model)
  const group = (cover?.fabric && MATERIAL_GROUP[cover.fabric]) || 'A'
  const col = SIZE_COL[cover?.sizeKey || ''] ?? 9
  const base = (GROUP_A[col]?.[TIDX[tier]] ?? 150) + GROUP_SUPP[group]
  const lines: PriceLine[] = [
    { label: `Copertina ${modelLabel(cover?.model)} · ${tier}`, amount: base },
  ]
  // pagine interne (blocco)
  const pages = cover?.pages ?? 40
  const bt = cover?.blockType ?? 'photo'
  const unitP = (bt === 'photo' ? PHOTO_UNIT[col] : BOOK_UNIT[col]) ?? 4
  const pagesAmt = Math.round(unitP * pages)
  lines.push({ label: `Pagine interne · ${pages} (${bt === 'photo' ? 'stampa foto' : 'book flat'})`, amount: pagesAmt })
  // box
  let boxAmt = 0
  if (cover?.box && cover.box !== 'nessuno') {
    const ref = BOX_REF[cover.box] ?? 0
    boxAmt = Math.round((ref * ((GROUP_A[col]?.[1] ?? 150) / 150)) / 5) * 5
    lines.push({ label: `Box ${boxLabel(cover.box)}`, amount: boxAmt })
  }
  // album genitori (2 mini)
  let parAmt = 0
  if (cover?.parents) { parAmt = MINI_SUPP[group]; lines.push({ label: 'Album genitori (2 mini)', amount: parAmt }) }
  // rifiniture
  let finAmt = 0
  for (const f of cover?.finishes ?? []) {
    const def = FINISHES.find((x) => x.key === f)
    if (def) { finAmt += def.amount; lines.push({ label: def.label, amount: def.amount }) }
  }
  const unit = base + pagesAmt + boxAmt + parAmt + finAmt
  const n = Math.max(1, copies)
  let total = unit
  if (n > 1) {
    const extra = Math.round((base + pagesAmt) * PRICING.extraCopyFactor) * (n - 1)
    lines.push({ label: `${n - 1} copia/e aggiuntiva/e`, amount: extra })
    total = unit + extra
  }
  return { lines, unit, copies: n, total, tier }
}
export const euro = (n: number) => `€ ${n.toLocaleString('it-IT')}`
