import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Film, MessageSquarePlus, Check, Play, Save, Loader2, Music, Scissors, Palette, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Consegna video del videomaker + revisione del cliente con "post-it" temporizzati.
type Project = { draft_url: string | null; final_url: string | null; status: string }
type Comment = { id: string; author_name: string | null; t_seconds: number; target: string; kind: string; body: string; status: string }

const KINDS = [
  { k: 'generale', label: 'Generale', icon: Sparkles },
  { k: 'montaggio', label: 'Montaggio', icon: Scissors },
  { k: 'musica', label: 'Musica', icon: Music },
  { k: 'colore', label: 'Colore', icon: Palette },
]
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const isDirect = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || u.includes('/storage/v1/')
const drivePreview = (u: string) => {
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/) || u.match(/[?&]id=([^&]+)/)
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : u
}

export default function VideoReviewPage() {
  const { entryId } = useParams<{ entryId: string }>()
  const { profile } = useAuth()
  const canEdit = profile?.role !== 'COUPLE' // videomaker/WP/location/admin (la RLS è la verità)

  const [proj, setProj] = useState<Project>({ draft_url: null, final_url: null, status: 'DRAFT' })
  const [comments, setComments] = useState<Comment[]>([])
  const [title, setTitle] = useState('Video')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<'bozza' | 'finale'>('bozza')
  const [compose, setCompose] = useState<{ t: number; kind: string; body: string } | null>(null)
  const [draftInput, setDraftInput] = useState(''); const [finalInput, setFinalInput] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const load = useCallback(async () => {
    if (!entryId) return
    setLoading(true)
    const [{ data: p }, { data: c }, { data: e }] = await Promise.all([
      (supabase.from as any)('video_projects').select('draft_url, final_url, status').eq('entry_id', entryId).maybeSingle(),
      (supabase.from as any)('video_comments').select('id, author_name, t_seconds, target, kind, body, status').eq('entry_id', entryId).order('t_seconds'),
      (supabase.from as any)('calendar_entries').select('title').eq('id', entryId).maybeSingle(),
    ])
    if (p) { setProj(p as Project); setDraftInput((p as Project).draft_url ?? ''); setFinalInput((p as Project).final_url ?? '') }
    setComments((c as Comment[]) ?? [])
    setTitle((e as { title?: string } | null)?.title ?? 'Video')
    if (!(p as Project)?.draft_url && (p as Project)?.final_url) setTarget('finale')
    setLoading(false)
  }, [entryId])
  useEffect(() => { void load() }, [load])

  const url = target === 'finale' ? proj.final_url : proj.draft_url
  const direct = url ? isDirect(url) : false
  const shown = useMemo(() => comments.filter((c) => c.target === target), [comments, target])

  async function saveProject() {
    if (!entryId) return
    setBusy(true)
    const status = finalInput ? 'FINAL' : (draftInput ? 'REVIEW' : 'DRAFT')
    const { data, error } = await (supabase.rpc as any)('video_project_save', { p_entry: entryId, p_draft: draftInput.trim(), p_final: finalInput.trim(), p_status: status })
    setBusy(false)
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message ?? 'Errore'); return }
    toast.success('Video salvato'); await load()
  }

  function openPostIt() {
    const t = direct && videoRef.current ? videoRef.current.currentTime : 0
    if (direct && videoRef.current) videoRef.current.pause()
    setCompose({ t, kind: 'generale', body: '' })
  }
  async function sendPostIt() {
    if (!compose || !compose.body.trim() || !entryId) return
    const { error } = await (supabase.from as any)('video_comments').insert({ entry_id: entryId, t_seconds: Math.round(compose.t), target, kind: compose.kind, body: compose.body.trim() })
    if (error) { toast.error(error.message); return }
    toast.success('Post-it inviato 📌'); setCompose(null); await load()
  }
  async function resolve(id: string) { await (supabase.from as any)('video_comments').update({ status: 'DONE' }).eq('id', id); await load() }
  function seek(t: number) { if (videoRef.current) { videoRef.current.currentTime = t; void videoRef.current.play() } }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-sunken))]">
      <div className="sticky top-0 z-20 bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))] px-4 py-3 flex items-center gap-3">
        <Link to={`/weddings/${entryId}`} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><ArrowLeft size={18} /></Link>
        <h1 className="font-display text-lg truncate flex items-center gap-2"><Film size={18} /> Video — {title}</h1>
        <div className="ml-auto flex rounded-lg border border-[rgb(var(--border))] overflow-hidden text-xs">
          <button onClick={() => setTarget('bozza')} className={`px-3 py-1.5 ${target === 'bozza' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : ''}`}>Bozza</button>
          <button onClick={() => setTarget('finale')} disabled={!proj.final_url} className={`px-3 py-1.5 ${target === 'finale' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : ''} disabled:opacity-40`}>Finale</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid lg:grid-cols-[1fr_340px] gap-5">
        <div>
          {url ? (
            <div className="rounded-xl overflow-hidden bg-black">
              {direct
                ? <video ref={videoRef} src={url} controls className="w-full max-h-[70vh]" />
                : <iframe src={drivePreview(url)} className="w-full aspect-video" allow="autoplay" title="video" />}
            </div>
          ) : (
            <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">
              {canEdit ? 'Incolla qui sotto il link del video (bozza) per consegnarlo.' : 'Il videomaker non ha ancora caricato il video.'}
            </Card>
          )}

          {url && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="gold" size="sm" onClick={openPostIt}><MessageSquarePlus size={15} /> Aggiungi post-it{direct ? ' al punto attuale' : ''}</Button>
              {!direct && <span className="text-[11px] text-[rgb(var(--fg-muted))]">Link Drive/YouTube: il momento lo scrivi a mano nel post-it.</span>}
            </div>
          )}

          {/* consegna (solo videomaker) */}
          {canEdit && (
            <Card className="p-4 mt-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2"><Film size={15} /> Consegna video</p>
              <label className="text-xs text-[rgb(var(--fg-muted))]">Link BOZZA (mp4 diretto o Drive condiviso)</label>
              <input value={draftInput} onChange={(e) => setDraftInput(e.target.value)} placeholder="https://… .mp4 oppure link Drive" className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
              <label className="text-xs text-[rgb(var(--fg-muted))]">Link FINALE (quando pronto)</label>
              <input value={finalInput} onChange={(e) => setFinalInput(e.target.value)} placeholder="https://… video finale" className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
              <Button variant="gold" size="sm" disabled={busy} onClick={() => void saveProject()}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Consegna / aggiorna</Button>
              <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Suggerimento: per mettere in pausa su un punto preciso e ricevere post-it temporizzati, usa un link <strong>.mp4 diretto</strong> (es. da Drive con condivisione pubblica).</p>
            </Card>
          )}
        </div>

        {/* post-it list */}
        <div>
          <Card className="p-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-2"><MessageSquarePlus size={15} /> Post-it ({shown.filter((c) => c.status === 'OPEN').length} da fare)</p>
            <div className="space-y-2 max-h-[72vh] overflow-auto">
              {shown.length === 0 && <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessun commento ancora. Guarda il video e lascia un post-it sui punti da rivedere.</p>}
              {shown.map((c) => {
                const K = KINDS.find((k) => k.k === c.kind) ?? KINDS[0]!
                return (
                  <div key={c.id} className={`rounded-lg border p-2.5 text-sm ${c.status === 'DONE' ? 'opacity-50 border-[rgb(var(--border))]' : 'border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))]/30'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={() => direct && seek(c.t_seconds)} className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white inline-flex items-center gap-1"><Play size={10} /> {fmt(c.t_seconds)}</button>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgb(var(--bg-sunken))] inline-flex items-center gap-1"><K.icon size={10} /> {K.label}</span>
                    </div>
                    <p>{c.body}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-[rgb(var(--fg-muted))]">— {c.author_name ?? 'Cliente'}{c.status === 'DONE' ? ' · fatto ✓' : ''}</span>
                      {canEdit && c.status === 'OPEN' && <button onClick={() => void resolve(c.id)} className="text-[11px] px-2 py-0.5 rounded border border-[rgb(var(--border))] inline-flex items-center gap-1"><Check size={11} /> Fatto</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* compose post-it */}
      {compose && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setCompose(null)}>
          <div className="bg-[rgb(var(--bg))] w-full max-w-md rounded-2xl shadow-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium flex items-center gap-2">📌 Post-it sul video <span className="text-xs text-[rgb(var(--fg-muted))]">a {fmt(compose.t)}</span></p>
            {!direct && (
              <label className="text-xs text-[rgb(var(--fg-muted))] block">Momento (min:sec)
                <input type="number" min={0} value={Math.round(compose.t)} onChange={(e) => setCompose({ ...compose, t: +e.target.value })} className="mt-1 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" placeholder="secondi" />
              </label>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {KINDS.map((k) => <button key={k.k} onClick={() => setCompose({ ...compose, kind: k.k })} className={`text-xs px-2 py-1 rounded-full border inline-flex items-center gap-1 ${compose.kind === k.k ? 'bg-[rgb(var(--gold-500))] text-white border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`}><k.icon size={12} /> {k.label}</button>)}
            </div>
            <textarea value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} rows={3} placeholder="Cosa cambieresti qui? (es. 'taglia qui', 'musica troppo alta')" className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCompose(null)}>Annulla</Button>
              <Button variant="gold" size="sm" disabled={!compose.body.trim()} onClick={() => void sendPostIt()}>Lascia il post-it</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
