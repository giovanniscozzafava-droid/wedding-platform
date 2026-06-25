import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  PackageSearch,
  CalendarDays,
  FileText,
  TrendingUp,
  Sparkles,
  Eye,
  EyeOff,
  Clock,
  CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProssimaMossa } from '@/components/workflow/ProssimaMossa'
import { useNuovoModello } from '@/hooks/useNuovoModello'
import { FunnelMetrics } from '@/components/dashboard/FunnelMetrics'

type Stats = {
  servicesCount: number
  collabCount: number
  upcomingCount: number
  quotesActive: number
  quotesAccepted: number
  marginMonth: number
}

function useStats() {
  return useQuery<Stats>({
    queryKey: ['home-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const in60 = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10)
      const [services, collab, upcoming, qActive, qAccepted] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('collaborations').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('calendar_entries').select('id', { count: 'exact', head: true }).gte('date_from', today).lte('date_from', in60),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).in('status', ['BOZZA', 'INVIATO']),
        supabase.from('quotes').select('margin_amount').eq('status', 'ACCETTATO'),
      ])
      const marginMonth = (qAccepted.data ?? []).reduce((s: number, q: any) => s + Number(q.margin_amount ?? 0), 0)
      return {
        servicesCount: services.count ?? 0,
        collabCount: collab.count ?? 0,
        upcomingCount: upcoming.count ?? 0,
        quotesActive: qActive.count ?? 0,
        quotesAccepted: qAccepted.data?.length ?? 0,
        marginMonth,
      }
    },
  })
}

function useRecentActivity() {
  return useQuery({
    queryKey: ['home-activity'],
    queryFn: async () => {
      const [q, e] = await Promise.all([
        supabase.from('quotes').select('id, title, status, updated_at, total_client').order('updated_at', { ascending: false }).limit(5),
        supabase.from('calendar_entries').select('id, title, status, date_from').order('date_from', { ascending: true }).limit(5),
      ])
      const quotes = (q.data ?? []) as any[]
      // Tracciamento apertura: il cliente ha aperto davvero il preventivo?
      const ids = quotes.map((x) => x.id)
      if (ids.length > 0) {
        const { data: acts } = await (supabase as any).rpc('quotes_activity_summary', { p_quote_ids: ids })
        const map = (acts?.map ?? {}) as Record<string, any>
        for (const qq of quotes) qq.activity = map[qq.id] ?? null
      }
      return { quotes, entries: e.data ?? [] }
    },
  })
}

// Agenda overview: prossimi appuntamenti (booking, con orario) + eventi (date), uniti e ordinati.
type AgendaItem = { id: string; when: string; title: string; kind: 'appt' | 'event'; status?: string; timed: boolean }
function useAgenda() {
  return useQuery<AgendaItem[]>({
    queryKey: ['home-agenda'],
    queryFn: async () => {
      const nowIso = new Date().toISOString()
      const today = nowIso.slice(0, 10)
      const [bk, ev] = await Promise.all([
        (supabase.from as any)('bookings').select('id, starts_at, client_name, status').eq('status', 'CONFIRMED').gte('starts_at', nowIso).order('starts_at').limit(8),
        supabase.from('calendar_entries').select('id, title, status, date_from').gte('date_from', today).order('date_from').limit(8),
      ])
      const items: AgendaItem[] = []
      for (const b of (bk.data ?? []) as any[]) items.push({ id: 'b' + b.id, when: b.starts_at, title: `Appuntamento · ${b.client_name}`, kind: 'appt', status: b.status, timed: true })
      for (const e of (ev.data ?? []) as any[]) items.push({ id: 'e' + e.id, when: e.date_from, title: e.title, kind: 'event', status: e.status, timed: false })
      items.sort((a, b) => a.when.localeCompare(b.when))
      return items.slice(0, 6)
    },
  })
}

