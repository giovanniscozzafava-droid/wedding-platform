import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Suggerimento/tutorial richiudibile con "Non mostrarlo più" PERSISTENTE
// per-utente (profiles.dismissed_hints + dismiss_hint). Una volta chiuso così,
// non riappare più per chi l'ha spuntato.
// ============================================================================

const rpc = (fn: string, a: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }> }).rpc(fn, a)

export function useDismissibleHint(key: string) {
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  useEffect(() => {
    void (async () => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) { setDismissed(true); return }
      const { data } = await supabase.from('profiles').select('dismissed_hints').eq('id', me.user.id).maybeSingle()
      const list = ((data as { dismissed_hints?: string[] } | null)?.dismissed_hints) ?? []
      setDismissed(list.includes(key))
    })()
  }, [key])
  async function dismiss() { setDismissed(true); await rpc('dismiss_hint', { p_key: key }) }
  return { dismissed, dismiss }
}

export function DismissibleTip({ hintKey, children, className }: { hintKey: string; children: ReactNode; className?: string }) {
  const { dismissed, dismiss } = useDismissibleHint(hintKey)
  if (dismissed !== false) return null
  return (
    <div className={`relative rounded-xl border p-4 pr-9 ${className ?? ''}`} style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
      <button onClick={() => void dismiss()} aria-label="Chiudi" title="Non mostrarlo più"
        className="absolute top-2 right-2 p-1 rounded text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))]">
        <X size={15} />
      </button>
      <div className="text-sm">{children}</div>
      <div className="mt-2">
        <button onClick={() => void dismiss()} className="text-[11px] text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg-muted))] underline">
          Non mostrarlo più
        </button>
      </div>
    </div>
  )
}
