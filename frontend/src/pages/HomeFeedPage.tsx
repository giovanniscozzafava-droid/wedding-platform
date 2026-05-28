import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PostComposer } from '@/components/feed/PostComposer'
import { PostCard, type FeedPost } from '@/components/feed/PostCard'

type FilterTab = 'DISCOVER' | 'ALL' | 'NETWORK' | 'FOLLOWING' | 'MINE'

const TABS: { v: FilterTab; l: string }[] = [
  { v: 'DISCOVER',  l: '✨ Scopri' },
  { v: 'NETWORK',   l: 'La mia rete' },
  { v: 'FOLLOWING', l: 'Chi seguo' },
  { v: 'ALL',       l: 'Tutto' },
  { v: 'MINE',      l: 'I miei post' },
]

export default function HomeFeedPage() {
  const { profile } = useAuth()
  const [filter, setFilter] = useState<FilterTab>('DISCOVER')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const canPost = !!profile?.role && ['WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'FORNITORE', 'COUPLE'].includes(profile.role)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const rpcCall = filter === 'DISCOVER'
        ? (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
            .rpc('feed_discover_trending', { p_limit: 30, p_offset: 0 })
        : (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
            .rpc('feed_home', { p_limit: 30, p_offset: 0, p_filter: filter })
      const { data, error } = await rpcCall
      if (error) throw error
      setPosts((data as FeedPost[]) ?? [])
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    await load(true)
  }

  return (
    <div className="min-h-full" style={{ background: 'rgb(var(--bg))' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Il feed del network</h1>
            <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
              {filter === 'DISCOVER'
                ? 'Lavori più visti del momento. Più engagement = più visibilità.'
                : 'Cosa stanno realizzando i professionisti italiani degli eventi.'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={refreshing} title="Aggiorna">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.v} onClick={() => setFilter(t.v)}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
              style={{
                background: filter === t.v ? 'rgb(var(--fg))' : 'rgb(var(--bg-sunken))',
                color: filter === t.v ? 'rgb(var(--bg-elev))' : 'rgb(var(--fg-muted))',
              }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Composer */}
        {canPost && <PostComposer onPosted={() => void load(true)} />}

        {/* Feed */}
        {loading && (
          <div className="text-center py-10 text-sm text-[rgb(var(--fg-muted))]">Caricamento...</div>
        )}

        {!loading && posts.length === 0 && (
          <div className="surface p-10 text-center">
            <Sparkles className="mx-auto mb-3 opacity-40" size={32} />
            <p className="font-display text-xl mb-2">Il feed è ancora vuoto</p>
            <p className="text-sm text-[rgb(var(--fg-muted))] max-w-md mx-auto">
              {filter === 'MINE'
                ? 'Non hai ancora pubblicato nulla. Inizia con un evento recente.'
                : filter === 'FOLLOWING'
                ? 'Non segui ancora nessuno. Scopri i professionisti.'
                : filter === 'NETWORK'
                ? 'La tua rete non ha ancora postato. Invita più professionisti.'
                : filter === 'DISCOVER'
                ? 'Nessun post di tendenza al momento. Torna più tardi o sii tu il primo a pubblicare.'
                : 'Sii tu il primo a pubblicare qualcosa.'}
            </p>
            {filter === 'FOLLOWING' && (
              <Link to="/scopri"><Button variant="gold" size="sm" className="mt-4">Scopri professionisti</Button></Link>
            )}
          </div>
        )}

        <div className="space-y-5">
          {posts.map((p) => <PostCard key={p.id} post={p} onChanged={() => void load(true)} />)}
        </div>
      </div>
    </div>
  )
}
