import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, FileText, Edit, ExternalLink, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Row = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  view_count: number
  published_at: string | null
  updated_at: string
  category_id: string | null
}

export default function BlogAdminPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown }> } } } })
      .from('blog_posts')
      .select('id, slug, title, excerpt, status, view_count, published_at, updated_at, category_id')
      .eq('author_id', user.id)
      .order('updated_at', { ascending: false })
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [user])

  async function deletePost(id: string, title: string) {
    if (!confirm(`Eliminare definitivamente l'articolo "${title}"?`)) return
    const { error } = await (supabase as unknown as { from: (t: string) => { delete: () => { eq: (k: string, v: string) => Promise<{ error: Error | null }> } } })
      .from('blog_posts').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Articolo eliminato')
    void load()
  }

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Blog"
          title="I tuoi articoli"
          description="Scrivi guide, racconta storie, condividi backstage. Ogni articolo è indicizzato da Google e porta traffico al tuo profilo."
          actions={
            <Button variant="gold" onClick={() => nav('/blog/nuovo')}>
              <Plus /> Nuovo articolo
            </Button>
          }
        />

        {loading && <p className="text-sm text-[rgb(var(--fg-muted))]">Caricamento...</p>}

        {!loading && rows.length === 0 && (
          <div className="surface p-10 text-center">
            <FileText className="mx-auto mb-3 opacity-40" size={32} />
            <p className="font-display text-xl mb-2">Nessun articolo ancora</p>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-5 max-w-md mx-auto">
              Inizia da una storia recente, una guida pratica, un dietro le quinte.
              I primi articoli sono quelli che ti faranno conoscere.
            </p>
            <Button variant="gold" onClick={() => nav('/blog/nuovo')}>
              <Plus /> Scrivi il primo articolo
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="surface p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone={r.status === 'PUBLISHED' ? 'emerald' : r.status === 'DRAFT' ? 'amber' : 'neutral'}>
                    {r.status === 'PUBLISHED' ? 'Pubblicato' : r.status === 'DRAFT' ? 'Bozza' : 'Archiviato'}
                  </Badge>
                  {r.view_count > 0 && (
                    <span className="text-[10px] text-[rgb(var(--fg-subtle))] inline-flex items-center gap-0.5">
                      <Eye size={11} /> {r.view_count}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg truncate">{r.title}</h3>
                {r.excerpt && <p className="text-xs text-[rgb(var(--fg-muted))] truncate mt-0.5">{r.excerpt}</p>}
                <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">
                  Aggiornato {new Date(r.updated_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.status === 'PUBLISHED' && (
                  <Link to={`/blog/${r.slug}`} target="_blank" rel="noreferrer"
                    className="rounded-md p-2 hover:bg-[rgb(var(--bg-sunken))]" title="Apri online">
                    <ExternalLink size={15} />
                  </Link>
                )}
                <button onClick={() => nav(`/blog/modifica/${r.id}`)}
                  className="rounded-md p-2 hover:bg-[rgb(var(--bg-sunken))]" title="Modifica">
                  <Edit size={15} />
                </button>
                <button onClick={() => deletePost(r.id, r.title)}
                  className="rounded-md p-2 hover:bg-[rgb(var(--rose-100))] text-[rgb(var(--rose-500))]" title="Elimina">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
