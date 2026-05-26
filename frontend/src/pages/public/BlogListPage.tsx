import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Helmet } from 'react-helmet-async'
import { Search, Clock, Eye, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

type BlogListItem = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  hero_image_url: string | null
  tags: string[]
  reading_minutes: number | null
  published_at: string
  view_count: number
  category_slug: string | null
  category_name: string | null
  author_id: string
  author_name: string | null
  author_business: string | null
  author_slug: string | null
  author_logo: string | null
  author_city: string | null
}

type BlogCategory = { id: string; name: string; slug: string; description: string | null }

export default function BlogListPage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('cat') ?? ''
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [posts, setPosts] = useState<BlogListItem[]>([])
  const [cats, setCats] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { order: (c: string) => Promise<{ data: unknown }> } } })
        .from('blog_categories').select('*').order('sort_order')
      setCats(((data as BlogCategory[]) ?? []))
    })()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('blog_list_published', {
            p_category: category || null,
            p_search:   search.trim() || null,
            p_limit:    24,
            p_offset:   0,
          })
        if (error) throw error
        if (!cancelled) setPosts((data as BlogListItem[]) ?? [])
      } catch {
        if (!cancelled) setPosts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [category, search])

  function setFilter(catSlug: string) {
    const next = new URLSearchParams(params)
    if (catSlug) next.set('cat', catSlug); else next.delete('cat')
    setParams(next)
  }

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <Helmet>
        <title>Blog Planfully · Guide, ispirazioni e storie del settore eventi italiano</title>
        <meta name="description" content="Articoli di wedding planner e location italiani: guide pratiche, storie di eventi, ispirazioni, trend, tips per fornitori e location del settore eventi." />
        <link rel="canonical" href="https://planfully.it/blog" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Blog Planfully — il blog del settore eventi italiano" />
        <meta property="og:description" content="Guide, storie, ispirazioni scritte dai professionisti del settore eventi." />
        <meta property="og:url" content="https://planfully.it/blog" />
      </Helmet>

      {/* Hero */}
      <section className="relative border-b" style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-12 sm:py-16">
          <p className="text-xs uppercase tracking-[0.25em] mb-3 text-[rgb(var(--gold-600))]">
            Blog Planfully
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-tight mb-3">
            Storie, guide e ispirazioni<br />dal settore eventi italiano.
          </h1>
          <p className="text-base sm:text-lg text-[rgb(var(--fg-muted))] max-w-2xl leading-relaxed">
            Wedding planner, location e professionisti raccontano il loro mestiere — backstage,
            tendenze, consigli pratici per chi organizza eventi indimenticabili.
          </p>
        </div>
      </section>

      {/* Filtri */}
      <section className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev) / 0.92)' }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
              <Input className="pl-9" placeholder="Cerca per titolo o estratto..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3 overflow-x-auto">
            <CategoryChip active={!category} onClick={() => setFilter('')} label="Tutti gli articoli" />
            {cats.map((c) => (
              <CategoryChip key={c.id} active={category === c.slug}
                onClick={() => setFilter(c.slug)} label={c.name} />
            ))}
          </div>
        </div>
      </section>

      {/* Lista */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
        {loading && <p className="text-sm text-[rgb(var(--fg-muted))]">Caricamento...</p>}

        {!loading && posts.length === 0 && (
          <div className="text-center py-16">
            <p className="font-display text-2xl mb-2">Ancora nessun articolo qui</p>
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              {category ? 'Nessun articolo in questa categoria. Prova a tornare a "Tutti gli articoli".' : 'Stiamo per pubblicare i primi articoli. Torna presto.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((p, i) => (
            <motion.article key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.04 }}>
              <Link to={`/blog/${p.slug}`} className="block surface surface-elev overflow-hidden hover:surface-lift transition-all h-full flex flex-col">
                {p.hero_image_url && (
                  <div className="aspect-[16/9] overflow-hidden bg-[rgb(var(--bg-sunken))]">
                    <img src={p.hero_image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  {p.category_name && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--gold-600))] mb-2">
                      {p.category_name}
                    </p>
                  )}
                  <h3 className="font-display text-xl leading-tight line-clamp-2 mb-2">{p.title}</h3>
                  {p.excerpt && (
                    <p className="text-sm text-[rgb(var(--fg-muted))] line-clamp-3 leading-relaxed mb-4 flex-1">
                      {p.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3 pt-3 border-t mt-auto" style={{ borderColor: 'rgb(var(--border))' }}>
                    {p.author_logo ? (
                      <img src={p.author_logo} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-display"
                        style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                        {(p.author_business ?? p.author_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.author_business ?? p.author_name}</p>
                      <p className="text-[10px] text-[rgb(var(--fg-subtle))]">
                        {formatDate(p.published_at)}
                        {p.reading_minutes && <> · {p.reading_minutes} min</>}
                      </p>
                    </div>
                    {p.view_count > 50 && (
                      <span className="text-[10px] text-[rgb(var(--fg-subtle))] inline-flex items-center gap-0.5">
                        <Eye size={11} /> {p.view_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  )
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
      style={{
        background: active ? 'rgb(var(--fg))' : 'rgb(var(--bg-sunken))',
        color: active ? 'rgb(var(--bg-elev))' : 'rgb(var(--fg-muted))',
      }}>
      {label}
    </button>
  )
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}

// Icon import for Calendar/Clock not used yet — keeping for future reading time row
void Calendar
void Clock
