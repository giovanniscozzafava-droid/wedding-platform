import { useState } from 'react'
import { Check, Layers } from 'lucide-react'
import { mockupFor, type Model } from '../albumCatalog'

// Card grande e tappabile per un modello: thumbnail mockup reale (con fallback),
// nome e variante. Selezione evidente con ring gold + spunta.
export function ModelCard({ model, active, onClick }: { model: Model; active: boolean; onClick: () => void }) {
  const src = mockupFor(model.key)
  const [broken, setBroken] = useState(false)
  const showImg = src && !broken

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
      <div className="aspect-[4/5] bg-gradient-to-br from-[rgb(var(--bg-sunken))] to-[rgb(var(--bg-elev))] overflow-hidden">
        {showImg ? (
          <img
            src={src!}
            alt={model.label}
            loading="lazy"
            onError={() => setBroken(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-[rgb(var(--fg-subtle))]">
            <Layers size={28} strokeWidth={1.3} />
          </div>
        )}
      </div>
      {active && (
        <span className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] grid place-items-center shadow">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      <div className="p-3">
        <p className="font-display text-[15px] leading-tight text-[rgb(var(--fg))] line-clamp-2">{model.label.split(' · ')[0]}</p>
        {model.variant && <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5 line-clamp-1">{model.variant}</p>}
        <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--gold-600))] mt-1.5">{model.tier}</p>
      </div>
    </button>
  )
}
