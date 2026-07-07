import { useEffect, useMemo, useState } from 'react'
import { Users, UserPlus, Activity, Zap, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

// ── Tipi RPC ────────────────────────────────────────────────────────────────
type Growth = {
  series: Array<{ day: string; signups: number; cumulative: number }>
  by_role: Array<{ role: string; n: number }>
  totals: { total: number; new7: number; prev7: number; new30: number; active7: number; active30: number; actions_today: number }
}
type AccessRow = {
  user_id: string; email: string | null; full_name: string | null; business_name: string | null
  role: string | null; created_at: string | null; last_sign_in_at: string | null; actions: number; last_activity: string | null
}
type ActorRow = { actor_id: string; email: string | null; role: string | null; n: number }
type ActivityData = {
  recent: Array<{ at: string; actor_id: string | null; email: string | null; role: string | null; op: string; tabella: string; record_id: string | null }>
  by_day: Array<{ day: string; n: number }>
  top_actors: ActorRow[]
}

const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }

const ROLE_LABEL: Record<string, string> = {
  WEDDING_PLANNER: 'Wedding planner', LOCATION: 'Location', FORNITORE: 'Fornitore', COUPLE: 'Coppia',
  GUEST: 'Ospite', ADMIN: 'Admin', CLIENT: 'Cliente', FOTOLAB: 'Stamperia', SCONOSCIUTO: 'Sconosciuto',
}
const TABLE_LABEL: Record<string, string> = {
  quotes: 'preventivo', quote_items: 'voce preventivo', calendar_entries: 'evento',
  event_guests: 'ospite', event_tables: 'tavolo', contracts: 'contratto', prima_nota_entries: 'movimento cassa',
}
const OP_VERB: Record<string, string> = { INSERT: 'ha creato', UPDATE: 'ha modificato', DELETE: 'ha eliminato' }

function rel(ts: string | null): string {
  if (!ts) return 'mai'
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'ora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h fa`
  const d = Math.floor(diff / 86400)
  if (d < 30) return `${d} g fa`
  return new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
}
const ROLE_COLORS: Record<string, string> = {
  WEDDING_PLANNER: '#b08968', LOCATION: '#6b8f71', FORNITORE: '#5b7ba3', COUPLE: '#c08497',
  GUEST: '#a0a0a0', ADMIN: '#8b5cf6', CLIENT: '#d0a24c', FOTOLAB: '#7b7bd0', SCONOSCIUTO: '#c4c4c4',
}
const PERIODS = [{ v: 30, l: '30 g' }, { v: 90, l: '90 g' }, { v: 365, l: '12 mesi' }]

