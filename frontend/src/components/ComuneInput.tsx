import { useEffect, useRef, useState } from 'react'
import { searchComuni, findComune, type Comune } from '@/lib/comuni'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type ComuneInputProps = {
  value: string
  onChange: (next: { city: string; cap: string; province: string }) => void
  /** Se più CAP disponibili, usa il primo. */
  capValue?: string
  provinceValue?: string
  placeholder?: string
  className?: string
  id?: string
  required?: boolean
  disabled?: boolean
}

/**
 * Input con autocomplete dei comuni italiani.
 * Quando l'utente seleziona un comune, propaga città + CAP + sigla provincia
 * tramite onChange. Se più CAP esistono per quel comune (es. città grandi),
 * usa il primo — l'utente può modificare manualmente.
 */
export function ComuneInput({
  value,
  onChange,
  placeholder = 'es. Botricello',
  className,
  id,
  required,
  disabled,
}: ComuneInputProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Comune[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    let cancelled = false
    if (!open || query.trim().length < 2) {
      setResults([])
      return
    }
    searchComuni(query).then((r) => {
      if (!cancelled) {
        setResults(r)
        setHighlight(0)
      }
    })
    return () => {
      cancelled = true
    }
  }, [query, open])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function selectComune(c: Comune) {
    onChange({ city: c.n, cap: c.c[0] ?? '', province: c.s })
    setQuery(c.n)
    setOpen(false)
  }

  async function handleBlur() {
    // Se l'utente ha scritto qualcosa che corrisponde esattamente a un comune,
    // propaga in onChange anche senza click.
    const exact = await findComune(query)
    if (exact && exact.n !== value) {
      onChange({ city: exact.n, cap: exact.c[0] ?? '', province: exact.s })
    } else if (query !== value) {
      // Lasciamo che l'utente scriva un comune non in elenco (es. estero); propaghiamo solo il city.
      onChange({ city: query, cap: '', province: '' })
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const sel = results[highlight]
      if (sel) selectComune(sel)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Input
        id={id}
        type="text"
        autoComplete="address-level2"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKey}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 max-h-72 overflow-y-auto rounded-lg border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] shadow-lg">
          {results.map((c, i) => (
            <li
              key={`${c.cc}-${c.n}`}
              onMouseDown={(e) => {
                e.preventDefault()
                selectComune(c)
              }}
              className={cn(
                'flex justify-between items-center px-3 py-2 text-sm cursor-pointer',
                i === highlight ? 'bg-[rgb(var(--bg-muted))]' : 'hover:bg-[rgb(var(--bg-muted))]',
              )}
            >
              <span className="text-[rgb(var(--fg))]">{c.n}</span>
              <span className="text-xs text-[rgb(var(--fg-subtle))] ml-2 whitespace-nowrap">
                {c.s} · {c.c[0]}
                {c.c.length > 1 ? ` (+${c.c.length - 1})` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
