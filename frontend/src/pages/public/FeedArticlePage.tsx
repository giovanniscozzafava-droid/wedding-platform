import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { ArrowLeft, Heart, MessageCircle, Share2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Article = {
  id: string
  slug: string
  title: string
  body_html: string
  cover_image_url: string | null
  tagged_supplier_ids: string[]
  visibility: string
  like_count: number
  comment_count: number
  created_at: string
  updated_at: string
  author: {
    id: string
    slug: string | null
    full_name: string | null
    business_name: string | null
    brand_logo_url: string | null
    role: 'WEDDING_PLANNER' | 'LOCATION' | 'FORNITORE' | 'ADMIN'
    subrole: string | null
    city: string | null
    tagline: string | null
  }
}

export default function FeedArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const nav = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  useEffect(() => {
    if (!slug) return
    void (async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('get_feed_article_by_slug', { p_slug: slug })
        if (error) throw error
        if (!data) { setNotFound(true); return }
        const a = data as Article
        setArticle(a)
        setLikeCount(a.like_count)
        // Verifica se liked
        if (user) {
          const { data: lk } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } } })
            .from('post_likes').select('user_id').eq('post_id', a.id).eq('user_id', user.id).maybeSingle()
          setLiked(!!lk)
        }
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    })()
  }, [slug, user])

  async function toggleLike() {
    if (!article) return
    if (!user) { toast.info('Accedi per mettere like'); return }
    setLiked((v) => !v)
    setLikeCount((c) => liked ? c - 1 : c + 1)
    try {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('post_toggle_like', { p_post_id: article.id })
      if (error) throw error
      const r = data as { liked?: boolean }
      if (typeof r.liked === 'boolean') setLiked(r.liked)
    } catch (e) {
      setLiked(!liked); setLikeCount(article.like_count)
      toast.error((e as Error).message)
    }
  }

  function share() {
    const url = window.location.href
    if (navigator.share) navigator.share({ title: article?.title, url }).catch(() => {})
    else { navigator.clipboard.writeText(url); toast.success('Link copiato') }
  }

  if (loading) return <Centered>Caricamento…</Centered>
  if (notFound || !article) return (
    <Centered>
      <p className="font-display text-2xl mb-2">Articolo non trovato</p>
      <Link to="/feed" className="text-sm hover:underline" style={{ color: 'rgb(var(--gold-600))' }}>← Torna al feed</Link>
    </Centered>
  )

  const authorName = article.author.business_name ?? article.author.full_name ?? 'Autore'
  const authorHref = article.author.slug
    ? (article.author.role === 'FORNITORE' ? `/p/fornitore/${article.author.slug}` : `/p/wp/${article.author.slug}`)
    : null
  const canonical = `https://planfully.it/feed/post/${article.slug ?? article.id}`
  const ogImage = article.cover_image_url ?? 'https://planfully.it/og-default.jpg'

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <Helmet>
        <title>{article.title} · {authorName} · Planfully</title>
        <meta name="description" content={(article.body_html || '').replace(/<[^>]+>/g, '').slice(0, 160)} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={(article.body_html || '').replace(/<[^>]+>/g, '').slice(0, 200)} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={canonical} />
        <meta property="article:published_time" content={article.created_at} />
        <meta property="article:author" content={authorName} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          image: article.cover_image_url ? [article.cover_image_url] : [],
          datePublished: article.created_at,
          dateModified: article.updated_at,
          author: { '@type': 'Person', name: authorName, url: authorHref ? `https://planfully.it${authorHref}` : undefined },
          publisher: { '@type': 'Organization', name: 'Planfully' },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        })}</script>
      </Helmet>

      <article>
        {article.cover_image_url && (
          <div className="aspect-[21/9] sm:aspect-[21/8] relative overflow-hidden">
            <img src={article.cover_image_url} alt={article.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.45))' }} />
          </div>
        )}

        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
          <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/feed'))}
            className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-6">
            <ArrowLeft size={14} /> Indietro
          </button>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-3xl sm:text-5xl tracking-tight leading-tight mb-5">{article.title}</h1>

            {/* Author bar */}
            <div className="flex items-center gap-3 pb-6 mb-8 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              {article.author.brand_logo_url ? (
                authorHref
                  ? <Link to={authorHref}><img src={article.author.brand_logo_url} alt="" className="w-12 h-12 rounded-full object-cover" /></Link>
                  : <img src={article.author.brand_logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-display text-lg"
                  style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {authorHref ? <Link to={authorHref} className="hover:underline">{authorName}</Link> : authorName}
                </p>
                <p className="text-xs text-[rgb(var(--fg-subtle))]">
                  {formatDate(article.created_at)}
                  {article.author.city && <> · {article.author.city}</>}
                </p>
              </div>
              <button onClick={share}
                className="rounded-full p-2 hover:bg-[rgb(var(--bg-sunken))] transition-colors" aria-label="Condividi">
                <Share2 size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="blog-body prose-content" dangerouslySetInnerHTML={{ __html: article.body_html }} />

            {/* Engagement bar */}
            <div className="flex items-center gap-2 mt-10 pt-6 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <button onClick={toggleLike}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full transition-colors"
                style={{ background: liked ? 'rgb(var(--rose-100))' : 'rgb(var(--bg-sunken))', color: liked ? 'rgb(var(--rose-500))' : 'rgb(var(--fg-muted))' }}>
                <Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {likeCount}
              </button>
              <Link to={`/feed?post=${article.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]">
                <MessageCircle size={14} /> {article.comment_count}
              </Link>
              <button onClick={share}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]">
                <Share2 size={14} /> Condividi
              </button>
            </div>

            {/* Author CTA */}
            {authorHref && (
              <div className="surface surface-lift p-6 mt-10">
                <div className="flex items-start gap-4">
                  {article.author.brand_logo_url ? (
                    <img src={article.author.brand_logo_url} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl shrink-0"
                      style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--fg-subtle))] mb-1">Scritto da</p>
                    <h3 className="font-display text-lg">{authorName}</h3>
                    {article.author.tagline && (
                      <p className="text-sm text-[rgb(var(--fg-muted))] italic mt-1">"{article.author.tagline}"</p>
                    )}
                    <Link to={authorHref}
                      className="inline-block mt-3 text-sm font-medium hover:underline"
                      style={{ color: 'rgb(var(--gold-600))' }}>
                      Vedi profilo →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </article>

      <style>{`
        .blog-body { font-size: 17px; line-height: 1.75; color: rgb(var(--fg)); }
        .blog-body h2 { font-family: var(--font-display); font-size: 1.8rem; line-height: 1.2; margin: 2.2rem 0 1rem; }
        .blog-body h3 { font-family: var(--font-display); font-size: 1.4rem; line-height: 1.25; margin: 1.8rem 0 0.75rem; }
        .blog-body p { margin: 0 0 1.2rem; }
        .blog-body a { color: rgb(var(--gold-600)); text-decoration: underline; }
        .blog-body ul, .blog-body ol { margin: 0 0 1.2rem 1.5rem; }
        .blog-body ul { list-style: disc; }
        .blog-body ol { list-style: decimal; }
        .blog-body blockquote { border-left: 3px solid rgb(var(--gold-500)); padding: 0.4rem 1.2rem; margin: 1.5rem 0; font-style: italic; color: rgb(var(--fg-muted)); }
        .blog-body img { border-radius: 12px; margin: 1.5rem 0; max-width: 100%; }
        .blog-body hr { border: none; border-top: 1px solid rgb(var(--border)); margin: 2rem 0; }
        .blog-body strong { font-weight: 600; }
      `}</style>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'rgb(var(--bg))' }}>
      <div className="surface p-10 text-center max-w-md">{children}</div>
    </div>
  )
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

// Eye icon never used directly but kept for future viewers
void Eye
