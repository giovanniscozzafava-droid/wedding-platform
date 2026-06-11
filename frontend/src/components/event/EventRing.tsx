import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Heart, Sparkles, UserPlus, Gift } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type RingRole = { role_key: string; label: string; covered: boolean; covered_by: string | null }
type RingState = { roles: RingRole[]; total: number; covered: number; closed: boolean }

// L'anello-a-segmenti che si chiude è RISERVATO al completamento dell'evento (§10.3).
// Niente percentuali, niente numeri: si vede quanto manca, non si legge.

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}
function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const [sx, sy] = polar(cx, cy, r, end)
  const [ex, ey] = polar(cx, cy, r, start)
  const large = end - start <= 180 ? 0 : 1
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`
}

export function EventRing({ entryId, view }: { entryId: string; view: 'capostipite' | 'fornitore' | 'sposi' }) {
  const [ring, setRing] = useState<RingState | null>(null)

  useEffect(() => {
    if (!entryId) return
    void (async () => {
      const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }> })
        .rpc('get_event_ring', { p_entry: entryId })
      const r = data as RingState & { error?: string }
      if (r && !r.error) setRing(r)
    })()
  }, [entryId])

  if (!ring || ring.total === 0) return null

  const N = ring.total
  const size = 168, cx = size / 2, cy = size / 2, r = 70, sw = 12, gap = N > 1 ? 7 : 0
  const seg = 360 / N

  return (
    <div className="surface surface-lift p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        {/* Anello */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size}>
            {ring.roles.map((role, i) => {
              const start = i * seg + gap / 2
              const end = (i + 1) * seg - gap / 2
              return (
                <motion.path key={role.role_key}
                  d={arcPath(cx, cy, r, start, end)}
                  fill="none" strokeWidth={sw} strokeLinecap="round"
                  stroke={role.covered ? 'rgb(var(--gold-500))' : 'rgb(var(--border))'}
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.5 }} />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {ring.closed ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: N * 0.04 }}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                <Heart size={22} className="fill-[rgb(var(--gold-600))]" />
              </motion.span>
            ) : (
              <Heart size={22} style={{ color: 'rgb(var(--fg-subtle))' }} />
            )}
          </div>
        </div>

        {/* Dettaglio / azioni */}
        <div className="flex-1 min-w-0 w-full">
          {ring.closed ? (
            <div className="mb-3">
              <h3 className="font-display text-lg flex items-center gap-2" style={{ color: 'rgb(var(--gold-700))' }}>
                <Sparkles size={18} /> Il cerchio si è chiuso
              </h3>
              <p className="text-sm text-[rgb(var(--fg-muted))]">
                {view === 'sposi' ? 'La tua squadra è al completo.' : 'Una rete, un evento completo.'}
              </p>
            </div>
          ) : (
            <h3 className="font-display text-lg mb-1">
              {view === 'capostipite' ? 'Chiudi il cerchio' : view === 'fornitore' ? 'Il cerchio dell’evento' : 'La squadra si sta formando'}
            </h3>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
            {ring.roles.map((role) => (
              <div key={role.role_key} className="flex items-center gap-2 text-sm">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full shrink-0"
                  style={{ background: role.covered ? 'rgb(var(--gold-500))' : 'rgb(var(--bg-sunken))' }}>
                  {role.covered && <Check size={11} className="text-white" />}
                </span>
                <span className={role.covered ? '' : 'text-[rgb(var(--fg-subtle))]'}>{role.label}</span>
                {role.covered && role.covered_by && view !== 'sposi' && (
                  <span className="text-[11px] text-[rgb(var(--fg-subtle))] truncate">· {role.covered_by}</span>
                )}
                {!role.covered && view === 'capostipite' && (
                  <Link to="/scopri" className="ml-auto text-[11px] text-[rgb(var(--gold-600))] hover:underline inline-flex items-center gap-0.5 shrink-0">
                    <UserPlus size={11} /> invita
                  </Link>
                )}
                {!role.covered && view === 'fornitore' && (
                  <Link to="/scopri" className="ml-auto text-[11px] text-[rgb(var(--gold-600))] hover:underline inline-flex items-center gap-0.5 shrink-0">
                    <Gift size={11} /> suggerisci
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
