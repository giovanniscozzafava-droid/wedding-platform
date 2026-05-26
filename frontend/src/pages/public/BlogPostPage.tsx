import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Eye, Share2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type PostFull = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body_html: string
  hero_image_url: string | null
  hero_focal_y: number
  tags: string[]
  status: string
  seo_title: string | null
  seo_description: string | null
  reading_minutes: number | null
  view_count: number
  published_at: string
  updated_at: string
  category: { slug: string; name: string } | null
  author: {
    id: string
    slug: string | null
    full_name: string | null
    business_name: string | null
    brand_logo_url: string | null
    role: string
    city: string | null
    tagline: string | null
  }
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<PostFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    void (async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('blog_get_by_slug', { p_slug: slug })
        if (error) throw error
        if (!data) { setNotFound(true); return }
        setPost(data as PostFull)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  function share() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: post?.title, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Link copiato')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg))' }}>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Caricamento...</p>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg))' }}>
        <div className="surface p-10 text-center max-w-md">
          <p className="font-display text-2xl mb-2">Articolo non trovato</p>
          <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">Il link potrebbe essere obsoleto o l'articolo non è ancora stato pubblicato.</p>
          <Link to="/blog" className="text-sm text-[rgb(var(--gold-600))] hover:underline">← Torna al blog</Link>
        </div>
      </div>
    )
  }

  const canonical = `https://planfully.it/blog/${post.slug}`
  const ogImage = post.hero_image_url ?? 'https://planfully.it/og-default.jpg'
  const authorName = post.author.business_name ?? post.author.full_name ?? 'Planfully'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seo_description ?? post.excerpt,
    image: post.hero_image_url ? [post.hero_image_url] : [],
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Person',
      name: authorName,
      url: post.author.slug ? `https://planfully.it/p/fornitore/${post.author.slug}` : undefined,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Planfully',
      logo: { '@type': 'ImageObject', url: 'https://planfully.it/brand/planfully-symbol.svg' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  }

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <Helmet>
        <title>{(post.seo_title ?? post.title) + ' · Blog Planfully'}</title>
        <meta name="description" content={post.seo_description ?? post.excerpt ?? ''} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.seo_title ?? post.title} />
        <meta property="og:description" content={post.seo_description ?? post.excerpt ?? ''} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={canonical} />
        <meta property="article:published_time" content={post.published_at} />
        <meta property="article:modified_time" content={post.updated_at} />
        <meta property="article:author" content={authorName} />
        {post.category && <meta property="article:section" content={post.category.name} />}
        {post.tags.map((t) => <meta key={t} property="article:tag" content={t} />)}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.seo_title ?? post.title} />
        <meta name="twitter:description" content={post.seo_description ?? post.excerpt ?? ''} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <article>
        {/* Hero */}
        {post.hero_image_url && (
          <div className="aspect-[21/9] sm:aspect-[21/8] overflow-hidden relative">
            <img src={post.hero_image_url} alt={post.title}
              className="w-full h-full object-cover"
              style={{ objectPosition: `center ${post.hero_focal_y ?? 50}%` }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.45))' }} />
          </div>
        )}

        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
          <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-6">
            <ArrowLeft size={14} /> Tutti gli articoli
          </Link>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {post.category && (
              <Link to={`/blog?cat=${post.category.slug}`}
                className="inline-block text-xs uppercase tracking-[0.25em] mb-3 hover:underline"
                style={{ color: 'rgb(var(--gold-600))' }}>
                {post.category.name}
              </Link>
            )}

            <h1 className="font-display text-3xl sm:text-5xl tracking-tight leading-tight mb-4">{post.title}</h1>

            {post.excerpt && (
              <p className="text-lg text-[rgb(var(--fg-muted))] leading-relaxed mb-8 italic">{post.excerpt}</p>
            )}

            {/* Meta riga autore */}
            <div className="flex items-center gap-3 pb-6 mb-8 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              {post.author.brand_logo_url ? (
                <img src={post.author.brand_logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-display text-lg"
                  style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {post.author.slug ? (
                    <Link to={`/p/fornitore/${post.author.slug}`} className="hover:underline">{authorName}</Link>
                  ) : (
                    <>{authorName}</>
                  )}
                </p>
                <p className="text-xs text-[rgb(var(--fg-subtle))] flex items-center gap-2 flex-wrap">
                  <span>{formatDate(post.published_at)}</span>
                  {post.reading_minutes && (
                    <span className="inline-flex items-center gap-0.5"><Clock size={11} /> {post.reading_minutes} min</span>
                  )}
                  {post.view_count > 50 && (
                    <span className="inline-flex items-center gap-0.5"><Eye size={11} /> {post.view_count}</span>
                  )}
                  {post.author.city && (
                    <span className="inline-flex items-center gap-0.5"><MapPin size={11} /> {post.author.city}</span>
                  )}
                </p>
              </div>
              <button onClick={share}
                className="rounded-full p-2 hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                aria-label="Condividi">
                <Share2 size={16} />
              </button>
            </div>

            {/* Body HTML */}
            <div className="blog-body prose-content"
              dangerouslySetInnerHTML={{ __html: post.body_html }} />

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t flex flex-wrap gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
                {post.tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Author CTA */}
            {post.author.slug && (
              <div className="surface surface-lift p-6 mt-10">
                <div className="flex items-start gap-4">
                  {post.author.brand_logo_url ? (
                    <img src={post.author.brand_logo_url} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl shrink-0"
                      style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--fg-subtle))] mb-1">Scritto da</p>
                    <h3 className="font-display text-lg">{authorName}</h3>
                    {post.author.tagline && (
                      <p className="text-sm text-[rgb(var(--fg-muted))] italic mt-1">"{post.author.tagline}"</p>
                    )}
                    <Link to={`/p/fornitore/${post.author.slug}`}
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
        .blog-body h2 { font-family: var(--font-display); font-size: 1.8rem; line-height: 1.2; margin: 2.2rem 0 1rem; letter-spacing: -0.01em; }
        .blog-body h3 { font-family: var(--font-display); font-size: 1.4rem; line-height: 1.25; margin: 1.8rem 0 0.75rem; }
        .blog-body p { margin: 0 0 1.2rem; }
        .blog-body a { color: rgb(var(--gold-600)); text-decoration: underline; text-underline-offset: 3px; }
        .blog-body a:hover { color: rgb(var(--gold-700)); }
        .blog-body ul, .blog-body ol { margin: 0 0 1.2rem 1.5rem; }
        .blog-body ul { list-style: disc; }
        .blog-body ol { list-style: decimal; }
        .blog-body li { margin: 0.4rem 0; }
        .blog-body blockquote { border-left: 3px solid rgb(var(--gold-500)); padding: 0.4rem 1.2rem; margin: 1.5rem 0; font-style: italic; color: rgb(var(--fg-muted)); }
        .blog-body img { border-radius: 12px; margin: 1.5rem 0; max-width: 100%; }
        .blog-body hr { border: none; border-top: 1px solid rgb(var(--border)); margin: 2rem 0; }
        .blog-body code { background: rgb(var(--bg-sunken)); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
        .blog-body strong { font-weight: 600; }
      `}</style>
    </div>
  )
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}
