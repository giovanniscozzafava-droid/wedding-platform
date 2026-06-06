import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, CalendarPlus, FileDown, Check, X, HelpCircle, ChevronLeft, MessageCircle } from 'lucide-react'
import { shareFileOrWhatsApp } from '@/lib/share'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { teamRoleSuggestions } from '@/lib/teamRoleSuggestions'
import { toast } from 'sonner'

// ============================================================================
// Team / sotto-fornitori. Il fornitore registra il proprio team, poi per ogni
// turno/evento segna presente/assente in modo veloce ed esporta un PDF da
// condividere (es. nel gruppo WhatsApp della band).
// ============================================================================

type Member = { id: string; full_name: string; role_label: string | null; phone: string | null; active: boolean }
type Event = { id: string; title: string; event_date: string | null; call_time: string | null; location: string | null; notes: string | null }
type Assignment = { id: string; event_id: string; member_id: string; presence: string; role_label: string | null }

const db = () => supabase as unknown as {
  from: (t: string) => any  // eslint-disable-line @typescript-eslint/no-explicit-any
}

const PRESENCE = [
  { v: 'PRESENTE', l: 'Presente', icon: Check, color: '#16a34a' },
  { v: 'FORSE', l: 'Forse', icon: HelpCircle, color: '#d97706' },
  { v: 'ASSENTE', l: 'Assente', icon: X, color: '#dc2626' },
]

