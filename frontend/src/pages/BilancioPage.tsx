import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Wallet, TrendingUp, CalendarDays, Hourglass, CheckCircle2, FileText, ExternalLink, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { eventTerm } from '@/lib/eventKind'
import { eur, eurInt } from '@/lib/money'

type FinanceRow = {
  id: string
  title: string
  client_name: string | null
  client_email?: string | null
  event_date: string | null
  event_kind?: string | null
  total_client: number
  accepted_at?: string | null
  created_at?: string | null
  revision?: number
}

type FinanceStats = {
  lifetime_total: number
  year_total: number
  month_total: number
  count_accepted: number
  count_pending: number
  by_month: Array<{ month: string; total: number }>
  recent: FinanceRow[]
  upcoming: FinanceRow[]
  pending: FinanceRow[]
}


export default function BilancioPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<FinanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc('owner_finance_stats')
        if (error) throw error
        setStats(data as FinanceStats)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Errore')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const maxMonth = useMemo(() => {
    if (!stats?.by_month?.length) return 0
    return Math.max(...stats.by_month.map((m) => Number(m.total) || 0))
  }, [stats])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-[rgb(var(--bg-sunken))]" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="h-28 rounded-xl bg-[rgb(var(--bg-sunken))]" />
            <div className="h-28 rounded-xl bg-[rgb(var(--bg-sunken))]" />
            <div className="h-28 rounded-xl bg-[rgb(var(--bg-sunken))]" />
          </div>
        </div>
      </div>
    )
  }

  if (err) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="surface p-6 text-center">
          <AlertCircle className="mx-auto mb-2 text-[rgb(var(--rose-500))]" />
          <p className="text-sm text-[rgb(var(--fg-muted))]">{err}</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const empty = stats.count_accepted === 0 && stats.count_pending === 0

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--gold-600))]">Bilancio</p>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">Il tuo fatturato</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1 max-w-2xl">
            Conteggia solo i preventivi <strong>firmati dal cliente</strong>. Le proposte ancora in attesa di firma sono elencate qui sotto.
          </p>
        </div>
        {profile?.role && (
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full"
            style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
            {profile.role}
          </span>
        )}
      </header>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Questo mese"
          value={eurInt(stats.month_total)}
          icon={TrendingUp}
          accent="gold"
        />
        <KpiCard
          label="Quest'anno"
          value={eurInt(stats.year_total)}
          icon={CalendarDays}
          accent="sage"
        />
        <KpiCard
          label="Totale lifetime"
          value={eurInt(stats.lifetime_total)}
          icon={Wallet}
          accent="ink"
        />
      </div>

      {/* Conteggi secondari */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          label="Preventivi accettati"
          value={stats.count_accepted}
          icon={CheckCircle2}
          tint="emerald"
        />
        <MiniStat
          label="In attesa di firma"
          value={stats.count_pending}
          icon={Hourglass}
          tint="amber"
        />
      </div>

      {/* Grafico ultimi 12 mesi */}
      {stats.by_month?.length > 0 && (
        <section className="surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg">Ultimi 12 mesi</h2>
            <span className="text-xs text-[rgb(var(--fg-subtle))]">Solo accettati</span>
          </div>
          <div className="flex items-end justify-between gap-1 h-32">
            {stats.by_month.map((m) => {
              const pct = maxMonth > 0 ? (Number(m.total) / maxMonth) * 100 : 0
              const monthLabel = m.month.split('-')[1] // MM
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-[10px] tabular-nums opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'rgb(var(--fg-muted))' }}>
                    {eurInt(Number(m.total))}
                  </div>
                  <div className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      background: Number(m.total) > 0 ? 'rgb(var(--gold-500))' : 'rgb(var(--bg-sunken))',
                      minHeight: 4,
                    }} />
                  <span className="text-[9px] text-[rgb(var(--fg-subtle))]">{monthLabel}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {empty && (
        <section className="surface p-8 text-center">
          <Wallet className="mx-auto mb-3 opacity-40" size={32} />
          <h3 className="font-display text-xl">Nessun preventivo ancora</h3>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
            Quando il primo cliente firmerà il preventivo, l'importo apparirà qui.
          </p>
          <Link to="/quotes" className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-[rgb(var(--gold-600))] hover:underline">
            Crea il primo preventivo <ExternalLink size={12} />
          </Link>
        </section>
      )}

      {/* In attesa di firma */}
      {stats.pending?.length > 0 && (
        <section className="surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg flex items-center gap-2">
              <Hourglass size={18} className="text-[rgb(var(--amber-500))]" />
              In attesa di firma
            </h2>
            <span className="text-xs text-[rgb(var(--fg-subtle))]">
              {stats.pending.length} {stats.pending.length === 1 ? 'preventivo' : 'preventivi'}
            </span>
          </div>
          <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
            Inviati al cliente ma non ancora firmati. Non rientrano nel fatturato finché non vengono accettati.
          </p>
          <RowList rows={stats.pending} kind="pending" />
        </section>
      )}

      {/* Eventi futuri */}
      {stats.upcoming?.length > 0 && (
        <section className="surface p-5">
          <h2 className="font-display text-lg flex items-center gap-2 mb-3">
            <CalendarDays size={18} className="text-[rgb(var(--sage-700))]" />
            Eventi futuri confermati
          </h2>
          <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
            Preventivi firmati con data evento ancora a venire. Utile per la pianificazione cashflow.
          </p>
          <RowList rows={stats.upcoming} kind="upcoming" />
        </section>
      )}

      {/* Recap recente */}
      {stats.recent?.length > 0 && (
        <section className="surface p-5">
          <h2 className="font-display text-lg flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-[rgb(var(--emerald-500))]" />
            Ultimi preventivi accettati
          </h2>
          <RowList rows={stats.recent} kind="recent" />
        </section>
      )}

      <p className="text-[11px] text-[rgb(var(--fg-subtle))] text-center pt-4">
        Importi al lordo di IVA e commissioni. La sezione fiscale dedicata sarà disponibile a breve.
      </p>
    </div>
  )
}