export default function ObservatoryPage() {
  const [growth, setGrowth] = useState<Growth | null>(null)
  const [access, setAccess] = useState<AccessRow[]>([])
  const [act, setAct] = useState<ActivityData | null>(null)
  const [days, setDays] = useState(90)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const r = await rpc.rpc('admin_obs_growth', { p_days: days })
      if (r.error) { setErr(r.error.message); return }
      setGrowth(r.data as Growth)
    })()
  }, [days])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [a, c] = await Promise.all([rpc.rpc('admin_obs_access', { p_limit: 300 }), rpc.rpc('admin_obs_activity', { p_limit: 120 })])
        if (a.error) throw a.error
        if (c.error) throw c.error
        setAccess((a.data as AccessRow[]) ?? [])
        setAct(c.data as ActivityData)
      } catch (e) { setErr((e as Error).message) }
      finally { setLoading(false) }
    })()
  }, [])

  const delta = useMemo(() => {
    if (!growth) return null
    const { new7, prev7 } = growth.totals
    if (!prev7) return new7 > 0 ? 100 : 0
    return Math.round(((new7 - prev7) / prev7) * 100)
  }, [growth])

  if (err) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <ShieldCheck className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" />
      <p className="text-sm text-[rgb(var(--fg-muted))]">{err}</p>
      <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">Sezione riservata agli amministratori.</p>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <PageHeader
        eyebrow="Solo admin"
        title="Osservatorio"
        description="Come cresce l'app: iscrizioni nel tempo, chi accede e quando, cosa fanno gli utenti. Dati aggregati dal registro attività."
      />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Utenti totali" value={growth?.totals.total ?? '—'} icon={Users} accent="gold" />
        <Kpi label="Nuovi (7 g)" value={growth?.totals.new7 ?? '—'} icon={UserPlus} accent="emerald"
          delta={delta} />
        <Kpi label="Attivi (7 g)" value={growth?.totals.active7 ?? '—'} icon={Activity} accent="blue" />
        <Kpi label="Azioni oggi" value={growth?.totals.actions_today ?? '—'} icon={Zap} accent="violet" />
      </div>

      {/* Crescita */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg">Crescita utenti</h3>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">Barre = nuove iscrizioni al giorno · linea = totale cumulato</p>
            </div>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'rgb(var(--border-strong))' }}>
              {PERIODS.map((p) => (
                <button key={p.v} onClick={() => setDays(p.v)}
                  className={`px-3 py-1.5 text-xs ${days === p.v ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          {growth ? <GrowthChart series={growth.series} /> : <ChartSkeleton />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per ruolo */}
        <Card><CardContent className="p-5">
          <h3 className="font-display text-lg mb-4">Utenti per ruolo</h3>
          {growth ? <RoleBars data={growth.by_role} total={growth.totals.total} /> : <ChartSkeleton small />}
        </CardContent></Card>

        {/* Attività per giorno */}
        <Card><CardContent className="p-5">
          <h3 className="font-display text-lg mb-1">Attività (30 g)</h3>
          <p className="text-xs text-[rgb(var(--fg-subtle))] mb-4">Azioni registrate al giorno</p>
          {act ? <DayBars data={act.by_day} /> : <ChartSkeleton small />}
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed attività */}
        <Card className="lg:col-span-2"><CardContent className="p-5">
          <h3 className="font-display text-lg mb-4">Cosa succede ora</h3>
          {loading ? <ChartSkeleton small /> : (
            <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {(act?.recent ?? []).map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: opColor(e.op) }} />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{e.email ?? 'Sistema'}</span>
                    <span className="text-[rgb(var(--fg-muted))]"> {OP_VERB[e.op] ?? e.op} {article(e.op)} {TABLE_LABEL[e.tabella] ?? e.tabella}</span>
                    {e.role && <span className="ml-1.5 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-subtle))' }}>{ROLE_LABEL[e.role] ?? e.role}</span>}
                  </div>
                  <span className="shrink-0 text-xs text-[rgb(var(--fg-subtle))]">{rel(e.at)}</span>
                </li>
              ))}
              {!act?.recent?.length && <li className="text-sm text-[rgb(var(--fg-muted))]">Nessuna attività recente.</li>}
            </ul>
          )}
        </CardContent></Card>

        {/* Top utenti attivi */}
        <Card><CardContent className="p-5">
          <h3 className="font-display text-lg mb-4">Più attivi (30 g)</h3>
          <ul className="space-y-2.5">
            {(act?.top_actors ?? []).map((a, i) => (
              <li key={a.actor_id} className="flex items-center gap-2 text-sm">
                <span className="shrink-0 w-5 text-xs text-[rgb(var(--fg-subtle))] tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{a.email ?? '—'}</div>
                  <div className="text-[10px] uppercase tracking-wide text-[rgb(var(--fg-subtle))]">{ROLE_LABEL[a.role ?? ''] ?? a.role ?? ''}</div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{a.n}</span>
              </li>
            ))}
            {!act?.top_actors?.length && <li className="text-sm text-[rgb(var(--fg-muted))]">—</li>}
          </ul>
        </CardContent></Card>
      </div>

      {/* Tabella accessi */}
      <Card><CardContent className="p-0">
        <div className="p-5 pb-3"><h3 className="font-display text-lg">Accessi utenti</h3>
          <p className="text-xs text-[rgb(var(--fg-subtle))]">Ordinati per ultimo accesso. {access.length} utenti.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-left text-xs text-[rgb(var(--fg-subtle))] border-y" style={{ borderColor: 'rgb(var(--border))' }}>
              <tr>
                <th className="px-5 py-2 font-medium">Utente</th>
                <th className="px-3 py-2 font-medium">Ruolo</th>
                <th className="px-3 py-2 font-medium">Iscritto</th>
                <th className="px-3 py-2 font-medium">Ultimo accesso</th>
                <th className="px-3 py-2 font-medium text-right">Azioni</th>
                <th className="px-5 py-2 font-medium text-right">Ultima attività</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {loading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="h-4 rounded bg-[rgb(var(--bg-sunken))] animate-pulse" /></td></tr>
              )) : access.slice(0, 100).map((u) => (
                <tr key={u.user_id} className="hover:bg-[rgb(var(--bg-sunken))]">
                  <td className="px-5 py-2.5">
                    <div className="truncate max-w-[240px]">{u.email ?? '—'}</div>
                    {(u.business_name || u.full_name) && <div className="text-xs text-[rgb(var(--fg-subtle))] truncate max-w-[240px]">{u.business_name ?? u.full_name}</div>}
                  </td>
                  <td className="px-3 py-2.5"><span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: (ROLE_COLORS[u.role ?? ''] ?? '#ccc') + '22', color: ROLE_COLORS[u.role ?? ''] ?? '#888' }}>{ROLE_LABEL[u.role ?? ''] ?? u.role ?? '—'}</span></td>
                  <td className="px-3 py-2.5 text-[rgb(var(--fg-muted))]">{u.created_at ? new Date(u.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                  <td className="px-3 py-2.5 text-[rgb(var(--fg-muted))]">{rel(u.last_sign_in_at)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.actions}</td>
                  <td className="px-5 py-2.5 text-right text-[rgb(var(--fg-muted))]">{rel(u.last_activity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  )
}

function article(op: string) { return op === 'INSERT' ? 'un' : op === 'DELETE' ? 'un' : 'un' }
function opColor(op: string) { return op === 'INSERT' ? 'rgb(4 120 87)' : op === 'DELETE' ? 'rgb(190 18 60)' : 'rgb(91 123 163)' }

// ── Grafico crescita: barre (signup) + linea (cumulato) ──────────────────────
function GrowthChart({ series }: { series: Growth['series'] }) {
  const W = 720, H = 220, PAD = 28
  if (!series.length) return <div className="text-sm text-[rgb(var(--fg-muted))]">Nessun dato.</div>
  const maxS = Math.max(1, ...series.map((d) => d.signups))
  const maxC = Math.max(1, ...series.map((d) => d.cumulative))
  const n = series.length
  const bw = (W - PAD * 2) / n
  const x = (i: number) => PAD + i * bw + bw * 0.15
  const yC = (v: number) => H - PAD - (v / maxC) * (H - PAD * 2)
  const line = series.map((d, i) => `${x(i) + bw * 0.35},${yC(d.cumulative)}`).join(' ')
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const labelEvery = Math.ceil(n / 8)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD} x2={W - PAD} y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)} stroke="rgb(var(--border))" strokeWidth="1" />
          <text x={4} y={PAD + t * (H - PAD * 2) + 3} fontSize="9" fill="rgb(var(--fg-subtle))">{Math.round(maxC * (1 - t))}</text>
        </g>
      ))}
      {series.map((d, i) => {
        const h = (d.signups / maxS) * (H - PAD * 2)
        return <rect key={i} x={x(i)} y={H - PAD - h} width={bw * 0.7} height={h} rx="1.5" fill="rgb(var(--gold-400))" opacity={0.85} />
      })}
      <polyline points={line} fill="none" stroke="rgb(var(--gold-700))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((d, i) => i % labelEvery === 0 ? (
        <text key={i} x={x(i) + bw * 0.35} y={H - 8} fontSize="9" fill="rgb(var(--fg-subtle))" textAnchor="middle">
          {new Date(d.day).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
        </text>
      ) : null)}
    </svg>
  )
}

function RoleBars({ data, total }: { data: Growth['by_role']; total: number }) {
  const max = Math.max(1, ...data.map((d) => d.n))
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.role} className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-xs truncate">{ROLE_LABEL[d.role] ?? d.role}</div>
          <div className="flex-1 h-5 rounded bg-[rgb(var(--bg-sunken))] overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(d.n / max) * 100}%`, background: ROLE_COLORS[d.role] ?? '#b08968' }} />
          </div>
          <div className="w-16 shrink-0 text-right text-xs tabular-nums">{d.n} <span className="text-[rgb(var(--fg-subtle))]">({total ? Math.round((d.n / total) * 100) : 0}%)</span></div>
        </div>
      ))}
    </div>
  )
}

