import { useCallback, useEffect, useMemo, useState } from 'react'
import { Phone, MessageCircle, Mail, CalendarClock, UserPlus, Plus, Trash2, Copy, Check, PhoneCall, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Status = 'DA_CONTATTARE' | 'CONTATTATO' | 'RICHIAMARE' | 'APPUNTAMENTO' | 'ISCRITTO' | 'NON_INTERESSATO'
type Log = { id: string; kind: string; note: string | null; created_at: string }
type Prospect = {
  id: string; name: string; business_name: string | null; subrole: string | null
  phone: string | null; email: string | null; city: string | null
  status: Status; recall_at: string | null; appointment_at: string | null
  notes: string | null; last_contacted_at: string | null; created_at: string
  registered_profile_id: string | null; logs: Log[]
}
type Counts = { totale: number; da_contattare: number; richiami_oggi: number; iscritti: number }

const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args)

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  DA_CONTATTARE:   { label: 'Da contattare', color: '#A97F3F', bg: 'rgba(196,154,92,.14)' },
  CONTATTATO:      { label: 'Contattato',    color: '#5b6b7a', bg: 'rgba(91,107,122,.12)' },
  RICHIAMARE:      { label: 'Da richiamare',  color: '#B05A5A', bg: 'rgba(176,90,90,.14)' },
  APPUNTAMENTO:    { label: 'Appuntamento',   color: '#3F7A56', bg: 'rgba(63,122,86,.14)' },
  ISCRITTO:        { label: 'Iscritto ✓',     color: '#2f7d4f', bg: 'rgba(63,122,86,.2)' },
  NON_INTERESSATO: { label: 'Non interessato', color: '#8a8276', bg: 'rgba(120,116,104,.12)' },
}
const STATUS_ORDER: Status[] = ['DA_CONTATTARE', 'RICHIAMARE', 'APPUNTAMENTO', 'CONTATTATO', 'ISCRITTO', 'NON_INTERESSATO']

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null
const onlyDigits = (s: string | null) => (s ?? '').replace(/[^\d+]/g, '')

