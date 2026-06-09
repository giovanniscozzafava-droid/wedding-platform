// Avvia il collegamento Instagram (Instagram API with Instagram Login).
// Crea uno state legato al professionista e ritorna l'URL di autorizzazione.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IG_APP_ID = Deno.env.get('INSTAGRAM_APP_ID') ?? ''
const SCOPE = 'instagram_business_basic'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!IG_APP_ID) return json({ error: 'no_ig_app', hint: 'Imposta i secret INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET.' }, 503)

  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  await admin.from('instagram_oauth_states').insert({ state, profile_id: user.id })

  const redirectUri = `${SUPABASE_URL}/functions/v1/instagram-oauth-callback`
  const url = `https://www.instagram.com/oauth/authorize?client_id=${IG_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code` +
    `&scope=${encodeURIComponent(SCOPE)}&state=${state}`
  return json({ url })
})
