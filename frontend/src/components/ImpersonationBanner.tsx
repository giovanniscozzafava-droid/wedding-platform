import { useState } from 'react'
import { Eye, LogOut } from 'lucide-react'
import { impersonatedLabel, stopImpersonation } from '@/lib/impersonation'

// Barra sempre visibile quando lo staff sta usando l'app come un altro utente.
export function ImpersonationBanner() {
  const [label] = useState<string | null>(() => impersonatedLabel())
  const [leaving, setLeaving] = useState(false)
  if (!label) return null
  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-3 px-4 py-1.5 text-xs font-medium text-white"
      style={{ background: '#b45309' }}>
      <Eye size={14} />
      <span>Stai usando Planfully come <strong>{label}</strong> (modalità supporto)</span>
      <button onClick={() => { setLeaving(true); void stopImpersonation() }} disabled={leaving}
        className="inline-flex items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 px-2.5 py-0.5">
        <LogOut size={12} /> {leaving ? 'Esco…' : 'Torna al tuo account'}
      </button>
    </div>
  )
}
