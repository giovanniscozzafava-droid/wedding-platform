import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Props = {
  userId: string
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
}

/** Badge media stelle pubblica per un profilo (legge user_rating_summary). */
export function StarsBadge({ userId, size = 'sm', showCount = true }: Props) {
  const [avg, setAvg] = useState<number | null>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from('user_rating_summary') as any)
        .select('avg_stars, ratings_count')
        .eq('user_id', userId)
        .maybeSingle()
      if (data) {
        setAvg(Number(data.avg_stars))
        setCount(Number(data.ratings_count))
      }
    })()
  }, [userId])

  if (avg === null || count === 0) return null

  const px = size === 'sm' ? 12 : size === 'md' ? 16 : 20
  const text = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'

  return (
    <span className={`inline-flex items-center gap-1 ${text}`}
      title={`${avg.toFixed(2)} stelle medie su ${count} ${count === 1 ? 'recensione' : 'recensioni'}`}>
      <Star size={px} className="fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))]" />
      <strong className="tabular-nums">{avg.toFixed(1)}</strong>
      {showCount && <span className="text-[rgb(var(--fg-subtle))]">({count})</span>}
    </span>
  )
}
