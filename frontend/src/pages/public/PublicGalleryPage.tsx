import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, Check, Plus, Download, Share2, ChevronLeft, ChevronRight, X, Images } from 'lucide-react'
import {
  loadGallery, decideMedia, undoMedia, thumbUrl, hiUrl, chaptersOf, fmtEventDate,
  type GData, type GMedia,
} from '@/lib/coupleGallery'

const pad3 = (n: number) => String(n).padStart(3, '0')

export default function PublicGalleryPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<GData | null>(null)
  const [media, setMedia] = useState<GMedia[]>([])
  const [kept, setKept] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<number | null>(null) // indice foto aperta nel viewer (indice globale)

  useEffect(() => {
    (async () => {
      if (!token) { setErr('Link non valido'); setLoading(false); return }
      try {
        const d = await loadGallery(token)
        if (d.error) { setErr(d.error); return }
        setData(d); setMedia(d.media ?? []); setKept(d.selection?.kept ?? 0)
      } catch { setErr('network') }
      finally { setLoading(false) }
    })()
  }, [token])

  const chapters = useMemo(() => chaptersOf(media), [media])
  const flat = useMemo(() => chapters.flatMap((c) => c.items), [chapters]) // ordine di navigazione del viewer
  const total = media.length
  const submitted = data?.selection?.status === 'SUBMITTED'

  async function toggleFav(m: GMedia) {
    if (!token || submitted || !m.in_pool) return
    const wantKeep = m.decision !== true
    // ottimistico
    setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, decision: wantKeep ? true : null } : x)))
    setKept((k) => Math.max(0, k + (wantKeep ? 1 : (m.decision === true ? -1 : 0))))
    const res = wantKeep ? await decideMedia(token, m.id, true) : await undoMedia(token, m.id)
    if (typeof res.kept === 'number') setKept(res.kept)
  }

  if (loading) return <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg))]"><Loader2 className="animate-spin text-[rgb(var(--fg-subtle))]" size={26} /></div>
  if (err || !data) return <GalleryError err={err} />

  const g = data.gallery
  const ph = data.photographer
  const studio = ph.business_name || ph.full_name || 'Il fotografo'
  const coupleName = g.couple_label || g.title || 'La vostra galleria'
  const sel = data.selection
  const target = `${sel.target_min}–${sel.target_max}`

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--fg))]">
      {/* ── MASTHEAD editoriale ── */}
      <header className="max-w-6xl mx-auto px-6 sm:px-10 pt-16 pb-8 text-center">
        {ph.logo && <img src={ph.logo} alt={studio} className="h-9 mx-auto mb-8 opacity-80" />}
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[rgb(var(--fg-subtle))] mb-5">La vostra galleria</p>
        <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] text-[rgb(var(--fg))]">{coupleName}</h1>
        {fmtEventDate(g.event_date) && <p className="font-display italic text-xl text-[rgb(var(--fg-muted))] mt-4">{fmtEventDate(g.event_date)}</p>}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">
          <MetaItem>{total} fotografie</MetaItem>
          <MetaItem>{studio}</MetaItem>
          {g.expires_at && <MetaItem>link fino al {fmtEventDate(g.expires_at)}</MetaItem>}
          <MetaItem>consegnato da {studio}</MetaItem>
        </div>
      </header>

      {/* ── CARD Selezione rapida ── */}
      <div className="max-w-3xl mx-auto px-6 sm:px-10">
        <Link to={`selezione`} className="group block rounded-2xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-50))] px-6 py-6 sm:px-8 transition-shadow hover:shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[rgb(var(--gold-700))]">La selezione per l'album</p>
              <h2 className="font-display text-2xl mt-1.5 text-[rgb(var(--fg))]">{submitted ? 'Selezione inviata' : 'Selezione rapida'}</h2>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-1.5 max-w-md">
                {submitted
                  ? `Avete scelto ${kept} fotografie per l'album. ${studio} le ha ricevute.`
                  : `Passate le foto una a una — tenete quelle che amate. Vi guidiamo fino a ${target} scatti per l'album.`}
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-[rgb(var(--gold-700))]">
              {submitted ? 'Rivedi' : 'Inizia'} <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
          {!submitted && sel.decided > 0 && (
            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[rgb(var(--gold-300))]/60 relative overflow-hidden rounded-full">
                <span className="absolute inset-y-0 left-0 bg-[rgb(var(--gold-500))]" style={{ width: `${Math.round((sel.decided / Math.max(1, sel.pool)) * 100)}%` }} />
              </div>
              <span className="font-mono text-[11px] text-[rgb(var(--gold-700))]">{sel.decided} / {sel.pool}</span>
            </div>
          )}
        </Link>
      </div>

      {/* ── NAV capitoli sticky ── */}
      {chapters.length > 1 && (
        <nav className="sticky top-0 z-20 mt-10 bg-[rgb(var(--bg))]/85 backdrop-blur border-y border-[rgb(var(--border))]">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 flex gap-6 overflow-x-auto no-scrollbar py-3.5">
            {chapters.map((c) => (
              <a key={c.key} href={`#cap-${c.key}`} className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] transition-colors">
                {c.label} <span className="text-[rgb(var(--fg-subtle))]">{c.items.length}</span>
              </a>
            ))}
            <div className="shrink-0 ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--gold-700))]">
              <Check size={13} /> {kept} per l'album
            </div>
          </div>
        </nav>
      )}

      {/* ── CAPITOLI ── */}
      <main className="max-w-6xl mx-auto px-6 sm:px-10 pb-24">
        {chapters.map((c, ci) => {
          const startNo = chapters.slice(0, ci).reduce((s, x) => s + x.items.length, 0)
          return (
            <section key={c.key} id={`cap-${c.key}`} className="pt-14 scroll-mt-20">
              <div className="flex items-baseline justify-between border-b border-[rgb(var(--fg))]/15 pb-3 mb-6">
                <h3 className="font-display text-3xl">{c.label}</h3>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--fg-muted))]">
                  {pad3(startNo + 1)} → {pad3(startNo + c.items.length)} di {pad3(total)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {c.items.map((m, i) => {
                  const globalIdx = flat.findIndex((x) => x.id === m.id)
                  const fav = m.decision === true
                  return (
                    <figure key={m.id} className="group relative">
                      <button onClick={() => setViewer(globalIdx)} className={`block w-full aspect-[3/4] overflow-hidden rounded-md bg-[rgb(var(--bg-sunken))] ${fav ? 'ring-2 ring-[rgb(var(--gold-500))] ring-offset-2 ring-offset-[rgb(var(--bg))]' : ''}`}>
                        <img src={thumbUrl(m)} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                      </button>
                      <figcaption className="absolute left-2 top-2 font-mono text-[10px] tracking-wide text-white/90 drop-shadow">Nº {pad3(startNo + i + 1)}</figcaption>
                      {!submitted && m.in_pool && (
                        <button onClick={() => toggleFav(m)} aria-label={fav ? 'Togli dall’album' : 'Tieni per l’album'} aria-pressed={fav}
                          className={`absolute bottom-2 right-2 grid place-items-center rounded-full transition-all min-w-[44px] min-h-[44px] ${fav ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-black/45 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/60'}`}>
                          {fav ? <Check size={20} /> : <Plus size={20} />}
                        </button>
                      )}
                    </figure>
                  )
                })}
              </div>
            </section>
          )
        })}
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[rgb(var(--border))]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-display italic text-[rgb(var(--fg-muted))]">Realizzato con Planfully</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[rgb(var(--fg-subtle))]">Link privato · non richiede accesso</p>
        </div>
      </footer>

      {/* ── VIEWER fullscreen ── */}
      {viewer != null && flat[viewer] && (
        <Viewer items={flat} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer}
          coupleName={coupleName} submitted={submitted}
          onFav={(m) => toggleFav(m)} />
      )}
    </div>
  )
}

