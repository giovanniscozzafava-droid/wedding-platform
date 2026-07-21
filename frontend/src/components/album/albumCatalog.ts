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
  subtitle?: string
  monogram?: string
  fontKey?: CoverFontKey
  textLayout?: CoverTextLayout
  decorationKey?: CoverDecorationKey
  borderKey?: CoverBorderKey
  textColor?: string
  accentColor?: string
}

export type Format = 'square' | 'portrait' | 'landscape'
export type Tier = 'BASIC' | 'ROYAL' | 'PRIME' | 'TOP'
export type CoverFontKey = 'fraunces' | 'baskerville' | 'bodoni' | 'script' | 'modern' | 'smallcaps'
export type CoverTextLayout = 'model' | 'center' | 'bottom' | 'plate' | 'split'
export type CoverDecorationKey = 'none' | 'divider' | 'botanical' | 'laurel' | 'flourish' | 'hearts' | 'sparkles' | 'wreath'
export type CoverBorderKey = 'none' | 'hairline' | 'double' | 'greca' | 'floral-corners' | 'art-deco' | 'pearls'
// decoro = come si caratterizza la copertina nel 3D
export type Decoro = 'plate' | 'ottone' | 'floral' | 'frame' | 'print' | 'photo' | 'swarovski' | 'strap'

export type PBR = {
  roughness: number; metalness: number; clearcoat?: number; clearcoatRoughness?: number
  reflectivity?: number; bumpScale: number; repeat: number; sheen?: number
}
export type ColorDef = { key: string; label: string; hex: string; tex?: string }
export type Material = { key: string; label: string; swatch: string; texture: string; pbr: PBR; colors: ColorDef[]; albedo?: boolean }
export type Category = { key: string; label: string }
export type Model = {
  key: string
  label: string
  category: string
  format: Format
  decoro: Decoro
  blurb: string
  tier: Tier
  priceA: (number | null)[]
  materials?: string[]
  variant?: string
  source: 'LISTINO 30 MARZO 2022-1.pdf'
}

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
  // Cristalwhite (pag.58) — superficie liscia satinata bianca, base di molti modelli sposi/laserati/swarovski
  { key: 'cristalwhite', label: 'Cristalwhite', texture: 'cristalwhite', swatch: '#f1ece1',
    pbr: { roughness: 0.34, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.4, reflectivity: 0.5, bumpScale: 0.012, repeat: 1.6 },
    colors: [
      C('cristalwhite','Bianco Puro','#f5f3ed'),
      C('cristalwhite','Perla','#efebe0'),
      C('cristalwhite','Avorio','#efe7d6'),
      C('cristalwhite','Latte','#f1ece1'),
      C('cristalwhite','Ecrù Chiaro','#ece3d2'),
      C('cristalwhite','Ghiaccio','#e7e8e8'),
    ] },
  // Cristalplex (pag.57) — plexi lucido trasparente, lastre/cornici/finestre foto
  { key: 'cristalplex', label: 'Cristalplex', texture: 'cristalplex', swatch: '#dfe6ea',
    pbr: { roughness: 0.06, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.08, reflectivity: 0.95, bumpScale: 0.004, repeat: 1.4 },
    colors: [
      C('cristalplex','Trasparente','#e2e8ec'),
      C('cristalplex','Latteo','#e9ecec'),
      C('cristalplex','Ghiaccio','#dbe7ec'),
      C('cristalplex','Fumé','#73767a'),
      C('cristalplex','Bronzo Chiaro','#b59f86'),
      C('cristalplex','Champagne','#d8c6a6'),
      C('cristalplex','Perla','#e4ddd2'),
    ] },
]

// ---------------------------------------------------------------------------
// CATEGORIE + MODELLI
// ---------------------------------------------------------------------------
export const CATEGORIES: Category[] = [
  { key: 'all', label: 'Tutti listino' },
  { key: 'personalizzato', label: 'Personalizzato' },
  { key: 'swarovski', label: 'Swarovski' },
  { key: 'wood', label: 'Pelle di legno' },
  { key: 'cristal', label: 'Cristal / Plex' },
  { key: 'gold', label: 'Gold / Rimboccati' },
  { key: 'stampati', label: 'Decorati' },
  { key: 'listino', label: 'Altri modelli' },
]

const M = (
  key: string,
  label: string,
  category: string,
  format: Format,
  decoro: Decoro,
  tier: Tier,
  priceA: (number | null)[],
  materials?: string[],
  variant?: string,
): Model => ({
  key,
  label,
  category,
  format,
  decoro,
  tier,
  priceA,
  materials,
  variant,
  source: 'LISTINO 30 MARZO 2022-1.pdf',
  blurb: `Listino 30/03/2022 · ${tier}${variant ? ` · ${variant}` : ''}`,
})

