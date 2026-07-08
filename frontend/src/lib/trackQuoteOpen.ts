import { supabase } from '@/lib/supabase'

// Registra l'apertura di un preventivo da parte del cliente (contatore + timeline).
// Deve funzionare PRIMA e INDIPENDENTEMENTE dal login: il track_quote_open è
// SECURITY DEFINER e concesso ad anon. Dedup per-tab (sessionStorage) così il
// percorso email → /area-cliente/accedi → /p/preview NON conta 2 volte la stessa visita.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function quoteTokenFromPath(pathOrNext?: string | null): string | null {
  if (!pathOrNext) return null
  let s = pathOrNext
  try { s = decodeURIComponent(pathOrNext) } catch { /* usa il grezzo */ }
  const m = s.match(/\/p\/(?:preview|accept)\/([0-9a-f-]{36})/i)
  return m?.[1] ?? null
}

export function trackQuoteOpen(token?: string | null): void {
  if (!token || !UUID.test(token)) return
  try {
    const key = `pf_qopen_${token}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1')
  } catch { /* sessionStorage non disponibile: traccia comunque */ }
  // Via EDGE (non RPC diretta): l'hardening blocca le scritture anonime su `quotes`, quindi
  // il cliente anonimo che chiama track_quote_open non aggiornerebbe nulla. L'edge `track-open`
  // gira come service_role (permesso dall'hardening) e scrive open_count/quote_views.
  try {
    ;(supabase as unknown as { functions: { invoke: (n: string, o: { body: unknown }) => PromiseLike<unknown> } })
      .functions.invoke('track-open', { body: { token, ua: typeof navigator !== 'undefined' ? navigator.userAgent : null } })
      .then(() => {}, () => {})
  } catch { /* best-effort */ }
}
