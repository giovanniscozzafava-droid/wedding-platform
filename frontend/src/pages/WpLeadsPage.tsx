import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Inbox, Mail, Phone, Calendar, MapPin, Users, Euro, MessageSquare, Check, X, Eye, FileText, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { eventTerm } from '@/lib/eventKind'

type Lead = {
  id: string
  client_name: string
  client_email: string
  client_phone: string | null
  event_kind: string
  event_date: string | null
  event_location: string | null
  guests_estimate: number | null
  budget_range: string | null
  message: string | null
  source: string | null
  status: 'NEW' | 'VIEWED' | 'CONTACTED' | 'QUOTED' | 'CLOSED_WON' | 'CLOSED_LOST' | 'SPAM'
  viewed_at: string | null
  contacted_at: string | null
  quoted_at: string | null
  closed_at: string | null
  close_amount: number | null
  close_notes: string | null
  is_billable: boolean
  billed_at: string | null
  billed_amount: number | null
  created_at: string
}

type Stats = {
  total: number
  new: number
  contacted: number
  won: number
  lost: number
  conversion_rate: number
  total_revenue: number
  billed: number
  pending_billing: number
}

const STATUS_LABELS: Record<Lead['status'], { label: string; tone: 'gold' | 'sage' | 'rose' | 'sky' | 'amber' | 'neutral' | 'emerald' | 'ink' }> = {
  NEW:          { label: 'Nuovo',           tone: 'gold' },
  VIEWED:       { label: 'Visto',           tone: 'sky' },
  CONTACTED:    { label: 'Contattato',      tone: 'amber' },
  QUOTED:       { label: 'Preventivo inviato', tone: 'amber' },
  CLOSED_WON:   { label: 'Vinto',           tone: 'emerald' },
  CLOSED_LOST:  { label: 'Perso',           tone: 'rose' },
  SPAM:         { label: 'Spam',            tone: 'neutral' },
}