export const MODELS: Model[] = [
  M('adel-swarovski-pelle-di-legno-crystalwhite', 'Adel · Swarovski Pelle di legno Crystalwhite', 'swarovski', 'square', 'swarovski', 'PRIME', [null,null,null,null,65,75,80,115,125,160,150,150,175,175,185], ['wood','cristalwhite'], 'Swarovski Pelle di legno Crystalwhite'),
  M('almond-swarovski-pelle-di-legno-crystalwhite', 'Almond · Swarovski Pelle di legno Crystalwhite', 'swarovski', 'square', 'swarovski', 'PRIME', [null,null,null,null,65,75,80,115,125,160,150,150,175,175,185], ['wood','cristalwhite'], 'Swarovski Pelle di legno Crystalwhite'),
  M('almond-swarovski-pelle-di-legno-crystaplex', 'Almond · Swarovski Pelle di legno Crystaplex', 'swarovski', 'square', 'swarovski', 'PRIME', [null,null,null,null,65,75,80,115,125,160,150,150,175,175,185], ['wood','cristalplex'], 'Swarovski Pelle di legno Crystaplex'),
  M('altea', 'Altea', 'listino', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('amelie-gold', 'Amelie · Gold', 'gold', 'square', 'ottone', 'BASIC', [null,null,null,null,null,null,60,80,90,125,115,115,140,140,150], ['metal'], 'Gold'),
  M('amelie-rimboccato-1-2', 'Amelie · Rimboccato 1 - 2', 'gold', 'square', 'print', 'BASIC', [null,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, 'Rimboccato 1 - 2'),
  M('anais-cristalwhite', 'Anais · Cristalwhite', 'cristal', 'square', 'plate', 'ROYAL', [null,null,null,null,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('andromeda-cristalplex', 'Andromeda · Cristalplex', 'cristal', 'square', 'photo', 'ROYAL', [null,null,null,null,55,65,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Cristalplex'),
  M('andromeda-pelle-di-legno-cristalplex', 'Andromeda · Pelle di legno Cristalplex', 'wood', 'square', 'photo', 'ROYAL', [null,null,null,null,55,65,70,105,115,150,140,140,165,165,175], ['wood','cristalplex'], 'Pelle di legno Cristalplex'),
  M('ardesia', 'Ardesia', 'listino', 'square', 'plate', 'ROYAL', [null,null,null,null,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('artemis', 'Artemis', 'listino', 'square', 'plate', 'BASIC', [null,null,null,null,45,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('ashley-gold', 'Ashley · Gold', 'gold', 'square', 'ottone', 'BASIC', [null,null,null,null,45,55,60,80,90,125,115,115,140,140,150], ['metal'], 'Gold'),
  M('azhar-gold', 'Azhar · Gold', 'gold', 'square', 'ottone', 'BASIC', [null,null,null,null,45,55,60,80,90,125,115,115,140,140,150], ['metal'], 'Gold'),
  M('azulejo', 'Azulejo', 'stampati', 'square', 'print', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('betulla-cristalwhite', 'Betulla · Cristalwhite', 'cristal', 'square', 'frame', 'ROYAL', [null,null,null,null,null,null,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('betulla-plex-bianco', 'Betulla · Plex Bianco', 'cristal', 'square', 'photo', 'ROYAL', [null,null,null,null,null,null,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Plex Bianco'),
  M('bouquet-swarovski-gold', 'Bouquet · Swarovski Gold', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['metal'], 'Swarovski Gold'),
  M('bouquet-swarovski-rimboccato-1-2', 'Bouquet · Swarovski Rimboccato 1 - 2', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Swarovski Rimboccato 1 - 2'),
  M('bouquet-swarovski-unique', 'Bouquet · Swarovski Unique', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Swarovski Unique'),
  M('brand-cristalwhite', 'Brand · Cristalwhite', 'wood', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('brand-pelle-di-legno', 'Brand · Pelle di legno', 'wood', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['wood'], 'Pelle di legno'),
  M('brand-plexi-bianco', 'Brand · Plexi Bianco', 'wood', 'square', 'photo', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Plexi Bianco'),
  M('brigit', 'Brigit', 'listino', 'square', 'plate', 'BASIC', [null,null,null,null,null,null,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('canvas', 'Canvas', 'stampati', 'square', 'photo', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('canvas-completo', 'Canvas Completo', 'stampati', 'square', 'photo', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('cassiopea-alluminio', 'Cassiopea · Alluminio', 'gold', 'square', 'photo', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['metal'], 'Alluminio'),
  M('cassiopea-cristalplex', 'Cassiopea · Cristalplex', 'cristal', 'square', 'photo', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Cristalplex'),
  M('cassiopea-cristalwhite', 'Cassiopea · Cristalwhite', 'cristal', 'square', 'photo', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('cassiopea-pelle-di-legno', 'Cassiopea · Pelle di legno', 'wood', 'square', 'photo', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['wood'], 'Pelle di legno'),
  M('cassiopea-swarovski-alluminio', 'Cassiopea · Swarovski Alluminio', 'swarovski', 'square', 'swarovski', 'PRIME', [null,null,null,null,65,75,90,115,125,160,150,150,175,175,185], ['metal'], 'Swarovski Alluminio'),
  M('charme-cristalwhite', 'Charme · Cristalwhite', 'cristal', 'square', 'plate', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('chloe-cristalplex', 'Chloe · Cristalplex', 'cristal', 'portrait', 'photo', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Cristalplex'),
  M('claire-swarovski-diez-pelle-di-legno', 'Claire · Swarovski Diez Pelle di legno', 'swarovski', 'square', 'swarovski', 'TOP', [null,null,null,75,75,85,90,125,135,170,160,160,185,185,195], ['wood'], 'Swarovski Diez Pelle di legno'),
  M('clouds', 'Clouds', 'stampati', 'square', 'print', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('coloniali', 'Coloniali', 'listino', 'square', 'plate', 'TOP', [60,60,65,75,75,85,90,125,135,170,160,160,185,185,195], undefined, undefined),
  M('comete', 'Comete', 'listino', 'square', 'plate', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('comete-pelle-di-legno-alluminio', 'Comete · Pelle di legno Alluminio', 'wood', 'square', 'ottone', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['wood','metal'], 'Pelle di legno Alluminio'),
  M('cordelia', 'Cordelia', 'listino', 'square', 'plate', 'BASIC', [null,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('darling-gold', 'Darling · Gold', 'gold', 'square', 'ottone', 'BASIC', [null,null,35,45,45,55,60,80,90,125,115,115,140,140,150], ['metal'], 'Gold'),
  M('darling-rimboccato-1-2', 'Darling · Rimboccato 1 - 2', 'gold', 'square', 'print', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, 'Rimboccato 1 - 2'),
  M('dhyana-cristalwhite', 'Dhyana · Cristalwhite', 'cristal', 'square', 'print', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('dhyana-gold', 'Dhyana · Gold', 'gold', 'square', 'ottone', 'BASIC', [null,null,35,45,45,55,60,80,90,125,115,115,140,140,150], ['metal'], 'Gold'),
  M('diez-gold', 'Diez · Gold', 'gold', 'square', 'ottone', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['metal'], 'Gold'),
  M('diez-rimboccato-1-2', 'Diez · Rimboccato 1 - 2', 'gold', 'square', 'ottone', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Rimboccato 1 - 2'),
  M('diez-swarovski-pelle-di-legno', 'Diez · Swarovski Pelle di legno', 'swarovski', 'square', 'swarovski', 'TOP', [null,null,null,null,null,null,90,125,135,170,160,160,185,185,195], ['wood'], 'Swarovski Pelle di legno'),
  M('diez-swarovski-rimboccato', 'Diez · Swarovski Rimboccato', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,null,null,null,70,105,115,150,140,140,165,165,175], undefined, 'Swarovski Rimboccato'),
  M('draft', 'Draft', 'listino', 'square', 'plate', 'BASIC', [null,null,null,null,null,null,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('dream-cristalwhite', 'Dream · Cristalwhite', 'cristal', 'square', 'frame', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('egon-swarovski', 'Egon · Swarovski', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,null,null,65,70,105,115,150,140,140,165,165,175], undefined, 'Swarovski'),
  M('electra', 'Electra', 'listino', 'square', 'plate', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('elsie-cristalwhite', 'Elsie · Cristalwhite', 'cristal', 'landscape', 'plate', 'ROYAL', [null,null,null,null,null,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('elsie-gold', 'Elsie · Gold', 'gold', 'landscape', 'ottone', 'BASIC', [null,null,null,null,null,55,60,80,90,125,115,115,140,140,150], ['metal'], 'Gold'),
  M('elsie-pelle-di-legno', 'Elsie · Pelle di legno', 'wood', 'landscape', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['wood'], 'Pelle di legno'),
  M('elsie-rimboccato-2', 'Elsie · Rimboccato 2', 'gold', 'landscape', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Rimboccato 2'),
  M('ermes-swarovski', 'Ermes · Swarovski', 'swarovski', 'square', 'swarovski', 'TOP', [null,null,null,null,null,null,90,125,135,170,160,160,185,185,195], undefined, 'Swarovski'),
  M('flaming', 'Flaming', 'stampati', 'square', 'print', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('frame-cristalplex', 'Frame · Cristalplex', 'cristal', 'portrait', 'photo', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Cristalplex'),
  M('frame-cristalwhite-satin', 'Frame · Cristalwhite Satin', 'cristal', 'portrait', 'photo', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite Satin'),
  M('frame-plexi-bianco-plex-nero', 'Frame · Plexi Bianco - Plex Nero', 'cristal', 'portrait', 'photo', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Plexi Bianco - Plex Nero'),
  M('frejus-cristalwhite', 'Frejus · Cristalwhite', 'cristal', 'square', 'print', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('frejus-gold', 'Frejus · Gold', 'gold', 'square', 'ottone', 'BASIC', [null,null,null,null,null,55,60,80,90,125,115,115,140,140,150], ['metal'], 'Gold'),
  M('ghost-cristalwhite', 'Ghost · Cristalwhite', 'cristal', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('graphic-soft-touch', 'Graphic · Soft Touch', 'stampati', 'square', 'print', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['soft-touch'], 'Soft Touch'),
  M('hera', 'Hera', 'listino', 'square', 'photo', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('ikon', 'Ikon', 'listino', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('judy', 'Judy', 'listino', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('julies', 'Julies', 'listino', 'square', 'plate', 'BASIC', [null,null,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('julies-cristalwhite', 'Julies · Cristalwhite', 'cristal', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('kube', 'Kube', 'listino', 'square', 'plate', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('leaves-gold', 'Leaves · Gold', 'gold', 'square', 'ottone', 'BASIC', [null,null,null,null,null,55,60,80,90,125,115,115,140,140,150], ['metal'], 'Gold'),
  M('lolly', 'Lolly', 'listino', 'square', 'plate', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('mandala', 'Mandala', 'stampati', 'square', 'print', 'BASIC', [null,null,null,null,null,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('ninfea', 'Ninfea', 'listino', 'square', 'plate', 'BASIC', [null,null,null,null,null,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('ninfea-swarovski-gold', 'Ninfea · Swarovski Gold', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,null,null,65,70,105,115,150,140,140,165,165,175], ['metal'], 'Swarovski Gold'),
  M('ninfea-swarovski-rimboccato-1-2', 'Ninfea · Swarovski Rimboccato 1 - 2', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Swarovski Rimboccato 1 - 2'),
  M('ninfea-swarovski-unique', 'Ninfea · Swarovski Unique', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,55,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Swarovski Unique'),
  M('personalizzato-cristalwhite', 'Personalizzato · Cristalwhite', 'personalizzato', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('personalizzato-decoro-colorato', 'Personalizzato · Decoro colorato', 'personalizzato', 'square', 'print', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, 'Decoro colorato'),
  M('personalizzato-decoro-colorato-cliente', 'Personalizzato · Decoro colorato cliente', 'personalizzato', 'square', 'print', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Decoro colorato cliente'),
  M('personalizzato-rimboccato-1-loghi', 'Personalizzato · Rimboccato 1 Loghi', 'personalizzato', 'square', 'plate', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, 'Rimboccato 1 Loghi'),
  M('personalizzato-rimboccato-2-loghi', 'Personalizzato · Rimboccato 2 Loghi', 'personalizzato', 'square', 'plate', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, 'Rimboccato 2 Loghi'),
  M('personalizzato-rimboccato-unique-loghi', 'Personalizzato · Rimboccato Unique Loghi', 'personalizzato', 'square', 'plate', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, 'Rimboccato Unique Loghi'),
  M('personalizzato-rimboccato-gold-loghi', 'Personalizzato · Rimboccato Gold Loghi', 'personalizzato', 'square', 'ottone', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], ['metal'], 'Rimboccato Gold Loghi'),
  M('personalizzato-sposi-pelle-bianconeve', 'Personalizzato · Sposi Pelle Bianconeve', 'personalizzato', 'square', 'plate', 'PRIME', [null,null,null,65,65,75,80,115,125,160,150,150,175,175,185], ['pelle'], 'Sposi Pelle Bianconeve'),
  M('personalizzato-sposi-eco-bianco', 'Personalizzato · Sposi Eco bianco', 'personalizzato', 'square', 'plate', 'BASIC', [null,null,null,45,45,55,60,80,90,125,115,115,140,140,150], ['pelle'], 'Sposi Eco bianco'),
  M('plaza-gold', 'Plaza · Gold', 'gold', 'square', 'ottone', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['metal'], 'Gold'),
  M('quadra', 'Quadra', 'listino', 'square', 'plate', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('quadra-cristalwhite', 'Quadra · Cristalwhite', 'cristal', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('quadra-plex-bianco', 'Quadra · Plex Bianco', 'cristal', 'square', 'photo', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Plex Bianco'),
  M('quadra-plex-nero-plex-nero', 'Quadra · Plex Nero - Plex Nero', 'cristal', 'square', 'photo', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Plex Nero - Plex Nero'),
  M('redon-swarovski-gold', 'Redon · Swarovski Gold', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,null,null,65,70,105,115,150,140,140,165,165,175], ['metal'], 'Swarovski Gold'),
  M('rubik', 'Rubik', 'listino', 'square', 'plate', 'BASIC', [null,null,null,null,null,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('satin', 'Satin', 'listino', 'square', 'plate', 'BASIC', [null,null,null,null,null,55,60,80,90,125,115,115,140,140,150], undefined, undefined),
  M('selene-swarovski-gold', 'Selene · Swarovski Gold', 'swarovski', 'square', 'swarovski', 'TOP', [null,null,null,null,null,null,90,125,135,170,160,160,185,185,195], ['metal'], 'Swarovski Gold'),
  M('sirene-cristalwhite', 'Sirene · Cristalwhite', 'cristal', 'square', 'print', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('sirene-rimboccato-1-2', 'Sirene · Rimboccato 1 - 2', 'gold', 'square', 'print', 'BASIC', [30,30,35,45,45,55,60,80,90,125,115,115,140,140,150], undefined, 'Rimboccato 1 - 2'),
  M('thea-swarovski-pelle-di-legno-material-iniziali-vega', 'Thea · Swarovski Pelle di legno Material iniziali Vega', 'swarovski', 'square', 'swarovski', 'TOP', [null,null,null,null,null,null,90,125,135,170,160,160,185,185,195], ['wood'], 'Swarovski Pelle di legno Material iniziali Vega'),
  M('thea-swarovski-pelle-di-legno-cristalplex', 'Thea · Swarovski Pelle di legno Cristalplex', 'swarovski', 'square', 'swarovski', 'TOP', [null,null,null,null,null,null,90,125,135,170,160,160,185,185,195], ['wood','cristalplex'], 'Swarovski Pelle di legno Cristalplex'),
  M('thea-swarovski-pelle-di-legno-crystalwhite', 'Thea · Swarovski Pelle di legno Crystalwhite', 'swarovski', 'square', 'swarovski', 'TOP', [null,null,null,null,null,null,90,125,135,170,160,160,185,185,195], ['wood','cristalwhite'], 'Swarovski Pelle di legno Crystalwhite'),
  M('trilogy-cristalwhite', 'Trilogy · Cristalwhite', 'wood', 'landscape', 'plate', 'ROYAL', [null,null,null,null,null,null,70,105,115,150,140,140,165,165,175], ['cristalwhite'], 'Cristalwhite'),
  M('trilogy-pelle-di-legno', 'Trilogy · Pelle di legno', 'wood', 'landscape', 'plate', 'ROYAL', [null,null,null,null,null,null,70,105,115,150,140,140,165,165,175], ['wood'], 'Pelle di legno'),
  M('trilogy-plex-bianco', 'Trilogy · Plex Bianco', 'wood', 'landscape', 'photo', 'ROYAL', [null,null,null,null,null,null,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Plex Bianco'),
  M('trilogy-plex-nero', 'Trilogy · Plex Nero', 'wood', 'landscape', 'photo', 'ROYAL', [null,null,null,null,null,null,70,105,115,150,140,140,165,165,175], ['cristalplex'], 'Plex Nero'),
  M('vega-gold', 'Vega · Gold', 'wood', 'square', 'ottone', 'TOP', [null,null,null,null,null,null,90,125,135,170,160,160,185,185,195], ['metal'], 'Gold'),
  M('vega-pelle-di-legno', 'Vega · Pelle di legno', 'wood', 'square', 'ottone', 'TOP', [60,60,65,75,75,85,90,125,135,170,160,160,185,185,195], ['wood'], 'Pelle di legno'),
  M('vega-rimboccato-1-2', 'Vega · Rimboccato 1 - 2', 'wood', 'square', 'ottone', 'TOP', [60,60,65,75,75,85,90,125,135,170,160,160,185,185,195], undefined, 'Rimboccato 1 - 2'),
  M('vega-unique', 'Vega · Unique', 'wood', 'square', 'ottone', 'TOP', [60,60,65,75,75,85,90,125,135,170,160,160,185,185,195], undefined, 'Unique'),
  M('viola', 'Viola', 'listino', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
  M('xante-swarovski-rimboccato', 'Xante · Swarovski Rimboccato', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,null,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Swarovski Rimboccato'),
  M('xante-swarovski-unique', 'Xante · Swarovski Unique', 'swarovski', 'square', 'swarovski', 'ROYAL', [null,null,null,null,55,65,70,105,115,150,140,140,165,165,175], undefined, 'Swarovski Unique'),
  M('yasmine', 'Yasmine', 'listino', 'square', 'plate', 'ROYAL', [40,40,45,55,55,65,70,105,115,150,140,140,165,165,175], undefined, undefined),
]

// ---------------------------------------------------------------------------
// LAYOUT per modello (fedele alle schede 2D) → guida il 3D.
// ---------------------------------------------------------------------------
export type Layout =
  | 'plate' | 'plain' | 'monogram' | 'fascia' | 'fascia-ornament' | 'oblique'
  | 'swarovski-line' | 'swarovski-cluster' | 'photo-vertical' | 'photo-panoramic'
  | 'photo-small' | 'photo-full' | 'trilogy' | 'print' | 'laser'
export const MODEL_LAYOUT: Record<string, Layout> = {
  rimboccato: 'plate',
  brand: 'monogram', trilogy: 'trilogy', almond: 'oblique', claire: 'fascia', thea: 'fascia-ornament', adel: 'plate', elsie: 'photo-small', 'elsie-gold': 'photo-small',
  vega: 'monogram', diez: 'swarovski-line', comete: 'fascia-ornament', plaza: 'fascia',
  andromeda: 'photo-vertical', cassiopea: 'photo-panoramic', chloe: 'photo-vertical',
  charme: 'photo-vertical', azulejo: 'print', hera: 'photo-panoramic', canvas: 'photo-full',
  'frame-cristalplex': 'photo-vertical',
  betulla: 'laser', dream: 'laser',
  amelie: 'print', darling: 'print', sirene: 'print', frejus: 'print', dhyana: 'print',
  'diez-sw': 'swarovski-line', 'xante-sw': 'swarovski-cluster', 'bouquet-sw': 'swarovski-cluster', 'ninfea-sw': 'swarovski-cluster',
}
const _decoroToLayout: Record<Decoro, Layout> = { plate: 'plate', ottone: 'plate', floral: 'laser', frame: 'laser', print: 'print', photo: 'photo-vertical', swarovski: 'swarovski-cluster', strap: 'plate' }
function modelText(k?: string): string {
  const m = modelByKey(k)
  return `${m?.key ?? k ?? ''} ${m?.label ?? ''} ${m?.variant ?? ''}`.toUpperCase()
}
export function modelLayout(k?: string): Layout {
  if (k && MODEL_LAYOUT[k]) return MODEL_LAYOUT[k]!
  const t = modelText(k)
  if (t.includes('BRAND')) return 'monogram'
  if (t.includes('TRILOGY')) return 'trilogy'
  if (t.includes('ALMOND')) return 'oblique'
  if (t.includes('CLAIRE')) return 'fascia'
  if (t.includes('THEA')) return 'fascia-ornament'
  if (t.includes('VEGA')) return 'monogram'
  if (t.includes('DIEZ')) return 'swarovski-line'
  if (t.includes('COMETE')) return 'fascia-ornament'
  if (t.includes('PLAZA')) return 'fascia'
  if (t.includes('ANDROMEDA') || t.includes('CHLOE')) return 'photo-vertical'
  if (t.includes('CASSIOPEA') || t.includes('HERA')) return 'photo-panoramic'
  if (t.includes('ELSIE')) return 'photo-small'
  if (t.includes('CANVAS')) return 'photo-full'
  if (t.includes('BOUQUET') || t.includes('XANTE') || t.includes('NINFEA') || t.includes('REDON') || t.includes('SELENE') || t.includes('ERMES') || t.includes('EGON')) return 'swarovski-cluster'
  if (t.includes('BETULLA') || t.includes('DREAM')) return 'laser'
  if (t.includes('AMELIE') || t.includes('DARLING') || t.includes('SIRENE') || t.includes('FREJUS') || t.includes('DHYANA') || t.includes('AZULEJO') || t.includes('GRAPHIC')) return 'print'
  const d = modelByKey(k)?.decoro
  return d ? _decoroToLayout[d] : 'plate'
}
// modelli che di default montano il LEGNO (Wood Collection / Ottone su legno / Swarovski su legno)
export const WOOD_MODELS = new Set<string>([
  'brand', 'trilogy', 'almond', 'claire', 'thea', 'adel', 'elsie',
  'vega', 'diez', 'comete', 'plaza', 'andromeda', 'cassiopea',
  'diez-sw', 'xante-sw',
])
export const isWoodModel = (k?: string): boolean => {
  if (!k) return false
  const m = modelByKey(k)
  return WOOD_MODELS.has(k) || m?.materials?.includes('wood') || /PELLE DI LEGNO|VEGA|BRAND|TRILOGY|ALMOND|CLAIRE|THEA/.test(modelText(k))
}

// mockup FOTOREALISTICI (Higgsfield) per modello — anteprima reale fedele alle schede
export const MODEL_MOCKUP: Record<string, boolean> = {
  claire: true, comete: true, almond: true, brand: true, trilogy: true, vega: true,
  'diez-sw': true, andromeda: true, rimboccato: true,
  cassiopea: true, elsie: true, amelie: true, betulla: true, hera: true, canvas: true, 'bouquet-sw': true, adel: true,
  // mockup REALI ritagliati dalle tavole tecniche del catalogo (giu 2026)
  thea: true, chloe: true, darling: true, 'elsie-gold': true,
}
function mockupKeyFor(k?: string): string | null {
  const t = modelText(k)
  if (t.includes('ELSIE') && t.includes('GOLD')) return 'elsie-gold'
  if (t.includes('DIEZ') && t.includes('SWAROVSKI')) return 'diez-sw'
  if (t.includes('BOUQUET')) return 'bouquet-sw'
  if (t.includes('PERSONALIZZATO') && t.includes('RIMBOCCATO')) return 'rimboccato'
  const keys = ['claire','comete','almond','brand','trilogy','vega','andromeda','cassiopea','elsie','amelie','betulla','hera','canvas','adel','thea','chloe','darling']
  for (const key of keys) if (t.includes(key.toUpperCase())) return key
  return null
}
export const mockupFor = (k?: string): string | null => {
  const key = mockupKeyFor(k)
  return (key && MODEL_MOCKUP[key]) ? `/textures/mockups/${key}.jpg` : null
}
// 3D ruotabile derivato dal mockup 2D (Higgsfield image_to_3d → GLB)
export const MODEL_GLB: Record<string, boolean> = { claire: true, brand: true, vega: true }
export const glbFor = (k?: string): string | null => {
  const key = mockupKeyFor(k) || k
  return (key && MODEL_GLB[key]) ? `/models/${key}.glb` : null
}

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
    S('portrait',12.5,25), S('portrait',15,20), S('portrait',18,24), S('portrait',20,25), S('portrait',20,30), S('portrait',22,30),
    S('portrait',24,30), S('portrait',24,36), S('portrait',25,30), S('portrait',25,35), S('portrait',30,35), S('portrait',30,40), S('portrait',35,45),
  ] },
  { key: 'landscape', label: 'Orizzontale', hint: 'Paesaggi, doppie pagine', sizes: [
    S('landscape',20,15), S('landscape',22,15), S('landscape',25,10), S('landscape',25,20), S('landscape',24,18), S('landscape',30,20),
    S('landscape',30,24), S('landscape',35,25), S('landscape',35,30), S('landscape',40,30), S('landscape',45,35), S('landscape',50,20), S('landscape',50,25),
  ] },
  { key: 'square', label: 'Quadrato', hint: 'Equilibrato, moderno', sizes: [
    S('square',10,10), S('square',15,15), S('square',20,20), S('square',25,25), S('square',30,30), S('square',35,35), S('square',38,38), S('square',40,40),
  ] },
]
export const sizeByKey = (k?: string): SizeDef | undefined => {
  for (const f of FORMATS) { const s = f.sizes.find((x) => x.key === k); if (s) return s }
  return undefined
}
export const sizesForFormat = (f?: Format, modelKey?: string): SizeDef[] => {
  const sizes = FORMATS.find((x) => x.key === f)?.sizes ?? []
  return modelKey ? sizes.filter((s) => isSizeAvailableForModel(modelKey, s.key)) : sizes
}
export const formatLabel = (f?: Format): string => FORMATS.find((x) => x.key === f)?.label || '—'
export const defaultSizeKey = (f: Format): string => {
  const fav: Record<Format, string> = { portrait: 'portrait:30x40', landscape: 'landscape:40x30', square: 'square:30x30' }
  return fav[f]
}
export const firstAvailableSizeKey = (f: Format, modelKey?: string): string => sizesForFormat(f, modelKey)[0]?.key ?? defaultSizeKey(f)
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
export const modelsByCategory = (cat: string): Model[] => cat === 'all' ? MODELS : MODELS.filter((m) => m.category === cat)

// --- DEDUP per il PICKER -----------------------------------------------------
// Il listino ha ~100 SKU = stesso DESIGN ripetuto per materiale/finitura
// (Cassiopea ×5, Trilogy ×4, …). Ma materiale e finitura si scelgono GIÀ negli
// step Materiale + Finiture → nel picker mostra UN solo design base, rappresentante
// = variante più "bella" di default (Pelle di legno > Cristalwhite > base > prima).
export const baseDesignKey = (m?: Model): string => ((m?.label.split(' · ')[0] || m?.label || '').trim().toLowerCase())
export const baseDesignOf = (key?: string): string => baseDesignKey(modelByKey(key))
function _repScore(m: Model): number {
  const v = (m.variant || '').toLowerCase()
  if (m.materials?.includes('wood') || v.includes('pelle di legno')) return 4
  if (m.materials?.includes('cristalwhite') || v.includes('cristalwhite')) return 3
  if (!m.variant) return 2
  return 1
}
export const baseModelsByCategory = (cat: string): Model[] => {
  const pool = cat === 'all' ? MODELS : MODELS.filter((m) => m.category === cat)
  const byBase = new Map<string, Model>()
  for (const m of pool) {
    const k = baseDesignKey(m)
    const cur = byBase.get(k)
    if (!cur || _repScore(m) > _repScore(cur)) byBase.set(k, m)
  }
  return Array.from(byBase.values()).sort((a, b) => a.label.localeCompare(b.label, 'it'))
}

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
export const MODEL_TIER: Record<string, Tier> = Object.fromEntries(MODELS.map((m) => [m.key, m.tier])) as Record<string, Tier>
export const modelTier = (k?: string): Tier => modelByKey(k)?.tier || 'BASIC'
// gruppo materiale (4 listini): A=base, B, C, D=sequoia
const MATERIAL_GROUP: Record<string, 'A' | 'B' | 'C' | 'D'> = {
  wood: 'A', juta: 'A', skill: 'A', safir: 'A', alcantara: 'A', acero: 'A',
  'soft-touch': 'B', suade: 'B', metal: 'B', crazy: 'B',
  pelle: 'C', 'velu-arte': 'C', sequoia: 'D',
}
// prezzo per colonna-misura × tier [BASIC,ROYAL,PRIME,TOP] (pag.1-4)
const GROUP_A: number[][] = [
  [30, 40, 50, 60],   // 0  10x10 / 15x15 / 15x20
  [30, 40, 50, 60],   // 1  20x15
  [35, 45, 55, 65],   // 2  22x15 / 20x20 / 25x10 / 12.5x25
  [45, 55, 65, 75],   // 3  20x25 / 25x20 / 25x25 / 24x18
  [45, 55, 65, 75],   // 4  20x30 / 22x30 / 18x24
  [55, 65, 75, 85],   // 5  30x20
  [60, 70, 80, 90],   // 6  30x30
  [80, 105, 115, 125],// 7  25x35 / 35x25
  [90, 115, 125, 135],// 8  35x30 / 35x35
  [125, 150, 160, 170],// 9 30x40 / 50x20
  [115, 140, 150, 160],// 10 40x30
  [115, 140, 150, 160],// 11 listino intermedio
  [140, 165, 175, 185],// 12 35x45 / 45x35
  [140, 165, 175, 185],// 13 38x38 / 50x25
  [150, 175, 185, 195],// 14 40x40
]
const GROUP_B: number[][] = [
  [35,45,55,65], [35,45,55,65], [40,50,60,70], [50,60,70,80], [50,60,70,80],
  [60,70,80,90], [65,75,85,95], [90,115,125,135], [100,125,135,145], [135,160,170,180],
  [125,150,160,170], [125,150,185,170], [150,175,185,195], [150,175,185,195], [160,185,195,205],
]
const GROUP_C: number[][] = [
  [45,55,65,75], [45,55,65,75], [50,60,70,80], [60,75,85,95], [65,75,85,95],
  [75,85,95,105], [80,90,100,110], [110,135,145,155], [120,145,155,165], [155,180,190,200],
  [145,170,180,190], [145,170,180,190], [170,195,205,215], [170,195,205,215], [180,205,215,225],
]
const GROUP_D: number[][] = [
  [55,65,75,85], [55,65,75,85], [60,70,80,90], [75,85,95,105], [75,85,95,105],
  [85,95,105,115], [90,100,110,120], [120,145,155,165], [130,155,165,175], [165,190,200,210],
  [155,180,190,200], [155,180,190,200], [180,205,215,225], [180,205,215,225], [190,215,225,235],
]
const GROUP_PRICE: Record<'A' | 'B' | 'C' | 'D', number[][]> = { A: GROUP_A, B: GROUP_B, C: GROUP_C, D: GROUP_D }
const SIZE_COL: Record<string, number> = {
  'square:10x10': 0, 'square:15x15': 0, 'portrait:15x20': 0,
  'landscape:20x15': 1,
  'landscape:22x15': 2, 'square:20x20': 2, 'landscape:25x10': 2, 'portrait:12.5x25': 2,
  'portrait:20x25': 3, 'landscape:25x20': 3, 'square:25x25': 3, 'landscape:24x18': 3,
  'portrait:20x30': 4, 'portrait:22x30': 4, 'portrait:18x24': 4,
  'portrait:25x30': 5, 'portrait:24x30': 5, 'landscape:30x20': 5,
  'square:30x30': 6, 'landscape:30x24': 6,
  'portrait:25x35': 7, 'portrait:24x36': 7, 'landscape:35x25': 7,
  'landscape:35x30': 8, 'portrait:30x35': 8, 'square:35x35': 8,
  'portrait:30x40': 9, 'landscape:50x20': 9,
  'landscape:40x30': 10,
  'portrait:35x45': 12, 'landscape:45x35': 12,
  'square:38x38': 13, 'landscape:50x25': 13,
  'square:40x40': 14,
}
export function isSizeAvailableForModel(modelKey?: string, sizeKey?: string): boolean {
  const model = modelByKey(modelKey)
  const col = SIZE_COL[sizeKey || '']
  if (!model || col == null) return true
  return model.priceA[col] != null
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

// Modelli del listino DesignAlbum come voci "da catalogo" (label + prezzo di partenza = grandezza più
// piccola disponibile). Servono al dropdown "Modello scelto" nei prezzi album: il fotografo sceglie un
// modello e precarica il costo/sovrapprezzo. Disponibili a tutti di default (oltre al proprio PDF).
export function designAlbumCatalogModels(): { label: string; price: number | null }[] {
  return MODELS.map((m) => ({ label: m.label, price: m.priceA.find((p) => p != null) ?? null }))
}

export type PriceLine = { label: string; amount: number }
export type PriceBreakdown = { lines: PriceLine[]; unit: number; copies: number; total: number; tier: Tier }

export function coverPrice(cover?: Cover, copies = 1): PriceBreakdown {
  const model = modelByKey(cover?.model)
  const tier = model?.tier || modelTier(cover?.model)
  const group = (cover?.fabric && MATERIAL_GROUP[cover.fabric]) || 'A'
  const col = SIZE_COL[cover?.sizeKey || ''] ?? 9
  const fixedMaterialRow = !!model?.materials?.length
  const rowBase = model?.priceA?.[col]
  const base = rowBase != null && (group === 'A' || fixedMaterialRow)
    ? rowBase
    : (GROUP_PRICE[group]?.[col]?.[TIDX[tier]] ?? GROUP_A[col]?.[TIDX[tier]] ?? 150)
  const lines: PriceLine[] = [
    { label: `Copertina ${modelLabel(cover?.model)} · ${tier}`, amount: base },
  ]
  if (model && rowBase == null) lines.push({ label: 'Misura fuori listino per questa riga modello', amount: 0 })
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
