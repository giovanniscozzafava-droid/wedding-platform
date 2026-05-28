import { useEffect, useState } from 'react'
import { Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

type Rateable = { user_id: string; role: string; display_name: string }

type Props = {
  entryId: string
  onClose: () => void
}

/**
 * Modale post-evento: lista delle persone che hai collaborato durante il
 * wedding (WP↔fornitori, fornitori↔fornitori, fornitori↔WP). Per ognuna,
 * stelle 1-5 + review opzionale. Si può votare solo dopo date_to.
 */
export function RateCollaborationModal({ entryId, onClose }: Props) {
  const [people, setPeople] = useState<Rateable[]>([])
  const [loading, setLoading] = useState(true)
  const [ratings, setRatings] = useState<Record<string, { stars: number; review: string }>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data, error } = await (supabase as any).rpc('rateable_users_for_entry', { p_entry: entryId })
        if (error) throw error
        setPeople((data as Rateable[]) ?? [])

        // Pre-popola con valutazioni esistenti
        const ids = ((data as Rateable[]) ?? []).map((p) => p.user_id)
        if (ids.length > 0) {
          const { data: existing } = await (supabase.from as any)('collaboration_ratings')
            .select('rated_id, stars, review')
            .eq('entry_id', entryId)
            .in('rated_id', ids)
          const map: typeof ratings = {}
          for (const r of (existing ?? []) as any[]) {
            map[r.rated_id] = { stars: r.stars, review: r.review ?? '' }
          }
          setRatings(map)
        }
      } catch (e) {
        toast.error((e as Error).message)
      } finally { setLoading(false) }
    })()
  }, [entryId])

  function setStars(uid: string, stars: number) {
    setRatings((r) => ({ ...r, [uid]: { stars, review: r[uid]?.review ?? '' } }))
  }
  function setReview(uid: string, review: string) {
    setRatings((r) => ({ ...r, [uid]: { stars: r[uid]?.stars ?? 0, review } }))
  }

  async function saveAll() {
    setSaving(true)
    let saved = 0
    try {
      for (const [uid, r] of Object.entries(ratings)) {
        if (!r.stars) continue
        const { error } = await (supabase as any).rpc('rate_user', {
          p_rated: uid,
          p_entry: entryId,
          p_stars: r.stars,
          p_review: r.review || null,
        })
        if (error) {
          toast.error(`${people.find((p) => p.user_id === uid)?.display_name}: ${error.message}`)
        } else { saved++ }
      }
      if (saved > 0) toast.success(`Salvate ${saved} valutazioni`)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgb(0 0 0 / 0.4)' }} onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: 'rgb(var(--border))' }}>
          <div>
            <h3 className="font-display text-xl">Valuta la collaborazione</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))]">
              Assegna 1-5 stelle a chi ha lavorato con te su questo evento. Le valutazioni sono pubbliche.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && <p className="text-[rgb(var(--fg-subtle))]">Caricamento…</p>}
          {!loading && people.length === 0 && (
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Nessuno da valutare per questo evento. La possibilità si attiva solo dopo la data dell&apos;evento.
            </p>
          )}
          {people.map((p) => {
            const r = ratings[p.user_id]
            return (
              <div key={p.user_id} className="p-3 rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium text-sm">{p.display_name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{p.role.toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setStars(p.user_id, n)}
                        className="p-1 hover:scale-110 transition-transform"
                        aria-label={`${n} stelle`}>
                        <Star size={18}
                          className={n <= (r?.stars ?? 0)
                            ? 'fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))]'
                            : 'text-[rgb(var(--fg-subtle))]'} />
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  rows={2}
                  value={r?.review ?? ''}
                  onChange={(e) => setReview(p.user_id, e.target.value)}
                  placeholder="Una breve recensione (facoltativa): puntualità, comunicazione, qualità del lavoro…"
                  className="text-sm"
                />
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="gold" disabled={saving || Object.values(ratings).every((r) => !r.stars)}
            onClick={() => void saveAll()}>
            {saving ? 'Salvo…' : 'Salva valutazioni'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
