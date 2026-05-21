import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useServices } from '@/hooks/useCatalog'
import {
  useAddQuoteItem,
  useGeneratePdf,
  useQuote,
  useRemoveQuoteItem,
  useSendQuote,
  useUpdateQuote,
} from '@/hooks/useQuotes'

export default function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { data: quote, isLoading } = useQuote(id ?? null)
  const update = useUpdateQuote()
  const addItem = useAddQuoteItem()
  const remItem = useRemoveQuoteItem()
  const genPdf = useGeneratePdf()
  const sendQ = useSendQuote()
  const { data: services } = useServices({ onlyActive: true })

  const [defaultMarkup, setDefaultMarkup] = useState<string>(quote?.default_markup_percent?.toString() ?? '')
  const [pdfUrl, setPdfUrl] = useState<string | null>(quote?.pdf_url ?? null)
  const [sendResult, setSendResult] = useState<{ access_token?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickSupplier, setPickSupplier] = useState<string>('')

  const grouped = useMemo(() => {
    const out = new Map<string, NonNullable<typeof services>>()
    for (const s of services ?? []) {
      const arr = out.get(s.fornitore_id) ?? []
      arr.push(s)
      out.set(s.fornitore_id, arr)
    }
    return out
  }, [services])

  if (isLoading) return <div className="p-6 text-slate-500">Caricamento...</div>
  if (!quote) return <div className="p-6 text-red-600">Preventivo non trovato</div>

  async function handleAddItem(supplierId: string, serviceId: string) {
    if (!id) return
    const svc = services?.find((s) => s.id === serviceId)
    if (!svc) return
    await addItem.mutateAsync({
      quote_id: id,
      service_id: svc.id,
      supplier_id: supplierId,
      name_snapshot: svc.name,
      description_snapshot: svc.description ?? null,
      unit_snapshot: svc.unit,
      snapshot_price: svc.base_price,
      quantity: 1,
    })
  }

  async function handleSetMarkup() {
    if (!id) return
    await update.mutateAsync({ id, patch: { default_markup_percent: Number(defaultMarkup || 0) } })
  }

  async function handlePdf(variant: 'NEUTRA' | 'PREMIUM') {
    if (!id) return
    setError(null)
    try {
      const r = await genPdf.mutateAsync({ quoteId: id, variant })
      setPdfUrl(r.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore PDF')
    }
  }

  async function handleSend() {
    if (!id) return
    setError(null)
    try {
      const r = await sendQ.mutateAsync(id)
      setSendResult(r)
      setPdfUrl(r.pdf_url ?? pdfUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore invio')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Link to="/quotes" className="text-sm text-slate-500 hover:underline">← Preventivi</Link>
            <h1 className="text-2xl font-semibold">{quote.title}</h1>
            <p className="text-sm text-slate-500">Status: <strong>{quote.status}</strong> · v{quote.revision}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handlePdf('NEUTRA')} disabled={genPdf.isPending} data-testid="pdf-neutra">PDF Neutra</Button>
            <Button variant="outline" onClick={() => handlePdf('PREMIUM')} disabled={genPdf.isPending} data-testid="pdf-premium">PDF Premium</Button>
            <Button onClick={handleSend} disabled={sendQ.isPending} data-testid="send-quote-btn">{sendQ.isPending ? 'Invio...' : 'Invia al cliente'}</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pannello 1: Voci correnti */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Voci ({quote.quote_items.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quote.quote_items.length === 0 && <p className="text-sm text-slate-500">Nessuna voce.</p>}
              <ul className="space-y-1 text-sm" data-testid="quote-items">
                {quote.quote_items.map((it) => (
                  <li key={it.id} className="flex justify-between items-center border border-slate-200 rounded px-3 py-2">
                    <div>
                      <p className="font-medium">{it.name_snapshot}</p>
                      <p className="text-xs text-slate-500">
                        {Number(it.quantity)} × € {Number(it.snapshot_price).toFixed(2)} · costo € {Number(it.line_cost).toFixed(2)} · cliente € {Number(it.line_client).toFixed(2)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => remItem.mutate({ id: it.id, quoteId: quote.id })}>×</Button>
                  </li>
                ))}
              </ul>
              <hr />
              <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                <p>Totale costo: <strong>€ {Number(quote.total_cost).toLocaleString('it-IT')}</strong></p>
                <p>Totale cliente: <strong>€ {Number(quote.total_client).toLocaleString('it-IT')}</strong></p>
                <p>Margine assoluto: <strong>€ {Number(quote.margin_amount).toLocaleString('it-IT')}</strong></p>
                <p>Margine %: <strong>{Number(quote.margin_percent).toFixed(2)}%</strong></p>
              </div>
            </CardContent>
          </Card>

          {/* Pannello 2: Markup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Markup default</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="mk">Percentuale</Label>
                <div className="flex gap-2">
                  <Input id="mk" type="number" step="0.1" value={defaultMarkup}
                    onChange={(e) => setDefaultMarkup(e.target.value)} placeholder="0" />
                  <Button onClick={handleSetMarkup}>Applica</Button>
                </div>
              </div>
              {pdfUrl && (
                <p className="text-sm" data-testid="pdf-link">
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline text-slate-900">Apri ultimo PDF</a>
                </p>
              )}
              {sendResult?.access_token && (
                <p className="text-sm" data-testid="public-link">
                  Link cliente: <a href={`/p/preview/${sendResult.access_token}`} className="underline text-slate-900">/p/preview/{sendResult.access_token.slice(0, 8)}…</a>
                </p>
              )}
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Pannello 3: Aggiungi da catalogo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aggiungi voce dal catalogo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="sup">Fornitore</Label>
              <select id="sup" value={pickSupplier}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                onChange={(e) => setPickSupplier(e.target.value)}>
                <option value="">— seleziona —</option>
                {Array.from(grouped.entries()).map(([sid]) => {
                  const first = services?.find((s) => s.fornitore_id === sid)
                  return (
                    <option key={sid} value={sid}>
                      {sid.slice(0, 8)} — {first?.service_categories?.subrole ?? '—'} ({grouped.get(sid)?.length ?? 0} servizi)
                    </option>
                  )
                })}
              </select>
            </div>
            {pickSupplier && (
              <ul className="space-y-1 text-sm">
                {(grouped.get(pickSupplier) ?? []).map((s) => (
                  <li key={s.id} className="flex justify-between items-center border border-slate-200 rounded px-3 py-2">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-slate-500">€ {s.base_price} /{s.unit.toLowerCase()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleAddItem(s.fornitore_id, s.id)}>+ Aggiungi</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
