import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Upload, Save, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PdfHotspotEditor } from '@/components/album/catalog/PdfHotspotEditor'
import { getMyCatalog, uploadCatalogPdf, saveHotspots, catalogPublicUrl, extractCatalogPrices, type Catalog, type Hotspot } from '@/hooks/useAlbumCatalog'

// Lato fotografo: carica il PDF del proprio catalogo aziendale e marca gli hotspot (modelli
// cliccabili) per pagina. La coppia poi lo sfoglia in /scegli-album/:entryId.
export default function AlbumCatalogManager() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getMyCatalog().then((r) => { if (r) { setCatalog(r.catalog); setHotspots(r.hotspots) } }).finally(() => setLoading(false))
  }, [])

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const cat = await uploadCatalogPdf(f)
      setCatalog(cat); setHotspots([]); setDirty(false)
      toast.success(`Catalogo caricato · ${cat.page_count} pagine. Ora marca i modelli.`)
    } catch (err) { toast.error((err as Error).message || 'Upload non riuscito') } finally { setBusy(false) }
  }

  async function onSave() {
    if (!catalog) return
    setBusy(true)
    try { await saveHotspots(catalog.id, hotspots); setDirty(false); toast.success('Modelli salvati. Il catalogo è pronto per i clienti.') }
    catch (err) { toast.error((err as Error).message || 'Salvataggio non riuscito') } finally { setBusy(false) }
  }

  const setHs = (h: Hotspot[]) => { setHotspots(h); setDirty(true) }

  // AI: legge i prezzi dal PDF e li applica ai modelli (match per nome) + aggiunge i mancanti.
  async function readPrices() {
    if (!catalog) return
    setBusy(true)
    try {
      const models = await extractCatalogPrices(catalog.pdf_path)
      if (!models.length) { toast.message("L'AI non ha trovato modelli con prezzo nel PDF"); return }
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
      const next = hotspots.map((h) => ({ ...h }))
      let applied = 0, added = 0
      for (const m of models) {
        const i = next.findIndex((h) => norm(h.label) === norm(m.label))
        if (i >= 0) { if (m.price != null) { next[i]!.price = m.price; applied++ } }
        else { next.push({ page: 1, x: 0.03, y: Math.min(0.92, 0.03 + (next.length % 14) * 0.065), w: 0.22, h: 0.05, label: m.label, price: m.price ?? null, default_format: null, default_pages: null }); added++ }
      }
      setHotspots(next); setDirty(true)
      toast.success(`AI: ${applied} prezzi applicati${added ? `, ${added} nuovi modelli aggiunti` : ''}. Controlla e salva.`, { duration: 10000 })
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4 hover:text-[rgb(var(--fg))]">
          <ChevronLeft size={16} /> Indietro
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">Catalogo album (PDF)</h1>
            <p className="text-[rgb(var(--fg-muted))] mt-1">Carica il PDF del tuo catalogo e marca i modelli. I tuoi clienti lo sfogliano, scelgono e firmano.</p>
          </div>
          {catalog && (
            <div className="flex gap-2">
              <label className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-[rgb(var(--border))] cursor-pointer hover:border-[rgb(var(--gold-300))]">
                <RefreshCw size={15} /> Sostituisci PDF
                <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} disabled={busy} />
              </label>
              <Button variant="outline" onClick={readPrices} disabled={busy} title="L'AI legge i prezzi dal PDF e li applica ai modelli. Controlli e salvi.">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Leggi prezzi (AI)
              </Button>
              <Button onClick={onSave} disabled={busy || !dirty}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salva modelli
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid place-items-center h-72 text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" /></div>
        ) : !catalog ? (
          <Card className="p-10 text-center">
            <FileText size={40} className="mx-auto text-[rgb(var(--gold-500))] mb-3" strokeWidth={1.3} />
            <h2 className="font-display text-xl mb-1">Carica il tuo catalogo PDF</h2>
            <p className="text-[rgb(var(--fg-muted))] text-sm max-w-md mx-auto mb-5">Il PDF del catalogo della tua azienda. I clienti lo sfoglieranno dal telefono (consigliato orizzontale).</p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] cursor-pointer hover:opacity-90">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Carica PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} disabled={busy} />
            </label>
          </Card>
        ) : (
          <Card className="p-4 sm:p-5">
            <PdfHotspotEditor pdfUrl={catalogPublicUrl(catalog.pdf_path)} hotspots={hotspots} onChange={setHs} />
          </Card>
        )}
      </div>
    </div>
  )
}
