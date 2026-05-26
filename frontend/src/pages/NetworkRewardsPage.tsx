import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Gift, Copy, Sparkles, TrendingUp, Users, Wallet, Award, Check, Share2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Tier = {
  tier: 'BRONZO' | 'ARGENTO' | 'ORO'
  percentage: number
  paying_referees: number
  is_founding: boolean
  next_tier_at: number | null
}

type Referee = {
  referral_id: string
  referee_id: string
  business_name: string | null
  full_name: string | null
  role: 'FORNITORE' | 'WEDDING_PLANNER' | 'LOCATION'
  subrole: string | null
  subscription: string
  city: string | null
  created_at: string
  status: string
  logo: string | null
}

type Credit = {
  id: string
  amount_cents: number
  reason: 'FORNITORE_MRR' | 'WP_LEAD' | 'CROSS_LEAD' | 'WELCOME_BONUS' | 'ADJUSTMENT'
  description: string | null
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REVERSED'
  period: string | null
  created_at: string
}

type Stats = {
  referral_code: string | null
  tier: Tier
  total_referees: number
  paying_referees: number
  credits_pending_cents: number
  credits_paid_cents: number
  credits_total_cents: number
  recent_credits: Credit[]
  referees: Referee[]
}

const TIER_META: Record<Tier['tier'], { label: string; color: string; bg: string; range: string }> = {
  BRONZO:  { label: 'Bronzo', color: '#A0673D', bg: 'rgb(var(--gold-100))',  range: '1–9 fornitori paganti' },
  ARGENTO: { label: 'Argento', color: '#7D8B98', bg: 'rgb(var(--bg-sunken))', range: '10–29 fornitori paganti' },
  ORO:     { label: 'Oro', color: '#C49A5C', bg: 'rgb(var(--gold-200, 240 220 175))', range: '30+ fornitori paganti' },
}

const REASON_LABELS: Record<Credit['reason'], string> = {
  FORNITORE_MRR:  'MRR fornitore',
  WP_LEAD:        'Lead chiuso WP',
  CROSS_LEAD:     'Lead cross-WP',
  WELCOME_BONUS:  'Bonus benvenuto',
  ADJUSTMENT:     'Aggiustamento',
}

