// «Magari riconciliando, perché potrebbe essere stata già emessa» (Giovanni,
// 04/09/2026). Una rata può essere già fatturata FUORI da Planfully (emessa a
// mano su Fatture in Cloud prima di collegare questo flusso, o da un altro
// gestionale). Qui si registra IL COLLEGAMENTO: non si chiama Fatture in
// Cloud, non si crea nulla — solo si smette di proporre "Crea fattura" per
// quella rata perché la fattura, altrove, già esiste.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  let body: { payment_id?: string; invoice_number?: string; invoice_id?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const paymentId = (body.payment_id ?? '').trim()
  const invoiceNumber = (body.invoice_number ?? '').trim()
  if (!paymentId || !invoiceNumber) return json({ error: 'bad_input', hint: 'Serve il numero della fattura già emessa.' }, 400)

  // RLS: aggiorna solo se la rata è del professionista che chiama.
  const { data, error } = await (sb.from('contract_payments' as any) as any)
    .update({
      fic_invoice_id: (body.invoice_id ?? '').trim() || `manual:${invoiceNumber}`,
      fic_invoice_number: invoiceNumber,
      fic_invoice_created_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .select('id')
    .maybeSingle()
  if (error) return json({ error: 'db_error', detail: error.message }, 500)
  if (!data) return json({ error: 'not_found' }, 404)

  return json({ ok: true, fic_invoice_number: invoiceNumber })
})