export default function NetworkOutreachPage() {
  const { user } = useAuth()
  const [list, setList] = useState<Prospect[]>([])
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'RICHIAMI' | Status>('ALL')
  const [refCode, setRefCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ name: '', subrole: '', phone: '', email: '', city: '' })
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const { data } = await rpc('network_prospects_list')
    const r = data as { prospects?: Prospect[]; counts?: Counts } | null
    setList(r?.prospects ?? [])
    setCounts(r?.counts ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await supabase.from('profiles').select('referral_code').eq('id', user.id).single()
      setRefCode((data as { referral_code?: string } | null)?.referral_code ?? null)
    })()
  }, [user])

  const inviteUrl = refCode ? `https://planfully.it/register?ref=${refCode}` : null

  async function addProspect() {
    if (!form.name.trim()) { toast.error('Inserisci almeno il nome'); return }
    setAdding(true)
    const { error } = await rpc('network_prospect_save', { p_id: null, p_data: form })
    setAdding(false)
    if (error) { toast.error('Errore nel salvataggio'); return }
    setForm({ name: '', subrole: '', phone: '', email: '', city: '' })
    toast.success('Contatto aggiunto')
    void load()
  }

  async function logAction(p: Prospect, kind: string, patch?: { status?: Status; recall_at?: string | null; appointment_at?: string | null; note?: string | null }) {
    const { error } = await rpc('network_prospect_log', {
      p_id: p.id, p_kind: kind, p_note: patch?.note ?? null,
      p_status: patch?.status ?? null, p_recall_at: patch?.recall_at ?? null, p_appointment_at: patch?.appointment_at ?? null,
    })
    if (error) { toast.error('Errore'); return }
    void load()
  }

  async function setStatus(p: Prospect, status: Status) {
    const { error } = await rpc('network_prospect_save', { p_id: p.id, p_data: { status } })
    if (error) { toast.error('Errore'); return }
    void load()
  }

  async function remove(p: Prospect) {
    if (!confirm(`Eliminare "${p.name}" dalla lista?`)) return
    await rpc('network_prospect_delete', { p_id: p.id })
    void load()
  }

  function scheduleRecall(p: Prospect) {
    const v = prompt('Quando richiamare? (es. 2026-06-12 15:00)')
    if (!v) return
    const d = new Date(v.replace(' ', 'T'))
    if (isNaN(d.getTime())) { toast.error('Data non valida'); return }
    void logAction(p, 'NOTA', { status: 'RICHIAMARE', recall_at: d.toISOString(), note: 'Richiamo programmato' })
  }
  function scheduleAppointment(p: Prospect) {
    const v = prompt('Appuntamento (es. 2026-06-15 10:30)')
    if (!v) return
    const d = new Date(v.replace(' ', 'T'))
    if (isNaN(d.getTime())) { toast.error('Data non valida'); return }
    void logAction(p, 'APPUNTAMENTO', { status: 'APPUNTAMENTO', appointment_at: d.toISOString(), note: 'Appuntamento fissato' })
  }
  function addNote(p: Prospect) {
    const v = prompt('Nota / esito:')
    if (v && v.trim()) void logAction(p, 'NOTA', { note: v.trim() })
  }

  function copyInvite() {
    if (!inviteUrl) return
    void navigator.clipboard.writeText(inviteUrl)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
    toast.success('Link di iscrizione copiato')
  }

  const filtered = useMemo(() => {
    if (filter === 'ALL') return list
    if (filter === 'RICHIAMI') return list.filter(p => p.recall_at && new Date(p.recall_at) <= new Date() && p.status !== 'ISCRITTO')
    return list.filter(p => p.status === filter)
  }, [list, filter])

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <PageHeader
        eyebrow="Rete"
        title="Recruiting"
        description="La tua agenda per chiamare, contattare e far iscrivere i professionisti nella tua rete."
      />

      {/* Contatori + link iscrizione */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
        {[
          { k: 'totale', label: 'Contatti', icon: PhoneCall },
          { k: 'da_contattare', label: 'Da contattare', icon: Phone },
          { k: 'richiami_oggi', label: 'Richiami oggi', icon: Clock },
          { k: 'iscritti', label: 'Iscritti', icon: Check },
        ].map(({ k, label, icon: Icon }) => (
          <div key={k} className="surface rounded-xl p-4 flex items-center gap-3">
            <Icon size={18} className="text-[rgb(var(--gold-600))]" />
            <div>
              <div className="text-2xl font-display leading-none">{counts ? (counts as unknown as Record<string, number>)[k] ?? 0 : '—'}</div>
              <div className="text-xs text-[rgb(var(--fg-muted))] mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {inviteUrl && (
        <div className="surface rounded-xl p-4 mt-3 flex flex-wrap items-center gap-3">
          <UserPlus size={18} className="text-[rgb(var(--gold-600))]" />
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-medium">Link di iscrizione con il tuo codice</div>
            <div className="text-xs text-[rgb(var(--fg-muted))] truncate">{inviteUrl}</div>
          </div>
          <Button variant="outline" size="sm" onClick={copyInvite}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiato' : 'Copia link'}
          </Button>
        </div>
      )}

      {/* Aggiungi contatto */}
      <div className="surface rounded-xl p-4 mt-3">
        <div className="text-sm font-medium mb-3 flex items-center gap-2"><Plus size={16} /> Aggiungi un professionista da contattare</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <Input className="md:col-span-3" placeholder="Nome *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Tipo (fotografo…)" value={form.subrole} onChange={e => setForm(f => ({ ...f, subrole: e.target.value }))} />
          <Input className="md:col-span-3" placeholder="Telefono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input className="md:col-span-1" placeholder="Città" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          <Button className="md:col-span-1" variant="gold" disabled={adding} onClick={() => void addProspect()}>{adding ? '…' : 'Aggiungi'}</Button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-2 mt-5">
        <FilterChip active={filter === 'ALL'} onClick={() => setFilter('ALL')}>Tutti</FilterChip>
        <FilterChip active={filter === 'RICHIAMI'} onClick={() => setFilter('RICHIAMI')} accent>Richiami oggi {counts?.richiami_oggi ? `(${counts.richiami_oggi})` : ''}</FilterChip>
        {STATUS_ORDER.map(s => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>{STATUS_META[s].label}</FilterChip>
        ))}
      </div>

      {/* Lista */}
      <div className="mt-4 flex flex-col gap-3">
        {loading && <div className="text-sm text-[rgb(var(--fg-muted))] py-8 text-center">Caricamento…</div>}
        {!loading && filtered.length === 0 && (
          <div className="surface rounded-xl p-8 text-center text-sm text-[rgb(var(--fg-muted))]">
            Nessun contatto qui. Aggiungi i professionisti che vuoi portare nella tua rete e inizia a chiamarli.
          </div>
        )}
        {filtered.map(p => {
          const meta = STATUS_META[p.status]
          const recallDue = p.recall_at && new Date(p.recall_at) <= new Date() && p.status !== 'ISCRITTO'
          const waText = encodeURIComponent(`Ciao ${p.name.split(' ')[0]}, ti scrivo da Planfully`)
          return (
            <div key={p.id} className="surface rounded-xl p-4" style={recallDue ? { borderColor: 'rgba(176,90,90,.5)' } : undefined}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.name}</span>
                    {p.subrole && <span className="text-xs text-[rgb(var(--fg-muted))]">· {p.subrole}</span>}
                    {p.city && <span className="text-xs text-[rgb(var(--fg-subtle))]">· {p.city}</span>}
                    <span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                  </div>
                  <div className="text-xs text-[rgb(var(--fg-muted))] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {p.phone && <span>{p.phone}</span>}
                    {p.email && <span>{p.email}</span>}
                    {p.last_contacted_at && <span>Ultimo contatto: {fmtDate(p.last_contacted_at)}</span>}
                  </div>
                  {recallDue && <div className="text-xs font-semibold text-[rgb(var(--rose-500))] mt-1">⏰ Richiamo previsto: {fmtDate(p.recall_at)}</div>}
                  {p.status === 'APPUNTAMENTO' && p.appointment_at && <div className="text-xs font-semibold mt-1" style={{ color: '#3F7A56' }}>📅 Appuntamento: {fmtDate(p.appointment_at)}</div>}
                  {p.notes && <div className="text-xs text-[rgb(var(--fg-muted))] mt-1 italic">“{p.notes}”</div>}
                  {p.logs?.[0] && (
                    <div className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">
                      {p.logs[0].kind.toLowerCase()} · {fmtDate(p.logs[0].created_at)}{p.logs[0].note ? ` — ${p.logs[0].note}` : ''}
                    </div>
                  )}
                </div>
                <Select value={p.status} onChange={e => void setStatus(p, e.target.value as Status)} className="w-auto text-xs">
                  {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {p.phone && (
                  <a href={`tel:${onlyDigits(p.phone)}`} onClick={() => void logAction(p, 'CHIAMATA', { status: p.status === 'DA_CONTATTARE' ? 'CONTATTATO' : undefined })}>
                    <Button variant="gold" size="sm"><Phone size={14} /> Chiama</Button>
                  </a>
                )}
                {p.phone && (
                  <a href={`https://wa.me/${onlyDigits(p.phone).replace('+', '')}?text=${waText}`} target="_blank" rel="noreferrer" onClick={() => void logAction(p, 'WHATSAPP')}>
                    <Button variant="outline" size="sm"><MessageCircle size={14} /> WhatsApp</Button>
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} onClick={() => void logAction(p, 'EMAIL')}>
                    <Button variant="outline" size="sm"><Mail size={14} /> Email</Button>
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => scheduleRecall(p)}><Clock size={14} /> Richiamo</Button>
                <Button variant="outline" size="sm" onClick={() => scheduleAppointment(p)}><CalendarClock size={14} /> Appuntamento</Button>
                <Button variant="outline" size="sm" onClick={() => addNote(p)}>Nota</Button>
                {inviteUrl && (
                  <Button variant="outline" size="sm" onClick={copyInvite}><UserPlus size={14} /> Link iscrizione</Button>
                )}
                {p.status !== 'ISCRITTO' && (
                  <Button variant="outline" size="sm" onClick={() => void setStatus(p, 'ISCRITTO')}><Check size={14} /> Segna iscritto</Button>
                )}
                <Button variant="ghost" size="sm" className="ml-auto text-[rgb(var(--rose-500))]" onClick={() => void remove(p)}><Trash2 size={14} /></Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterChip({ active, accent, children, onClick }: { active: boolean; accent?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full border transition-colors"
      style={active
        ? { background: accent ? 'rgba(176,90,90,.14)' : 'rgb(var(--fg))', color: accent ? '#B05A5A' : 'rgb(var(--bg))', borderColor: accent ? 'rgba(176,90,90,.5)' : 'rgb(var(--fg))' }
        : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
      {children}
    </button>
  )
}
