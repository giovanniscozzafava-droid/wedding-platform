// Edge function: suggested-suppliers-notify
// Invia al CLIENTE un'email con i fornitori suggeriti dal professionista
// (segnalazioni registrate in supplier_referrals per quel preventivo).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { quote_id?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (!body.quote_id) return json({ error: 'quote_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: q } = await admin.from('quotes').select('id, client_email, client_name, owner_id, event_kind').eq('id', body.quote_id).maybeSingle()
  if (!q || !q.client_email) return json({ error: 'quote_or_email_not_found' }, 404)

  // Segnalazioni per questo cliente da parte dell'owner del preventivo
  const { data: refs } = await admin.from('supplier_referrals')
    .select('id, suggested_id')
    .eq('referrer_id', q.owner_id)
    .eq('client_email', String(q.client_email).toLowerCase())
    .in('status', ['SUGGESTED', 'CONVERTED'])
  const ids = [...new Set((refs ?? []).map((r: { suggested_id: string }) => r.suggested_id))]
  if (ids.length === 0) return json({ ok: true, sent: false, reason: 'no_suggestions' })
  // sid = id della segnalazione, per certificare il contatto al click sul profilo
  const sidByForn = new Map<string, string>()
  for (const r of (refs ?? []) as Array<{ id: string; suggested_id: string }>) {
    if (!sidByForn.has(r.suggested_id)) sidByForn.set(r.suggested_id, r.id)
  }

  const { data: sup } = await admin.from('profiles')
    .select('id, full_name, business_name, subrole, slug, city')
    .in('id', ids)
  const { data: referrer } = await admin.from('profiles')
    .select('full_name, business_name').eq('id', q.owner_id).maybeSingle()
  const referrerName = referrer?.business_name ?? referrer?.full_name ?? 'Il tuo professionista'

  const cards = (sup ?? []).map((s: { id: string; business_name: string | null; full_name: string | null; subrole: string | null; slug: string | null; city: string | null }) => {
    const name = s.business_name ?? s.full_name ?? 'Fornitore'
    const sid = sidByForn.get(s.id)
    const link = s.slug ? `${APP_BASE}/p/fornitore/${s.slug}${sid ? `?sid=${sid}` : ''}` : APP_BASE
    return `
      <tr><td style="padding:12px 0;border-bottom:1px solid #EFEAE0">
        <div style="font-family:Georgia,serif;font-size:16px;color:#1A1714;font-weight:700">${esc(name)}</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#8A8275">${esc(cap(s.subrole ?? 'Fornitore'))}${s.city ? ' · ' + esc(s.city) : ''}</div>
        <a href="${link}" style="display:inline-block;margin-top:6px;font-family:Arial,sans-serif;font-size:13px;color:#B08D57;text-decoration:none">Vedi il profilo →</a>
      </td></tr>`
  }).join('')

  const html = `
  <div style="background:#F7F4EE;padding:32px 0;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF8;border-radius:14px;overflow:hidden">
      <tr><td style="height:6px;background:#B08D57"></td></tr>
      <tr><td style="padding:28px 32px 8px 32px">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B08D57">Fornitori consigliati</div>
        <h1 style="font-family:Georgia,serif;font-size:24px;color:#1A1714;margin:6px 0 4px">${esc(referrerName)} ti consiglia questi professionisti</h1>
        <p style="font-family:Arial,sans-serif;font-size:14px;color:#6B6358;line-height:1.6;margin:0">
          Professionisti di fiducia per il tuo${q.event_kind && q.event_kind !== 'matrimonio' ? ' ' + esc(q.event_kind) : ''} evento. Dai un'occhiata ai loro profili.
        </p>
      </td></tr>
      <tr><td style="padding:8px 32px 24px 32px">
        <table role="presentation" width="100%">${cards}</table>
      </td></tr>
      <tr><td style="padding:0 32px 28px 32px">
        <a href="${APP_BASE}/area-cliente/accedi" style="display:inline-block;background:#1A1714;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px">Apri la tua area cliente</a>
      </td></tr>
      <tr><td style="padding:0 32px 24px 32px;font-family:Arial,sans-serif;font-size:11px;color:#A59C8E">Ricevi questa email perché ${esc(referrerName)} ti ha consigliato dei colleghi su Planfully.</td></tr>
    </table>
  </div>`

  try {
    await sendEmailSES({ to: String(q.client_email), subject: `${referrerName} ti consiglia alcuni professionisti`, html })
  } catch (e) {
    return json({ error: 'send_failed', detail: String(e) }, 500)
  }
  return json({ ok: true, sent: true, count: ids.length })
})
