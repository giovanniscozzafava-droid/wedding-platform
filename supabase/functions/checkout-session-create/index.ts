// checkout-session-create — apre una Stripe Checkout Session per l'abbonamento del professionista.
// Autenticata (verify_jwt = true di default): il chiamante è l'utente loggato. Crea/collega lo
// stripe_customer del profilo e restituisce l'URL di checkout. client_reference_id = profile_id
// (così il webhook checkout.session.completed sa a chi applicare il tier). Accetta solo price NOTI
// (presenti in stripe_price_map). Dormiente finché non è settato STRIPE_SECRET_KEY.
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

  // 1) utente autenticato dal JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const { data: u } = await userClient.auth.getUser()
  const user = u.user
  if (!user) return json({ error: 'unauthorized' }, 401)

  // 2) price valido e noto (mappato a un tier)
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const priceId = String(body.price_id ?? '')
  if (!priceId) return json({ error: 'no_price' }, 400)
  const { data: pm } = await admin.from('stripe_price_map').select('tier').eq('price_id', priceId).maybeSingle()
  if (!pm) return json({ error: 'unknown_price' }, 400)

  // 3) customer Stripe (crea o riusa quello del profilo)
  let customerId: string | undefined
  const { data: sc } = await admin.from('stripe_customers').select('stripe_customer_id').eq('profile_id', user.id).maybeSingle()
  if (sc?.stripe_customer_id) {
    customerId = sc.stripe_customer_id
  } else {
    const cust = await stripe.customers.create({ email: user.email ?? undefined, metadata: { profile_id: user.id } })
    customerId = cust.id
    await admin.from('stripe_customers').insert({ profile_id: user.id, stripe_customer_id: customerId })
  }

  // 4) Checkout Session (abbonamento)
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      allow_promotion_codes: true,
      success_url: `${APP_BASE}/profile?stripe=success`,
      cancel_url: `${APP_BASE}/profile?stripe=cancel`,
    })
    return json({ ok: true, url: session.url })
  } catch (e) {
    return json({ error: 'stripe_error', detail: (e as Error).message }, 500)
  }
})
