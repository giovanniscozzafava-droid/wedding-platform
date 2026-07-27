import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Gift, Calendar, Users, MapPin, Loader2, FileText, ArrowRight, Lock, UserCheck, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Lista dei suggerimenti ricevuti (un collega ti ha suggerito a un suo cliente). È di fatto una
// RICHIESTA/lead: puoi rispondere in due modi — "Invia preventivo" oppure "Non disponibile".
// Due canali: cieco (supplier_suggestions, contatti nascosti) e aperto (supplier_referrals, visibili).
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
  client_name?: string | null
}

const BLIND_STATUS: Record<string, { l: string; c: string }> = {
  SENT: { l: 'Nuovo', c: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' },
  VIEWED: { l: 'Visto', c: 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]' },
  QUOTE_CREATED: { l: 'Preventivo in bozza', c: 'bg-sky-100 text-sky-700' },
  QUOTE_SENT: { l: 'Preventivo inviato', c: 'bg-indigo-100 text-indigo-700' },
  ACCEPTED: { l: 'Accettato · contatti sbloccati', c: 'bg-emerald-100 text-emerald-700' },
  DECLINED: { l: 'Hai declinato', c: 'bg-rose-100 text-rose-700' },
}
const OPEN_STATUS: Record<string, { l: string; c: string }> = {
  SUGGESTED: { l: 'Nuovo · contatti visibili', c: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' },
  CONVERTED: { l: 'Convertito · contratto firmato', c: 'bg-emerald-100 text-emerald-700' },
}
// stati "già risposto": niente più azioni
const DONE = new Set(['QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'CONVERTED'])

export function SuggerimentiRicevutiList({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['suggerimenti-ricevuti', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const blindQ = (supabase.from as any)('supplier_suggestions')
        .select('id, status, event_kind, event_date, event_location, guest_count, quote_id, created_at, referrer:profiles!supplier_suggestions_referrer_id_fkey(business_name, full_name)')
        .eq('supplier_id', user!.id).order('created_at', { ascending: false })
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

  async function decline(it: Item) {
    if (!confirm('Segnare questo evento come "non disponibile"? Sparirà dalle tue richieste.')) return
    setBusy(it.id)
    try {
      if (it.channel === 'blind') {
        const { error } = await (supabase.from as any)('supplier_suggestions').update({ status: 'DECLINED' }).eq('id', it.id)
        if (error) { toast.error(error.message); return }
      } else {
        const { data, error } = await (supabase.rpc as any)('supplier_decline_referral', { p_referral_id: it.id })
        const err = (data as { error?: string } | null)?.error
        if (error || err) { toast.error(`Non riuscito${err ? `: ${err}` : ''}`); return }
      }
      toast.success('Segnato come non disponibile')
      void refetch()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }

  const list = data ?? []
  const dateStr = (d: string | null) => (d ? new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'da definire')

  // Embedded (dentro Richieste): se non c'è nulla, non ingombrare.
  if (embedded && !isLoading && list.length === 0) return null

  return (
    <div>
      {embedded && list.length > 0 && (
        <div className="flex items-center gap-2 mb-2 mt-1">
          <Gift size={15} className="text-[rgb(var(--gold-600))]" />
          <h2 className="font-display text-lg">Suggerimenti da un collega</h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-semibold">{list.length}</span>
        </div>
      )}
      {embedded && list.length > 0 && (
        <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">Un collega ti ha suggerito a un suo cliente. Rispondi: prepara un preventivo o segnala che non sei disponibile.</p>
      )}

      {isLoading && !embedded ? (
        <div className="py-16 text-center text-[rgb(var(--fg-muted))]"><Loader2 size={20} className="animate-spin inline" /> Carico…</div>
      ) : list.length === 0 && !embedded ? (
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
            const done = DONE.has(it.status)
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
                <div className="shrink-0 flex items-center gap-2">
                  {!done && !it.quote_id && (
                    <Button variant="ghost" size="sm" disabled={busy === it.id} onClick={() => void decline(it)} title="Non sono disponibile per questa data/evento">
                      <XCircle size={14} /> Non disponibile
                    </Button>
                  )}
                  {!(done && it.status === 'DECLINED') && (
                    <Button variant="gold" size="sm" disabled={busy === it.id} onClick={() => void createQuote(it)}>
                      {busy === it.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      {it.quote_id ? 'Apri preventivo' : 'Invia preventivo'} <ArrowRight size={14} />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
