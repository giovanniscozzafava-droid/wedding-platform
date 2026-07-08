// Edge function track-open: registra l'apertura di un preventivo da parte del CLIENTE (anonimo).
// Scrive come service_role (l'hardening blocca le scritture anonime dirette su quotes).
// RAW fetch a PostgREST con apikey+Authorization ESPLICITI = service key: così non c'è alcuna
// possibilità che il client erediti l'auth del chiamante (anon dal browser) → sempre service_role.
// POST { token: uuid, ua?: string } → 204 (best-effort).
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

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/track_quote_open`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ p_token: token, p_ua: (body.ua ?? '').toString().slice(0, 300) || null }),
    })
    // Consumare la response: in Deno edge, se non la leggi il fetch può non completare prima del return.
    await res.text().catch(() => {})
  } catch { /* best-effort */ }

  return new Response(null, { status: 204, headers: cors })
})
