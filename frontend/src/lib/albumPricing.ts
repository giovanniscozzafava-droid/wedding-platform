// ============================================================================
// PREZZO ALBUM (vendita fotografo → coppia).
// Due strutture:
//  · AlbumPriceList  = LISTINO riutilizzabile del fotografo (impostazioni), per formato.
//  · AlbumPriceConfig = CONTRATTO del singolo evento (eredita dal listino, ritoccabile).
// Il totale si calcola LIVE: le pagine extra vengono dal numero REALE di pagine
// dell'impaginato (non salvato), così il prezzo segue il lavoro.
// ============================================================================
import { modelTier, modelLabel, type Tier } from '@/components/album/albumCatalog'
import { eurInt } from '@/lib/money'

// Voce di listino per un formato.
export type AlbumFormatPrice = {
  base: number            // prezzo base contratto (album sposi)
  includedPages: number   // pagine comprese nella base
  extraPageRate: number   // € per pagina oltre le incluse (album sposi)
  boxPrice: number        // sovrapprezzo scatola/custodia
  familyBase: number      // prezzo di un album famiglia
  familyExtraPageRate: number // € per pagina extra su ogni album famiglia
}

// Pacchetto base del fotografo (es. dal preventivo: 290/390/490). Include un modello di
// riferimento: se il cliente ne sceglie uno più caro dal catalogo, paga solo la DIFFERENZA.
export type AlbumPackage = {
  id: string
  label: string                 // es. "Pacchetto 390"
  base: number                  // importo base (già preventivato)
  includedPages: number
  includedModelLabel?: string   // modello incluso (label dal catalogo PDF)
  includedModelPrice?: number   // suo prezzo (snapshot, per calcolare la differenza)
}

// Voce di listino a prezzo (copertina/materiale o accessorio). Il prezzo si somma alla base, tranne se
// `included` = compresa nel base (es. copertina base): allora vale 0 (nessun sovrapprezzo).
export type PricedItem = { id: string; label: string; price: number; included?: boolean }

// Listino del fotografo: default per formato + pacchetti base + delta per tier (legacy) +
// copertine (materiali) e accessori/extra con prezzo (nuovo: base grandezza + copertina + extra).
export type AlbumPriceList = {
  formats: Record<string, AlbumFormatPrice>   // key = ALBUM_FORMATS.key (base per grandezza)
  modelDelta: Partial<Record<Tier, number>>   // legacy: upgrade modello per tier
  packages?: AlbumPackage[]                    // pacchetti base preventivati
  covers?: PricedItem[]                        // copertine/materiali (ecopelle, pelle…): prezzo sopra la base grandezza
  accessories?: PricedItem[]                   // extra: box, plexiglass, lettere ottone, foto copertina, album genitori…
  useDesignAlbum?: boolean                     // preset listino DesignAlbum come default nel catalogo (default: on)
  shipping?: number                            // spedizione di default (eredita nel singolo album)
}

// Contratto di un evento.
export type AlbumPriceConfig = {
  formatKey?: string
  mode?: 'package' | 'zero'  // 'package' = base preventivata (paga differenza) · 'zero' = da zero
  base: number
  includedPages: number
  extraPageRate: number
  box: boolean
  boxPrice: number
  shipping?: number          // spedizione (deciso dal fotografo) — si somma al totale
  modelKey?: string          // modello scelto dal catalogo DesignAlbum (legacy)
  modelLabel?: string        // etichetta leggibile della scelta
  modelDelta: number         // legacy: delta dal tier
  packageLabel?: string      // pacchetto scelto (modalità 'package')
  includedModelPrice?: number // prezzo del modello incluso nel pacchetto (per la differenza)
  includedModelLabel?: string // MODELLO BASE (quello incluso nel pacchetto): serve a indicarlo e a mostrare la differenza
  chosenModelLabel?: string  // modello scelto dal catalogo PDF del fotografo
  chosenModelPrice?: number  // suo prezzo di listino
  chosenModelTier?: Tier     // fascia del modello scelto: BASIC = base (incluso, nessun sovrapprezzo)
  family: { qty: number; base: number; extraPageRate: number; included?: boolean; modelUpgrade?: boolean } // included = compresi nel pacchetto (base gratis) · modelUpgrade = la differenza del modello scelto vale anche su ogni album genitori
  showCouple: boolean        // il totale è visibile alla coppia nel visore album
  note?: string              // provenienza / annotazione libera
}

export const DEFAULT_MODEL_DELTA: Partial<Record<Tier, number>> = { BASIC: 0, ROYAL: 30, PRIME: 45, TOP: 60 }

export const DEFAULT_FORMAT_PRICE: AlbumFormatPrice = {
  base: 390, includedPages: 50, extraPageRate: 12, boxPrice: 40, familyBase: 100, familyExtraPageRate: 8,
}

