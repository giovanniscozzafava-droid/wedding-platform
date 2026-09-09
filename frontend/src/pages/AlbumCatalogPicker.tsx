import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { ChevronLeft, Loader2, BookOpenCheck, PenLine, CheckCircle2, Maximize2, Check, ImageIcon } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FORMATS, BOXES, MODELS, FINISHES, sizesForFormat, sizeByKey, designAlbumPriceForLabel, isBaseModelLabel, coverPrice, materialLabel, type Format } from '@/components/album/albumCatalog'
import {
  MATERIAL_OPTIONS, colorOptionsFor, MODEL_GROUPS, LOGO_OPTIONS, logoNeedsColor, logoAmount, BLOCK_OPTIONS, BOX_OPTIONS, FINISH_OPTIONS,
  compositionLines, modelPage, catalogPageToSheet, sheetToPages, familiesOnSheet, familyPageOnSheet, modelsOfFamily, logoTiles, logoColorTiles, optLabel, type CoverComposition,
} from '@/components/album/catalog/coverOptions'
import { SwatchPicker } from '@/components/album/catalog/SwatchPicker'
import { getCoverPhotoCandidates, type CoverPhotoCandidate } from '@/hooks/useAlbumOrder'
import { getFormat } from '@/lib/albumFormats'
import { looksLikeAlbum, parseQuoteItem, euroA } from '@/lib/albumPricing'
import { PdfFlipbook } from '@/components/album/catalog/PdfFlipbook'
import { PdfLightbox } from '@/components/album/catalog/PdfLightbox'
import { PinThreadPanel, type AlbumPin } from '@/components/album/catalog/PinThreadPanel'
import { AlbumScaleFigure } from '@/components/album/catalog/AlbumScaleFigure'
import { SignaturePad } from '@/components/album/catalog/SignaturePad'
import { buildCommissionPdf, downloadBlob } from '@/components/album/catalog/commissionPdf'
import { loadPdf, renderPdfPageDataUrl } from '@/lib/pdf'
import { supabase } from '@/lib/supabase'
import {
  getCatalogForEntry, createCommission, uploadCommissionPdf, catalogPublicUrl, applyMarkup,
  type Catalog, type Hotspot, type CommissionSpecs,
} from '@/hooks/useAlbumCatalog'

// Lato coppia: sfoglia il PDF del proprio fotografo, tocca il modello (hotspot), compila
// le specifiche, FIRMA → genera la commessa PDF (scaricata) e la mette in coda all'azienda.

const SEL = 'mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm disabled:opacity-60'

// Etichetta + «vedi a pag. N» (porta il catalogo alla tavola giusta) + il menu.
function Field({ label, page, onSee, children }: { label: string; page?: number; onSee?: (p?: number) => void; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</label>
        {page && onSee && <button type="button" onClick={() => onSee(page)} className="text-[11px] text-[rgb(var(--gold-700))] hover:underline">vedi a pag. {page}</button>}
      </div>
      {children}
    </div>
  )
}

