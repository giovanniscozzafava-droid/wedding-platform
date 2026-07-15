import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, X, Check, RotateCcw, Maximize2, ArrowLeft, Images } from 'lucide-react'
import {
  loadGallery, decideMedia, undoMedia, advanceRound, submitSelection,
  thumbUrl, hiUrl, type GData, type GMedia, type GSelection,
} from '@/lib/coupleGallery'

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const pad3 = (n: number) => String(n).padStart(3, '0')

export default function GallerySwipePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<GData | null>(null)
  const [sel, setSel] = useState<GSelection | null>(null)
  const [queue, setQueue] = useState<GMedia[]>([])      // foto ancora da passare in questo giro
  const [history, setHistory] = useState<GMedia[]>([])  // per annullare
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<GMedia | null>(null)
  const [busy, setBusy] = useState(false)               // invio/avanzamento in corso

  const refresh = useCallback(async () => {
    if (!token) { setErr('Link non valido'); setLoading(false); return }
    try {
      const d = await loadGallery(token)
      if (d.error) { setErr(d.error); return }
      setData(d); setSel(d.selection)
      // pool del giro corrente ancora da decidere
      const pending = (d.media ?? []).filter((m) => m.in_pool && m.decision == null)
      setQueue(pending); setHistory([])
    } catch { setErr('network') }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { void refresh() }, [refresh])

  const studio = data?.photographer.business_name || data?.photographer.full_name || 'il fotografo'
  const roundDone = sel != null && queue.length === 0 && sel.status !== 'SUBMITTED'

  // conteggio "tenute" del giro in tempo reale (server + ottimistico locale)
  const applyState = (s: { kept?: number; decided?: number; pool?: number }) =>
    setSel((prev) => (prev ? { ...prev, kept: s.kept ?? prev.kept, decided: s.decided ?? prev.decided, pool: s.pool ?? prev.pool } : prev))

  async function decide(m: GMedia, keep: boolean) {
    if (!token || busy) return
    setQueue((q) => q.filter((x) => x.id !== m.id))
    setHistory((h) => [{ ...m, decision: keep }, ...h])
    setSel((prev) => (prev ? { ...prev, decided: prev.decided + 1, kept: prev.kept + (keep ? 1 : 0) } : prev))
    const res = await decideMedia(token, m.id, keep)
    if (typeof res.kept === 'number') applyState(res)
  }
  async function undo() {
    if (!token || busy || history.length === 0) return
    const [last, ...rest] = history
    setHistory(rest)
    setQueue((q) => [last!, ...q])
    setSel((prev) => (prev ? { ...prev, decided: Math.max(0, prev.decided - 1), kept: Math.max(0, prev.kept - (last!.decision ? 1 : 0)) } : prev))
    const res = await undoMedia(token, last!.id)
    if (typeof res.kept === 'number') applyState(res)
  }

  // tastiera desktop: ← lascia · → tiene · Backspace annulla · Spazio ingrandisce
  useEffect(() => {
    if (roundDone || !queue[0] || zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); void decide(queue[0]!, true) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); void decide(queue[0]!, false) }
      else if (e.key === 'Backspace') { e.preventDefault(); void undo() }
      else if (e.key === ' ') { e.preventDefault(); setZoom(queue[0]!) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [queue, roundDone, zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg-sunken))]"><Loader2 className="animate-spin text-[rgb(var(--fg-subtle))]" size={26} /></div>
  if (err || !data || !sel) return <SwipeError err={err} token={token} />

  const decidedInRound = sel.decided
  const poolN = sel.pool

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg))] flex flex-col">
      {/* progresso hairline + contatore */}
      <div className="h-0.5 w-full bg-[rgb(var(--border))]">
        <div className="h-full bg-[rgb(var(--gold-500))] transition-[width] duration-300" style={{ width: `${Math.round((decidedInRound / Math.max(1, poolN)) * 100)}%` }} />
      </div>
      <header className="px-5 pt-4 pb-2 max-w-xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <Link to={`..`} relative="path" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><ArrowLeft size={13} /> Galleria</Link>
          <span className="font-mono text-[11px] tracking-wide text-[rgb(var(--fg-muted))]"><b className="text-[rgb(var(--fg))]">{pad3(decidedInRound)}</b> / {pad3(poolN)}</span>
        </div>
        <div className="mt-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[rgb(var(--gold-700))]">Giro {sel.round} · restano le vostre {poolN}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--fg-subtle))] mt-1.5">
            {sel.round > 1 ? `Giro ${sel.round - 1} → ${poolN} · ` : ''}traguardo {sel.target_min}–{sel.target_max}
            <span className="ml-2 text-[rgb(var(--gold-700))]">tenute {sel.kept}</span>
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 pb-6 min-h-0">
        {roundDone
          ? <RoundEnd sel={sel} studio={studio} busy={busy}
              onAdvance={async () => { if (!token) return; setBusy(true); const r = await advanceRound(token); setBusy(false); if (!r.error) await refresh() }}
              onSubmit={async () => { if (!token) return; setBusy(true); const r = await submitSelection(token); setBusy(false); if (r.ok) await refresh() }}
              onRescue={() => { // ripesca: rimetti in coda le scartate di questo giro
                const left = (data.media ?? []).filter((m) => m.in_pool && m.decision === false)
                setQueue(left); setHistory([]) }}
            />
          : <Deck queue={queue} onDecide={decide} onUndo={undo} canUndo={history.length > 0} onZoom={setZoom} />}
      </main>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-[#0E1116] grid place-items-center p-4" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <img src={hiUrl(zoom)} alt="" className="max-h-full max-w-full object-contain" />
          <button onClick={() => setZoom(null)} aria-label="Chiudi" className="absolute top-4 right-4 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/15"><X size={22} /></button>
        </div>
      )}
    </div>
  )
}

