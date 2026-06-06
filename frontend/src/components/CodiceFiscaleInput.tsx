import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { describeFiscalErrorByType } from '@/lib/codice-fiscale'
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
  /** 'person' = persona fisica (16 char), 'company' = società/ente (11 cifre). Default 'person'. */
  variant?: 'person' | 'company'
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
  placeholder,
  className,
  id,
  required,
  disabled,
  showError = true,
  variant = 'person',
}: CodiceFiscaleInputProps) {
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCompany = variant === 'company'
  const ph = placeholder ?? (isCompany ? '01234567890' : 'RSSMRA80A01H501Z')

  useEffect(() => {
    if (touched) setError(describeFiscalErrorByType(value, variant))
  }, [value, touched, variant])

  const valid = touched && !error && value.trim().length > 0

  return (
    <div className={className}>
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange((isCompany ? e.target.value.replace(/[^0-9]/g, '') : e.target.value.toUpperCase()))}
          onBlur={() => {
            setTouched(true)
            setError(describeFiscalErrorByType(value, variant))
          }}
          placeholder={ph}
          maxLength={isCompany ? 11 : 16}
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
