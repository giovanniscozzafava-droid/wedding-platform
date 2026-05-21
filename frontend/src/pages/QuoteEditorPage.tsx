import { useMemo, useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, FileDown, Send, Plus, Trash2, ExternalLink, Sparkles, Users, Table, Clock, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useServices } from '@/hooks/useCatalog'
import { useSuppliers } from '@/hooks/useSuppliers'
import {
  useAddQuoteItem, useGeneratePdf, useQuote, useRemoveQuoteItem, useSendQuote, useUpdateQuote, useUpdateQuoteItem,
} from '@/hooks/useQuotes'
import type { Database } from '@/lib/database.types'

type Unit = Database['public']['Enums']['service_unit']
type Basis = Database['public']['Enums']['quantity_basis']

// Heuristic: dato unit del servizio, suggerisce basis di default
function defaultBasisFor(unit: Unit): Basis {
  switch (unit) {
    case 'PERSONA': return 'PER_GUEST'
    case 'ORA': return 'PER_HOUR'
    case 'PEZZO': return 'FLAT' // utente puo` switchare a PER_TABLE manualmente
    case 'EVENTO': return 'FLAT'
    default: return 'FLAT'
  }
}

function quantityFor(basis: Basis, guests: number | null | undefined, tables: number | null | undefined): number {
  switch (basis) {
    case 'PER_GUEST': return Math.max(guests ?? 1, 1)
    case 'PER_TABLE': return Math.max(tables ?? 1, 1)
    case 'PER_HOUR': return 1
    case 'FLAT': return 1
  }
}

const BASIS_LABEL: Record<Basis, { label: string; icon: typeof Users }> = {
  FLAT:      { label: 'Quantità fissa', icon: Package },
  PER_GUEST: { label: '× invitati',     icon: Users },
  PER_TABLE: { label: '× tavoli',       icon: Table },
  PER_HOUR:  { label: '× ore',          icon: Clock },
}

