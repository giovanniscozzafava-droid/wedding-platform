import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, Image as ImageIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { RichTextEditor } from '@/components/blog/RichTextEditor'

type Visibility = 'PUBLIC' | 'NETWORK' | 'FOLLOWERS'

type ArticleState = {
  id: string | null
  slug: string
  title: string
  body_html: string
  body_excerpt: string  // testo plain per preview feed
  cover_image_url: string | null
  visibility: Visibility
}

const EMPTY: ArticleState = {
  id: null, slug: '', title: '', body_html: '', body_excerpt: '',
  cover_image_url: null, visibility: 'PUBLIC',
}

const sb = supabase as unknown as {
  from: (t: string) => {
    select: (s: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: Error | null }> } }
    update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: Error | null }> }
    insert: (p: Record<string, unknown>) => { select: () => { single: () => Promise<{ data: unknown; error: Error | null }> } }
  }
  auth: typeof supabase.auth
  storage: typeof supabase.storage
}

export default function FeedArticleEditorPage() {
  const { id } = useParams<{ id?: string }>()
  const { user } = useAuth()
  const nav = useNavigate()
  const [article, setArticle] = useState<ArticleState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    void (async () => {
      const { data, error } = await sb.from('posts').select('*').eq('id', id).maybeSingle()
      if (error || !data) { toast.error('Articolo non trovato'); nav('/feed'); return }
      const row = data as Record<string, unknown>
      setArticle({
        id: row.id as string,
        slug: (row.slug as string) ?? '',
        title: (row.title as string) ?? '',
        body_html: (row.body_html as string) ?? '',
        body_excerpt: (row.body as string) ?? '',
        cover_image_url: (row.cover_image_url as string) ?? null,
        visibility: (row.visibility as Visibility) ?? 'PUBLIC',
      })
      setLoading(false)
    })()
  }, [id, nav])

  function autoSlug(title: string): string {
    return title.toLowerCase()
      .replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
  }

  function patchTitle(v: string) {
    setArticle((p) => ({
      ...p, title: v,
      slug: p.slug && p.id ? p.slug : autoSlug(v),
    }))
  }

  async function uploadCover(file: File) {
    if (!user) return
    setUploadingCover(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/cover-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('post-media').upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) throw error
      const { data: pub } = supabase.storage.from('post-media').getPublicUrl(path)
      setArticle((p) => ({ ...p, cover_image_url: pub.publicUrl }))
      toast.success('Cover caricata')
    } catch (e) { toast.error((e as Error).message) }
    finally { setUploadingCover(false) }
  }

  async function save(opts: { publish?: boolean } = {}) {
    if (!user) return
    if (!article.title.trim()) { toast.error('Aggiungi un titolo'); return }
    if (!article.body_html || article.body_html.length < 20) { toast.error('Scrivi qualcosa nel corpo dell\'articolo'); return }
    if (uploadingCover) { toast.error('Attendi il caricamento della copertina'); return }
    const setBusy = opts.publish ? setPublishing : setSaving
    setBusy(true)
    try {
      // Estrai excerpt da body_html (prime 250 char senza tag)
      const plain = article.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const excerpt = plain.slice(0, 250) + (plain.length > 250 ? '…' : '')

      const payload: Record<string, unknown> = {
        author_id:        user.id,
        post_type:        'ARTICLE',
        title:            article.title.trim(),
        slug:             article.slug.trim() || autoSlug(article.title),
        body_html:        article.body_html,
        body:             excerpt,
        cover_image_url:  article.cover_image_url,
        visibility:       article.visibility,
        media_urls:       [],
        tagged_supplier_ids: [],
      }
      // Stato pubblicazione: Pubblica → PUBLISHED; nuova bozza → DRAFT (nascosta nel
      // feed finché non pubblicata). In modifica, un semplice "Salva" preserva lo
      // stato corrente (non ri-bozza un articolo già pubblicato).
      if (opts.publish) payload.moderation_status = 'PUBLISHED'
      else if (!article.id) payload.moderation_status = 'DRAFT'

      if (article.id) {
        const { error } = await sb.from('posts').update(payload).eq('id', article.id)
        if (error) throw error
        toast.success('Salvato')
      } else {
        const { data, error } = await sb.from('posts').insert(payload).select().single()
        if (error) throw error
        const newId = (data as { id: string }).id
        toast.success(opts.publish ? 'Articolo pubblicato' : 'Bozza salvata')
        nav(`/feed/modifica-articolo/${newId}`, { replace: true })
      }
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('posts_slug_key') || msg.includes('duplicate key')) {
        toast.error('Slug già usato. Modificalo prima di salvare.')
      } else { toast.error(msg) }
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-10 text-[rgb(var(--fg-subtle))]">Caricamento…</div>

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <Link to="/feed" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-2">
              <ArrowLeft size={14} /> Feed
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl">{article.id ? 'Modifica articolo' : 'Nuovo articolo'}</h1>
              <Badge tone="gold">Articolo</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => save()} disabled={saving || publishing || uploadingCover}>
              <Save size={14} /> {saving ? 'Salvataggio…' : 'Salva bozza'}
            </Button>
            <Button variant="gold" onClick={() => save({ publish: true })} disabled={saving || publishing || uploadingCover}>
              <Send size={14} /> {publishing ? 'Pubblicazione…' : 'Pubblica'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="surface p-5 space-y-3">
              <div>
                <Label htmlFor="title">Titolo</Label>
                <Input id="title" value={article.title}
                  onChange={(e) => patchTitle(e.target.value)}
                  placeholder="Il titolo del tuo articolo"
                  className="text-lg font-display" />
              </div>
            </div>

            <RichTextEditor
              value={article.body_html}
              onChange={(html) => setArticle((p) => ({ ...p, body_html: html }))}
              placeholder="Inizia a scrivere il tuo articolo…"
            />
          </div>

          <aside className="space-y-4">
            <div className="surface p-5 space-y-3">
              <h3 className="font-medium text-sm uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Pubblicazione</h3>
              <div>
                <Label>URL slug</Label>
                <Input value={article.slug}
                  onChange={(e) => setArticle((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} />
                <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">planfully.it/feed/post/{article.slug || '...'}</p>
              </div>
              <div>
                <Label>Visibilità</Label>
                <div className="flex flex-wrap gap-1">
                  {(['PUBLIC','NETWORK','FOLLOWERS'] as Visibility[]).map((v) => (
                    <button key={v} type="button"
                      onClick={() => setArticle((p) => ({ ...p, visibility: v }))}
                      className="text-xs px-3 py-1.5 rounded-full transition-colors"
                      style={{
                        background: article.visibility === v ? 'rgb(var(--gold-500))' : 'rgb(var(--bg-sunken))',
                        color: article.visibility === v ? 'white' : 'rgb(var(--fg-muted))',
                      }}>
                      {v === 'PUBLIC' ? 'Pubblico' : v === 'NETWORK' ? 'Rete' : 'Follower'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">
                  Pubblico = indicizzabile da Google; Rete = solo collaborazioni attive; Follower = solo chi ti segue.
                </p>
              </div>
            </div>

            <div className="surface p-5">
              <h3 className="font-medium text-sm uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Immagine di copertina</h3>
              {article.cover_image_url ? (
                <div className="space-y-2">
                  <img src={article.cover_image_url} alt="" className="w-full rounded-lg" />
                  <Button variant="ghost" size="sm" onClick={() => setArticle((p) => ({ ...p, cover_image_url: null }))}>
                    <Trash2 size={14} /> Rimuovi
                  </Button>
                </div>
              ) : (
                <label className="block">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.currentTarget.value = '' }} />
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    <ImageIcon className="mx-auto mb-2 opacity-50" size={20} />
                    <p className="text-xs text-[rgb(var(--fg-muted))]">
                      {uploadingCover ? 'Caricamento…' : 'Clicca per caricare'}
                    </p>
                  </div>
                </label>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
