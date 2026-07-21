import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, BookOpenCheck, PenLine, CheckCircle2, Info, Maximize2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FORMATS, BOXES, FINISHES, sizesForFormat, sizeByKey, designAlbumPriceForLabel, isBaseModelLabel, type Format } from '@/components/album/albumCatalog'
import { getFormat } from '@/lib/albumFormats'
import { looksLikeAlbum, euroA } from '@/lib/albumPricing'
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
  const [familyFromQuote, setFamilyFromQuote] = useState(false)     // album famiglia già nel preventivo
  const [bigOpen, setBigOpen] = useState(false)                     // visore PDF 3D a schermo intero
  // FASE 2 — componenti del listino del fotografo + residuo preventivo (per la rimanenza alla consegna)
  const [listino, setListino] = useState<{ covers: { id: string; label: string; price: number; included?: boolean }[]; accessories: { id: string; label: string; price: number; included?: boolean }[]; shipping: number; quoteTotal: number; quotePaid: number }>({ covers: [], accessories: [], shipping: 0, quoteTotal: 0, quotePaid: 0 })
  const [selCover, setSelCover] = useState<string | null>(null)
  const [selAcc, setSelAcc] = useState<Set<string>>(() => new Set())

  async function reloadPins() {
    const { data } = await (supabase.from as any)('album_pins').select('id, entry_id, page, x, y, comment, material, color, status').eq('entry_id', entryId)
    setPins((data ?? []) as AlbumPin[])
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
  const modelTotal = basePrice + surcharge
  // COMPONENTI del listino (copertina + accessori) — 'inclusa' vale 0
  const coverPick = listino.covers.find((c) => c.id === selCover)
  const coverExtra = coverPick && !coverPick.included ? Number(coverPick.price) || 0 : 0
  const accExtra = listino.accessories.filter((a) => selAcc.has(a.id) && !a.included).reduce((s, a) => s + (Number(a.price) || 0), 0)
  const shipping = Number(listino.shipping) || 0
  const albumTotal = modelTotal + coverExtra + accExtra + shipping
  // RIMANENZA ALLA CONSEGNA = residuo preventivo (totale − pagato) + upgrade album (oltre il contrattualizzato)
  const residuo = Math.max(0, listino.quoteTotal - listino.quotePaid)
  const albumUpgrade = Math.max(0, albumTotal - optioned)
  const rimanenza = residuo + albumUpgrade

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
      .select('id, entry_id, page, x, y, comment, material, color, status').single()
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
  const toggleFinish = (k: string) => setSpecs((p) => ({ ...p, finishes: (p.finishes ?? []).includes(k) ? (p.finishes ?? []).filter((x) => x !== k) : [...(p.finishes ?? []), k] }))

  const ready = !!selected && !!signature && clientName.trim().length > 1 && !busy

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
      const priceLine = selected.price != null
        ? (optioned > 0
            ? `Album ${euroA(albumTotal)} · già ${euroA(optioned)} nel preventivo · differenza album ${euroA(albumUpgrade)} · rimanenza alla consegna ${euroA(rimanenza)}`
            : `Album ${euroA(albumTotal)}${shipping > 0 ? ` (incl. spedizione ${euroA(shipping)})` : ''}`)
        : null
      const composed = [chosen, priceLine, pinNote.trim() || undefined].filter(Boolean).join('\n')
      const fullSpecs = { ...specs, size: sizeLabel, note: composed || undefined }
      const dateLabel = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      const blob = buildCommissionPdf({
        studio: catalog.studio || 'Studio',
        couple: clientName.trim(),
        modelLabel: selected.label,
        specs: fullSpecs,
        signatureDataUrl: signature,
        pageImageDataUrl: pageImg,
        catalogName: catalog.name,
        dateLabel,
      })

      const path = await uploadCommissionPdf(entryId, blob)
      const orderId = await createCommission(entryId, {
        catalog_id: catalog.id, page: selected.page, model_label: selected.label,
        specs: fullSpecs, signed_by: clientName.trim(),
        signed_at: new Date().toISOString(), commission_pdf_path: path,
      })
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
            <PdfFlipbook pdfUrl={catalogPublicUrl(catalog.pdf_path)} hotspots={hotspots} selected={selected} onPick={pick} onDropPin={dropPin} pins={pins} onOpenPin={setOpenPin} />
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

            {selected && (basePrice > 0 || selected.price != null ? (
              <div className="rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-50))] px-3 py-2.5">
                {optioned > 0 ? (() => {
                  const diff = albumUpgrade
                  return (<>
                    <div className="flex items-center justify-between"><span className="text-sm font-medium">Differenza album</span><span className="font-display text-lg">{diff > 0 ? `+ ${euroA(diff)}` : 'Nessuna'}</span></div>
                    <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">Album {euroA(albumTotal)} · hai già {euroA(optioned)} nel preventivo. La differenza si aggiunge alla rimanenza.</p>
                  </>)
                })() : (<>
                  <div className="flex items-center justify-between"><span className="text-sm font-medium">Prezzo album</span><span className="font-display text-lg">{euroA(albumTotal)}</span></div>
                  <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">Non hai un album nel preventivo: è una scelta nuova, prezzo pieno.</p>
                </>)}
                {surcharge > 0 && <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">Incluso {euroA(surcharge)} di opzioni scelte.</p>}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px] text-[rgb(var(--fg-muted))]" style={{ borderColor: 'rgb(var(--amber-500) / 0.4)', background: 'rgb(var(--amber-500) / 0.10)' }}>
                <Info size={15} className="shrink-0 mt-0.5" style={{ color: 'rgb(var(--amber-600, 217 119 6))' }} />
                <span>Prezzo su richiesta: <strong>chiedi al tuo fotografo la differenza di prezzo</strong> per questo modello.</span>
              </div>
            ))}

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
            {selected && (residuo > 0 || albumUpgrade > 0 || shipping > 0) && (
              <div className="rounded-xl border-2 border-[rgb(var(--gold-400))] bg-[rgb(var(--gold-50))] px-3 py-2.5">
                <div className="flex items-center justify-between"><span className="text-sm font-medium">Rimanenza alla consegna</span><span className="font-display text-xl">{euroA(rimanenza)}</span></div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">
                  Residuo preventivo {euroA(residuo)}{albumUpgrade > 0 ? <> + upgrade album <b>{euroA(albumUpgrade)}</b></> : ''}{shipping > 0 ? ` · incl. spedizione ${euroA(shipping)}` : ''}.
                </p>
                <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-0.5">Album {euroA(albumTotal)}{optioned > 0 ? ` · già ${euroA(optioned)} nel preventivo` : ''}.</p>
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

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Box / contenitore{specs.box && specs.box !== 'nessuno' && familyFromQuote === false ? '' : ''}</p>
                  {(familyFromQuote || (specs.box && specs.box !== 'nessuno')) && (
                    <p className="text-[11px] text-emerald-600 mb-2">Già nel tuo preventivo: {[specs.box && specs.box !== 'nessuno' ? 'box' : null, familyFromQuote ? 'album famiglia' : null].filter(Boolean).join(' e ')} — pre-selezionati.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {BOXES.map((b) => (
                      <button key={b.key} onClick={() => setSpecs((p) => ({ ...p, box: b.key }))}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition ${specs.box === b.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{b.label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Finiture</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FINISHES.map((f) => (
                      <button key={f.key} onClick={() => toggleFinish(f.key)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition ${(specs.finishes ?? []).includes(f.key) ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{f.label}</button>
                    ))}
                  </div>
                </div>

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
