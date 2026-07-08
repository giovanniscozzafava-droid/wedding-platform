import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X, Send, Check, MapPin, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export type AlbumPin = { id: string; entry_id: string; page: number; x: number; y: number; comment: string | null; material: string | null; color: string | null; status: string; logo?: string | null; cover_photo?: boolean | null; pages?: number | null }
type Msg = { id: string; author_role: string; body: string; created_at: string }

// Pannello conversazione di un pin: il commento resta sul pin, materiale/colore, e il dialogo
// cliente↔fotografo. Il cliente conclude con "Ok, scelgo questo!".
export function PinThreadPanel({ pin, entryId, isPro, onClose, onUpdated, onChoose }: {
  pin: AlbumPin; entryId: string; isPro: boolean
  onClose: () => void; onUpdated: (p: AlbumPin) => void; onChoose: (p: AlbumPin) => void
}) {
  const [comment, setComment] = useState(pin.comment ?? '')
  const [material, setMaterial] = useState(pin.material ?? '')
  const [color, setColor] = useState(pin.color ?? '')
  const [logo, setLogo] = useState(pin.logo ?? '')
  const [coverPhoto, setCoverPhoto] = useState(!!pin.cover_photo)
  const [pages, setPages] = useState(pin.pages != null ? String(pin.pages) : '')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function loadMsgs() {
    const { data } = await (supabase.from as any)('album_pin_messages').select('id, author_role, body, created_at').eq('pin_id', pin.id).order('created_at')
    setMsgs((data ?? []) as Msg[])
  }
  useEffect(() => {
    void loadMsgs()
    const t = setInterval(() => void loadMsgs(), 4000) // poll: vede le risposte dell'altro
    return () => clearInterval(t)
  }, [pin.id])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  async function saveDetails() {
    const patch = {
      comment: comment.trim() || null, material: material.trim() || null, color: color.trim() || null,
      logo: logo.trim() || null, cover_photo: coverPhoto, pages: pages ? Math.max(1, Number(pages) || 0) : null,
    }
    await (supabase.from as any)('album_pins').update(patch).eq('id', pin.id)
    onUpdated({ ...pin, ...patch })
  }

  async function send() {
    const text = body.trim()
    if (!text) return
    setSending(true)
    try {
      await (supabase.from as any)('album_pin_messages').insert({ pin_id: pin.id, entry_id: entryId, author_role: isPro ? 'pro' : 'client', body: text })
      setBody('')
      await loadMsgs()
      // notifica l'altra parte (best-effort)
      try { await supabase.functions.invoke('pin-notify', { body: { entryId, from_role: isPro ? 'pro' : 'client', pin_comment: comment.trim() || pin.comment, message: text } }) } catch { /* non blocca */ }
    } catch (e) { toast.error((e as Error).message) } finally { setSending(false) }
  }

  async function choose() {
    await saveDetails()
    await (supabase.from as any)('album_pins').update({ status: 'CHOSEN' }).eq('id', pin.id)
    onChoose({ ...pin, comment: comment.trim() || null, material: material.trim() || null, color: color.trim() || null, logo: logo.trim() || null, cover_photo: coverPhoto, pages: pages ? Math.max(1, Number(pages) || 0) : null, status: 'CHOSEN' })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[92vh] flex flex-col bg-[rgb(var(--bg-elev))] rounded-t-3xl sm:rounded-3xl shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[rgb(var(--border))]">
          <span className="inline-flex items-center gap-1 text-[rgb(var(--gold-700))]"><MapPin size={16} /></span>
          <p className="font-medium text-sm flex-1">Questo modello · pag. {pin.page}</p>
          {pin.status === 'CHOSEN' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))]"><Check size={11} className="inline" /> scelto</span>}
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
        </div>

        <div className="px-5 py-3 space-y-2 border-b border-[rgb(var(--border))]">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} onBlur={saveDetails} rows={2}
            placeholder={isPro ? 'Nota del cliente…' : 'Scrivi cosa ti piace di questo modello, dubbi, domande…'}
            className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
          {!isPro && <p className="text-[11px] text-[rgb(var(--fg-muted))]">Dai al fotografo le info su questo modello:</p>}
          <div className="grid grid-cols-2 gap-2">
            <input value={material} onChange={(e) => setMaterial(e.target.value)} onBlur={saveDetails} placeholder="Materiale (es. pelle)" className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
            <input value={color} onChange={(e) => setColor(e.target.value)} onBlur={saveDetails} placeholder="Colore" className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
            <input value={logo} onChange={(e) => setLogo(e.target.value)} onBlur={saveDetails} placeholder="Logo / iniziali / data" className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
            <input value={pages} onChange={(e) => setPages(e.target.value)} onBlur={saveDetails} type="number" min={1} placeholder="Pagine (facolt.)" className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={coverPhoto} onChange={(e) => { setCoverPhoto(e.target.checked); setTimeout(saveDetails, 0) }} />
            Foto in copertina
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-[120px]">
          <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--fg-subtle))] text-center">Conversazione col fotografo</p>
          {msgs.length === 0 && <p className="text-center text-xs text-[rgb(var(--fg-subtle))] py-4">Nessun messaggio. Scrivi una domanda: il fotografo ti risponde qui.</p>}
          {msgs.map((m) => {
            const mine = (m.author_role === 'pro') === isPro
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.author_role === 'pro' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--fg))]' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg))]'}`}>
                  <p className="text-[10px] text-[rgb(var(--fg-subtle))] mb-0.5">{m.author_role === 'pro' ? 'Fotografo' : 'Cliente'}</p>
                  {m.body}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        <div className="px-5 py-3 border-t border-[rgb(var(--border))] space-y-2">
          <div className="flex items-center gap-2">
            <input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
              placeholder={isPro ? 'Rispondi al cliente…' : 'Scrivi una domanda…'} className="flex-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-2.5 text-sm" />
            <button onClick={() => void send()} disabled={sending || !body.trim()} className="h-10 w-10 grid place-items-center rounded-full bg-[rgb(var(--gold-600))] text-white disabled:opacity-40">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          {!isPro && (
            <Button variant="gold" className="w-full !py-2.5" onClick={() => void choose()}>
              <Check size={16} /> Ok, scelgo questo!
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
