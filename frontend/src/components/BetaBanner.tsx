import { useEffect, useState } from 'react'
import { Info, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type BetaStatus = {
  role: string
  is_beta: boolean
  free_until: string | null
  planned_price: number | null
  planned_period: string | null
  message_short: string | null
  message_long: string | null
}

const ROLE_MAP: Record<string, string> = {
  FORNITORE: 'supplier',
  WEDDING_PLANNER: 'wedding_planner',
  LOCATION: 'wedding_planner',
  COUPLE: 'couple',
}

function formatDateIT(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export function BetaBanner() {
  const { profile } = useAuth()
  const [status, setStatus] = useState<BetaStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const roleKey = profile?.role ? ROLE_MAP[profile.role] : null
  const dismissKey = roleKey ? `beta_banner_dismissed_${roleKey}` : null

  useEffect(() => {
    if (!roleKey) return
    if (dismissKey && sessionStorage.getItem(dismissKey) === '1') {
      setDismissed(true)
      return
    }
    let cancelled = false
    supabase
      .from('beta_status')
      .select('role, is_beta, free_until, planned_price, planned_period, message_short, message_long')
      .eq('role', roleKey)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setStatus(data as BetaStatus | null)
      })
    return () => {
      cancelled = true
    }
  }, [roleKey, dismissKey])

  if (!status || !status.is_beta || dismissed || !status.message_short) return null

  function close() {
    if (dismissKey) sessionStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  return (
    <div
      className="relative border-b text-sm"
      style={{
        background: 'linear-gradient(90deg, rgb(var(--gold-100) / 0.6), rgb(var(--rose-100) / 0.5))',
        borderColor: 'rgb(var(--gold-300))',
        color: 'rgb(var(--fg))',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-start gap-3">
        <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'rgb(var(--gold-700))' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
            <span className="font-medium">{status.message_short}</span>
            {status.free_until && (
              <span style={{ color: 'rgb(var(--fg-muted))' }}>
                · Beta gratis fino al <strong>{formatDateIT(status.free_until)}</strong>
              </span>
            )}
            {status.planned_price && (
              <span style={{ color: 'rgb(var(--fg-muted))' }}>
                · poi <strong>€{status.planned_price}/{status.planned_period === 'mensile' ? 'mese' : status.planned_period}</strong>
              </span>
            )}
            {status.message_long && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="underline underline-offset-2 hover:opacity-80"
                style={{ color: 'rgb(var(--gold-700))' }}
              >
                {expanded ? 'meno' : 'scopri di più'}
              </button>
            )}
          </div>
          {expanded && status.message_long && (
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>
              {status.message_long}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Chiudi"
          className="shrink-0 rounded p-1 hover:bg-black/5"
          style={{ color: 'rgb(var(--fg-muted))' }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
