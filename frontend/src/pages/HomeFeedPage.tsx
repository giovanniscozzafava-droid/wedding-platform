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
  { v: 'DISCOVER',  l: 'Scopri' },
  { v: 'NETWORK',   l: 'La mia rete' },
  { v: 'FOLLOWING', l: 'Chi seguo' },
  { v: 'ALL',       l: 'Tutto' },
  { v: 'MINE',      l: 'I miei post' },
]

const PAGE = 20

export default function HomeFeedPage() {
  const { profile } = useAuth()
  const [filter, setFilter] = useState<FilterTab>('DISCOVER')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const canPost = !!profile?.role && ['WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'FORNITORE', 'COUPLE'].includes(profile.role)

  const fetchPage = useCallback(async (offset: number) => {
    // NB: chiamare .rpc come METODO (niente destrutturazione: perderebbe `this`
    // del client supabase → "Cannot read properties of undefined (reading 'rest')").
    const sb = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }
    const { data, error } = filter === 'DISCOVER'
      ? await sb.rpc('feed_discover_trending', { p_limit: PAGE, p_offset: offset })
      : await sb.rpc('feed_home', { p_limit: PAGE, p_offset: offset, p_filter: filter })
    if (error) throw error
    return (data as FeedPost[]) ?? []
  }, [filter])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const batch = await fetchPage(0)
      setPosts(batch)
      setHasMore(batch.length === PAGE)
    } catch (e) {
      setError((e as Error)?.message ?? 'Impossibile caricare il feed')
      if (!silent) setPosts([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchPage])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const batch = await fetchPage(posts.length)
      // Dedup difensivo (l'ordinamento trending può spostare elementi tra pagine).
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...batch.filter((p) => !seen.has(p.id))]
      })
      setHasMore(batch.length === PAGE)
    } catch (e) {
      setError((e as Error)?.message ?? 'Errore nel caricare altri post')
    } finally {
      setLoadingMore(false)
    }
  }

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

        {/* Errore di rete */}
        {error && !loading && (
          <div className="surface p-4 mb-4 text-center">
            <p className="text-sm text-[rgb(var(--rose-500))] mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw size={14} /> Riprova
            </Button>
          </div>
        )}

        {/* Feed */}
        {loading && (
          <div className="space-y-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="skeleton h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-2 w-1/4" /></div>
                </div>
                <div className="skeleton h-3 w-full mb-2" />
                <div className="skeleton h-40 w-full rounded-lg" />
              </div>
            ))}
          </div>
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

        {!loading && hasMore && (
          <div className="text-center mt-6">
            <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Carico…' : 'Carica altri'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
