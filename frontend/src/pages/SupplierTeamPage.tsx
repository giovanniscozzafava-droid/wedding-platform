import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, CalendarPlus, FileDown, Check, X, HelpCircle, ChevronLeft, MessageCircle, Clock, Package, Sparkles, Download } from 'lucide-react'
import { shareFileOrWhatsApp } from '@/lib/share'
import { waTeamSheet } from '@/lib/waMessages'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { teamRoleSuggestions } from '@/lib/teamRoleSuggestions'
import { runsheetTemplate } from '@/lib/runsheetTemplates'
import { inventoryStarterPack } from '@/lib/inventoryTemplates'
import { buildEventPdf, fetchLogoDataUrl, type RunItem as PdfRunItem, type PackItem as PdfPackItem } from '@/lib/runsheetPdf'
import { toast } from 'sonner'

// ============================================================================
// Team / sotto-fornitori. Il fornitore registra il proprio team, poi per ogni
// turno/evento segna presente/assente in modo veloce ed esporta un PDF da
// condividere (es. nel gruppo WhatsApp della band).
// ============================================================================

type Member = { id: string; full_name: string; role_label: string | null; phone: string | null; active: boolean }
type Event = { id: string; title: string; event_date: string | null; call_time: string | null; location: string | null; notes: string | null; quote_id: string | null }
type Assignment = { id: string; event_id: string; member_id: string; presence: string; role_label: string | null }
type SharedEvent = { collab_id: string; status: string; can_edit: boolean; owner_name: string; event: Event }
type RunItem = { id: string; event_id: string; start_time: string | null; title: string; role_label: string | null; note: string | null; ord: number }
type PackItem = { id: string; event_id: string; name: string; category: string | null; qty: number; checked: boolean; ord: number }

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
  const [tab, setTab] = useState<'team' | 'turni' | 'magazzino'>('team')
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [shared, setShared] = useState<SharedEvent[]>([])
  const [openEvent, setOpenEvent] = useState<Event | null>(null)
  const [openShared, setOpenShared] = useState<SharedEvent | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadShared() {
    const { data } = await (supabase.rpc as unknown as (f: string) => Promise<{ data: unknown }>)('list_shared_events')
    setShared((data as SharedEvent[]) ?? [])
  }
  async function loadAll() {
    if (!uid) return
    const [m, e] = await Promise.all([
      db().from('supplier_team_members').select('id, full_name, role_label, phone, active').eq('supplier_id', uid).order('created_at'),
      db().from('supplier_team_events').select('id, title, event_date, call_time, location, notes, quote_id').eq('supplier_id', uid).order('event_date', { ascending: false, nullsFirst: false }),
      loadShared(),
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
        {openShared ? (
          <EventRoster event={openShared.event} members={[]} readOnly
            supplierName={openShared.owner_name}
            onBack={() => setOpenShared(null)} />
        ) : openEvent ? (
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
              <TabBtn active={tab === 'magazzino'} onClick={() => setTab('magazzino')}><Package size={15} /> Magazzino</TabBtn>
            </div>

            {tab === 'team' && <TeamTab uid={uid!} members={members} reload={loadAll} />}
            {tab === 'turni' && <TurniTab uid={uid!} events={events} reload={loadAll} onOpen={setOpenEvent} shared={shared} onOpenShared={setOpenShared} reloadShared={loadShared} />}
            {tab === 'magazzino' && <MagazzinoTab uid={uid!} />}
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

function TurniTab({ uid, events, reload, onOpen, shared, onOpenShared, reloadShared }: { uid: string; events: Event[]; reload: () => Promise<void>; onOpen: (e: Event) => void; shared: SharedEvent[]; onOpenShared: (s: SharedEvent) => void; reloadShared: () => Promise<void> }) {
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

  async function respond(collabId: string, accept: boolean) {
    await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<unknown>)('respond_event_invite', { p_collab_id: collabId, p_accept: accept })
    await reloadShared(); toast.success(accept ? 'Invito accettato' : 'Invito rifiutato')
  }

  return (
    <div className="space-y-4">
      {shared.length > 0 && (
        <Card className="p-4">
          <h2 className="font-medium mb-2 flex items-center gap-2"><Users size={16} className="text-[rgb(var(--gold-600))]" /> Condivisi con me</h2>
          <div className="space-y-2">
            {shared.map((s) => (
              <div key={s.collab_id} className="flex items-center gap-3 p-2 rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.event.title}</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))]">
                    da {s.owner_name}{s.event.event_date ? ` · ${new Date(s.event.event_date).toLocaleDateString('it-IT')}` : ''}
                  </p>
                </div>
                {s.status === 'INVITATO' ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="gold" onClick={() => void respond(s.collab_id, true)}>Accetta</Button>
                    <Button size="sm" variant="outline" onClick={() => void respond(s.collab_id, false)}>Rifiuta</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => onOpenShared(s)}>Apri programma →</Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
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

type Collab = { id: string; collaborator_id: string; status: string; can_edit: boolean; name: string }
type FollowedColleague = { id: string; name: string; subrole: string | null; role: string; city: string | null }

function EventRoster({ event, members, supplierName, onBack, readOnly = false }: { event: Event; members: Member[]; supplierName: string; onBack: () => void; readOnly?: boolean }) {
  const [assign, setAssign] = useState<Record<string, Assignment>>({})
  const [collabAssign, setCollabAssign] = useState<Record<string, string>>({})
  const [runItems, setRunItems] = useState<RunItem[]>([])
  const [packing, setPacking] = useState<PackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [collabs, setCollabs] = useState<Collab[]>([])
  const [followed, setFollowed] = useState<FollowedColleague[]>([])
  const [query, setQuery] = useState('')
  const [inviting, setInviting] = useState(false)
  const { profile } = useAuth()
  const sid = profile?.id

  async function loadCollabs() {
    if (readOnly) return
    const { data } = await db().from('supplier_event_collaborators')
      .select('id, collaborator_id, status, can_edit, collaborator:profiles!supplier_event_collaborators_collaborator_id_fkey(business_name, full_name)')
      .eq('event_id', event.id)
    setCollabs(((data as Array<{ id: string; collaborator_id: string; status: string; can_edit: boolean; collaborator: { business_name: string | null; full_name: string | null } | null }>) ?? [])
      .map((c) => ({ id: c.id, collaborator_id: c.collaborator_id, status: c.status, can_edit: c.can_edit, name: c.collaborator?.business_name || c.collaborator?.full_name || 'Collega' })))
  }
  async function loadFollowed() {
    if (readOnly) return
    const { data } = await (supabase.rpc as unknown as (f: string) => Promise<{ data: unknown }>)('followed_colleagues')
    setFollowed((data as FollowedColleague[]) ?? [])
  }
  function inviteErr(code?: string) {
    return code === 'user_not_found' ? 'Nessun fornitore Planfully con questa email'
      : code === 'not_owner' ? 'Non sei il proprietario'
      : code === 'cannot_invite_self' ? 'Non puoi invitare te stesso' : 'Invito non riuscito'
  }
  async function inviteById(collabId: string) {
    setInviting(true)
    try {
      const { data } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }>)('invite_event_collaborator_by_id', { p_event_id: event.id, p_collab_id: collabId })
      const r = data as { ok?: boolean; error?: string }
      if (r?.error) { toast.error(inviteErr(r.error)); return }
      setQuery(''); await loadCollabs(); toast.success('Invito inviato')
    } catch (e) { toast.error((e as Error).message) }
    finally { setInviting(false) }
  }
  async function inviteByEmail(email: string) {
    if (!email.trim()) return
    setInviting(true)
    try {
      const { data } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }>)('invite_event_collaborator', { p_event_id: event.id, p_email: email.trim() })
      const r = data as { ok?: boolean; error?: string }
      if (r?.error) { toast.error(inviteErr(r.error)); return }
      setQuery(''); await loadCollabs(); toast.success('Invito inviato via email')
    } catch (e) { toast.error((e as Error).message) }
    finally { setInviting(false) }
  }
  async function removeCollab(id: string) { await db().from('supplier_event_collaborators').delete().eq('id', id); await loadCollabs() }

  async function loadRun() {
    const { data } = await db().from('supplier_team_event_items').select('id, event_id, start_time, title, role_label, note, ord').eq('event_id', event.id).order('ord').order('start_time')
    setRunItems((data as RunItem[]) ?? [])
  }
  async function loadPack() {
    const { data } = await db().from('supplier_team_event_packing').select('id, event_id, name, category, qty, checked, ord').eq('event_id', event.id).order('ord')
    setPacking((data as PackItem[]) ?? [])
  }

  useEffect(() => {
    void (async () => {
      const [a] = await Promise.all([
        db().from('supplier_team_assignments').select('id, event_id, member_id, collaborator_id, presence, role_label').eq('event_id', event.id),
        loadRun(), loadPack(), loadCollabs(), loadFollowed(),
      ])
      const map: Record<string, Assignment> = {}
      const cmap: Record<string, string> = {}
      for (const x of (a.data as Array<Assignment & { collaborator_id?: string | null }>) ?? []) {
        if (x.member_id) map[x.member_id] = x
        else if (x.collaborator_id) cmap[x.collaborator_id] = x.presence
      }
      setAssign(map); setCollabAssign(cmap); setLoading(false)
    })()
  }, [event.id])

  async function setPresence(member: Member, presence: string) {
    const existing = assign[member.id]
    setAssign((s) => ({ ...s, [member.id]: { ...(existing ?? { id: '', event_id: event.id, member_id: member.id, role_label: member.role_label }), presence } }))
    await db().from('supplier_team_assignments').upsert({
      event_id: event.id, member_id: member.id, supplier_id: sid, presence, role_label: member.role_label,
    }, { onConflict: 'event_id,member_id' })
  }
  async function setCollabPresence(collabId: string, presence: string) {
    setCollabAssign((s) => ({ ...s, [collabId]: presence }))
    await db().from('supplier_team_assignments').upsert({
      event_id: event.id, collaborator_id: collabId, supplier_id: sid, presence, role_label: 'Collega esterno',
    }, { onConflict: 'event_id,collaborator_id' })
  }

  // ---- Run-sheet ----
  async function addRun() {
    await db().from('supplier_team_event_items').insert({ event_id: event.id, supplier_id: sid, title: 'Nuovo momento', start_time: '', ord: runItems.length })
    await loadRun()
  }
  async function patchRun(id: string, patch: Partial<RunItem>) {
    setRunItems((s) => s.map((r) => r.id === id ? { ...r, ...patch } : r))
    await db().from('supplier_team_event_items').update(patch).eq('id', id)
  }
  async function delRun(id: string) { await db().from('supplier_team_event_items').delete().eq('id', id); await loadRun() }
  async function loadRunTemplate() {
    const seeds = runsheetTemplate({ role: profile?.role, subrole: profile?.subrole, offersFullDining: (profile as { offers_full_dining?: boolean } | null)?.offers_full_dining })
    if (!seeds.length) return
    await db().from('supplier_team_event_items').insert(seeds.map((s, i) => ({ event_id: event.id, supplier_id: sid, start_time: s.start_time, title: s.title, role_label: s.role_label ?? null, ord: runItems.length + i })))
    await loadRun(); toast.success('Modello caricato')
  }
  async function importProgram() {
    const { data } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }>)('supplier_event_program', { p_event_id: event.id })
    const r = data as { ok?: boolean; error?: string; items?: Array<{ start_time?: string; title: string; note?: string }> }
    if (r?.error || !r?.items) { toast.error(r?.error === 'no_quote_linked' ? 'Questo turno non è collegato a un preventivo' : r?.error === 'no_event' ? 'Nessun programma evento trovato' : 'Import non riuscito'); return }
    if (!r.items.length) { toast.info('Il programma evento è vuoto'); return }
    await db().from('supplier_team_event_items').insert(r.items.map((s, i) => ({ event_id: event.id, supplier_id: sid, start_time: s.start_time ?? '', title: s.title, note: s.note ?? null, ord: runItems.length + i })))
    await loadRun(); toast.success(`Importati ${r.items.length} momenti dal programma`)
  }

  // ---- Checklist attrezzatura ----
  async function addPack() {
    await db().from('supplier_team_event_packing').insert({ event_id: event.id, supplier_id: sid, name: 'Nuova voce', qty: 1, ord: packing.length })
    await loadPack()
  }
  async function patchPack(id: string, patch: Partial<PackItem>) {
    setPacking((s) => s.map((p) => p.id === id ? { ...p, ...patch } : p))
    await db().from('supplier_team_event_packing').update(patch).eq('id', id)
  }
  async function delPack(id: string) { await db().from('supplier_team_event_packing').delete().eq('id', id); await loadPack() }
  async function loadStarterPack() {
    const seeds = inventoryStarterPack({ role: profile?.role, subrole: profile?.subrole, offersFullDining: (profile as { offers_full_dining?: boolean } | null)?.offers_full_dining })
    if (!seeds.length) return
    await db().from('supplier_team_event_packing').insert(seeds.map((s, i) => ({ event_id: event.id, supplier_id: sid, name: s.name, category: s.category ?? null, qty: s.qty_default ?? 1, ord: packing.length + i })))
    await loadPack(); toast.success('Starter pack caricato')
  }
  async function importMagazzino() {
    const { data } = await db().from('supplier_inventory_items').select('name, category, qty_default, ord').eq('supplier_id', sid).eq('active', true).order('ord')
    const inv = (data as Array<{ name: string; category: string | null; qty_default: number; ord: number }>) ?? []
    if (!inv.length) { toast.info('Magazzino vuoto. Caricalo dalla scheda Magazzino o usa lo starter pack.'); return }
    await db().from('supplier_team_event_packing').insert(inv.map((s, i) => ({ event_id: event.id, supplier_id: sid, name: s.name, category: s.category, qty: s.qty_default ?? 1, ord: packing.length + i })))
    await loadPack(); toast.success(`Importate ${inv.length} voci dal magazzino`)
  }

  // ---- Export PDF ----
  async function doExport(mode: 'vetrina' | 'operativo', share = false) {
    setExporting(mode + (share ? '-wa' : ''))
    try {
      const logoDataUrl = await fetchLogoDataUrl(profile?.brand_logo_url)
      const pdf = await buildEventPdf({
        mode,
        brand: { businessName: supplierName, primary: profile?.brand_primary_color, secondary: profile?.brand_secondary_color, logoDataUrl },
        event,
        runItems: runItems.map((r): PdfRunItem => ({ start_time: r.start_time, title: r.title, role_label: r.role_label, note: r.note })),
        members: members.map((m) => ({ full_name: m.full_name, role_label: m.role_label, phone: m.phone, presence: assign[m.id]?.presence })),
        packing: packing.map((p): PdfPackItem => ({ name: p.name, category: p.category, qty: p.qty, checked: p.checked })),
      })
      const fname = `${mode}-${event.title.replace(/\s+/g, '-').toLowerCase()}.pdf`
      if (share) {
        const file = new File([pdf.output('blob') as Blob], fname, { type: 'application/pdf' })
        await shareFileOrWhatsApp(file, waTeamSheet({ eventTitle: event.title, eventDate: event.event_date }))
      } else { pdf.save(fname) }
    } catch (e) { toast.error((e as Error).message) }
    finally { setExporting(null) }
  }

  if (loading) return <div className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</div>

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] mb-4">
        <ChevronLeft size={16} /> Tutti i turni
      </button>
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl">{event.title}</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {[event.event_date && new Date(event.event_date).toLocaleDateString('it-IT'), event.call_time && `Ritrovo ${event.call_time}`, event.location].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <Button variant="gold" disabled={!!exporting} onClick={() => void doExport('vetrina')}><Sparkles size={15} className="mr-1" /> PDF cliente</Button>
        <Button variant="outline" disabled={!!exporting} onClick={() => void doExport('operativo')}><FileDown size={15} className="mr-1" /> PDF team</Button>
        <Button variant="outline" disabled={!!exporting} onClick={() => void doExport('operativo', true)}><MessageCircle size={15} className="mr-1" /> WhatsApp</Button>
      </div>

      {readOnly && (
        <Card className="p-3 mb-4 text-xs text-[rgb(var(--fg-muted))]">
          Programma condiviso da <strong>{supplierName}</strong> — sola lettura. Puoi consultarlo ed esportarlo.
        </Card>
      )}

      {/* RUN-SHEET */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-[rgb(var(--gold-600))]" />
          <h2 className="font-medium flex-1">Programma operativo</h2>
          {!readOnly && event.quote_id && <Button size="sm" variant="ghost" onClick={() => void importProgram()}><Download size={13} className="mr-1" /> Dal programma evento</Button>}
          {!readOnly && <Button size="sm" variant="ghost" onClick={() => void loadRunTemplate()}><Sparkles size={13} className="mr-1" /> Modello</Button>}
        </div>
        {runItems.length === 0 ? (
          <p className="text-xs text-[rgb(var(--fg-subtle))] italic">{readOnly ? 'Nessun momento ancora inserito.' : 'Nessun momento. Carica un modello o aggiungi le righe della giornata.'}</p>
        ) : readOnly ? (
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {runItems.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-16 font-medium text-[rgb(var(--gold-700))]">{r.start_time || '—'}</span>
                <span className="flex-1">{r.title}</span>
                {r.role_label && <span className="text-xs text-[rgb(var(--fg-muted))]">{r.role_label}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {runItems.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Input className="w-20 text-sm" placeholder="18:30" value={r.start_time ?? ''} onChange={(e) => patchRun(r.id, { start_time: e.target.value })} />
                <Input className="flex-1 text-sm" placeholder="Momento (es. Ingresso sposi)" value={r.title} onChange={(e) => patchRun(r.id, { title: e.target.value })} />
                <Input className="w-32 text-sm hidden sm:block" placeholder="Chi" value={r.role_label ?? ''} onChange={(e) => patchRun(r.id, { role_label: e.target.value })} />
                <button onClick={() => void delRun(r.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
        {!readOnly && <Button size="sm" variant="outline" className="mt-3" onClick={() => void addRun()}><Plus size={14} className="mr-1" /> Aggiungi momento</Button>}
      </Card>

      {/* CHECKLIST ATTREZZATURA */}
      {!readOnly && (
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Package size={16} className="text-[rgb(var(--gold-600))]" />
          <h2 className="font-medium flex-1">Checklist attrezzatura</h2>
          <Button size="sm" variant="ghost" onClick={() => void importMagazzino()}><Download size={13} className="mr-1" /> Dal magazzino</Button>
          <Button size="sm" variant="ghost" onClick={() => void loadStarterPack()}><Sparkles size={13} className="mr-1" /> Starter pack</Button>
        </div>
        {packing.length === 0 ? (
          <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Niente da portare ancora. Carica lo starter pack o aggiungi le tue voci.</p>
        ) : (
          <div className="space-y-1.5">
            {packing.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <button onClick={() => void patchPack(p.id, { checked: !p.checked })}
                  className="w-5 h-5 rounded border flex items-center justify-center shrink-0"
                  style={p.checked ? { background: '#16a34a', borderColor: '#16a34a', color: '#fff' } : { borderColor: 'rgb(var(--border-strong))' }}>
                  {p.checked && <Check size={13} />}
                </button>
                <Input className="w-14 text-sm" type="number" min={1} value={p.qty} onChange={(e) => patchPack(p.id, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                <Input className="flex-1 text-sm" placeholder="Attrezzatura" value={p.name} onChange={(e) => patchPack(p.id, { name: e.target.value })} />
                <Input className="w-28 text-sm hidden sm:block" placeholder="Categoria" value={p.category ?? ''} onChange={(e) => patchPack(p.id, { category: e.target.value })} />
                <button onClick={() => void delPack(p.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void addPack()}><Plus size={14} className="mr-1" /> Aggiungi voce</Button>
      </Card>
      )}

      {/* COLLEGHI SULL'EVENTO */}
      {!readOnly && (
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-[rgb(var(--gold-600))]" />
          <h2 className="font-medium flex-1">Colleghi sull'evento</h2>
        </div>
        <p className="text-xs text-[rgb(var(--fg-subtle))] mb-3">
          Cerca tra i colleghi che segui e invitalo a condividere questo programma (sola lettura). Se non lo trovi perché non ancora iscritto, invitalo via email.
        </p>
        <Input className="text-sm" placeholder="Cerca un collega che segui, o scrivi un'email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {(() => {
          const q = query.trim().toLowerCase()
          const invitedIds = new Set(collabs.map((c) => c.collaborator_id))
          const matches = q.length === 0 ? [] : followed.filter((f) =>
            !invitedIds.has(f.id) && (f.name.toLowerCase().includes(q) || (f.subrole ?? '').toLowerCase().includes(q) || (f.city ?? '').toLowerCase().includes(q)))
          const isEmail = /\S+@\S+\.\S+/.test(query.trim())
          return (
            <div className="mt-2 space-y-1">
              {matches.slice(0, 6).map((f) => (
                <button key={f.id} type="button" disabled={inviting} onClick={() => void inviteById(f.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg border text-left hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-50" style={{ borderColor: 'rgb(var(--border))' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-[rgb(var(--fg-muted))]">{[f.subrole, f.city].filter(Boolean).join(' · ') || (f.role === 'LOCATION' ? 'Location' : f.role === 'WEDDING_PLANNER' ? 'Wedding planner' : 'Fornitore')}</p>
                  </div>
                  <span className="text-xs text-[rgb(var(--gold-600))] shrink-0"><Plus size={13} className="inline" /> Invita</span>
                </button>
              ))}
              {q.length > 0 && matches.length === 0 && (
                isEmail ? (
                  <button type="button" disabled={inviting} onClick={() => void inviteByEmail(query)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border text-left hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-50" style={{ borderColor: 'rgb(var(--border))' }}>
                    <span className="text-sm flex-1 truncate">Invita <strong>{query.trim()}</strong> via email</span>
                    <span className="text-xs text-[rgb(var(--gold-600))] shrink-0"><Plus size={13} className="inline" /> Invita</span>
                  </button>
                ) : (
                  <p className="text-xs text-[rgb(var(--fg-subtle))] italic px-1">Nessun collega seguito corrisponde. Se non è iscritto, scrivi la sua email per invitarlo.</p>
                )
              )}
            </div>
          )
        })()}
        {collabs.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {collabs.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={c.status === 'ATTIVO' ? { color: '#16a34a', background: '#16a34a1a' } : c.status === 'RIFIUTATO' ? { color: '#dc2626', background: '#dc26261a' } : { color: '#d97706', background: '#d977061a' }}>
                  {c.status === 'ATTIVO' ? 'Attivo' : c.status === 'RIFIUTATO' ? 'Rifiutato' : 'In attesa'}
                </span>
                <button onClick={() => void removeCollab(c.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      {/* PRESENZE */}
      {!readOnly && (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-[rgb(var(--gold-600))]" />
          <h2 className="font-medium">Presenze squadra</h2>
        </div>
        {members.length === 0 && collabs.filter((c) => c.status === 'ATTIVO').length === 0 ? (
          <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessun membro attivo. Aggiungili dalla scheda “Team” o invita un collega qui sopra.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {members.map((m) => {
              const cur = assign[m.id]?.presence
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
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
            {/* Collaboratori esterni ATTIVI: nel team SOLO per questo evento */}
            {collabs.filter((c) => c.status === 'ATTIVO').map((c) => {
              const cur = collabAssign[c.collaborator_id]
              return (
                <div key={`col-${c.id}`} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name} <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-1" style={{ color: 'rgb(var(--gold-700))', background: 'rgb(var(--gold-100))' }}>collega</span></p>
                    <p className="text-xs text-[rgb(var(--fg-muted))]">Collaboratore sull'evento</p>
                  </div>
                  <div className="flex gap-1.5">
                    {PRESENCE.map((p) => {
                      const on = cur === p.v
                      return (
                        <button key={p.v} onClick={() => void setCollabPresence(c.collaborator_id, p.v)}
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
          </div>
        )}
      </Card>
      )}
    </div>
  )
}

type InvItem = { id: string; name: string; category: string | null; qty_default: number; active: boolean; ord: number }

function MagazzinoTab({ uid }: { uid: string }) {
  const { profile } = useAuth()
  const [items, setItems] = useState<InvItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await db().from('supplier_inventory_items').select('id, name, category, qty_default, active, ord').eq('supplier_id', uid).order('ord')
    setItems((data as InvItem[]) ?? []); setLoading(false)
  }
  useEffect(() => { void load() }, [uid])

  async function add() {
    await db().from('supplier_inventory_items').insert({ supplier_id: uid, name: 'Nuova attrezzatura', qty_default: 1, ord: items.length })
    await load()
  }
  async function patch(id: string, p: Partial<InvItem>) {
    setItems((s) => s.map((i) => i.id === id ? { ...i, ...p } : i))
    await db().from('supplier_inventory_items').update(p).eq('id', id)
  }
  async function del(id: string) { await db().from('supplier_inventory_items').delete().eq('id', id); await load() }
  async function loadStarter() {
    const seeds = inventoryStarterPack({ role: profile?.role, subrole: profile?.subrole, offersFullDining: (profile as { offers_full_dining?: boolean } | null)?.offers_full_dining })
    if (!seeds.length) return
    await db().from('supplier_inventory_items').insert(seeds.map((s, i) => ({ supplier_id: uid, name: s.name, category: s.category ?? null, qty_default: s.qty_default ?? 1, ord: items.length + i })))
    await load(); toast.success('Starter pack caricato nel magazzino')
  }

  if (loading) return <div className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</div>

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          Il tuo magazzino: l'attrezzatura che possiedi. Da qui la importi nella checklist di ogni turno, senza riscriverla ogni volta.
        </p>
        {items.length === 0 && (
          <Button variant="gold" className="mt-3" onClick={() => void loadStarter()}><Sparkles size={14} className="mr-1" /> Parti dallo starter pack</Button>
        )}
      </Card>

      {items.length > 0 && (
        <Card className="p-4">
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2" style={{ opacity: it.active ? 1 : 0.5 }}>
                <Input className="w-14 text-sm" type="number" min={1} value={it.qty_default} onChange={(e) => patch(it.id, { qty_default: Math.max(1, Number(e.target.value) || 1) })} />
                <Input className="flex-1 text-sm" placeholder="Attrezzatura" value={it.name} onChange={(e) => patch(it.id, { name: e.target.value })} />
                <Input className="w-28 text-sm hidden sm:block" placeholder="Categoria" value={it.category ?? ''} onChange={(e) => patch(it.id, { category: e.target.value })} />
                <button onClick={() => void del(it.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => void add()}><Plus size={14} className="mr-1" /> Aggiungi</Button>
            <Button size="sm" variant="ghost" onClick={() => void loadStarter()}><Sparkles size={13} className="mr-1" /> Aggiungi starter pack</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
