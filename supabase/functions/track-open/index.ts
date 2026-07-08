// Edge function track-open: registra l'apertura di un preventivo da parte del CLIENTE.
// Perché un edge e non la RPC diretta: l'hardening blocca le scritture ANONIME su `quotes`
// (permette service_role e l'owner). Il cliente è anonimo → la sua chiamata diretta a
// track_quote_open non aggiornerebbe nulla. Qui giriamo come service_role → open_count/quote_views.
//
// NB: forziamo esplicitamente apikey + Authorization al SERVICE key, altrimenti il client
// eredita l'auth del chiamante (anon dal browser) e agirebbe come anon → RLS blocca lo write.
//
// POST { token: uuid, ua?: string } → 204 (best-effort).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: cors })

  let body: { token?: string; ua?: string }
  try { body = await req.json() } catch { return new Response(null, { status: 204, headers: cors }) }
  const token = (body.token ?? '').trim()
  if (!UUID.test(token)) return new Response(null, { status: 204, headers: cors })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  })
  await admin.rpc('track_quote_open', { p_token: token, p_ua: (body.ua ?? '').toString().slice(0, 300) || null })

  return new Response(null, { status: 204, headers: cors })
})
