import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { LayoutDashboard, Users, Zap, LifeBuoy, Loader2, Search, Power, Bug, AlertTriangle, ChevronDown, ChevronUp, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Tab = 'overview' | 'errors' | 'bugs' | 'subs' | 'team' | 'funnel'
type Subs = { by_plan: Record<string, number>; fornitori_total: number; paying: number; mrr: number; pricing: { presence: number; region: number; national: number }; belly: { cap_per_category: number | null; cap_total: number | null } }
type FornRow = { id: string; full_name: string | null; business_name: string | null; subrole: string | null; email: string; subscription_plan: string; subscription_status: string; service_regions: string[] | null }
const PLAN_LABEL: Record<string, string> = { NONE: 'Nessuno', PRESENCE: 'Presenza · 29€', REGION: 'Regione · 59€', NATIONAL: 'Italia · 79€' }
const PLANS = ['NONE', 'PRESENCE', 'REGION', 'NATIONAL']
// Etichette ruolo leggibili: COUPLE/CLIENT non sono solo "coppie di sposi" →
// sono clienti finali di qualsiasi tipo di evento.
const ROLE_LABEL: Record<string, string> = {
  COUPLE: 'Cliente', CLIENT: 'Cliente', FORNITORE: 'Fornitore',
  WEDDING_PLANNER: 'Wedding Planner', LOCATION: 'Location', ADMIN: 'Admin',
}
const roleLabel = (r: string) => ROLE_LABEL[r] ?? r
type Overview = {
  users_total: number; users_by_role: Record<string, number>; staff_count: number
  quotes_total: number; quotes_by_status: Record<string, number>
  events_total: number; events_confirmed: number
  tickets_open: number; tickets_total: number
  funnel_active: boolean; funnel_active_quotes: number
  errors_new: number; errors_total: number; error_occurrences: number
  bugs_new: number; bugs_total: number
}
type UserRow = { id: string; full_name: string | null; business_name: string | null; role: string; email: string; is_support_staff: boolean }
type ErrRow = { id: string; fingerprint: string; message: string; stack: string | null; source: string; severity: string; status: string; count: number; url: string | null; last_seen: string; first_seen: string; last_user_agent: string | null }
type BugRow = { id: string; message: string; url: string | null; severity: string; status: string; admin_notes: string | null; created_at: string; reporter: string | null }

const rpc = (fn: string, args: Record<string, unknown> = {}) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc(fn, args)

const ERR_STATUS = ['NEW', 'INVESTIGATING', 'RESOLVED', 'IGNORED']
const ERR_STATUS_LABEL: Record<string, string> = { NEW: 'Nuovo', INVESTIGATING: 'In analisi', RESOLVED: 'Risolto', IGNORED: 'Ignorato' }
const BUG_STATUS = ['NUOVO', 'IN_LAVORAZIONE', 'RISOLTO', 'SCARTATO']
const BUG_STATUS_LABEL: Record<string, string> = { NUOVO: 'Nuovo', IN_LAVORAZIONE: 'In lavorazione', RISOLTO: 'Risolto', SCARTATO: 'Scartato' }

export default function AdminPage() {
  const { profile } = useAuth()
  const isStaff = profile?.is_support_staff || profile?.role === 'ADMIN'
  const [tab, setTab] = useState<Tab>('overview')
  const [ov, setOv] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<ErrRow[]>([])
  const [errFilter, setErrFilter] = useState('NEW')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [bugs, setBugs] = useState<BugRow[]>([])
  const [bugFilter, setBugFilter] = useState('NUOVO')
  const [subs, setSubs] = useState<Subs | null>(null)
  const [forn, setForn] = useState<FornRow[]>([])
  const [fornSearch, setFornSearch] = useState('')
  const [capInput, setCapInput] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function loadOverview() {
    setLoading(true)
    const { data, error } = await rpc('admin_overview')
    if (error) toast.error(error.message); else setOv(data as Overview)
    setLoading(false)
  }
  async function loadUsers() {
    const { data, error } = await rpc('admin_list_users', { p_search: search })
    if (error) toast.error(error.message); else setUsers((data ?? []) as UserRow[])
  }
  async function loadErrors() {
    const { data, error } = await rpc('admin_errors_list', { p_status: errFilter })
    if (error) toast.error(error.message); else setErrors((data ?? []) as ErrRow[])
  }
  async function loadBugs() {
    const { data, error } = await rpc('admin_bug_reports', { p_status: bugFilter })
    if (error) toast.error(error.message); else setBugs((data ?? []) as BugRow[])
  }
  async function loadSubs() {
    const { data, error } = await rpc('admin_subscriptions')
    if (error) { toast.error(error.message); return }
    const s = data as Subs; setSubs(s); setCapInput(String(s.belly?.cap_per_category ?? ''))
    void loadForn()
  }
  async function loadForn() {
    const { data, error } = await rpc('admin_list_fornitori', { p_search: fornSearch, p_plan: null })
    if (error) toast.error(error.message); else setForn((data ?? []) as FornRow[])
  }
  async function setPlan(f: FornRow, plan: string) {
    setBusy(f.id)
    const { error } = await rpc('admin_set_subscription_plan', { p_user_id: f.id, p_plan: plan })
    setBusy(null)
    if (error) { toast.error(error.message); return }
    toast.success('Piano aggiornato')
    setForn((prev) => prev.map((x) => x.id === f.id ? { ...x, subscription_plan: plan } : x))
    void loadSubs()
  }
  async function saveCap() {
    const n = capInput.trim() === '' ? null : Math.max(1, Math.min(50, parseInt(capInput, 10) || 0))
    const { error } = await rpc('admin_set_setting', { p_key: 'belly', p_value: { cap_per_category: n, cap_total: null } })
    if (error) { toast.error(error.message); return }
    toast.success('Limite pancia salvato')
    void loadSubs()
  }
  useEffect(() => { void loadOverview() }, [])
  useEffect(() => { if (tab === 'team') void loadUsers(); if (tab === 'errors') void loadErrors(); if (tab === 'bugs') void loadBugs(); if (tab === 'subs') void loadSubs() /* eslint-disable-next-line */ }, [tab])
  useEffect(() => { if (tab === 'errors') void loadErrors() /* eslint-disable-next-line */ }, [errFilter])
  useEffect(() => { if (tab === 'bugs') void loadBugs() /* eslint-disable-next-line */ }, [bugFilter])

  async function toggleStaff(u: UserRow) {
    setBusy(u.id)
    const { error } = await rpc('admin_set_support_staff', { p_user_id: u.id, p_value: !u.is_support_staff })
    setBusy(null)
    if (error) { toast.error(error.message); return }
    toast.success(!u.is_support_staff ? `${u.full_name ?? 'Utente'} è ora staff` : 'Rimosso dallo staff')
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_support_staff: !x.is_support_staff } : x))
  }
  async function setErrStatus(e: ErrRow, status: string) {
    await rpc('admin_set_error_status', { p_id: e.id, p_status: status })
    toast.success('Stato aggiornato')
    void loadErrors(); void loadOverview()
  }
  async function setBugStatus(b: BugRow, status: string) {
    await rpc('admin_set_bug_status', { p_id: b.id, p_status: status })
    toast.success('Stato aggiornato')
    void loadBugs(); void loadOverview()
  }
  async function toggleFunnel() {
    if (!ov) return
    const next = !ov.funnel_active
    if (next && !confirm('Accendere il funnel? Invierà email automatiche ai clienti con preventivi attivi.')) return
    setBusy('funnel')
    const { error } = await rpc('admin_set_funnel', { p_on: next })
    setBusy(null)
    if (error) { toast.error(error.message); return }
    toast.success(next ? 'Funnel acceso' : 'Funnel in pausa')
    setOv({ ...ov, funnel_active: next })
  }

  if (profile && !isStaff) return <Navigate to="/" replace />

  const TABS = [
    ['overview', 'Panoramica', LayoutDashboard, 0],
    ['errors', 'Errori', AlertTriangle, ov?.errors_new ?? 0],
    ['bugs', 'Segnalazioni', Bug, ov?.bugs_new ?? 0],
    ['subs', 'Abbonamenti', CreditCard, 0],
    ['team', 'Team & staff', Users, 0],
    ['funnel', 'Funnel', Zap, 0],
  ] as const

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Staff" title="Pannello Admin"
          description="Numeri della piattaforma, errori in tempo reale, segnalazioni dei clienti, team e funnel — tutto da qui." />

        <div className="flex gap-1 mb-6 overflow-x-auto">
          {TABS.map(([v, l, Icon, badge]) => (
            <button key={v} onClick={() => setTab(v as Tab)}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5 transition-colors"
              style={{ background: tab === v ? 'rgb(var(--fg))' : 'rgb(var(--bg-sunken))', color: tab === v ? 'rgb(var(--bg-elev))' : 'rgb(var(--fg-muted))' }}>
              <Icon size={13} /> {l}
              {badge > 0 && <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px]" style={{ background: 'rgb(var(--rose-500))', color: 'white' }}>{badge}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]"><Loader2 className="animate-spin inline" size={16} /> Carico…</Card>
        ) : tab === 'overview' && ov ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Utenti" value={ov.users_total} sub={`${ov.staff_count} staff`} />
              <Stat label="Preventivi" value={ov.quotes_total} />
              <Stat label="Eventi" value={ov.events_total} sub={`${ov.events_confirmed} confermati`} />
              <Stat label="Ticket aperti" value={ov.tickets_open} sub={`${ov.tickets_total} totali`} />
              <Stat label="Errori nuovi" value={ov.errors_new} sub={`${ov.error_occurrences} occorrenze`} alert={ov.errors_new > 0} onClick={() => setTab('errors')} />
              <Stat label="Segnalazioni" value={ov.bugs_new} sub={`${ov.bugs_total} totali`} alert={ov.bugs_new > 0} onClick={() => setTab('bugs')} />
              <Stat label="Funnel" value={ov.funnel_active_quotes} sub={ov.funnel_active ? 'acceso' : 'in pausa'} />
            </div>
            <Card className="p-5">
              <h3 className="font-display text-lg mb-3">Utenti per ruolo</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ov.users_by_role).map(([r, n]) => (
                  <span key={r} className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgb(var(--bg-sunken))' }}>{roleLabel(r)}: <strong>{n}</strong></span>
                ))}
              </div>
            </Card>
            <Link to="/admin/assistenza"><Button variant="outline" size="sm"><LifeBuoy size={14} /> Vai ai ticket ({ov.tickets_open} aperti)</Button></Link>
          </div>

        ) : tab === 'errors' ? (
          <div className="space-y-3">
            <Filters options={ERR_STATUS} labels={ERR_STATUS_LABEL} value={errFilter} onChange={setErrFilter} />
            {errors.length === 0 ? (
              <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]"><AlertTriangle className="mx-auto mb-2 opacity-40" size={24} />Nessun errore {ERR_STATUS_LABEL[errFilter]?.toLowerCase()}. Ottimo segno. 🎉</Card>
            ) : errors.map((e) => (
              <Card key={e.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: e.severity === 'WARNING' ? 'rgb(var(--gold-100))' : 'rgb(var(--rose-100))', color: 'rgb(var(--fg-muted))' }}>{e.source}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>×{e.count}</span>
                      <span className="text-[11px] text-[rgb(var(--fg-subtle))]">ultimo: {new Date(e.last_seen).toLocaleString('it-IT')}</span>
                    </div>
                    <p className="font-mono text-sm mt-1 break-words">{e.message}</p>
                    {e.url && <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-0.5">su {e.url}</p>}
                  </div>
                </div>
                {e.stack && (
                  <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="text-[11px] text-[rgb(var(--fg-muted))] hover:underline inline-flex items-center gap-1 mt-2">
                    {expanded === e.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />} stack trace
                  </button>
                )}
                {expanded === e.id && e.stack && (
                  <pre className="text-[10px] mt-2 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap" style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>{e.stack}</pre>
                )}
                <div className="flex gap-1 mt-3 flex-wrap">
                  {ERR_STATUS.map((s) => (
                    <button key={s} onClick={() => void setErrStatus(e, s)}
                      className="text-[10px] px-2 py-1 rounded-full border transition-colors"
                      style={{ borderColor: 'rgb(var(--border-strong))', background: e.status === s ? 'rgb(var(--gold-500))' : 'transparent', color: e.status === s ? 'white' : 'rgb(var(--fg-muted))' }}>
                      {ERR_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>

        ) : tab === 'bugs' ? (
          <div className="space-y-3">
            <Filters options={BUG_STATUS} labels={BUG_STATUS_LABEL} value={bugFilter} onChange={setBugFilter} />
            {bugs.length === 0 ? (
              <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]"><Bug className="mx-auto mb-2 opacity-40" size={24} />Nessuna segnalazione {BUG_STATUS_LABEL[bugFilter]?.toLowerCase()}.</Card>
            ) : bugs.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: b.severity === 'BLOCCANTE' || b.severity === 'ALTA' ? 'rgb(var(--rose-100))' : 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>{b.severity}</span>
                  <span className="text-[11px] text-[rgb(var(--fg-subtle))]">{b.reporter ?? 'Anonimo'} · {new Date(b.created_at).toLocaleString('it-IT')}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{b.message}</p>
                {b.url && <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">su {b.url}</p>}
                <div className="flex gap-1 mt-3 flex-wrap">
                  {BUG_STATUS.map((s) => (
                    <button key={s} onClick={() => void setBugStatus(b, s)}
                      className="text-[10px] px-2 py-1 rounded-full border transition-colors"
                      style={{ borderColor: 'rgb(var(--border-strong))', background: b.status === s ? 'rgb(var(--gold-500))' : 'transparent', color: b.status === s ? 'white' : 'rgb(var(--fg-muted))' }}>
                      {BUG_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>

        ) : tab === 'subs' && subs ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="MRR stimato" value={subs.mrr} sub="€/mese" />
              <Stat label="Fornitori paganti" value={subs.paying} sub={`su ${subs.fornitori_total}`} />
              <Stat label="Regione (59€)" value={subs.by_plan?.REGION ?? 0} />
              <Stat label="Italia (79€)" value={subs.by_plan?.NATIONAL ?? 0} />
            </div>
            <Card className="p-5">
              <h3 className="font-display text-lg mb-1">Limite "pancia" per capostipite</h3>
              <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">Quanti fornitori per <strong>categoria</strong> può avere ogni capostipite nel pool suggerimenti. Più è basso, più scarsità → spinge gli upgrade. In fase di crescita tienilo alto per riempire il mercato.</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={50} value={capInput} onChange={(e) => setCapInput(e.target.value)} className="w-28" />
                <span className="text-sm text-[rgb(var(--fg-muted))]">per categoria</span>
                <Button size="sm" variant="gold" onClick={() => void saveCap()}>Salva</Button>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-display text-lg mb-3">Prezzi attuali</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full" style={{ background: 'rgb(var(--bg-sunken))' }}>Presenza <strong>{subs.pricing.presence}€</strong></span>
                <span className="px-3 py-1 rounded-full" style={{ background: 'rgb(var(--bg-sunken))' }}>Regione <strong>{subs.pricing.region}€</strong></span>
                <span className="px-3 py-1 rounded-full" style={{ background: 'rgb(var(--bg-sunken))' }}>Italia <strong>{subs.pricing.national}€</strong></span>
              </div>
            </Card>
            <div>
              <form onSubmit={(e) => { e.preventDefault(); void loadForn() }} className="flex gap-2 mb-3">
                <Input value={fornSearch} onChange={(e) => setFornSearch(e.target.value)} placeholder="Cerca fornitore…" />
                <Button variant="outline" size="sm" type="submit"><Search size={14} /></Button>
              </form>
              <div className="space-y-2">
                {forn.map((f) => (
                  <Card key={f.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{f.business_name ?? f.full_name ?? f.email}</p>
                      <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">{f.subrole ?? '—'} · {(f.service_regions ?? []).join(', ') || 'nessuna regione'}</p>
                    </div>
                    <select value={f.subscription_plan} disabled={busy === f.id} onChange={(e) => void setPlan(f, e.target.value)}
                      className="h-9 px-2 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-xs shrink-0">
                      {PLANS.map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                    </select>
                  </Card>
                ))}
                {forn.length === 0 && <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun fornitore.</Card>}
              </div>
            </div>
          </div>

        ) : tab === 'team' ? (
          <div className="space-y-3">
            <form onSubmit={(e) => { e.preventDefault(); void loadUsers() }} className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome, attività o email…" />
              <Button variant="outline" size="sm" type="submit"><Search size={14} /></Button>
            </form>
            <p className="text-xs text-[rgb(var(--fg-muted))]">Attiva lo <strong>staff assistenza</strong> per chi deve gestire ticket, errori e segnalazioni.</p>
            {users.map((u) => (
              <Card key={u.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.business_name ?? u.full_name ?? u.email}</p>
                  <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">{u.email} · {roleLabel(u.role)}</p>
                </div>
                <Button size="sm" variant={u.is_support_staff ? 'gold' : 'outline'} disabled={busy === u.id} onClick={() => void toggleStaff(u)}>
                  {u.is_support_staff ? 'Staff ✓' : 'Rendi staff'}
                </Button>
              </Card>
            ))}
            {users.length === 0 && <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun utente trovato.</Card>}
          </div>

        ) : tab === 'funnel' && ov ? (
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl mb-1 flex items-center gap-2"><Zap size={18} /> Funnel automatico</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] max-w-md">
                  Follow-up automatici (+3/+7/+14 giorni), archivio a 30 giorni, email "data contesa".
                  Attivo su <strong>{ov.funnel_active_quotes}</strong> preventivi (i test sono in pausa).
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full shrink-0" style={{ background: ov.funnel_active ? 'rgb(var(--sage-100))' : 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>{ov.funnel_active ? 'Acceso' : 'In pausa'}</span>
            </div>
            <div className="mt-5">
              <Button variant={ov.funnel_active ? 'outline' : 'gold'} size="sm" disabled={busy === 'funnel'} onClick={() => void toggleFunnel()}>
                <Power size={14} /> {ov.funnel_active ? 'Metti in pausa' : 'Accendi il funnel'}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function Filters({ options, labels, value, onChange }: { options: string[]; labels: Record<string, string>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto">
      {options.map((s) => (
        <button key={s} onClick={() => onChange(s)}
          className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
          style={{ background: value === s ? 'rgb(var(--fg))' : 'rgb(var(--bg-sunken))', color: value === s ? 'rgb(var(--bg-elev))' : 'rgb(var(--fg-muted))' }}>
          {labels[s] ?? s}
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value, sub, alert, onClick }: { label: string; value: number; sub?: string; alert?: boolean; onClick?: () => void }) {
  return (
    <Card className={`p-4 ${onClick ? 'cursor-pointer hover:shadow-[var(--shadow-lift)] transition-shadow' : ''}`} onClick={onClick}
      style={alert ? { borderColor: 'rgb(var(--rose-500))' } : undefined}>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className="font-display text-2xl tabular-nums mt-0.5" style={alert ? { color: 'rgb(var(--rose-500))' } : undefined}>{value}</p>
      {sub && <p className="text-[11px] text-[rgb(var(--fg-subtle))]">{sub}</p>}
    </Card>
  )
}
