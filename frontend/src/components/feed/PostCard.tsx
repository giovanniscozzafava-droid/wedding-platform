import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Globe, Users as UsersIcon, Lock, Send, MoreHorizontal, Trash2, Share2, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export type FeedPost = {
  id: string
  author_id: string
  author_name: string | null
  author_business: string | null
  author_slug: string | null
  author_role: string
  author_logo: string | null
  author_subrole: string | null
  body: string
  media_urls: string[]
  tagged_supplier_ids: string[]
  visibility: 'PUBLIC' | 'NETWORK' | 'FOLLOWERS'
  like_count: number
  comment_count: number
  created_at: string
  liked_by_me: boolean
  event_id: string | null
  event_title: string | null
  post_type?: 'SHORT' | 'ARTICLE'
  title?: string | null
  cover_image_url?: string | null
  body_html?: string | null
  slug?: string | null
  link_url?: string | null
  link_preview?: { url?: string; title?: string | null; description?: string | null; image?: string | null; site_name?: string | null } | null
}

type Comment = {
  id: string
  body: string
  created_at: string
  author_id: string
  author_name: string | null
  author_business: string | null
  author_slug: string | null
  author_logo: string | null
  author_role: string
}

export function PostCard({ post, onChanged }: { post: FeedPost; onChanged?: () => void }) {
  const { user, profile } = useAuth()
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [liking, setLiking] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)

  // Link pubblico del post + testo per la condivisione social.
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://planfully.it'}/feed/post/${post.slug ?? post.id}`
  const shareText = post.title ? `${post.title} — su Planfully` : `Guarda questo lavoro su Planfully`
  function shareTo(network: 'whatsapp' | 'facebook' | 'x' | 'linkedin') {
    const u = encodeURIComponent(shareUrl); const t = encodeURIComponent(shareText)
    const map: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    }
    window.open(map[network], '_blank', 'noopener,width=600,height=600')
    setShareOpen(false)
  }
  async function copyShareLink() {
    try { await navigator.clipboard.writeText(shareUrl); toast.success('Link copiato') }
    catch { toast.error('Impossibile copiare') }
    setShareOpen(false)
  }

  async function deletePost() {
    if (!confirm('Eliminare definitivamente questo post? L\'azione non è reversibile.')) return
    try {
      const { error } = await (supabase as unknown as { from: (t: string) => { delete: () => { eq: (k: string, v: string) => Promise<{ error: Error | null }> } } })
        .from('posts').delete().eq('id', post.id)
      if (error) throw error
      setDeleted(true)
      toast.success('Post eliminato')
      onChanged?.()
    } catch (e) { toast.error((e as Error).message) }
  }

  async function toggleLike() {
    if (!user) { toast.info('Accedi per mettere like'); return }
    if (liking) return // guard anti doppio-click: niente toggle concorrenti
    setLiking(true)
    const prevLiked = liked
    const prevCount = likeCount
    const nextLiked = !prevLiked
    setLiked(nextLiked)
    setLikeCount((c) => c + (nextLiked ? 1 : -1))
    try {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('post_toggle_like', { p_post_id: post.id })
      if (error) throw error
      const r = data as { liked?: boolean; error?: string }
      if (r.error) throw new Error(r.error === 'forbidden' ? 'Non puoi interagire con questo post' : r.error === 'auth_required' ? 'Accedi per mettere like' : r.error)
      // Riconcilia col server: se non concorda con l'ottimistico, correggi anche il conteggio.
      if (typeof r.liked === 'boolean' && r.liked !== nextLiked) {
        setLiked(r.liked)
        setLikeCount((c) => c + (r.liked ? 1 : -1) - (nextLiked ? 1 : -1))
      }
    } catch (e) {
      setLiked(prevLiked)
      setLikeCount(prevCount)
      toast.error((e as Error).message)
    } finally {
      setLiking(false)
    }
  }

  async function loadComments() {
    if (loadingComments) return
    setLoadingComments(true)
    try {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('post_comments_list', { p_post_id: post.id })
      if (error) throw error
      setComments((data as Comment[]) ?? [])
    } catch (e) { toast.error((e as Error).message) }
    finally { setLoadingComments(false) }
  }

  useEffect(() => {
    if (showComments && comments.length === 0) void loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComments])

  async function submitComment() {
    if (!user || !newComment.trim()) return
    setSubmittingComment(true)
    try {
      const { error } = await (supabase as unknown as { from: (t: string) => { insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }> } })
        .from('post_comments').insert({ post_id: post.id, author_id: user.id, body: newComment.trim() })
      if (error) throw error
      setNewComment('')
      await loadComments()
      onChanged?.()
    } catch (e) { toast.error((e as Error).message) }
    finally { setSubmittingComment(false) }
  }

  const authorName = post.author_business ?? post.author_name ?? 'Utente'
  const authorHref = post.author_slug
    ? (post.author_role === 'FORNITORE' ? `/p/fornitore/${post.author_slug}` : `/p/wp/${post.author_slug}`)
    : null
  const VisIcon = post.visibility === 'PUBLIC' ? Globe : post.visibility === 'NETWORK' ? UsersIcon : Lock

  if (deleted) return null

  return (
    <motion.article initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="surface surface-elev overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {post.author_logo ? (
          authorHref
            ? <Link to={authorHref}><img src={post.author_logo} alt="" className="w-10 h-10 rounded-full object-cover" /></Link>
            : <img src={post.author_logo} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm"
            style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
            {authorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {authorHref ? <Link to={authorHref} className="hover:underline">{authorName}</Link> : authorName}
            <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--gold-600))] ml-2">
              {post.author_role === 'WEDDING_PLANNER' ? 'Wedding Planner' : post.author_role === 'LOCATION' ? 'Location' : post.author_subrole ?? 'Fornitore'}
            </span>
          </p>
          <p className="text-[10px] text-[rgb(var(--fg-subtle))] flex items-center gap-1 mt-0.5">
            {timeAgo(post.created_at)}
            <span>·</span>
            <VisIcon size={10} />
            <span>{post.visibility === 'PUBLIC' ? 'Pubblico' : post.visibility === 'NETWORK' ? 'Network' : 'Follower'}</span>
          </p>
        </div>
        {post.author_id === user?.id && (
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)}
              className="rounded p-1 hover:bg-[rgb(var(--bg-sunken))]" title="Opzioni">
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 surface surface-lift z-20 min-w-[160px] py-1">
                  <button onClick={() => { setMenuOpen(false); void deletePost() }}
                    className="w-full text-left px-3 py-2 text-sm text-[rgb(var(--rose-500))] hover:bg-[rgb(var(--rose-100))] inline-flex items-center gap-2">
                    <Trash2 size={13} /> Elimina post
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Body — articolo o post normale */}
      {post.post_type === 'ARTICLE' && post.title ? (
        <Link to={`/feed/post/${post.slug ?? post.id}`} className="block">
          {post.cover_image_url && (
            <img src={post.cover_image_url} alt="" className="w-full aspect-[21/9] object-cover" loading="lazy" />
          )}
          <div className="px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'rgb(var(--gold-600))' }}>
              Articolo · Lettura
            </p>
            <h2 className="font-display text-xl sm:text-2xl leading-tight mb-2 hover:underline">{post.title}</h2>
            {post.body && (
              <p className="text-sm text-[rgb(var(--fg-muted))] line-clamp-3 leading-relaxed">{post.body}</p>
            )}
            <p className="text-xs font-medium mt-3" style={{ color: 'rgb(var(--gold-600))' }}>Leggi l'articolo →</p>
          </div>
        </Link>
      ) : (
        post.body && (
          <div className="px-4 pb-3">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.body}</p>
          </div>
        )
      )}

      {/* Event link — /weddings/:id non è accessibile a coppia/cliente: per quei
          ruoli mostro il chip non cliccabile (niente redirect a vuoto). */}
      {post.event_id && post.event_title && (
        <div className="px-4 pb-3">
          {profile?.role === 'COUPLE' || profile?.role === 'CLIENT' ? (
            <span className="inline-block text-xs px-2 py-1 rounded-full"
              style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
              📅 {post.event_title}
            </span>
          ) : (
            <Link to={`/weddings/${post.event_id}`}
              className="inline-block text-xs px-2 py-1 rounded-full hover:underline"
              style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
              📅 {post.event_title}
            </Link>
          )}
        </div>
      )}

      {/* Link preview unfurled */}
      {post.link_preview && post.link_url && post.post_type !== 'ARTICLE' && (
        <a href={post.link_url} target="_blank" rel="noopener noreferrer"
          className="block mx-4 mb-3 surface surface-elev overflow-hidden hover:surface-lift transition-all">
          {post.link_preview.image && (
            <img src={post.link_preview.image} alt={post.link_preview.title ?? post.link_preview.site_name ?? 'Anteprima link'}
              loading="lazy" className="w-full aspect-[1.91/1] object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          )}
          <div className="p-3">
            {post.link_preview.site_name && (
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-0.5 truncate">{post.link_preview.site_name}</p>
            )}
            <p className="text-sm font-medium line-clamp-2">{post.link_preview.title ?? post.link_url}</p>
            {post.link_preview.description && (
              <p className="text-xs text-[rgb(var(--fg-muted))] line-clamp-2 mt-1">{post.link_preview.description}</p>
            )}
          </div>
        </a>
      )}

      {/* Media carousel — solo per post SHORT (l'articolo ha già la cover) */}
      {post.post_type !== 'ARTICLE' && post.media_urls.length > 0 && (
        <div className="relative bg-[rgb(var(--bg-sunken))]">
          <img src={post.media_urls[carouselIdx]!}
            alt={`Foto di ${post.author_business ?? post.author_name ?? 'un professionista'}`}
            loading="lazy" className="w-full max-h-[600px] object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2' }} />
          {post.media_urls.length > 1 && (
            <>
              <div className="absolute inset-y-0 left-0 flex items-center">
                {carouselIdx > 0 && (
                  <button onClick={() => setCarouselIdx((i) => i - 1)}
                    className="bg-black/40 text-white rounded-full w-8 h-8 ml-2 hover:bg-black/60">‹</button>
                )}
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                {carouselIdx < post.media_urls.length - 1 && (
                  <button onClick={() => setCarouselIdx((i) => i + 1)}
                    className="bg-black/40 text-white rounded-full w-8 h-8 mr-2 hover:bg-black/60">›</button>
                )}
              </div>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {post.media_urls.map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full transition-colors"
                    style={{ background: i === carouselIdx ? 'white' : 'rgba(255,255,255,0.5)' }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Counts */}
      {(likeCount > 0 || post.comment_count > 0) && (
        <div className="px-4 py-2 text-xs text-[rgb(var(--fg-muted))] flex items-center gap-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
          {likeCount > 0 && <span>{likeCount} {likeCount === 1 ? 'mi piace' : 'piaciuti'}</span>}
          {post.comment_count > 0 && <button onClick={() => setShowComments(true)} className="hover:underline">{post.comment_count} commenti</button>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center px-2 py-1 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
        <button onClick={toggleLike}
          className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-md hover:bg-[rgb(var(--bg-sunken))] transition-colors">
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} style={{ color: liked ? 'rgb(var(--rose-500))' : 'rgb(var(--fg-muted))' }} />
          <span className="text-sm" style={{ color: liked ? 'rgb(var(--rose-500))' : 'rgb(var(--fg-muted))' }}>
            {liked ? 'Ti piace' : 'Mi piace'}
          </span>
        </button>
        <button onClick={() => setShowComments((v) => !v)}
          className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-md hover:bg-[rgb(var(--bg-sunken))] transition-colors">
          <MessageCircle size={16} className="text-[rgb(var(--fg-muted))]" />
          <span className="text-sm text-[rgb(var(--fg-muted))]">Commenta</span>
        </button>
        <div className="relative flex-1">
          <button onClick={() => setShareOpen((v) => !v)}
            className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-md hover:bg-[rgb(var(--bg-sunken))] transition-colors">
            <Share2 size={16} className="text-[rgb(var(--fg-muted))]" />
            <span className="text-sm text-[rgb(var(--fg-muted))]">Condividi</span>
          </button>
          {shareOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />
              <div className="absolute z-50 bottom-full mb-1 right-0 w-52 rounded-lg border shadow-lg py-1"
                style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--border))' }}>
                <ShareItem icon={<MessageCircle size={15} style={{ color: '#25D366' }} />} label="WhatsApp" onClick={() => shareTo('whatsapp')} />
                <ShareItem icon={<span className="text-sm font-bold" style={{ color: '#1877F2' }}>f</span>} label="Facebook" onClick={() => shareTo('facebook')} />
                <ShareItem icon={<span className="text-sm font-bold">𝕏</span>} label="X (Twitter)" onClick={() => shareTo('x')} />
                <ShareItem icon={<span className="text-[11px] font-bold" style={{ color: '#0A66C2' }}>in</span>} label="LinkedIn" onClick={() => shareTo('linkedin')} />
                <div className="my-1 border-t" style={{ borderColor: 'rgb(var(--border))' }} />
                <ShareItem icon={<Link2 size={15} className="text-[rgb(var(--fg-muted))]" />} label="Copia link" onClick={copyShareLink} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="border-t overflow-hidden" style={{ borderColor: 'rgb(var(--border))' }}>
            {/* Lista */}
            <div className="px-4 py-3 space-y-3 max-h-96 overflow-auto">
              {loadingComments && <p className="text-xs text-[rgb(var(--fg-subtle))]">Caricamento...</p>}
              {!loadingComments && comments.length === 0 && (
                <p className="text-xs text-[rgb(var(--fg-subtle))] text-center py-4">Nessun commento ancora. Sii il primo.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  {c.author_logo ? (
                    <img src={c.author_logo} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-display shrink-0"
                      style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                      {(c.author_business ?? c.author_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="rounded-2xl px-3 py-2" style={{ background: 'rgb(var(--bg-sunken))' }}>
                      <p className="text-xs font-medium">{c.author_business ?? c.author_name}</p>
                      <p className="text-sm leading-snug">{c.body}</p>
                    </div>
                    <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-0.5 ml-3">{timeAgo(c.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Form */}
            {user && (
              <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
                {profile?.brand_logo_url ? (
                  <img src={profile.brand_logo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-display"
                    style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                    {(profile?.business_name ?? profile?.full_name ?? '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Scrivi un commento..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
                  className="flex-1 h-9 px-3 rounded-full border text-sm bg-[rgb(var(--bg-elev))]"
                  style={{ borderColor: 'rgb(var(--border))' }} />
                <Button variant="gold" size="icon" onClick={submitComment}
                  disabled={!newComment.trim() || submittingComment}>
                  <Send size={14} />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

function timeAgo(iso: string): string {
  try {
    const now = Date.now()
    const t = new Date(iso).getTime()
    const diff = Math.max(0, Math.round((now - t) / 1000))
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff/60)}m`
    if (diff < 86400) return `${Math.floor(diff/3600)}h`
    if (diff < 604800) return `${Math.floor(diff/86400)}g`
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  } catch { return iso }
}

function ShareItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[rgb(var(--bg-sunken))] text-left">
      <span className="w-4 flex items-center justify-center">{icon}</span>
      {label}
    </button>
  )
}
