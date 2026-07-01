import { useEffect, useState } from 'react'
import { CalendarClock, Plus, Trash2, Mail, MessageCircle, Copy, Send, Users, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

// Prove menu a SESSIONI/turni (lato location). Il gestore crea sessioni (di norma 4 date,
// primaverile/autunnale), inserisce i clienti in lista, genera gli inviti (email + WhatsApp) con
// RSVP. Chi conferma sblocca la scelta del menu sulla propria dashboard.
const sb = (t: string): any => (supabase as any).from(t)
type Dateo = { id: string; scheduled_at: string; sala: string | null; sort_order: number }
type Invite = { id: string; client_name: string; email: string | null; phone: string | null; token: string; rsvp: string; chosen_date_id: string | null; entry_id: string | null; invited_at: string | null }
type Session = { id: string; name: string; season: string | null; notes: string | null; dates: Dateo[]; invites: Invite[] }
type Ev = { id: string; title: string }

const RSVP_BADGE: Record<string, { t: string; c: string }> = {
  YES: { t: 'Confermato', c: 'bg-emerald-100 text-emerald-700' },
  NO: { t: 'Rifiutato', c: 'bg-stone-200 text-stone-600' },
  PENDING: { t: 'In attesa', c: 'bg-amber-100 text-amber-700' },
}
const whenIt = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })

