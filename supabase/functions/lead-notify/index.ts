// Edge function: lead-notify
// Triggered da database webhook on insert lead_requests.
// Invia 2 email via Resend:
// 1) Al WP/Location: 'Nuova richiesta di preventivo'
// 2) Al cliente: 'Abbiamo ricevuto la tua richiesta'

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

async function sendEmail(to: string, subject: string, html: string) {
  return sendEmailSES({ to, subject, html })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { lead_id?: string; record?: { id: string } }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  // Compatibile sia con chiamata diretta sia con database webhook (record.id)
  const leadId = body.lead_id ?? body.record?.id
  if (!leadId) return json({ error: 'lead_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: lead } = await admin.from('lead_requests').select('*').eq('id', leadId).maybeSingle()
  if (!lead) return json({ error: 'lead not found' }, 404)

  const { data: wp } = await admin.from('profiles')
    .select('full_name, business_name, slug, role')
    .eq('id', lead.wp_id).maybeSingle()
  if (!wp) return json({ error: 'wp not found' }, 404)

  const wpDisplay = wp.business_name ?? wp.full_name ?? 'Planfully'
  const wpRole = wp.role === 'LOCATION' ? 'Location' : 'Wedding Planner'
  const eventDate = lead.event_date ? new Date(lead.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  // Email 1: al WP
  const { data: wpAuth } = await admin.auth.admin.getUserById(lead.wp_id).catch(() => ({ data: null } as { data: { user?: { email?: string } } | null }))
  const wpEmail = wpAuth?.user?.email
  if (wpEmail) {
    const wpHtml = `<!DOCTYPE html>
<html><body style="margin:0;background:#FDFBF6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1A1714;padding:0">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 8px;color:#C49A5C">Planfully</h1>
  </div>
  <div style="background:#fff;border:1px solid #E4DED2;border-radius:16px;padding:32px">
    <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#C49A5C;margin:0 0 8px">Nuova richiesta</p>
    <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 16px;line-height:1.2">Hai un nuovo cliente potenziale.</h2>
    <p style="font-size:15px;line-height:1.6;color:#3a3a3a;margin:0 0 20px"><strong>${esc(lead.client_name)}</strong> ha richiesto un preventivo per il suo evento.</p>
    <div style="background:#FDFBF6;border-radius:12px;padding:20px;margin:20px 0">
      <table style="width:100%;font-size:14px;color:#1A1714">
        <tr><td style="padding:4px 0;color:#6E6E6E">Nome:</td><td style="padding:4px 0;text-align:right"><strong>${esc(lead.client_name)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#6E6E6E">Email:</td><td style="padding:4px 0;text-align:right"><a href="mailto:${esc(lead.client_email)}" style="color:#C49A5C">${esc(lead.client_email)}</a></td></tr>
        ${lead.client_phone ? `<tr><td style="padding:4px 0;color:#6E6E6E">Telefono:</td><td style="padding:4px 0;text-align:right"><a href="tel:${esc(lead.client_phone)}" style="color:#C49A5C">${esc(lead.client_phone)}</a></td></tr>` : ''}
        <tr><td style="padding:4px 0;color:#6E6E6E">Evento:</td><td style="padding:4px 0;text-align:right">${esc(lead.event_kind)}</td></tr>
        ${eventDate ? `<tr><td style="padding:4px 0;color:#6E6E6E">Data:</td><td style="padding:4px 0;text-align:right">${esc(eventDate)}</td></tr>` : ''}
        ${lead.event_location ? `<tr><td style="padding:4px 0;color:#6E6E6E">Location:</td><td style="padding:4px 0;text-align:right">${esc(lead.event_location)}</td></tr>` : ''}
        ${lead.guests_estimate ? `<tr><td style="padding:4px 0;color:#6E6E6E">Invitati:</td><td style="padding:4px 0;text-align:right">${lead.guests_estimate}</td></tr>` : ''}
        ${lead.budget_range ? `<tr><td style="padding:4px 0;color:#6E6E6E">Budget:</td><td style="padding:4px 0;text-align:right">${esc(lead.budget_range)}</td></tr>` : ''}
      </table>
    </div>
    ${lead.message ? `<div style="border-left:3px solid #C49A5C;padding:12px 16px;margin:20px 0;background:#FDFBF6;font-style:italic;color:#3a3a3a;font-size:14px">"${esc(lead.message)}"</div>` : ''}
    <div style="text-align:center;margin-top:28px">
      <a href="${APP_BASE}/leads" style="display:inline-block;background:#C49A5C;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px">Apri la tua inbox</a>
    </div>
    <p style="font-size:12px;color:#6E6E6E;margin-top:24px;text-align:center">Rispondi entro 48 ore per migliorare il tuo tasso di chiusura.</p>
  </div>
  <p style="font-size:11px;color:#6E6E6E;text-align:center;margin-top:20px">© Planfully · Fuyue Srl</p>
</div></body></html>`
    await sendEmail(wpEmail, `🎉 Nuova richiesta da ${lead.client_name}`, wpHtml)
  }

  // Email 2: al cliente (conferma ricezione)
  const clientHtml = `<!DOCTYPE html>
<html><body style="margin:0;background:#FDFBF6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1A1714;padding:0">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 8px;color:#C49A5C">Planfully</h1>
  </div>
  <div style="background:#fff;border:1px solid #E4DED2;border-radius:16px;padding:32px">
    <h2 style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px;line-height:1.2">Grazie ${esc(lead.client_name)}!</h2>
    <p style="font-size:15px;line-height:1.6;color:#3a3a3a;margin:0 0 16px">
      Abbiamo ricevuto la tua richiesta di preventivo per <strong>${esc(wpDisplay)}</strong> (${wpRole}).
    </p>
    <p style="font-size:15px;line-height:1.6;color:#3a3a3a;margin:0 0 20px">
      Riceverai una risposta direttamente <strong>entro 48 ore</strong>. Nel frattempo puoi esplorare il portale e altri professionisti che potrebbero interessarti.
    </p>
    ${wp.slug ? `<div style="text-align:center;margin-top:24px"><a href="${APP_BASE}/p/wp/${esc(wp.slug)}" style="display:inline-block;background:#1A1714;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;font-size:13px">Rivedi il profilo di ${esc(wpDisplay)}</a></div>` : ''}
    <div style="text-align:center;margin-top:14px"><a href="${APP_BASE}/scopri-pro" style="font-size:13px;color:#C49A5C">Scopri altri professionisti italiani →</a></div>
  </div>
  <p style="font-size:11px;color:#6E6E6E;text-align:center;margin-top:20px">© Planfully · Il portale dei professionisti degli eventi italiani</p>
</div></body></html>`
  await sendEmail(lead.client_email, `Abbiamo ricevuto la tua richiesta per ${wpDisplay}`, clientHtml)

  return json({ ok: true })
})