function DayBars({ data }: { data: ActivityData['by_day'] }) {
  const max = Math.max(1, ...data.map((d) => d.n))
  if (!data.length) return <div className="text-sm text-[rgb(var(--fg-muted))]">Nessuna attività.</div>
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div key={d.day} className="flex-1 group relative flex flex-col justify-end">
          <div className="rounded-t bg-[rgb(var(--gold-400))] hover:bg-[rgb(var(--gold-600))] transition" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 2 : 0 }} />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] whitespace-nowrap bg-[rgb(var(--fg))] text-[rgb(var(--bg))] px-1.5 py-0.5 rounded pointer-events-none">
            {new Date(d.day).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}: {d.n}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton({ small }: { small?: boolean }) {
  return <div className={`w-full ${small ? 'h-32' : 'h-52'} rounded-lg bg-[rgb(var(--bg-sunken))] animate-pulse`} />
}

function Kpi({ label, value, icon: Icon, accent, delta }: { label: string; value: number | string; icon: typeof Users; accent: 'gold' | 'emerald' | 'blue' | 'violet'; delta?: number | null }) {
  const bg: Record<string, string> = { gold: 'rgb(var(--gold-100))', emerald: 'rgb(220 252 231)', blue: 'rgb(219 234 254)', violet: 'rgb(237 233 254)' }
  const fg: Record<string, string> = { gold: 'rgb(var(--gold-700))', emerald: 'rgb(4 120 87)', blue: 'rgb(29 78 216)', violet: 'rgb(109 40 217)' }
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-[rgb(var(--fg-muted))]">
        <span className="rounded-full p-1.5" style={{ background: bg[accent], color: fg[accent] }}><Icon size={14} /></span>{label}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {typeof delta === 'number' && (
          <span className={`text-xs font-medium inline-flex items-center gap-0.5 mb-1 ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(delta)}%
          </span>
        )}
      </div>
    </CardContent></Card>
  )
}
