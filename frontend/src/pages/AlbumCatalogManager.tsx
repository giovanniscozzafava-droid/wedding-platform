import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Upload, Save, FileText, Loader2, Sparkles, Plus, Trash2, ImagePlus, Sliders } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PdfHotspotEditor } from '@/components/album/catalog/PdfHotspotEditor'
import { ModelOptionsEditor } from '@/components/album/catalog/ModelOptionsEditor'
import { designAlbumCatalogModels } from '@/components/album/albumCatalog'
import {
  getMyModels, uploadCatalogPdf, saveAllModels, saveCatalogMarkup, uploadCardImage, applyMarkup,
  uploadTempPdf, catalogPublicUrl, extractCatalogPrices, interpretCatalog, type Catalog, type Hotspot, type ModelOptions,
} from '@/hooks/useAlbumCatalog'

// Lato fotografo: i MODELLI come card unificate. Vengono da uno o più PDF (riquadri marcati) oppure
// sono CARD MANUALI (foto) per chi non ha un PDF. Per ogni modello: costo + prezzo (ricarico) + opzioni.
export default function AlbumCatalogManager() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [models, setModels] = useState<Hotspot[]>([])
  const [markup, setMarkup] = useState(0)
  const [selCat, setSelCat] = useState<string>('')       // PDF selezionato per marcare
  const [opt, setOpt] = useState<{ kind: 'pdf' | 'card'; i: number } | null>(null)  // opzioni in modifica
  const [daOpen, setDaOpen] = useState(false)            // modale "carica dal listino DesignAlbum"
  const [daQuery, setDaQuery] = useState('')
  const daList = useMemo(() => { const q = daQuery.toLowerCase().trim(); const all = designAlbumCatalogModels(); return q ? all.filter((m) => m.label.toLowerCase().includes(q)) : all }, [daQuery])

  useEffect(() => {
    getMyModels().then((r) => {
      setCatalogs(r.catalogs); setModels(r.models); setMarkup(r.markup)
      setSelCat(r.catalogs[0]?.id ?? '')
    }).finally(() => setLoading(false))
  }, [])

  const pdfModels = useMemo(() => models.filter((m) => m.catalog_id === selCat), [models, selCat])
  const manualCards = useMemo(() => models.filter((m) => !m.catalog_id), [models])
  const selCatalog = catalogs.find((c) => c.id === selCat) || null

  // I riquadri del PDF selezionato cambiano → li rifondo nel set globale.
  const onPdfChange = (hs: Hotspot[]) => {
    setModels((ms) => [...ms.filter((m) => m.catalog_id !== selCat), ...hs.map((h) => ({ ...h, catalog_id: selCat }))])
    setDirty(true)
  }
  const setCard = (i: number, patch: Partial<Hotspot>) => {
    setModels((ms) => { const cards = ms.filter((m) => !m.catalog_id); const t = cards[i]; return ms.map((m) => (m === t ? { ...m, ...patch } : m)) })
    setDirty(true)
  }
  const removeCard = (i: number) => setModels((ms) => { const cards = ms.filter((m) => !m.catalog_id); const t = cards[i]; return ms.filter((m) => m !== t) })
  // Carica un modello dal listino DesignAlbum COME CARD nel proprio catalogo (label + costo + prezzo col
  // ricarico). Così il cliente vede SOLO i modelli che il fotografo carica, con i prezzi già pronti.
  const addDA = (m: { label: string; price: number | null }) => {
    if (models.some((x) => !x.catalog_id && x.label === m.label)) { toast.message(`«${m.label}» è già tra le tue card`); return }
    setModels((ms) => [...ms, { catalog_id: null, page: 1, x: 0, y: 0, w: 0, h: 0, label: m.label, image_path: null, cost: m.price ?? null, price: m.price != null ? applyMarkup(m.price, markup) : null, options: {}, default_format: null, default_pages: null, sort_order: ms.length }])
    setDirty(true)
    toast.success(`«${m.label}» aggiunto — aggiungi una foto e verifica il prezzo`)
  }

  async function onUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const cat = await uploadCatalogPdf(f)
      setCatalogs((c) => [...c, cat]); setSelCat(cat.id)
      toast.success(`PDF caricato · ${cat.page_count} pagine. Marca i modelli sulle pagine.`)
    } catch (err) { toast.error((err as Error).message || 'Upload non riuscito') } finally { setBusy(false) }
  }

  async function onAddCard(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const path = await uploadCardImage(f)
      setModels((ms) => [...ms, { catalog_id: null, page: 1, x: 0, y: 0, w: 0, h: 0, label: f.name.replace(/\.[^.]+$/, '') || 'Modello', image_path: path, cost: null, price: null, options: {}, default_format: null, default_pages: null, sort_order: ms.length }])
      setDirty(true)
      toast.success('Card creata. Aggiungi nome, costo e prezzo.')
    } catch (err) { toast.error((err as Error).message || 'Foto non caricata') } finally { setBusy(false) }
  }

  async function onSave() {
    setBusy(true)
    try {
      await saveAllModels(models)
      if (catalogs[0]) await saveCatalogMarkup(catalogs[0].id, markup)
      setDirty(false); toast.success('Modelli salvati. Il catalogo è pronto per i clienti.')
    } catch (err) { toast.error((err as Error).message || 'Salvataggio non riuscito') } finally { setBusy(false) }
  }

  // Ricarico = RIPIEGO: fissa il prezzo SOLO per i modelli che hanno un costo ma NON un prezzo
  // (il listino di vendita ha priorità; il ricarico riempie i vuoti). Il fotografo può forzare tutto.
  function applyRicarico(all = false) {
    let n = 0
    setModels((ms) => ms.map((m) => { if (m.cost == null || (!all && m.price != null)) return m; n++; return { ...m, price: applyMarkup(m.cost, markup) } }))
    setDirty(true)
    toast.success(n ? `Ricarico ${markup}% applicato a ${n} modelli${all ? '' : ' senza prezzo'}` : 'Nessun modello da ricaricare (hanno già un prezzo o manca il costo)')
  }

  // AI: legge un secondo documento (LISTINO PREZZI DI VENDITA) → associa i PREZZI ai modelli per nome.
  // Margine = prezzo − costo (automatico). Priorità sul ricarico%.
  async function readSellingPrices(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const path = await uploadTempPdf(f)
      const found = await extractCatalogPrices(path)
      if (!found.length) { toast.message("L'AI non ha trovato prezzi nel listino"); return }
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
      let applied = 0, noMatch = 0
      setModels((ms) => ms.map((m) => {
        const hit = found.find((x) => norm(x.label) === norm(m.label))
        if (hit && hit.price != null) { applied++; return { ...m, price: hit.price } }
        return m
      }))
      noMatch = found.filter((x) => !models.some((m) => norm(m.label) === norm(x.label))).length
      setDirty(true)
      toast.success(`AI: ${applied} prezzi di vendita associati${noMatch ? ` · ${noMatch} nel listino senza modello corrispondente` : ''}. Il margine è calcolato da solo. Controlla e salva.`, { duration: 12000 })
    } catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }

  // AI: legge i COSTI dal PDF selezionato → match per nome su TUTTI i modelli, aggiunge i mancanti a questo PDF.
  async function readCosts() {
    if (!selCatalog) return
    setBusy(true)
    try {
      const found = await extractCatalogPrices(selCatalog.pdf_path)
      if (!found.length) { toast.message("L'AI non ha trovato modelli con costo nel PDF"); return }
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
      const next = models.map((m) => ({ ...m }))
      let applied = 0, added = 0
      for (const f of found) {
        const i = next.findIndex((m) => norm(m.label) === norm(f.label))
        if (i >= 0) { if (f.price != null) { next[i]!.cost = f.price; if (markup > 0) next[i]!.price = applyMarkup(f.price, markup); applied++ } }
        else { const cost = f.price ?? null; next.push({ catalog_id: selCat, page: 1, x: 0.03, y: Math.min(0.92, 0.03 + (next.filter((m) => m.catalog_id === selCat).length % 14) * 0.065), w: 0.22, h: 0.05, label: f.label, cost, price: markup > 0 ? applyMarkup(cost, markup) : null, options: {}, default_format: null, default_pages: null }); added++ }
      }
      setModels(next); setDirty(true)
      toast.success(`AI: ${applied} costi letti${added ? `, ${added} nuovi modelli` : ''}${markup > 0 ? ` · ricarico ${markup}% applicato` : ' · imposta il ricarico'}. Controlla e salva.`, { duration: 11000 })
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  // AI: INTERPRETA tutto il PDF → CREA i modelli da zero (posizione + prezzo + pagine + opzioni
  // materiali/colori/logo/foto-copertina, con le intersezioni). Sostituisce i modelli di questo PDF.
  async function interpretPdf() {
    if (!selCatalog) return
    if (models.some((m) => m.catalog_id === selCat) && !window.confirm("L'AI ricrea i modelli di questo PDF da capo (posizione, prezzo, opzioni). Sostituire quelli attuali? Le card a mano e gli altri PDF restano.")) return
    setBusy(true)
    try {
      const found = await interpretCatalog(selCatalog.pdf_path)
      if (!found.length) { toast.message("L'AI non ha trovato modelli nel PDF"); return }
      const created: Hotspot[] = found.map((f, i) => ({
        catalog_id: selCat, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h,
        label: f.label, cost: null, price: f.price ?? null, default_pages: f.pages ?? null, default_format: null, sort_order: i,
        options: { materials: f.materials, colors: f.colors, logos: f.logos, coverPhoto: f.coverPhoto, coverPhotoSurcharge: 0 } as ModelOptions,
      }))
      setModels((ms) => [...ms.filter((m) => m.catalog_id !== selCat), ...created])
      setDirty(true)
      toast.success(`AI: ${created.length} modelli creati (riquadri + opzioni). Controlla i riquadri sulle pagine e i prezzi, poi salva.`, { duration: 13000 })
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  // Target del modale opzioni (ricalcolato dallo stato corrente → mai stale).
  const optTarget = opt ? (opt.kind === 'pdf' ? pdfModels[opt.i] : manualCards[opt.i]) : null
  const applyOptions = (o: ModelOptions) => {
    if (!opt) return
    if (opt.kind === 'pdf') onPdfChange(pdfModels.map((m, j) => (j === opt.i ? { ...m, options: o } : m)))
    else setCard(opt.i, { options: o })
  }

  const nModels = models.length

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4 hover:text-[rgb(var(--fg))]">
          <ChevronLeft size={16} /> Indietro
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">Catalogo modelli</h1>
            <p className="text-[rgb(var(--fg-muted))] mt-1">I tuoi modelli d'album: da uno o più PDF, oppure card create a mano dalle tue foto. Costo, prezzo e opzioni per modello.</p>
          </div>
          {(nModels > 0 || catalogs.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {selCatalog && <Button variant="gold" onClick={interpretPdf} disabled={busy} title="L'AI legge tutto il PDF e crea i modelli da zero: riquadri cliccabili + prezzo + materiali/colori/logo/foto, con le intersezioni. Tu controlli e salvi.">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Interpreta catalogo (AI)
              </Button>}
              {selCatalog && <Button variant="outline" onClick={readCosts} disabled={busy} title="L'AI legge solo i COSTI dal PDF selezionato">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Leggi costi (AI)
              </Button>}
              <label className={`inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-[rgb(var(--border))] cursor-pointer hover:border-[rgb(var(--gold-300))] ${busy ? 'opacity-50 pointer-events-none' : ''}`} title="Carica il tuo listino PREZZI DI VENDITA (PDF): l'AI li associa ai modelli. Margine = prezzo − costo.">
                <Sparkles size={16} /> Prezzi vendita (AI)
                <input type="file" accept="application/pdf" className="hidden" onChange={readSellingPrices} disabled={busy} />
              </label>
              <Button onClick={onSave} disabled={busy || !dirty}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salva
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid place-items-center h-72 text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {/* Ricarico */}
            <Card className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-[rgb(var(--fg-muted))]">Ricarico</span>
                <Input type="number" min={0} step={5} value={markup} onChange={(e) => { setMarkup(Math.max(0, Number(e.target.value) || 0)); setDirty(true) }} className="h-8 w-20 text-sm" />
                <span className="text-sm text-[rgb(var(--fg-muted))]">%</span>
                <Button variant="outline" size="sm" onClick={() => applyRicarico(false)} disabled={busy}>Riempi i vuoti</Button>
                <button onClick={() => applyRicarico(true)} disabled={busy} className="text-[11px] text-[rgb(var(--gold-700))] hover:underline disabled:opacity-50">o applica a tutti</button>
                <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Il listino di vendita ha priorità; il ricarico riempie i modelli senza prezzo. Margine = prezzo − costo.</span>
              </div>
            </Card>

            {/* PDF cataloghi */}
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <h3 className="font-display text-lg flex items-center gap-2"><FileText size={18} /> Da PDF</h3>
                <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] cursor-pointer hover:border-[rgb(var(--gold-300))]">
                  <Upload size={14} /> {catalogs.length ? 'Aggiungi PDF' : 'Carica PDF'}
                  <input type="file" accept="application/pdf" className="hidden" onChange={onUploadPdf} disabled={busy} />
                </label>
              </div>
              {catalogs.length === 0 ? (
                <p className="text-sm text-[rgb(var(--fg-muted))]">Nessun PDF. Caricane uno per marcare i modelli sulle pagine, oppure crea le card a mano qui sotto.</p>
              ) : (
                <>
                  {catalogs.length > 1 && (
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {catalogs.map((c) => (
                        <button key={c.id} onClick={() => setSelCat(c.id)} className={`px-3 py-1.5 rounded-lg text-sm border ${selCat === c.id ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))]'}`}>{c.name}</button>
                      ))}
                    </div>
                  )}
                  {selCatalog && <PdfHotspotEditor pdfUrl={catalogPublicUrl(selCatalog.pdf_path)} hotspots={pdfModels} onChange={onPdfChange} onEditOptions={(i) => setOpt({ kind: 'pdf', i })} />}
                </>
              )}
            </Card>

            {/* Card manuali */}
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <div>
                  <h3 className="font-display text-lg flex items-center gap-2"><ImagePlus size={18} /> Card a mano</h3>
                  <p className="text-[11px] text-[rgb(var(--fg-muted))]">Per chi non ha un PDF: una foto per modello, col nome e il prezzo.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setDaOpen(true)} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))]"><FileText size={14} /> Dal listino DesignAlbum</button>
                  <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] cursor-pointer hover:border-[rgb(var(--gold-300))]">
                    <Plus size={14} /> Nuova card
                    <input type="file" accept="image/*" className="hidden" onChange={onAddCard} disabled={busy} />
                  </label>
                </div>
              </div>

              {daOpen && (
                <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onClick={() => setDaOpen(false)}>
                  <div className="flex max-h-[85vh] w-[min(94vw,560px)] flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border))] p-4">
                      <div><h3 className="font-display text-lg">Dal listino DesignAlbum</h3><p className="mt-0.5 text-[11px] text-[rgb(var(--fg-muted))]">Aggiungi al tuo catalogo SOLO i modelli che vuoi offrire (il cliente vede solo questi). Costo dal listino, prezzo col tuo ricarico ({markup}%). Poi aggiungi una foto alla card.</p></div>
                      <button onClick={() => setDaOpen(false)} className="shrink-0 rounded-full px-2 py-1 text-lg leading-none hover:bg-[rgb(var(--bg-sunken))]">✕</button>
                    </div>
                    <div className="border-b border-[rgb(var(--border))] p-3"><Input value={daQuery} onChange={(e) => setDaQuery(e.target.value)} placeholder="Cerca un modello…" /></div>
                    <div className="min-h-0 flex-1 space-y-0.5 overflow-auto p-2">
                      {daList.map((m) => { const added = models.some((x) => !x.catalog_id && x.label === m.label); return (
                        <div key={m.label} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--bg-sunken))]">
                          <span className="flex-1 truncate text-sm">{m.label}{m.price != null ? <span className="text-[rgb(var(--fg-subtle))]"> · {m.price} €</span> : ''}</span>
                          <button disabled={added} onClick={() => addDA(m)} className={`shrink-0 rounded-md px-2.5 py-1 text-[12px] ${added ? 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]' : 'bg-[rgb(var(--gold-500))] text-white hover:opacity-90'}`}>{added ? 'Aggiunto' : 'Aggiungi'}</button>
                        </div>
                      )})}
                      {daList.length === 0 && <p className="py-4 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun modello.</p>}
                    </div>
                    <div className="flex justify-end border-t border-[rgb(var(--border))] p-3"><Button variant="gold" size="sm" onClick={() => setDaOpen(false)}>Fatto</Button></div>
                  </div>
                </div>
              )}
              {manualCards.length === 0 ? (
                <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna card a mano.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {manualCards.map((m, i) => (
                    <div key={i} className="rounded-xl border border-[rgb(var(--border))] overflow-hidden">
                      {m.image_path && <img src={catalogPublicUrl(m.image_path)} alt="" className="w-full h-32 object-cover" />}
                      <div className="p-2.5 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Input value={m.label} onChange={(e) => setCard(i, { label: e.target.value })} placeholder="Nome modello" className="h-8 text-sm" />
                          <button onClick={() => removeCard(i)} className="text-[rgb(var(--fg-muted))] hover:text-red-500 shrink-0" title="Elimina card"><Trash2 size={15} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <Input type="number" value={m.cost ?? ''} onChange={(e) => setCard(i, { cost: e.target.value ? Number(e.target.value) : null })} placeholder="Costo €" className="h-7 text-xs" />
                          <Input type="number" value={m.price ?? ''} onChange={(e) => setCard(i, { price: e.target.value ? Number(e.target.value) : null })} placeholder="Prezzo €" className="h-7 text-xs" />
                        </div>
                        {m.cost != null && m.price != null && <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Margine: € {Math.round(Number(m.price) - Number(m.cost))}</p>}
                        <button onClick={() => setOpt({ kind: 'card', i })} className="text-[11px] text-[rgb(var(--gold-700))] hover:underline inline-flex items-center gap-1"><Sliders size={11} /> Opzioni…</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {optTarget && <ModelOptionsEditor label={optTarget.label} value={optTarget.options} onChange={applyOptions} onClose={() => setOpt(null)} />}
    </div>
  )
}
