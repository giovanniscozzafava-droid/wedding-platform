// connect-onboard — Stripe Connect (Express) per i professionisti che incassano.
// Autenticata (verify_jwt = true di default): il chiamante è il pro loggato.
// - Se non ha ancora un account Connect: lo crea (Express, IT) e lo salva in stripe_connect_accounts.
// - Restituisce un Account Link di ONBOARDING (KYC/IBAN ospitati da Stripe).
// - Con {dashboard:true}, se già onboardato, restituisce un login link alla Express Dashboard.
// Dormiente finché non è settato STRIPE_SECRET_KEY. Solo ruoli FORNITORE/WEDDING_PLANNER/LOCATION.
import Stripe from 'https://esm.sh/stripe@16?target=deno'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const PAYEE_ROLES = ['FORNITORE', 'WEDDING_PLANNER', 'LOCATION']

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

  const { data: prof } = await admin.from('profiles').select('role, business_name, full_name').eq('id', user.id).maybeSingle()
  if (!prof || !PAYEE_ROLES.includes(prof.role)) return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const { data: existing } = await admin.from('stripe_connect_accounts').select('account_id').eq('profile_id', user.id).maybeSingle()
  let accountId = existing?.account_id as string | undefined

  // Sincronizza lo stato REALE del conto da Stripe nella nostra tabella. Non dipende dal webhook:
  // così "Incassi attivi" riflette la verità anche in Sandbox / senza eventi Connect.
  async function syncStatus(id: string) {
    try {
      const a = await stripe.accounts.retrieve(id)
      const patch = {
        charges_enabled: a.charges_enabled ?? false,
        payouts_enabled: a.payouts_enabled ?? false,
        details_submitted: a.details_submitted ?? false,
        updated_at: new Date().toISOString(),
      }
      await admin.from('stripe_connect_accounts').update(patch).eq('account_id', id)
      return patch
    } catch { return null }
  }

  // Modalità SYNC: aggiorna e restituisci solo lo stato (niente creazione, niente link).
  // Sicura da chiamare a ogni load: se non c'è un account non ne crea uno.
  if (body.sync === true) {
    if (!accountId) return json({ ok: true, status: null })
    return json({ ok: true, status: await syncStatus(accountId) })
  }

  // Crea l'account Express se non c'è ancora.
  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: 'express',
      country: 'IT',
      email: user.email ?? undefined,
      business_type: 'individual',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { name: prof.business_name ?? prof.full_name ?? undefined },
      metadata: { profile_id: user.id },
    })
    accountId = acct.id
    await admin.from('stripe_connect_accounts').insert({ profile_id: user.id, account_id: accountId, country: acct.country ?? 'IT' })
  }

  try {
    const live = await syncStatus(accountId)
    // login link alla Express Dashboard (solo se già operativo)
    if (body.dashboard === true && live?.charges_enabled) {
      const link = await stripe.accounts.createLoginLink(accountId)
      return json({ ok: true, url: link.url, mode: 'dashboard' })
    }
    // altrimenti: onboarding (KYC/IBAN)
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_BASE}/settings/incassi?stripe=refresh`,
      return_url: `${APP_BASE}/settings/incassi?stripe=return`,
      type: 'account_onboarding',
    })
    return json({ ok: true, url: link.url, mode: 'onboarding' })
  } catch (e) {
    return json({ error: 'stripe_error', detail: String(e).slice(0, 300) }, 200)
  }
})
