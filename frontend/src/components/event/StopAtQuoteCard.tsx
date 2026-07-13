import { useState } from 'react'
import { toast } from 'sonner'
import { FileCheck2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

// Profilo → "Mi fermo alla firma del preventivo": molti pro non usano il contratto.
// È un default: si può comunque generare un contratto per il singolo preventivo.
export function StopAtQuoteCard() {
  const { user, profile, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const on = !!(profile as { default_stop_at_quote?: boolean } | null)?.default_stop_at_quote

  async function toggle() {
    if (!user || busy) return
    setBusy(true)
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ default_stop_at_quote: !on }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Impostazione salvata')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg mb-1 flex items-center gap-2">
            <FileCheck2 size={18} className="text-[rgb(var(--gold-600))]" /> Contratto
          </h3>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            Mi fermo alla <strong>firma del preventivo</strong>: per me il preventivo firmato è l’accordo,
            di norma non genero il contratto. Potrai comunque generarlo sul singolo preventivo quando serve.
          </p>
        </div>
        <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={() => void toggle()}
          className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60"
          style={{ background: on ? 'rgb(var(--gold-600))' : 'rgb(var(--border-strong))' }}>
          <span className="inline-block h-5 w-5 transform rounded-full bg-white transition"
            style={{ transform: on ? 'translateX(22px)' : 'translateX(4px)' }} />
        </button>
      </div>
    </Card>
  )
}
export default StopAtQuoteCard
