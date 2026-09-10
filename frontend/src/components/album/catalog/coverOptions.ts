// ============================================================================
// OPZIONI DI COPERTINA lette dal catalogo DesignAlbum 2022 (il PDF che il
// fotografo carica: "Designalbum catalogo 2022", 66 tavole = 128 pagine).
// Servono ai menu a tendina del configuratore lato coppia: una scelta sola per
// caratteristica, con la pagina del catalogo a cui rimanda ogni voce, così chi
// sceglie può andare a vederla sfogliando.
//
// Materiali, colori, modelli, box e formati vivono già in albumCatalog.ts
// (estratti dallo stesso catalogo, pag. 115–127 materiali, 97–113 packaging,
// 66/128 formati). Qui aggiungiamo ciò che mancava: le personalizzazioni
// «nomi e loghi» (pag. 34–37), le tonalità del logo (pag. 37) e i blocchi
// interni (pag. 128).
// ============================================================================
import { MATERIALS, MODELS, CATEGORIES, BOXES, FINISHES, FORMATS, paletteFor, baseModelsByCategory, modelLayout, type Material, type Model } from '@/components/album/albumCatalog'
import { swatchUrl } from '@/components/album/catalog/swatches.generated'
import { decorOf } from '@/components/album/glb/decor.generated'
import type { PhotoCrop, PhotoFrame, LogoPlace } from '@/components/album/glb/layoutSpec'
import { decorLabel } from '@/components/album/glb/decorLabel'

export type Opt = { key: string; label: string; page?: number; hint?: string; hex?: string; img?: string }

/** Pagina del catalogo (numerazione stampata) → tavola del PDF (1..66). Verificato sul PDF:
 *  la tavola s contiene le pagine stampate 2s−4 (sinistra) e 2s−3 (destra); la tavola 2 è
 *  copertina interna + indice (pag. 1), la 1 è la copertina. */
export const catalogPageToSheet = (page: number): number => Math.max(1, Math.min(66, Math.floor((page + 4) / 2)))
/** Tavola del PDF → le due pagine stampate che contiene (solo quelle ≥ 1). */
export const sheetToPages = (sheet: number): number[] => [2 * sheet - 4, 2 * sheet - 3].filter((p) => p >= 1)

// ---- Materiali e colori (pag. 115–127) --------------------------------------
const MATERIAL_PAGE: Record<string, number> = {
  sequoia: 116, pelle: 117, 'velu-arte': 118, alcantara: 119, 'soft-touch': 120, suade: 121,
  safir: 122, acero: 123, crazy: 124, juta: 125, metal: 126, skill: 127,
  wood: 3, cristalwhite: 54, cristalplex: 70,
}
export const MATERIAL_OPTIONS: Opt[] = MATERIALS.map((m: Material) => ({ key: m.key, label: m.label, page: MATERIAL_PAGE[m.key], img: swatchUrl(`mat:${m.key}`) }))

/** Tessere dei loghi (pag. 34–37): ritaglio del riquadro del catalogo, etichetta corta e nota (MAXI, inclusa). */
export const logoTiles = (): Opt[] => LOGO_OPTIONS.map((o) => ({
  key: o.key,
  label: o.key.startsWith('cod.') ? o.key.replace('cod.', 'cod. ') : o.label,
  img: swatchUrl(o.key),
  hint: o.label.includes('MAXI') ? 'MAXI' : o.key === 'cod.P1' ? 'iniziali albumetti · inclusa' : o.key === 'cod.P2' ? 'nomi albumetti · inclusa'
    : o.key === 'cod.00' ? 'grafica del cliente' : /^cod\.(3[7-9]|4\d)$/.test(o.key) ? 'decoro floreale' : o.hint ?? (o.page ? `pag. ${o.page}` : undefined),
}))
export const logoColorTiles = (): Opt[] => LOGO_COLOR_OPTIONS.map((o) => ({ ...o, img: swatchUrl(o.key) }))
// Colore: campione ritagliato dal catalogo (swatches.generated), altrimenti la texture del legno,
// altrimenti la tinta piatta (Cristalwhite/Cristalplex non hanno campioni nel PDF).
export const colorOptionsFor = (materialKey?: string): Opt[] =>
  paletteFor(materialKey).map((c) => ({ key: c.key, label: c.label, hex: c.hex, img: swatchUrl(c.key) ?? c.tex }))

