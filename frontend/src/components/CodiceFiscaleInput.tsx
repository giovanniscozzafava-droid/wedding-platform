import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { describeCodiceFiscaleError } from '@/lib/codice-fiscale'
import { cn } from '@/lib/utils'

export type CodiceFiscaleInputProps = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  id?: string
  required?: boolean
  disabled?: boolean
  /** Mostra messaggio di errore inline (default: true) */
  showError?: boolean
}

/**
 * Input codice fiscale (persona fisica, 16 char) con validazione live:
 * pattern + checksum ufficiale Agenzia delle Entrate.
 *
 * NB: non verifica registrazione in anagrafe (richiede API a pagamento).
 */
export function CodiceFiscaleInput({
  value,
  onChange,
  placeholder = 'RSSMRA80A01H501Z',
  className,
  id,
  required,
  disabled,
  showError = true,
}: CodiceFiscaleInputProps) {
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (touched) setError(describeCodiceFiscaleError(value))
  }, [value, touched])

  const valid = touched && !error && value.trim().length > 0

  return (
    <div className={className}>
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onBlur={() => {
            setTouched(true)
            setError(describeCodiceFiscaleError(value))
          }}
          placeholder={placeholder}
          maxLength={16}
          autoComplete="off"
          required={required}
          disabled={disabled}
          className={cn(
            'uppercase tracking-wider font-mono',
            error && touched && 'border-red-500 focus-visible:border-red-500',
            valid && 'border-emerald-500',
          )}
        />
        {valid && (
          <span aria-label="Codice fiscale formalmente valido" className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm">
            ✓
          </span>
        )}
      </div>
      {showError && error && touched && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
