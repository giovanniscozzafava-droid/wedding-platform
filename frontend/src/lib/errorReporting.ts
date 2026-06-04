// Monitoraggio errori client (mini-Sentry interno).
// Cattura errori JS, promise non gestite ed errori React, li raggruppa per
// "fingerprint" e li manda a log_client_error (throttle + dedup per non spammare).
import { supabase } from '@/lib/supabase'

const RELEASE = (import.meta as any).env?.VITE_RELEASE ?? 'web'

// Normalizza il messaggio per raggruppare errori "uguali" (toglie numeri/uuid/hex).
function normalize(s: string): string {
  return (s || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b\d+\b/g, '<n>')
    .slice(0, 300)
}
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}
function firstFrame(stack?: string): string {
  if (!stack) return ''
  const line = stack.split('\n').find((l) => /\.(t|j)sx?:/.test(l)) ?? stack.split('\n')[1] ?? ''
  return line.replace(/https?:\/\/[^/]+/g, '').replace(/:\d+:\d+/g, '').trim().slice(0, 120)
}

// Throttle: stesso fingerprint max 1 ogni 30s; max 20 invii per sessione.
const lastSent = new Map<string, number>()
let sessionCount = 0
let installed = false

export async function reportError(
  err: unknown,
  source: 'JS' | 'PROMISE' | 'REACT' = 'JS',
  severity: 'ERROR' | 'WARNING' = 'ERROR',
) {
  try {
    if (sessionCount >= 20) return
    const e = err as any
    const message = (e?.message ?? String(err ?? 'Unknown error')).slice(0, 1000)
    const stack = typeof e?.stack === 'string' ? e.stack.slice(0, 8000) : undefined
    // Ignora rumore noto e non azionabile.
    if (/ResizeObserver loop|Script error\.?$|Load failed|Failed to fetch dynamically imported/i.test(message)) return
    const fp = hash(`${source}|${normalize(message)}|${firstFrame(stack)}`)
    const now = Date.now()
    if (now - (lastSent.get(fp) ?? 0) < 30_000) return
    lastSent.set(fp, now)
    sessionCount++
    await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<unknown> }).rpc('log_client_error', {
      p_fingerprint: fp,
      p_message: message,
      p_stack: stack ?? null,
      p_source: source,
      p_url: typeof location !== 'undefined' ? location.pathname + location.search : null,
      p_release: RELEASE,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      p_severity: severity,
    })
  } catch { /* il reporting non deve mai rompere l'app */ }
}

export function installErrorReporting() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (ev) => {
    // Errori di caricamento risorse (img/script) hanno target ma non error.
    if (ev.error) void reportError(ev.error, 'JS')
    else if (ev.message) void reportError({ message: ev.message, stack: `${ev.filename}:${ev.lineno}:${ev.colno}` }, 'JS')
  })
  window.addEventListener('unhandledrejection', (ev) => {
    void reportError(ev.reason ?? 'Unhandled promise rejection', 'PROMISE')
  })
}
