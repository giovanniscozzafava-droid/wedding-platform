// Edge: api-v1 — la porta di Planfully per agenti e altri progetti.
//
// «Come possiamo creare un'API che si connette con altri agenti e altri miei
//  progetti?» (Giovanni, 02/09/2026). Risposta: UNA chiave, e dietro la chiave
// l'applicazione intera così com'è.
//
// Come funziona:
//   1. il chiamante manda `Authorization: Bearer pf_live_…` (o `x-api-key`);
//   2. sha256 della chiave → api_key_resolve → proprietario, scope, chiamate/minuto;
//   3. si CONIA una sessione Supabase vera per il proprietario, con lo stesso
//      meccanismo già usato da admin-impersonate per "entra come utente":
//      admin.generateLink('magiclink') → verifyOtp(token_hash) → access_token.
//      Nessun segreto da conoscere o incollare: firma e algoritmo li decide
//      Supabase stesso, e restano corretti anche se in futuro cambiano;
//   4. la richiesta passa a PostgREST con quel token: RLS e RPC lavorano ESATTAMENTE
//      come se fosse il professionista loggato. Niente da riscrivere, niente
//      seconda versione delle regole.
// La sessione coniata resta in cache (per proprietario, in memoria dell'istanza
// edge) fino a poco prima di scadere: non se ne apre una nuova a ogni chiamata.
//
// Superficie (dietro planfully.it/api/v1 via rewrite Vercel):
//   GET  /me                      chi sono, scope, limiti
//   GET  /openapi.json            contratto generato da PostgREST (tabelle + RPC visibili)
//   *    /rest/<tabella>?…        PostgREST così com'è (select, filtri, Prefer, Range)
//   GET  /rpc/<fn>?arg=val        RPC in sola lettura (transazione READ ONLY)
//   POST /rpc/<fn>  {args}        RPC con scrittura → serve scope write
//
// Scope: `read` → solo GET/HEAD (PostgREST esegue i GET in transazione read-only,
// quindi anche una RPC "volatile" non può scrivere). `write` → tutto.
// Rate limit: 120 chiamate al minuto per chiave. Ogni chiamata lascia una riga in
// api_calls. verify_jwt = false nel config: il Bearer qui NON è un JWT Supabase.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const API_BASE = Deno.env.get('PF_API_BASE') ?? 'https://planfully.it/api/v1'
const LIMIT_PER_MIN = 120
const MAX_BODY = 1_000_000
// Margine prima della scadenza reale della sessione: rinnova un po' prima, non
// esattamente all'ultimo secondo (jwt_expiry del progetto = 3600s).
const RENEW_MARGIN_S = 60

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type, prefer, range, accept',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'content-range, x-ratelimit-limit, x-ratelimit-remaining',
}
const json = (b: unknown, s = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, ...extra, 'content-type': 'application/json' } })

const enc = new TextEncoder()
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })

// ---- sessione per proprietario, con cache -----------------------------------
type CachedSession = { token: string; exp: number }
const sessionCache = new Map<string, CachedSession>()
const sessionInflight = new Map<string, Promise<{ ok: true; token: string } | { ok: false; error: string }>>()

async function mintSession(owner: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { data: tu, error: ue } = await admin.auth.admin.getUserById(owner)
  const email = tu?.user?.email
  if (ue || !email) return { ok: false, error: 'no_email' }

  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (le || !link?.properties?.hashed_token) return { ok: false, error: le?.message ?? 'link_failed' }

  const { data: sess, error: ve } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
  if (ve || !sess?.session?.access_token) return { ok: false, error: ve?.message ?? 'verify_failed' }

  const exp = sess.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600
  sessionCache.set(owner, { token: sess.session.access_token, exp })
  return { ok: true, token: sess.session.access_token }
}

async function tokenFor(owner: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const now = Math.floor(Date.now() / 1000)
  const cached = sessionCache.get(owner)
  if (cached && cached.exp - now > RENEW_MARGIN_S) return { ok: true, token: cached.token }

  let p = sessionInflight.get(owner)
  if (!p) {
    p = mintSession(owner).finally(() => sessionInflight.delete(owner))
    sessionInflight.set(owner, p)
  }
  return p
}

