import { useEffect, useState } from 'react'
import { Heart, Send, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Like + commenti su una foto/video (restano nell'app). Pensato per il lightbox scuro.
type Comment = { id: string; author_name: string | null; body: string; created_at: string }

export function PhotoSocial({ mediaId }: { mediaId: string }) {
  const [uid, setUid] = useState<string | null>(null)
  const [likes, setLikes] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const me = (await supabase.auth.getUser()).data.user?.id ?? null
      const { data: l } = await (supabase.from as any)('gallery_media_likes').select('user_id').eq('media_id', mediaId)
      const { data: c } = await (supabase.from as any)('gallery_media_comments').select('id, author_name, body, created_at').eq('media_id', mediaId).order('created_at')
      if (!alive) return
      setUid(me)
      const arr = (l as { user_id: string }[]) ?? []
      setLikes(arr.length); setLiked(!!me && arr.some((x) => x.user_id === me))
      setComments((c as Comment[]) ?? [])
    })()
    return () => { alive = false }
  }, [mediaId])

  async function toggleLike() {
    if (!uid) return
    if (liked) {
      setLiked(false); setLikes((n) => Math.max(0, n - 1))
      await (supabase.from as any)('gallery_media_likes').delete().eq('media_id', mediaId).eq('user_id', uid)
    } else {
      setLiked(true); setLikes((n) => n + 1)
      await (supabase.from as any)('gallery_media_likes').insert({ media_id: mediaId })
    }
  }

  async function addComment() {
    const body = text.trim()
    if (!body) return
    setSending(true)
    const { error } = await (supabase.from as any)('gallery_media_comments').insert({ media_id: mediaId, body })
    setSending(false)
    if (error) return
    setText('')
    const { data: c } = await (supabase.from as any)('gallery_media_comments').select('id, author_name, body, created_at').eq('media_id', mediaId).order('created_at')
    setComments((c as Comment[]) ?? [])
    setOpen(true)
  }

  return (
    <div className="text-white" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-4">
        <button onClick={toggleLike} className="inline-flex items-center gap-1.5 text-sm">
          <Heart size={20} className={liked ? 'fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))]' : 'text-white'} /> {likes > 0 ? likes : ''}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="text-sm text-white/80 hover:text-white">
          {comments.length > 0 ? `${comments.length} commenti` : 'Commenta'}
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
          {comments.map((c) => (
            <p key={c.id} className="text-sm"><span className="font-medium">{c.author_name ?? 'Invitato'}</span> <span className="text-white/85">{c.body}</span></p>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addComment() }}
          placeholder="Scrivi un commento…" className="flex-1 rounded-full bg-white/10 text-white placeholder-white/50 px-3 py-1.5 text-sm border border-white/20" />
        <button onClick={addComment} disabled={sending || !text.trim()} className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
