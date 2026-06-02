import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ============================================================================
// "Lavori da confermare": voci di preventivo che un capostipite (WP/Location)
// ha assegnato al fornitore. Confermando, il fornitore conferma la propria
// partecipazione → sblocca il budget totale del capostipite. NON sono contratti.
// ============================================================================

type PendingItem = {
  id: string; name_snapshot: string; description_snapshot: string | null
  quantity: number; line_client: number; quote_id: string
  entry_title?: string; event_date?: string | null; client_name?: string | null
}

export default function SupplierPendingPage() {
  const [pending, setPending] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const confirmId = searchParams.get('confirm')

  async function load() {
    setLoading(true)
    try {
      const me = (await supabase.auth.getUser()).data.user?.id
      if (!me) { setPending([]); return }
      const { data } = await (supabase.from as any)('quote_items')
        .select('id, name_snapshot, description_snapshot, quantity, line_client, supplier_confirmed_at, quote_id')
        .eq('supplier_id', me).is('supplier_confirmed_at', null).order('created_at', { ascending: false })
      const items = (data ?? []) as PendingItem[]
      const quoteIds = Array.from(new Set(items.map((x) => x.quote_id))).filter(Boolean)
      if (quoteIds.length > 0) {
        const { data: events } = await (supabase.from as any)('calendar_entries')
          .select('id, title, date_from, client_name, quote_id').in('quote_id', quoteIds)
        const byQuote = new Map<string, any>((events ?? []).map((e: any) => [e.quote_id, e]))
        for (const it of items) {
          const ev = byQuote.get(it.quote_id)
          if (ev) { it.entry_title = ev.title; it.event_date = ev.date_from; it.client_name = ev.client_name }
        }
      }
      setPending(items)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function confirmItem(itemId: string) {
    const { error } = await (supabase as any).rpc('supplier_confirm_quote_item', { p_item_id: itemId })
    if (error) { toast.error(error.message); return }
    toast.success('Voce confermata')
    if (confirmId === itemId) { searchParams.delete('confirm'); setSearchParams(searchParams, { replace: true }) }
    await load()
  }

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8">
        <PageHeader eyebrow="Pipeline" title="Lavori da confermare"
          description="Voci di preventivo che un capostipite (wedding planner / location) ti ha assegnato. Conferma la tua partecipazione: serve a chiudere il budget totale del capostipite. Non sono contratti." />
        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
        ) : pending.length === 0 ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Nessuna voce da confermare.</Card>
        ) : (
          <div className="space-y-2">
            {pending.map((it) => (
              <Card key={it.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="self-start min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full" style={{ background: 'rgb(var(--bg-sunken))' }}>
                    <CircleDashed size={20} style={{ color: 'rgb(var(--gold-700))' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{it.name_snapshot}</h3>
                    {it.description_snapshot && <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 line-clamp-2">{it.description_snapshot}</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-[rgb(var(--fg-subtle))]">
                      {it.entry_title && <span>{it.entry_title}</span>}
                      {it.event_date && <span>· {new Date(it.event_date).toLocaleDateString('it-IT')}</span>}
                      {it.client_name && <span>· {it.client_name}</span>}
                      <span>· qty {Number(it.quantity)}</span>
                      <span>· € {Number(it.line_client).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <Button variant="gold" onClick={() => confirmItem(it.id)} className="min-h-[44px] w-full sm:w-auto">
                    <CheckCircle2 size={14} /> Conferma
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