// ---- Modelli per collezione (indice a pag. 1) --------------------------------
export type ModelGroup = { key: string; label: string; models: Model[] }
export const MODEL_GROUPS: ModelGroup[] = CATEGORIES
  .filter((c) => c.key !== 'all')
  .map((c) => ({ key: c.key, label: c.label, models: MODELS.filter((m) => m.category === c.key) }))
  .filter((g) => g.models.length > 0)

// Pagine in cui compare ogni famiglia di modelli, trascritte dall'indice del catalogo (pag. 1):
// «Diez Swarovski 6-14» = pag. 6 e pag. 14 (le pag. 12–15 sono le panoramiche), «Betulla 20-21» = 20 e 21.
// La chiave è il design base (etichetta del listino prima di « · », minuscola).
export const FAMILY_PAGES: Record<string, number[]> = {
  brand: [4, 5, 12, 18, 19], diez: [6, 12, 14, 78, 79, 90, 91], trilogy: [6, 14, 68, 69], vega: [6, 14, 92, 93],
  cassiopea: [7, 13, 64, 65], elsie: [7, 66, 67], andromeda: [7, 13], almond: [8, 15], comete: [8, 14, 88, 89],
  claire: [9, 15], thea: [10], adel: [11, 15], personalizzato: [13], betulla: [20, 21], dream: [22, 23],
  amelie: [38, 39], darling: [40, 41], sirene: [42, 43], frejus: [44, 45], dhyana: [46, 47], chloe: [50, 51],
  graphic: [52, 53], charme: [54], ghost: [55], clouds: [55], ikon: [55], azulejo: [56, 57], hera: [58, 59],
  julies: [60, 61], canvas: [62, 63], frame: [70, 71, 72, 73, 74, 75], xante: [80, 81], bouquet: [82, 83],
  ninfea: [84, 85], plaza: [94, 95],
  // non in indice: panoramiche e pagine ottone (stima della sessione precedente)
  altea: [12], ardesia: [12], artemis: [12], brigit: [12], ashley: [88], azhar: [88],
}
/** Famiglia (design base) di un'etichetta del listino: la parte prima di « · », minuscola. */
export const familyOf = (label?: string): string => ((label ?? '').split(' · ')[0] ?? '').trim().toLowerCase()
/** Pagina del catalogo in cui si vede un modello (per «vedi a pag. N»). */
export const modelPage = (label?: string): number | undefined => FAMILY_PAGES[familyOf(label)]?.[0]
/** Le famiglie di modelli che compaiono su una tavola del PDF (dalla spunta del cliente). */
export const familiesOnSheet = (sheet: number): string[] => {
  const pages = sheetToPages(sheet)
  return Object.entries(FAMILY_PAGES).filter(([, ps]) => ps.some((p) => pages.includes(p))).map(([f]) => f)
}
/** La pagina stampata in cui una famiglia compare su quella tavola (per «vedi a pag. N»). */
export const familyPageOnSheet = (family: string, sheet: number): number | undefined => {
  const pages = sheetToPages(sheet)
  return FAMILY_PAGES[family]?.find((p) => pages.includes(p))
}
/** Tessere dei modelli: una per famiglia (design base), con la foto ritagliata dal catalogo quando c'è
 *  (crop-models.py → «model:<famiglia>»), la collezione come nota e la pagina del catalogo. */
