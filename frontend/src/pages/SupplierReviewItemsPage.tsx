import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TicketPercent, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'

type Item = {
  item_id: string; name: string; quote_id: string; quote_title: string | null
  client_name: string | null; event_date: string | null; line_client: number
  decision: 'RIFIUTATO' | 'FORSE'; decline_reason: string | null
  discount_percent: number | null; counter_note: string | null; wp: string | null
}

const fmtEuro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0)

export default function SupplierReviewItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Record<string, { pct: string; note: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const { data, error } = await (supabase.rpc as any)('supplier_items_to_review')
      if (error) throw error
      setItems((data ?? []) as Item[])
    } catch (e) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function propose(it: Item) {
    const d = draft[it.item_id]
    const pct = Number(d?.pct)
    if (!pct || pct <= 0 || pct > 90) { toast.error('Inserisci uno sconto tra 1 e 90%'); return }
    setBusy(it.item_id)
    try {
      const { data, error } = await (supabase.rpc as any)('supplier_propose_discount', {
        p_item_id: it.item_id, p_discount_percent: pct, p_note: d?.note?.trim() || null,
      })
      if (error) throw error
      if ((data as any)?.error) throw new Error((data as any).error)
      toast.success('Offerta scontata inviata al cliente')
      await load()
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(null) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Rete"
          title="Voci da rivedere"
          description="Le tue voci che il cliente non ha approvato. Proponi uno sconto per recuperarle: l'offerta rivista torna automaticamente al cliente."
        />

        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
        ) : items.length === 0 ? (
          <Card className="p-10 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-3 text-emerald-500" />
            <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna voce da rivedere. Quando un cliente rifiuta o mette in forse una tua voce, comparirà qui.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((it) => {
              const d = draft[it.item_id] ?? { pct: '', note: '' }
              return (
                <motion.div key={it.item_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{it.name}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={it.decision === 'RIFIUTATO' ? { color: '#dc2626', background: '#dc26261a' } : { color: '#d97706', background: '#d977061a' }}>
                            {it.decision === 'RIFIUTATO' ? 'Rifiutata' : 'In forse'}
                          </span>
                        </div>
                        <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
                          {it.quote_title ?? 'Preventivo'} · {it.client_name ?? 'cliente'}
                          {it.wp ? ` · via ${it.wp}` : ''} · prezzo attuale {fmtEuro(Number(it.line_client))}
                        </p>
                        {it.decline_reason && (
                          <p className="text-xs italic text-[rgb(var(--fg-subtle))] mt-1">Motivo del cliente: {it.decline_reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3" style={{ borderColor: 'rgb(var(--border))' }}>
                      <div className="w-24">
                        <label className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Sconto %</label>
                        <Input type="number" min="1" max="90" value={d.pct} placeholder="es. 10"
                          onChange={(e) => setDraft((s) => ({ ...s, [it.item_id]: { ...d, pct: e.target.value } }))} />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <label className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Nota (facoltativa)</label>
                        <Input value={d.note} placeholder="es. sconto fedeltà, ultima disponibilità"
                          onChange={(e) => setDraft((s) => ({ ...s, [it.item_id]: { ...d, note: e.target.value } }))} />
                      </div>
                      <Button variant="gold" disabled={busy === it.item_id} onClick={() => void propose(it)}>
                        <TicketPercent size={14} /> {busy === it.item_id ? 'Invio…' : 'Proponi sconto'}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