// ── Mazzo di carte: la carta in cima è trascinabile; 2 dietro ruotate ──
function Deck({ queue, onDecide, onUndo, canUndo, onZoom }: {
  queue: GMedia[]; onDecide: (m: GMedia, keep: boolean) => void; onUndo: () => void; canUndo: boolean; onZoom: (m: GMedia) => void
}) {
  const top = queue[0]
  return (
    <>
      <div className="relative w-full max-w-[22rem] aspect-[3/4] mx-auto select-none">
        {queue.slice(0, 3).reverse().map((m, i, arr) => {
          const depth = arr.length - 1 - i // 0 = top
          if (depth === 0) return <TopCard key={m.id} m={m} onDecide={onDecide} onZoom={onZoom} />
          return (
            <div key={m.id} aria-hidden className="absolute inset-0" style={{ transform: `rotate(${depth % 2 ? depth * 2 : -depth * 2}deg) scale(${1 - depth * 0.03})`, zIndex: 1 }}>
              <PhotoCard m={m} dim />
            </div>
          )
        })}
        {!top && <div className="absolute inset-0 grid place-items-center text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" size={22} /></div>}
      </div>

      {/* bottoni */}
      <div className="mt-8 flex items-center justify-center gap-5">
        <IconBtn label="Annulla ultima" size={46} disabled={!canUndo} onClick={onUndo}><RotateCcw size={20} /></IconBtn>
        <IconBtn label="Lascia" size={64} tone="rose" disabled={!top} onClick={() => top && onDecide(top, false)}><X size={28} /></IconBtn>
        <IconBtn label="Tieni per l’album" size={64} tone="gold" disabled={!top} onClick={() => top && onDecide(top, true)}><Check size={28} /></IconBtn>
        <IconBtn label="Ingrandisci" size={46} disabled={!top} onClick={() => top && onZoom(top)}><Maximize2 size={18} /></IconBtn>
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--fg-subtle))] text-center">
        Trascina o usa i tasti · <span className="text-[rgb(var(--gold-700))]">→ tieni</span> · ← lascia
      </p>
    </>
  )
}

