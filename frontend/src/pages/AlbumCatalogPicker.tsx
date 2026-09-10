import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { ChevronLeft, Loader2, BookOpenCheck, PenLine, CheckCircle2, Maximize2, Check, ImageIcon } from '@/components/icons/lucide'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FORMATS, BOXES, MODELS, FINISHES, sizesForFormat, sizeByKey, designAlbumPriceForLabel, isBaseModelLabel, coverPrice, materialLabel, paletteFor, type Format } from '@/components/album/albumCatalog'
import type { GlbCover, GlbView, AlbumGlbStageHandle } from '@/components/album/glb/AlbumGlbStage'
import { buildCoverPsd } from '@/components/album/glb/coverPsd'
import { LAYOUT_SPEC, inkRgb, logoToInk } from '@/components/album/glb/layoutSpec'
import { hasLogoTemplate } from '@/components/album/glb/logoTemplates'
import { composeLogo, fontsOf, loadLogoFont } from '@/components/album/glb/logoCompose'
import { dateIt, decorFor, decorFamily } from '@/components/album/glb/decal'
import { decorLabel } from '@/components/album/glb/decorLabel'
import { corsImageUrl } from '@/components/album/glb/imageUrl'
import { modelLayout } from '@/components/album/albumCatalog'
import { swatchUrl } from '@/components/album/catalog/swatches.generated'
import {
  MATERIAL_OPTIONS, colorOptionsFor, MODEL_GROUPS, LOGO_OPTIONS, logoNeedsColor, logoAmount, BLOCK_OPTIONS, BOX_OPTIONS, FINISH_OPTIONS,
  compositionLines, modelPage, catalogPageToSheet, sheetToPages, familiesOnSheet, familyPageOnSheet, modelsOfFamily, logoTiles, logoColorTiles, modelTiles, familyOf, FAMILY_PAGES, optLabel, type CoverComposition,
} from '@/components/album/catalog/coverOptions'
import { SwatchPicker } from '@/components/album/catalog/SwatchPicker'
import { CoverPhotoPicker } from '@/components/album/catalog/CoverPhotoPicker'
import { CoverLayoutEditor } from '@/components/album/catalog/CoverLayoutEditor'
import { Chapter, Voice, PillChoice, ChoiceSheet, type SheetRow } from '@/components/album/catalog/CatalogUi'
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
  getCatalogForEntry, createCommission, uploadCommissionPdf, uploadCommissionFile, catalogPublicUrl, applyMarkup,
  type Catalog, type Hotspot, type CommissionSpecs,
} from '@/hooks/useAlbumCatalog'

// Lato coppia: sfoglia il PDF del proprio fotografo, tocca il modello (hotspot), compila
// le specifiche, FIRMA → genera la commessa PDF (scaricata) e la mette in coda all'azienda.

// L'album 3D (three.js) è pesante: si carica solo quando serve, in un chunk a parte.
const AlbumGlbStage = lazy(() => import('@/components/album/glb/AlbumGlbStage').then((m) => ({ default: m.AlbumGlbStage })))
const AlbumFlipbook = lazy(() => import('@/components/album/AlbumFlipbook').then((m) => ({ default: m.AlbumFlipbook })))

