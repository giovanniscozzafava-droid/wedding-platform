import { useEffect, useState } from 'react'
import { Check, Layers } from 'lucide-react'
import { baseDesignKey, type Model } from '../albumCatalog'
import { requestModelThumb, releaseModelThumb } from './modelThumb'

// Card grande e tappabile per un DESIGN base. Thumbnail UNIFORME generata dallo
// stesso motore 2D del configuratore (CoverCanvas) → coerente per ogni modello,
// niente più foto "in un modo e in un altro". Selezione evidente con ring gold.
export function ModelCard({ model, active, onClick }: { model: Model; active: boolean; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(() => requestModelThumb(model.key, () => {}))

  useEffect(() => {
    const cb = (url: string) => setSrc(url)
    const hit = requestModelThumb(model.key, cb)
    if (hit) setSrc(hit)
    return () => releaseModelThumb(model.key, cb)
  }, [model.key])

  const name = baseDesignKey(model)
    ? model.label.split(' · ')[0]
    : model.label

  return (
    <button
      type="button"
      onClick={onClick}
      title={model.blurb}
      className={`group relative text-left rounded-2xl border overflow-hidden transition-all duration-200
        ${active
          ? 'border-[rgb(var(--gold-500))] ring-2 ring-[rgb(var(--gold-300))] shadow-[0_10px_30px_rgba(170,140,60,.18)]'
          : 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))] hover:shadow-[0_8px_24px_rgba(20,18,14,.10)]'}`}
    >
      <div className="aspect-[4/5] grid place-items-center bg-gradient-to-br from-[rgb(var(--bg-sunken))] to-[rgb(var(--bg-elev))] overflow-hidden p-2.5">
        {src ? (
          <img
            src={src}
            alt={name}
            className="max-w-full max-h-full object-contain drop-shadow-[0_10px_22px_rgba(20,18,14,.20)] transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-[rgb(var(--fg-subtle))] animate-pulse">
            <Layers size={26} strokeWidth={1.3} />
          </div>
        )}
      </div>
      {active && (
        <span className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] grid place-items-center shadow">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      <div className="p-3 border-t border-[rgb(var(--border))]/60">
        <p className="font-display text-[15px] leading-tight text-[rgb(var(--fg))] line-clamp-1">{name}</p>
        <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--gold-600))] mt-1">{model.tier}</p>
      </div>
    </button>
  )
}
