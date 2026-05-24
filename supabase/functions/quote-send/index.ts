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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
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

  const body = (await req.json().catch(() => ({}))) as {
    quote_id?: string
    override_reason?: string  // motivo modifica forzata post-firma
    force_resend?: boolean    // se true, non cambia status (resta ACCETTATO)
  }
  if (!body.quote_id) return json({ error: 'quote_id required' }, 400)

  // Propaga JWT user del caller (quote-generate-pdf richiede JWT user, non SERVICE_KEY)
  const callerAuth = req.headers.get('Authorization') ?? `Bearer ${SERVICE_KEY}`

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 1. genera PDF (riusa Edge Function). Header apikey serve a Kong gateway.
  const pdfRes = await fetch(`${SUPABASE_URL}/functions/v1/quote-generate-pdf`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: callerAuth,
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
  // Se force_resend (modifica forzata post-firma), NON cambia status
  const updatePayload: Record<string, unknown> = {
    access_token: accessToken,
    sent_at: new Date().toISOString(),
    sent_email_log: [
      ...((q.sent_email_log ?? []) as any[]),
      {
        at: new Date().toISOString(),
        to: q.client_email,
        revision: q.revision,
        ...(body.override_reason ? { override_reason: body.override_reason } : {}),
      },
    ],
  }
  if (!body.force_resend) updatePayload.status = 'INVIATO'
  await admin.from('quotes').update(updatePayload).eq('id', body.quote_id)

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
    const isOverride = !!body.override_reason
    const subject = isOverride
      ? `⚠️ Modifica al preventivo già accettato · ${q.title}`
      : `Preventivo ${q.title}`
    const html = isOverride
      ? `<!doctype html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f4ef;padding:24px;color:#1A2E4F">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.06)">
  <div style="background:linear-gradient(135deg,#1A1714 0%,#7E6633 100%);padding:28px;text-align:center;color:#F3EEE4">
    <h1 style="margin:0;font-size:22px">Modifica al preventivo</h1>
    <p style="margin:6px 0 0;opacity:0.85;font-size:13px">${escapeHtml(q.title)} · revisione v${q.revision}</p>
  </div>
  <div style="padding:28px">
    <p style="line-height:1.6;font-size:15px;color:#4a5568;margin:0 0 14px">
      Buongiorno, il wedding planner ha apportato delle modifiche al preventivo che avevi <strong>già accettato</strong>. Trovi qui di seguito la motivazione.
    </p>
    <div style="margin:18px 0;padding:14px;background:#f6f4ef;border-left:3px solid #C49A5C;border-radius:6px;color:#4a5568;line-height:1.5">
      <strong style="display:block;font-size:11px;color:#1A2E4F;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Motivo della modifica</strong>
      ${escapeHtml(body.override_reason ?? '')}
    </div>
    <p style="line-height:1.6;font-size:14px;color:#4a5568">
      Ti chiediamo di rivedere il preventivo aggiornato cliccando il pulsante qui sotto. Se hai dubbi, rispondi a questa email per parlare direttamente col tuo wedding planner.
    </p>
    <div style="margin:24px 0;text-align:center">
      <a href="${link}" style="display:inline-block;background:#C49A5C;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Apri preventivo aggiornato</a>
    </div>
  </div>
  <div style="background:#f6f4ef;padding:16px;text-align:center;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0">Un progetto Fuyue Srl · planfully.it</div>
</div></body>`
      : `<p>Buongiorno,</p><p>il preventivo per <strong>${escapeHtml(q.title)}</strong> e' pronto.</p><p><a href="${link}">Visualizza preventivo</a></p>`
    emailResult = await sendResend(q.client_email, subject, html)
  }

  return json({
    ok: true,
    access_token: accessToken,
    pdf_url: pdfJson.url,
    email_result: emailResult,
  })
})