const hexLum = (h: string) => { const n = parseInt(h.replace('#', ''), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255 }

const MODEL_TILES = modelTiles()
const LOGO_TILES = logoTiles()
const LOGO_COLOR_TILES = logoColorTiles()
const familyKeyOf = (label?: string) => familyOf(label)

const SEL = 'mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm disabled:opacity-60'

export default function AlbumCatalogPicker() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [selected, setSelected] = useState<Hotspot | null>(null)
  const [specs, setSpecs] = useState<CommissionSpecs>({ format: 'square', size: '', pages: 40, box: 'nessuno', finishes: [] })
  const [clientName, setClientName] = useState('')
  const [entryTitle, setEntryTitle] = useState('')   // nomi della coppia per la copertina 3D (titolo dell'evento)
  const [entryDate, setEntryDate] = useState<string | null>(null)
  const [pinNote, setPinNote] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [pins, setPins] = useState<AlbumPin[]>([])
  const [openPin, setOpenPin] = useState<AlbumPin | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [lockedFmt, setLockedFmt] = useState<string | null>(null)  // formato bloccato (se già impaginato)
  const [lockedPages, setLockedPages] = useState<number | null>(null)  // pagine dell'impaginato (non modificabili)
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
      const { data: ent } = await (supabase.from as any)('calendar_entries').select('title, date_from').eq('id', entryId).maybeSingle()
      if (ent?.title) setEntryTitle(String(ent.title).replace(/^matrimonio\s+/i, '').replace(/\s*[—–-]\s*preventivo$/i, '').trim())
      if (ent?.date_from) setEntryDate(String(ent.date_from))
    })()
    // FORMATO BLOCCATO: se il fotografo ha già impaginato, la coppia non sceglie il formato.
    void (async () => {
      try {
        const { data: proj } = await (supabase.from as any)('album_projects').select('format_key, layout').eq('entry_id', entryId).maybeSingle()
        const pages = (proj?.layout as { pages?: unknown[] } | null)?.pages?.length ?? 0
        if (proj?.format_key && pages > 0) {
          // formato E pagine vengono dall'impaginato: l'album 3D ha le proporzioni vere (40×30, 30×40, 25×25…)
          // e la coppia non li sceglie più
          const f = getFormat(proj.format_key as string)
          const fmt: Format = f.w > f.h ? 'landscape' : f.w < f.h ? 'portrait' : 'square'
          const cm = (mm: number) => Math.round(mm / 5) / 2   // al mezzo centimetro (12.5, 22.5…)
          const sizeKey = `${fmt}:${cm(f.w)}x${cm(f.h)}`
          setLockedFmt(`${cm(f.w)}×${cm(f.h)} cm · ${fmt === 'landscape' ? 'orizzontale' : fmt === 'portrait' ? 'verticale' : 'quadrato'}`)
          setLockedPages(pages)
          setSpecs((p) => ({ ...p, format: fmt, size: sizeKey, pages }))
          // il tipo di blocco, se il fotografo l'ha opzionato dall'impaginatore (price_config.block / layout.block_type)
          const bt = String((proj?.price_config as { block?: string } | null)?.block ?? (proj?.layout as { block_type?: string } | null)?.block_type ?? '')
          if (/book.?flat/i.test(bt)) setComp((c) => ({ ...c, block: 'book-flat' }))
          else if (/tradiz/i.test(bt)) setComp((c) => ({ ...c, block: 'tradizionale' }))
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

  // Arrivo dal funnel «impaginazione approvata» (?da=impaginato): un saluto e via col primo passo
  useEffect(() => { if (sp.get('da') === 'impaginato') toast.success('Impaginazione approvata: ora la copertina. Un passo alla volta.') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Deep-link dalla notifica: /scegli-album/:entryId?pin=<id> → apre la puntina e porta il PDF alla sua pagina.
  useEffect(() => {
    const pinId = sp.get('pin')
    if (!pinId || deepDone.current || pins.length === 0) return
    const p = pins.find((x) => x.id === pinId)
    if (p) { deepDone.current = true; setDeepPage(p.page); setOpenPin(p) }
  }, [sp, pins])

  const sizes = useMemo(() => sizesForFormat(specs.format as Format), [specs.format])
  // se la coppia cambia formato, la misura passa alla prima di quel formato; la misura dell'impaginato (anche fuori
  // tabella, es. 28×21) non va mai sovrascritta
  useEffect(() => { if (lockedFmt) return; if (sizes.length && !(specs.size ?? '').startsWith(`${specs.format}:`)) setSpecs((p) => ({ ...p, size: sizes[0]!.key })) }, [sizes, lockedFmt]) // eslint-disable-line react-hooks/exhaustive-deps

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
  // QUANTE FOTO in copertina: tante quante le finestre del modello (Julies Cristalwhite e Trilogy ne hanno tre,
  // in ordine da sinistra a destra); i modelli senza finestra ne accettano una (stampa)
  const modelLayoutKey = modelLayout(comp.model?.key)
  const photoWindows = Math.max(1, LAYOUT_SPEC[modelLayoutKey].photos.length)
  const chosenPhotos = useMemo(() => (comp.coverPhotos?.length ? comp.coverPhotos : comp.coverPhoto ? [comp.coverPhoto] : []).slice(0, photoWindows), [comp.coverPhotos, comp.coverPhoto, photoWindows])
  const photosOk = !wantPhoto || chosenPhotos.length >= photoWindows
  // un modello con le finestre foto è fatto per le foto: la scelta si accende da sola
  useEffect(() => { if (LAYOUT_SPEC[modelLayoutKey].photos.length > 0) setWantPhoto(true) }, [modelLayoutKey])
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
  const backColorOpts = useMemo(() => colorOptionsFor(comp.backMaterial), [comp.backMaterial])
  const boxColorOpts = useMemo(() => colorOptionsFor(comp.boxMaterial), [comp.boxMaterial])
  const [boxDiff, setBoxDiff] = useState(false)            // rivestimento del box diverso dalla copertina
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
    // (ogni foto segna il suo costo: i modelli a tre finestre ne contano tre)
    if (wantPhoto && chosenPhotos.length) {
      const n = chosenPhotos.length
      const acc = listino.accessories.find((a) => /foto/i.test(a.label))
      if (acc) lines.push({ label: `Foto in copertina${n > 1 ? ` × ${n}` : ''}`, amount: acc.included ? 0 : mk((Number(acc.price) || 0) * n), hint: acc.included ? 'inclusa' : (n > 1 ? `${euroA(mk(Number(acc.price) || 0))} a foto` : undefined) })
      else lines.push({ label: `Foto in copertina${n > 1 ? ` × ${n}` : ''}`, amount: 0, hint: 'prezzo da confermare col fotografo' })
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
      // rivestimento diverso dalla copertina: voce a sé (il prezzo lo conferma il fotografo)
      if (comp.boxMaterial) lines.push({ label: `Rivestimento box · ${materialLabel(comp.boxMaterial)}`, amount: 0, hint: 'prezzo da confermare col fotografo' })
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
  // L'ALBUM 3D si ridisegna a ogni scelta: le voci del catalogo diventano una Cover del mockup
  // (modello → layout della tavola, materiale/colore → superficie e tinta, formato, box, foto, rifiniture).
  const [view3d, setView3d] = useState<GlbView>('three-quarter')
  // IL PERCORSO A PASSI: si avanza solo con la scelta fatta; si può tornare a un passo già visto
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  useEffect(() => { setMaxStep((m) => Math.max(m, step)); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])
  const [backDiff, setBackDiff] = useState(false)          // retro e dorso di un altro materiale/colore
  const [flipOpen, setFlipOpen] = useState(false)          // sfoglio 3D con le foto della selezione
  const [flipPhotos, setFlipPhotos] = useState<string[]>([])
  const [photoSheet, setPhotoSheet] = useState(false)      // foglio a schermo intero per scegliere la foto in copertina
  const [photosLoading, setPhotosLoading] = useState(false)
  const stageRef = useRef<AlbumGlbStageHandle>(null)
  const cover3d = useMemo<GlbCover>(() => {
    const fin = new Set<string>()
    if (comp.finish && comp.finish !== 'nessuna') fin.add(comp.finish)
    if (comp.logo === 'swarovski') fin.add('swarovski')
    else if (comp.logo === 'ottone-targhetta') fin.add('targhetta')
    else if (comp.logo === 'ottone-iniziali' || comp.logo === 'alluminio-lettere') fin.add('iniziali')
    else if (comp.logo && comp.logo !== 'nessuno') fin.add('logo')
    const hex = comp.material ? paletteFor(comp.material).find((c) => c.key === comp.color)?.hex : undefined
    return {
      model: comp.model?.key ?? MODELS.find((m) => m.label === selected?.label)?.key,
      fabric: comp.material, colorKey: comp.color, color: hex,
      format: specs.format as Format, sizeKey: specs.size, pages: specs.pages,
      blockType: comp.block === 'book-flat' ? 'bookflat' : 'photo',
      box: comp.box ?? specs.box, finishes: Array.from(fin),
      photo_url: wantPhoto ? comp.coverPhoto?.url ?? null : null,
      photo_urls: wantPhoto ? chosenPhotos.map((p) => p.url) : [],
      backFabric: comp.backMaterial, backColorKey: comp.backColor,
      backColor: comp.backMaterial ? paletteFor(comp.backMaterial).find((c) => c.key === comp.backColor)?.hex : undefined,
      boxFabric: comp.boxMaterial, boxColorKey: comp.boxColor,
      boxColor: comp.boxMaterial ? paletteFor(comp.boxMaterial).find((c) => c.key === comp.boxColor)?.hex : undefined,
      photoCrops: comp.photoCrops, logoPlace: comp.logoPlace,
      title: entryTitle || clientName.trim() || '',
      logoKey: comp.logo && comp.logo !== 'nessuno' && /^cod\./.test(comp.logo) ? comp.logo : undefined,
      eventDate: entryDate,
      ink: comp.logoColor === 'bianco' ? 'white' : comp.logoColor?.startsWith('grigio') ? 'silver' : (hex && hexLum(hex) < 0.5) ? 'white' : 'ink',
    }
  }, [comp, selected?.label, specs.format, specs.size, specs.pages, specs.box, wantPhoto, clientName, entryTitle, entryDate])
  // LA SCHEDA: una riga per caratteristica, con la miniatura del campione scelto
  const sheetRows = useMemo<SheetRow[]>(() => {
    const col = colorOpts.find((o) => o.key === comp.color)
    const logo = LOGO_TILES.find((o) => o.key === comp.logo)
    const decor = decorFor(comp.model?.key)
    const rows: SheetRow[] = [
      { label: 'Modello', value: comp.model?.label ?? selected?.label, img: swatchUrl(`model:${familyOf(comp.model?.label ?? selected?.label)}`), missing: true },
      // il decoro proprio del modello (fiori, mandala, piastra intagliata…), ritagliato dal catalogo
      ...(decor ? [{ label: 'Decoro del modello', value: decorLabel(decor), img: decor.print, fit: 'contain' as const }] : []),
      { label: 'Materiale', value: comp.material ? materialLabel(comp.material) : undefined, img: swatchUrl(`mat:${comp.material}`), missing: true },
      { label: 'Colore', value: col?.label, img: col?.img, hex: col?.hex, missing: true },
      ...(backDiff ? [{ label: 'Retro e dorso', value: comp.backMaterial ? `${materialLabel(comp.backMaterial)}${backColorOpts.find((o) => o.key === comp.backColor)?.label ? ` · ${backColorOpts.find((o) => o.key === comp.backColor)!.label}` : ''}` : undefined, img: backColorOpts.find((o) => o.key === comp.backColor)?.img ?? swatchUrl(`mat:${comp.backMaterial}`), hex: backColorOpts.find((o) => o.key === comp.backColor)?.hex, missing: true } as SheetRow] : []),
      { label: 'Nomi e loghi', value: comp.logo && comp.logo !== 'nessuno' ? optLabel(LOGO_OPTIONS, comp.logo) : 'Nessuna', img: logo?.img, fit: 'contain' },
    ]
    if (logoNeedsColor(comp.logo)) rows.push({ label: 'Tonalità', value: optLabel(LOGO_COLOR_TILES, comp.logoColor), img: swatchUrl(comp.logoColor), missing: true })
    // l'impaginazione della copertina fatta dalla coppia (editor): dove stanno nomi/logo e se le foto sono state ritagliate
    const cropped = Object.values(comp.photoCrops ?? {}).some((k) => k.zoom > 1.01 || Math.abs(k.ox) > 0.01 || Math.abs(k.oy) > 0.01)
    if (comp.logoPlace || cropped) rows.push({ label: 'Impaginazione copertina', value: [comp.logoPlace ? `nomi/logo al ${Math.round(comp.logoPlace.x * 100)}% da sinistra, ${Math.round(comp.logoPlace.y * 100)}% dall'alto, larghi il ${Math.round(comp.logoPlace.w * 100)}%` : null, cropped ? 'foto ritagliate a mano' : null].filter(Boolean).join(' · ') })
    rows.push(
      { label: 'Blocco', value: optLabel(BLOCK_OPTIONS, comp.block)?.replace(/\s*\(.*\)$/, ''), missing: true },
      { label: 'Box', value: `${optLabel(BOX_OPTIONS, comp.box ?? specs.box ?? 'nessuno')}${(comp.box ?? specs.box) && (comp.box ?? specs.box) !== 'nessuno' ? (comp.boxMaterial ? ` · ${materialLabel(comp.boxMaterial)}${boxColorOpts.find((o) => o.key === comp.boxColor)?.label ? ` ${boxColorOpts.find((o) => o.key === comp.boxColor)!.label}` : ''}` : ' · come la copertina') : ''}`, img: comp.boxMaterial ? (boxColorOpts.find((o) => o.key === comp.boxColor)?.img ?? swatchUrl(`mat:${comp.boxMaterial}`)) : undefined, hex: boxColorOpts.find((o) => o.key === comp.boxColor)?.hex },
      { label: 'Finitura', value: optLabel(FINISH_OPTIONS, comp.finish ?? 'nessuna') },
      { label: photoWindows > 1 ? `Foto in copertina (${photoWindows} finestre)` : 'Foto in copertina', value: wantPhoto ? (chosenPhotos.length ? (photoWindows > 1 ? `${chosenPhotos.length} di ${photoWindows}, in ordine: ${chosenPhotos.map((p) => p.label ?? 'dalla galleria').join(' · ')}` : (comp.coverPhoto?.label ?? 'scelta dalla galleria')) : undefined) : 'No', img: wantPhoto ? chosenPhotos[0]?.url : undefined, missing: wantPhoto },
    )
    return rows
  }, [comp, selected, colorOpts, backColorOpts, backDiff, specs.box, wantPhoto])
  // RIMANENZA ALLA CONSEGNA = residuo preventivo (totale − pagato) + differenza album
  const rimanenza = residuo + pricing.total
  const STEPS = ['Modello', 'Materiale e colore', 'Nomi e loghi', 'Box e finitura', 'Copertina', 'La scheda', 'Firma']
  // IL BLOCCO NOMI/LOGO per l'editor della copertina: il logo ricomposto coi nomi veri (o il ritaglio del
  // catalogo tinto), come immagine; senza logo restano i nomi
  const [logoImg, setLogoImg] = useState<{ url: string; aspect: number } | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      const key = cover3d.logoKey
      if (!key) { setLogoImg(null); return }
      if (hasLogoTemplate(key)) {
        await Promise.all(fontsOf(key).map(loadLogoFont))
        const cv = composeLogo({ code: key, names: cover3d.title, date: dateIt(entryDate), ink: inkRgb(cover3d.ink) }, 900)
        if (alive && cv) { setLogoImg({ url: cv.toDataURL('image/png'), aspect: cv.height / cv.width }); return }
      }
      const im = new Image(); im.crossOrigin = 'anonymous'
      im.onload = () => { if (!alive) return; const c = logoToInk(im, 900, Math.round(900 * im.naturalHeight / im.naturalWidth), inkRgb(cover3d.ink)); setLogoImg({ url: c.toDataURL('image/png'), aspect: c.height / c.width }) }
      im.onerror = () => alive && setLogoImg(null)
      im.src = swatchUrl(key) ?? ''
    })()
    return () => { alive = false }
  }, [cover3d.logoKey, cover3d.title, cover3d.ink, entryDate])
  const defaultPlace = { x: LAYOUT_SPEC[modelLayoutKey].logo.x, y: LAYOUT_SPEC[modelLayoutKey].logo.y, w: LAYOUT_SPEC[modelLayoutKey].logo.w }
  const stepOk = step === 0 ? !!(comp.model?.key || selected)
    : step === 1 ? !!comp.material && !!comp.color && (!backDiff || (!!comp.backMaterial && !!comp.backColor))
    : step === 2 ? !!comp.logo && (!logoNeedsColor(comp.logo) || !!comp.logoColor)
    : step === 3 ? !!comp.block && !!(comp.box ?? specs.box) && !!comp.finish && photosOk && (!boxDiff || (!!comp.boxMaterial && !!comp.boxColor))
    : true
  const stepHint = step === 0 ? 'Tocca un modello (o spunta una tavola)' : step === 1 ? 'Materiale e colore, poi Avanti' : step === 2 ? 'Un logo o nessuna personalizzazione' : step === 3 ? (!photosOk ? (photoWindows > 1 ? `Scegli le ${photoWindows} foto in copertina` : 'Scegli la foto in copertina') : 'Interno, box, finitura, foto') : ''
  const compComplete = !!comp.material && !!comp.color && !!comp.logo && (!logoNeedsColor(comp.logo) || !!comp.logoColor) && (!backDiff || (!!comp.backMaterial && !!comp.backColor))
    && !!comp.block && !!(comp.box ?? specs.box) && !!comp.finish && photosOk
  const goToPage = (page?: number) => { if (page) setDeepPage(catalogPageToSheet(page)) }
  async function openPhotoSheet() {
    setPhotoSheet(true)
    if (!candidates.length) { setPhotosLoading(true); try { setCandidates(await getCoverPhotoCandidates(entryId)) } catch { /* nessuna foto */ } finally { setPhotosLoading(false) } }
  }
  // SFOGLIA: la copertina si apre e si girano le facciate con le foto scelte per l'album (selezione KEPT)
  async function openFlip() {
    let list = candidates
    if (!list.length) { try { list = await getCoverPhotoCandidates(entryId); setCandidates(list) } catch { list = [] } }
    setFlipPhotos(list.map((c) => corsImageUrl(c.thumb, 1200) ?? c.thumb).filter(Boolean).slice(0, 40))
    setFlipOpen(true)
  }
  // il modello si sceglie cliccando sulla pagina (hotspot o puntina) OPPURE dal menu
  function pickModelFromList(key: string) {
    const m = MODELS.find((x) => x.key === key)
    if (!m) return
    const page = modelPage(m.label)
    setSelected({ page: page ? catalogPageToSheet(page) : 1, x: 0, y: 0, w: 0, h: 0, label: m.label })
    setComp((c) => ({ ...c, model: { key: m.key, label: m.label, page } }))
    // il formato dell'impaginato (se c'è già) vince sul formato di listino del modello
    if (!lockedFmt) setSpecs((p) => ({ ...p, format: m.format }))
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
    if (!lockedFmt) setSpecs((p) => ({ ...p, format: fam.model.format as Format }))
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
      format: lockedFmt ? p.format : ((h.default_format as string) || p.format),
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
      const lines = compositionLines({ ...comp, coverPhoto: wantPhoto ? comp.coverPhoto : null, coverPhotos: wantPhoto ? chosenPhotos : [] })
      // (le righe della composizione NON vanno anche nella nota: viaggiano a parte, strutturate)
      const composed = [chosen, priceLine, pinNote.trim() || undefined].filter(Boolean).join('\n')
      const fullSpecs = { ...specs, size: sizeLabel, note: composed || undefined }
      const dateLabel = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      // la foto scelta, in alta risoluzione e con CORS (Drive passa dal proxy): serve al PDF e al PSD a 300 dpi
      // una per finestra (Julies/Trilogy: tre), in ordine; la prima va anche nel PDF
      const coverPhotoDataUrls: (string | null)[] = wantPhoto ? await Promise.all(chosenPhotos.map((p) => toDataUrl(corsImageUrl(p.url, 2400) ?? p.url))) : []
      const coverPhotoDataUrl = coverPhotoDataUrls[0] ?? null
      // TAVOLA DI LAVORAZIONE: PSD a livelli a misura reale (300 dpi), mockup 3D, tavola 2D, posizioni in mm
      const orderRef = `${clientName.trim()} · ${new Date().toISOString().slice(0, 10)}`
      const sizeDef = sizeByKey(specs.size)
      const layout = modelLayout(cover3d.model)
      const loadImg = (url?: string | null) => new Promise<HTMLImageElement | null>((res) => { if (!url) return res(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url })
      const photoImgs = await Promise.all(coverPhotoDataUrls.map((u) => loadImg(u)))
      // il logo: ricostruito con i nomi veri (font caricati) se c'è il template, altrimenti il ritaglio del catalogo
      let logoForPsd: { image: HTMLImageElement | HTMLCanvasElement; code: string; composed?: boolean } | null = null
      if (cover3d.logoKey && hasLogoTemplate(cover3d.logoKey)) {
        await Promise.all(fontsOf(cover3d.logoKey).map(loadLogoFont))
        const cv = composeLogo({ code: cover3d.logoKey, names: cover3d.title, date: dateIt(entryDate), ink: inkRgb(cover3d.ink) }, 2400)
        if (cv) logoForPsd = { image: cv, code: cover3d.logoKey, composed: true }
      }
      if (!logoForPsd && cover3d.logoKey) { const im = await loadImg(swatchUrl(cover3d.logoKey)); if (im) logoForPsd = { image: im, code: cover3d.logoKey } }
      // il decoro proprio del modello (fiori, mandala, ninfee, sposini, albero…): stampa + cristalli nel PSD
      const decorSpec = decorFor(cover3d.model)
      const decorForPsd = decorSpec ? { family: decorFamily(cover3d.model), spec: decorSpec, print: await loadImg(decorSpec.print), stones: decorSpec.stones ? await loadImg(decorSpec.stones) : null } : null
      const psd = sizeDef ? buildCoverPsd({
        layout, wCm: sizeDef.w, hCm: sizeDef.h, dpi: 300, modelLabel: comp.model?.label ?? selected.label,
        materialLabel: comp.material ? materialLabel(comp.material) : undefined, colorLabel: colorOpts.find((o) => o.key === comp.color)?.label, colorHex: cover3d.color,
        photos: LAYOUT_SPEC[layout].photos.map((_, i) => photoImgs[i] ?? photoImgs[0] ?? null), logo: logoForPsd, decor: decorForPsd,
        photoCrops: comp.photoCrops, logoPlace: comp.logoPlace,
        names: cover3d.title, ink: cover3d.ink === 'white' ? '#f6f1e8' : cover3d.ink === 'gold' ? '#d4b060' : cover3d.ink === 'silver' ? '#d7d7dc' : '#3a2c1e',
        couple: clientName.trim(), studio: catalog.studio, orderRef,
      }) : null
      const fileBase = `copertina-${clientName.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${(comp.model?.label ?? selected.label).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
      let psdPath: string | null = null, mockupPath: string | null = null, mockupDataUrl: string | null = null
      try {
        mockupDataUrl = stageRef.current?.snapshot() ?? null
        if (psd) psdPath = await uploadCommissionFile(entryId, psd.blob, 'psd', 'image/vnd.adobe.photoshop', fileBase)
        if (mockupDataUrl) { const b = await (await fetch(mockupDataUrl)).blob(); mockupPath = await uploadCommissionFile(entryId, b, 'png', 'image/png', `${fileBase}-mockup`) }
      } catch (e) { console.warn('allegati commessa', e) }
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
        workSheet: { mockupDataUrl, tavolaDataUrl: psd?.tavolaDataUrl ?? null, coverCm: sizeDef ? { w: sizeDef.w, h: sizeDef.h } : undefined, positions: psd?.positions, psdName: psdPath ? `${fileBase}.psd` : null, layoutLabel: layout },
      })

      const path = await uploadCommissionPdf(entryId, blob)
      const payload = {
        catalog_id: catalog.id, page: selected.page, model_label: selected.label,
        specs: fullSpecs, signed_by: clientName.trim(),
        signed_at: new Date().toISOString(), commission_pdf_path: path,
        psd_path: psdPath, mockup_path: mockupPath, positions_mm: psd?.positions ?? null,
        composition: {
          ...comp, coverPhoto: wantPhoto ? comp.coverPhoto : null, lines,
          pricing: { inQuote: pricing.haveQuote ? optioned : null, includedPages: pricing.haveQuote ? pricing.inclPages : null, additions: pricing.lines, difference: pricing.total, remaining: rimanenza, markupPct },
        },
      }
      const orderId = await createCommission(entryId, payload)
      downloadBlob(blob, `commessa-${clientName.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${selected.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`)
      if (psd) downloadBlob(psd.blob, `${fileBase}.psd`)
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
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-[rgb(var(--border))] pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--gold-700))]">Catalogo album · {catalog.studio}</p>
            <h1 className="font-display text-3xl sm:text-4xl mt-1">Il tuo album</h1>
            <p className="text-[rgb(var(--fg-muted))] mt-1 max-w-xl">Sfoglia le tavole, spunta ciò che ti piace e componi la copertina con le campionature vere del catalogo. Alla fine firmi: la scheda va all'azienda tramite il tuo fotografo.</p>
          </div>
          <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Tavole DesignAlbum 2022 · una scelta per voce</p>
        </div>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 lg:gap-9 items-start">
          <div className="lg:sticky lg:top-5">
            {/* L'ALBUM IN 3D, per primo: si aggiorna a ogni scelta fatta nei capitoli */}
            <div className="mb-5 max-w-[520px] mx-auto">
              <div className="flex items-baseline justify-between border-b border-[rgb(var(--border))] pb-1.5 mb-3">
                <p className="font-display text-lg">Il tuo album in 3D</p>
                <p className="text-[11px] text-[rgb(var(--fg-subtle))]">si aggiorna a ogni scelta</p>
              </div>
              <div className="relative rounded-3xl overflow-hidden border border-[rgb(var(--border))] shadow-[0_18px_50px_rgba(20,18,14,.14)]"
                style={{ background: 'radial-gradient(120% 90% at 50% 18%, rgb(var(--bg-elev)) 0%, rgb(var(--bg-sunken)) 58%, rgb(var(--gold-100)/.5) 130%)' }}>
                <div className="aspect-[4/3] w-full">
                  <Suspense fallback={<div className="h-full w-full grid place-items-center text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" /></div>}>
                    <AlbumGlbStage ref={stageRef} cover={cover3d} view={view3d} width={620} />
                  </Suspense>
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))]/90 backdrop-blur px-1.5 py-1 shadow">
                  {([['front', 'Fronte'], ['three-quarter', '3/4'], ['spine', 'Dorso'], ['top', 'Dall\'alto']] as [GlbView, string][]).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setView3d(k)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${view3d === k ? 'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]'}`}>{l}</button>
                  ))}
                </div>
                <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] bg-[rgb(var(--bg-elev))]/70 backdrop-blur rounded-full px-2.5 py-1">trascina per girare · {sizeByKey(specs.size)?.label ?? ''}</span>
              </div>
              <div className="mt-2 flex justify-center">
                <button type="button" onClick={() => void openFlip()}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] hover:border-[rgb(var(--gold-300))] transition-colors">
                  <BookOpenCheck size={14} /> Sfoglia l'album con le vostre foto
                </button>
              </div>
            </div>
            {flipOpen && (
              <Suspense fallback={null}>
                <AlbumFlipbook cover={cover3d} photos={flipPhotos} onClose={() => setFlipOpen(false)} />
              </Suspense>
            )}

            {/* LE TAVOLE DEL CATALOGO: si sfogliano e si spuntano */}
            <div className="flex items-baseline justify-between mb-2">
              <p className="font-display text-lg">Le tavole del catalogo</p>
              <button onClick={() => setBigOpen(true)} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))]">
                <Maximize2 size={15} /> Ingrandisci e sfoglia in 3D
              </button>
            </div>
            <PdfFlipbook pdfUrl={catalogPublicUrl(catalog.pdf_path)} hotspots={hotspots} selected={selected} onPick={pick} onDropPin={dropPin} pins={pins} onOpenPin={setOpenPin} initialPage={deepPage ?? undefined} />
          </div>

          <div className="space-y-5">
            {/* IL PERCORSO: un passo alla volta, col 3D sempre in vista */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {STEPS.map((s, i) => (
                <button key={s} type="button" onClick={() => { if (i <= maxStep) setStep(i) }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] border transition-colors ${i === step ? 'border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : i <= maxStep ? 'border-[rgb(var(--border))] text-[rgb(var(--fg))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-subtle))] opacity-60'}`}>
                  {i + 1}. {s}
                </button>
              ))}
            </div>
            {/* ============ CAPITOLI DEL CATALOGO (una scelta per voce: è quella che arriva all'azienda) ============ */}
            {step === 0 && (
            <Chapter n="I" title="Il modello" hint="Tocca una foto, oppure spunta una tavola del catalogo: il modello si compila da sé."
              aside={comp.model?.page ? <button type="button" onClick={() => goToPage(comp.model?.page)} className="text-[rgb(var(--gold-700))] hover:underline">vedi a pag. {comp.model.page}</button> : null}>
              {selected && (
                <div className="rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-50))] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--gold-700))]">Dalla tua spunta · tavola {selected.page}</p>
                  <p className="font-display text-lg leading-tight mt-0.5">{comp.model?.label ?? selected.label}
                    {isBaseModelLabel(selected.label) && <span className="ml-2 align-middle font-sans text-[10px] uppercase tracking-wide rounded-full bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))] px-2 py-0.5">base · inclusa</span>}
                  </p>
                  {sheetFamilies.length > 1 && (
                    <div className="mt-1.5">
                      <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Su questa tavola (pag. {sheetToPages(selected.page).join('–')}) ci sono più modelli: tocca il tuo.</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sheetFamilies.map((f) => {
                          const on = comp.model?.key === f.model.key
                          return (
                            <button key={f.family} type="button" onClick={() => applyFamily(f)}
                              className={`rounded-full border px-2.5 py-1 text-xs capitalize transition-colors ${on ? 'border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--fg-muted))] hover:border-[rgb(var(--gold-300))]'}`}>
                              {on && <Check size={12} className="inline mr-1 -mt-0.5" />}{f.family}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {sheetFamilies.length === 1 && comp.model?.key && <p className="mt-1 text-[11px] text-[rgb(var(--emerald-700))]">Importato dalla tavola: <b className="capitalize">{sheetFamilies[0]!.family}</b>.</p>}
                </div>
              )}
              <SwatchPicker shape="photo" cols={3} maxH="26rem" value={comp.model?.key ? familyKeyOf(comp.model.label) : undefined}
                options={MODEL_TILES.filter((t) => t.img).map((t) => ({ key: t.family, label: t.label, img: t.img, hint: `${t.collection}${t.page ? ` · pag. ${t.page}` : ''}` }))}
                onChange={(k) => { const t = MODEL_TILES.find((x) => x.family === k); if (t) pickModelFromList(t.model.key) }} />
              <details className="group">
                <summary className="cursor-pointer list-none text-[12px] text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]">Tutte le varianti del listino <span className="text-[rgb(var(--fg-subtle))]">(menu)</span></summary>
                <select value={comp.model?.key ?? ''} onChange={(e) => pickModelFromList(e.target.value)} className={SEL}>
                  <option value="">{selected ? `Scelto sulla pagina: ${selected.label}` : 'Scegli un modello…'}</option>
                  {MODEL_GROUPS.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {g.models.map((m) => <option key={m.key} value={m.key}>{m.label}{FAMILY_PAGES[familyOf(m.label)] ? '' : ' · fuori catalogo 2022'}</option>)}
                    </optgroup>
                  ))}
                </select>
              </details>
            </Chapter>
            )}

            {step === 1 && (
            <Chapter n="II" title="Materiale e colore" hint="Le campionature sono quelle stampate sul catalogo, pag. 115–127.">
              <Voice label="Materiale" page={MATERIAL_OPTIONS.find((o) => o.key === comp.material)?.page ?? 115} onSee={goToPage}>
                <SwatchPicker shape="wide" cols={3} options={MATERIAL_OPTIONS.map((o) => ({ key: o.key, label: o.label, img: o.img, hint: o.page ? `pag. ${o.page}` : undefined }))}
                  value={comp.material} onChange={(k) => setComp((c) => ({ ...c, material: k, color: undefined }))} />
              </Voice>
              <Voice label="Colore" page={MATERIAL_OPTIONS.find((o) => o.key === comp.material)?.page} onSee={goToPage}>
                <SwatchPicker shape="wide" cols={3} options={colorOpts} value={comp.color} disabled={!comp.material} emptyText="Prima scegli il materiale."
                  onChange={(k) => setComp((c) => ({ ...c, color: k }))} maxH="22rem" />
              </Voice>
              <Voice label="Retro e dorso">
                <PillChoice options={[{ key: 'uguale', label: 'Come il fronte' }, { key: 'diverso', label: 'Un altro materiale o colore' }]} value={backDiff ? 'diverso' : 'uguale'}
                  onChange={(k) => { const d = k === 'diverso'; setBackDiff(d); if (!d) setComp((c) => ({ ...c, backMaterial: undefined, backColor: undefined })) }} />
              </Voice>
              {backDiff && (
                <>
                  <Voice label="Materiale del retro e del dorso" page={MATERIAL_OPTIONS.find((o) => o.key === comp.backMaterial)?.page ?? 115} onSee={goToPage}>
                    <SwatchPicker shape="wide" cols={3} options={MATERIAL_OPTIONS.map((o) => ({ key: o.key, label: o.label, img: o.img, hint: o.page ? `pag. ${o.page}` : undefined }))}
                      value={comp.backMaterial} onChange={(k) => setComp((c) => ({ ...c, backMaterial: k, backColor: undefined }))} />
                  </Voice>
                  <Voice label="Colore del retro e del dorso">
                    <SwatchPicker shape="wide" cols={3} options={backColorOpts} value={comp.backColor} disabled={!comp.backMaterial} emptyText="Prima scegli il materiale del retro."
                      onChange={(k) => setComp((c) => ({ ...c, backColor: k }))} maxH="22rem" />
                  </Voice>
                </>
              )}
            </Chapter>
            )}

            {step === 2 && (
            <Chapter n="III" title="Nomi e loghi" hint="I loghi del catalogo (pag. 34–37) e la tonalità con cui stamparli.">
              <Voice label="Personalizzazione" page={LOGO_OPTIONS.find((o) => o.key === comp.logo)?.page ?? 34} onSee={goToPage}>
                <SwatchPicker shape="square" cols={4} fit="contain" options={LOGO_TILES} value={comp.logo ?? 'nessuno'} maxH="24rem"
                  onChange={(k) => { const v = k ?? 'nessuno'; setComp((c) => ({ ...c, logo: v, logoColor: logoNeedsColor(v) ? c.logoColor : undefined })) }} />
              </Voice>
              {logoNeedsColor(comp.logo) && (
                <Voice label="Tonalità del logo" page={37} onSee={goToPage}>
                  <SwatchPicker shape="chip" cols={6} options={LOGO_COLOR_TILES} value={comp.logoColor} onChange={(k) => setComp((c) => ({ ...c, logoColor: k }))} />
                </Voice>
              )}
            </Chapter>
            )}

            {step === 3 && (
            <Chapter n="IV" title="Box e finitura" hint="Il blocco interno è digitale (lo decide il fotografo dall'impaginatore, non si sceglie qui).">
              {/* il blocco interno NON si sceglie qui: di default digitale; il fotografo può opzionarlo dall'impaginatore */}
              <Voice label="Box / contenitore" page={97} onSee={goToPage}>
                <PillChoice options={BOX_OPTIONS} value={comp.box ?? specs.box ?? 'nessuno'} onChange={(k) => setComp((c) => ({ ...c, box: k }))} />
                {(comp.box ?? specs.box) && (comp.box ?? specs.box) !== 'nessuno' && <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">Lo vedi nel 3D qui sopra, attorno all'album, con la sua forma e il suo rivestimento.</p>}
              </Voice>
              {(comp.box ?? specs.box) && (comp.box ?? specs.box) !== 'nessuno' && (
                <>
                  <Voice label="Rivestimento del box">
                    <PillChoice options={[{ key: 'uguale', label: 'Come la copertina' }, { key: 'diverso', label: 'Un altro materiale o colore' }]} value={boxDiff ? 'diverso' : 'uguale'}
                      onChange={(k) => { const d = k === 'diverso'; setBoxDiff(d); if (!d) setComp((c) => ({ ...c, boxMaterial: undefined, boxColor: undefined })) }} />
                  </Voice>
                  {boxDiff && (
                    <>
                      <Voice label="Materiale del box" page={MATERIAL_OPTIONS.find((o) => o.key === comp.boxMaterial)?.page ?? 115} onSee={goToPage}>
                        <SwatchPicker shape="wide" cols={3} options={MATERIAL_OPTIONS.map((o) => ({ key: o.key, label: o.label, img: o.img, hint: o.page ? `pag. ${o.page}` : undefined }))}
                          value={comp.boxMaterial} onChange={(k) => setComp((c) => ({ ...c, boxMaterial: k, boxColor: undefined }))} />
                      </Voice>
                      <Voice label="Colore del box">
                        <SwatchPicker shape="wide" cols={3} options={boxColorOpts} value={comp.boxColor} disabled={!comp.boxMaterial} emptyText="Prima scegli il materiale del box."
                          onChange={(k) => setComp((c) => ({ ...c, boxColor: k }))} maxH="22rem" />
                      </Voice>
                    </>
                  )}
                </>
              )}
              <Voice label="Finitura">
                <PillChoice options={FINISH_OPTIONS} value={comp.finish ?? 'nessuna'} onChange={(k) => setComp((c) => ({ ...c, finish: k }))} />
              </Voice>
              <Voice label={photoWindows > 1 ? `Foto in copertina · ${photoWindows} finestre` : 'Foto in copertina'}>
                <PillChoice options={[{ key: 'no', label: 'No' }, { key: 'si', label: photoWindows > 1 ? `Sì, le scelgo dalla galleria (${photoWindows})` : 'Sì, la scelgo dalla galleria' }]} value={wantPhoto ? 'si' : 'no'}
                  onChange={(k) => { const v = k === 'si'; setWantPhoto(v); if (!v) setComp((c) => ({ ...c, coverPhoto: null, coverPhotos: [] })) }} />
                {photoWindows > 1 && <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">Questo modello ha {photoWindows} finestre sulla copertina: servono {photoWindows} foto, nell'ordine da sinistra a destra.</p>}
              </Voice>
              {wantPhoto && (
                <div className="flex items-center gap-3">
                  {/* le foto scelte, una per finestra; il foglio a schermo intero per sceglierle o cambiarle */}
                  <div className="flex gap-1.5 shrink-0">
                    {Array.from({ length: photoWindows }, (_, i) => chosenPhotos[i]).map((p, i) => (
                      <button key={i} type="button" onClick={() => void openPhotoSheet()}
                        className={`relative h-24 ${photoWindows > 1 ? 'w-20' : 'w-32'} overflow-hidden rounded-xl border-2 ${p ? 'border-[rgb(var(--gold-500))]' : 'border-dashed border-[rgb(var(--border))]'} bg-[rgb(var(--bg-sunken))] grid place-items-center`}>
                        {p ? <img src={p.url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <ImageIcon size={22} className="text-[rgb(var(--fg-subtle))]" />}
                        {photoWindows > 1 && <span className="absolute top-1 left-1 h-5 w-5 grid place-items-center rounded-full bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] text-[11px]">{i + 1}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">{chosenPhotos.length ? (photoWindows > 1 ? `${chosenPhotos.length} di ${photoWindows} scelte` : (comp.coverPhoto?.label ?? 'Foto scelta')) : (photoWindows > 1 ? 'Nessuna foto ancora' : 'Nessuna foto ancora')}</p>
                    <button type="button" onClick={() => void openPhotoSheet()} className="mt-1 rounded-full border border-[rgb(var(--gold-600))] text-[rgb(var(--gold-700))] px-3 py-1.5 text-[13px]">
                      {chosenPhotos.length ? (photoWindows > 1 ? 'Cambia le foto' : 'Cambia foto') : (photoWindows > 1 ? 'Scegli le foto' : 'Scegli la foto')}
                    </button>
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">Tra quelle scelte per l'album.</p>
                  </div>
                </div>
              )}
              {photoSheet && (
                <CoverPhotoPicker photos={candidates} value={comp.coverPhoto?.mediaId} values={chosenPhotos.map((p) => p.mediaId)} max={photoWindows} loading={photosLoading} onClose={() => setPhotoSheet(false)}
                  onPick={(c) => setComp((x) => ({ ...x, coverPhoto: { mediaId: c.id, url: c.thumb, label: c.label }, coverPhotos: [{ mediaId: c.id, url: c.thumb, label: c.label }] }))}
                  onPickMany={(cs) => setComp((x) => { const ps = cs.map((c) => ({ mediaId: c.id, url: c.thumb, label: c.label })); return { ...x, coverPhoto: ps[0] ?? null, coverPhotos: ps } })} />
              )}
            </Chapter>
            )}

            {step === 4 && (
            <Chapter n="V" title="Foto e nomi al loro posto" hint="Sistema le foto nelle finestre (trascina e ingrandisci) e metti nomi o logo dove li vuoi, grandi quanto vuoi.">
              {(() => {
                const sd = sizeByKey(specs.size); const spec = LAYOUT_SPEC[modelLayoutKey]
                const decor = decorFor(cover3d.model)
                return (
                  <CoverLayoutEditor wCm={sd?.w ?? 30} hCm={sd?.h ?? 30} bgHex={cover3d.color} decorPrint={decor?.print} decorInvert={!decor?.color && cover3d.ink === 'white'}
                    photos={wantPhoto ? chosenPhotos.map((p) => p.url) : []} windows={wantPhoto ? spec.photos : []}
                    crops={comp.photoCrops ?? {}} onCrops={(c) => setComp((x) => ({ ...x, photoCrops: c }))}
                    logoImage={logoImg?.url ?? null} logoAspect={logoImg?.aspect} namesText={logoImg ? undefined : (cover3d.title || undefined)} ink={cover3d.ink === 'white' ? '#f6f1e8' : cover3d.ink === 'gold' ? '#d4b060' : cover3d.ink === 'silver' ? '#d7d7dc' : '#3a2c1e'}
                    place={comp.logoPlace ?? defaultPlace} defaultPlace={defaultPlace} onPlace={(p) => setComp((x) => ({ ...x, logoPlace: p ?? undefined }))} />
                )
              })()}
            </Chapter>
            )}

            {step === 5 && (
            <Chapter n="VI" title="La tua scheda" hint={selected && !compComplete ? 'Manca una scelta: completa ogni voce per poter firmare.' : 'Controlla: è la copertina che arriva all\'azienda.'}>
              <ChoiceSheet rows={sheetRows} />

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

            </Chapter>
            )}

            {step === 6 && (
            <Chapter n="VII" title="Formato e firma" hint="Formato e pagine vengono dall'impaginato del fotografo, se c'è già; poi nome e firma.">
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
                  {lockedPages ? (
                    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] px-3 py-2 text-sm">
                      <strong>{lockedPages} pagine</strong> <span className="text-[rgb(var(--fg-muted))]">· dall'impaginato del fotografo (non modificabile)</span>
                    </div>
                  ) : (
                    <label className="text-xs text-[rgb(var(--fg-muted))]">Pagine
                      <Input type="number" min={10} max={120} step={2} value={specs.pages}
                        onChange={(e) => setSpecs((p) => ({ ...p, pages: Math.max(10, Math.min(120, Number(e.target.value) || 40)) }))} className="mt-1 w-24" /></label>
                  )}
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
            </Chapter>
            )}
            {step < 5 && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-full border border-[rgb(var(--border))] px-4 py-2 text-sm disabled:opacity-40">Indietro</button>
                <p className="text-[11px] text-[rgb(var(--fg-subtle))] text-center">{stepHint}</p>
                <button type="button" disabled={!stepOk} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] px-5 py-2 text-sm font-medium disabled:opacity-40">Avanti</button>
              </div>
            )}
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
