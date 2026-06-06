import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'

export type PickCat = { id: string; name: string; subrole?: string | null }

/**
 * Selettore categoria CERCABILE (non una tendina da 200 voci) con suggerimento
 * automatico dal titolo del servizio: scrivi il nome → ti proponiamo la
 * categoria giusta. Così ogni fornitore costruisce un'offerta ricercabile.
 */
export function CategoryPicker({
  cats, value, onChange, nameHint,
}: {
  cats: PickCat[]
  value: string
  onChange: (id: string) => void
  /** Titolo del servizio: usato per suggerire la categoria. */
  nameHint?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const selected = cats.find((c) => c.id === value) ?? null

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const base = t ? cats.filter((c) => c.name.toLowerCase().includes(t)) : cats
    return base.slice(0, 40)
  }, [q, cats])

  // Suggerimento dal titolo: categoria il cui nome è contenuto nel titolo (o
  // viceversa), preferendo il match più lungo.
  const suggestion = useMemo(() => {
    const n = (nameHint ?? '').trim().toLowerCase()
    if (n.length < 3) return null
    let best: PickCat | null = null
    let bestLen = 0
    for (const c of cats) {
      const cn = c.name.toLowerCase()
      if (n.includes(cn) || cn.includes(n)) {
        const len = Math.min(cn.length, n.length)
        if (len > bestLen) { best = c; bestLen = len }
      }
    }
    return best
  }, [nameHint, cats])

  return (
    <div className="relative">
      <Input
        value={open ? q : (selected?.name ?? '')}
        placeholder="Cerca la categoria…"
        onFocus={() => { setOpen(true); setQ('') }}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {!open && suggestion && suggestion.id !== value && (
        <button type="button" className="mt-1 text-[11px] text-[rgb(var(--gold-600))] hover:underline text-left"
          onClick={() => onChange(suggestion.id)}>
          Suggerita dal titolo: <strong>{suggestion.name}</strong> — usa questa
        </button>
      )}
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-lg border bg-[rgb(var(--bg-elev))] shadow-lg"
          style={{ borderColor: 'rgb(var(--border-strong))' }}>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[rgb(var(--fg-subtle))]">Nessuna categoria. Continua a scrivere.</p>
          ) : filtered.map((c) => (
            <button key={c.id} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c.id); setOpen(false); setQ('') }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-[rgb(var(--bg-sunken))]">
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