export default function TastingSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<Ev[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState<string | null>(null)

  async function load() {
    const { data: u } = await supabase.auth.getUser()
    const id = u.user?.id ?? null; setUid(id)
    if (!id) { setLoading(false); return }
    const { data } = await sb('fb_tasting_sessions')
      .select('*, dates:fb_tasting_session_dates(*), invites:fb_tasting_invites(*)')
      .eq('location_id', id).order('created_at', { ascending: false })
    const list = (data ?? []).map((s: any) => ({ ...s, dates: (s.dates ?? []).sort((a: Dateo, b: Dateo) => a.sort_order - b.sort_order || a.scheduled_at.localeCompare(b.scheduled_at)) }))
    setSessions(list as Session[])
    const { data: ev } = await sb('calendar_entries').select('id, title').eq('owner_id', id).order('date_from', { ascending: false }).limit(200)
    setEvents((ev ?? []) as Ev[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function newSession() {
    if (!uid) return
    const { error } = await sb('fb_tasting_sessions').insert({ location_id: uid, name: 'Prove menu', season: 'PRIMAVERILE' })
    if (error) return toast.error('Non riuscito')
    await load()
  }
  async function patchSession(id: string, patch: Partial<Session>) {
    await sb('fb_tasting_sessions').update(patch).eq('id', id); setSessions((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }
  async function delSession(id: string) {
    if (!confirm('Eliminare la sessione e i suoi inviti?')) return
    await sb('fb_tasting_sessions').delete().eq('id', id); await load()
  }
  async function addDate(sid: string) {
    const base = new Date(); base.setDate(base.getDate() + 14); base.setHours(20, 0, 0, 0)
    const n = sessions.find((s) => s.id === sid)?.dates.length ?? 0
    if (n >= 8) return toast.error('Massimo raggiunto')
    await sb('fb_tasting_session_dates').insert({ session_id: sid, scheduled_at: base.toISOString(), sort_order: n }); await load()
  }
  async function patchDate(id: string, patch: Partial<Dateo>) {
    await sb('fb_tasting_session_dates').update(patch).eq('id', id)
    setSessions((s) => s.map((x) => ({ ...x, dates: x.dates.map((d) => (d.id === id ? { ...d, ...patch } : d)) })))
  }
  async function removeDate(id: string) { await sb('fb_tasting_session_dates').delete().eq('id', id); await load() }
  async function addInvite(sid: string) {
    await sb('fb_tasting_invites').insert({ session_id: sid, client_name: 'Nuovo cliente' }); await load()
  }
  async function patchInvite(id: string, patch: Partial<Invite>) {
    await sb('fb_tasting_invites').update(patch).eq('id', id)
    setSessions((s) => s.map((x) => ({ ...x, invites: x.invites.map((i) => (i.id === id ? { ...i, ...patch } : i)) })))
  }
  async function removeInvite(id: string) { await sb('fb_tasting_invites').delete().eq('id', id); await load() }

  async function sendEmails(sid: string) {
    const pend = sessions.find((s) => s.id === sid)?.invites.filter((i) => i.email && i.rsvp === 'PENDING') ?? []
    if (!pend.length) return toast.error('Nessun invito email in attesa (aggiungi email ai clienti)')
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; sent: number }>('tasting-session-invite', { body: { sessionId: sid } })
    if (error || !data?.ok) return toast.error('Invio email non riuscito')
    toast.success(`${data.sent} invito/i email inviati`); await load()
  }
  async function sendOneEmail(inv: Invite) {
    if (!inv.email) return toast.error('Manca l’email del cliente')
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; sent: number }>('tasting-session-invite', { body: { inviteId: inv.id } })
    if (error || !data?.ok) return toast.error('Invio non riuscito')
    toast.success('Invito email inviato'); await load()
  }
  function rsvpUrl(token: string) { return `${window.location.origin}/prova-menu-invito/${token}` }
  function waLink(inv: Invite, session: Session) {
    const digits = (inv.phone ?? '').replace(/[^\d]/g, '')
    const dates = session.dates.map((d) => `• ${whenIt(d.scheduled_at)}${d.sala ? ` (${d.sala})` : ''}`).join('\n')
    const msg = `Ciao ${inv.client_name}! Siete invitati alla prova menu "${session.name}".\nDate:\n${dates}\n\nConfermate qui la presenza: ${rsvpUrl(inv.token)}`
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
  }
  function copyLink(token: string) { navigator.clipboard?.writeText(rsvpUrl(token)); toast.success('Link RSVP copiato') }

  if (loading) return <div className="p-8 text-[rgb(var(--fg-muted))]">Carico le sessioni…</div>

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl flex items-center gap-2"><CalendarClock size={22} /> Prove menu · sessioni</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-0.5">Organizza le sedute di degustazione a turni (di solito 4 date, primaverile/autunnale). Inserisci i clienti, invia gli inviti (email + WhatsApp) con RSVP. Chi conferma sblocca la scelta del menu.</p>
        </div>
        <Button variant="gold" onClick={newSession}><Plus size={15} /> Nuova sessione</Button>
      </div>

      {sessions.length === 0 && <Card className="p-8 text-center text-[rgb(var(--fg-muted))]">Nessuna sessione. Crea la prima con "Nuova sessione".</Card>}

      {sessions.map((s) => {
        const open = openId === s.id
        const confirmed = s.invites.filter((i) => i.rsvp === 'YES').length
        return (
          <Card key={s.id} className="p-0 overflow-hidden">
            <button onClick={() => setOpenId(open ? null : s.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[rgb(var(--bg-sunken))]">
              <div className="flex items-center gap-3 min-w-0">
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{s.name} {s.season && <span className="text-xs font-normal text-[rgb(var(--fg-muted))]">· {s.season.toLowerCase()}</span>}</h3>
                  <p className="text-xs text-[rgb(var(--fg-muted))]">{s.dates.length} date · {s.invites.length} invitati · <span className="text-emerald-600">{confirmed} confermati</span></p>
                </div>
              </div>
            </button>

            {open && (
              <div className="p-4 pt-0 space-y-5 border-t border-[rgb(var(--border))]">
                {/* Dati sessione */}
                <div className="grid sm:grid-cols-3 gap-3 pt-4">
                  <div><Label>Nome sessione</Label><Input value={s.name} onChange={(e) => patchSession(s.id, { name: e.target.value })} /></div>
                  <div>
                    <Label>Stagione</Label>
                    <select value={s.season ?? ''} onChange={(e) => patchSession(s.id, { season: e.target.value || null })} className="w-full h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
                      <option value="PRIMAVERILE">Primaverile</option>
                      <option value="AUTUNNALE">Autunnale</option>
                      <option value="">—</option>
                    </select>
                  </div>
                  <div><Label>Note</Label><Input value={s.notes ?? ''} onChange={(e) => patchSession(s.id, { notes: e.target.value })} placeholder="Es. porta chi cucina" /></div>
                </div>

                {/* Date */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium flex items-center gap-2"><CalendarClock size={15} /> Date (di solito 4)</h4>
                    <Button variant="outline" size="sm" onClick={() => addDate(s.id)}><Plus size={13} /> Aggiungi data</Button>
                  </div>
                  {s.dates.length === 0 ? <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessuna data.</p> : (
                    <div className="space-y-2">
                      {s.dates.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 flex-wrap">
                          <input type="datetime-local" value={toLocalInput(d.scheduled_at)} onChange={(e) => patchDate(d.id, { scheduled_at: new Date(e.target.value).toISOString() })}
                            className="h-9 px-2 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm" />
                          <Input value={d.sala ?? ''} onChange={(e) => patchDate(d.id, { sala: e.target.value })} placeholder="Sala" className="h-9 w-40" />
                          <Button variant="ghost" size="icon" onClick={() => removeDate(d.id)} aria-label="Rimuovi"><Trash2 size={14} /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lista clienti / inviti */}
                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <h4 className="font-medium flex items-center gap-2"><Users size={15} /> Clienti invitati</h4>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => addInvite(s.id)}><Plus size={13} /> Aggiungi cliente</Button>
                      <Button variant="gold" size="sm" onClick={() => sendEmails(s.id)}><Send size={13} /> Invia email ai nuovi</Button>
                    </div>
                  </div>
                  {s.invites.length === 0 ? <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessun cliente in lista.</p> : (
                    <div className="space-y-2">
                      {s.invites.map((i) => {
                        const badge = RSVP_BADGE[i.rsvp] ?? RSVP_BADGE.PENDING
                        const chosen = s.dates.find((d) => d.id === i.chosen_date_id)
                        return (
                          <div key={i.id} className="rounded-xl border border-[rgb(var(--border))] p-3">
                            <div className="grid sm:grid-cols-4 gap-2">
                              <Input value={i.client_name} onChange={(e) => patchInvite(i.id, { client_name: e.target.value })} placeholder="Nome cliente" />
                              <Input value={i.email ?? ''} onChange={(e) => patchInvite(i.id, { email: e.target.value })} placeholder="email" type="email" />
                              <Input value={i.phone ?? ''} onChange={(e) => patchInvite(i.id, { phone: e.target.value })} placeholder="telefono (WhatsApp)" />
                              <select value={i.entry_id ?? ''} onChange={(e) => patchInvite(i.id, { entry_id: e.target.value || null })} className="h-10 px-2 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm">
                                <option value="">— collega evento (sblocco menu)</option>
                                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge!.c}`}>{i.rsvp === 'YES' && <Check size={10} className="inline mr-0.5" />}{badge!.t}</span>
                              {chosen && <span className="text-[11px] text-[rgb(var(--fg-muted))]">{whenIt(chosen.scheduled_at)}</span>}
                              <span className="flex-1" />
                              <Button variant="ghost" size="sm" onClick={() => sendOneEmail(i)} disabled={!i.email}><Mail size={13} /> Email</Button>
                              <a href={i.phone ? waLink(i, s) : undefined} target="_blank" rel="noreferrer"
                                className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md ${i.phone ? 'text-emerald-700 hover:bg-emerald-50' : 'text-[rgb(var(--fg-subtle))] pointer-events-none opacity-50'}`}>
                                <MessageCircle size={13} /> WhatsApp
                              </a>
                              <Button variant="ghost" size="sm" onClick={() => copyLink(i.token)}><Copy size={13} /> Link</Button>
                              <Button variant="ghost" size="icon" onClick={() => removeInvite(i.id)} aria-label="Rimuovi"><Trash2 size={14} /></Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-[rgb(var(--border))]">
                  <Button variant="ghost" size="sm" onClick={() => delSession(s.id)} className="text-[rgb(var(--rose-600))]"><Trash2 size={14} /> Elimina sessione</Button>
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ISO → valore per <input type="datetime-local"> (ora locale, senza secondi/timezone)
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