// Carta trascinabile in cima con timbro "PER L'ALBUM" / "LASCIA".
function TopCard({ m, onDecide, onZoom }: { m: GMedia; onDecide: (m: GMedia, keep: boolean) => void; onZoom: (m: GMedia) => void }) {
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false })
  const [exit, setExit] = useState<0 | 1 | -1>(0) // 1 = vola a destra (tieni), -1 = sinistra (lascia)
  const start = useRef<{ x: number; y: number } | null>(null)
  const THRESH = 110

  useEffect(() => { setDrag({ dx: 0, dy: 0, active: false }); setExit(0) }, [m.id])

  const onDown = (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; setDrag((d) => ({ ...d, active: true })); (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => { if (!start.current) return; setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y, active: true }) }
  const onUp = () => {
    if (!start.current) return
    const dx = drag.dx; start.current = null
    if (dx > THRESH) commit(true)
    else if (dx < -THRESH) commit(false)
    else setDrag({ dx: 0, dy: 0, active: false })
  }
  const commit = (keep: boolean) => {
    setDrag((d) => ({ ...d, active: false }))
    if (REDUCED) { onDecide(m, keep); return }
    setExit(keep ? 1 : -1)
    window.setTimeout(() => onDecide(m, keep), 200)
  }

  const dx = exit ? exit * 700 : drag.dx
  const rot = exit ? exit * 18 : drag.dx / 22
  const keepOp = Math.max(0, Math.min(1, drag.dx / THRESH))
  const leaveOp = Math.max(0, Math.min(1, -drag.dx / THRESH))
  const style: React.CSSProperties = REDUCED
    ? { opacity: exit ? 0 : 1, transition: drag.active ? 'none' : 'opacity .2s ease' }
    : { transform: `translate(${dx}px, ${exit ? 0 : drag.dy}px) rotate(${rot}deg)`, transition: drag.active ? 'none' : 'transform .2s ease-out', zIndex: 2 }

  return (
    <div className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing" style={style}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={() => onZoom(m)}>
      <PhotoCard m={m}
        stamp={keepOp > 0.05 ? { text: 'Per l’album', op: keepOp, tone: 'gold' } : leaveOp > 0.05 ? { text: 'Lascia', op: leaveOp, tone: 'rose' } : undefined} />
    </div>
  )
}

// Carta fotografica: carta bianca, bordo stampa, foto 3/4, didascalia mono sotto.
function PhotoCard({ m, dim, stamp }: { m: GMedia; dim?: boolean; stamp?: { text: string; op: number; tone: 'gold' | 'rose' } }) {
  return (
    <div className={`w-full h-full rounded-xl bg-white p-2.5 pb-8 shadow-[var(--shadow-lift)] border border-black/5 ${dim ? 'opacity-70' : ''}`}>
      <div className="relative w-full h-full rounded-md overflow-hidden bg-[rgb(var(--bg-sunken))]">
        <img src={thumbUrl(m)} alt="" draggable={false} className="w-full h-full object-cover" />
        {stamp && (
          <span aria-hidden className={`absolute top-5 left-4 -rotate-[14deg] font-mono text-lg uppercase tracking-[0.14em] px-3 py-1 rounded border-2 ${stamp.tone === 'gold' ? 'text-[rgb(var(--gold-700))] border-[rgb(var(--gold-500))]' : 'text-[rgb(var(--rose-600))] border-[rgb(var(--rose-500))]'}`} style={{ opacity: stamp.op }}>
            {stamp.text}
          </span>
        )}
      </div>
      <p className="absolute bottom-2.5 left-0 right-0 text-center font-mono text-[10px] tracking-wide text-[rgb(var(--fg-subtle))] truncate px-3">{m.source_name || m.album_moment || 'Fotografia'}</p>
    </div>
  )
}

function IconBtn({ children, label, size, tone, disabled, onClick }: { children: React.ReactNode; label: string; size: number; tone?: 'gold' | 'rose'; disabled?: boolean; onClick: () => void }) {
  const base = tone === 'gold' ? 'bg-[rgb(var(--gold-500))] text-white shadow-[var(--shadow-lift)]'
    : tone === 'rose' ? 'bg-white text-[rgb(var(--rose-600))] border border-[rgb(var(--rose-300))] shadow-[var(--shadow-soft)]'
    : 'bg-white text-[rgb(var(--fg-muted))] border border-[rgb(var(--border-strong))]'
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`grid place-items-center rounded-full transition-transform active:scale-90 disabled:opacity-40 ${base}`} style={{ width: size, height: size }}>
      {children}
    </button>
  )
}