export const emptyPriceList = (): AlbumPriceList => ({ formats: {}, modelDelta: { ...DEFAULT_MODEL_DELTA }, packages: [] })

// Applica un pacchetto base alla config evento (modalità 'package').
export function applyPackage(cfg: AlbumPriceConfig, pkg: AlbumPackage): AlbumPriceConfig {
  return { ...cfg, mode: 'package', packageLabel: pkg.label, base: pkg.base, includedPages: pkg.includedPages, includedModelPrice: pkg.includedModelPrice ?? 0, includedModelLabel: pkg.includedModelLabel }
}

// Crea il contratto di un evento a partire dal listino (o dai default) per un formato.
// Se il listino ha pacchetti, parte dal primo (modalità 'package'); altrimenti resta legacy.
export function seedConfigFromList(list: AlbumPriceList | null, formatKey: string): AlbumPriceConfig {
  const fp = list?.formats?.[formatKey] ?? DEFAULT_FORMAT_PRICE
  const base: AlbumPriceConfig = {
    formatKey,
    base: fp.base, includedPages: fp.includedPages, extraPageRate: fp.extraPageRate,
    box: false, boxPrice: fp.boxPrice,
    modelKey: undefined, modelDelta: 0,
    family: { qty: 0, base: fp.familyBase, extraPageRate: fp.familyExtraPageRate },
    showCouple: true,
  }
  const pkgs = list?.packages ?? []
  return pkgs[0] ? applyPackage(base, pkgs[0]) : base
}

// Delta del modello: dal suo tier via listino (fallback ai default).
export function modelDeltaFor(modelKey: string | undefined, list: AlbumPriceList | null): number {
  if (!modelKey) return 0
  const tier = modelTier(modelKey)
  const map = list?.modelDelta ?? DEFAULT_MODEL_DELTA
  return Math.max(0, Number(map[tier] ?? DEFAULT_MODEL_DELTA[tier] ?? 0))
}

export type AlbumPriceLine = { label: string; amount: number; hint?: string }
export type AlbumPriceBreakdown = { lines: AlbumPriceLine[]; extraPages: number; total: number }

// CALCOLO LIVE del totale. actualPages = pagine reali dell'impaginato.
export function computeAlbumPrice(cfg: AlbumPriceConfig | null | undefined, actualPages: number): AlbumPriceBreakdown {
  const lines: AlbumPriceLine[] = []
  if (!cfg) return { lines, extraPages: 0, total: 0 }
  const included = Math.max(0, Math.round(cfg.includedPages || 0))
  const extraPages = Math.max(0, Math.round(actualPages || 0) - included)
  const n2 = (x: unknown) => { const v = Number(x); return Number.isFinite(v) ? v : 0 }

  const chosen = n2(cfg.chosenModelPrice)
  let modelDiff = 0 // DIFFERENZA modello scelto − modello base (per album genitori, se attivo)
  if (cfg.mode === 'zero') {
    // DA ZERO: il cliente compone; paga il prezzo pieno del modello scelto.
    lines.push({ label: cfg.chosenModelLabel ? `Modello ${cfg.chosenModelLabel}` : 'Album (da zero)', amount: chosen, hint: `${included} pagine incluse` })
  } else {
    // PACCHETTO o LEGACY: base grandezza. Il modello BASE (fascia BASIC) è INCLUSO nel pacchetto →
    // nessun sovrapprezzo. Le altre fasce (Royal/Prime/Top) aggiungono la DIFFERENZA sul modello base.
    lines.push({ label: 'Base album (contratto)', amount: n2(cfg.base), hint: `${included} pagine incluse${cfg.packageLabel ? ` · ${cfg.packageLabel}` : ''}${cfg.includedModelLabel ? ` · base ${cfg.includedModelLabel}` : ''}` })
    if (chosen > 0) {
      modelDiff = cfg.chosenModelTier === 'BASIC' ? 0 : Math.max(0, chosen - n2(cfg.includedModelPrice))
      if (modelDiff > 0) lines.push({ label: `Modello ${cfg.chosenModelLabel ?? ''}`.trim(), amount: modelDiff, hint: `${cfg.chosenModelTier ?? ''} · base ${cfg.includedModelLabel ?? '—'} ${euroA(n2(cfg.includedModelPrice))} → ${euroA(chosen)}`.trim() })
    } else if (n2(cfg.modelDelta) > 0) {
      lines.push({ label: `Modello${cfg.modelLabel ? ` · ${cfg.modelLabel}` : cfg.modelKey ? ` ${modelLabel(cfg.modelKey)}` : ''}`, amount: n2(cfg.modelDelta) })
    }
  }
  if (cfg.box && n2(cfg.boxPrice) > 0) lines.push({ label: 'Box / custodia', amount: n2(cfg.boxPrice) })
  if (extraPages > 0 && n2(cfg.extraPageRate) > 0) {
    lines.push({ label: `${extraPages} pagine in più`, amount: extraPages * n2(cfg.extraPageRate), hint: `€ ${n2(cfg.extraPageRate)} a pagina` })
  }
  const fam = cfg.family
  if (fam && n2(fam.qty) > 0) {
    // INCLUSO nel pacchetto: la base non si paga; pagine extra sì. modelUpgrade: la differenza del
    // modello scelto vale anche su ogni album genitori (sovraccosto per copia).
    const perBase = fam.included ? 0 : n2(fam.base)
    const modelPer = fam.modelUpgrade ? modelDiff : 0
    const each = perBase + extraPages * n2(fam.extraPageRate) + modelPer
    const parts: string[] = []
    parts.push(fam.included ? 'base inclusa' : `base ${euroA(perBase)}`)
    if (extraPages > 0 && n2(fam.extraPageRate) > 0) parts.push(`+${extraPages} pag`)
    if (modelPer > 0) parts.push(`+ modello ${euroA(modelPer)}`)
    lines.push({ label: `Album genitori ×${n2(fam.qty)}${fam.included ? ' (inclusi)' : ''}`, amount: each * n2(fam.qty), hint: `${euroA(each)} l'uno · ${parts.join(' · ')}` })
  }
  if (n2(cfg.shipping) > 0) lines.push({ label: 'Spedizione', amount: n2(cfg.shipping) })
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return { lines, extraPages, total }
}

