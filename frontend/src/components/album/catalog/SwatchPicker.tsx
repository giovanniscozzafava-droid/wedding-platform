// Scelta a campionatura: una griglia di tessere (ritaglio del catalogo o tinta piatta) con
// il nome sotto, UNA scelta sola. Sostituisce il menu a tendina dove il cliente deve vedere
// il campione (materiale, colore, logo, tonalità del logo).
import { Check } from '@/components/icons/lucide'

export type SwatchOpt = {
  key: string
  label: string
  img?: string      // ritaglio dal catalogo (public/album-swatches/…)
  hex?: string      // tinta piatta quando il catalogo non ha il campione
  hint?: string     // riga piccola sotto il nome (es. «MAXI», «pag. 87»)
}

type Props = {
  options: SwatchOpt[]
  value?: string | null
  onChange: (key: string | undefined) => void
  /** Proporzione della tessera: 'wide' = campione 5:2 (colori), 'square' = riquadro (loghi), 'chip' = quadratino (tonalità). */
  shape?: 'wide' | 'square' | 'chip'
  cols?: number
  disabled?: boolean
  emptyText?: string
  /** Altezza massima con scorrimento interno (liste lunghe, es. i 49 loghi). */
  maxH?: string
  /** 'cover' riempie la tessera (campioni di stoffa); 'contain' mostra l'immagine intera su fondo bianco (loghi). */
  fit?: 'cover' | 'contain'
}

export function SwatchPicker({ options, value, onChange, shape = 'wide', cols, disabled, emptyText, maxH, fit = 'cover' }: Props) {
  if (disabled) return <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">{emptyText ?? '—'}</p>
  const n = cols ?? (shape === 'chip' ? 6 : shape === 'square' ? 3 : 3)
  const ratio = shape === 'wide' ? '5 / 2' : '1 / 1'
  return (
    <div role="radiogroup" className="mt-1.5 grid gap-1.5 overflow-auto pr-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, maxHeight: maxH }}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.label}
            onClick={() => onChange(on ? undefined : o.key)}
            className={`group text-left rounded-lg border p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-600))] ${on ? 'border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-50))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))]'}`}
          >
            <span className={`relative block w-full overflow-hidden rounded-md ${fit === 'contain' ? 'bg-white' : 'bg-[rgb(var(--bg-muted))]'}`} style={{ aspectRatio: ratio, backgroundColor: o.hex }}>
              {o.img && <img src={o.img} alt="" loading="lazy" className={`absolute inset-0 h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`} />}
              {!o.img && !o.hex && (
                <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[10px] leading-tight text-[rgb(var(--fg-muted))]">{o.label}</span>
              )}
              {on && (
                <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--gold-600))] text-white shadow">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              )}
            </span>
            {shape !== 'chip' && (
              <span className="mt-1 block truncate text-[11px] leading-tight text-[rgb(var(--fg))]">{o.label}</span>
            )}
            {shape === 'chip' && (
              <span className="mt-0.5 block truncate text-[9px] leading-tight text-[rgb(var(--fg-muted))]">{o.label}</span>
            )}
            {o.hint && shape !== 'chip' && <span className="block truncate text-[10px] text-[rgb(var(--fg-subtle))]">{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
