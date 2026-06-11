// Restituisce al professionista (owner, autenticato) un access_token Drive FRESCO
// per l'upload diretto browser→Drive. Il refresh_token resta cifrato server-side;
// qui lo decifriamo, facciamo il refresh con Google e diamo solo un token a breve
// scadenza, per il suo Drive. I byte dei file NON passano da Planfully.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: conn } = await admin.from('drive_connections').select('refresh_token_enc').eq('professional_id', user.id).maybeSingle()
  if (!conn?.refresh_token_enc) return json({ error: 'not_connected' }, 400)

  try {
    const refresh = await decryptToken(Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)))
    const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
    const d = await r.json()
    if (!r.ok || !d.access_token) return json({ error: 'refresh_failed', detail: d }, 502)
    return json({ access_token: d.access_token, expires_in: d.expires_in })
  } catch (e) {
    return json({ error: 'token_error', detail: String((e as Error).message) }, 500)
  }
})