export type ModelTile = { family: string; label: string; model: Model; img?: string; page?: number; collection: string }
export const modelTiles = (): ModelTile[] => {
  const seen = new Set<string>()
  const out: ModelTile[] = []
  for (const g of MODEL_GROUPS) {
    for (const m of g.models) {
      const fam = familyOf(m.label)
      if (!fam || seen.has(fam)) continue
      seen.add(fam)
      const rep = modelsOfFamily(fam)[0] ?? m
      out.push({ family: fam, label: fam.charAt(0).toUpperCase() + fam.slice(1), model: rep, img: swatchUrl(`model:${fam}`), page: FAMILY_PAGES[fam]?.[0], collection: g.label })
    }
  }
  // nell'ordine del catalogo (pagina in cui compaiono); chi non è sulle tavole va in fondo, in ordine alfabetico
  return out.sort((a, b) => (a.page ?? 999) - (b.page ?? 999) || a.label.localeCompare(b.label, 'it'))
}
/** I modelli del listino di una famiglia (una voce per design base, il rappresentante «più bello»). */
export const modelsOfFamily = (family: string): Model[] => baseModelsByCategory('all').filter((m) => familyOf(m.label) === family)

// ---- Personalizzazioni «nomi e loghi» (pag. 34–37) ---------------------------
// Il catalogo dice: i loghi non sono modificabili salvo note d'ordine; senza
// indicazione del cliente vengono stampati monocolore a discrezione dell'azienda;
// lunghezza standard 6–10 cm, MAXI 10–16 cm. cod.00 = grafica fornita dal cliente
// (livelli aperti). cod.P1/P2 = iniziali/nomi sugli albumetti (inclusi nel pacchetto).
export const LOGO_OPTIONS: Opt[] = [
  { key: 'nessuno', label: 'Nessuna personalizzazione' },
  { key: 'cod.P1', label: 'Iniziali sugli albumetti (cod. P1, inclusa)', page: 34 },
  { key: 'cod.P2', label: 'Nomi sugli albumetti (cod. P2, inclusa)', page: 34 },
  { key: 'cod.00', label: 'Grafica del cliente (cod. 00, file a livelli aperti)', page: 34 },
  ...Array.from({ length: 36 }, (_, i) => {
    const n = i + 1
    const code = `cod.${String(n).padStart(2, '0')}`
    const maxi = [6, 7, 13, 26, 27, 28, 29].includes(n)
    const page = n <= 8 ? 34 : n <= 20 ? 35 : n <= 32 ? 36 : 37
    return { key: code, label: `Nomi e data · ${code}${maxi ? ' (MAXI)' : ''}`, page }
  }),
  ...Array.from({ length: 12 }, (_, i) => {
    const n = 37 + i
    return { key: `cod.${n}`, label: `Decoro floreale colorato · cod.${n} (non variabile)`, page: 37 }
  }),
  { key: 'ottone-iniziali', label: 'Iniziali in ottone nichelato', page: 87, hint: 'Comete, Diez, Vega, Plaza' },
  { key: 'ottone-targhetta', label: 'Targhetta in ottone nichelato', page: 87 },
  { key: 'alluminio-lettere', label: 'Lettere in alluminio', page: 87 },
  { key: 'swarovski', label: 'Decoro Swarovski', page: 77 },
]
export const logoNeedsColor = (key?: string): boolean => !!key && (/^cod\.(0\d|[1-3]\d)$/.test(key) || key === 'cod.00')

/** Costo di listino (DesignAlbum, "rifiniture / personalizzazioni") della personalizzazione scelta. */
export function logoAmount(key?: string): number {
  if (!key || key === 'nessuno' || key === 'cod.P1' || key === 'cod.P2') return 0 // albumetti: inclusi
  if (key === 'ottone-iniziali' || key === 'alluminio-lettere') return FINISHES.find((f) => f.key === 'iniziali')?.amount ?? 36
  if (key === 'ottone-targhetta') return FINISHES.find((f) => f.key === 'targhetta')?.amount ?? 30
  if (key === 'swarovski') return FINISHES.find((f) => f.key === 'swarovski')?.amount ?? 30
  return FINISHES.find((f) => f.key === 'logo')?.amount ?? 20 // stampa nomi/loghi da catalogo (cod.00–48)
}