function MetaItem({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center before:content-[''] before:w-6 before:h-px before:bg-[rgb(var(--fg))]/25 before:mr-3 first:before:hidden">{children}</span>
}

// Viewer full screen: fondo inchiostro, frecce, didascalia Bodoni corsivo, azioni.
function Viewer({ items, index, onClose, onIndex, coupleName, submitted, onFav }: {
  items: GMedia[]; index: number; onClose: () => void; onIndex: (i: number) => void
  coupleName: string; submitted: boolean; onFav: (m: GMedia) => void
}) {
  const m = items[index]!
  const go = (d: number) => { const n = index + d; if (n >= 0 && n < items.length) onIndex(n) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })
  const fav = m.decision === true
  const download = () => { const a = document.createElement('a'); a.href = hiUrl(m); a.target = '_blank'; a.rel = 'noopener'; a.download = m.source_name || 'foto.jpg'; document.body.appendChild(a); a.click(); a.remove() }
  const share = async () => { try { await navigator.share?.({ title: coupleName, url: hiUrl(m) }) } catch { /* annullato */ } }
  return (
    <div className="fixed inset-0 z-50 bg-[#0E1116] text-white flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">{index + 1} / {items.length}</span>
        <button onClick={onClose} aria-label="Chiudi" className="grid place-items-center w-11 h-11 rounded-full hover:bg-white/10"><X size={22} /></button>
      </div>
      <div className="flex-1 relative grid place-items-center px-4 min-h-0">
        <button onClick={() => go(-1)} disabled={index === 0} aria-label="Precedente" className="absolute left-3 sm:left-6 grid place-items-center w-12 h-12 rounded-full hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={26} /></button>
        <img src={hiUrl(m)} alt="" className="max-h-full max-w-full object-contain" />
        <button onClick={() => go(1)} disabled={index === items.length - 1} aria-label="Successiva" className="absolute right-3 sm:right-6 grid place-items-center w-12 h-12 rounded-full hover:bg-white/10 disabled:opacity-30"><ChevronRight size={26} /></button>
      </div>
      <div className="px-6 py-5 flex flex-col items-center gap-4">
        <p className="font-display italic text-white/70 text-lg">{coupleName}</p>
        <div className="flex items-center gap-2">
          {!submitted && m.in_pool && (
            <button onClick={() => onFav(m)} aria-pressed={fav} className={`inline-flex items-center gap-2 rounded-full px-5 h-11 font-mono text-xs uppercase tracking-[0.14em] ${fav ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-white/10 text-white hover:bg-white/15'}`}>
              {fav ? <Check size={17} /> : <Plus size={17} />} {fav ? 'Nell’album' : 'Per l’album'}
            </button>
          )}
          <button onClick={download} aria-label="Scarica" className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-white/10 hover:bg-white/15 font-mono text-xs uppercase tracking-[0.14em]"><Download size={17} /> Scarica</button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button onClick={share} aria-label="Condividi" className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-white/10 hover:bg-white/15 font-mono text-xs uppercase tracking-[0.14em]"><Share2 size={17} /> Condividi</button>
          )}
        </div>
      </div>
    </div>
  )
}

function GalleryError({ err }: { err: string | null }) {
  const msg = err === 'not_found' ? 'Galleria non trovata: il link potrebbe essere errato o revocato.'
    : err === 'expired' ? 'Il link della galleria è scaduto. Chiedete al fotografo di riattivarlo.'
    : 'Al momento non riusciamo ad aprire la galleria.'
  return (
    <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg))] px-6 text-center">
      <div>
        <Images size={40} className="mx-auto text-[rgb(var(--fg-subtle))]" />
        <p className="mt-4 font-display text-2xl text-[rgb(var(--fg))]">Un momento…</p>
        <p className="mt-2 text-[rgb(var(--fg-muted))] max-w-sm mx-auto">{msg}</p>
      </div>
    </div>
  )
}
