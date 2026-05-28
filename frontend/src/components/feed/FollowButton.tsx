import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Check, Clock4 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type FollowStatus = 'NONE' | 'PENDING' | 'APPROVED'

type Props = {
  userId: string
  /** Initial state (opzionale) per evitare flash di rete */
  initialStatus?: FollowStatus
  size?: 'sm' | 'default' | 'lg'
  variant?: 'gold' | 'outline'
}

/**
 * Follow asimmetrico:
 *   - WP→fornitore: APPROVED automatico
 *   - fornitore→WP/LOCATION: PENDING fino a approve esplicito
 *   - altri ruoli: APPROVED automatico
 * Logica gestita lato server da request_follow() (security definer).
 */
export function FollowButton({ userId, initialStatus, size = 'sm' as const, variant = 'gold' }: Props) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [status, setStatus] = useState<FollowStatus | null>(initialStatus ?? null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status !== null) return
    if (!user) { setStatus('NONE'); return }
    void (async () => {
      try {
        const { data } = await (supabase.from('follows') as any)
          .select('status')
          .eq('follower_id', user.id)
          .eq('followed_id', userId)
          .maybeSingle()
        setStatus((data?.status as FollowStatus) ?? 'NONE')
      } catch { setStatus('NONE') }
    })()
  }, [userId, user, status])

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { nav('/login'); return }
    if (busy) return
    setBusy(true)
    try {
      const { data, error } = await (supabase as any).rpc('request_follow', { p_target: userId })
      if (error) throw error
      const next = (data?.status ?? 'APPROVED') as FollowStatus
      setStatus(next)
      toast.success(next === 'PENDING' ? 'Richiesta inviata' : 'Ora segui questo profilo')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  async function handleUnfollow(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const { error } = await (supabase.from('follows') as any)
        .delete()
        .eq('follower_id', user!.id)
        .eq('followed_id', userId)
      if (error) throw error
      setStatus('NONE')
      toast.success('Non segui più')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  if (user?.id === userId) return null
  if (status === null) {
    return <Button size={size} variant="outline" disabled className="opacity-60"><UserPlus size={13} /> …</Button>
  }
  if (status === 'PENDING') {
    return <Button size={size} variant="outline" disabled><Clock4 size={13} /> Richiesta in attesa</Button>
  }
  if (status === 'APPROVED') {
    return <Button size={size} variant="outline" onClick={handleUnfollow} disabled={busy}><Check size={13} /> Seguito</Button>
  }
  return <Button size={size} variant={variant} onClick={handleFollow} disabled={busy}><UserPlus size={13} /> Segui</Button>
}