function KpiCard({
  label, value, icon: Icon, accent,
}: {
  label: string
  value: string
  icon: typeof Wallet
  accent: 'gold' | 'sage' | 'sky' | 'ink'
}) {
  const accents: Record<typeof accent, string> = {
    gold: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]',
    sage: 'bg-[rgb(var(--sage-100))] text-[rgb(var(--sage-700))]',
    sky:  'bg-[rgb(var(--sky-100))] text-[rgb(var(--sky-500))]',
    ink:  'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]',
  }
  return (
    <motion.div className="surface surface-elev p-5 flex flex-col gap-3"
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <span className={`inline-flex items-center justify-center h-9 w-9 rounded-lg ${accents[accent]}`}>
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
        <p className="font-display text-3xl mt-1 tabular-nums">{value}</p>
      </div>
    </motion.div>
  )
}

function MiniStat({
  label, value, icon: Icon, tint,
}: {
  label: string
  value: number
  icon: typeof CheckCircle2
  tint: 'emerald' | 'amber'
}) {
  const tints: Record<typeof tint, string> = {
    emerald: 'text-[rgb(var(--emerald-500))]',
    amber:   'text-[rgb(var(--amber-500))]',
  }
  return (
    <div className="surface p-4 flex items-center gap-3">
      <Icon size={20} className={tints[tint]} />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] truncate">{label}</p>
        <p className="font-display text-2xl tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function RowList({ rows, kind }: { rows: FinanceRow[]; kind: 'pending' | 'upcoming' | 'recent' }) {
  return (
    <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
      {rows.map((r) => {
        const dateRaw = kind === 'pending' ? r.created_at : kind === 'upcoming' ? r.event_date : r.accepted_at
        const dateFmt = dateRaw ? new Date(dateRaw).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
        const eventLabel = r.event_kind ? eventTerm(r.event_kind).label : null
        const eventDateFmt = r.event_date ? new Date(r.event_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : null
        return (
          <li key={r.id} className="py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Link to={`/quotes/${r.id}`} className="font-medium text-sm hover:underline flex items-center gap-1.5">
                <FileText size={13} className="text-[rgb(var(--fg-subtle))]" />
                {r.title}
              </Link>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5 truncate">
                {r.client_name ?? '—'}
                {eventLabel && eventDateFmt && (
                  <span> · {eventLabel} {eventDateFmt}</span>
                )}
              </p>
              <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-0.5">
                {kind === 'pending' ? 'Inviato' : kind === 'upcoming' ? 'Evento' : 'Firmato'} il {dateFmt}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-medium tabular-nums whitespace-nowrap">
                {eur(Number(r.total_client))}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
