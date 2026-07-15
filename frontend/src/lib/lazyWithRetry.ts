import { lazy, type ComponentType } from 'react'

// Dopo un nuovo deploy (o su webview in-app con cache testarda, es. Libero Mail),
// una scheda può cercare un chunk JS con un hash che non esiste più → l'import
// dinamico fallisce (404) o RISOLVE a un modulo vuoto → pagina bianca / crash.
// Strategia in 2 mosse:
//  1) retry in-place dell'import (2 tentativi con backoff) → assorbe i blip di rete
//     mobile senza ricaricare nulla;
//  2) se persiste, HARD-RELOAD una volta sola con parametro usa-e-getta `_r` così
//     anche le cache/webview più ostinate sono costrette a riscaricare HTML fresco
//     (e quindi i chunk nuovi), invece di riservire la vecchia shell.
const RELOAD_KEY = 'pf_chunk_reloaded'

function alreadyReloaded(): boolean {
  try { return sessionStorage.getItem(RELOAD_KEY) === '1' } catch { return false }
}
export function clearReloadGuard(): void {
  try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* no-op */ }
}

// Ricarica "dura" (una sola volta per episodio). Cambia l'URL con `_r` usa-e-getta
// per bypassare la cache dell'HTML; il parametro viene ripulito al boot in main.tsx.
// Ritorna true se ha davvero avviato il reload, false se era già stato fatto.
export function hardReloadOnce(): boolean {
  if (alreadyReloaded()) return false
  try { sessionStorage.setItem(RELOAD_KEY, '1') } catch { /* no-op */ }
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('_r', Date.now().toString(36))
    window.location.replace(url.toString())
  } catch {
    try { window.location.reload() } catch { /* no-op */ }
  }
  return true
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function importWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  tries = 2,
  baseDelay = 250,
): Promise<{ default: T }> {
  let last: unknown
  for (let i = 0; i <= tries; i++) {
    try {
      const mod = await factory()
      // Chunk stale che risolve a undefined/modulo vuoto → React legge .default e
      // crasha ("undefined reading default"): trattalo come errore così ritentiamo.
      if (!mod || (mod as { default?: unknown }).default == null) throw new Error('chunk_resolved_empty')
      return mod
    } catch (err) {
      last = err
      if (i < tries) await sleep(baseDelay * (i + 1))
    }
  }
  throw last
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await importWithRetry(factory)
      clearReloadGuard()
      return mod
    } catch (err) {
      // Import fallito in modo persistente → hard-reload una volta (prende i chunk nuovi).
      if (hardReloadOnce()) return new Promise<{ default: T }>(() => {})
      // Già ricaricato: propaga al RouteErrorBoundary (mostrerà "Riproviamo").
      throw err
    }
  })
}
