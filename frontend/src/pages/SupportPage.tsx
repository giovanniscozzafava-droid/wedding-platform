import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy, Mail, HelpCircle, Send, MessageCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const SUPPORT_EMAIL = 'hello@planfully.it'

const REPARTI = [
  { v: 'GENERALE',    l: 'Domanda generale' },
  { v: 'TECNICO',     l: 'Problema tecnico' },
  { v: 'FATTURAZIONE', l: 'Abbonamento / fatturazione' },
  { v: 'SUGGERIMENTO', l: 'Suggerimento / idea' },
]

type Ticket = { id: string; reparto: string; subject: string; message: string; status: string; created_at: string }

export default function SupportPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.is_support_staff || profile?.role === 'ADMIN'
  const [reparto, setReparto] = useState('GENERALE')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<{ id: string; is_staff: boolean; body: string; created_at: string }[]>([])
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)

  async function loadTickets() {
    if (!user) return
    const { data } = await (supabase.from as any)('support_tickets')
      .select('id, reparto, subject, message, status, created_at')
      .order('created_at', { ascending: false }).limit(10)
    setTickets((data ?? []) as Ticket[])
  }
  useEffect(() => { void loadTickets() }, [user])

  async function openTicket(t: Ticket) {
    if (openId === t.id) { setOpenId(null); return }
    setOpenId(t.id); setMsgs([]); setReply('')
    const { data } = await (supabase.from as any)('support_ticket_messages')
      .select('id, is_staff, body, created_at').eq('ticket_id', t.id).order('created_at', { ascending: true })
    setMsgs((data ?? []) as any)
  }

  async function sendReply(t: Ticket) {
    if (!reply.trim() || !user) return
    setReplying(true)
    try {
      const { error } = await (supabase.from as any)('support_ticket_messages')
        .insert({ ticket_id: t.id, author_id: user.id, body: reply.trim() })
      if (error) throw error
      await supabase.functions.invoke('support-notify', { body: { ticket_id: t.id, body: reply.trim(), to_role: 'STAFF' } }).catch(() => {})
      toast.success('Messaggio inviato')
      setReply('')
      await openTicket(t); await openTicket(t) // ricarica thread
      void loadTickets()
    } catch (e) { toast.error((e as Error).message) }
    finally { setReplying(false) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) { toast.error('Aggiungi un oggetto e un messaggio'); return }
    if (!user) { toast.error('Devi essere connesso'); return }
    setSending(true)
    try {
      // La function salva il ticket E avvisa lo staff via email (con reply-to).
      const { data, error } = await supabase.functions.invoke('support-ticket', {
        body: { reparto, subject: subject.trim(), message: message.trim() },
      })
      if (error) throw error
      const emailed = (data as any)?.emailed !== false
      toast.success(emailed
        ? 'Richiesta inviata! È arrivata al nostro staff, ti rispondiamo via email.'
        : 'Richiesta registrata. Ti ricontattiamo via email a breve.')
      setSubject(''); setMessage(''); setReparto('GENERALE')
      void loadTickets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally { setSending(false) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Centro assistenza"
          title="Siamo qui per te"
          description="Una domanda, un dubbio, un'idea? Scrivici: nessuna richiesta è troppo piccola. Ti rispondiamo con calma e in italiano."
          actions={isAdmin && (
            <Link to="/admin/assistenza"><Button variant="outline" size="sm"><LifeBuoy size={14} /> Gestione staff</Button></Link>
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form ticket */}
          <Card className="lg:col-span-2 p-6">
            <h2 className="font-display text-xl mb-1 flex items-center gap-2"><LifeBuoy size={18} /> Apri una richiesta</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-5">Raccontaci cosa ti serve. Più dettagli ci dai, più in fretta ti aiutiamo.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="reparto">Di cosa si tratta?</Label>
                <select id="reparto" value={reparto} onChange={(e) => setReparto(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
                  {REPARTI.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="subject">In due parole</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Es. Non riesco a inviare un preventivo" maxLength={120} />
              </div>
              <div>
                <Label htmlFor="message">Raccontaci tutto</Label>
                <Textarea id="message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descrivi con calma cosa sta succedendo o cosa vorresti fare. Se è un problema, dicci anche quando è capitato." />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="gold" disabled={sending}>
                  <Send size={14} /> {sending ? 'Invio…' : 'Invia la richiesta'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Contatti diretti */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-display text-lg mb-3">Preferisci scriverci?</h2>
              <a href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                style={{ borderColor: 'rgb(var(--border))' }}>
                <Mail size={18} className="text-[rgb(var(--gold-700))]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{SUPPORT_EMAIL}</p>
                </div>
              </a>
              <Link to="/faq"
                className="mt-3 flex items-center gap-3 p-3 rounded-lg border hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                style={{ borderColor: 'rgb(var(--border))' }}>
                <HelpCircle size={18} className="text-[rgb(var(--gold-700))]" />
                <div>
                  <p className="text-sm font-medium">Guide e FAQ</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))]">Le risposte alle domande più comuni</p>
                </div>
              </Link>
              <div className="mt-4 flex items-start gap-2 text-xs text-[rgb(var(--fg-subtle))]">
                <MessageCircle size={14} className="shrink-0 mt-0.5" />
                <span>Suggerimento: attiva la modalità <strong>“? Aiuto”</strong> in alto per spiegazioni su ogni schermata, senza scriverci.</span>
              </div>
            </Card>

            {/* I miei ticket */}
            {tickets.length > 0 && (
              <Card className="p-6">
                <h2 className="font-display text-lg mb-3">Le tue richieste</h2>
                <ul className="space-y-2">
                  {tickets.map((t) => (
                    <li key={t.id} className="text-sm border-b pb-2 last:border-0" style={{ borderColor: 'rgb(var(--border))' }}>
                      <button onClick={() => void openTicket(t)} className="w-full text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{t.subject}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: t.status === 'CHIUSO' ? 'rgb(var(--sage-100))' : 'rgb(var(--gold-100))', color: 'rgb(var(--fg-muted))' }}>
                            {t.status === 'APERTO' ? 'In attesa' : t.status === 'IN_LAVORAZIONE' ? 'In lavorazione' : 'Chiuso'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--fg-subtle))] flex items-center gap-1 mt-0.5">
                          <Clock size={10} /> {new Date(t.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {openId === t.id ? ' · chiudi' : ' · apri conversazione'}
                        </p>
                      </button>
                      {openId === t.id && (
                        <div className="mt-2 space-y-2">
                          <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgb(var(--bg-elev))', border: '1px solid rgb(var(--border))' }}>
                            <p className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-0.5">Tu</p>
                            <p className="whitespace-pre-wrap">{t.message}</p>
                          </div>
                          {msgs.map((m) => (
                            <div key={m.id} className="rounded-lg p-2.5 text-xs"
                              style={{ background: m.is_staff ? 'rgb(var(--gold-100))' : 'rgb(var(--bg-elev))', border: '1px solid rgb(var(--border))' }}>
                              <p className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-0.5">{m.is_staff ? 'Staff Planfully' : 'Tu'}</p>
                              <p className="whitespace-pre-wrap">{m.body}</p>
                            </div>
                          ))}
                          {t.status !== 'CHIUSO' && (
                            <div className="flex gap-2">
                              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Scrivi una risposta…" />
                              <Button size="sm" variant="gold" onClick={() => void sendReply(t)} disabled={replying || !reply.trim()}>
                                <Send size={13} />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
