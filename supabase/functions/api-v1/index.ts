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
// Superficie REST (dietro planfully.it/api/v1 via rewrite Vercel):
//   GET  /me                      chi sono, scope, limiti
//   GET  /openapi.json            contratto generato da PostgREST (tabelle + RPC visibili)
//   *    /rest/<tabella>?…        PostgREST così com'è (select, filtri, Prefer, Range)
//   GET  /rpc/<fn>?arg=val        RPC in sola lettura (transazione READ ONLY)
//   POST /rpc/<fn>  {args}        RPC con scrittura → serve scope write
// Superficie MCP (per agenti come Claude Code):
//   POST /mcp                     server MCP "Streamable HTTP", stateless, solo JSON
//                                  (nessuna SSE): initialize, tools/list, tools/call.
//                                  Stessa chiave, stessi scope, stesso registro chiamate.
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
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type, prefer, range, accept, mcp-session-id, mcp-protocol-version',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'content-range, x-ratelimit-limit, x-ratelimit-remaining',
}
const json = (b: unknown, s = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, ...extra, 'content-type': 'application/json' } })
const empty = (s: number) => new Response(null, { status: s, headers: CORS })

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

// ---- MCP: tools disponibili agli agenti --------------------------------------
const MCP_TOOLS = [
  {
    name: 'whoami',
    description: 'Chi sei su Planfully con questa chiave: profilo, scope, chiamate residue nel minuto.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search_endpoints',
    description: 'Cerca tra le tabelle e le funzioni (RPC) disponibili, dal contratto OpenAPI dell\'app. Usalo prima di rest_query o rpc_call se non conosci già il nome esatto.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Testo da cercare, es. "quote", "evento", "recensione". Vuoto = prime voci.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'rest_query',
    description: 'Legge o scrive su una tabella Planfully via PostgREST, con gli stessi permessi (RLS) del proprietario della chiave.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Nome tabella, es. quotes, calendar_entries, profiles' },
        query: { type: 'string', description: 'Query string PostgREST, es. "select=id,title&limit=5&order=created_at.desc&status=eq.INVIATO"' },
        method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'DELETE'], description: 'Default GET. POST/PATCH/DELETE richiedono una chiave con scope write.' },
        body: { type: 'object', description: 'Corpo per POST/PATCH: i campi da inserire o aggiornare' },
      },
      required: ['table'],
      additionalProperties: false,
    },
  },
  {
    name: 'rpc_call',
    description: 'Chiama per nome una funzione (RPC) di Planfully, con gli stessi permessi del proprietario della chiave.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome della funzione, es. filo_brief, ultimatum_stats' },
        args: { type: 'object', description: 'Argomenti nominati della funzione' },
        write: { type: 'boolean', description: 'true se la funzione scrive (richiede scope write); false = sola lettura' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
] as const

type PgFn = (rest: string, init?: RequestInit, accept?: string) => Promise<Response>

let openapiCache: { at: number; spec: Record<string, unknown> } | null = null
async function getOpenapiCached(pg: PgFn): Promise<Record<string, unknown>> {
  if (openapiCache && Date.now() - openapiCache.at < 10 * 60 * 1000) return openapiCache.spec
  const r = await pg('/', {}, 'application/openapi+json')
  if (!r.ok) throw new Error(`openapi HTTP ${r.status}`)
  const spec = await r.json()
  openapiCache = { at: Date.now(), spec }
  return spec
}

