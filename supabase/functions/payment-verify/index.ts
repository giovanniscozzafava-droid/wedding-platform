// payment-verify — allinea lo stato di un pagamento leggendolo DIRETTAMENTE da Stripe (fallback al
// webhook, utile in Sandbox dove la consegna degli eventi Connect non è garantita). Autorevole e
// idempotente: lo stato viene da Stripe, l'input è solo il payment_id (uuid non indovinabile).
// Chiamata dalla pagina di esito /pagamento/ok. Dormiente finché non è settato STRIPE_SECRET_KEY.
import Stripe from 'https://esm.sh/stripe@16?target=deno'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!STRIPE_SECRET) return json({ error: 'stripe_not_configured' }, 200)

  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' })
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const paymentId = String(b.payment_id ?? '')
  if (!paymentId) return json({ error: 'no_payment_id' }, 400)

  const { data: pay } = await admin.from('payments')
    .select('id, status, checkout_session_id, connected_account_id').eq('id', paymentId).maybeSingle()
  if (!pay) return json({ error: 'not_found' }, 200)
  if (pay.status === 'PAID') return json({ ok: true, status: 'PAID' })
  if (!pay.checkout_session_id) return json({ ok: true, status: pay.status })

  try {
    // Direct charge: la sessione vive SUL conto collegato.
    const s = await stripe.checkout.sessions.retrieve(
      pay.checkout_session_id as string,
      pay.connected_account_id ? { stripeAccount: pay.connected_account_id as string } : undefined,
    )
    if (s.payment_status === 'paid') {
      await admin.from('payments').update({
        status: 'PAID', paid_at: new Date().toISOString(),
        payment_intent_id: (s.payment_intent as string) ?? null,
      }).eq('id', pay.id).neq('status', 'REFUNDED')
      return json({ ok: true, status: 'PAID' })
    }
    return json({ ok: true, status: pay.status })
  } catch (e) {
    return json({ error: 'stripe_error', detail: String(e).slice(0, 200) }, 200)
  }
})
