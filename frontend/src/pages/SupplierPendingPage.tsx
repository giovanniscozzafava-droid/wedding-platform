import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, X, HelpCircle, CircleDashed } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ============================================================================
// "Lavori da confermare": il fornitore NON conferma le singole voci (album,
// servizio fotografico…) una per una. Dichiara la propria PRESENZA sull'INTERO
// preventivo assegnato da un capostipite → Si` / No / Forse. La conferma "Si`"
// sblocca il budget totale del capostipite. Non sono contratti.
// ============================================================================

type Item = {
  id: string; name_snapshot: string; description_snapshot: string | null
  quantity: number; line_client: number; quote_id: string
  supplier_presence: 'SI' | 'NO' | 'FORSE' | null
}
type Group = {
  quote_id: string
  entry_title?: string; event_date?: string | null; client_name?: string | null
  items: Item[]
  presence: 'SI' | 'NO' | 'FORSE' | null
  total: number
}

export default function SupplierPendingPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const confirmId = searchParams.get('confirm')

  async function load() {
    setLoading(true)
    try {
      const me = (await supabase.auth.getUser()).data.user?.id
      if (!me) { setGroups([]); return }
      // Mostra solo i preventivi ANCORA DA DECIDERE: presenza null o "Forse".
      // "Ci sono" (SI) e "Non ci sono" (NO) escono dalla lista.
      const { data } = await (supabase.from as any)('quote_items')
        .select('id, name_snapshot, description_snapshot, quantity, line_client, quote_id, supplier_presence, supplier_confirmed_at')
        .eq('supplier_id', me).is('supplier_confirmed_at', null).order('created_at', { ascending: false })
      const items = ((data ?? []) as Item[]).filter((x) => x.supplier_presence == null || x.supplier_presence === 'FORSE')

      // Raggruppa per preventivo.
      const byQuote = new Map<string, Group>()
      for (const it of items) {
        let g = byQuote.get(it.quote_id)
        if (!g) { g = { quote_id: it.quote_id, items: [], presence: it.supplier_presence, total: 0 }; byQuote.set(it.quote_id, g) }
        g.items.push(it)
        g.total += Number(it.line_client) * Number(it.quantity || 1)
        if (it.supplier_presence === 'FORSE') g.presence = 'FORSE'
      }
      const quoteIds = Array.from(byQuote.keys())
      if (quoteIds.length > 0) {
        // Qui devono arrivare SOLO i preventivi dei capostipiti: escludo quelli
        // di cui il fornitore stesso è il proprietario (i suoi preventivi diretti).
        const { data: quotes } = await (supabase.from as any)('quotes')
          .select('id, title, owner_id, event_date').in('id', quoteIds)
        for (const q of (quotes ?? []) as any[]) {
          if (q.owner_id === me) { byQuote.delete(q.id); continue }
          const g = byQuote.get(q.id)
          if (g) { g.entry_title = q.title; g.event_date = q.event_date } // fallback dal preventivo
        }
        // Titolo/dettagli più precisi dall'evento in calendario, se presente.
        const { data: events } = await (supabase.from as any)('calendar_entries')
          .select('id, title, date_from, client_name, quote_id').in('quote_id', Array.from(byQuote.keys()))
        for (const e of (events ?? []) as any[]) {
          const g = byQuote.get(e.quote_id)
          if (g) { g.entry_title = e.title ?? g.entry_title; g.event_date = e.date_from ?? g.event_date; g.client_name = e.client_name }
        }
      }
      setGroups(Array.from(byQuote.values()))
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function setPresence(quoteId: string, status: 'SI' | 'NO' | 'FORSE') {
    setBusy(quoteId)
    try {
      const { error } = await (supabase as any).rpc('supplier_set_quote_presence', { p_quote_id: quoteId, p_status: status })
      if (error) { toast.error(error.message); return }
      toast.success(status === 'SI' ? 'Confermata la tua presenza' : status === 'NO' ? 'Hai declinato' : 'Segnato come "forse"')
      if (confirmId) { searchParams.delete('confirm'); setSearchParams(searchParams, { replace: true }) }
      await load()
    } finally { setBusy(null) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8">
        <PageHeader eyebrow="Pipeline" title="Lavori da confermare"
          description="Un capostipite (wedding planner / location) ti ha inserito in un preventivo. Dichiara se ci sei: confermare la presenza serve a chiudere il budget totale del capostipite. Non sono contratti." />
        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
        ) : groups.length === 0 ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun preventivo da confermare.</Card>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <Card key={g.quote_id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="self-start min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full" style={{ background: 'rgb(var(--bg-sunken))' }}>
                    <CircleDashed size={20} style={{ color: 'rgb(var(--gold-700))' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <h3 className="font-medium">{g.entry_title ?? 'Preventivo'}</h3>
                      {g.event_date && <span className="text-[11px] text-[rgb(var(--fg-subtle))]">{new Date(g.event_date).toLocaleDateString('it-IT')}</span>}
                      {g.client_name && <span className="text-[11px] text-[rgb(var(--fg-subtle))]">· {g.client_name}</span>}
                      {g.presence === 'FORSE' && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>in valutazione</span>}
                    </div>
                    {/* Le voci sono solo di riepilogo: NON si confermano una per una. */}
                    <ul className="mt-2 space-y-1">
                      {g.items.map((it) => (
                        <li key={it.id} className="text-xs text-[rgb(var(--fg-muted))] flex items-center justify-between gap-2">
                          <span className="truncate">• {it.name_snapshot}{Number(it.quantity) > 1 ? ` ×${Number(it.quantity)}` : ''}</span>
                          <span className="shrink-0 text-[rgb(var(--fg-subtle))]">€ {(Number(it.line_client) * Number(it.quantity || 1)).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]">
                      {g.items.length} voci · totale € {g.total.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="gold" disabled={busy === g.quote_id} onClick={() => setPresence(g.quote_id, 'SI')} className="min-h-[40px]">
                        <Check size={14} /> Ci sono
                      </Button>
                      <Button variant="outline" disabled={busy === g.quote_id} onClick={() => setPresence(g.quote_id, 'FORSE')} className="min-h-[40px]">
                        <HelpCircle size={14} /> Forse
                      </Button>
                      <Button variant="ghost" disabled={busy === g.quote_id} onClick={() => setPresence(g.quote_id, 'NO')} className="min-h-[40px] text-[rgb(var(--danger,220_38_38))]">
                        <X size={14} /> Non ci sono
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
