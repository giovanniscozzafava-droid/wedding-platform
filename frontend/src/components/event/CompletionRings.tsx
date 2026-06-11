import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProgressRing } from './ProgressRing'

// Griglia di anelli di completamento (uno per sezione) che si chiudono man mano.
// Click su un anello → apre quella sezione.
type Section = { key: string; label: string; tab: string; value: number; detail?: string }

export function CompletionRings({ entryId, onOpen }: { entryId: string; onOpen?: (tab: string) => void }) {
  const [sections, setSections] = useState<Section[] | null>(null)

  useEffect(() => {
    if (!entryId) return
    void (async () => {
      const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { sections?: Section[]; error?: string } }> })
        .rpc('get_event_completion', { p_entry: entryId })
      if (data && !data.error) setSections(data.sections ?? [])
    })()
  }, [entryId])

  if (!sections || sections.length === 0) return null
  const overall = sections.reduce((s, x) => s + (x.value || 0), 0) / sections.length

  return (
    <div className="surface surface-lift p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg">Completamento evento</h3>
          <p className="text-xs text-[rgb(var(--fg-muted))]">Chiudi gli anelli: ogni sezione si completa man mano.</p>
        </div>
        <span className="text-sm font-semibold text-[rgb(var(--gold-700))]">{Math.round(overall * 100)}%</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-y-4 gap-x-2 justify-items-center">
        {sections.map((s) => (
          <ProgressRing key={s.key} value={s.value} label={s.label} detail={s.detail} onClick={onOpen ? () => onOpen(s.tab) : undefined} />
        ))}
      </div>
    </div>
  )
}
