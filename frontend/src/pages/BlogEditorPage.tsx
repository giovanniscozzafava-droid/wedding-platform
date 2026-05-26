import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase as supabaseTyped } from '@/lib/supabase'
// blog_* non sono nei tipi generati: usa client untyped per queste chiamate
const supabase = supabaseTyped as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (k: string, v: string) => { order?: (c: string) => unknown; maybeSingle: () => Promise<{ data: unknown; error: Error | null }> }
      order: (c: string) => Promise<{ data: unknown }>
    }
    update: (patch: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: Error | null }> }
    insert: (payload: Record<string, unknown>) => { select: () => { single: () => Promise<{ data: unknown; error: Error | null }> } }
  }
  auth: typeof supabaseTyped.auth
  storage: typeof supabaseTyped.storage
}
import { useAuth } from '@/lib/auth'
import { RichTextEditor } from '@/components/blog/RichTextEditor'

type Category = { id: string; name: string; slug: string }

type PostState = {
  id: string | null
  slug: string
  title: string
  excerpt: string
  body_html: string
  hero_image_url: string | null
  category_id: string | null
  tags: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  seo_title: string
  seo_description: string
}

const EMPTY: PostState = {
  id: null, slug: '', title: '', excerpt: '', body_html: '',
  hero_image_url: null, category_id: null, tags: '',
  status: 'DRAFT', seo_title: '', seo_description: '',
}

