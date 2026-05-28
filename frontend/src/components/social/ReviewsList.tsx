import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type Review = {
  id: string
  stars: number
  review: string | null
  created_at: string
  rater_id: string
  rater_role: string
  rater_name: string | null
  rater_logo: string | null
  rater_slug: string | null
  entry_title: string | null
}

export function ReviewsList({ userId, limit = 10 }: { userId: string; limit?: number }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data, error } = await (supabase as any).rpc('list_user_reviews', { p_user_id: userId, p_limit: limit })
        if (error) throw error
        setReviews((data as Review[]) ?? [])
      } catch {
        setReviews([])
      } finally { setLoading(false) }
    })()
  }, [userId, limit])

  if (loading) return null
  if (reviews.length === 0) return null

  return (
    <section className="mt-6">
      <h3 className="font-display text-xl mb-3 flex items-center gap-2">
        <Star size={16} className="fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))]" />
        Recensioni della rete
      </h3>
      <div className="space-y-3">
        {reviews.map((r) => {
          const profileLink = r.rater_role === 'WEDDING_PLANNER' || r.rater_role === 'LOCATION'
            ? `/p/wp/${r.rater_slug ?? ''}`
            : `/p/fornitore/${r.rater_slug ?? ''}`
          return (
            <Card key={r.id} className="p-4">
              <header className="flex items-center gap-3 mb-2">
                {r.rater_logo ? (
                  <img src={r.rater_logo} className="h-8 w-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                    {(r.rater_name ?? '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {r.rater_slug ? (
                    <Link to={profileLink} className="text-sm font-medium hover:underline">{r.rater_name}</Link>
                  ) : (
                    <p className="text-sm font-medium">{r.rater_name}</p>
                  )}
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{r.rater_role.toLowerCase()}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={12}
                      className={n <= r.stars
                        ? 'fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))]'
                        : 'text-[rgb(var(--fg-subtle))]'} />
                  ))}
                </div>
              </header>
              {r.review && <p className="text-sm text-[rgb(var(--fg))] italic">"{r.review}"</p>}
              {r.entry_title && (
                <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">— {r.entry_title}</p>
              )}
            </Card>
          )
        })}
      </div>
    </section>
  )
}
