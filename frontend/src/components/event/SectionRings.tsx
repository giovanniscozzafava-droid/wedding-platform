import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProgressRing } from './ProgressRing'

// Anello/i di completamento della SINGOLA sezione, da mettere in cima alla schermata
// di quella sezione (Invitati → invitati, Conferme → conferme, Tavoli → tavoli...).
type Section = { key: string; label: string; tab: string; value: number; detail?: string }

export function SectionRings({ entryId, keys }: { entryId: string; keys: string[] }) {
  const [sections, setSections] = useState<Section[] | null>(null)

  useEffect(() => {
    if (!entryId) return
    void (async () => {
      const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { sections?: Section[]; error?: string } }> })
        .rpc('get_event_completion', { p_entry: entryId })
      if (data && !data.error) setSections(data.sections ?? [])
    })()
  }, [entryId])

  if (!sections) return null
  const show = keys.map((k) => sections.find((s) => s.key === k)).filter((s): s is Section => !!s)
  if (show.length === 0) return null

  return (
    <div className="surface p-4 mb-5 flex items-center gap-6 flex-wrap">
      {show.map((s) => (
        <ProgressRing key={s.key} value={s.value} label={s.label} detail={s.detail} size={64} stroke={8} />
      ))}
      <p className="text-xs text-[rgb(var(--fg-muted))] max-w-[14rem]">Completa questa sezione: l'anello si chiude man mano.</p>
    </div>
  )
}