// Tonalità disponibili per la personalizzazione del logo (pag. 37), nell'ordine del catalogo.
export const LOGO_COLOR_OPTIONS: Opt[] = [
  { key: 'tono-su-tono', label: 'Tono su tono' },
  { key: 'bianco', label: 'Bianco' },
  { key: 'grigio-15', label: 'Grigio 15%' },
  { key: 'grigio-30', label: 'Grigio 30%' },
  { key: 'grigio-50', label: 'Grigio 50%' },
  { key: 'grigio-75', label: 'Grigio 75%' },
  { key: 'beige', label: 'Beige' },
  { key: 'sabbia', label: 'Sabbia' },
  { key: 'marrone', label: 'Marrone' },
  { key: 'marrone-scuro', label: 'Marrone scuro' },
  { key: 'giallo', label: 'Giallo' },
  { key: 'giallo-ocra', label: 'Giallo ocra' },
  { key: 'rosso', label: 'Rosso' },
  { key: 'bordeaux', label: 'Bordeaux' },
  { key: 'aloe', label: 'Aloe' },
  { key: 'verde', label: 'Verde' },
  { key: 'rosa', label: 'Rosa' },
  { key: 'glicine', label: 'Glicine' },
  { key: 'viola', label: 'Viola' },
  { key: 'celeste', label: 'Celeste' },
  { key: 'azzurro', label: 'Azzurro' },
  { key: 'blu', label: 'Blu' },
  { key: 'nero', label: 'Nero' },
]

// ---- Blocchi interni (pag. 128) ---------------------------------------------
export const BLOCK_OPTIONS: Opt[] = [
  { key: 'digitale', label: 'Blocco digitale (pagine piane, rilegatura a caldo)', page: 128 },
  { key: 'tradizionale', label: 'Blocco tradizionale (fogli 320 g con aletta)', page: 128 },
  { key: 'book-flat', label: 'Blocco book flat (cartoncini colorati)', page: 128 },
  { key: 'digitale-misto', label: 'Blocco digitale misto (veline, cartoncini, canvas)', page: 128 },
  { key: 'passepartout', label: 'Blocco passepartout (cornici in cartoncino)', page: 128 },
]

// ---- Box e finiture (riuso del catalogo statico) -----------------------------
export const BOX_OPTIONS: Opt[] = BOXES.map((b) => ({ key: b.key, label: b.label, hint: b.blurb, page: b.key === 'nessuno' ? undefined : 97 }))
export const FINISH_OPTIONS: Opt[] = [{ key: 'nessuna', label: 'Nessuna' }, ...FINISHES.map((f) => ({ key: f.key, label: f.label }))]
/** LA FINITURA DELLA BOX: come è trattata la superficie del contenitore (il legno del catalogo è
 *  naturale; laccature e satinature si ordinano a parte). Il prezzo lo conferma il fotografo. */
/** La box può avere le cerniere o no: senza, il coperchio è un tappo che si sfila. */
export const BOX_HINGE_OPTIONS: Opt[] = [
  { key: 'cerniera', label: 'Con cerniere', hint: 'si apre di lato' },
  { key: 'sfilabile', label: 'Coperchio sfilabile', hint: 'tappo che si solleva' },
]
export const BOX_FINISH_OPTIONS: Opt[] = [
  { key: 'naturale', label: 'Naturale', hint: 'come da catalogo' },
  { key: 'opaca', label: 'Laccata opaca' },
  { key: 'lucida', label: 'Laccata lucida' },
  { key: 'satinata', label: 'Satinata' },
]
export const FORMAT_OPTIONS = FORMATS

/** Etichetta di una chiave, per riepilogo/PDF/commessa. */
export const optLabel = (list: Opt[], key?: string | null): string | undefined => (key ? list.find((o) => o.key === key)?.label : undefined)

