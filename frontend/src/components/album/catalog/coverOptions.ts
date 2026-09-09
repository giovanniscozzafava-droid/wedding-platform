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
import { MATERIALS, MODELS, CATEGORIES, BOXES, FINISHES, FORMATS, paletteFor, type Material, type Model } from '@/components/album/albumCatalog'

export type Opt = { key: string; label: string; page?: number; hint?: string }

/** Pagina del catalogo (numerazione stampata) → tavola del PDF (1..66): due pagine per tavola. */
export const catalogPageToSheet = (page: number): number => Math.max(1, Math.min(66, Math.ceil((page + 1) / 2)))

// ---- Materiali e colori (pag. 115–127) --------------------------------------
const MATERIAL_PAGE: Record<string, number> = {
  sequoia: 116, pelle: 117, 'velu-arte': 118, alcantara: 119, 'soft-touch': 120, suade: 121,
  safir: 122, acero: 123, crazy: 124, juta: 125, metal: 126, skill: 127,
  wood: 3, cristalwhite: 54, cristalplex: 70,
}
export const MATERIAL_OPTIONS: Opt[] = MATERIALS.map((m: Material) => ({ key: m.key, label: m.label, page: MATERIAL_PAGE[m.key] }))
export const colorOptionsFor = (materialKey?: string): Opt[] =>
  paletteFor(materialKey).map((c) => ({ key: c.key, label: c.label }))

// ---- Modelli per collezione (indice a pag. 1) --------------------------------
export type ModelGroup = { key: string; label: string; models: Model[] }
export const MODEL_GROUPS: ModelGroup[] = CATEGORIES
  .filter((c) => c.key !== 'all')
  .map((c) => ({ key: c.key, label: c.label, models: MODELS.filter((m) => m.category === c.key) }))
  .filter((g) => g.models.length > 0)

// Prima pagina di ogni famiglia di modelli, dall'indice del catalogo (pag. 1).
const MODEL_FAMILY_PAGE: Record<string, number> = {
  brand: 4, diez: 6, trilogy: 6, vega: 6, cassiopea: 7, elsie: 7, andromeda: 7, almond: 8, comete: 8, claire: 9,
  thea: 10, adel: 11, personalizzato: 13, betulla: 20, dream: 22, amelie: 38, darling: 40, sirene: 42, frejus: 44,
  dhyana: 46, chloe: 50, graphic: 52, charme: 54, ghost: 55, clouds: 55, ikon: 55, azulejo: 56, hera: 58, julies: 60,
  canvas: 62, frame: 70, xante: 80, bouquet: 82, ninfea: 84, plaza: 94, altea: 12, ardesia: 12, artemis: 12, ashley: 88,
  azhar: 88, brigit: 12,
}
/** Pagina del catalogo in cui si vede un modello (per «vedi a pag. N»). */
export const modelPage = (label?: string): number | undefined => {
  const fam = (label ?? '').toLowerCase().split(/[\s·]+/)[0]
  return fam ? MODEL_FAMILY_PAGE[fam] : undefined
}

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
export const FORMAT_OPTIONS = FORMATS

/** Etichetta di una chiave, per riepilogo/PDF/commessa. */
export const optLabel = (list: Opt[], key?: string | null): string | undefined => (key ? list.find((o) => o.key === key)?.label : undefined)

/** La composizione scelta dalla coppia: UNA voce per caratteristica. */
export type CoverComposition = {
  model?: { key?: string; label: string; page?: number }
  material?: string
  color?: string
  logo?: string
  logoColor?: string
  block?: string
  box?: string
  finish?: string
  coverPhoto?: { mediaId: string; url: string; label: string | null } | null
}

export function compositionLines(c: CoverComposition): string[] {
  const mat = MATERIALS.find((m) => m.key === c.material)
  const col = c.material ? paletteFor(c.material).find((x) => x.key === c.color) : undefined
  return [
    c.model ? `Modello: ${c.model.label}${c.model.page ? ` (pag. ${c.model.page})` : ''}` : null,
    mat ? `Materiale: ${mat.label}` : null,
    col ? `Colore: ${col.label}` : null,
    c.logo ? `Personalizzazione: ${optLabel(LOGO_OPTIONS, c.logo) ?? c.logo}` : null,
    c.logo && logoNeedsColor(c.logo) && c.logoColor ? `Tonalità logo: ${optLabel(LOGO_COLOR_OPTIONS, c.logoColor) ?? c.logoColor}` : null,
    c.block ? `Blocco interno: ${optLabel(BLOCK_OPTIONS, c.block) ?? c.block}` : null,
    c.box ? `Box: ${optLabel(BOX_OPTIONS, c.box) ?? c.box}` : null,
    c.finish ? `Finitura: ${optLabel(FINISH_OPTIONS, c.finish) ?? c.finish}` : null,
    c.coverPhoto ? `Foto in copertina: ${c.coverPhoto.label ?? 'scelta dalla galleria'}` : null,
  ].filter((x): x is string => !!x)
}
