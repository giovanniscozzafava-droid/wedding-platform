// SCELTA DELLE FOTO IN COPERTINA, pensata per il telefono: un foglio a schermo intero (sul
// computer una finestra centrata) con le foto della selezione album in miniature grandi,
// un'anteprima in alto di quella toccata e un tasto «Usa questa foto». I modelli a più finestre
// (Julies Cristalwhite, Trilogy: tre) chiedono tante foto quante sono le finestre, IN ORDINE:
// il numero sulla miniatura dice in quale finestra va.
import { useEffect, useState } from 'react'
import { Check, X, ImageIcon } from '@/components/icons/lucide'
import type { CoverPhotoCandidate } from '@/hooks/useAlbumOrder'

export function CoverPhotoPicker({ photos, value, values, max = 1, onPick, onPickMany, onClose, loading }: {
  photos: CoverPhotoCandidate[]
  /** la foto già scelta (modelli a una finestra) */
  value?: string | null
  /** le foto già scelte, in ordine (modelli a più finestre) */
  values?: string[]
  /** quante finestre ha la copertina del modello */
  max?: number
  onPick: (p: CoverPhotoCandidate) => void
  onPickMany?: (ps: CoverPhotoCandidate[]) => void
  onClose: () => void
  loading?: boolean
}) {
  const multi = max > 1
  const [cur, setCur] = useState<CoverPhotoCandidate | null>(photos.find((p) => p.id === value) ?? null)
  const [picked, setPicked] = useState<CoverPhotoCandidate[]>(() => (values ?? []).map((id) => photos.find((p) => p.id === id)).filter((p): p is CoverPhotoCandidate => !!p))
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => { if (!cur && value) setCur(photos.find((p) => p.id === value) ?? null) }, [photos, value]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!picked.length && values?.length) setPicked(values.map((id) => photos.find((p) => p.id === id)).filter((p): p is CoverPhotoCandidate => !!p)) }, [photos, values]) // eslint-disable-line react-hooks/exhaustive-deps

  // tocco su una miniatura: a una finestra la mostro grande; a più finestre la aggiungo (o la tolgo) in ordine
  const tap = (p: CoverPhotoCandidate) => {
    setCur(p)
    if (!multi) return
    setPicked((ps) => ps.some((x) => x.id === p.id) ? ps.filter((x) => x.id !== p.id) : ps.length < max ? [...ps, p] : [...ps.slice(0, max - 1), p])
  }
  const done = multi ? picked.length === max : !!cur
  const confirm = () => { if (multi) onPickMany?.(picked); else if (cur) onPick(cur); onClose() }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-2xl h-[92dvh] sm:h-[85vh] bg-[rgb(var(--bg))] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* testa */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[rgb(var(--border))]">
          <div>
            <p className="font-display text-lg leading-tight">{multi ? `Le ${max} foto in copertina` : 'La foto in copertina'}</p>
            <p className="text-[12px] text-[rgb(var(--fg-muted))]">
              {multi ? `Questo modello ha ${max} finestre: tocca ${max} foto, nell'ordine in cui le vuoi (da sinistra a destra). Scelte ${picked.length} di ${max}.` : `Tra le ${photos.length} scelte per l'album. Una sola.`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="h-10 w-10 grid place-items-center rounded-full border border-[rgb(var(--border))]"><X size={18} /></button>
        </div>
        {/* anteprima della foto toccata (a più finestre: le scelte in fila, nell'ordine delle finestre) */}
        <div className="relative bg-[rgb(var(--bg-sunken))] shrink-0" style={{ height: '38%' }}>
          {multi ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 p-3">
              {Array.from({ length: max }, (_, i) => picked[i]).map((p, i) => (
                <div key={i} className="relative h-full flex-1 max-w-[32%] overflow-hidden rounded-xl border-2 border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg))] grid place-items-center">
                  {p ? <img src={p.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="text-[11px] text-[rgb(var(--fg-subtle))]">finestra {i + 1}</span>}
                  <span className="absolute top-1.5 left-1.5 h-6 w-6 grid place-items-center rounded-full bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] text-[12px] font-medium">{i + 1}</span>
                </div>
              ))}
            </div>
          ) : cur
            ? <img src={cur.thumb} alt="" className="absolute inset-0 h-full w-full object-contain" />
            : <div className="absolute inset-0 grid place-items-center text-sm text-[rgb(var(--fg-subtle))] px-6 text-center"><span><ImageIcon size={22} className="mx-auto mb-1" /> Tocca una foto qui sotto per vederla grande</span></div>}
          {done && (
            <button type="button" onClick={confirm}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] px-5 py-2.5 text-sm font-medium shadow-lg">
              <Check size={16} /> {multi ? `Usa queste ${max} foto` : 'Usa questa foto'}
            </button>
          )}
        </div>
        {/* griglia grande, scorre lei */}
        <div className="flex-1 overflow-auto p-2">
          {loading && <p className="p-4 text-sm text-[rgb(var(--fg-muted))]">Carico le foto della selezione…</p>}
          {!loading && photos.length === 0 && <p className="p-4 text-sm text-[rgb(var(--fg-muted))]">Nessuna foto scelta per l'album ancora: prima seleziona le preferite nella galleria.</p>}
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p) => {
              const on = cur?.id === p.id
              const idx = multi ? picked.findIndex((x) => x.id === p.id) : (value === p.id ? 0 : -1)
              return (
                <button key={p.id} type="button" onClick={() => tap(p)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 ${on || idx >= 0 ? 'border-[rgb(var(--gold-500))]' : 'border-transparent'}`}>
                  <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {idx >= 0 && <span className="absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] text-[12px] font-medium">{multi ? idx + 1 : <Check size={13} />}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