/** La composizione scelta dalla coppia: UNA voce per caratteristica. */
export type CoverComposition = {
  model?: { key?: string; label: string; page?: number }
  material?: string
  color?: string
  /** retro e dorso di un altro materiale/colore (facoltativo: se assenti, come il fronte) */
  backMaterial?: string
  backColor?: string
  logo?: string
  logoColor?: string
  block?: string
  box?: string
  finish?: string
  coverPhoto?: { mediaId: string; url: string; label: string | null } | null
  /** tutte le foto in copertina, una per finestra e in ordine (modelli a più finestre: Julies, Trilogy); coverPhoto = la prima */
  coverPhotos?: { mediaId: string; url: string; label: string | null }[]
  /** rivestimento del box, se diverso dalla copertina */
  boxMaterial?: string
  boxColor?: string
  /** finitura della superficie della box (naturale, laccata, satinata) */
  boxFinish?: string
  /** con cerniere (si apre di lato) o col coperchio sfilabile */
  boxHinge?: string
  /** impaginazione della copertina scelta dalla coppia: ritaglio di ogni foto (per finestra) e posizione/misura del blocco nomi-logo */
  photoCrops?: Record<number, PhotoCrop>
  /** il riquadro di ogni foto, quando la coppia sceglie una posizione diversa da quella del modello */
  photoFrames?: Record<number, PhotoFrame>
  logoPlace?: LogoPlace
  /** che cosa c'è scritto in copertina: nomi e data li decide la coppia (vuoti = niente scritta) */
  coverNames?: string
  coverDate?: string
  /** dove sta la scritta, quando la coppia la sposta: indipendente dal logo */
  textPlace?: LogoPlace
}

// IL DEFAULT DI OGNI FAMIGLIA: il modello parte col materiale e il colore con cui il catalogo lo mostra
// (la linea «Pelle di legno» parte in legno; Ghost con fronte Cristalplex e dorso colorato; Graphic nero;
// Amelie celeste…), poi la coppia cambia quel che vuole. Chiavi: `${materiale}:${colore}` di albumCatalog.
export type FamilyDefault = { material: string; color: string; backMaterial?: string; backColor?: string }
const WOOD: FamilyDefault = { material: 'wood', color: 'wood:noce' }
export const FAMILY_DEFAULTS: Record<string, FamilyDefault> = {
  brand: WOOD, trilogy: WOOD, vega: WOOD, diez: WOOD, cassiopea: WOOD, elsie: WOOD, almond: WOOD, comete: WOOD, claire: WOOD, thea: WOOD, adel: WOOD, andromeda: WOOD, chloe: WOOD,
  ghost: { material: 'cristalplex', color: 'cristalplex:latteo', backMaterial: 'alcantara', backColor: 'alcantara:grigio' },
  graphic: { material: 'soft-touch', color: 'soft-touch:nero' },
  amelie: { material: 'safir', color: 'safir:celeste' },
  darling: { material: 'suade', color: 'suade:crema' },
  bouquet: { material: 'sequoia', color: 'sequoia:nuage' },
  xante: { material: 'alcantara', color: 'alcantara:grigio' },
  ninfea: { material: 'sequoia', color: 'sequoia:cielo' },
  betulla: { material: 'sequoia', color: 'sequoia:aloe' },
  dream: { material: 'safir', color: 'safir:tortora' },
  sirene: { material: 'alcantara', color: 'alcantara:grigio' },
  frejus: { material: 'alcantara', color: 'alcantara:beige' },
  dhyana: { material: 'sequoia', color: 'sequoia:terra' },
  azulejo: { material: 'sequoia', color: 'sequoia:aloe' },
  julies: { material: 'cristalwhite', color: 'cristalwhite:bianco-puro' },
  plaza: { material: 'pelle', color: 'pelle:dark-blue' },
}

