import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Gift, Calendar, Users, MapPin, Loader2, FileText, ArrowRight, Lock, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// "Suggerimenti ricevuti" (professionista): eventi per cui un collega ti ha suggerito.
// Due canali confluiscono qui:
//  • canale CIECO (supplier_suggestions): vedi solo data/tipo/luogo/invitati, i contatti
//    del cliente si sbloccano se accetta il tuo preventivo. Preventivo mascherato.
//  • canale APERTO (supplier_referrals): il collega ti ha segnalato a un suo cliente e i
//    contatti sono già visibili → preventivo normale, puoi contattare direttamente.
type Item = {
  channel: 'blind' | 'open'
  id: string
  status: string
  event_kind: string | null
  event_date: string | null
  event_location: string | null
  guest_count: number | null
  quote_id: string | null
  created_at: string
  referrer: { business_name: string | null; full_name: string | null } | null
  client_name?: string | null   // solo canale aperto (contatti visibili)
}

// etichette stato canale cieco (supplier_suggestions)
const BLIND_STATUS: Record<string, { l: string; c: string }> = {
  SENT: { l: 'Nuovo', c: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' },
  VIEWED: { l: 'Visto', c: 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]' },
  QUOTE_CREATED: { l: 'Preventivo in bozza', c: 'bg-sky-100 text-sky-700' },
  QUOTE_SENT: { l: 'Preventivo inviato', c: 'bg-indigo-100 text-indigo-700' },
  ACCEPTED: { l: 'Accettato · contatti sbloccati', c: 'bg-emerald-100 text-emerald-700' },
  DECLINED: { l: 'Rifiutato', c: 'bg-rose-100 text-rose-700' },
}
// etichette stato canale aperto (supplier_referrals)
const OPEN_STATUS: Record<string, { l: string; c: string }> = {
  SUGGESTED: { l: 'Nuovo · contatti visibili', c: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' },
  CONVERTED: { l: 'Convertito · contratto firmato', c: 'bg-emerald-100 text-emerald-700' },
}

export default function SuggerimentiRicevutiPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['suggerimenti-ricevuti', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // canale cieco
      const blindQ = (supabase.from as any)('supplier_suggestions')
        .select('id, status, event_kind, event_date, event_location, guest_count, quote_id, created_at, referrer:profiles!supplier_suggestions_referrer_id_fkey(business_name, full_name)')
        .eq('supplier_id', user!.id).order('created_at', { ascending: false })
      // canale aperto (contatti già visibili): niente CANCELLED
      const openQ = (supabase.from as any)('supplier_referrals')
        .select('id, status, event_kind, client_name, quote_id, created_at, referrer:profiles!supplier_referrals_referrer_id_fkey(business_name, full_name)')
        .eq('suggested_id', user!.id).neq('status', 'CANCELLED').order('created_at', { ascending: false })

      const [blindR, openR] = await Promise.all([blindQ, openQ])
      if (blindR.error) throw blindR.error
      if (openR.error) throw openR.error

      const blind: Item[] = ((blindR.data ?? []) as any[]).map((s) => ({ channel: 'blind', ...s }))
      const open: Item[] = ((openR.data ?? []) as any[]).map((s) => ({
        channel: 'open', ...s, event_date: null, event_location: null, guest_count: null,
      }))
      return [...blind, ...open].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    },
  })

  async function createQuote(it: Item) {
    if (it.quote_id) { nav(`/quotes/${it.quote_id}`); return }
    setBusy(it.id)
    try {
      const fn = it.channel === 'blind' ? 'create_quote_from_suggestion' : 'create_quote_from_referral'
      const arg = it.channel === 'blind' ? { p_suggestion_id: it.id } : { p_referral_id: it.id }
      const { data, error } = await (supabase.rpc as any)(fn, arg)
      const err = (data as { error?: string } | null)?.error
      if (error || err) { toast.error(`Non riuscito${err ? `: ${err}` : ''}`); return }
      const qid = (data as { quote_id?: string })?.quote_id
      if (qid) { void refetch(); nav(`/quotes/${qid}`) }
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }

  const list = data ?? []
  const dateStr = (d: string | null) => (d ? new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'da definire')

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-4xl px-4 sm:px-8 py-8">
        <div className="flex items-center gap-2 mb-1"><Gift size={22} className="text-[rgb(var(--gold-600))]" /><h1 className="font-display text-3xl sm:text-4xl">Suggerimenti ricevuti</h1></div>
        <p className="text-[rgb(var(--fg-muted))] mb-6">Eventi per cui un collega ti ha suggerito. Prepara la tua offerta e inviala da qui. Se il suggerimento è "cieco" vedi solo i dettagli dell'evento e i contatti si sbloccano quando il cliente accetta; se è una segnalazione diretta i contatti sono già visibili.</p>

        {isLoading ? (
          <div className="py-16 text-center text-[rgb(var(--fg-muted))]"><Loader2 size={20} className="animate-spin inline" /> Carico…</div>
        ) : list.length === 0 ? (
          <Card className="p-10 text-center">
            <Gift size={26} className="mx-auto mb-3 text-[rgb(var(--gold-600))]" />
            <p className="font-display text-lg mb-1">Ancora nessun suggerimento</p>
            <p className="text-sm text-[rgb(var(--fg-muted))]">Quando un collega ti suggerisce a un suo cliente, l'evento comparirà qui e potrai inviare subito il tuo preventivo.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {list.map((it) => {
              const refName = it.referrer?.business_name ?? it.referrer?.full_name ?? 'Un collega'
              const st = (it.channel === 'blind' ? BLIND_STATUS : OPEN_STATUS)[it.status] ?? { l: it.status, c: 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]' }
              const isBlind = it.channel === 'blind'
              return (
                <Card key={`${it.channel}-${it.id}`} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.c}`}>{st.l}</span>
                      <span className="text-[11px] text-[rgb(var(--fg-subtle))]">suggerito da <strong className="text-[rgb(var(--fg-muted))]">{refName}</strong></span>
                    </div>
                    <p className="font-display text-lg mt-1 capitalize">{it.event_kind ?? 'Evento'}</p>
                    <div className="mt-1 flex items-center gap-3 flex-wrap text-sm text-[rgb(var(--fg-muted))]">
                      <span className="inline-flex items-center gap-1"><Calendar size={13} /> {dateStr(it.event_date)}</span>
                      {it.guest_count != null && <span className="inline-flex items-center gap-1"><Users size={13} /> ~{it.guest_count} invitati</span>}
                      {it.event_location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {it.event_location}</span>}
                      {!isBlind && it.client_name && <span className="inline-flex items-center gap-1"><UserCheck size={13} /> {it.client_name}</span>}
                    </div>
                    {isBlind && it.status !== 'ACCEPTED'
                      ? <p className="mt-1.5 text-[11px] text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1"><Lock size={11} /> Contatti del cliente nascosti finché non accetta</p>
                      : !isBlind && <p className="mt-1.5 text-[11px] text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1"><UserCheck size={11} /> Contatti già visibili: puoi contattare direttamente il cliente</p>}
                  </div>
                  <div className="shrink-0">
                    <Button variant="gold" size="sm" disabled={busy === it.id} onClick={() => void createQuote(it)}>
                      {busy === it.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      {it.quote_id ? 'Apri preventivo' : 'Crea preventivo'} <ArrowRight size={14} />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
