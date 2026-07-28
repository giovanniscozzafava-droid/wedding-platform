// Wrapper di sonner: `toast.error(...)` viene UMANIZZATO automaticamente (messaggio chiaro +
// "cosa fare"), così ogni errore mostrato all'utente è comprensibile e spiega la soluzione.
// I messaggi già amichevoli passano invariati. Tutto il resto di sonner è ri-esportato tale quale.
//
// Uso: cambia solo l'import — `import { toast } from '@/lib/toast'` (invece di 'sonner').
import { toast as sonnerToast, type ExternalToast } from 'sonner'
import { humanizeError } from '@/lib/humanizeError'
import { reportError } from '@/lib/errorReporting'

export * from 'sonner'

// Ricostruisco un `toast` callable con tutti i metodi di sonner, sovrascrivendo `error`.
const wrapped: any = (...args: any[]) => (sonnerToast as any)(...args)
for (const k of Object.keys(sonnerToast)) wrapped[k] = (sonnerToast as any)[k]

wrapped.error = (msg: unknown, opts?: ExternalToast) => {
  const h = humanizeError(msg)
  const wasTechnical = typeof msg !== 'string' || h.message !== msg
  // L'errore tecnico grezzo va comunque all'admin (monitoraggio), ma con throttle/dedup.
  if (wasTechnical) { try { void reportError(msg, 'JS') } catch { /* mai rompere */ } }
  return sonnerToast.error(h.message, {
    duration: 8000,
    description: opts?.description ?? h.hint,
    ...opts,
  })
}

export const toast = wrapped as typeof sonnerToast