// ============================================================================
// LA RICETTA DEL CATALOGO, famiglia per famiglia — trascritta dalle didascalie
// delle tavole («Brand/Pelle di legno Noce - Safir tabacco · Wood Clak - Safir
// tabacco»): materiale e colore del PIATTO, materiale e colore di DORSO E RETRO
// quando il catalogo li mostra diversi, e la personalizzazione con cui quel
// modello è fotografato (le iniziali in ottone, la targhetta, il logo cod.NN).
// Scegliendo il modello, il 3D esce esattamente così; poi la coppia cambia ciò
// che vuole.  Fonte: tavole 4–11 (linea Pelle di legno). Le altre linee si
// aggiungono man mano che si trascrivono le tavole.
// ============================================================================
export type RicettaCatalogo = {
  material: string; color: string          // il piatto
  backMaterial?: string; backColor?: string // dorso e retro, se diversi
  logo?: string                             // la personalizzazione fotografata
  page?: number                             // la tavola da cui è presa
}
export const FAMILY_CATALOG: Record<string, RicettaCatalogo> = {
  // Pelle di legno (tavole 4–11): piatto in legno, dorso e retro in tessuto
  brand: { material: 'wood', color: 'wood:noce', backMaterial: 'safir', backColor: 'safir:tabacco', page: 4 },
  trilogy: { material: 'wood', color: 'wood:okum-', backMaterial: 'sequoia', backColor: 'sequoia:nuage', page: 6 },
  diez: { material: 'wood', color: 'wood:noce', backMaterial: 'sequoia', backColor: 'sequoia:camel', logo: 'ottone-targhetta', page: 6 },
  vega: { material: 'wood', color: 'wood:ciliegio', backMaterial: 'sequoia', backColor: 'sequoia:cuoio', logo: 'ottone-iniziali', page: 6 },
  cassiopea: { material: 'wood', color: 'wood:noce', backMaterial: 'safir', backColor: 'safir:moka', page: 7 },
  elsie: { material: 'wood', color: 'wood:ulivo', backMaterial: 'sequoia', backColor: 'sequoia:cuoio', page: 7 },
  andromeda: { material: 'wood', color: 'wood:noce', backMaterial: 'safir', backColor: 'safir:moka', page: 7 },
  almond: { material: 'wood', color: 'wood:noce', backMaterial: 'sequoia', backColor: 'sequoia:terra', logo: 'cod.06', page: 8 },
  comete: { material: 'wood', color: 'wood:noce', backMaterial: 'sequoia', backColor: 'sequoia:aloe', page: 8 },
  claire: { material: 'wood', color: 'wood:noce', backMaterial: 'sequoia', backColor: 'sequoia:tormalina', logo: 'ottone-targhetta', page: 9 },
  thea: { material: 'wood', color: 'wood:rovere', backMaterial: 'sequoia', backColor: 'sequoia:aloe', logo: 'cod.07', page: 10 },
  adel: { material: 'wood', color: 'wood:noce', backMaterial: 'sequoia', backColor: 'sequoia:terra', logo: 'cod.04', page: 11 },
}

// IL LOGO CHE IL MODELLO PORTA GIÀ: sulle tavole certi modelli si vedono con una personalizzazione
// precisa — le iniziali sui monogramma, la targhetta d'ottone su chi ha la placca, la linea o il
// grappolo Swarovski sui modelli Swarovski. Scegliendo quel modello la personalizzazione si
// accende da sola; resta cambiabile (o si toglie con «Nessuna personalizzazione»). Gli altri
// modelli partono SENZA logo: non deve uscire da solo.
const LOGO_DEL_LAYOUT: Record<string, string> = {
  monogram: 'ottone-iniziali',
  plate: 'ottone-targhetta',
  'swarovski-line': 'swarovski',
  'swarovski-cluster': 'swarovski',
  fascia: 'ottone-targhetta',
}
/** La personalizzazione con cui il catalogo mostra quel modello (o niente). */
export function familyLogo(label?: string): string | undefined {
  const ric = FAMILY_CATALOG[familyOf(label)]
  if (ric) return ric.logo                      // quello che si vede sulla tavola (anche «nessuno»)
  const m = MODELS.find((x) => familyOf(x.label) === familyOf(label))
  return m ? LOGO_DEL_LAYOUT[modelLayout(m.key)] : undefined
}

/** Come parte il modello: la RICETTA DEL CATALOGO se l'abbiamo trascritta (piatto, dorso e retro
 *  esattamente come sulla tavola), altrimenti il default della famiglia. */
