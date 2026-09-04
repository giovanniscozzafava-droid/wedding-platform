// Avvia il collegamento Fatture in Cloud del professionista. Stesso schema di
// drive-oauth-start: crea uno state legato all'utente, ritorna l'URL di
// autorizzazione. Scope minimi verificati sulla doc ufficiale — bastano per
// leggere/creare clienti e fatture; se in futuro serve altro (es. acconti,
// preventivi) si allarga qui e si ri-autorizza.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('FIC_CLIENT_ID') ?? ''
// settings:r → IVA e metodi di pagamento (senza, /info/vat_types e
// /info/payment_methods rispondono 403: verificato su un collegamento reale).
const SCOPE = 'entity.clients:r entity.clients:a issued_documents.invoices:r issued_documents.invoices:a settings:r'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!CLIENT_ID) return json({ error: 'no_fic_app', hint: 'Imposta i secret FIC_CLIENT_ID / FIC_CLIENT_SECRET / DRIVE_TOKEN_KEY.' }, 503)

  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  await admin.from('fic_oauth_states').insert({ state, professional_id: user.id })

  const redirectUri = `${SUPABASE_URL}/functions/v1/fic-oauth-callback`
  const url = `https://api-v2.fattureincloud.it/oauth/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPE)}&state=${state}`
  return json({ url })
})
