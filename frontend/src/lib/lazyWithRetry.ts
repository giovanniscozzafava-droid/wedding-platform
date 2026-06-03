import { lazy, type ComponentType } from 'react'

// Dopo un nuovo deploy, una scheda già aperta può cercare un chunk JS con un
// hash che non esiste più → l'import dinamico fallisce e la pagina resta bianca.
// Questo wrapper ricarica la pagina UNA volta (così prende i chunk nuovi); se
// fallisce di nuovo, propaga l'errore al boundary.
const RELOAD_KEY = 'pf_chunk_reloaded'

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory()
      try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* no-op */ }
      return mod
    } catch (err) {
      let already = false
      try { already = sessionStorage.getItem(RELOAD_KEY) === '1' } catch { /* no-op */ }
      if (!already) {
        try { sessionStorage.setItem(RELOAD_KEY, '1') } catch { /* no-op */ }
        location.reload()
        // La pagina si sta ricaricando: ritorna una promise che non risolve.
        return new Promise<{ default: T }>(() => {})
      }
      throw err
    }
  })
}