export default function WpLeadsPage() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [filter, setFilter] = useState<Lead['status'] | 'ALL'>('ALL')

  async function load() {
    if (!user) return
    setLoading(true)
    const { data: leadsData } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown }> } } } })
      .from('lead_requests')
      .select('*')
      .eq('wp_id', user.id)
      .order('created_at', { ascending: false })
    setLeads((leadsData as Lead[]) ?? [])

    const { data: s } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: unknown }> })
      .rpc('wp_lead_stats')
    setStats(s as Stats)
    setLoading(false)
  }

  useEffect(() => { void load() }, [user])

  async function transition(leadId: string, newStatus: Lead['status'], extra?: { close_amount?: number | null; close_notes?: string | null }) {
    try {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('lead_transition', {
          p_lead_id: leadId,
          p_new_status: newStatus,
          p_close_amount: extra?.close_amount ?? null,
          p_close_notes: extra?.close_notes ?? null,
        })
      if (error) throw error
      const r = data as { ok?: boolean; error?: string }
      if (r.error) throw new Error(r.error)
      toast.success('Aggiornato')
      await load()
      setSelected(null)
    } catch (e) { toast.error((e as Error).message) }
  }

  async function openDetail(lead: Lead) {
    setSelected(lead)
    if (lead.status === 'NEW') {
      // Auto-transition NEW → VIEWED
      void transition(lead.id, 'VIEWED')
    }
  }

  const filtered = filter === 'ALL' ? leads : leads.filter((l) => l.status === filter)

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Lead"
          title="I tuoi clienti potenziali"
          description="Richieste di preventivo arrivate dal portale pubblico. Paghi solo €3,50 (primo anno) o €7 per ogni lead che concludi con successo."
        />

        {/* KPI */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <Kpi label="Nuovi" value={stats.new} tone="gold" />
            <Kpi label="In trattativa" value={stats.contacted} tone="amber" />
            <Kpi label="Vinti" value={stats.won} tone="emerald" />
            <Kpi label="Tasso chiusura" value={`${stats.conversion_rate}%`} tone="sky" />
            <Kpi label="Fatturato totale" value={`€ ${Math.round(stats.total_revenue).toLocaleString('it-IT')}`} tone="ink" />
          </div>
        )}

        {/* Filtri */}
        <div className="flex gap-1 mb-5 overflow-x-auto">
          <FilterChip active={filter === 'ALL'} onClick={() => setFilter('ALL')}>Tutti ({leads.length})</FilterChip>
          {(['NEW','CONTACTED','QUOTED','CLOSED_WON','CLOSED_LOST'] as Lead['status'][]).map((s) => {
            const n = leads.filter((l) => l.status === s).length
            return (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {STATUS_LABELS[s].label} ({n})
              </FilterChip>
            )
          })}
        </div>

        {/* Lista */}
        {loading && <p className="text-sm text-[rgb(var(--fg-muted))]">Caricamento…</p>}

        {!loading && filtered.length === 0 && (
          <div className="surface p-12 text-center">
            <Inbox className="mx-auto mb-3 opacity-30" size={36} />
            <p className="font-display text-xl mb-2">
              {filter === 'ALL' ? 'Ancora nessun lead' : `Nessun lead "${STATUS_LABELS[filter as Lead['status']].label.toLowerCase()}"`}
            </p>
            <p className="text-sm text-[rgb(var(--fg-muted))] max-w-md mx-auto">
              Quando i clienti finali compileranno il modulo "Richiedi preventivo" sul tuo profilo pubblico, le richieste arriveranno qui.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((l) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="surface p-4 flex items-center gap-4 hover:surface-elev transition-all cursor-pointer"
              onClick={() => openDetail(l)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge tone={STATUS_LABELS[l.status].tone}>{STATUS_LABELS[l.status].label}</Badge>
                  {l.event_date && (
                    <span className="text-[10px] text-[rgb(var(--fg-subtle))] inline-flex items-center gap-0.5">
                      <Calendar size={10} /> {new Date(l.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  {l.event_kind && <span className="text-[10px] text-[rgb(var(--gold-600))] uppercase tracking-wider">{eventTerm(l.event_kind).label}</span>}
                </div>
                <h3 className="font-medium truncate">{l.client_name}</h3>
                <p className="text-xs text-[rgb(var(--fg-muted))] truncate flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="inline-flex items-center gap-0.5"><Mail size={11} /> {l.client_email}</span>
                  {l.client_phone && <span className="inline-flex items-center gap-0.5"><Phone size={11} /> {l.client_phone}</span>}
                  {l.event_location && <span className="inline-flex items-center gap-0.5"><MapPin size={11} /> {l.event_location}</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-[rgb(var(--fg-subtle))]">{timeAgo(l.created_at)}</p>
                {l.is_billable && (
                  <p className="text-xs text-[rgb(var(--emerald-500))] font-medium mt-1">
                    +€ {Number(l.billed_amount).toFixed(2)}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Detail modal */}
        {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} onTransition={transition} />}
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone: 'gold' | 'sage' | 'rose' | 'sky' | 'amber' | 'neutral' | 'emerald' | 'ink' }) {
  const tones = {
    gold:    'rgb(var(--gold-100)) rgb(var(--gold-700))',
    sage:    'rgb(var(--sage-100)) rgb(var(--sage-700))',
    rose:    'rgb(var(--rose-100)) rgb(var(--rose-500))',
    sky:     'rgb(var(--sky-100)) rgb(var(--sky-500))',
    amber:   'rgb(var(--amber-100)) rgb(var(--amber-500))',
    emerald: 'rgb(var(--emerald-100)) rgb(var(--emerald-500))',
    neutral: 'rgb(var(--bg-sunken)) rgb(var(--fg-muted))',
    ink:     'rgb(var(--fg)) rgb(var(--bg-elev))',
  } as const
  const [bg, fg] = tones[tone].split(' ')
  return (
    <div className="surface p-4" style={{ background: bg, color: fg }}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="font-display text-2xl tabular-nums mt-1">{value}</p>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
      style={{
        background: active ? 'rgb(var(--fg))' : 'rgb(var(--bg-sunken))',
        color: active ? 'rgb(var(--bg-elev))' : 'rgb(var(--fg-muted))',
      }}>
      {children}
    </button>
  )
}

function LeadDetailModal({ lead, onClose, onTransition }: { lead: Lead; onClose: () => void; onTransition: (id: string, status: Lead['status'], extra?: { close_amount?: number | null; close_notes?: string | null }) => Promise<void> }) {
  const navigate = useNavigate()
  const [closeAmount, setCloseAmount] = useState(lead.close_amount?.toString() ?? '')
  const [closeNotes, setCloseNotes] = useState(lead.close_notes ?? '')
  const [showWonForm, setShowWonForm] = useState(false)
  const [converting, setConverting] = useState(false)

  async function convertToEvent() {
    setConverting(true)
    try {
      const { data, error } = await (supabase.rpc as any)('create_event_from_lead', { p_lead_id: lead.id })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      toast.success(data?.reused ? 'Evento gia` esistente: apro il preventivo' : 'Evento e preventivo creati dal lead')
      navigate(`/quotes/${data.quote_id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore conversione lead')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="surface surface-lift w-full max-w-2xl p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Badge tone={STATUS_LABELS[lead.status].tone}>{STATUS_LABELS[lead.status].label}</Badge>
            <h2 className="font-display text-2xl mt-2">{lead.client_name}</h2>
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">Richiesta del {new Date(lead.created_at).toLocaleString('it-IT')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <Field icon={Mail} label="Email" value={<a href={`mailto:${lead.client_email}`} className="text-[rgb(var(--gold-600))] hover:underline">{lead.client_email}</a>} />
          {lead.client_phone && <Field icon={Phone} label="Telefono" value={<a href={`tel:${lead.client_phone}`} className="text-[rgb(var(--gold-600))] hover:underline">{lead.client_phone}</a>} />}
          <Field icon={Calendar} label="Tipo evento" value={eventTerm(lead.event_kind).Label} />
          {lead.event_date && <Field icon={Calendar} label="Data evento" value={new Date(lead.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} />}
          {lead.event_location && <Field icon={MapPin} label="Location" value={lead.event_location} />}
          {lead.guests_estimate && <Field icon={Users} label="Invitati" value={lead.guests_estimate.toString()} />}
          {lead.budget_range && <Field icon={Euro} label="Budget" value={lead.budget_range} />}
        </div>

        {lead.message && (
          <div className="surface p-4 mb-5">
            <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1 flex items-center gap-1"><MessageSquare size={11} /> Messaggio</p>
            <p className="text-sm whitespace-pre-wrap">{lead.message}</p>
          </div>
        )}

        {/* Conversione lead -> evento + preventivo (continuità dei dati) */}
        {lead.status !== 'CLOSED_WON' && lead.status !== 'CLOSED_LOST' && lead.status !== 'SPAM' && (
          <div className="pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <Button variant="gold" className="w-full" onClick={convertToEvent} disabled={converting}>
              <Sparkles size={14} /> {converting ? 'Creo evento…' : 'Crea evento + preventivo da questo lead'}
            </Button>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1.5 text-center">
              I dati del lead (contatto, data, tipo evento, invitati) vengono pre-compilati e ti seguono per tutto il matrimonio.
            </p>
          </div>
        )}

        {/* Transition buttons */}
        <div className="pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
          <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-3">Workflow</p>

          {lead.status !== 'CLOSED_WON' && lead.status !== 'CLOSED_LOST' && (
            <div className="flex flex-wrap gap-2 mb-3">
              {lead.status !== 'CONTACTED' && (
                <Button variant="outline" size="sm" onClick={() => onTransition(lead.id, 'CONTACTED')}>
                  <Phone size={13} /> Contattato
                </Button>
              )}
              {lead.status !== 'QUOTED' && (
                <Button variant="outline" size="sm" onClick={() => onTransition(lead.id, 'QUOTED')}>
                  <FileText size={13} /> Preventivo inviato
                </Button>
              )}
              <Button variant="gold" size="sm" onClick={() => setShowWonForm(true)}>
                <Check size={13} /> Chiuso · Vinto
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onTransition(lead.id, 'CLOSED_LOST')}>
                <X size={13} /> Chiuso · Perso
              </Button>
              <Button variant="ghost" size="sm" className="text-[rgb(var(--rose-500))]" onClick={() => onTransition(lead.id, 'SPAM')}>
                <AlertCircle size={13} /> Spam
              </Button>
            </div>
          )}

          {(lead.status === 'CLOSED_WON' || lead.status === 'CLOSED_LOST') && (
            <div className="surface surface-elev p-4 text-sm">
              <p className="font-medium mb-1">
                {lead.status === 'CLOSED_WON' ? '🎉 Hai chiuso questo lead' : '❌ Lead perso'}
              </p>
              {lead.close_amount && <p className="text-xs text-[rgb(var(--fg-muted))]">Valore contratto: € {Number(lead.close_amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>}
              {lead.close_notes && <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">{lead.close_notes}</p>}
              {lead.is_billable && (
                <p className="text-xs text-[rgb(var(--emerald-500))] mt-2">
                  Success fee: € {Number(lead.billed_amount).toFixed(2)}
                  {lead.billed_at ? ' · Fatturato' : ' · Da fatturare'}
                </p>
              )}
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => onTransition(lead.id, 'CONTACTED')}>
                Riapri trattativa
              </Button>
            </div>
          )}

          {showWonForm && (
            <div className="surface surface-elev p-4 mt-3">
              <p className="text-sm font-medium mb-2">Chiudi come vinto</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-[rgb(var(--fg-muted))]">Valore contratto (€)</label>
                  <Input type="number" value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)} placeholder="12000" />
                </div>
                <div>
                  <label className="text-xs text-[rgb(var(--fg-muted))]">Note (opzionale)</label>
                  <Textarea rows={2} value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Note interne sul cliente..." />
                </div>
                <p className="text-[10px] text-[rgb(var(--fg-subtle))] italic">
                  Confermando si addebita la success fee di €3,50 (primo anno, poi €7).
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowWonForm(false)}>Annulla</Button>
                  <Button variant="gold" size="sm" onClick={() => {
                    onTransition(lead.id, 'CLOSED_WON', {
                      close_amount: closeAmount ? Number(closeAmount) : null,
                      close_notes: closeNotes.trim() || null,
                    })
                    setShowWonForm(false)
                  }}>
                    <Check size={13} /> Conferma chiusura
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="pt-4 mt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
          <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Storia</p>
          <ul className="text-xs text-[rgb(var(--fg-muted))] space-y-1">
            <li><Eye size={10} className="inline mr-1" /> Ricevuto il {new Date(lead.created_at).toLocaleString('it-IT')}</li>
            {lead.viewed_at && <li><Eye size={10} className="inline mr-1" /> Visto il {new Date(lead.viewed_at).toLocaleString('it-IT')}</li>}
            {lead.contacted_at && <li><Phone size={10} className="inline mr-1" /> Contattato il {new Date(lead.contacted_at).toLocaleString('it-IT')}</li>}
            {lead.quoted_at && <li><FileText size={10} className="inline mr-1" /> Preventivo inviato il {new Date(lead.quoted_at).toLocaleString('it-IT')}</li>}
            {lead.closed_at && <li><Check size={10} className="inline mr-1" /> Chiuso il {new Date(lead.closed_at).toLocaleString('it-IT')}</li>}
          </ul>
        </div>
      </motion.div>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] flex items-center gap-1 mb-0.5">
        <Icon size={10} /> {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

function timeAgo(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.max(0, Math.round((now - t) / 1000))
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff/60)}m`
  if (diff < 86400) return `${Math.floor(diff/3600)}h`
  if (diff < 604800) return `${Math.floor(diff/86400)}g`
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
