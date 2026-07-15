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

export function BetaBanner() {
  const { profile } = useAuth()
  const [status, setStatus] = useState<BetaStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // I capostipiti (wedding planner / location) sono SEMPRE gratis: non vedono la
  // dicitura "gratis fino a…". La vedono solo i NON capostipiti (es. fornitori).
  const isCapostipite = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION'
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

  if (isCapostipite) return null
  if (!status || !status.is_beta || dismissed || !status.message_short) return null

  function close() {
    if (dismissKey) sessionStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  return (
    <div
      className="relative border-b text-sm"
      style={{
        background: 'rgb(var(--gold-100))',
        borderColor: 'rgb(var(--gold-300))',
        color: 'rgb(var(--fg))',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-start gap-3">
        <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'rgb(var(--gold-700))' }} />
        <div className="flex-1 min-w-0">
          <span className="font-medium">Beta gratuita per i professionisti fino al 31 dicembre 2026</span>
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