export default function AlbumCatalogPicker() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [selected, setSelected] = useState<Hotspot | null>(null)
  const [specs, setSpecs] = useState<CommissionSpecs>({ format: 'square', size: '', pages: 40, box: 'nessuno', finishes: [] })
  const [clientName, setClientName] = useState('')
  const [pinNote, setPinNote] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [pins, setPins] = useState<AlbumPin[]>([])
  const [openPin, setOpenPin] = useState<AlbumPin | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [lockedFmt, setLockedFmt] = useState<string | null>(null)  // formato bloccato (se già impaginato)
  const [optioned, setOptioned] = useState(0)                       // importo album già opzionato nel preventivo
  const [quotePages, setQuotePages] = useState<number | null>(null)  // pagine del blocco incluse nel preventivo
  const [familyFromQuote, setFamilyFromQuote] = useState(false)     // album famiglia già nel preventivo
  const [bigOpen, setBigOpen] = useState(false)                     // visore PDF 3D a schermo intero
  // FASE 2 — componenti del listino del fotografo + residuo preventivo (per la rimanenza alla consegna)
  const [listino, setListino] = useState<{ covers: { id: string; label: string; price: number; included?: boolean }[]; accessories: { id: string; label: string; price: number; included?: boolean }[]; shipping: number; quoteTotal: number; quotePaid: number }>({ covers: [], accessories: [], shipping: 0, quoteTotal: 0, quotePaid: 0 })
  const [selCover, setSelCover] = useState<string | null>(null)
  const [selAcc, setSelAcc] = useState<Set<string>>(() => new Set())
  const [sp] = useSearchParams()
  const [deepPage, setDeepPage] = useState<number | null>(null)  // pagina della puntina da aprire (deep-link ?pin=)
  const deepDone = useRef(false)

  async function reloadPins() {
    const { data } = await (supabase.from as any)('album_pins').select('id, entry_id, page, x, y, comment, material, color, status, created_by').eq('entry_id', entryId)
    let list = (data ?? []) as AlbumPin[]
    // Chi ha messo ogni pin (le policy profili non lasciano leggere la coppia: risolvo via RPC).
    try {
      const { data: authors } = await (supabase.rpc as any)('album_pin_author_names', { p_entry_id: entryId })
      const map = new Map<string, { name: string; role: string }>(((authors ?? []) as any[]).map((a) => [a.user_id as string, { name: a.name as string, role: a.role as string }]))
      list = list.map((p) => { const a = p.created_by ? map.get(p.created_by) : undefined; return a ? { ...p, author_name: a.name, author_role: a.role } : p })
    } catch { /* nessun nome: resta l'etichetta generica */ }
    setPins(list)
  }

  useEffect(() => {
    getCatalogForEntry(entryId)
      .then((r) => { if (r) { setCatalog(r.catalog); setHotspots(r.hotspots) } })
      .catch(() => {})
      .finally(() => setLoading(false))
    void reloadPins()
    void (async () => {
      const me = (await supabase.auth.getUser()).data.user?.id
      const { data: gal } = await (supabase.from as any)('event_galleries').select('owner_id').eq('entry_id', entryId).maybeSingle()
      setIsPro(!!me && gal?.owner_id === me)
    })()
    // FORMATO BLOCCATO: se il fotografo ha già impaginato, la coppia non sceglie il formato.
    void (async () => {
      try {
        const { data: proj } = await (supabase.from as any)('album_projects').select('format_key, layout').eq('entry_id', entryId).maybeSingle()
        const pages = (proj?.layout as { pages?: unknown[] } | null)?.pages?.length ?? 0
        if (proj?.format_key && pages > 0) {
          const f = getFormat(proj.format_key as string)
          const fmt: Format = f.w > f.h ? 'landscape' : f.w < f.h ? 'portrait' : 'square'
          const sizeKey = `${fmt}:${Math.round(f.w / 10)}x${Math.round(f.h / 10)}`
          setLockedFmt(f.label.replace(/ ·.*/, ''))
          setSpecs((p) => ({ ...p, format: fmt, size: sizeKey }))
        }
      } catch { /* nessun impaginato */ }
    })()
    // DIFFERENZA: quanto ha già opzionato per l'album nel preventivo.
    void (async () => {
      try {
        const { data } = await (supabase as any).rpc('couple_get_quote_for_entry', { p_entry_id: entryId })
        const items = (data?.items ?? data?.quote?.items ?? []) as { name?: string; line_client?: number; description_snapshot?: string; description?: string }[]
        const album = items.filter((it) => looksLikeAlbum({ name: it.name, description: it.description_snapshot ?? it.description }))
        setOptioned(album.reduce((s, it) => s + (Number(it.line_client) || 0), 0))
        // dalla riga album del preventivo: le pagine del blocco incluse (es. "50 pagine")
        const parsed = album.map((it) => parseQuoteItem({ name: it.name, description: it.description_snapshot ?? it.description, amount: Number(it.line_client) || 0 }))
        const pages = parsed.find((p) => p.includedPages)?.includedPages
        if (pages) { setQuotePages(pages); setSpecs((p) => ({ ...p, pages })) }
        // Box / album famiglia GIÀ nel preventivo → li pre-spunto.
        const allTxt = items.map((it) => `${it.name ?? ''} ${it.description_snapshot ?? it.description ?? ''}`).join(' ')
        if (/\bbox\b|custodia|scatola|cofanetto|astuccio/i.test(allTxt)) setSpecs((p) => (p.box && p.box !== 'nessuno' ? p : { ...p, box: BOXES.find((b) => b.key !== 'nessuno')?.key ?? p.box }))
        if (/famiglia|genitori|album\s*mini/i.test(allTxt)) setFamilyFromQuote(true)
      } catch { /* nessun preventivo */ }
    })()
    // FASE 2: componenti del listino del fotografo + residuo preventivo
    void (async () => {
      try {
        const { data } = await (supabase as any).rpc('album_listino_for_entry', { p_entry: entryId })
        if (data && !data.error) setListino({ covers: data.covers ?? [], accessories: data.accessories ?? [], shipping: Number(data.shipping ?? 0), quoteTotal: Number(data.quote_total ?? 0), quotePaid: Number(data.quote_paid ?? 0) })
      } catch { /* nessun listino */ }
    })()
  }, [entryId])

  // Deep-link dalla notifica: /scegli-album/:entryId?pin=<id> → apre la puntina e porta il PDF alla sua pagina.
  useEffect(() => {
    const pinId = sp.get('pin')
    if (!pinId || deepDone.current || pins.length === 0) return
    const p = pins.find((x) => x.id === pinId)
    if (p) { deepDone.current = true; setDeepPage(p.page); setOpenPin(p) }
  }, [sp, pins])

  const sizes = useMemo(() => sizesForFormat(specs.format as Format), [specs.format])
  useEffect(() => { if (sizes.length && !sizes.find((s) => s.key === specs.size)) setSpecs((p) => ({ ...p, size: sizes[0]!.key })) }, [sizes]) // eslint-disable-line react-hooks/exhaustive-deps

  // COMPOSIZIONE: le opzioni del modello scelte dalla coppia (materiale/colore/logo/foto copertina).
  const [sel, setSel] = useState<{ material?: string; color?: string; logos: string[]; cover: boolean }>({ logos: [], cover: false })
  useEffect(() => { setSel({ logos: [], cover: false }) }, [selected?.id]) // reset a ogni nuovo modello
  const opts = selected?.options ?? {}
  const surcharge = useMemo(() => {
    const find = (arr: { key: string; surcharge: number }[] | undefined, k?: string) => (k ? arr?.find((x) => x.key === k)?.surcharge ?? 0 : 0)
    let s = find(opts.materials, sel.material) + find(opts.colors, sel.color)
    for (const lk of sel.logos) s += find(opts.logos, lk)
    if (sel.cover) s += opts.coverPhotoSurcharge ?? 0
    return s
  }, [opts, sel])
  // Prezzo base del modello: se il fotografo ha messo un prezzo all'hotspot vince; altrimenti lo prendo
  // dal listino DesignAlbum (match per nome) per la GRANDEZZA scelta, col ricarico del fotografo → così
  // cliccando il modello il cliente ha già il costo.
  const basePrice = useMemo(() => {
    if (selected?.price != null) return selected.price
    const dp = designAlbumPriceForLabel(selected?.label ?? '', specs.size)
    if (dp == null) return 0
    return applyMarkup(dp, Number(catalog?.markup_percent ?? 0)) ?? dp
  }, [selected?.price, selected?.label, specs.size, catalog?.markup_percent])
  // COMPOSIZIONE DA CATALOGO: menu a tendina letti dal PDF DesignAlbum (materiali e colori
  // pag. 115–127, personalizzazioni pag. 34–37, blocchi pag. 128, packaging pag. 97). UNA
  // scelta per caratteristica; la foto di copertina si pesca dalla galleria dell'evento.
  const [comp, setComp] = useState<CoverComposition>({ logo: 'nessuno', block: 'digitale', finish: 'nessuna' })
  const [wantPhoto, setWantPhoto] = useState(false)
  const [candidates, setCandidates] = useState<CoverPhotoCandidate[]>([])
  useEffect(() => {
    if (!wantPhoto || candidates.length) return
    void getCoverPhotoCandidates(entryId).then(setCandidates).catch(() => {})
  }, [wantPhoto, entryId, candidates.length])
  // box e finitura viaggiano anche nelle specifiche della commessa (una sola voce)
  useEffect(() => {
    setSpecs((p) => ({
      ...p,
      box: comp.box ?? p.box,
      finishes: comp.finish && comp.finish !== 'nessuna' ? [comp.finish] : [],
    }))
  }, [comp.box, comp.finish])
  const colorOpts = useMemo(() => colorOptionsFor(comp.material), [comp.material])
  // COMPONENTI del listino (copertina + accessori) — 'inclusa' vale 0
  const coverPick = listino.covers.find((c) => c.id === selCover)
  const coverExtra = coverPick && !coverPick.included ? Number(coverPick.price) || 0 : 0
  const accExtra = listino.accessories.filter((a) => selAcc.has(a.id) && !a.included).reduce((s, a) => s + (Number(a.price) || 0), 0)
  const shipping = Number(listino.shipping) || 0
  const residuo = Math.max(0, listino.quoteTotal - listino.quotePaid)

  // PREZZO — regola: la BASE è il modello scelto nel preventivo (misura + blocco pagine);
  // ogni aggiunta si prezza dal listino DesignAlbum (copertina per fascia/materiale/misura,
  // blocco a facciata per misura e tipo, box, personalizzazioni) già col ricarico del
  // fotografo, e la somma delle aggiunte è la DIFFERENZA che la coppia paga.
  const markupPct = Number(catalog?.markup_percent ?? 0)
  const mk = (n: number) => applyMarkup(n, markupPct) ?? n
  const pricing = useMemo(() => {
    type L = { label: string; amount: number; hint?: string }
    const lines: L[] = []
    const sizeKey = specs.size
    const bt = comp.block === 'book-flat' ? 'bookflat' as const : 'photo' as const
    const haveQuote = optioned > 0
    const inclPages = quotePages ?? (haveQuote ? specs.pages : 0)
    // copertina: listino DesignAlbum per fascia × gruppo materiale × misura
    const baseCover = coverPrice({ sizeKey, pages: 0 }).lines[0]?.amount ?? 0               // BASIC, gruppo A = base
    const chosenCover = selected ? (coverPrice({ model: comp.model?.key, fabric: comp.material, sizeKey, pages: 0 }).lines[0]?.amount ?? baseCover) : baseCover
    if (selected && !haveQuote) {
      lines.push({ label: `Copertina ${comp.model?.label ?? selected.label}${comp.material ? ` · ${materialLabel(comp.material)}` : ''}`, amount: mk(chosenCover), hint: 'listino DesignAlbum col ricarico' })
    } else if (selected && chosenCover > baseCover) {
      lines.push({ label: `Copertina ${comp.model?.label ?? selected.label}${comp.material ? ` · ${materialLabel(comp.material)}` : ''}`, amount: mk(chosenCover - baseCover), hint: `listino ${euroA(chosenCover)} − base ${euroA(baseCover)}` })
    }
    // blocco libro: prezzo a facciata del prezziario, per misura e tipo di blocco
    const blockAmt = (pages: number) => coverPrice({ sizeKey, pages, blockType: bt }).lines[1]?.amount ?? 0
    if (!haveQuote) {
      if (specs.pages > 0) lines.push({ label: `Blocco ${bt === 'bookflat' ? 'book flat' : 'digitale'} · ${specs.pages} pagine`, amount: mk(blockAmt(specs.pages)), hint: 'a facciata, listino DesignAlbum' })
    } else if (specs.pages > inclPages) {
      lines.push({ label: `${specs.pages - inclPages} pagine oltre le ${inclPages} del preventivo`, amount: mk(Math.max(0, blockAmt(specs.pages) - blockAmt(inclPages))), hint: 'a facciata, listino DesignAlbum' })
    }
    // personalizzazione nomi/loghi
    const logoAmt = logoAmount(comp.logo)
    if (logoAmt > 0) lines.push({ label: optLabel(LOGO_OPTIONS, comp.logo) ?? 'Personalizzazione', amount: mk(logoAmt) })
    // foto in copertina: dal listino accessori del fotografo (se c'è), altrimenti da confermare
    if (wantPhoto && comp.coverPhoto) {
      const acc = listino.accessories.find((a) => /foto/i.test(a.label))
      if (acc) lines.push({ label: 'Foto in copertina', amount: acc.included ? 0 : mk(Number(acc.price) || 0), hint: acc.included ? 'inclusa' : undefined })
      else lines.push({ label: 'Foto in copertina', amount: 0, hint: 'prezzo da confermare col fotografo' })
    }
    // box: incluso se già nel preventivo, altrimenti listino accessori o riferimento DesignAlbum
    const boxKey = comp.box ?? specs.box
    if (boxKey && boxKey !== 'nessuno') {
      const inQuote = familyFromQuote || (specs.box && specs.box !== 'nessuno' && comp.box === undefined)
      const acc = listino.accessories.find((a) => /box|cofanetto|custodia|scatola|valigetta/i.test(a.label))
      const ref = coverPrice({ sizeKey, pages: 0, box: boxKey }).lines.find((l) => l.label.startsWith('Box'))?.amount ?? 0
      if (inQuote) lines.push({ label: `Box ${optLabel(BOX_OPTIONS, boxKey)}`, amount: 0, hint: 'già nel preventivo' })
      else if (acc) lines.push({ label: `Box ${optLabel(BOX_OPTIONS, boxKey)}`, amount: acc.included ? 0 : mk(Number(acc.price) || 0) })
      else lines.push({ label: `Box ${optLabel(BOX_OPTIONS, boxKey)}`, amount: mk(ref), hint: 'listino DesignAlbum' })
    }
    // finitura
    const fin = FINISHES.find((f) => f.key === comp.finish)
    if (fin) lines.push({ label: fin.label, amount: mk(fin.amount) })
    // opzioni del modello (hotspot AI) e voci del listino del fotografo scelte a parte
    if (surcharge > 0) lines.push({ label: 'Opzioni del modello', amount: surcharge })
    if (coverExtra > 0) lines.push({ label: `Copertina listino · ${coverPick?.label ?? ''}`.trim(), amount: coverExtra })
    if (accExtra > 0) lines.push({ label: 'Accessori del listino', amount: accExtra })
    if (shipping > 0) lines.push({ label: 'Spedizione', amount: shipping })
    const total = lines.reduce((s, l) => s + l.amount, 0)
    return { lines, total, inclPages, haveQuote }
  }, [selected, comp, specs.size, specs.pages, specs.box, optioned, quotePages, wantPhoto, listino, familyFromQuote, surcharge, coverExtra, accExtra, shipping, markupPct, coverPick?.label]) // eslint-disable-line react-hooks/exhaustive-deps
  const albumTotal = pricing.haveQuote ? optioned + pricing.total : pricing.total
  // RIMANENZA ALLA CONSEGNA = residuo preventivo (totale − pagato) + differenza album
  const rimanenza = residuo + pricing.total
  const compComplete = !!comp.material && !!comp.color && !!comp.logo && (!logoNeedsColor(comp.logo) || !!comp.logoColor)
    && !!comp.block && !!(comp.box ?? specs.box) && !!comp.finish && (!wantPhoto || !!comp.coverPhoto)
  const goToPage = (page?: number) => { if (page) setDeepPage(catalogPageToSheet(page)) }
  // il modello si sceglie cliccando sulla pagina (hotspot o puntina) OPPURE dal menu
  function pickModelFromList(key: string) {
    const m = MODELS.find((x) => x.key === key)
    if (!m) return
    const page = modelPage(m.label)
    setSelected({ page: page ? catalogPageToSheet(page) : 1, x: 0, y: 0, w: 0, h: 0, label: m.label })
    setComp((c) => ({ ...c, model: { key: m.key, label: m.label, page } }))
    setSpecs((p) => ({ ...p, format: m.format }))
    goToPage(page)
  }
  // Il modello si IMPORTA dalla spunta: dalla tavola della puntina/hotspot risalgo, con l'indice
  // del catalogo, alle famiglie di modelli stampate su quelle due pagine. Una sola famiglia →
  // il modello si compila da solo; più famiglie → le propongo come tessere sotto «Modello».
  type FamilyPick = { family: string; model: { key: string; label: string; format: string } }
  const sheetFamilies = useMemo<FamilyPick[]>(() => {
    if (!selected) return []
    const out: FamilyPick[] = []
    for (const f of familiesOnSheet(selected.page)) { const m = modelsOfFamily(f)[0]; if (m) out.push({ family: f, model: m }) }
    return out
  }, [selected?.page]) // eslint-disable-line react-hooks/exhaustive-deps
  function applyFamily(fam: FamilyPick) {
    const page = selected ? (familyPageOnSheet(fam.family, selected.page) ?? modelPage(fam.model.label)) : modelPage(fam.model.label)
    setComp((c) => ({ ...c, model: { key: fam.model.key, label: fam.model.label, page } }))
    setSpecs((p) => ({ ...p, format: fam.model.format as Format }))
  }
  useEffect(() => {
    // modello scelto cliccando (hotspot/puntina): entra nella composizione con la sua pagina
    if (!selected) return
    const exact = MODELS.find((m) => m.label === selected.label)
    if (exact) { setComp((c) => (c.model?.key === exact.key ? c : { ...c, model: { key: exact.key, label: exact.label, page: sheetToPages(selected.page)[0] } })); return }
    if (sheetFamilies.length === 1) { applyFamily(sheetFamilies[0]!); return }
    setComp((c) => (c.model?.label === selected.label ? c : { ...c, model: { key: undefined, label: selected.label, page: sheetToPages(selected.page)[0] } }))
  }, [selected?.id, selected?.label]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(h: Hotspot) {
    setSelected(h)
    setSpecs((p) => ({
      ...p,
      format: (h.default_format as string) || p.format,
      pages: h.default_pages ?? p.pages,
    }))
  }
  // Pin: il cliente tocca la pagina → crea un pin PERSISTENTE e apre la conversazione.
  async function dropPin(page: number, x: number, y: number) {
    const { data, error } = await (supabase.from as any)('album_pins')
      .insert({ entry_id: entryId, catalog_id: catalog?.id ?? null, page, x, y, status: 'OPEN' })
      .select('id, entry_id, page, x, y, comment, material, color, status, created_by').single()
    if (error || !data) { toast.error('Pin non salvato'); return }
    setPins((ps) => [...ps, data as AlbumPin])
    setOpenPin(data as AlbumPin)
  }
  // Il cliente conferma un pin → diventa il modello per la commessa, col commento/materiale/colore.
  function onChoosePin(p: AlbumPin) {
    setSelected({ id: p.id, page: p.page, x: p.x, y: p.y, w: 0, h: 0, label: p.comment ? `Modello: ${p.comment.slice(0, 50)}` : `Modello a pag. ${p.page}` })
    setPinNote([p.comment, p.material && `Materiale: ${p.material}`, p.color && `Colore: ${p.color}`, p.logo && `Logo: ${p.logo}`, p.cover_photo && 'Foto in copertina', p.pages && `${p.pages} pagine`].filter(Boolean).join(' · '))
    setOpenPin(null)
    void reloadPins()
  }
  const ready = !!selected && compComplete && !!signature && clientName.trim().length > 1 && !busy

  async function toDataUrl(url: string): Promise<string | null> {
    try {
      const r = await fetch(url); const b = await r.blob()
      return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => res(null); fr.readAsDataURL(b) })
    } catch { return null }
  }

  async function confirm() {
    if (!catalog || !selected) return
    setBusy(true)
    try {
      // miniatura della pagina scelta per il PDF commessa
      let pageImg: string | null = null
      try { const doc = await loadPdf(catalogPublicUrl(catalog.pdf_path)); pageImg = await renderPdfPageDataUrl(doc, selected.page, 900, 0.8) } catch { /* miniatura opzionale */ }

      const sizeLabel = sizes.find((s) => s.key === specs.size)?.label || specs.size
      // COMPOSIZIONE nella commessa: materiale/colore/logo/foto + il prezzo/differenza.
      const lbl = (arr: { key: string; label: string }[] | undefined, k?: string) => (k ? arr?.find((x) => x.key === k)?.label : undefined)
      const chosen = [
        sel.material && `Materiale: ${lbl(opts.materials, sel.material)}`,
        sel.color && `Colore: ${lbl(opts.colors, sel.color)}`,
        sel.logos.length ? `Logo: ${sel.logos.map((k) => lbl(opts.logos, k)).filter(Boolean).join(', ')}` : null,
        sel.cover && 'Foto in copertina',
      ].filter(Boolean).join(' · ')
      const priceLine = pricing.haveQuote
        ? `Nel preventivo ${euroA(optioned)} (${pricing.inclPages} pagine) · aggiunte ${euroA(pricing.total)} · rimanenza alla consegna ${euroA(rimanenza)}`
        : `Album ${euroA(albumTotal)}${shipping > 0 ? ` (incl. spedizione ${euroA(shipping)})` : ''}`
      // la composizione da catalogo, una riga per caratteristica: va nel PDF, nella nota
      // (leggibile ovunque) e come oggetto strutturato nella commessa
      const lines = compositionLines({ ...comp, coverPhoto: wantPhoto ? comp.coverPhoto : null })
      // (le righe della composizione NON vanno anche nella nota: viaggiano a parte, strutturate)
      const composed = [chosen, priceLine, pinNote.trim() || undefined].filter(Boolean).join('\n')
      const fullSpecs = { ...specs, size: sizeLabel, note: composed || undefined }
      const dateLabel = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      const coverPhotoDataUrl = wantPhoto && comp.coverPhoto?.url ? await toDataUrl(comp.coverPhoto.url) : null
      const blob = buildCommissionPdf({
        studio: catalog.studio || 'Studio',
        couple: clientName.trim(),
        modelLabel: selected.label,
        specs: fullSpecs,
        signatureDataUrl: signature,
        pageImageDataUrl: pageImg,
        catalogName: catalog.name,
        dateLabel,
        composition: lines,
        coverPhotoDataUrl,
        pricing: { inQuote: pricing.haveQuote ? optioned : null, includedPages: pricing.haveQuote ? pricing.inclPages : null, additions: pricing.lines, difference: pricing.total, remaining: rimanenza },
      })

      const path = await uploadCommissionPdf(entryId, blob)
      const payload = {
        catalog_id: catalog.id, page: selected.page, model_label: selected.label,
        specs: fullSpecs, signed_by: clientName.trim(),
        signed_at: new Date().toISOString(), commission_pdf_path: path,
        composition: {
          ...comp, coverPhoto: wantPhoto ? comp.coverPhoto : null, lines,
          pricing: { inQuote: pricing.haveQuote ? optioned : null, includedPages: pricing.haveQuote ? pricing.inclPages : null, additions: pricing.lines, difference: pricing.total, remaining: rimanenza, markupPct },
        },
      }
      const orderId = await createCommission(entryId, payload)
      downloadBlob(blob, `commessa-${clientName.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${selected.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`)
      setDoneId(orderId)
      toast.success('Commessa firmata e inviata all’azienda. PDF scaricato.')
    } catch (err) { toast.error((err as Error).message || 'Invio non riuscito') } finally { setBusy(false) }
  }

  if (loading) return <div className="grid place-items-center min-h-[60vh] text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" /></div>

  if (!catalog) return (
    <div className="max-w-xl mx-auto px-6 py-16 text-center">
      <BookOpenCheck size={40} className="mx-auto text-[rgb(var(--gold-500))] mb-3" strokeWidth={1.3} />
      <h1 className="font-display text-2xl mb-2">Catalogo non ancora disponibile</h1>
      <p className="text-[rgb(var(--fg-muted))]">Il tuo fotografo non ha ancora caricato il catalogo album. Riprova più tardi.</p>
      <button onClick={() => navigate(-1)} className="mt-5 text-sm text-[rgb(var(--gold-600))]">Torna indietro</button>
    </div>
  )

  if (doneId) return (
    <div className="max-w-xl mx-auto px-6 py-16 text-center">
      <CheckCircle2 size={48} className="mx-auto text-[rgb(var(--gold-600))] mb-3" />
      <h1 className="font-display text-2xl mb-2">Album confermato e firmato</h1>
      <p className="text-[rgb(var(--fg-muted))] mb-6">Hai scelto <b>{selected?.label}</b>. La copia commessa è stata scaricata e inviata all’azienda tramite il tuo fotografo.</p>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={() => setDoneId(null)}>Scegli un altro album</Button>
        <Button onClick={() => navigate(-1)}>Fine</Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-7">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4 hover:text-[rgb(var(--fg))]">
          <ChevronLeft size={16} /> Indietro
        </button>
        <div className="mb-5">
          <h1 className="font-display text-3xl sm:text-4xl">Scegli il tuo album</h1>
          <p className="text-[rgb(var(--fg-muted))] mt-1">Sfoglia il catalogo di <b>{catalog.studio}</b>, tocca il modello che preferisci, poi firma.</p>
        </div>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 lg:gap-9 items-start">
          <div className="lg:sticky lg:top-5">
            <div className="flex justify-end mb-2">
              <button onClick={() => setBigOpen(true)} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))]">
                <Maximize2 size={15} /> Ingrandisci e sfoglia in 3D
              </button>
            </div>
            <PdfFlipbook pdfUrl={catalogPublicUrl(catalog.pdf_path)} hotspots={hotspots} selected={selected} onPick={pick} onDropPin={dropPin} pins={pins} onOpenPin={setOpenPin} initialPage={deepPage ?? undefined} />
          </div>

          <div className="space-y-5">
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Modello scelto</p>
              {selected
                ? <p className="font-display text-xl text-[rgb(var(--fg))]">{selected.label} <span className="text-xs text-[rgb(var(--fg-subtle))] font-sans">· pag. {selected.page}</span>
                    {isBaseModelLabel(selected.label) && <span className="ml-2 align-middle text-[10px] font-sans uppercase tracking-wide rounded-full bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))] px-2 py-0.5">Base · inclusa</span>}</p>
                : <p className="text-sm text-[rgb(var(--fg-muted))]">Tocca un riquadro sulla pagina per scegliere.</p>}
              {selected && isBaseModelLabel(selected.label) && <p className="text-[11px] text-[rgb(var(--emerald-700))] mt-1">Modello base compreso nel pacchetto: nessun sovrapprezzo.</p>}
            </Card>

            {/* COMPONI LA COPERTINA: menu a tendina dal catalogo, una scelta per voce */}
            <Card className="p-4 space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Componi la copertina</p>
                <p className="text-[12px] text-[rgb(var(--fg-muted))] mt-0.5">Tocca un modello sulla pagina oppure scegli qui sotto. Ogni voce ha una scelta sola: è quella che arriva all'azienda.</p>
              </div>
              <Field label="Modello" page={comp.model?.page} onSee={goToPage}>
                {/* Dalla spunta: le famiglie stampate sulla tavola spuntata, una tessera ciascuna */}
                {selected && sheetFamilies.length > 1 && (
                  <div className="mt-1 mb-1.5">
                    <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Sulla tavola {selected.page} (pag. {sheetToPages(selected.page).join('–')}) ci sono questi modelli: tocca il tuo.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sheetFamilies.map((f) => {
                        const on = comp.model?.key === f.model.key
                        return (
                          <button key={f.family} type="button" onClick={() => applyFamily(f)}
                            className={`rounded-full border px-2.5 py-1 text-xs capitalize transition-colors ${on ? 'border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-50))] text-[rgb(var(--fg))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] hover:border-[rgb(var(--gold-300))]'}`}>
                            {on && <Check size={12} className="inline mr-1 -mt-0.5" />}{f.family}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {selected && sheetFamilies.length === 1 && comp.model?.key && (
                  <p className="mt-1 text-[11px] text-[rgb(var(--emerald-700))]">Importato dalla tua spunta sulla tavola {selected.page}: <b className="capitalize">{sheetFamilies[0]!.family}</b>.</p>
                )}
                <select value={comp.model?.key ?? ''} onChange={(e) => pickModelFromList(e.target.value)} className={SEL}>
                  <option value="">{selected ? `Scelto sulla pagina: ${selected.label}` : 'Scegli un modello…'}</option>
                  {MODEL_GROUPS.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {g.models.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
              {/* Campionature ritagliate dal catalogo: il cliente sceglie dal campione, non da un nome */}
              <Field label="Materiale" page={MATERIAL_OPTIONS.find((o) => o.key === comp.material)?.page ?? 115} onSee={goToPage}>
                <SwatchPicker shape="wide" cols={3} options={MATERIAL_OPTIONS.map((o) => ({ key: o.key, label: o.label, img: o.img, hint: o.page ? `pag. ${o.page}` : undefined }))}
                  value={comp.material} onChange={(k) => setComp((c) => ({ ...c, material: k, color: undefined }))} />
              </Field>
              <Field label="Colore" page={MATERIAL_OPTIONS.find((o) => o.key === comp.material)?.page} onSee={goToPage}>
                <SwatchPicker shape="wide" cols={3} options={colorOpts} value={comp.color} disabled={!comp.material} emptyText="Prima scegli il materiale."
                  onChange={(k) => setComp((c) => ({ ...c, color: k }))} maxH="22rem" />
              </Field>
              <Field label="Personalizzazione (nomi, loghi)" page={LOGO_OPTIONS.find((o) => o.key === comp.logo)?.page ?? 34} onSee={goToPage}>
                <SwatchPicker shape="square" cols={4} fit="contain" options={logoTiles()} value={comp.logo ?? 'nessuno'} maxH="24rem"
                  onChange={(k) => { const v = k ?? 'nessuno'; setComp((c) => ({ ...c, logo: v, logoColor: logoNeedsColor(v) ? c.logoColor : undefined })) }} />
              </Field>
              {logoNeedsColor(comp.logo) && (
                <Field label="Tonalità del logo" page={37} onSee={goToPage}>
                  <SwatchPicker shape="chip" cols={6} options={logoColorTiles()} value={comp.logoColor}
                    onChange={(k) => setComp((c) => ({ ...c, logoColor: k }))} />
                </Field>
              )}
              <Field label="Blocco interno" page={128} onSee={goToPage}>
                <select value={comp.block ?? ''} onChange={(e) => setComp((c) => ({ ...c, block: e.target.value || undefined }))} className={SEL}>
                  {BLOCK_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Box / contenitore" page={97} onSee={goToPage}>
                <select value={comp.box ?? specs.box ?? 'nessuno'} onChange={(e) => setComp((c) => ({ ...c, box: e.target.value }))} className={SEL}>
                  {BOX_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}{o.hint ? ` · ${o.hint}` : ''}</option>)}
                </select>
              </Field>
              <Field label="Finitura">
                <select value={comp.finish ?? 'nessuna'} onChange={(e) => setComp((c) => ({ ...c, finish: e.target.value }))} className={SEL}>
                  {FINISH_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Foto in copertina">
                <select value={wantPhoto ? 'si' : 'no'} onChange={(e) => { const v = e.target.value === 'si'; setWantPhoto(v); if (!v) setComp((c) => ({ ...c, coverPhoto: null })) }} className={SEL}>
                  <option value="no">No</option>
                  <option value="si">Sì, la scelgo dalla galleria</option>
                </select>
              </Field>
              {wantPhoto && (
                <div>
                  <p className="text-[12px] text-[rgb(var(--fg-muted))] mb-1.5 flex items-center gap-1"><ImageIcon size={13} /> Tocca la foto da mettere in copertina (tra quelle scelte per l'album).</p>
                  {candidates.length === 0
                    ? <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna foto scelta per l'album ancora: prima seleziona le foto preferite nella galleria.</p>
                    : (
                      <div className="grid grid-cols-4 gap-1.5 max-h-72 overflow-auto">
                        {candidates.map((c) => {
                          const on = comp.coverPhoto?.mediaId === c.id
                          return (
                            <button key={c.id} type="button" onClick={() => setComp((x) => ({ ...x, coverPhoto: on ? null : { mediaId: c.id, url: c.thumb, label: c.label } }))}
                              className={`relative rounded-lg overflow-hidden border-2 aspect-square ${on ? 'border-[rgb(var(--gold-500))]' : 'border-transparent'}`}>
                              <img src={c.thumb} alt="" className="w-full h-full object-cover" />
                              {on && <span className="absolute top-1 right-1 rounded-full bg-[rgb(var(--gold-500))] text-white p-0.5"><Check size={12} /></span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  {comp.coverPhoto && <p className="text-[12px] text-[rgb(var(--gold-700))] mt-1">Foto scelta: {comp.coverPhoto.label ?? 'selezionata'}</p>}
                </div>
              )}
              {selected && !compComplete && <p className="text-[12px] text-[rgb(var(--fg-subtle))]">Manca una scelta: completa ogni voce per poter firmare.</p>}
            </Card>

            {/* CONTO: nel preventivo / aggiunte (una riga per voce, col ricarico) / differenza */}
            {selected && (
              <div className="rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-50))] px-3 py-2.5 space-y-1.5">
                {pricing.haveQuote ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">Nel preventivo <span className="text-[11px] text-[rgb(var(--fg-muted))]">· {pricing.inclPages} pagine incluse</span></span>
                    <span className="font-medium">{euroA(optioned)}</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-[rgb(var(--fg-muted))]">Nessun album nel preventivo: prezzo pieno dal listino, col ricarico dello studio.</p>
                )}
                {pricing.lines.length > 0 && (
                  <div className="border-t border-[rgb(var(--gold-200))] pt-1.5 space-y-0.5">
                    {pricing.lines.map((l, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-3 text-[12px]">
                        <span className="min-w-0 truncate text-[rgb(var(--fg-muted))]">{l.label}{l.hint ? <span className="text-[10px] text-[rgb(var(--fg-subtle))]"> · {l.hint}</span> : null}</span>
                        <span className="shrink-0">{l.amount > 0 ? `+ ${euroA(l.amount)}` : 'incluso'}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-[rgb(var(--gold-300))] pt-1.5">
                  <span className="text-sm font-medium">{pricing.haveQuote ? 'Differenza' : 'Prezzo album'}</span>
                  <span className="font-display text-lg">{pricing.total > 0 ? `${pricing.haveQuote ? '+ ' : ''}${euroA(pricing.total)}` : 'Nessuna'}</span>
                </div>
                {selected.price != null && basePrice > 0 && !pricing.haveQuote && (
                  <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Prezzo indicato dal fotografo per questo modello: {euroA(basePrice)}.</p>
                )}
              </div>
            )}

            {selected && (!!opts.materials?.length || !!opts.colors?.length || !!opts.logos?.length || !!opts.coverPhoto) && (
              <div className="space-y-3">
                {!!opts.materials?.length && (
                  <div><p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1.5">Materiale</p>
                    <div className="flex flex-wrap gap-1.5">{opts.materials.map((m) => (
                      <button key={m.key} onClick={() => setSel((s) => ({ ...s, material: s.material === m.key ? undefined : m.key }))}
                        className={`px-2.5 py-1 rounded-lg text-xs border ${sel.material === m.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{m.label}{m.surcharge > 0 ? ` · +${euroA(m.surcharge)}` : ''}</button>
                    ))}</div></div>
                )}
                {!!opts.colors?.length && (
                  <div><p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1.5">Colore</p>
                    <div className="flex flex-wrap gap-1.5">{opts.colors.map((c) => (
                      <button key={c.key} onClick={() => setSel((s) => ({ ...s, color: s.color === c.key ? undefined : c.key }))}
                        className={`px-2.5 py-1 rounded-lg text-xs border ${sel.color === c.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{c.label}{c.surcharge > 0 ? ` · +${euroA(c.surcharge)}` : ''}</button>
                    ))}</div></div>
                )}
                {!!opts.logos?.length && (
                  <div><p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1.5">Logo / personalizzazione</p>
                    <div className="flex flex-wrap gap-1.5">{opts.logos.map((l) => (
                      <button key={l.key} onClick={() => setSel((s) => ({ ...s, logos: s.logos.includes(l.key) ? s.logos.filter((x) => x !== l.key) : [...s.logos, l.key] }))}
                        className={`px-2.5 py-1 rounded-lg text-xs border ${sel.logos.includes(l.key) ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{l.label}{l.surcharge > 0 ? ` · +${euroA(l.surcharge)}` : ''}</button>
                    ))}</div></div>
                )}
                {opts.coverPhoto && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sel.cover} onChange={(e) => setSel((s) => ({ ...s, cover: e.target.checked }))} />
                    Foto in copertina{opts.coverPhotoSurcharge ? ` · +${euroA(opts.coverPhotoSurcharge)}` : ''}
                  </label>
                )}
              </div>
            )}

            {/* COMPONENTI del listino del fotografo: copertina + accessori (si sommano; 'inclusa' = 0) */}
            {(listino.covers.length > 0 || listino.accessories.length > 0) && (
              <div className="space-y-3">
                {listino.covers.length > 0 && (
                  <div><p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1.5">Copertina</p>
                    <div className="flex flex-wrap gap-1.5">{listino.covers.map((c) => (
                      <button key={c.id} onClick={() => setSelCover((v) => (v === c.id ? null : c.id))}
                        className={`px-2.5 py-1 rounded-lg text-xs border ${selCover === c.id ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{c.label}{c.included ? ' · inclusa' : c.price > 0 ? ` · +${euroA(c.price)}` : ''}</button>
                    ))}</div></div>
                )}
                {listino.accessories.length > 0 && (
                  <div><p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1.5">Accessori</p>
                    <div className="flex flex-wrap gap-1.5">{listino.accessories.map((a) => (
                      <button key={a.id} onClick={() => setSelAcc((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })}
                        className={`px-2.5 py-1 rounded-lg text-xs border ${selAcc.has(a.id) ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{a.label}{a.included ? ' · incluso' : a.price > 0 ? ` · +${euroA(a.price)}` : ''}</button>
                    ))}</div></div>
                )}
              </div>
            )}

            {/* RIMANENZA ALLA CONSEGNA = residuo preventivo + upgrade album (oltre il contrattualizzato) */}
            {selected && (residuo > 0 || pricing.total > 0) && (
              <div className="rounded-xl border-2 border-[rgb(var(--gold-400))] bg-[rgb(var(--gold-50))] px-3 py-2.5">
                <div className="flex items-center justify-between"><span className="text-sm font-medium">Rimanenza alla consegna</span><span className="font-display text-xl">{euroA(rimanenza)}</span></div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">
                  Residuo preventivo {euroA(residuo)}{pricing.total > 0 ? <> + {pricing.haveQuote ? 'differenza album' : 'album'} <b>{euroA(pricing.total)}</b></> : ''}.
                </p>
                {pricing.haveQuote && <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-0.5">Album completo {euroA(albumTotal)} · già {euroA(optioned)} nel preventivo.</p>}
              </div>
            )}

            {selected && (
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] flex items-center gap-1"><PenLine size={12} /> La tua nota al fotografo</label>
                <textarea value={pinNote} onChange={(e) => setPinNote(e.target.value)} rows={2}
                  placeholder="Scrivi qui cosa vuoi dire su questo modello (come sull'impaginazione dell'album)…"
                  className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
              </div>
            )}

            <div className={selected ? '' : 'opacity-50 pointer-events-none'}>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Formato</p>
                  {lockedFmt ? (
                    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] px-3 py-2 text-sm">
                      <strong>{lockedFmt}</strong> <span className="text-[rgb(var(--fg-muted))]">· già impaginato dal fotografo (non modificabile)</span>
                    </div>
                  ) : (<>
                    <div className="grid grid-cols-3 gap-2">
                      {FORMATS.map((f) => (
                        <button key={f.key} onClick={() => setSpecs((p) => ({ ...p, format: f.key }))}
                          className={`rounded-xl border px-2 py-2 text-sm transition ${specs.format === f.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))]'}`}>{f.label}</button>
                      ))}
                    </div>
                    {!!sizes.length && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {sizes.map((s) => (
                          <button key={s.key} onClick={() => setSpecs((p) => ({ ...p, size: s.key }))}
                            className={`px-2.5 py-1 rounded-md text-xs border transition ${specs.size === s.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{s.label}</button>
                        ))}
                      </div>
                    )}
                  </>)}
                  {(() => { const sd = sizeByKey(specs.size); return sd ? (
                    <div className="mt-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] py-4">
                      <AlbumScaleFigure wCm={sd.w} hCm={sd.h} sizeLabel={sd.label} />
                    </div>
                  ) : null })()}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-[rgb(var(--fg-muted))]">Pagine (fogli)
                    <Input type="number" min={10} max={120} step={2} value={specs.pages}
                      onChange={(e) => setSpecs((p) => ({ ...p, pages: Math.max(10, Math.min(120, Number(e.target.value) || 40)) }))} className="mt-1 w-24" /></label>
                </div>

                {(familyFromQuote || (specs.box && specs.box !== 'nessuno')) && (
                  <p className="text-[11px] text-emerald-600">Già nel tuo preventivo: {[specs.box && specs.box !== 'nessuno' ? 'box' : null, familyFromQuote ? 'album famiglia' : null].filter(Boolean).join(' e ')} — pre-selezionati in «Componi la copertina».</p>
                )}

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Nome e cognome (chi firma)</label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Es. Anna Rossi" className="mt-1" />
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2 flex items-center gap-1"><PenLine size={12} /> Firma</p>
                  <SignaturePad onChange={setSignature} />
                </div>
              </div>
            </div>

            <Button className="w-full" disabled={!ready} onClick={confirm}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Conferma e firma · scarica commessa
            </Button>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Firmando confermi il modello e le specifiche scelte. Ne esce un PDF commessa inviato all’azienda tramite il tuo fotografo.</p>
          </div>
        </div>
      </div>

      {bigOpen && catalog && (
        <PdfLightbox pdfUrl={catalogPublicUrl(catalog.pdf_path)} hotspots={hotspots} selectedId={selected?.id ?? null} onPick={pick} onClose={() => setBigOpen(false)} />
      )}

      {openPin && (
        <PinThreadPanel pin={openPin} entryId={entryId} isPro={isPro}
          onClose={() => { setOpenPin(null); void reloadPins() }}
          onUpdated={(p) => { setPins((ps) => ps.map((x) => x.id === p.id ? p : x)); setOpenPin(p) }}
          onChoose={onChoosePin} />
      )}
    </div>
  )
}