export default function BlogEditorPage() {
  const { id } = useParams<{ id?: string }>()
  const { user } = useAuth()
  const nav = useNavigate()
  const [post, setPost] = useState<PostState>(EMPTY)
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data: c } = await supabase.from('blog_categories').select('id, name, slug').order('sort_order')
      setCats((c as Category[]) ?? [])
      if (id) {
        const { data, error } = await supabase.from('blog_posts').select('*').eq('id', id).maybeSingle()
        if (error || !data) { toast.error('Articolo non trovato'); nav('/blog/admin'); return }
        const row = data as Record<string, unknown>
        setPost({
          id: row.id as string,
          slug: (row.slug as string) ?? '',
          title: (row.title as string) ?? '',
          excerpt: (row.excerpt as string) ?? '',
          body_html: (row.body_html as string) ?? '',
          hero_image_url: (row.hero_image_url as string) ?? null,
          category_id: (row.category_id as string) ?? null,
          tags: Array.isArray(row.tags) ? (row.tags as string[]).join(', ') : '',
          status: (row.status as PostState['status']) ?? 'DRAFT',
          seo_title: (row.seo_title as string) ?? '',
          seo_description: (row.seo_description as string) ?? '',
        })
      }
      setLoading(false)
    })()
  }, [id, nav])

  function autoSlug(title: string) {
    return title.toLowerCase()
      .replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
  }

  function patchTitle(v: string) {
    setPost((p) => ({
      ...p,
      title: v,
      slug: p.slug && p.id ? p.slug : autoSlug(v),
    }))
  }

  function readingMinutes(html: string): number {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const words = text.split(' ').filter(Boolean).length
    return Math.max(1, Math.round(words / 220))
  }

  async function uploadHero(file: File) {
    if (!user) return
    setUploadingHero(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/hero-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('blog-media').upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) throw error
      const { data: pub } = supabase.storage.from('blog-media').getPublicUrl(path)
      setPost((p) => ({ ...p, hero_image_url: pub.publicUrl }))
      toast.success('Immagine caricata')
    } catch (e) { toast.error((e as Error).message) }
    finally { setUploadingHero(false) }
  }

  async function save(opts: { publish?: boolean } = {}) {
    if (!user) { toast.error('Devi essere loggato'); return }
    if (!post.title.trim()) { toast.error('Aggiungi un titolo'); return }
    if (!post.slug.trim()) { toast.error('Slug obbligatorio'); return }

    const setBusy = opts.publish ? setPublishing : setSaving
    setBusy(true)
    try {
      const tagsArr = post.tags.split(',').map((t) => t.trim()).filter(Boolean)
      const payload = {
        author_id:       user.id,
        slug:            post.slug.trim(),
        title:           post.title.trim(),
        excerpt:         post.excerpt.trim() || null,
        body_html:       post.body_html,
        hero_image_url:  post.hero_image_url,
        category_id:     post.category_id,
        tags:            tagsArr,
        status:          opts.publish ? 'PUBLISHED' : post.status,
        seo_title:       post.seo_title.trim() || null,
        seo_description: post.seo_description.trim() || null,
        reading_minutes: readingMinutes(post.body_html),
        ...(opts.publish && !post.id ? { published_at: new Date().toISOString() } : {}),
        ...(opts.publish && post.id && post.status !== 'PUBLISHED' ? { published_at: new Date().toISOString() } : {}),
      }

      if (post.id) {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', post.id)
        if (error) throw error
        setPost((p) => ({ ...p, status: opts.publish ? 'PUBLISHED' : p.status }))
        toast.success(opts.publish ? 'Articolo pubblicato' : 'Salvato')
      } else {
        const { data, error } = await supabase.from('blog_posts').insert(payload).select().single()
        if (error) throw error
        toast.success(opts.publish ? 'Articolo pubblicato' : 'Bozza salvata')
        nav(`/blog/modifica/${(data as { id: string }).id}`, { replace: true })
      }
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('blog_posts_slug_key') || msg.includes('duplicate key')) {
        toast.error('Slug già in uso. Modificalo prima di salvare.')
      } else {
        toast.error(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!post.id) return
    if (!confirm('Riportare l\'articolo in bozza? Sarà rimosso dal blog pubblico.')) return
    const { error } = await supabase.from('blog_posts').update({ status: 'DRAFT' }).eq('id', post.id)
    if (error) { toast.error(error.message); return }
    setPost((p) => ({ ...p, status: 'DRAFT' }))
    toast.success('Riportato in bozza')
  }

  if (loading) return <div className="p-10 text-[rgb(var(--fg-subtle))]">Caricamento...</div>

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <Link to="/blog/admin" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-2">
              <ArrowLeft size={14} /> I tuoi articoli
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl">{post.id ? 'Modifica articolo' : 'Nuovo articolo'}</h1>
              <Badge tone={post.status === 'PUBLISHED' ? 'emerald' : post.status === 'DRAFT' ? 'amber' : 'neutral'}>
                {post.status === 'PUBLISHED' ? 'Pubblicato' : post.status === 'DRAFT' ? 'Bozza' : 'Archiviato'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.status === 'PUBLISHED' && (
              <Link to={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm"><ExternalLink size={14} /> Vedi</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => save()} disabled={saving || publishing}>
              <Save size={14} /> {saving ? 'Salvataggio…' : 'Salva bozza'}
            </Button>
            {post.status !== 'PUBLISHED' ? (
              <Button variant="gold" onClick={() => save({ publish: true })} disabled={saving || publishing}>
                <Send size={14} /> {publishing ? 'Pubblico…' : 'Pubblica'}
              </Button>
            ) : (
              <Button variant="outline" onClick={unpublish}>Riporta in bozza</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor principale */}
          <div className="lg:col-span-2 space-y-4">
            <div className="surface p-5 space-y-3">
              <div>
                <Label htmlFor="title">Titolo</Label>
                <Input id="title" value={post.title} onChange={(e) => patchTitle(e.target.value)}
                  placeholder="Il titolo che apparirà su Google e nelle anteprime"
                  className="text-lg font-display" />
              </div>
              <div>
                <Label htmlFor="excerpt">Estratto / sommario</Label>
                <Textarea id="excerpt" rows={2} value={post.excerpt}
                  onChange={(e) => setPost((p) => ({ ...p, excerpt: e.target.value }))}
                  placeholder="2-3 righe che invogliano a leggere (anche meta description SEO)." />
              </div>
            </div>

            <RichTextEditor
              value={post.body_html}
              onChange={(html) => setPost((p) => ({ ...p, body_html: html }))}
              placeholder="Inizia a scrivere…"
            />
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="surface p-5 space-y-3">
              <h3 className="font-medium text-sm uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Impostazioni</h3>
              <div>
                <Label htmlFor="slug">URL slug</Label>
                <Input id="slug" value={post.slug}
                  onChange={(e) => setPost((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} />
                <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">planfully.it/blog/{post.slug || '...'}</p>
              </div>
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select id="category" value={post.category_id ?? ''}
                  onChange={(e) => setPost((p) => ({ ...p, category_id: e.target.value || null }))}>
                  <option value="">— nessuna —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="tags">Tag (separati da virgola)</Label>
                <Input id="tags" value={post.tags}
                  onChange={(e) => setPost((p) => ({ ...p, tags: e.target.value }))}
                  placeholder="matrimoni, calabria, fotografia" />
              </div>
            </div>

            {/* Hero image */}
            <div className="surface p-5">
              <h3 className="font-medium text-sm uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Immagine in copertina</h3>
              {post.hero_image_url ? (
                <div className="space-y-2">
                  <img src={post.hero_image_url} alt="" className="w-full rounded-lg" />
                  <Button variant="ghost" size="sm" onClick={() => setPost((p) => ({ ...p, hero_image_url: null }))}>
                    <Trash2 size={14} /> Rimuovi
                  </Button>
                </div>
              ) : (
                <label className="block">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHero(f); e.currentTarget.value = '' }} />
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    <ImageIcon className="mx-auto mb-2 opacity-50" size={20} />
                    <p className="text-xs text-[rgb(var(--fg-muted))]">
                      {uploadingHero ? 'Caricamento…' : 'Clicca per caricare'}
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* SEO */}
            <details className="surface p-5">
              <summary className="cursor-pointer font-medium text-sm uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                SEO (opzionale)
              </summary>
              <div className="space-y-3 pt-3">
                <div>
                  <Label htmlFor="seo_title">Titolo SEO</Label>
                  <Input id="seo_title" value={post.seo_title}
                    onChange={(e) => setPost((p) => ({ ...p, seo_title: e.target.value }))}
                    placeholder="Override del titolo per Google" />
                  <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">Max 60 caratteri. Lasciato vuoto, usa il titolo.</p>
                </div>
                <div>
                  <Label htmlFor="seo_description">Meta description</Label>
                  <Textarea id="seo_description" rows={2} value={post.seo_description}
                    onChange={(e) => setPost((p) => ({ ...p, seo_description: e.target.value }))}
                    placeholder="160 caratteri persuasivi" />
                </div>
              </div>
            </details>
          </aside>
        </div>
      </div>
    </div>
  )
}
