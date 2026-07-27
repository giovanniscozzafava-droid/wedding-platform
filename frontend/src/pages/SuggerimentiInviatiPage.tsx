import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Calendar, Loader2, UserCheck, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'
import { Card } from '@/components/ui/card'

// "Suggerimenti inviati" (referrer): i colleghi che HO suggerito ai miei clienti, con l'esito.
// Confluiscono i due canali: cieco (supplier_suggestions) e aperto (supplier_referrals).
// Raggruppati per cliente: per ogni cliente vedo chi ho suggerito e a che punto è.
type Sent = {
  channel: 'blind' | 'open'
  id: string
  status: string
  event_kind: string | null
  event_date: string | null
  quote_id: string | null
  created_at: string
  client_name: string | null
  supplier: { business_name: string | null; full_name: string | null; subrole: string | null } | null
}

// esito per stato — testo + colore. Canale cieco (supplier_suggestions).
const BLIND_STATUS: Record<string, { l: string; c: string }> = {
  SENT: { l: 'Inviato al fornitore', c: 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]' },
  VIEWED: { l: 'Visto dal fornitore', c: 'bg-sky-100 text-sky-700' },
  QUOTE_CREATED: { l: 'Preventivo in bozza', c: 'bg-sky-100 text-sky-700' },
  QUOTE_SENT: { l: 'Preventivo inviato al cliente', c: 'bg-indigo-100 text-indigo-700' },
  ACCEPTED: { l: 'Accettato dal cliente', c: 'bg-emerald-100 text-emerald-700' },
  DECLINED: { l: 'Rifiutato', c: 'bg-rose-100 text-rose-700' },
}
// Canale aperto (supplier_referrals).
const OPEN_STATUS: Record<string, { l: string; c: string }> = {
  SUGGESTED: { l: 'Suggerito', c: 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]' },
  CONVERTED: { l: 'Convertito · contratto firmato', c: 'bg-emerald-100 text-emerald-700' },
}
const subroleLabel = (v: string | null | undefined) => (v ? (SUPPLIER_SUBROLES.find((s) => s.v === v)?.l ?? v) : '')

export default function SuggerimentiInviatiPage() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['suggerimenti-inviati', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const blindQ = (supabase.from as any)('supplier_suggestions')
        .select('id, status, event_kind, event_date, quote_id, created_at, supplier:profiles!supplier_suggestions_supplier_id_fkey(business_name, full_name, subrole), priv:supplier_suggestions_private(client_name)')
        .eq('referrer_id', user!.id).order('created_at', { ascending: false })
      const openQ = (supabase.from as any)('supplier_referrals')
        .select('id, status, event_kind, client_name, quote_id, created_at, supplier:profiles!supplier_referrals_suggested_id_fkey(business_name, full_name, subrole)')
        .eq('referrer_id', user!.id).neq('status', 'CANCELLED').order('created_at', { ascending: false })

      const [blindR, openR] = await Promise.all([blindQ, openQ])
      if (blindR.error) throw blindR.error
      if (openR.error) throw openR.error

      const blind: Sent[] = ((blindR.data ?? []) as any[]).map((s) => ({
        channel: 'blind', id: s.id, status: s.status, event_kind: s.event_kind, event_date: s.event_date,
        quote_id: s.quote_id, created_at: s.created_at, supplier: s.supplier, client_name: s.priv?.client_name ?? null,
      }))
      const open: Sent[] = ((openR.data ?? []) as any[]).map((s) => ({
        channel: 'open', id: s.id, status: s.status, event_kind: s.event_kind, event_date: null,
        quote_id: s.quote_id, created_at: s.created_at, supplier: s.supplier, client_name: s.client_name ?? null,
      }))
      return [...blind, ...open].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    },
  })

  // raggruppa per cliente (nome), preservando l'ordine di primo inserimento
  const groups = useMemo(() => {
    const list = data ?? []
    const map = new Map<string, { client: string; event_kind: string | null; event_date: string | null; items: Sent[] }>()
    for (const it of list) {
      const key = (it.client_name?.trim() || 'Cliente senza nome') + '|' + (it.event_date ?? '')
      const g = map.get(key)
      if (g) { g.items.push(it); if (!g.event_date && it.event_date) g.event_date = it.event_date }
      else map.set(key, { client: it.client_name?.trim() || 'Cliente senza nome', event_kind: it.event_kind, event_date: it.event_date, items: [it] })
    }
    return [...map.values()]
  }, [data])

  const dateStr = (d: string | null) => (d ? new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'data da definire')
  const total = data?.length ?? 0
  const won = (data ?? []).filter((s) => s.status === 'ACCEPTED' || s.status === 'CONVERTED').length

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-4xl px-4 sm:px-8 py-8">
        <div className="flex items-center gap-2 mb-1"><Send size={20} className="text-[rgb(var(--gold-600))]" /><h1 className="font-display text-3xl sm:text-4xl">Suggerimenti inviati</h1></div>
        <p className="text-[rgb(var(--fg-muted))] mb-6">I colleghi che hai suggerito ai tuoi clienti e a che punto è ognuno. Quando un fornitore che hai suggerito invia il preventivo o firma il contratto, l'esito si aggiorna qui.</p>

        {!isLoading && total > 0 && (
          <div className="flex gap-3 mb-6">
            <Card className="px-4 py-3 flex-1"><p className="text-2xl font-display">{total}</p><p className="text-xs text-[rgb(var(--fg-muted))]">Suggerimenti inviati</p></Card>
            <Card className="px-4 py-3 flex-1"><p className="text-2xl font-display text-emerald-600">{won}</p><p className="text-xs text-[rgb(var(--fg-muted))]">Andati a buon fine</p></Card>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-[rgb(var(--fg-muted))]"><Loader2 size={20} className="animate-spin inline" /> Carico…</div>
        ) : groups.length === 0 ? (
          <Card className="p-10 text-center">
            <Send size={24} className="mx-auto mb-3 text-[rgb(var(--gold-600))]" />
            <p className="font-display text-lg mb-1">Non hai ancora suggerito nessuno</p>
            <p className="text-sm text-[rgb(var(--fg-muted))]">Dopo aver inviato un preventivo a un cliente puoi suggerirgli i tuoi colleghi degli altri settori: li ritrovi qui con il loro esito.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((g, gi) => (
              <Card key={gi} className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-3 pb-3 border-b border-[rgb(var(--border))]">
                  <UserCheck size={16} className="text-[rgb(var(--fg-muted))]" />
                  <span className="font-display text-lg">{g.client}</span>
                  <span className="text-sm text-[rgb(var(--fg-muted))] capitalize">· {g.event_kind ?? 'evento'}</span>
                  <span className="text-sm text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1"><Calendar size={13} /> {dateStr(g.event_date)}</span>
                </div>
                <div className="space-y-2">
                  {g.items.map((it) => {
                    const st = (it.channel === 'blind' ? BLIND_STATUS : OPEN_STATUS)[it.status] ?? { l: it.status, c: 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]' }
                    const supName = it.supplier?.business_name ?? it.supplier?.full_name ?? 'Fornitore'
                    const sub = subroleLabel(it.supplier?.subrole)
                    const isWon = it.status === 'ACCEPTED' || it.status === 'CONVERTED'
                    return (
                      <div key={`${it.channel}-${it.id}`} className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2">
                          {isWon && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
                          <span className="font-medium truncate">{supName}</span>
                          {sub && <span className="text-xs text-[rgb(var(--fg-subtle))] shrink-0">· {sub}</span>}
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.c}`}>{st.l}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
