// A evento passato, lato cliente: un pulsante per ogni professionista che ha caricato
// i suoi link. Il click apre la pagina in una scheda nuova e lo timbra (il pro riceve
// una notifica: «vai a vedere se la recensione è arrivata»).
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, ExternalLink, Check } from '@/components/icons/lucide'
import { supabase } from '@/lib/supabase'

type Pro = {
  id: string; name: string; logo: string | null; color: string | null; subrole: string | null
  google: string | null; matrimonio: string | null
  asked_at: string | null; clicked_google: boolean; clicked_matrimonio: boolean
}
type Targets = { ok: boolean; past: boolean; professionals: Pro[] }
const fmt = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })

export function CoupleReviewCard({ entryId }: { entryId: string }) {
  const qc = useQueryClient()
  const [done, setDone] = useState<Set<string>>(new Set())
  const q = useQuery({
    queryKey: ['couple-review-targets', entryId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('couple_review_targets', { p_entry: entryId })
      if (error) throw error
      return data as Targets
    },
    staleTime: 60_000,
  })
  const pros = q.data?.ok && q.data.past ? q.data.professionals : []
  if (pros.length === 0) return null

  function vai(p: Pro, platform: 'google' | 'matrimonio') {
    const url = platform === 'google' ? p.google : p.matrimonio
    if (!url) return
    window.open(url, '_blank', 'noopener')
    setDone((s) => new Set(s).add(`${p.id}:${platform}`))
    void (supabase as any).rpc('couple_review_click', { p_entry: entryId, p_pro: p.id, p_platform: platform })
      .then(() => qc.invalidateQueries({ queryKey: ['couple-review-targets', entryId] }))
  }

  return (
    <Card className="p-4">
      <p className="text-sm font-medium flex items-center gap-2 mb-1">
        <Star size={16} className="text-[rgb(var(--gold-600))]" /> Com’è andata?
      </p>
      <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
        Due righe sincere aiutano chi ha lavorato al vostro evento più di qualsiasi pubblicità.
      </p>
      <ul className="space-y-2">
        {pros.map((p) => {
          const g = p.clicked_google || done.has(`${p.id}:google`)
          const m = p.clicked_matrimonio || done.has(`${p.id}:matrimonio`)
          return (
            <li key={p.id} className="rounded-lg border border-[rgb(var(--border))] p-3 flex items-center gap-3 flex-wrap">
              <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-sm font-medium text-white"
                style={{ background: p.color ?? 'rgb(var(--gold-600))' }}>
                {p.logo ? <img src={p.logo} alt="" className="h-full w-full object-cover" /> : (p.name || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-[11px] text-[rgb(var(--fg-muted))]">
                  {p.asked_at ? `Vi ha chiesto una recensione il ${fmt(p.asked_at)}` : (p.subrole ?? 'Professionista')}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {p.google && (
                  <Button size="sm" variant={g ? 'subtle' : 'gold'} onClick={() => vai(p, 'google')}>
                    {g ? <Check size={14} className="mr-1.5" /> : <ExternalLink size={14} className="mr-1.5" />}
                    {g ? 'Grazie · Google' : 'Recensisci su Google'}
                  </Button>
                )}
                {p.matrimonio && (
                  <Button size="sm" variant={m ? 'subtle' : 'outline'} onClick={() => vai(p, 'matrimonio')}>
                    {m ? <Check size={14} className="mr-1.5" /> : <ExternalLink size={14} className="mr-1.5" />}
                    {m ? 'Grazie · Matrimonio.com' : 'Recensisci su Matrimonio.com'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
export default CoupleReviewCard
