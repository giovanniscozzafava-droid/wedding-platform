import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'gold' | 'sage' | 'rose' | 'amber' | 'emerald' | 'sky' | 'ink'

const TONES: Record<Tone, string> = {
  neutral:  'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]',
  gold:     'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]',
  sage:     'bg-[rgb(var(--sage-100))] text-[rgb(var(--sage-700))]',
  rose:     'bg-[rgb(var(--rose-100))] text-[rgb(var(--rose-700))]',
  amber:    'bg-[rgb(var(--amber-100))] text-[rgb(var(--amber-500))]',
  emerald:  'bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-500))]',
  sky:      'bg-[rgb(var(--sky-100))] text-[rgb(var(--sky-500))]',
  ink:      'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]',
}

const STATUS_TONE: Record<string, Tone> = {
  BOZZA: 'neutral',
  INVIATO: 'amber',
  ACCETTATO: 'emerald',
  RIFIUTATO: 'rose',
  CONVERTITO_IN_CONTRATTO: 'sky',
  IN_TRATTATIVA: 'amber',
  OPZIONATA: 'sky',
  CONFERMATA: 'sage',
  CANCELLATA: 'neutral',
  RIFIUTATA: 'rose',
  ACTIVE: 'emerald',
  PENDING: 'amber',
  REVOKED: 'neutral',
  FREE: 'neutral',
  PREMIUM: 'gold',
}

export function Badge({
  tone = 'neutral',
  status,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; status?: string }) {
  const t = status ? STATUS_TONE[status] ?? 'neutral' : tone
  return (
    <span className={cn('pill', TONES[t], className)} {...props}>
      {children ?? status}
    </span>
  )
}
