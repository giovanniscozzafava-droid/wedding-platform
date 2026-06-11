import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, Upload, MessageSquareHeart } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

// Auguri VOCALI agli sposi: gli invitati registrano (o caricano) un messaggio audio.
// Restano nell'app; li ascoltano gli sposi e il cerchio. File su event-guest-uploads.
type Wish = { id: string; author_name: string | null; storage_path: string; created_at: string }

export function AudioWishes({ entryId }: { entryId: string }) {
  const [wishes, setWishes] = useState<Wish[]>([])
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const pub = (p: string) => supabase.storage.from('event-guest-uploads').getPublicUrl(p).data.publicUrl

  const load = useCallback(async () => {
    const { data } = await (supabase.from as any)('event_audio_wishes').select('id, author_name, storage_path, created_at').eq('entry_id', entryId).order('created_at', { ascending: false })
    setWishes((data as Wish[]) ?? [])
  }, [entryId])

  useEffect(() => { void load() }, [load])

  async function uploadWish(blob: Blob, mime: string) {
    setBusy(true)
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) throw new Error('Accedi per lasciare un augurio')
      const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm'
      const path = `${entryId}/${uid}/audio-${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('event-guest-uploads').upload(path, blob, { contentType: mime || 'audio/webm' })
      if (up.error) throw up.error
      const { error } = await (supabase.from as any)('event_audio_wishes').insert({ entry_id: entryId, storage_path: path })
      if (error) throw error
      toast.success('Augurio inviato 🎤')
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        void uploadWish(blob, mr.mimeType || 'audio/webm')
      }
      recRef.current = mr; mr.start(); setRecording(true)
    } catch { toast.error('Microfono non disponibile. Puoi caricare un file audio.') }
  }
  function stopRec() { try { recRef.current?.stop() } catch { /* no-op */ }; setRecording(false) }

  return (
    <div className="mb-6 rounded-2xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))]/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquareHeart size={18} className="text-[rgb(var(--gold-700))]" />
        <div>
          <p className="text-sm font-medium">Auguri vocali agli sposi 🎤</p>
          <p className="text-xs text-[rgb(var(--fg-muted))]">Registra un messaggio: lo ascolteranno gli sposi.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!recording ? (
          <Button variant="gold" size="sm" disabled={busy} onClick={startRec}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />} Registra augurio</Button>
        ) : (
          <Button variant="gold" size="sm" onClick={stopRec}><Square size={14} className="fill-current" /> Stop e invia</Button>
        )}
        <input ref={fileRef} type="file" accept="audio/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadWish(f, f.type || 'audio/webm') }} />
        <Button variant="outline" size="sm" disabled={busy || recording} onClick={() => fileRef.current?.click()}><Upload size={14} /> Carica audio</Button>
      </div>
      {wishes.length > 0 && (
        <div className="space-y-2 pt-1">
          {wishes.map((w) => (
            <div key={w.id} className="flex items-center gap-2 rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] p-2">
              <span className="text-xs font-medium shrink-0 w-20 truncate">da {w.author_name ?? 'Invitato'}</span>
              <audio controls preload="none" src={pub(w.storage_path)} className="h-8 flex-1 min-w-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
