// payment-create — crea un pagamento cliente → professionista come DIRECT CHARGE sul conto Stripe
// collegato del pro (Connect Express). Il pro è merchant of record; Planfully è solo il tramite.
// Autenticata: il CHIAMANTE deve essere il pro che incassa (payee). Genera una Stripe Checkout
// Session e restituisce l'URL da girare al cliente (che paga su pagina ospitata da Stripe, senza login).
// In beta application_fee = 0. Motore generico: qualunque flusso passa {amount_cents, kind, ref_*}.
// Dormiente finché non è settato STRIPE_SECRET_KEY.
import Stripe from 'https://esm.sh/stripe@16?target=deno'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const KINDS = ['QUOTE_DEPOSIT', 'QUOTE_BALANCE', 'ALBUM_COMMISSION', 'PRINT_ORDER', 'OTHER']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!STRIPE_SECRET) return json({ error: 'stripe_not_configured' }, 200)

  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' })
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const { data: u } = await userClient.auth.getUser()
  const user = u.user
  if (!user) return json({ error: 'unauthorized' }, 401)

  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const amount = Math.round(Number(b.amount_cents ?? 0))
  const kind = String(b.kind ?? 'OTHER')
  if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'bad_amount' }, 400)
  if (!KINDS.includes(kind)) return json({ error: 'bad_kind' }, 400)

  // il pro che incassa = il chiamante (chi genera il link di pagamento è il pro stesso)
  const payeeId = user.id
  const { data: acct } = await admin.from('stripe_connect_accounts').select('account_id, charges_enabled').eq('profile_id', payeeId).maybeSingle()
  if (!acct?.account_id) return json({ error: 'not_onboarded' }, 200)
  if (!acct.charges_enabled) return json({ error: 'onboarding_incomplete' }, 200)

  const currency = String(b.currency ?? 'eur')
  const feeCents = Math.max(0, Math.round(Number(b.application_fee_cents ?? 0))) // beta = 0
  const description = (b.description ? String(b.description) : '') || (kind === 'QUOTE_DEPOSIT' ? 'Acconto' : kind === 'QUOTE_BALANCE' ? 'Saldo' : 'Pagamento')

  // riga PENDING nel ledger
  const { data: pay, error: perr } = await admin.from('payments').insert({
    payee_id: payeeId, kind, ref_type: b.ref_type ?? null, ref_id: b.ref_id ?? null,
    description, amount_cents: amount, currency, application_fee_cents: feeCents,
    payer_name: b.payer_name ?? null, payer_email: b.payer_email ?? null,
    connected_account_id: acct.account_id, created_by: payeeId,
  }).select('id').single()
  if (perr || !pay) return json({ error: 'db_error', detail: perr?.message }, 500)

  try {
    // DIRECT CHARGE: la sessione è creata SUL conto collegato ({ stripeAccount }).
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price_data: { currency, unit_amount: amount, product_data: { name: description } }, quantity: 1 }],
      customer_email: b.payer_email ? String(b.payer_email) : undefined,
      success_url: `${APP_BASE}/pagamento/ok?p=${pay.id}`,
      cancel_url: `${APP_BASE}/pagamento/annullato?p=${pay.id}`,
      metadata: { payment_id: pay.id },
      payment_intent_data: {
        metadata: { payment_id: pay.id },
        ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
      },
    }, { stripeAccount: acct.account_id })

    await admin.from('payments').update({ checkout_session_id: session.id }).eq('id', pay.id)
    return json({ ok: true, url: session.url, payment_id: pay.id })
  } catch (e) {
    await admin.from('payments').update({ status: 'FAILED' }).eq('id', pay.id)
    return json({ error: 'stripe_error', detail: String(e).slice(0, 300) }, 200)
  }
})