export const euroA = (n: number) => eurInt(n)   // formato it-IT canonico (money.ts), senza decimali

// ── IMPORT DAL PREVENTIVO ────────────────────────────────────────────────────
// Le voci del preventivo sono testo libero (nome + descrizione + importo). Da esse
// tiriamo l'IMPORTO (base contratto) e proviamo a DEDURRE formato/pagine/box/famiglia
// dal testo. Tutto poi resta modificabile a mano.
export type QuoteItemLite = { name?: string | null; description?: string | null; amount?: number | null }

const FORMAT_ALIASES: { re: RegExp; key: string }[] = [
  { re: /25\s*[x×]\s*35/i, key: 'LAND_25x35' },
  { re: /30\s*[x×]\s*40/i, key: 'PORT_30x40' },
  { re: /24\s*[x×]\s*30/i, key: 'PORT_24x30' },
  { re: /20\s*[x×]\s*30/i, key: 'PORT_20x30' },
  { re: /30\s*[x×]\s*30/i, key: 'SQ_30' },
  { re: /25\s*[x×]\s*25/i, key: 'SQ_25' },
  { re: /20\s*[x×]\s*20/i, key: 'SQ_20' },
  { re: /40\s*[x×]\s*30/i, key: 'LAND_40x30' },
  { re: /35\s*[x×]\s*25/i, key: 'LAND_35x25' },
  { re: /30\s*[x×]\s*20/i, key: 'LAND_30x20' },
]

// Riconosce se una voce parla di album.
export const looksLikeAlbum = (it: QuoteItemLite): boolean =>
  /album|libro|fotolibro|foto\s*libro/i.test(`${it.name ?? ''} ${it.description ?? ''}`)

// Deduce una config parziale da una voce di preventivo.
export function parseQuoteItem(it: QuoteItemLite): Partial<AlbumPriceConfig> & { detectedFormat?: string } {
  const txt = `${it.name ?? ''} ${it.description ?? ''}`
  const out: Partial<AlbumPriceConfig> & { detectedFormat?: string } = {}
  if (typeof it.amount === 'number' && it.amount > 0) out.base = Math.round(it.amount)
  for (const f of FORMAT_ALIASES) { if (f.re.test(txt)) { out.formatKey = f.key; out.detectedFormat = f.key; break } }
  const pg = txt.match(/(\d{2,3})\s*(?:pagine|pag\.?|facciate|ff\.?)/i)
  if (pg?.[1]) out.includedPages = Math.max(1, parseInt(pg[1], 10))
  if (/\bbox\b|custodia|scatola|cofanetto|astuccio/i.test(txt)) out.box = true
  const famQty = txt.match(/(\d)\s*(?:album\s*)?(?:famiglia|genitori|mini)/i)
  if (/famiglia|genitori|album\s*mini/i.test(txt)) {
    const q = famQty?.[1] ? Math.max(1, parseInt(famQty[1], 10)) : 2
    out.family = { qty: q, base: DEFAULT_FORMAT_PRICE.familyBase, extraPageRate: DEFAULT_FORMAT_PRICE.familyExtraPageRate }
  }
  return out
}
