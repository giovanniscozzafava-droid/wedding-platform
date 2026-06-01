import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Send, CheckCircle2, FileSignature, Trophy, Flame } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Funnel lead-generation: percentuali motivazionali per il professionista.
// Lead → Inviati → Accettati → Contratti. Pensato per essere "stimolante":
// microcopy che cambia in base alla performance, valore vinto, momentum 30gg.
// ============================================================================

type Metrics = {
  leads: number; quotes_sent: number; quotes_accepted: number; quotes_rejected: number
  contracts_signed: number; accepted_value: number; avg_accepted_value: number
  acceptance_rate: number | null; send_rate: number | null; contract_rate: number | null
  won_last_30d: number; sent_last_30d: number
}

const fmtEuro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

function encouragement(m: Metrics): { tone: 'great' | 'good' | 'start'; text: string } {
  if (m.quotes_sent === 0) {
    return { tone: 'start', text: 'Invia il tuo primo preventivo per iniziare a costruire il tuo tasso di successo.' }
  }
  const ar = m.acceptance_rate ?? 0
  if (ar >= 60) return { tone: 'great', text: `Stai convertendo ${ar}% dei preventivi: sei nella fascia alta. Continua così!` }
  if (ar >= 35) return { tone: 'good', text: `${ar}% di accettazione: buon ritmo. Cura i follow-up per spingerlo oltre il 50%.` }
  return { tone: 'start', text: `${ar}% di accettazione: c'è margine. Risposte rapide e preventivi chiari alzano molto il tasso.` }
}

export function FunnelMetrics() {
  const [m, setM] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: unknown }> }).rpc('professional_funnel_metrics')
        const r = data as (Metrics & { ok?: boolean; error?: string }) | null
        if (r && !r.error) setM(r)
      } finally { setLoading(false) }
    })()
  }, [])

  if (loading || !m) return null

  const enc = encouragement(m)
  const toneColor = enc.tone === 'great' ? '#16a34a' : enc.tone === 'good' ? '#d97706' : '#6366f1'

  const steps = [
    { key: 'leads', label: 'Lead ricevuti', value: m.leads, icon: TrendingUp, pct: null as number | null },
    { key: 'sent', label: 'Preventivi inviati', value: m.quotes_sent, icon: Send, pct: m.send_rate },
    { key: 'accepted', label: 'Accettati', value: m.quotes_accepted, icon: CheckCircle2, pct: m.acceptance_rate },
    { key: 'contracts', label: 'Contratti firmati', value: m.contracts_signed, icon: FileSignature, pct: m.contract_rate },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
          <Trophy size={17} className="text-[rgb(var(--gold-500))]" />
          <h3 className="font-display text-lg">Il tuo funnel</h3>
          {m.won_last_30d > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: '#16a34a', background: '#16a34a1a' }}>
              <Flame size={13} /> {m.won_last_30d} vinti negli ultimi 30 giorni
            </span>
          )}
        </div>

        <div className="p-6">
          {/* Step funnel con percentuali di passaggio */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {steps.map((s, i) => (
              <div key={s.key} className="relative">
                <div className="rounded-xl border p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                  <s.icon size={16} className="text-[rgb(var(--fg-muted))] mb-2" />
                  <div className="text-2xl font-semibold leading-none">{s.value}</div>
                  <div className="text-xs text-[rgb(var(--fg-muted))] mt-1">{s.label}</div>
                  {s.pct !== null && (
                    <div className="mt-2 text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ color: '#6366f1', background: '#6366f11a' }}>
                      {Math.min(100, s.pct)}% {i === 1 ? 'dei lead' : i === 2 ? 'degli inviati' : i === 3 ? 'degli accettati' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Riga valore + media */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-sunken))' }}>
              <div className="text-xs text-[rgb(var(--fg-muted))]">Valore vinto (accettati)</div>
              <div className="text-xl font-semibold mt-0.5">{fmtEuro(m.accepted_value)}</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-sunken))' }}>
              <div className="text-xs text-[rgb(var(--fg-muted))]">Valore medio per preventivo accettato</div>
              <div className="text-xl font-semibold mt-0.5">{fmtEuro(m.avg_accepted_value)}</div>
            </div>
          </div>

          {/* Messaggio motivazionale */}
          <div className="mt-4 rounded-xl p-3.5 text-sm flex items-start gap-2" style={{ background: `${toneColor}12`, color: toneColor }}>
            <Trophy size={16} className="mt-0.5 shrink-0" />
            <span style={{ color: 'rgb(var(--fg))' }}>{enc.text}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
