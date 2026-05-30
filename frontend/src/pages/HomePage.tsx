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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProssimaMossa } from '@/components/workflow/ProssimaMossa'

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
      return { quotes: q.data ?? [], entries: e.data ?? [] }
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
  const role = profile?.role ?? 'WEDDING_PLANNER'
  const firstName = (profile?.full_name ?? user?.email ?? '').split(/\s|@/)[0]

  const isCapostipite = role === 'WEDDING_PLANNER' || role === 'LOCATION' || role === 'ADMIN'

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

        {/* Prossima mossa (workflow guidato) — solo capostipiti (WP/LOCATION/ADMIN) */}
        {isCapostipite && (
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
                        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">
                          {new Date(q.updated_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
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
