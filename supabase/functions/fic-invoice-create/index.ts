// «Se il contratto dice 1000 diviso tre, fatturo quella parte» (Giovanni, 04/09/2026).
// La fattura non è per contratto, è per RATA (contract_payments): un contratto a
// saldo unico ha comunque una rata sola (contract_payments_sync ne crea sempre
// almeno una), quindi copre anche quel caso senza un percorso a parte.
// Idempotente per rata: una rata già fatturata torna la fattura esistente.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getFicAccessToken } from '../_shared/fic.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })
const today = () => new Date().toISOString().slice(0, 10)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  let body: { payment_id?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const paymentId = (body.payment_id ?? '').trim()
  if (!paymentId) return json({ error: 'bad_input' }, 400)

  // RLS su entrambe: la rata e il contratto si leggono solo se sono del chiamante.
  const { data: p, error: pe } = await (sb.from('contract_payments' as any) as any)
    .select('id, contract_id, label, amount, fic_invoice_id, fic_invoice_number')
    .eq('id', paymentId).maybeSingle()
  if (pe) return json({ error: 'db_error', detail: pe.message }, 500)
  if (!p) return json({ error: 'not_found' }, 404)
  if (p.fic_invoice_id) return json({ ok: true, already: true, fic_invoice_id: p.fic_invoice_id, fic_invoice_number: p.fic_invoice_number })
  if (!p.amount || Number(p.amount) <= 0) return json({ error: 'no_amount' }, 409)

  const { data: c, error: ce } = await sb.from('contracts')
    .select('id, title, client_name, client_email, client_fiscal_code, client_vat_number, client_business_name, client_address, client_city, client_zip, client_province, client_country, client_sdi_code, client_pec_email, signed_at')
    .eq('id', p.contract_id).maybeSingle()
  if (ce) return json({ error: 'db_error', detail: ce.message }, 500)
  if (!c) return json({ error: 'not_found' }, 404)
  if (!c.signed_at) return json({ error: 'not_signed', hint: 'Il contratto non risulta ancora firmato.' }, 409)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const tok = await getFicAccessToken(admin, user.id)
  if (!tok.ok) return json({ error: tok.error, hint: tok.error === 'not_connected' ? 'Collega prima Fatture in Cloud dalle Impostazioni.' : undefined }, 400)

  const { data: conn } = await admin.from('fic_connections').select('default_vat_id, default_payment_method_id').eq('professional_id', user.id).maybeSingle()
  // 0 è un id IVA legittimo (es. aliquota 22%): !conn.default_vat_id lo tratterebbe
  // come "non configurato" per via del falsy JS. Va confrontato con null/undefined.
  if (conn?.default_vat_id == null) return json({ error: 'no_vat_configured', hint: 'Configura prima il tipo di IVA da usare (Impostazioni → Fatture in Cloud).' }, 409)

  const { data: n } = await admin.from('fic_numerations').select('numeration').eq('professional_id', user.id).eq('is_default', true).maybeSingle()
  const numeration: string | null = n?.numeration ?? null

  const entityName = (c.client_business_name || c.client_name || '').trim() || 'Cliente'
  // deno-lint-ignore no-explicit-any
  const entity: Record<string, any> = { name: entityName, country: c.client_country || 'Italia' }
  if (c.client_fiscal_code) entity.tax_code = c.client_fiscal_code
  if (c.client_vat_number) entity.vat_number = c.client_vat_number
  if (c.client_address) entity.address_street = c.client_address
  if (c.client_zip) entity.address_postal_code = c.client_zip
  if (c.client_city) entity.address_city = c.client_city
  if (c.client_province) entity.address_province = c.client_province
  if (c.client_sdi_code) entity.ei_code = c.client_sdi_code
  if (c.client_pec_email) entity.certified_email = c.client_pec_email
  if (c.client_email) entity.email = c.client_email

  const itemName = `${c.title || 'Servizio fotografico'}${p.label ? ` — ${p.label}` : ''}`
  const payload = {
    data: {
      type: 'invoice',
      entity,
      date: today(),
      ...(numeration ? { numeration } : {}),
      items_list: [{ name: itemName, qty: 1, net_price: Number(p.amount), vat: { id: conn.default_vat_id } }],
      ...(conn.default_payment_method_id ? { payment_method: { id: conn.default_payment_method_id } } : {}),
    },
  }

  const r = await fetch(`https://api-v2.fattureincloud.it/c/${tok.companyId}/issued_documents`, {
    method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${tok.accessToken}` },
    body: JSON.stringify(payload),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    console.error('fic_invoice_create', r.status, JSON.stringify(d))
    return json({ error: 'fic_error', status: r.status, detail: d }, 502)
  }
  const doc = d?.data ?? d
  const { error: ue } = await admin.from('contract_payments').update({
    fic_invoice_id: String(doc?.id ?? ''), fic_invoice_number: doc?.number != null ? String(doc.number) : null,
    fic_invoice_created_at: new Date().toISOString(),
  }).eq('id', paymentId)
  if (ue) console.error('fic_invoice_save', ue.message)

  return json({ ok: true, fic_invoice_id: doc?.id, fic_invoice_number: doc?.number, numeration })
})