// Fine giro: decide la CTA in base alle tenute (logica a giri 60–120).
function RoundEnd({ sel, studio, busy, onAdvance, onSubmit, onRescue }: {
  sel: GSelection; studio: string; busy: boolean; onAdvance: () => void; onSubmit: () => void; onRescue: () => void
}) {
  const { kept, target_min: min, target_max: max, status } = sel
  if (status === 'SUBMITTED') return (
    <div className="text-center max-w-sm">
      <Check size={34} className="mx-auto text-[rgb(var(--gold-600))]" />
      <h2 className="font-display text-3xl mt-4">Selezione inviata</h2>
      <p className="text-[rgb(var(--fg-muted))] mt-3">Avete scelto <b>{kept}</b> fotografie per l'album. Le abbiamo consegnate a {studio}: preparerà la vostra bozza.</p>
      <Link to=".." relative="path" className="inline-block mt-6 font-mono text-xs uppercase tracking-[0.16em] text-[rgb(var(--gold-700))] underline underline-offset-4">Torna alla galleria</Link>
    </div>
  )
  const above = kept > max
  const below = kept < min
  return (
    <div className="text-center max-w-sm">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--fg-subtle))]">Giro {sel.round} completato</p>
      <h2 className="font-display text-4xl mt-3">Ne avete tenute <span className="text-[rgb(var(--gold-700))]">{kept}</span></h2>
      {above && <>
        <p className="text-[rgb(var(--fg-muted))] mt-3">Sono ancora tante: per l'album ne servono al massimo {max}. Fatene un altro giro, solo sulle vostre {kept} — sarà più facile.</p>
        <button onClick={onAdvance} disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-full h-12 px-7 bg-[rgb(var(--gold-500))] text-white font-mono text-xs uppercase tracking-[0.16em] disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16} /> : null} Fai un altro giro</button>
      </>}
      {below && <>
        <p className="text-[rgb(var(--fg-muted))] mt-3">Per l'album servono almeno {min} fotografie — ripescatene ancora <b>{min - kept}</b> tra quelle lasciate.</p>
        <button onClick={onRescue} className="mt-6 inline-flex items-center gap-2 rounded-full h-12 px-7 bg-white border border-[rgb(var(--border-strong))] font-mono text-xs uppercase tracking-[0.16em]">Ripesca dalle lasciate</button>
      </>}
      {!above && !below && <>
        <p className="text-[rgb(var(--fg-muted))] mt-3">Perfetto: siete nel traguardo ({min}–{max}). Inviate la selezione e {studio} preparerà la bozza.</p>
        <button onClick={onSubmit} disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-full h-12 px-7 bg-[rgb(var(--gold-500))] text-white font-mono text-xs uppercase tracking-[0.16em] disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Invia la selezione a {studio}</button>
      </>}
    </div>
  )
}

function SwipeError({ err, token }: { err: string | null; token?: string }) {
  const msg = err === 'not_found' ? 'Selezione non trovata: link errato o revocato.'
    : err === 'expired' ? 'Il link è scaduto.' : 'Al momento non riusciamo ad aprire la selezione.'
  return (
    <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg-sunken))] px-6 text-center">
      <div>
        <Images size={38} className="mx-auto text-[rgb(var(--fg-subtle))]" />
        <p className="mt-4 font-display text-2xl">Un momento…</p>
        <p className="mt-2 text-[rgb(var(--fg-muted))] max-w-sm mx-auto">{msg}</p>
        {token && <Link to=".." relative="path" className="inline-block mt-5 font-mono text-xs uppercase tracking-[0.16em] text-[rgb(var(--gold-700))] underline underline-offset-4">Torna alla galleria</Link>}
      </div>
    </div>
  )
}
