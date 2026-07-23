import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, X, Undo2, ArrowLeft, Loader2, Check, Images } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// SELEZIONE LATO FOTOGRAFO, stile "Tinder" (come lo swipe degli sposi ma per il tuo cuore).
// Passata a tutto schermo: destra = tieni, sinistra = scarta. Scrive pick_photographer (owner-only,
// indipendente dalla selezione degli sposi e dalle selezioni di lavoro album/carosello).
// Rotta: /foto-selezione/:entryId (RequireAuth). Mobile-first.
type P = { id: string; thumbnail_link: string | null; pick_photographer: boolean | null }

export default function AlbumSelectSwipePage() {
  const { entryId } = useParams<{ entryId: string }>()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(true)
  const [queue, setQueue] = useState<P[]>([])
  const [history, setHistory] = useState<{ m: P; keep: boolean }[]>([])
  const [kept, setKept] = useState(0)
  const [total, setTotal] = useState(0)
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null)
  const [exit, setExit] = useState<0 | 1 | -1>(0) // 1 = vola a destra (tieni), -1 = sinistra (scarta)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let cancel = false
    void (async () => {
      if (!entryId) return
      const { data: { user } } = await supabase.auth.getUser()
      const { data: gal } = await (supabase.from as any)('event_galleries').select('owner_id').eq('entry_id', entryId).maybeSingle()
      let admin = false
      if (user) { const { data: pr } = await (supabase.from as any)('profiles').select('role').eq('id', user.id).maybeSingle(); admin = pr?.role === 'ADMIN' }
      const ok = !!user && (gal?.owner_id === user.id || admin)
      const { data: gm } = await (supabase.from as any)('gallery_media')
        .select('id, thumbnail_link, pick_photographer').eq('entry_id', entryId).eq('media_type', 'PHOTO').order('id')
      if (cancel) return
      const all = (gm ?? []) as P[]
      setAllowed(ok); setTotal(all.length); setKept(all.filter((m) => m.pick_photographer).length)
      setQueue(all); setLoading(false)
    })()
    return () => { cancel = true }
  }, [entryId])

  const current = queue[0] ?? null
  const next = queue[1] ?? null

  const decide = useCallback((m: P, keep: boolean) => {
    setDrag(null); startRef.current = null
    setQueue((q) => q.slice(1))
    setHistory((h) => [{ m, keep }, ...h])
    setKept((k) => k + (keep ? 1 : 0) - (m.pick_photographer ? 1 : 0))
    void (async () => { const { error } = await (supabase.rpc as any)('photographer_toggle_pick', { p_media: m.id, p_pick: keep }); if (error) toast.error('Non salvato') })()
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      const last = h[0]; if (!last) return h
      setQueue((q) => [last.m, ...q])
      setKept((k) => k - (last.keep ? 1 : 0) + (last.m.pick_photographer ? 1 : 0))
      void (supabase.rpc as any)('photographer_toggle_pick', { p_media: last.m.id, p_pick: !!last.m.pick_photographer })
      return h.slice(1)
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return
      if (e.key === 'ArrowRight') { e.preventDefault(); decide(current, true) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); decide(current, false) }
      else if (e.key === 'Backspace' || ((e.key === 'z') && (e.metaKey || e.ctrlKey))) { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [current, decide, undo])

  // RIAPRI LE SCARTATE: dopo la passata, rivedi le foto NON selezionate per sceglierle ancora.
  const reviewDiscarded = useCallback(() => {
    if (!entryId) return
    void (async () => {
      const { data: gm } = await (supabase.from as any)('gallery_media')
        .select('id, thumbnail_link, pick_photographer').eq('entry_id', entryId).eq('media_type', 'PHOTO').eq('pick_photographer', false).order('id')
      const list = (gm ?? []) as P[]
      if (!list.length) { toast.message('Nessuna scartata da rivedere'); return }
      setHistory([]); setQueue(list)
    })()
  }, [entryId])

  const onDown = (e: React.PointerEvent) => { startRef.current = { x: e.clientX, y: e.clientY }; try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ok */ } }
  const onMove = (e: React.PointerEvent) => { if (!startRef.current) return; setDrag({ dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y }) }
  // Vola via poi decidi: feel pulito/dopaminergico (come lo swipe della coppia).
  const fly = (keep: boolean) => { if (!current) return; setExit(keep ? 1 : -1); window.setTimeout(() => { setExit(0); decide(current, keep) }, 190) }
  const onUp = () => {
    const s = startRef.current; startRef.current = null
    if (!s || !current) { setDrag(null); return }
    const dx = drag?.dx ?? 0; const TH = 90
    if (dx > TH) fly(true)
    else if (dx < -TH) fly(false)
    else setDrag(null)
  }

  const done = !loading && allowed && !current
  const dx = drag?.dx ?? 0
  const dir = dx > 40 ? 'keep' : dx < -40 ? 'skip' : null
  const flying = exit !== 0
  const cardDx = flying ? exit * 700 : dx
  const cardRot = flying ? exit * 18 : dx / 22

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-[rgb(var(--bg-sunken))] select-none">
      <header className="sticky top-0 z-20 bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))] px-3 pb-2 flex items-center gap-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <Link to={`/album/${entryId}`} className="p-1.5 -ml-1 shrink-0 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><ArrowLeft size={20} /></Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base leading-tight truncate">La tua selezione</p>
          <p className="text-[11px] text-[rgb(var(--fg-muted))] truncate">Destra tieni · sinistra scarta · il tuo cuore</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-sm"><Heart size={15} className="fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))]" /> <b>{kept}</b></span>
      </header>

      {total > 0 && !done && (
        <div className="h-1 bg-[rgb(var(--bg-sunken))]"><div className="h-full bg-[rgb(var(--gold-500))] transition-[width] duration-300" style={{ width: `${Math.round(((total - queue.length) / Math.max(1, total)) * 100)}%` }} /></div>
      )}

      <div className="flex-1 min-h-0 relative overflow-hidden p-4 flex items-center justify-center">
        {loading ? (
          <Loader2 className="animate-spin text-[rgb(var(--fg-muted))]" />
        ) : !allowed ? (
          <p className="text-sm text-[rgb(var(--fg-muted))] text-center">Solo il fotografo proprietario può fare la selezione qui.</p>
        ) : done ? (
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-[rgb(var(--gold-100))] grid place-items-center"><Check size={26} className="text-[rgb(var(--gold-600))]" /></div>
            <h1 className="font-display text-2xl mb-1">Selezione fatta</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-6">Hai messo il cuore a <strong>{kept}</strong> foto su {total}. Ora, nell'album o nel carosello, premi <strong>«Importa: La mia»</strong> per usarle.</p>
            <div className="flex flex-col gap-2">
              <button onClick={reviewDiscarded} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[rgb(var(--gold-300))] text-[rgb(var(--gold-700))] text-sm font-medium py-3"><Undo2 size={16} /> Rivedi le scartate</button>
              <Link to={`/album/${entryId}`}><span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--gold-500))] text-white text-sm font-medium py-3"><Images size={16} /> Vai all'impaginatore</span></Link>
              <button onClick={() => window.location.reload()} className="text-xs text-[rgb(var(--gold-700))] hover:underline">Rivedi tutto da capo</button>
            </div>
          </div>
        ) : current ? (
          <>
            {/* carta sotto (la prossima) */}
            {next && (
              <div className="absolute w-[min(88vw,520px)] aspect-[3/4] rounded-2xl overflow-hidden shadow-lg opacity-70 scale-[0.96]">
                {next.thumbnail_link && <img src={next.thumbnail_link} alt="" className="w-full h-full object-contain bg-black" draggable={false} />}
              </div>
            )}
            {/* carta corrente (trascinabile) */}
            <div
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              className="absolute w-[min(88vw,520px)] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl bg-black touch-none cursor-grab active:cursor-grabbing"
              style={{ transform: `translate(${cardDx}px, ${flying ? 0 : (drag?.dy ?? 0) * 0.15}px) rotate(${cardRot}deg)`, transition: (drag && !flying) ? 'none' : 'transform .2s ease-out', opacity: flying ? 0 : 1 }}>
              {current.thumbnail_link
                ? <img src={current.thumbnail_link} alt="" className="w-full h-full object-contain" draggable={false} />
                : <div className="w-full h-full grid place-items-center text-white/60 text-sm">senza anteprima</div>}
              {/* etichette live */}
              {dir === 'keep' && <span className="absolute top-5 left-5 rotate-[-12deg] border-2 border-emerald-400 text-emerald-300 font-bold uppercase tracking-widest text-lg px-3 py-1 rounded">Tieni</span>}
              {dir === 'skip' && <span className="absolute top-5 right-5 rotate-[12deg] border-2 border-rose-400 text-rose-300 font-bold uppercase tracking-widest text-lg px-3 py-1 rounded">Scarta</span>}
              {current.pick_photographer && dir == null && <span className="absolute top-3 right-3"><Heart size={18} className="fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))] drop-shadow" /></span>}
            </div>
          </>
        ) : null}
      </div>

      {!loading && allowed && !done && current && (
        <div className="shrink-0 bg-[rgb(var(--bg))] border-t border-[rgb(var(--border))] px-4 pt-3 flex items-center justify-center gap-5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button onClick={() => fly(false)} title="Scarta (←)" className="h-14 w-14 rounded-full border-2 border-rose-300 text-rose-500 grid place-items-center hover:bg-rose-50 active:scale-95 transition"><X size={26} /></button>
          <button onClick={undo} disabled={!history.length} title="Annulla" className="h-10 w-10 rounded-full border border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] grid place-items-center disabled:opacity-40 hover:bg-[rgb(var(--bg-sunken))]"><Undo2 size={18} /></button>
          <button onClick={() => fly(true)} title="Tieni (→)" className="h-14 w-14 rounded-full bg-[rgb(var(--gold-500))] text-white grid place-items-center hover:bg-[rgb(var(--gold-600))] active:scale-95 transition"><Heart size={24} className="fill-white" /></button>
        </div>
      )}
    </div>
  )
}