const ROLE_GREETING: Record<string, string> = {
  WEDDING_PLANNER: 'Coordina la prossima magia.',
  LOCATION: 'Apri le porte del prossimo evento.',
  FORNITORE: 'Cura ogni dettaglio del tuo catalogo.',
  ADMIN: 'Tutto pronto per oggi.',
}

export default function HomePage() {
  const { profile, user } = useAuth()
  const { data: stats } = useStats()
  const { data: activity } = useRecentActivity()
  const { data: agenda } = useAgenda()
  const role = profile?.role ?? 'WEDDING_PLANNER'
  const firstName = (profile?.full_name ?? user?.email ?? '').split(/\s|@/)[0]

  const isCapostipite = role === 'WEDDING_PLANNER' || role === 'LOCATION' || role === 'ADMIN'
  const nuovoModello = useNuovoModello()

  return (
    <div className="aurora min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 sm:py-14">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <PageHeader
            eyebrow={`Ciao ${firstName ?? ''}`}
            title={
              <>
                {ROLE_GREETING[role] ?? 'Buon lavoro.'}
              </>
            }
            description={
              <>
                Sei nel pannello <strong>{role}</strong>. Trova qui un riepilogo delle attività in corso.
              </>
            }
            actions={
              isCapostipite ? (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/calendar"><CalendarDays /> Calendario</Link>
                  </Button>
                  <Button variant="gold" asChild>
                    <Link to="/quotes"><FileText /> Nuovo preventivo</Link>
                  </Button>
                </>
              ) : (
                <Button variant="gold" asChild>
                  <Link to="/catalog"><PackageSearch /> Vai al catalogo</Link>
                </Button>
              )
            }
          />
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Servizi attivi" value={stats?.servicesCount ?? 0} icon={PackageSearch} accent="gold" />
          <StatCard label={isCapostipite ? 'Collaboratori' : 'Capostipiti'} value={stats?.collabCount ?? 0} icon={Sparkles} accent="sage" />
          <StatCard label="Eventi (60 gg)" value={stats?.upcomingCount ?? 0} icon={CalendarDays} accent="sky" />
          <StatCard
            label={isCapostipite ? 'Margine generato' : 'Preventivi in cui sono'}
            value={isCapostipite ? `€ ${(stats?.marginMonth ?? 0).toLocaleString('it-IT')}` : (stats?.quotesActive ?? 0)}
            icon={TrendingUp}
            accent="ink"
          />
        </div>

        {/* Agenda: il calendario in overview — prossimi appuntamenti (orario) ed eventi */}
        <Card className="overflow-hidden mb-10">
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            <h2 className="font-display text-lg inline-flex items-center gap-2"><CalendarClock size={18} className="text-[rgb(var(--gold-600))]" /> Agenda</h2>
            <Link to="/calendar" className="text-sm font-medium inline-flex items-center gap-1 hover:underline">
              Apri calendario <ArrowUpRight size={14} />
            </Link>
          </div>
          <CardContent className="p-0">
            {(agenda ?? []).length === 0 ? (
              <EmptyState text="Nessun impegno in agenda. Pubblica le tue disponibilità per ricevere prenotazioni." />
            ) : (
              <ul>
                {(agenda ?? []).map((it) => {
                  const d = new Date(it.when)
                  return (
                    <li key={it.id} className="flex items-center gap-4 px-6 py-3.5 border-b last:border-0 hover:bg-[rgb(var(--bg-sunken))] transition-colors" style={{ borderColor: 'rgb(var(--border))' }}>
                      <div className="shrink-0 w-12 text-center">
                        <p className="font-display text-xl leading-none tabular-nums">{d.toLocaleDateString('it-IT', { day: 'numeric' })}</p>
                        <p className="text-[10px] uppercase tracking-wide text-[rgb(var(--fg-subtle))]">{d.toLocaleDateString('it-IT', { month: 'short' })}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{it.title}</p>
                        <p className="text-xs text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1 mt-0.5">
                          {it.timed
                            ? <><Clock size={11} /> {d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {d.toLocaleDateString('it-IT', { weekday: 'long' })}</>
                            : <><CalendarDays size={11} /> {d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</>}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${it.kind === 'appt' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]'}`}>
                        {it.kind === 'appt' ? 'Appuntamento' : 'Evento'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Funnel lead-generation: percentuali motivazionali */}
        <FunnelMetrics />

        {/* Prossima mossa (workflow guidato) — solo capostipiti (WP/LOCATION/ADMIN) e con feature flag attiva */}
        {isCapostipite && nuovoModello && (
          <div className="mb-10">
            <ProssimaMossa limit={5} />
          </div>
        )}

        {/* Activity feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <h2 className="font-display text-lg">Preventivi recenti</h2>
              <Link to="/quotes" className="text-sm font-medium inline-flex items-center gap-1 hover:underline">
                Tutti <ArrowUpRight size={14} />
              </Link>
            </div>
            <CardContent className="p-0">
              {(activity?.quotes ?? []).length === 0 ? (
                <EmptyState text="Nessun preventivo ancora." />
              ) : (
                <ul>
                  {(activity?.quotes ?? []).map((q: any) => (
                    <li key={q.id} className="flex items-center justify-between px-6 py-4 border-b last:border-0 hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                      style={{ borderColor: 'rgb(var(--border))' }}>
                      <Link to={`/quotes/${q.id}`} className="flex-1 min-w-0">
                        <p className="font-medium truncate">{q.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-[rgb(var(--fg-subtle))]">
                            {new Date(q.updated_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                          {/* Apertura cliente: solo se il preventivo e' stato inviato */}
                          {q.activity && q.status !== 'BOZZA' && (
                            q.activity.open_count > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-600,5_150_105))' }}
                                title={q.activity.last_opened_at ? `Ultima apertura: ${new Date(q.activity.last_opened_at).toLocaleString('it-IT')}` : undefined}>
                                <Eye size={11} /> Aperto{q.activity.open_count > 1 ? ` ${q.activity.open_count}×` : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-subtle))' }}>
                                <EyeOff size={11} /> Non aperto
                              </span>
                            )
                          )}
                        </div>
                      </Link>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <span className="font-display text-base tabular-nums">
                          € {Number(q.total_client).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                        </span>
                        <Badge status={q.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <h2 className="font-display text-lg">Prossimi eventi</h2>
              <Link to="/calendar" className="text-sm font-medium inline-flex items-center gap-1 hover:underline">
                Calendario <ArrowUpRight size={14} />
              </Link>
            </div>
            <CardContent className="p-0">
              {(activity?.entries ?? []).length === 0 ? (
                <EmptyState text="Nessun evento in programma." />
              ) : (
                <ul>
                  {(activity?.entries ?? []).map((e: any) => (
                    <li key={e.id} className="px-6 py-4 border-b last:border-0 hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                      style={{ borderColor: 'rgb(var(--border))' }}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="font-medium truncate flex-1">{e.title}</p>
                        <Badge status={e.status} />
                      </div>
                      <p className="text-xs text-[rgb(var(--fg-subtle))]">
                        {new Date(e.date_from).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string
  value: number | string
  icon: typeof PackageSearch
  accent: 'gold' | 'sage' | 'sky' | 'ink'
}) {
  const accents: Record<typeof accent, string> = {
    gold: 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]',
    sage: 'bg-[rgb(var(--sage-100))] text-[rgb(var(--sage-700))]',
    sky:  'bg-[rgb(var(--sky-100))] text-[rgb(var(--sky-500))]',
    ink:  'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="surface surface-elev p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center justify-center h-9 w-9 rounded-lg ${accents[accent]}`}>
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
        <p className="font-display text-3xl mt-1 tabular-nums" style={{ color: 'rgb(var(--fg))' }}>
          {value}
        </p>
      </div>
    </motion.div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm text-[rgb(var(--fg-subtle))]">{text}</p>
    </div>
  )
}
