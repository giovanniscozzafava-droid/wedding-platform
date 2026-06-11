import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Images, Download, X, ChevronLeft, ChevronRight, Lock, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'

// Pagina ospite: link dedicato (?t=token), accesso SOLO previa registrazione.
// L'ospite vede ESCLUSIVAMENTE le foto INVITATI dell'evento. Nessuna dashboard,
// nessun dato sensibile: la RLS lo lascia leggere solo le cartelle INVITATI.

type Media = { id: string; thumbnail_link: string | null; drive_file_id: string; media_type: string; guest_tag_name: string | null }
type Folder = { id: string; name: string; gallery_media: Media[] }

const isDrive = (m: Media) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-')
const fullSrc = (m: Media) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w2000` : (m.thumbnail_link ?? ''))
const origUrl = (m: Media) => (isDrive(m) ? `https://drive.google.com/uc?export=download&id=${m.drive_file_id}` : (m.thumbnail_link ?? ''))
const webUrl = (m: Media) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

async function downloadUrl(url: string, name: string) {
  if (!url) return
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  } catch { window.open(url, '_blank') }
}

export default function GuestGalleryPage() {
  const { galleryId } = useParams<{ galleryId: string }>()
  const [sp] = useSearchParams()
  const token = sp.get('t') ?? ''
  const location = useLocation()
  const { loading: authLoading, session } = useAuth()

  const [state, setState] = useState<'idle' | 'joining' | 'ready' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [folders, setFolders] = useState<Folder[]>([])
  const [box, setBox] = useState<{ list: Media[]; i: number } | null>(null)

  const join = useCallback(async () => {
    if (!galleryId) return
    setState('joining')
    const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; entry_id?: string; error?: string } }> })
      .rpc('join_event_as_guest', { p_gallery_id: galleryId, p_token: token })
    if (!data?.ok || !data.entry_id) {
      setErrMsg(data?.error === 'bad_token' ? 'Link non valido o scaduto.' : data?.error === 'gallery_not_found' ? 'Galleria inesistente.' : 'Accesso non riuscito.')
      setState('error'); return
    }
    const { data: f } = await (supabase.from as any)('gallery_folders')
      .select('id, name, level, gallery_media(id, thumbnail_link, drive_file_id, media_type, guest_tag_name)')
      .eq('entry_id', data.entry_id).eq('level', 'INVITATI').order('sort_order')
    setFolders((f as Folder[]) ?? [])
    setState('ready')
  }, [galleryId, token])

  useEffect(() => {
    if (authLoading) return
    if (!session) return
    void join()
  }, [authLoading, session, join])

  // navigazione lightbox
  useEffect(() => {
    if (!box) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBox(null)
      else if (e.key === 'ArrowRight') setBox((b) => (b ? { ...b, i: (b.i + 1) % b.list.length } : b))
      else if (e.key === 'ArrowLeft') setBox((b) => (b ? { ...b, i: (b.i - 1 + b.list.length) % b.list.length } : b))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [box])

  const Frame = ({ children }: { children: ReactNode }) => (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <header className="border-b border-[rgb(var(--border))] px-5 py-3 flex items-center gap-2">
        <Images size={18} className="text-[rgb(var(--gold-600))]" />
        <span className="font-display text-lg">Foto dell'evento</span>
      </header>
      <main className="max-w-5xl mx-auto p-5">{children}</main>
    </div>
  )

  if (authLoading || state === 'joining') {
    return <Frame><div className="flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))] py-16 justify-center"><Loader2 size={16} className="animate-spin" /> Carico le foto…</div></Frame>
  }

  // Accesso SOLO previa registrazione/login.
  if (!session) {
    return (
      <Frame>
        <div className="max-w-sm mx-auto text-center py-16 space-y-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]"><Lock size={22} /></span>
          <h1 className="font-display text-xl">Le foto sono riservate agli invitati</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Accedi o registrati per vedere e scaricare le foto di questo evento.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="gold" asChild><Link to="/login" state={{ from: location }}>Accedi</Link></Button>
            <Button variant="outline" asChild><Link to="/register" state={{ from: location }}>Registrati</Link></Button>
          </div>
        </div>
      </Frame>
    )
  }

  if (state === 'error') {
    return <Frame><div className="text-center py-16 space-y-2"><p className="text-sm text-[rgb(var(--fg-muted))]">{errMsg}</p></div></Frame>
  }

  const allEmpty = folders.every((f) => f.gallery_media.length === 0)
  return (
    <Frame>
      {folders.length === 0 || allEmpty ? (
        <p className="text-sm text-[rgb(var(--fg-subtle))] py-12 text-center">Ancora nessuna foto per gli invitati.</p>
      ) : (
        folders.map((f) => (
          <section key={f.id} className="mb-8">
            <h2 className="font-medium mb-3">{f.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {f.gallery_media.map((m, idx) => (
                <button key={m.id} type="button" onClick={() => setBox({ list: f.gallery_media, i: idx })}
                  className="group relative rounded-md overflow-hidden bg-[rgb(var(--bg-sunken))] cursor-zoom-in" style={{ aspectRatio: '4/3' }}>
                  {m.thumbnail_link && <img src={m.thumbnail_link} alt={m.guest_tag_name ?? ''} className="w-full h-full object-cover transition group-hover:scale-105" loading="lazy" />}
                  {m.guest_tag_name && <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] px-1 py-0.5 truncate text-left">{m.guest_tag_name}</span>}
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {box && (() => {
        const m = box.list[box.i]
        if (!m) return null
        const ext = m.media_type === 'VIDEO' ? 'mp4' : 'jpg'
        const base = (m.guest_tag_name || 'foto-evento').replace(/[^\w\- ]+/g, '').trim() || 'foto-evento'
        return (
          <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={() => setBox(null)}>
            <div className="flex items-center justify-between gap-2 p-3" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-white/70">{box.i + 1} / {box.list.length}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="!text-white !border-white/30 hover:!bg-white/10" onClick={() => downloadUrl(webUrl(m), `${base}-web.${ext}`)}><Download size={14} /> Web</Button>
                <Button variant="gold" size="sm" onClick={() => downloadUrl(origUrl(m), `${base}.${ext}`)}><Download size={14} /> Originale</Button>
                <button className="p-1.5 rounded hover:bg-white/10" onClick={() => setBox(null)} aria-label="Chiudi"><X size={18} className="text-white" /></button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center px-4 pb-6 min-h-0" onClick={(e) => e.stopPropagation()}>
              {m.media_type === 'VIDEO' && isDrive(m)
                ? <iframe src={`https://drive.google.com/file/d/${m.drive_file_id}/preview`} className="w-full max-w-4xl aspect-video rounded-lg" allow="autoplay" title={base} />
                : <img src={fullSrc(m)} alt={m.guest_tag_name ?? ''} className="max-w-full max-h-full object-contain rounded-lg select-none" />}
            </div>
            {box.list.length > 1 && (
              <>
                <button className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setBox((b) => (b ? { ...b, i: (b.i - 1 + b.list.length) % b.list.length } : b)) }} aria-label="Precedente"><ChevronLeft size={22} className="text-white" /></button>
                <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setBox((b) => (b ? { ...b, i: (b.i + 1) % b.list.length } : b)) }} aria-label="Successiva"><ChevronRight size={22} className="text-white" /></button>
              </>
            )}
          </div>
        )
      })()}
    </Frame>
  )
}