export default function SupplierTeamPage() {
  const { profile } = useAuth()
  const uid = profile?.id
  const [tab, setTab] = useState<'team' | 'turni'>('team')
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [openEvent, setOpenEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadAll() {
    if (!uid) return
    const [m, e] = await Promise.all([
      db().from('supplier_team_members').select('id, full_name, role_label, phone, active').eq('supplier_id', uid).order('created_at'),
      db().from('supplier_team_events').select('id, title, event_date, call_time, location, notes').eq('supplier_id', uid).order('event_date', { ascending: false, nullsFirst: false }),
    ])
    setMembers((m.data as Member[]) ?? [])
    setEvents((e.data as Event[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void loadAll() }, [uid])

  if (loading) return <div className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</div>

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        {openEvent ? (
          <EventRoster event={openEvent} members={members.filter((m) => m.active)}
            supplierName={profile?.business_name || profile?.full_name || 'Team'}
            onBack={() => setOpenEvent(null)} />
        ) : (
          <>
            <PageHeader eyebrow="Organizzazione" title="Il mio team"
              description="Costruisci il tuo team e, per ogni turno, segna chi c'è. Poi esporti un PDF da condividere." />

            <div className="flex gap-2 mb-6">
              <TabBtn active={tab === 'team'} onClick={() => setTab('team')}><Users size={15} /> Team</TabBtn>
              <TabBtn active={tab === 'turni'} onClick={() => setTab('turni')}><CalendarPlus size={15} /> Turni</TabBtn>
            </div>

            {tab === 'team'
              ? <TeamTab uid={uid!} members={members} reload={loadAll} />
              : <TurniTab uid={uid!} events={events} reload={loadAll} onOpen={setOpenEvent} />}
          </>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
      style={active
        ? { background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))', borderColor: 'rgb(var(--gold-500))' }
        : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
      {children}
    </button>
  )
}

function TeamTab({ uid, members, reload }: { uid: string; members: Member[]; reload: () => Promise<void> }) {
  const { profile } = useAuth()
  const suggestions = teamRoleSuggestions({
    role: profile?.role, subrole: profile?.subrole,
    offersFullDining: (profile as { offers_full_dining?: boolean | null } | null)?.offers_full_dining,
  })
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!name.trim()) { toast.error('Inserisci il nome'); return }
    setSaving(true)
    const { error } = await db().from('supplier_team_members').insert({
      supplier_id: uid, full_name: name.trim(), role_label: role.trim() || null, phone: phone.trim() || null,
    })
    setSaving(false)
    if (error) { toast.error('Errore'); return }
    setName(''); setRole(''); setPhone(''); await reload()
  }
  async function toggleActive(m: Member) {
    await db().from('supplier_team_members').update({ active: !m.active }).eq('id', m.id); await reload()
  }
  async function del(m: Member) {
    await db().from('supplier_team_members').delete().eq('id', m.id); await reload()
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input placeholder="Nome e cognome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Ruolo / mansione" value={role} onChange={(e) => setRole(e.target.value)} />
          <Input placeholder="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Ruoli per la tua attività · tocca per inserire</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRole(s)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${role === s ? 'bg-[rgb(var(--gold))] text-black border-transparent' : 'border-[rgb(var(--border-strong))] hover:bg-[rgb(var(--bg-sunken))]'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <Button variant="gold" className="mt-3" onClick={add} disabled={saving}><Plus size={15} className="mr-1" /> Aggiungi al team</Button>
      </Card>

      {members.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun membro. Aggiungi il primo qui sopra.</Card>
      ) : (
        <Card className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3" style={{ opacity: m.active ? 1 : 0.5 }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{m.full_name}</p>
                <p className="text-xs text-[rgb(var(--fg-muted))]">{[m.role_label, m.phone].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              <button onClick={() => toggleActive(m)} className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'rgb(var(--border))' }}>
                {m.active ? 'Attivo' : 'Inattivo'}
              </button>
              <button onClick={() => del(m)} className="p-2 text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--danger))]"><Trash2 size={15} /></button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function TurniTab({ uid, events, reload, onOpen }: { uid: string; events: Event[]; reload: () => Promise<void>; onOpen: (e: Event) => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [callTime, setCallTime] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!title.trim()) { toast.error('Inserisci un titolo'); return }
    setSaving(true)
    const { error } = await db().from('supplier_team_events').insert({
      supplier_id: uid, title: title.trim(), event_date: date || null, call_time: callTime.trim() || null, location: location.trim() || null,
    })
    setSaving(false)
    if (error) { toast.error('Errore'); return }
    setTitle(''); setDate(''); setCallTime(''); setLocation(''); await reload()
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input placeholder="Titolo (es. Matrimonio Rossi)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Ritrovo (es. 16:30)" value={callTime} onChange={(e) => setCallTime(e.target.value)} />
          <Input placeholder="Luogo" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <Button variant="gold" className="mt-3" onClick={add} disabled={saving}><CalendarPlus size={15} className="mr-1" /> Crea turno</Button>
      </Card>

      {events.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun turno. Crea il primo per gestire le presenze.</Card>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <Card key={e.id} className="p-4 flex items-center gap-3 cursor-pointer hover:bg-[rgb(var(--bg-sunken))]" onClick={() => onOpen(e)}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.title}</p>
                <p className="text-xs text-[rgb(var(--fg-muted))]">
                  {[e.event_date && new Date(e.event_date).toLocaleDateString('it-IT'), e.call_time, e.location].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <span className="text-xs text-[rgb(var(--fg-muted))]">Gestisci presenze →</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function EventRoster({ event, members, supplierName, onBack }: { event: Event; members: Member[]; supplierName: string; onBack: () => void }) {
  const [assign, setAssign] = useState<Record<string, Assignment>>({})
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()

  useEffect(() => {
    void (async () => {
      const { data } = await db().from('supplier_team_assignments').select('id, event_id, member_id, presence, role_label').eq('event_id', event.id)
      const map: Record<string, Assignment> = {}
      for (const a of (data as Assignment[]) ?? []) map[a.member_id] = a
      setAssign(map); setLoading(false)
    })()
  }, [event.id])

  async function setPresence(member: Member, presence: string) {
    const existing = assign[member.id]
    setAssign((s) => ({ ...s, [member.id]: { ...(existing ?? { id: '', event_id: event.id, member_id: member.id, role_label: member.role_label }), presence } }))
    await db().from('supplier_team_assignments').upsert({
      event_id: event.id, member_id: member.id, supplier_id: profile?.id, presence, role_label: member.role_label,
    }, { onConflict: 'event_id,member_id' })
  }

  async function exportPdf(share = false) {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    let y = 18
    doc.setFontSize(16); doc.text(supplierName, 14, y); y += 7
    doc.setFontSize(13); doc.text(event.title, 14, y); y += 6
    doc.setFontSize(10); doc.setTextColor(110)
    const meta = [event.event_date && new Date(event.event_date).toLocaleDateString('it-IT'), event.call_time && `Ritrovo ${event.call_time}`, event.location].filter(Boolean).join('  ·  ')
    if (meta) { doc.text(meta, 14, y); y += 8 } else { y += 2 }
    doc.setTextColor(0); doc.setFontSize(11)
    doc.setFont(undefined as unknown as string, 'bold')
    doc.text('Membro', 14, y); doc.text('Ruolo', 90, y); doc.text('Presenza', 150, y); y += 2
    doc.setDrawColor(220); doc.line(14, y, 196, y); y += 5
    doc.setFont(undefined as unknown as string, 'normal')
    const label = (p: string) => p === 'PRESENTE' ? 'Presente' : p === 'ASSENTE' ? 'Assente' : p === 'FORSE' ? 'Forse' : '—'
    for (const m of members) {
      const p = assign[m.id]?.presence ?? '—'
      doc.text(m.full_name, 14, y)
      doc.text(m.role_label || '—', 90, y)
      doc.text(label(p), 150, y)
      y += 7
      if (y > 280) { doc.addPage(); y = 18 }
    }
    const fname = `team-${event.title.replace(/\s+/g, '-').toLowerCase()}.pdf`
    if (share) {
      const blob = doc.output('blob') as Blob
      const file = new File([blob], fname, { type: 'application/pdf' })
      await shareFileOrWhatsApp(file, `Foglio presenze · ${event.title}${event.event_date ? ' · ' + new Date(event.event_date).toLocaleDateString('it-IT') : ''}`)
    } else {
      doc.save(fname)
    }
  }

  if (loading) return <div className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</div>

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] mb-4">
        <ChevronLeft size={16} /> Tutti i turni
      </button>
      <div className="flex items-start gap-3 mb-5">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl">{event.title}</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {[event.event_date && new Date(event.event_date).toLocaleDateString('it-IT'), event.call_time && `Ritrovo ${event.call_time}`, event.location].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <Button variant="outline" onClick={() => void exportPdf(false)}><FileDown size={15} className="mr-1" /> Esporta PDF</Button>
        <Button variant="outline" onClick={() => void exportPdf(true)}><MessageCircle size={15} className="mr-1" /> WhatsApp</Button>
      </div>

      {members.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun membro attivo nel team. Aggiungili dalla scheda “Team”.</Card>
      ) : (
        <Card className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
          {members.map((m) => {
            const cur = assign[m.id]?.presence
            return (
              <div key={m.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.full_name}</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))]">{m.role_label || '—'}</p>
                </div>
                <div className="flex gap-1.5">
                  {PRESENCE.map((p) => {
                    const on = cur === p.v
                    return (
                      <button key={p.v} onClick={() => setPresence(m, p.v)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border"
                        style={on ? { background: p.color, borderColor: p.color, color: '#fff' } : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
                        <p.icon size={13} /> <span className="hidden sm:inline">{p.l}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
