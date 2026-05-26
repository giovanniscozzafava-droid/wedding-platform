import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Props = {
  userId: string
  /** Initial state (opzionale) per evitare flash di rete */
  initialFollowing?: boolean
  size?: 'sm' | 'default' | 'lg'
  variant?: 'gold' | 'outline'
}

export function FollowButton({ userId, initialFollowing, size = 'sm' as const, variant = 'gold' }: Props) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [following, setFollowing] = useState<boolean | null>(initialFollowing ?? null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (following !== null) return
    if (!user) { setFollowing(false); return }
    void (async () => {
      try {
        const { data } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> })
          .rpc('follow_stats', { p_user_id: userId })
        const s = data as { is_following?: boolean }
        setFollowing(!!s?.is_following)
      } catch { setFollowing(false) }
    })()
  }, [userId, user, following])

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { nav('/login'); return }
    if (busy || following === null) return
    setBusy(true)
    setFollowing((v) => !v)
    try {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('toggle_follow', { p_followed_id: userId })
      if (error) throw error
      const r = data as { following?: boolean; error?: string }
      if (r.error === 'cannot_follow_self') { toast.error('Non puoi seguire te stesso'); setFollowing(false); return }
      if (typeof r.following === 'boolean') setFollowing(r.following)
    } catch (e) {
      setFollowing((v) => !v)
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (user?.id === userId) return null

  if (following === null) {
    return (
      <Button size={size} variant="outline" disabled>
        <UserPlus size={13} /> Segui
      </Button>
    )
  }

  if (following) {
    return (
      <Button size={size} variant="outline" onClick={toggle} disabled={busy}>
        <Check size={13} /> Seguito
      </Button>
    )
  }

  return (
    <Button size={size} variant={variant} onClick={toggle} disabled={busy}>
      <UserPlus size={13} /> Segui
    </Button>
  )
}