export default function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { data: quote, isLoading } = useQuote(id ?? null)
  const update = useUpdateQuote()
  const addItem = useAddQuoteItem()
  const remItem = useRemoveQuoteItem()
  const updItem = useUpdateQuoteItem()
  const genPdf = useGeneratePdf()
  const sendQ = useSendQuote()
  const { data: services } = useServices({ onlyActive: true })
  const { data: suppliers } = useSuppliers()

  const [defaultMarkup, setDefaultMarkup] = useState<string>('')
  const [guestCount, setGuestCount] = useState<string>('')
  const [tableCount, setTableCount] = useState<string>('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ access_token?: string } | null>(null)
  const [pickSupplier, setPickSupplier] = useState<string>('')

  useEffect(() => {
    if (quote) {
      setDefaultMarkup(quote.default_markup_percent?.toString() ?? '')
      setGuestCount(quote.guest_count?.toString() ?? '')
      setTableCount((quote as any).table_count?.toString() ?? '')
      setPdfUrl(quote.pdf_url ?? null)
    }
  }, [quote])

  const grouped = useMemo(() => {
    const out = new Map<string, NonNullable<typeof services>>()
    for (const s of services ?? []) {
      const arr = out.get(s.fornitore_id) ?? []
      arr.push(s)
      out.set(s.fornitore_id, arr)
    }
    return out
  }, [services])

  if (isLoading) return <div className="p-10 text-[rgb(var(--fg-subtle))]">Caricamento...</div>
  if (!quote) return <div className="p-10 text-[rgb(var(--rose-500))]">Preventivo non trovato</div>

  async function handleAddItem(supplierId: string, serviceId: string) {
    if (!id) return
    const svc = services?.find((s) => s.id === serviceId)
    if (!svc || !quote) return
    const basis = defaultBasisFor(svc.unit)
    const qty = quantityFor(basis, quote.guest_count, (quote as any).table_count)
    try {
      await addItem.mutateAsync({
        quote_id: id, service_id: svc.id, supplier_id: supplierId,
        name_snapshot: svc.name, description_snapshot: svc.description ?? null,
        unit_snapshot: svc.unit, snapshot_price: svc.base_price, quantity: qty,
        quantity_basis: basis,
      })
      toast.success(`Voce aggiunta · ${qty} ${svc.unit.toLowerCase()}`)
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handleHeaderUpdate() {
    if (!id) return
    try {
      await update.mutateAsync({ id, patch: {
        default_markup_percent: Number(defaultMarkup || 0),
        guest_count: guestCount ? Number(guestCount) : null,
        table_count: tableCount ? Number(tableCount) : null,
      } as any })
      toast.success('Header aggiornato (quantità per_guest/per_table propagate)')
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handleChangeItemBasis(itemId: string, newBasis: Basis) {
    if (!id || !quote) return
    const qty = quantityFor(newBasis, quote.guest_count, (quote as any).table_count)
    try {
      await updItem.mutateAsync({ id: itemId, quoteId: id, patch: { quantity_basis: newBasis, quantity: qty } })
    } catch (e) { toast.error((e as Error).message) }
  }
  async function handleChangeItemQty(itemId: string, qty: number) {
    if (!id) return
    try {
      await updItem.mutateAsync({ id: itemId, quoteId: id, patch: { quantity: qty } })
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handlePdf(variant: 'NEUTRA' | 'PREMIUM') {
    if (!id) return
    try {
      const r = await genPdf.mutateAsync({ quoteId: id, variant })
      setPdfUrl(r.url)
      toast.success(`PDF ${variant.toLowerCase()} generato`)
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handleSend() {
    if (!id) return
    try {
      const r = await sendQ.mutateAsync(id)
      setSendResult(r)
      setPdfUrl(r.pdf_url ?? pdfUrl)
      toast.success('Preventivo inviato')
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <Link to="/quotes" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-3">
          <ArrowLeft size={14} /> Preventivi
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--gold-600))' }}>
              Editor preventivo · v{quote.revision}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl mt-1">{quote.title}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))]">
              <Badge status={quote.status} />
              {quote.client_name && <span>· {quote.client_name}</span>}
              {quote.event_date && <span>· {new Date(quote.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handlePdf('NEUTRA')} disabled={genPdf.isPending} data-testid="pdf-neutra">
              <FileDown /> PDF Neutra
            </Button>
            <Button variant="outline" onClick={() => handlePdf('PREMIUM')} disabled={genPdf.isPending} data-testid="pdf-premium">
              <Sparkles /> PDF Premium
            </Button>
            <Button variant="gold" onClick={handleSend} disabled={sendQ.isPending} data-testid="send-quote-btn">
              <Send /> {sendQ.isPending ? 'Invio...' : 'Invia al cliente'}
            </Button>
          </div>
        </div>

        {/* Header settings: guest / table / markup */}
        <Card className="p-5 mb-6">
          <h2 className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-3">Parametri evento</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="gc"><Users size={12} className="inline" /> Invitati</Label>
              <Input id="gc" type="number" min="0" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tc"><Table size={12} className="inline" /> Tavoli</Label>
              <Input id="tc" type="number" min="0" value={tableCount} onChange={(e) => setTableCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mk">Markup default %</Label>
              <Input id="mk" type="number" step="0.1" value={defaultMarkup} onChange={(e) => setDefaultMarkup(e.target.value)} />
            </div>
            <Button onClick={handleHeaderUpdate} variant="gold">Applica</Button>
          </div>
          <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">
            Cambiare <strong>invitati</strong>/<strong>tavoli</strong> riallinea automaticamente le voci con basis × invitati / × tavoli.
          </p>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voci */}
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border))' }}>
              <h2 className="font-display text-lg">Voci ({quote.quote_items.length})</h2>
            </div>
            <div className="px-6 py-3" data-testid="quote-items">
              {quote.quote_items.length === 0 && (
                <p className="text-sm text-[rgb(var(--fg-subtle))] py-8 text-center">
                  Nessuna voce. Aggiungine dal catalogo qui sotto.
                </p>
              )}
              <motion.ul layout className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {quote.quote_items.map((it) => {
                  const basis = (it as any).quantity_basis as Basis ?? 'FLAT'
                  const Icon = BASIS_LABEL[basis].icon
                  return (
                    <motion.li key={it.id} layout className="py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{it.name_snapshot}</p>
                          <p className="text-xs text-[rgb(var(--fg-subtle))]">
                            € {Number(it.snapshot_price).toFixed(2)} {it.unit_snapshot.toLowerCase()} ·
                            costo € {Number(it.line_cost).toLocaleString('it-IT')} ·
                            cliente <strong>€ {Number(it.line_client).toLocaleString('it-IT')}</strong>
                          </p>
                        </div>
                        <Button variant="ghost" size="icon"
                          onClick={() => remItem.mutate({ id: it.id, quoteId: quote.id })}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 ml-0">
                        <Icon size={14} className="text-[rgb(var(--fg-subtle))]" />
                        <Select value={basis} onChange={(e) => handleChangeItemBasis(it.id, e.target.value as Basis)}
                          className="h-8 w-44 text-xs">
                          {Object.entries(BASIS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </Select>
                        <Input type="number" step="0.5" value={Number(it.quantity)}
                          onChange={(e) => handleChangeItemQty(it.id, Number(e.target.value))}
                          disabled={basis === 'PER_GUEST' || basis === 'PER_TABLE'}
                          className="h-8 w-24 text-xs" />
                        <span className="text-xs text-[rgb(var(--fg-subtle))]">{it.unit_snapshot.toLowerCase()}</span>
                      </div>
                    </motion.li>
                  )
                })}
              </motion.ul>
            </div>
            <div className="px-6 py-4 border-t bg-[rgb(var(--bg-sunken))]" style={{ borderColor: 'rgb(var(--border))' }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Totals label="Costo" value={quote.total_cost} />
                <Totals label="Cliente" value={quote.total_client} accent />
                <Totals label="Margine" value={quote.margin_amount} />
                <Totals label="Margine %" value={`${Number(quote.margin_percent).toFixed(2)}%`} raw />
              </div>
            </div>
          </Card>

          {/* Sidebar actions */}
          <Card className="p-6 space-y-4 self-start">
            <div className="space-y-1">
              <h3 className="font-display text-lg">Output</h3>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">Genera PDF o invia link cliente</p>
            </div>
            {pdfUrl && (
              <div className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }} data-testid="pdf-link">
                <p className="text-xs text-[rgb(var(--fg-subtle))] mb-1">Ultimo PDF</p>
                <a href={pdfUrl} target="_blank" rel="noreferrer"
                  className="text-sm font-medium inline-flex items-center gap-1 hover:underline">
                  Apri <ExternalLink size={12} />
                </a>
              </div>
            )}
            {sendResult?.access_token && (
              <div className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }} data-testid="public-link">
                <p className="text-xs text-[rgb(var(--fg-subtle))] mb-1">Link cliente</p>
                <a href={`/p/preview/${sendResult.access_token}`} target="_blank" rel="noreferrer"
                  className="text-sm font-medium break-all hover:underline">
                  /p/preview/{sendResult.access_token.slice(0, 12)}…
                </a>
              </div>
            )}
            <div className="text-xs text-[rgb(var(--fg-subtle))] pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <p className="mb-2 font-medium">Suggerimenti basis</p>
              <ul className="space-y-1">
                <li><Users size={11} className="inline mr-1" /> Menu/aperitivo/welcome → <strong>per invitato</strong></li>
                <li><Table size={11} className="inline mr-1" /> Centrotavola → <strong>per tavolo</strong></li>
                <li><Clock size={11} className="inline mr-1" /> Open bar/musicisti → <strong>per ora</strong></li>
                <li><Package size={11} className="inline mr-1" /> Sala/foto/video → <strong>quantità fissa</strong></li>
              </ul>
            </div>
          </Card>

          {/* Aggiungi voce */}
          <Card className="lg:col-span-3 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg">Aggiungi voce dal catalogo</h3>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 items-end max-w-md">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="sup">Fornitore</Label>
                  <Select id="sup" value={pickSupplier}
                    onChange={(e) => setPickSupplier(e.target.value)}>
                    <option value="">— seleziona —</option>
                    {Array.from(grouped.entries()).map(([sid]) => {
                      const sup = suppliers?.find((s) => s.id === sid)
                      return (
                        <option key={sid} value={sid}>
                          {sup?.business_name ?? sup?.full_name ?? sid.slice(0, 8)} {sup?.subrole ? `· ${sup.subrole}` : ''} ({grouped.get(sid)?.length ?? 0})
                        </option>
                      )
                    })}
                  </Select>
                </div>
              </div>
              {pickSupplier && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(grouped.get(pickSupplier) ?? []).map((s) => (
                    <div key={s.id} className="rounded-lg border p-3 flex gap-3 hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                      style={{ borderColor: 'rgb(var(--border))' }}>
                      {s.service_photos[0] && (
                        <img src={s.service_photos[0].thumbnail_url} alt=""
                          className="h-14 w-14 rounded-md object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{s.name}</p>
                        <p className="text-xs text-[rgb(var(--fg-subtle))]">
                          € {s.base_price} /{s.unit.toLowerCase()} · auto-basis {BASIS_LABEL[defaultBasisFor(s.unit)].label}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleAddItem(s.fornitore_id, s.id)}>
                        <Plus size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Totals({ label, value, accent, raw }: { label: string; value: number | string; accent?: boolean; raw?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className={`font-display tabular-nums ${accent ? 'text-2xl' : 'text-xl'}`} style={accent ? { color: 'rgb(var(--gold-700))' } : undefined}>
        {raw ? value : `€ ${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
      </p>
    </div>
  )
}
