// stripe-portal — apre il Billing Portal di Stripe per gestire/disdire l'abbonamento.
// Autenticata (verify_jwt = true di default). Restituisce l'URL del portale per il customer del
// profilo loggato. Dormiente finché non è settato STRIPE_SECRET_KEY.
import Stripe from 'https://esm.sh/stripe@16?target=deno'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' })
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const { data: u } = await userClient.auth.getUser()
  const user = u.user
  if (!user) return json({ error: 'unauthorized' }, 401)

  const { data: sc } = await admin.from('stripe_customers').select('stripe_customer_id').eq('profile_id', user.id).maybeSingle()
  if (!sc?.stripe_customer_id) return json({ error: 'no_customer' }, 400)

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sc.stripe_customer_id,
      return_url: `${APP_BASE}/profile`,
    })
    return json({ ok: true, url: portal.url })
  } catch (e) {
    return json({ error: 'stripe_error', detail: (e as Error).message }, 500)
  }
})
