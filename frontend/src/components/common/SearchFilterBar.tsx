import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

// Barra di ricerca + filtri riutilizzabile per tutte le liste (preventivi, contratti, eventi,
// clienti, lead…). Ricerca testuale + chips opzionali (es. stato accettati / non accettati).
export type FilterChip = { key: string; label: string }

export function SearchFilterBar({ value, onChange, placeholder, chips, active, onChip, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  chips?: FilterChip[]
  active?: string
  onChip?: (key: string) => void
  className?: string
}) {
  return (
    <div className={`flex flex-col sm:flex-row gap-2 mb-4 ${className ?? ''}`}>
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
        <Input className="pl-9" placeholder={placeholder ?? 'Cerca…'} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      {chips && chips.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={() => onChip?.(c.key)}
              className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${active === c.key ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
