import { useEffect, useMemo, useState } from 'react'
import { LifeBuoy, Send, CheckCircle2, Clock, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Ticket = {
  id: string; user_id: string; reparto: string; subject: string; message: string
  status: string; created_at: string; last_activity_at: string
}
type Msg = { id: string; author_id: string; is_staff: boolean; body: string; created_at: string }
type Prof = { id: string; full_name: string | null; business_name: string | null; role: string | null }

const STATUS = [
  { v: 'APERTO',         l: 'Aperti' },
  { v: 'IN_LAVORAZIONE', l: 'In lavorazione' },
  { v: 'CHIUSO',         l: 'Chiusi' },
]
const REPARTO_LABEL: Record<string, string> = {
  GENERALE: 'Generale', TECNICO: 'Tecnico', FATTURAZIONE: 'Fatturazione', SUGGERIMENTO: 'Suggerimento',
}

export default function AdminSupportPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [profs, setProfs] = useState<Record<string, Prof>>({})
  const [filter, setFilter] = useState<string>('APERTO')
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Ticket | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  async function loadTickets() {
    setLoading(true)
    try {
      const { data } = await (supabase.from as any)('support_tickets')
        .select('id, user_id, reparto, subject, message, status, created_at, last_activity_at')
        .order('last_activity_at', { ascending: false }).limit(200)
      const list = (data ?? []) as Ticket[]
      setTickets(list)
      const ids = Array.from(new Set(list.map((t) => t.user_id)))
      if (ids.length) {
        const { data: pr } = await (supabase.from as any)('profiles')
          .select('id, full_name, business_name, role').in('id', ids)
        const map: Record<string, Prof> = {}
        for (const p of ((pr ?? []) as Prof[])) map[p.id] = p
        setProfs(map)
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { void loadTickets() }, [])

  async function openTicket(t: Ticket) {
    setSel(t); setMsgs([]); setReply('')
    const { data } = await (supabase.from as any)('support_ticket_messages')
      .select('id, author_id, is_staff, body, created_at').eq('ticket_id', t.id)
      .order('created_at', { ascending: true })
    setMsgs((data ?? []) as Msg[])
  }

  async function setStatus(t: Ticket, status: string) {
    const { error } = await (supabase.from as any)('support_tickets').update({ status }).eq('id', t.id)
    if (error) { toast.error(error.message); return }
    toast.success('Stato aggiornato')
    setSel({ ...t, status })
    setTickets((prev) => prev.map((x) => x.id === t.id ? { ...x, status } : x))
  }

  async function sendReply() {
    if (!sel || !reply.trim() || !user) return
    setSending(true)
    try {
      const { error } = await (supabase.from as any)('support_ticket_messages')
        .insert({ ticket_id: sel.id, author_id: user.id, body: reply.trim() })
      if (error) throw error
      // Avvisa il cliente via email.
      await supabase.functions.invoke('support-notify', { body: { ticket_id: sel.id, body: reply.trim(), to_role: 'CUSTOMER' } }).catch(() => {})
      toast.success('Risposta inviata al cliente')
      setReply('')
      await openTicket(sel)
      void loadTickets()
    } catch (e) { toast.error((e as Error).message) }
    finally { setSending(false) }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of tickets) c[t.status] = (c[t.status] ?? 0) + 1
    return c
  }, [tickets])
  const visible = tickets.filter((t) => t.status === filter)

  function who(t: Ticket) {
    const p = profs[t.user_id]
    return p?.business_name ?? p?.full_name ?? 'Utente'
  }

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Staff" title="Assistenza · gestione"
          description="Le richieste degli utenti, in ordine di attività. Rispondi, segui lo stato, chiudi quando è risolto." />

        {/* Filtri stato */}
        <div className="flex gap-1 mb-5 overflow-x-auto">
          {STATUS.map((s) => (
            <button key={s.v} onClick={() => { setFilter(s.v); setSel(null) }}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
              style={{
                background: filter === s.v ? 'rgb(var(--fg))' : 'rgb(var(--bg-sunken))',
                color: filter === s.v ? 'rgb(var(--bg-elev))' : 'rgb(var(--fg-muted))',
              }}>
              {s.l} {counts[s.v] ? `· ${counts[s.v]}` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]"><Loader2 className="animate-spin inline" size={16} /> Carico…</Card>
        ) : sel ? (
          /* Dettaglio + thread */
          <Card className="p-0 overflow-hidden">
            <div className="p-5 border-b flex items-start justify-between gap-3" style={{ borderColor: 'rgb(var(--border))' }}>
              <div>
                <button onClick={() => setSel(null)} className="text-xs text-[rgb(var(--fg-muted))] hover:underline inline-flex items-center gap-1 mb-2"><ArrowLeft size={12} /> Tutte le richieste</button>
                <h2 className="font-display text-xl">{sel.subject}</h2>
                <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                  {who(sel)} · {REPARTO_LABEL[sel.reparto] ?? sel.reparto} · {new Date(sel.created_at).toLocaleString('it-IT')}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {STATUS.map((s) => (
                  <button key={s.v} onClick={() => void setStatus(sel, s.v)}
                    className="text-[10px] px-2 py-1 rounded-full border transition-colors"
                    style={{ borderColor: 'rgb(var(--border-strong))', background: sel.status === s.v ? 'rgb(var(--gold-500))' : 'transparent', color: sel.status === s.v ? 'white' : 'rgb(var(--fg-muted))' }}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
            {/* Thread */}
            <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto" style={{ background: 'rgb(var(--bg-sunken))' }}>
              <Bubble staff={false} who={who(sel)} body={sel.message} at={sel.created_at} />
              {msgs.map((m) => <Bubble key={m.id} staff={m.is_staff} who={m.is_staff ? 'Staff' : who(sel)} body={m.body} at={m.created_at} />)}
            </div>
            {/* Risposta */}
            <div className="p-5 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Scrivi una risposta al cliente… (gli arriva via email)" />
              <div className="flex justify-end mt-2">
                <Button variant="gold" size="sm" onClick={() => void sendReply()} disabled={sending || !reply.trim()}>
                  <Send size={14} /> {sending ? 'Invio…' : 'Rispondi al cliente'}
                </Button>
              </div>
            </div>
          </Card>
        ) : visible.length === 0 ? (
          <Card className="p-10 text-center">
            <LifeBuoy className="mx-auto mb-3 opacity-40" size={28} />
            <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna richiesta {STATUS.find((s) => s.v === filter)?.l.toLowerCase()}.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {visible.map((t) => (
              <Card key={t.id} className="p-4 hover:shadow-[var(--shadow-lift)] transition-shadow cursor-pointer" onClick={() => void openTicket(t)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">{who(t)} · {REPARTO_LABEL[t.reparto] ?? t.reparto}</p>
                  </div>
                  <span className="text-[11px] text-[rgb(var(--fg-subtle))] shrink-0 inline-flex items-center gap-1">
                    {t.status === 'CHIUSO' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {new Date(t.last_activity_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Bubble({ staff, who, body, at }: { staff: boolean; who: string; body: string; at: string }) {
  return (
    <div className={`flex ${staff ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%] rounded-2xl px-4 py-2.5"
        style={{ background: staff ? 'rgb(var(--gold-100))' : 'rgb(var(--bg-elev))', border: '1px solid rgb(var(--border))' }}>
        <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">{staff ? 'Staff' : who}</p>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{body}</p>
        <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1 text-right">{new Date(at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  )
}