async function callTool(name: string, args: Record<string, unknown>, ctx: { owner: string; keyId: string; scopes: string[]; pg: PgFn }): Promise<string> {
  const { owner, keyId, scopes, pg } = ctx

  if (name === 'whoami') {
    const r = await pg(`/profiles?id=eq.${owner}&select=id,role,business_name,full_name`, {}, 'application/json')
    const rows = r.ok ? await r.json() : []
    const me = Array.isArray(rows) ? rows[0] ?? null : null
    return JSON.stringify({ owner: me, key: { id: keyId, scopes } })
  }

  if (name === 'search_endpoints') {
    const q = String(args?.query ?? '').toLowerCase()
    const spec = await getOpenapiCached(pg)
    const rows: { path: string; methods: string[]; summary: string }[] = []
    for (const [p, v] of Object.entries<Record<string, { summary?: string; description?: string }>>((spec.paths as Record<string, never>) ?? {})) {
      if (p === '/' || rows.length >= 40) continue
      const methods = Object.keys(v).filter((m) => ['get', 'post', 'patch', 'delete', 'put'].includes(m)).map((m) => m.toUpperCase())
      const summary = String(v.get?.summary || v.post?.summary || v.get?.description || v.post?.description || '').slice(0, 140)
      const full = p.startsWith('/rpc/') ? p : `/rest${p}`
      if (!q || full.toLowerCase().includes(q) || summary.toLowerCase().includes(q)) rows.push({ path: full, methods, summary })
    }
    return JSON.stringify(rows)
  }

  if (name === 'rest_query') {
    const table = String(args?.table ?? '')
    if (!NAME_RE.test(table)) throw new Error('nome tabella non valido')
    if (table === 'api_keys' || table === 'api_calls') throw new Error('tabella non accessibile da qui')
    const method = String(args?.method ?? 'GET').toUpperCase()
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) throw new Error('method deve essere GET, POST, PATCH o DELETE')
    if (method !== 'GET' && !scopes.includes('write')) throw new Error('questa chiave è di sola lettura: serve scope write')
    const qs = String(args?.query ?? '')
    const headers: Record<string, string> = { accept: 'application/json' }
    let body: string | undefined
    if (method !== 'GET') { headers['content-type'] = 'application/json'; headers['prefer'] = 'return=representation'; body = JSON.stringify(args?.body ?? {}) }
    const r = await pg(`/${table}${qs ? `?${qs}` : ''}`, { method, headers, body })
    const text = await r.text()
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 500)}`)
    return text
  }

  if (name === 'rpc_call') {
    const fn = String(args?.name ?? '')
    if (!NAME_RE.test(fn)) throw new Error('nome funzione non valido')
    const write = Boolean(args?.write)
    if (write && !scopes.includes('write')) throw new Error('questa chiave è di sola lettura: serve scope write')
    const fnArgs = (args?.args && typeof args.args === 'object') ? (args.args as Record<string, unknown>) : {}
    let r: Response
    if (write) {
      r = await pg(`/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(fnArgs) })
    } else {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(fnArgs)) qs.set(k, typeof v === 'string' ? v : JSON.stringify(v))
      r = await pg(`/rpc/${fn}${qs.toString() ? `?${qs}` : ''}`, { method: 'GET', headers: { accept: 'application/json' } })
    }
    const text = await r.text()
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 500)}`)
    return text
  }

  throw new Error(`tool sconosciuto: ${name}`)
}

// deno-lint-ignore no-explicit-any
async function handleMcp(req: Request, ctx: { owner: string; keyId: string; scopes: string[]; pg: PgFn; log: (status: number, label: string) => Promise<void> }): Promise<Response> {
  if (req.method === 'GET') return empty(405) // nessuna SSE: solo risposte JSON dirette
  if (req.method === 'DELETE') return empty(200) // stateless: nessuna sessione MCP da chiudere
  if (req.method !== 'POST') return empty(405)

  // deno-lint-ignore no-explicit-any
  let msg: any
  try { msg = await req.json() } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } })

  const { id, method, params } = msg
  const isNotification = id === undefined
  const respond = (result: unknown) => isNotification ? empty(202) : json({ jsonrpc: '2.0', id, result })
  const respondErr = (code: number, message: string) => isNotification ? empty(202) : json({ jsonrpc: '2.0', id, error: { code, message } })

  if (method === 'notifications/initialized' || method === 'notifications/cancelled' || method === 'notifications/roots/list_changed') return empty(202)

  if (method === 'initialize') {
    await ctx.log(200, '/mcp#initialize')
    return respond({ protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'planfully-api', version: '1.0.0' } })
  }
  if (method === 'ping') { await ctx.log(200, '/mcp#ping'); return respond({}) }
  if (method === 'tools/list') { await ctx.log(200, '/mcp#tools/list'); return respond({ tools: MCP_TOOLS }) }

  if (method === 'tools/call') {
    const name = String(params?.name ?? '')
    const args = (params?.arguments && typeof params.arguments === 'object') ? params.arguments : {}
    if (!MCP_TOOLS.some((t) => t.name === name)) { await ctx.log(404, `/mcp#tools/call:${name}`); return respondErr(-32602, `Tool sconosciuto: ${name}`) }
    try {
      const text = await callTool(name, args, ctx)
      await ctx.log(200, `/mcp#tools/call:${name}`)
      return respond({ content: [{ type: 'text', text }], isError: false })
    } catch (e) {
      await ctx.log(200, `/mcp#tools/call:${name}`)
      return respond({ content: [{ type: 'text', text: `Errore: ${(e as Error).message}` }], isError: true })
    }
  }

  await ctx.log(404, `/mcp#${method}`)
  return respondErr(-32601, `Metodo sconosciuto: ${method}`)
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
      endpoints: ['GET /me', 'GET /openapi.json', '* /rest/<tabella>', 'GET /rpc/<fn>', 'POST /rpc/<fn>', 'POST /mcp'],
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

  const log = (status: number, label?: string) =>
    admin.rpc('api_call_log', { p_key: keyId, p_owner: owner, p_method: req.method, p_path: label ?? path + url.search, p_status: status, p_ms: Date.now() - t0 })
      .then(({ error }) => { if (error) console.error('api_call_log', error.message) })

  if (Number(k.last_minute ?? 0) >= LIMIT_PER_MIN) {
    await log(429)
    return json({ error: 'rate_limited', limit: LIMIT_PER_MIN, window: '1m' }, 429, { ...rl, 'retry-after': '60' })
  }

  const sess = await tokenFor(owner)
  if (!sess.ok) {
    await log(500)
    return json({ error: 'session_failed', reason: sess.error }, 500, rl)
  }
  const jwt = sess.token
  const pg: PgFn = (rest, init = {}, accept) =>
    fetch(`${SUPABASE_URL}/rest/v1${rest}`, {
      ...init,
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, ...(accept ? { Accept: accept } : {}), ...(init.headers ?? {}) },
    })

  // ---- /mcp: server MCP per agenti ---------------------------------------------
  // Bypassa il gate read/write generico qui sotto (pensato per REST): ogni tool
  // decide da sé se serve scope write, tools/list e initialize non ne hanno bisogno.
  if (path === '/mcp') {
    const res = await handleMcp(req, { owner, keyId, scopes, pg, log })
    return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...rl } })
  }

  const isRead = req.method === 'GET' || req.method === 'HEAD'
  if (!isRead && !scopes.includes('write')) {
    await log(403)
    return json({ error: 'scope', hint: 'questa chiave è di sola lettura: serve lo scope write' }, 403, rl)
  }
  if (isRead && !scopes.includes('read')) { await log(403); return json({ error: 'scope' }, 403, rl) }

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