export const familyDefaults = (label?: string): FamilyDefault | undefined => {
  const r = FAMILY_CATALOG[familyOf(label)]
  if (r) return { material: r.material, color: r.color, backMaterial: r.backMaterial, backColor: r.backColor }
  return FAMILY_DEFAULTS[familyOf(label)]
}
/** La tavola del catalogo da cui viene la ricetta (per il rimando «vedi a pag. N»). */
export const familyCatalogPage = (label?: string): number | undefined => FAMILY_CATALOG[familyOf(label)]?.page

export function compositionLines(c: CoverComposition): string[] {
  const mat = MATERIALS.find((m) => m.key === c.material)
  const col = c.material ? paletteFor(c.material).find((x) => x.key === c.color) : undefined
  const bmat = MATERIALS.find((m) => m.key === c.backMaterial)
  const bcol = c.backMaterial ? paletteFor(c.backMaterial).find((x) => x.key === c.backColor) : undefined
  const bxmat = MATERIALS.find((m) => m.key === c.boxMaterial)
  const bxcol = c.boxMaterial ? paletteFor(c.boxMaterial).find((x) => x.key === c.boxColor) : undefined
  const decor = c.model ? decorOf(familyOf(c.model.label)) : undefined
  return [
    c.model ? `Modello: ${c.model.label}${c.model.page ? ` (pag. ${c.model.page})` : ''}` : null,
    decor ? `Decoro del modello: ${decorLabel(decor)}` : null,
    mat ? `Materiale: ${mat.label}` : null,
    col ? `Colore: ${col.label}` : null,
    bmat ? `Retro e dorso: ${bmat.label}${bcol ? ` ${bcol.label}` : ''}` : null,
    c.logo ? `Personalizzazione: ${optLabel(LOGO_OPTIONS, c.logo) ?? c.logo}` : null,
    c.logo && logoNeedsColor(c.logo) && c.logoColor ? `Tonalità logo: ${optLabel(LOGO_COLOR_OPTIONS, c.logoColor) ?? c.logoColor}` : null,
    c.block ? `Blocco interno: ${optLabel(BLOCK_OPTIONS, c.block) ?? c.block}` : null,
    c.box ? `Box: ${optLabel(BOX_OPTIONS, c.box) ?? c.box}${c.box !== 'nessuno' ? (bxmat ? ` · rivestimento ${bxmat.label}${bxcol ? ` ${bxcol.label}` : ''}` : ' · rivestimento come la copertina') : ''}` : null,
    c.boxFinish && c.boxFinish !== 'naturale' ? `Finitura della box: ${optLabel(BOX_FINISH_OPTIONS, c.boxFinish) ?? c.boxFinish}` : null,
    c.box && c.box !== 'nessuno' ? `Apertura della box: ${optLabel(BOX_HINGE_OPTIONS, c.boxHinge ?? 'cerniera')}` : null,
    c.logoPlace ? `Nomi/logo posizionati dalla coppia: centro x ${Math.round(c.logoPlace.x * 100)}%, dall'alto ${Math.round(c.logoPlace.y * 100)}%, larghezza ${Math.round(c.logoPlace.w * 100)}% della copertina` : null,
    c.photoCrops && Object.values(c.photoCrops).some((k) => k.zoom > 1.01 || Math.abs(k.ox) > 0.01 || Math.abs(k.oy) > 0.01) ? `Ritaglio foto scelto dalla coppia (${Object.keys(c.photoCrops).length} finestre): vedi PSD` : null,
    c.coverPhotos && c.coverPhotos.length > 1
      ? `Foto in copertina (${c.coverPhotos.length} finestre, in ordine): ${c.coverPhotos.map((p, i) => `${i + 1}. ${p.label ?? 'dalla galleria'}`).join(' · ')}`
      : c.coverPhoto ? `Foto in copertina: ${c.coverPhoto.label ?? 'scelta dalla galleria'}` : null,
  ].filter((x): x is string => !!x)
}