export default function NetworkRewardsPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('my_referral_stats')
        if (error) throw error
        setStats(data as Stats)
      } finally { setLoading(false) }
    })()
  }, [user])

  function copyLink() {
    if (!stats?.referral_code) return
    const url = `https://planfully.it/register?ref=${stats.referral_code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Link copiato')
    setTimeout(() => setCopied(false), 2000)
  }

  function share() {
    if (!stats?.referral_code) return
    const url = `https://planfully.it/register?ref=${stats.referral_code}`
    const text = `Entra nel network dei professionisti degli eventi italiani su Planfully. Codice invito: ${stats.referral_code}`
    if (navigator.share) navigator.share({ title: 'Planfully', text, url }).catch(() => {})
    else copyLink()
  }

  if (loading) return <div className="p-10 text-[rgb(var(--fg-muted))]">Caricamento…</div>
  if (!stats) return <div className="p-10 text-[rgb(var(--rose-500))]">Impossibile caricare i dati</div>

  const tierMeta = TIER_META[stats.tier.tier]
  const eur = (cents: number) => (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Network Rewards"
          title="Cresci con la tua rete"
          description="Porta professionisti su Planfully e guadagna a vita. Ogni fornitore o WP che entra grazie a te genera credit ricorrenti."
        />

        {/* Codice referral hero */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="surface surface-lift p-6 sm:p-8 mb-6 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 opacity-5">
            <Gift size={220} />
          </div>
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.25em] text-[rgb(var(--gold-600))] mb-2">Il tuo codice invito</p>
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <h2 className="font-display text-5xl tracking-wider tabular-nums" style={{ color: 'rgb(var(--fg))', letterSpacing: '0.15em' }}>
                {stats.referral_code ?? '—'}
              </h2>
              <Badge tone="gold" style={{ background: tierMeta.bg, color: tierMeta.color }}>
                <Trophy size={11} className="inline mr-1" /> {tierMeta.label} · {stats.tier.percentage}%
              </Badge>
              {stats.tier.is_founding && (
                <Badge tone="gold"><Sparkles size={11} className="inline mr-1" /> Founding Member</Badge>
              )}
            </div>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
              Condividi il tuo codice o link diretto. Chi si iscrive con il tuo codice diventa parte della tua rete.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="gold" onClick={copyLink}>
                {copied ? <><Check size={14} /> Copiato</> : <><Copy size={14} /> Copia link</>}
              </Button>
              <Button variant="outline" onClick={share}>
                <Share2 size={14} /> Condividi
              </Button>
            </div>
            <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-3 font-mono">
              planfully.it/register?ref={stats.referral_code}
            </p>
          </div>
        </motion.div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi icon={Users} label="Professionisti invitati" value={stats.total_referees} accent="gold" />
          <Kpi icon={TrendingUp} label="Paganti attivi" value={stats.paying_referees} accent="emerald" />
          <Kpi icon={Wallet} label="Credit maturati" value={eur(stats.credits_pending_cents)} accent="sky" />
          <Kpi icon={Award} label="Liquidati" value={eur(stats.credits_paid_cents)} accent="ink" />
        </div>

        {/* Tier progression */}
        <section className="surface p-5 mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg flex items-center gap-2"><Trophy size={16} /> Il tuo tier</h2>
            <span className="text-xs text-[rgb(var(--fg-muted))]">{stats.tier.paying_referees} paganti attivi</span>
          </div>
          <div className="space-y-3">
            <TierBar tier="BRONZO" current={stats.tier.tier} count={stats.tier.paying_referees} threshold={1} maxThreshold={9} />
            <TierBar tier="ARGENTO" current={stats.tier.tier} count={stats.tier.paying_referees} threshold={10} maxThreshold={29} />
            <TierBar tier="ORO" current={stats.tier.tier} count={stats.tier.paying_referees} threshold={30} maxThreshold={null} />
          </div>
          {stats.tier.next_tier_at && (
            <p className="text-xs text-[rgb(var(--fg-muted))] mt-4 italic">
              Mancano <strong>{Math.max(0, stats.tier.next_tier_at - stats.tier.paying_referees)}</strong> fornitori paganti per il prossimo tier.
            </p>
          )}
        </section>

        {/* Come funziona */}
        <section className="surface p-5 mb-6">
          <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Gift size={16} /> Come funziona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <RewardCard pct="15-25%" label="MRR fornitore pagante" copy="Lifetime sulla subscription mensile del fornitore che porti. Tier dinamico in base al volume." />
            <RewardCard pct="10%" label="Lead WP referee" copy="Su ogni success-fee da lead chiuso da un'altra WP che hai portato. Per sempre." />
            <RewardCard pct="5%" label="Lead cross-WP" copy="Una-tantum quando un cliente arrivato sul tuo profilo chiude con un'altra WP della rete." />
          </div>
        </section>

        {/* Referees list */}
        {stats.referees.length > 0 && (
          <section className="surface p-5 mb-6">
            <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Users size={16} /> La tua rete · {stats.referees.length}</h2>
            <div className="space-y-2">
              {stats.referees.map((r) => (
                <div key={r.referral_id} className="flex items-center gap-3 p-3 surface surface-elev">
                  {r.logo ? (
                    <img src={r.logo} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-display"
                      style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                      {(r.business_name ?? r.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.business_name ?? r.full_name}</p>
                    <p className="text-xs text-[rgb(var(--fg-muted))] truncate">
                      {r.role === 'FORNITORE' ? (r.subrole ?? 'Fornitore') : r.role === 'LOCATION' ? 'Location' : 'Wedding Planner'}
                      {r.city && ` · ${r.city}`}
                    </p>
                  </div>
                  <Badge tone={r.subscription === 'TRIAL' ? 'amber' : r.subscription === 'EXPIRED' ? 'rose' : 'emerald'}>
                    {r.subscription}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Credits history */}
        {stats.recent_credits.length > 0 && (
          <section className="surface p-5">
            <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Wallet size={16} /> Movimenti credit</h2>
            <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {stats.recent_credits.map((c) => (
                <div key={c.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{REASON_LABELS[c.reason]}</p>
                    {c.description && <p className="text-xs text-[rgb(var(--fg-muted))] truncate">{c.description}</p>}
                    <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-0.5">
                      {new Date(c.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium tabular-nums" style={{ color: c.status === 'PAID' ? 'rgb(var(--emerald-500))' : 'rgb(var(--gold-600))' }}>
                      + {eur(c.amount_cents)}
                    </p>
                    <p className="text-[10px] text-[rgb(var(--fg-subtle))]">{c.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {stats.referees.length === 0 && (
          <section className="surface p-10 text-center">
            <Gift className="mx-auto mb-3 opacity-40" size={36} />
            <p className="font-display text-xl mb-2">La tua rete è ancora vuota</p>
            <p className="text-sm text-[rgb(var(--fg-muted))] max-w-md mx-auto mb-4">
              Condividi il tuo codice con i fornitori della tua rete o con altre wedding planner.
              Più professionisti porti, più cresce il tuo tier e la percentuale guadagnata.
            </p>
            <Button variant="gold" onClick={copyLink}><Copy size={14} /> Copia link invito</Button>
          </section>
        )}

        <p className="text-[10px] text-[rgb(var(--fg-subtle))] text-center mt-6 italic">
          I credit maturati saranno liquidati al raggiungimento di €100, oppure usabili come riduzione su future success-fee.
        </p>

        <div className="text-center mt-4">
          <Link to="/feed" className="text-xs hover:underline" style={{ color: 'rgb(var(--gold-600))' }}>← Torna al feed</Link>
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, accent }: { icon: typeof Gift; label: string; value: number | string; accent: 'gold' | 'emerald' | 'sky' | 'ink' }) {
  const accents = {
    gold: ['rgb(var(--gold-100))', 'rgb(var(--gold-700))'],
    emerald: ['rgb(var(--emerald-100))', 'rgb(var(--emerald-500))'],
    sky: ['rgb(var(--sky-100))', 'rgb(var(--sky-500))'],
    ink: ['rgb(var(--fg))', 'rgb(var(--bg-elev))'],
  } as const
  const [bg, fg] = accents[accent]
  return (
    <div className="surface p-4">
      <Icon size={16} style={{ color: fg, background: bg, padding: 4, borderRadius: 6 }} className="mb-2 inline-block" />
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className="font-display text-2xl tabular-nums mt-1">{value}</p>
    </div>
  )
}

function TierBar({ tier, current, count, threshold, maxThreshold }: { tier: 'BRONZO' | 'ARGENTO' | 'ORO'; current: string; count: number; threshold: number; maxThreshold: number | null }) {
  const meta = TIER_META[tier]
  const reached = count >= threshold
  const isCurrent = current === tier
  const max = maxThreshold ?? (count + 10)
  const pct = Math.min(100, Math.max(0, ((count - threshold) / (max - threshold + 1)) * 100))
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium" style={{ color: reached ? meta.color : 'rgb(var(--fg-muted))' }}>
          {meta.label} ({meta.range})
          {isCurrent && <span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: meta.color }}>· Attuale</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-sunken))' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${reached ? pct : 0}%`, background: meta.color }} />
      </div>
    </div>
  )
}

function RewardCard({ pct, label, copy }: { pct: string; label: string; copy: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'rgb(var(--border))' }}>
      <p className="font-display text-2xl" style={{ color: 'rgb(var(--gold-600))' }}>{pct}</p>
      <p className="text-sm font-medium mt-1">{label}</p>
      <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 leading-relaxed">{copy}</p>
    </div>
  )
}
