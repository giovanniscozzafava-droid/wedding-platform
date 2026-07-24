import { useEffect, useMemo, useRef, useState } from 'react'
import { Heart, X, Undo2, RotateCcw, Check, Play, Images, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

// Selezione album "a la Tinder": una media alla volta, Tieni/Scarta, con Annulla e
// tab per rivedere Tenute/Scarti e RECUPERARE gli scarti. Foto e video.

export type AlbumMedia = { id: string; thumbnail_link: string | null; drive_file_id: string; media_type: string; album_choice: 'KEPT' | 'DISCARDED' | null }

const isDrive = (m: AlbumMedia) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-') && !m.drive_file_id.startsWith('guest:')
const big = (m: AlbumMedia) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

export function AlbumPicker({ media, onClose, onChanged }: { media: AlbumMedia[]; onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<AlbumMedia[]>(media)
  const [view, setView] = useState<'deck' | 'KEPT' | 'DISCARDED'>('deck')
  const [history, setHistory] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [viewer, setViewer] = useState<number | null>(null) // indice foto aperta a schermo intero

  const pending = useMemo(() => items.filter((m) => m.album_choice == null), [items])
  const kept = useMemo(() => items.filter((m) => m.album_choice === 'KEPT'), [items])
  const discarded = useMemo(() => items.filter((m) => m.album_choice === 'DISCARDED'), [items])

  async function setChoice(id: string, choice: 'KEPT' | 'DISCARDED' | null, track = true) {
    setBusy(true)
    setItems((arr) => arr.map((m) => (m.id === id ? { ...m, album_choice: choice } : m)))
    if (track) setHistory((h) => [...h, id])
    const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { error?: string } }> })
      .rpc('set_album_choice', { p_media: id, p_choice: choice })
    setBusy(false)
    if (data?.error) { toast.error('Non salvato: ' + data.error); setItems(media); return }
    onChanged()
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    void setChoice(last, null, false)
  }

  const cur = pending[0]
  const Tab = ({ id, label, n }: { id: typeof view; label: string; n: number }) => (
    <button onClick={() => setView(id)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium ${view === id ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]'}`}>
      {label} {n}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between gap-2 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Tab id="deck" label="Da scegliere" n={pending.length} />
          <Tab id="KEPT" label="Tenute" n={kept.length} />
          <Tab id="DISCARDED" label="Scarti" n={discarded.length} />
        </div>
        <button className="p-1.5 rounded hover:bg-white/10" onClick={onClose} aria-label="Chiudi"><X size={18} className="text-white" /></button>
      </div>

      {view === 'deck' ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 min-h-0 gap-4" onClick={(e) => e.stopPropagation()}>
          {!cur ? (
            <div className="text-center text-white/80 space-y-2">
              <Check size={36} className="mx-auto text-[rgb(var(--gold-400))]" />
              <p className="text-sm">Hai scelto tutte le foto. {kept.length} tenute, {discarded.length} scartate.</p>
              <Button variant="gold" size="sm" onClick={onClose}>Fine</Button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 w-full grid place-items-center">
                <div className="relative max-h-full max-w-md grid place-items-center">
                  {cur.media_type === 'VIDEO' && !isDrive(cur)
                    ? <video src={cur.thumbnail_link ?? ''} controls className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl" />
                    : <img src={big(cur)} alt="" className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl select-none" />}
                  {cur.media_type === 'VIDEO' && <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-black/55 text-white text-[11px] px-2 py-1 rounded-full"><Play size={11} className="fill-white" /> video</span>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button disabled={busy} onClick={() => setChoice(cur.id, 'DISCARDED')}
                  className="h-14 w-14 rounded-full bg-white text-[rgb(var(--rose-600,220_60_60))] shadow-lg flex items-center justify-center hover:scale-105 transition disabled:opacity-50" aria-label="Scarta">
                  <X size={26} className="text-rose-500" />
                </button>
                <button disabled={history.length === 0 || busy} onClick={undo}
                  className="h-11 w-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition disabled:opacity-30" aria-label="Annulla">
                  <Undo2 size={18} />
                </button>
                <button disabled={busy} onClick={() => setChoice(cur.id, 'KEPT')}
                  className="h-14 w-14 rounded-full bg-[rgb(var(--gold-500))] text-white shadow-lg flex items-center justify-center hover:scale-105 transition disabled:opacity-50" aria-label="Tieni">
                  <Heart size={24} className="fill-white" />
                </button>
              </div>
              <p className="text-white/50 text-xs">Restano {pending.length}</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0" onClick={(e) => e.stopPropagation()}>
          {(view === 'KEPT' ? kept : discarded).length === 0 ? (
            <p className="text-white/60 text-sm text-center py-12 flex flex-col items-center gap-2"><Images size={28} /> {view === 'KEPT' ? 'Niente di tenuto ancora.' : 'Nessuno scarto.'}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-w-3xl mx-auto">
              {(view === 'KEPT' ? kept : discarded).map((m, i) => (
                <div key={m.id} onClick={() => setViewer(i)} className="relative rounded-md overflow-hidden bg-white/5 cursor-pointer group" style={{ aspectRatio: '4/3' }} title="Tocca per ingrandire">
                  {m.thumbnail_link && <img src={m.thumbnail_link} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  {m.media_type === 'VIDEO' && <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 bg-black/55 text-white text-[9px] px-1.5 py-0.5 rounded-full"><Play size={9} className="fill-white" /></span>}
                  <button onClick={(e) => { e.stopPropagation(); void setChoice(m.id, view === 'KEPT' ? 'DISCARDED' : 'KEPT') }}
                    title={view === 'KEPT' ? 'Scarta' : 'Recupera'}
                    className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition hover:bg-black/75">
                    {view === 'KEPT' ? <X size={14} /> : <RotateCcw size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewer != null && view !== 'deck' && (
        <FullViewer
          items={view === 'KEPT' ? kept : discarded}
          start={viewer}
          actionLabel={view === 'KEPT' ? 'Scarta' : 'Recupera'}
          actionIcon={view === 'KEPT' ? 'x' : 'recover'}
          onDecide={(m) => void setChoice(m.id, view === 'KEPT' ? 'DISCARDED' : 'KEPT')}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  )
}

// Visore a schermo intero per rivedere Tenute/Scarti: FOTO INTERA (contain), non ritagliata.
// PC: frecce laterali + tastiera ← → · Esc; il click sulla foto avanza (slideshow).
// Mobile/tablet: swipe (trascina) sinistra/destra per scorrere, stile Tinder.
function FullViewer({ items, start, actionLabel, actionIcon, onDecide, onClose }: {
  items: AlbumMedia[]; start: number; actionLabel: string; actionIcon: 'x' | 'recover'
  onDecide: (m: AlbumMedia) => void; onClose: () => void
}) {
  const [i, setI] = useState(start)
  const [drag, setDrag] = useState(0)
  const startRef = useRef<number | null>(null)
  const idx = Math.min(i, items.length - 1)
  const m = items[idx]

  const go = (d: 1 | -1) => setI((v) => Math.max(0, Math.min(items.length - 1, v + d)))
  useEffect(() => { if (items.length === 0) onClose() }, [items.length, onClose])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return null
  const onDown = (e: React.PointerEvent) => { startRef.current = e.clientX; try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ok */ } }
  const onMove = (e: React.PointerEvent) => { if (startRef.current != null) setDrag(e.clientX - startRef.current) }
  const onUp = () => { const dx = drag; startRef.current = null; setDrag(0); if (dx < -70) go(1); else if (dx > 70) go(-1) }

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between p-3 text-white/90 shrink-0">
        <span className="font-mono text-xs tracking-wide">{idx + 1} / {items.length}</span>
        <button onClick={onClose} aria-label="Chiudi" className="grid place-items-center w-10 h-10 rounded-full hover:bg-white/10"><X size={20} /></button>
      </div>
      <div className="flex-1 relative grid place-items-center px-2 min-h-0 select-none touch-none overflow-hidden"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <button onClick={() => go(-1)} disabled={idx === 0} aria-label="Precedente" className="hidden sm:grid place-items-center absolute left-3 z-10 w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25"><ChevronLeft size={26} /></button>
        {m.media_type === 'VIDEO' && !isDrive(m)
          ? <video src={m.thumbnail_link ?? ''} controls className="max-h-full max-w-full object-contain" />
          : <img src={big(m)} alt="" draggable={false} onClick={() => go(1)}
              className="max-h-full max-w-full object-contain"
              style={{ transform: `translateX(${drag}px)`, transition: startRef.current == null ? 'transform .2s' : 'none' }} />}
        <button onClick={() => go(1)} disabled={idx === items.length - 1} aria-label="Successiva" className="hidden sm:grid place-items-center absolute right-3 z-10 w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25"><ChevronRight size={26} /></button>
      </div>
      <div className="shrink-0 flex items-center justify-center gap-3 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <button onClick={() => onDecide(m)}
          className="inline-flex items-center gap-2 rounded-full h-11 px-5 bg-white/10 text-white hover:bg-white/20 font-mono text-xs uppercase tracking-[0.14em]">
          {actionIcon === 'x' ? <X size={16} /> : <RotateCcw size={16} />} {actionLabel}
        </button>
      </div>
      <p className="sm:hidden text-center text-white/40 text-[10px] pb-2">scorri per cambiare foto</p>
    </div>
  )
}
