import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Upload, Save, FileText, Loader2, Sparkles, Plus, Trash2, ImagePlus, Sliders } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PdfHotspotEditor } from '@/components/album/catalog/PdfHotspotEditor'
import { ModelOptionsEditor } from '@/components/album/catalog/ModelOptionsEditor'
import {
  getMyModels, uploadCatalogPdf, saveAllModels, saveCatalogMarkup, uploadCardImage, applyMarkup,
  catalogPublicUrl, extractCatalogPrices, type Catalog, type Hotspot, type ModelOptions,
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

  function applyRicarico() {
    let n = 0
    setModels((ms) => ms.map((m) => { if (m.cost == null) return m; n++; return { ...m, price: applyMarkup(m.cost, markup) } }))
    setDirty(true)
    toast.success(n ? `Ricarico ${markup}% applicato a ${n} modelli` : 'Nessun modello ha un costo: leggi i costi dal PDF o inseriscili')
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
          {nModels > 0 && (
            <div className="flex gap-2 flex-wrap">
              {selCatalog && <Button variant="outline" onClick={readCosts} disabled={busy} title="L'AI legge i COSTI dal PDF selezionato">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Leggi costi (AI)
              </Button>}
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
                <Button variant="outline" size="sm" onClick={applyRicarico} disabled={busy}>Applica ai prezzi</Button>
                <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Prezzo cliente = costo × (1 + ricarico%). Ogni prezzo resta ritoccabile.</span>
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
                <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] cursor-pointer hover:border-[rgb(var(--gold-300))]">
                  <Plus size={14} /> Nuova card
                  <input type="file" accept="image/*" className="hidden" onChange={onAddCard} disabled={busy} />
                </label>
              </div>
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
