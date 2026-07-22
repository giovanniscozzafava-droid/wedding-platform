// Edge function: lead-notify
// Triggered da database webhook on insert lead_requests.
// Invia 2 email via Resend:
// 1) Al WP/Location: 'Nuova richiesta di preventivo'
// 2) Al cliente: 'Abbiamo ricevuto la tua richiesta'

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

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
    const rows = [
      ['Nome', `<strong>${esc(lead.client_name)}</strong>`],
      ['Email', `<a href="mailto:${esc(lead.client_email)}" style="color:#25402F">${esc(lead.client_email)}</a>`],
      ...(lead.client_phone ? [['Telefono', `<a href="tel:${esc(lead.client_phone)}" style="color:#25402F">${esc(lead.client_phone)}</a>`]] : []),
      ['Evento', esc(lead.event_kind)],
      ...(eventDate ? [['Data', esc(eventDate)]] : []),
      ...(lead.event_location ? [['Location', esc(lead.event_location)]] : []),
      ...(lead.guests_estimate ? [['Invitati', String(lead.guests_estimate)]] : []),
      ...(lead.budget_range ? [['Budget', esc(lead.budget_range)]] : []),
    ].map(([k, v]) => `<tr><td style="padding:4px 0;color:#6B6B63">${k}:</td><td style="padding:4px 0;text-align:right">${v}</td></tr>`).join('')
    const wpHtml = emailShell({
      eyebrow: 'Nuova richiesta',
      title: 'Hai un nuovo cliente potenziale',
      subtitleHtml: `<strong>${esc(lead.client_name)}</strong> ha richiesto un preventivo per il suo evento`,
      bodyHtml: `<table style="width:100%;font-size:14px;color:#181F1B;border-collapse:collapse">${rows}</table>${lead.message ? `<div style="border-left:2px solid #25402F;padding:10px 14px;margin:16px 0;background:#F4F3EE;font-style:italic;color:#181F1B;font-size:14px">"${esc(lead.message)}"</div>` : ''}<p style="font-size:12px;color:#6B6B63;margin:16px 0 0">Rispondi entro 48 ore per migliorare il tuo tasso di chiusura.</p>`,
      cta: { href: `${APP_BASE}/leads`, label: 'Apri la tua inbox' },
    })
    await sendEmail(wpEmail, `Nuova richiesta da ${lead.client_name}`, wpHtml)
  }

  // Email 2: al cliente (conferma ricezione)
  const clientHtml = emailShell({
    eyebrow: 'Richiesta ricevuta',
    title: `Grazie ${lead.client_name}`,
    bodyHtml: `<p style="margin:0 0 16px">Abbiamo ricevuto la tua richiesta di preventivo per <strong>${esc(wpDisplay)}</strong> (${wpRole}).</p><p style="margin:0">Riceverai una risposta direttamente <strong>entro 48 ore</strong>. Nel frattempo puoi esplorare il portale e altri professionisti che potrebbero interessarti.</p>${wp.slug ? `<p style="margin:18px 0 0;font-size:13px"><a href="${APP_BASE}/p/wp/${esc(wp.slug)}" style="color:#181F1B;text-decoration:underline">Rivedi il profilo di ${esc(wpDisplay)}</a></p>` : ''}`,
  })
  await sendEmail(lead.client_email, `Abbiamo ricevuto la tua richiesta per ${wpDisplay}`, clientHtml)

  return json({ ok: true })
})
