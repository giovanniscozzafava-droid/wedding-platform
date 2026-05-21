// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@wedding-platform.test'
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'http://localhost:5173'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

async function sendResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { skipped: true as const }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  return r.ok ? { ok: true as const } : { error: await r.text() }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { quote_id?: string }
  if (!body.quote_id) return json({ error: 'quote_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 1. genera PDF (riusa Edge Function). Header apikey serve a Kong gateway.
  const pdfRes = await fetch(`${SUPABASE_URL}/functions/v1/quote-generate-pdf`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ quote_id: body.quote_id }),
  })
  if (!pdfRes.ok) {
    return json({ error: 'pdf generation failed', detail: await pdfRes.text() }, 500)
  }
  const pdfJson = await pdfRes.json()

  // 2. carica quote (con eventuale token gia` esistente)
  const { data: q } = await admin.from('quotes').select('*').eq('id', body.quote_id).single()
  if (!q) return json({ error: 'quote not found' }, 404)

  let accessToken = q.access_token as string | null
  if (!accessToken) {
    accessToken = crypto.randomUUID()
  }

  // 3. update status + access_token
  await admin.from('quotes').update({
    status: 'INVIATO',
    access_token: accessToken,
    sent_at: new Date().toISOString(),
    sent_email_log: [
      ...((q.sent_email_log ?? []) as any[]),
      { at: new Date().toISOString(), to: q.client_email, revision: q.revision },
    ],
  }).eq('id', body.quote_id)

  // 4. crea calendar_entry IN_TRATTATIVA se non esiste + agganci participants
  if (q.event_date) {
    const { data: existing } = await admin
      .from('calendar_entries')
      .select('id')
      .eq('quote_id', body.quote_id)
      .maybeSingle()
    let entryId = existing?.id as string | undefined
    if (!entryId) {
      const created = await admin.from('calendar_entries').insert({
        owner_id: q.owner_id,
        title: q.title,
        client_name: q.client_name,
        client_email: q.client_email,
        date_from: q.event_date,
        date_to: q.event_date,
        status: 'IN_TRATTATIVA',
        value_amount: q.total_client,
        quote_id: body.quote_id,
      }).select('id').single()
      entryId = created.data?.id
    }
    if (entryId) {
      const { data: suppliers } = await admin
        .from('quote_items')
        .select('supplier_id')
        .eq('quote_id', body.quote_id)
        .not('supplier_id', 'is', null)
      const uniq = new Set<string>()
      for (const s of (suppliers ?? []) as any[]) {
        if (s.supplier_id) uniq.add(s.supplier_id as string)
      }
      if (uniq.size > 0) {
        const rows = Array.from(uniq).map((uid) => ({
          entry_id: entryId!,
          user_id: uid,
          role_in_entry: 'fornitore',
        }))
        await admin.from('calendar_entry_participants').upsert(rows, { onConflict: 'entry_id,user_id' })
      }
    }
  }

  // 5. invia email cliente
  let emailResult: any = { skipped: true }
  if (q.client_email) {
    const link = `${APP_BASE}/p/preview/${accessToken}`
    emailResult = await sendResend(
      q.client_email,
      `Preventivo ${q.title}`,
      `<p>Buongiorno,</p><p>il preventivo per <strong>${q.title}</strong> e' pronto.</p><p><a href="${link}">Visualizza preventivo</a></p>`,
    )
  }

  return json({
    ok: true,
    access_token: accessToken,
    pdf_url: pdfJson.url,
    email_result: emailResult,
  })
})
