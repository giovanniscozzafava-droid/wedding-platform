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

type Ticket = { id: string; reparto: string; subject: string; status: string; created_at: string }

export default function SupportPage() {
  const { user } = useAuth()
  const [reparto, setReparto] = useState('GENERALE')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])

  async function loadTickets() {
    if (!user) return
    const { data } = await (supabase.from as any)('support_tickets')
      .select('id, reparto, subject, status, created_at')
      .order('created_at', { ascending: false }).limit(10)
    setTickets((data ?? []) as Ticket[])
  }
  useEffect(() => { void loadTickets() }, [user])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) { toast.error('Aggiungi un oggetto e un messaggio'); return }
    if (!user) { toast.error('Devi essere connesso'); return }
    setSending(true)
    try {
      const { error } = await (supabase.from as any)('support_tickets')
        .insert({ user_id: user.id, reparto, subject: subject.trim(), message: message.trim() })
      if (error) throw error
      toast.success('Richiesta inviata! Ti rispondiamo via email il prima possibile.')
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
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{t.subject}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: t.status === 'CHIUSO' ? 'rgb(var(--sage-100))' : 'rgb(var(--gold-100))', color: 'rgb(var(--fg-muted))' }}>
                          {t.status === 'APERTO' ? 'In attesa' : t.status === 'IN_LAVORAZIONE' ? 'In lavorazione' : 'Chiuso'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[rgb(var(--fg-subtle))] flex items-center gap-1 mt-0.5">
                        <Clock size={10} /> {new Date(t.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
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