// ---- helpers ----------------------------------------------------------------
const NAME_RE = /^[a-z_][a-z0-9_]*$/

function bearerKey(req: Request): string | null {
  const a = req.headers.get('authorization') ?? ''
  if (/^Bearer\s+pf_live_[0-9a-f]{48}$/i.test(a)) return a.slice(7).trim()
  const x = (req.headers.get('x-api-key') ?? '').trim()
  if (/^pf_live_[0-9a-f]{48}$/i.test(x)) return x
  return null
}

// /functions/v1/api-v1/rest/quotes → /rest/quotes ; tollera anche un /v1 in mezzo.
function apiPath(url: URL): string {
  let p = url.pathname.replace(/^\/api-v1/, '')
  p = p.replace(/^\/v1(?=\/|$)/, '')
  return p === '' ? '/' : p
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const t0 = Date.now()
  const url = new URL(req.url)
  const path = apiPath(url)

  // Indice pubblico: dove sei e come si entra. Nessun dato.
  if (path === '/' && req.method === 'GET') {
    return json({
      name: 'Planfully API', version: 'v1', base: API_BASE,
      auth: 'Authorization: Bearer pf_live_… (chiave dalle Impostazioni → API e agenti)',
      endpoints: ['GET /me', 'GET /openapi.json', '* /rest/<tabella>', 'GET /rpc/<fn>', 'POST /rpc/<fn>'],
      docs: 'https://postgrest.org/en/stable/references/api.html',
    })
  }

  const key = bearerKey(req)
  if (!key) return json({ error: 'auth', hint: 'Authorization: Bearer pf_live_…' }, 401)

  const { data: k, error: ke } = await admin.rpc('api_key_resolve', { p_hash: await sha256Hex(key) })
  if (ke) return json({ error: 'resolve_failed', reason: ke.message }, 500)
  if (!k?.ok) return json({ error: k?.error ?? 'invalid_key' }, 401)
  const keyId = String(k.key_id), owner = String(k.owner_id)
  const scopes: string[] = Array.isArray(k.scopes) ? k.scopes : []
  const remaining = Math.max(0, LIMIT_PER_MIN - Number(k.last_minute ?? 0) - 1)
  const rl = { 'x-ratelimit-limit': String(LIMIT_PER_MIN), 'x-ratelimit-remaining': String(remaining) }

  const log = (status: number) =>
    admin.rpc('api_call_log', { p_key: keyId, p_owner: owner, p_method: req.method, p_path: path + url.search, p_status: status, p_ms: Date.now() - t0 })
      .then(({ error }) => { if (error) console.error('api_call_log', error.message) })

  if (Number(k.last_minute ?? 0) >= LIMIT_PER_MIN) {
    await log(429)
    return json({ error: 'rate_limited', limit: LIMIT_PER_MIN, window: '1m' }, 429, { ...rl, 'retry-after': '60' })
  }

  const isRead = req.method === 'GET' || req.method === 'HEAD'
  if (!isRead && !scopes.includes('write')) {
    await log(403)
    return json({ error: 'scope', hint: 'questa chiave è di sola lettura: serve lo scope write' }, 403, rl)
  }
  if (isRead && !scopes.includes('read')) { await log(403); return json({ error: 'scope' }, 403, rl) }

  const sess = await tokenFor(owner)
  if (!sess.ok) {
    await log(500)
    return json({ error: 'session_failed', reason: sess.error }, 500, rl)
  }
  const jwt = sess.token
  const pg = (rest: string, init: RequestInit = {}, accept?: string) =>
    fetch(`${SUPABASE_URL}/rest/v1${rest}`, {
      ...init,
      headers: {
        apikey: ANON_KEY, Authorization: `Bearer ${jwt}`,
        ...(accept ? { Accept: accept } : {}),
        ...(init.headers ?? {}),
      },
    })

  // ---- /me --------------------------------------------------------------------
  if (path === '/me') {
    const r = await pg(`/profiles?id=eq.${owner}&select=id,role,business_name,full_name`, {}, 'application/json')
    const rows = r.ok ? await r.json() : []
    const me = Array.isArray(rows) ? rows[0] ?? null : null
    if (!r.ok) {
      await log(r.status)
      return json({ error: 'upstream', status: r.status, body: await r.text().catch(() => '') }, 502, rl)
    }
    await log(200)
    return json({
      ok: true, owner: me, key: { id: keyId, scopes }, limits: { per_minute: LIMIT_PER_MIN, remaining },
      base: API_BASE,
    }, 200, rl)
  }

  // ---- /openapi.json ------------------------------------------------------------
  // PostgREST descrive da solo ciò che il ruolo vede: tabelle, colonne, RPC e i loro
  // argomenti. Si riscrivono solo host e basePath, così un agente lo legge e sa
  // esattamente dove chiamare.
  if (path === '/openapi.json') {
    const r = await pg('/', {}, 'application/openapi+json')
    if (!r.ok) { await log(r.status); return json({ error: 'upstream', status: r.status }, 502, rl) }
    const spec = await r.json()
    const base = new URL(API_BASE)
    spec.host = base.host
    spec.basePath = base.pathname.replace(/\/$/, '')
    spec.schemes = [base.protocol.replace(':', '')]
    spec.info = { ...(spec.info ?? {}), title: 'Planfully API v1',
      description: 'Stesse tabelle e RPC dell’app, viste con i permessi del proprietario della chiave. Tabelle sotto /rest/<nome>, funzioni sotto /rpc/<nome>. Chiavi read: solo GET.' }
    spec.securityDefinitions = { apiKey: { type: 'apiKey', name: 'Authorization', in: 'header', description: 'Bearer pf_live_…' } }
    spec.security = [{ apiKey: [] }]
    // I path di PostgREST sono "/tabella" e "/rpc/fn": le tabelle vanno sotto /rest.
    const paths: Record<string, unknown> = {}
    for (const [p, v] of Object.entries(spec.paths ?? {})) {
      if (p === '/') continue
      paths[p.startsWith('/rpc/') ? p : `/rest${p}`] = v
    }
    spec.paths = paths
    await log(200)
    return json(spec, 200, rl)
  }

  // ---- /rest/<tabella> e /rpc/<fn> ---------------------------------------------
  const m = path.match(/^\/(rest|rpc)\/([^/]+)$/)
  if (!m) { await log(404); return json({ error: 'not_found', path }, 404, rl) }
  const [, kind, name] = m
  if (!NAME_RE.test(name)) { await log(400); return json({ error: 'bad_name' }, 400, rl) }
  if (name === 'api_keys' || name === 'api_calls') { await log(403); return json({ error: 'forbidden' }, 403, rl) }
  if (kind === 'rpc' && !['GET', 'HEAD', 'POST'].includes(req.method)) { await log(405); return json({ error: 'method' }, 405, rl) }

  let body: ArrayBuffer | undefined
  if (!isRead) {
    body = await req.arrayBuffer()
    if (body.byteLength > MAX_BODY) { await log(413); return json({ error: 'too_large', max: MAX_BODY }, 413, rl) }
  }
  const fwd: Record<string, string> = {}
  for (const h of ['content-type', 'prefer', 'range', 'accept', 'accept-profile', 'content-profile']) {
    const v = req.headers.get(h); if (v) fwd[h] = v
  }
  if (!isRead && !fwd['content-type']) fwd['content-type'] = 'application/json'
  if (!fwd['accept']) fwd['accept'] = 'application/json'

  const upstream = await pg(`${kind === 'rpc' ? '/rpc' : ''}/${name}${url.search}`, { method: req.method, headers: fwd, body })
  const out = new Headers({ ...CORS, ...rl })
  for (const h of ['content-type', 'content-range', 'content-location', 'location', 'preference-applied']) {
    const v = upstream.headers.get(h); if (v) out.set(h, v)
  }
  await log(upstream.status)
  return new Response(upstream.body, { status: upstream.status, headers: out })
})
