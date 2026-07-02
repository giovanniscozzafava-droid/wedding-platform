// stripe-webhook — riceve gli eventi Stripe, VERIFICA LA FIRMA, aggiorna il tier.
// verify_jwt: FALSE (imposta in config.toml) — Stripe non manda un JWT Supabase.
// La sicurezza è la FIRMA del webhook (STRIPE_WEBHOOK_SECRET): FAIL-CLOSED.
// Idempotente: ogni event.id è processato una sola volta (tabella stripe_events).
import Stripe from 'https://esm.sh/stripe@16?target=deno'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' })
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

async function resolveProfile(customerId: string): Promise<string | null> {
  const { data } = await admin.from('stripe_customers').select('profile_id').eq('stripe_customer_id', customerId).maybeSingle()
  if (data?.profile_id) return data.profile_id
  // fallback: metadata del customer
  try {
    const c = await stripe.customers.retrieve(customerId)
    const pid = (c as Stripe.Customer)?.metadata?.profile_id
    return pid ?? null
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })

  // 1) VERIFICA FIRMA — se manca o non valida, si rifiuta (fail-closed)
  const sig = req.headers.get('stripe-signature')
  if (!sig || !WEBHOOK_SECRET) return new Response('no_signature', { status: 400 })
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET)
  } catch (e) {
    return new Response(`bad_signature: ${(e as Error).message}`, { status: 400 })
  }

  // 2) IDEMPOTENZA — se l'evento è GIÀ stato processato con successo, esci subito.
  //    Il segno di "processato" si scrive DOPO l'elaborazione (punto 4), così un
  //    fallimento a metà lascia l'evento riprocessabile al retry di Stripe.
  const already = await admin.from('stripe_events').select('id').eq('id', event.id).maybeSingle()
  if (already.data) return new Response('duplicate_ok', { status: 200 })

  // 3) applica lo stato abbonamento
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.mode === 'subscription' && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string)
          const pid = (s.client_reference_id as string) || await resolveProfile(s.customer as string)
          if (pid) await applySub(pid, sub)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        const pid = await resolveProfile(sub.customer as string)
        if (pid) await applySub(pid, sub)
        break
      }
      default:
        break // ignora gli altri eventi
    }
  } catch (e) {
    // errore applicativo: 500 → Stripe riproverà. L'evento NON è segnato come
    // processato, quindi il retry lo rielabora da capo. stripe_apply_subscription
    // è un upsert idempotente, quindi rielaborare è sicuro.
    return new Response(`apply_error: ${(e as Error).message}`, { status: 500 })
  }

  // 4) elaborazione riuscita → segna processato (idempotenza per i retry futuri)
  await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  return new Response('ok', { status: 200 })
})

async function applySub(profileId: string, sub: Stripe.Subscription) {
  const price = sub.items.data[0]?.price?.id ?? null
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
  await admin.rpc('stripe_apply_subscription', {
    p_profile: profileId,
    p_sub_id: sub.id,
    p_status: sub.status,
    p_price: price,
    p_period_end: periodEnd,
    p_cancel_at_end: sub.cancel_at_period_end,
  })
}
