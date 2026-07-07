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
  // IMPORTANTE: il builder di supabase-js è "lazy" — la richiesta parte SOLO con
  // .then()/await. Un semplice `void supabase.rpc(...)` NON invia nulla (bug storico).
  try {
    ;(supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => PromiseLike<unknown> })
      .rpc('track_quote_open', { p_token: token, p_ua: typeof navigator !== 'undefined' ? navigator.userAgent : null })
      .then(() => {}, () => {})
  } catch { /* best-effort */ }
}
