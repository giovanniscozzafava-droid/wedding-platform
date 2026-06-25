import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, BookOpenCheck, PenLine, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FORMATS, BOXES, FINISHES, sizesForFormat, type Format } from '@/components/album/albumCatalog'
import { PdfFlipbook } from '@/components/album/catalog/PdfFlipbook'
import { SignaturePad } from '@/components/album/catalog/SignaturePad'
import { buildCommissionPdf, downloadBlob } from '@/components/album/catalog/commissionPdf'
import { loadPdf, renderPdfPageDataUrl } from '@/lib/pdf'
import {
  getCatalogForEntry, createCommission, uploadCommissionPdf, catalogPublicUrl,
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
  const [signature, setSignature] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)

  useEffect(() => {
    getCatalogForEntry(entryId)
      .then((r) => { if (r) { setCatalog(r.catalog); setHotspots(r.hotspots) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [entryId])

  const sizes = useMemo(() => sizesForFormat(specs.format as Format), [specs.format])
  useEffect(() => { if (sizes.length && !sizes.find((s) => s.key === specs.size)) setSpecs((p) => ({ ...p, size: sizes[0].key })) }, [sizes]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(h: Hotspot) {
    setSelected(h)
    setSpecs((p) => ({
      ...p,
      format: (h.default_format as string) || p.format,
      pages: h.default_pages ?? p.pages,
    }))
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
      const dateLabel = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      const blob = buildCommissionPdf({
        studio: catalog.studio || 'Studio',
        couple: clientName.trim(),
        modelLabel: selected.label,
        specs: { ...specs, size: sizeLabel },
        signatureDataUrl: signature,
        pageImageDataUrl: pageImg,
        catalogName: catalog.name,
        dateLabel,
      })

      const path = await uploadCommissionPdf(entryId, blob)
      const orderId = await createCommission(entryId, {
        catalog_id: catalog.id, page: selected.page, model_label: selected.label,
        specs: { ...specs, size: sizeLabel }, signed_by: clientName.trim(),
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
            <PdfFlipbook pdfUrl={catalogPublicUrl(catalog.pdf_path)} hotspots={hotspots} selectedId={selected?.id} onPick={pick} />
          </div>

          <div className="space-y-5">
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Modello scelto</p>
              {selected
                ? <p className="font-display text-xl text-[rgb(var(--fg))]">{selected.label} <span className="text-xs text-[rgb(var(--fg-subtle))] font-sans">· pag. {selected.page}</span></p>
                : <p className="text-sm text-[rgb(var(--fg-muted))]">Tocca un riquadro sulla pagina per scegliere.</p>}
            </Card>

            <div className={selected ? '' : 'opacity-50 pointer-events-none'}>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Formato</p>
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
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-[rgb(var(--fg-muted))]">Pagine (fogli)
                    <Input type="number" min={10} max={120} step={2} value={specs.pages}
                      onChange={(e) => setSpecs((p) => ({ ...p, pages: Math.max(10, Math.min(120, Number(e.target.value) || 40)) }))} className="mt-1 w-24" /></label>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Box / contenitore</p>
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
    </div>
  )
}
