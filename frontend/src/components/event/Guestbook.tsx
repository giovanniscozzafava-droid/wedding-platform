import { useCallback, useEffect, useRef, useState } from 'react'
import { PenLine, Eraser, Loader2, Send, BookHeart } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

// Guestbook: gli ospiti lasciano un messaggio e la loro FIRMA (disegnata a dito/mouse).
// Resta nell'app; lo vedono gli sposi. `readOnly` = vista dashboard (solo lettura).
type Entry = { id: string; author_name: string | null; message: string | null; signature_path: string | null; created_at: string }

export function Guestbook({ entryId, readOnly = false }: { entryId: string; readOnly?: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasInk, setHasInk] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const pub = (p: string) => supabase.storage.from('event-guest-uploads').getPublicUrl(p).data.publicUrl

  const load = useCallback(async () => {
    const { data } = await (supabase.from as any)('event_guestbook')
      .select('id, author_name, message, signature_path, created_at').eq('entry_id', entryId).order('created_at', { ascending: false })
    setEntries((data as Entry[]) ?? [])
  }, [entryId])
  useEffect(() => { void load() }, [load])

  // ── firma su canvas ───────────────────────────────────────────────────────
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly) return
    drawing.current = true; const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#1A1714'
    canvasRef.current!.setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasInk(true)
  }
  function end() { drawing.current = false }
  function clearSig() {
    const c = canvasRef.current; if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHasInk(false)
  }

  async function submit() {
    if (!message.trim() && !hasInk) { toast.error('Scrivi un pensiero o lascia la tua firma'); return }
    setBusy(true)
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) throw new Error('Accedi per firmare il guestbook')
      let sigPath: string | null = null
      if (hasInk && canvasRef.current) {
        const blob: Blob = await new Promise((res) => canvasRef.current!.toBlob((b) => res(b!), 'image/png'))
        const path = `${entryId}/${uid}/firma-${crypto.randomUUID()}.png`
        const up = await supabase.storage.from('event-guest-uploads').upload(path, blob, { contentType: 'image/png' })
        if (up.error) throw up.error
        sigPath = path
      }
      const { error } = await (supabase.from as any)('event_guestbook').insert({ entry_id: entryId, message: message.trim() || null, signature_path: sigPath })
      if (error) throw error
      toast.success('Grazie! Il tuo pensiero è nel guestbook 💛')
      setMessage(''); clearSig(); await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-2xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))]/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BookHeart size={18} className="text-[rgb(var(--gold-700))]" />
            <div>
              <p className="text-sm font-medium">Firma il guestbook ✍️</p>
              <p className="text-xs text-[rgb(var(--fg-muted))]">Lascia un pensiero e la tua firma agli sposi.</p>
            </div>
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
            placeholder="Il vostro augurio più sincero…"
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
          <div>
            <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1 flex items-center gap-1"><PenLine size={12} /> Firma qui sotto</p>
            <canvas ref={canvasRef} width={600} height={200}
              onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
              className="w-full h-32 rounded-lg bg-white border border-[rgb(var(--border))] touch-none cursor-crosshair" />
            <div className="flex justify-between items-center mt-1">
              <button type="button" onClick={clearSig} className="text-[11px] text-[rgb(var(--fg-muted))] inline-flex items-center gap-1"><Eraser size={12} /> Cancella firma</button>
            </div>
          </div>
          <Button variant="gold" size="sm" disabled={busy} onClick={submit}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Lascia il messaggio</Button>
        </div>
      )}

      {readOnly && entries.length === 0 && (
        <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessun messaggio nel guestbook ancora. Compariranno qui quando gli invitati firmeranno.</p>
      )}

      {entries.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {entries.map((e) => (
            <div key={e.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3">
              {e.message && <p className="text-sm italic">“{e.message}”</p>}
              {e.signature_path && <img src={pub(e.signature_path)} alt="firma" className="mt-2 h-16 object-contain self-start" />}
              <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1">— {e.author_name ?? 'Un invitato'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
