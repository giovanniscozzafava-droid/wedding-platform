import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Gift, Calendar, Users, MapPin, Loader2, FileText, ArrowRight, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// "Suggerimenti ricevuti" (fornitore): eventi per cui un collega ti ha suggerito. Vedi SOLO
// data/tipo/luogo/invitati — niente dati del cliente. Crei un preventivo "cieco" e lo invii; i
// contatti si sbloccano se il cliente accetta. Alimenta la crescita: più fornitori vedono valore.
type Sugg = {
  id: string; status: string; event_kind: string | null; event_date: string | null
  event_location: string | null; guest_count: number | null; quote_id: string | null; created_at: string
  referrer: { business_name: string | null; full_name: string | null } | null
}
const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  SENT: { l: 'Nuovo', c: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' },
  VIEWED: { l: 'Visto', c: 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]' },
  QUOTE_CREATED: { l: 'Preventivo in bozza', c: 'bg-sky-100 text-sky-700' },
  QUOTE_SENT: { l: 'Preventivo inviato', c: 'bg-indigo-100 text-indigo-700' },
  ACCEPTED: { l: 'Accettato · contatti sbloccati', c: 'bg-emerald-100 text-emerald-700' },
  DECLINED: { l: 'Rifiutato', c: 'bg-rose-100 text-rose-700' },
}

export default function SuggerimentiRicevutiPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['suggerimenti-ricevuti', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('supplier_suggestions')
        .select('id, status, event_kind, event_date, event_location, guest_count, quote_id, created_at, referrer:profiles!supplier_suggestions_referrer_id_fkey(business_name, full_name)')
        .eq('supplier_id', user!.id).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Sugg[]
    },
  })

  async function createQuote(s: Sugg) {
    if (s.quote_id) { nav(`/quotes/${s.quote_id}`); return }
    setBusy(s.id)
    try {
      const { data, error } = await (supabase.rpc as any)('create_quote_from_suggestion', { p_suggestion_id: s.id })
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
        <p className="text-[rgb(var(--fg-muted))] mb-6">Eventi per cui un collega ti ha suggerito. Vedi solo la data e i dettagli dell'evento: prepara la tua offerta e inviala. I contatti del cliente si sbloccano se accetta il tuo preventivo.</p>

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
            {list.map((s) => {
              const refName = s.referrer?.business_name ?? s.referrer?.full_name ?? 'Un collega'
              const st = STATUS_LABEL[s.status] ?? { l: s.status, c: 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]' }
              return (
                <Card key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.c}`}>{st.l}</span>
                      <span className="text-[11px] text-[rgb(var(--fg-subtle))]">suggerito da <strong className="text-[rgb(var(--fg-muted))]">{refName}</strong></span>
                    </div>
                    <p className="font-display text-lg mt-1 capitalize">{s.event_kind ?? 'Evento'}</p>
                    <div className="mt-1 flex items-center gap-3 flex-wrap text-sm text-[rgb(var(--fg-muted))]">
                      <span className="inline-flex items-center gap-1"><Calendar size={13} /> {dateStr(s.event_date)}</span>
                      {s.guest_count != null && <span className="inline-flex items-center gap-1"><Users size={13} /> ~{s.guest_count} invitati</span>}
                      {s.event_location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {s.event_location}</span>}
                    </div>
                    {s.status !== 'ACCEPTED' && <p className="mt-1.5 text-[11px] text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1"><Lock size={11} /> Contatti del cliente nascosti finché non accetta</p>}
                  </div>
                  <div className="shrink-0">
                    <Button variant="gold" size="sm" disabled={busy === s.id} onClick={() => void createQuote(s)}>
                      {busy === s.id ? <Loader2 size={14} className="animate-spin" /> : s.quote_id ? <FileText size={14} /> : <FileText size={14} />}
                      {s.quote_id ? 'Apri preventivo' : 'Crea preventivo'} <ArrowRight size={14} />
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
