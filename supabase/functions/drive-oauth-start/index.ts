// Avvia il collegamento Google Drive del professionista (scope minimo drive.file).
// Crea uno state legato all'utente e ritorna l'URL di autorizzazione Google.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const SCOPE = 'https://www.googleapis.com/auth/drive.file'   // MAI 'drive' (accesso totale)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!CLIENT_ID) return json({ error: 'no_google_app', hint: 'Imposta i secret GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / DRIVE_TOKEN_KEY.' }, 503)

  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  await admin.from('drive_oauth_states').insert({ state, professional_id: user.id })

  const redirectUri = `${SUPABASE_URL}/functions/v1/drive-oauth-callback`
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&access_type=offline&prompt=consent` +
    `&include_granted_scopes=true&scope=${encodeURIComponent(SCOPE)}&state=${state}`
  return json({ url })
})
