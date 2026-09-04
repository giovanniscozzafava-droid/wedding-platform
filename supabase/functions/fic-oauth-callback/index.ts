// Callback OAuth Fatture in Cloud: scambia il code → token (endpoint FIC vuole
// JSON, non x-www-form-urlencoded come Google), recupera l'azienda collegata
// (GET /user/companies), cifra i token (AES-GCM, stessa chiave di Drive) e
// salva la connessione del professionista.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encryptToken, hasKey } from '../_shared/drive-crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('FIC_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('FIC_CLIENT_SECRET') ?? ''
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/fic-oauth-callback`
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '')

function back(q: string, extra?: Record<string, string>) {
  const loc = new URL(`${APP_BASE}/profile`)
  loc.searchParams.set('fic', q)
  if (extra) for (const [k, v] of Object.entries(extra)) loc.searchParams.set(k, v)
  return new Response(null, { status: 302, headers: { Location: loc.toString() } })
}

Deno.serve(async (req) => {
  const u = new URL(req.url)
  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  if (u.searchParams.get('error')) return back('denied')
  if (!code || !state || !CLIENT_ID || !CLIENT_SECRET) return back('error')
  if (!hasKey()) return back('nokey') // fail-closed: senza chiave NON salviamo token

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: st } = await admin.from('fic_oauth_states').select('professional_id').eq('state', state).maybeSingle()
  if (!st?.professional_id) return back('badstate')
  await admin.from('fic_oauth_states').delete().eq('state', state)

  try {
    const r = await fetch('https://api-v2.fattureincloud.it/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, code }),
    })
    const d = await r.json()
    if (!r.ok || !d.access_token || !d.refresh_token) { console.error('fic_token_exchange', r.status, d); return back('token') }

    const cr = await fetch('https://api-v2.fattureincloud.it/user/companies', { headers: { Authorization: `Bearer ${d.access_token}` } })
    const cd = await cr.json().catch(() => ({}))
    // Forma reale (verificata su un account vero): { data: { companies: [...] } }.
    const companies: Array<{ id?: number; name?: string; vat_number?: string }> = Array.isArray(cd?.data?.companies) ? cd.data.companies : []
    if (!cr.ok || companies.length === 0) { console.error('fic_companies', cr.status, cd); return back('nocompany') }

    // Un account Fatture in Cloud può controllare più aziende (es. commercialista,
    // o più partite IVA sulla stessa persona): non si prende "la prima della lista",
    // si fa combaciare la P.IVA con quella già sul profilo Planfully del
    // professionista. Ambiguo (nessun match, più aziende) → si ferma, non indovina.
    const { data: prof } = await admin.from('profiles').select('vat_number').eq('id', st.professional_id).maybeSingle()
    const profVat = digits(prof?.vat_number)
    let company = companies.length === 1 ? companies[0] : undefined
    if (!company && profVat) company = companies.find((c) => digits(c.vat_number) === profVat)
    if (!company) {
      console.error('fic_companies_no_vat_match', profVat, companies.map((c) => ({ id: c.id, name: c.name, vat: c.vat_number })))
      // Dettaglio breve (solo cifre, niente graffe/gergo) per non finire umanizzato via.
      const ivaTrovate = companies.map((c) => digits(c.vat_number) || '?').join(', ').slice(0, 120)
      return back(profVat ? 'novatmatch' : 'setvatfirst', { fic_iva: ivaTrovate, fic_iva_profilo: profVat })
    }
    if (!company.id) { console.error('fic_company_no_id', company); return back('nocompany') }

    const accessEnc = b64(await encryptToken(String(d.access_token)))
    const refreshEnc = b64(await encryptToken(String(d.refresh_token)))
    const expiresAt = new Date(Date.now() + (Number(d.expires_in) || 86400) * 1000).toISOString()

    const { error: se } = await admin.from('fic_connections').upsert({
      professional_id: st.professional_id, company_id: String(company.id), company_name: company.name ?? null,
      access_token_enc: accessEnc, refresh_token_enc: refreshEnc, token_expires_at: expiresAt, updated_at: new Date().toISOString(),
    })
    if (se) { console.error('fic_save', se.message); return back('save') }

    return back('connected')
  } catch (e) {
    console.error('fic_oauth_callback', (e as Error).message)
    return back('error')
  }
})
