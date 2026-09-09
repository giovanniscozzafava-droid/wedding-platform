// SCELTA DELLA FOTO IN COPERTINA, pensata per il telefono: un foglio a schermo intero (sul
// computer una finestra centrata) con le foto della selezione album in miniature grandi,
// un'anteprima in alto di quella toccata e un tasto «Usa questa foto». Una foto sola.
import { useEffect, useState } from 'react'
import { Check, X, ImageIcon } from '@/components/icons/lucide'
import type { CoverPhotoCandidate } from '@/hooks/useAlbumOrder'

export function CoverPhotoPicker({ photos, value, onPick, onClose, loading }: {
  photos: CoverPhotoCandidate[]
  value?: string | null
  onPick: (p: CoverPhotoCandidate) => void
  onClose: () => void
  loading?: boolean
}) {
  const [cur, setCur] = useState<CoverPhotoCandidate | null>(photos.find((p) => p.id === value) ?? null)
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => { if (!cur && value) setCur(photos.find((p) => p.id === value) ?? null) }, [photos, value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-2xl h-[92dvh] sm:h-[85vh] bg-[rgb(var(--bg))] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* testa */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[rgb(var(--border))]">
          <div>
            <p className="font-display text-lg leading-tight">La foto in copertina</p>
            <p className="text-[12px] text-[rgb(var(--fg-muted))]">Tra le {photos.length} scelte per l'album. Una sola.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="h-10 w-10 grid place-items-center rounded-full border border-[rgb(var(--border))]"><X size={18} /></button>
        </div>
        {/* anteprima della foto toccata */}
        <div className="relative bg-[rgb(var(--bg-sunken))] shrink-0" style={{ height: '38%' }}>
          {cur
            ? <img src={cur.thumb} alt="" className="absolute inset-0 h-full w-full object-contain" />
            : <div className="absolute inset-0 grid place-items-center text-sm text-[rgb(var(--fg-subtle))] px-6 text-center"><span><ImageIcon size={22} className="mx-auto mb-1" /> Tocca una foto qui sotto per vederla grande</span></div>}
          {cur && (
            <button type="button" onClick={() => { onPick(cur); onClose() }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] px-5 py-2.5 text-sm font-medium shadow-lg">
              <Check size={16} /> Usa questa foto
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
              const chosen = value === p.id
              return (
                <button key={p.id} type="button" onClick={() => setCur(p)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 ${on ? 'border-[rgb(var(--gold-500))]' : 'border-transparent'}`}>
                  <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {chosen && <span className="absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))]"><Check size={13} /></span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
