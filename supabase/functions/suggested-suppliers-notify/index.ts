// Edge function: suggested-suppliers-notify
// Invia al CLIENTE un'email con i fornitori suggeriti dal professionista
// (segnalazioni registrate in supplier_referrals per quel preventivo).

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
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { quote_id?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (!body.quote_id) return json({ error: 'quote_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // AUTORIZZAZIONE: invocata dal professionista loggato → richiediamo un JWT valido e che il
  // chiamante sia l'OWNER del preventivo (o un admin). Senza questo, chiunque con l'anon key
  // potrebbe scatenare l'email-ai-fornitori per un quote_id altrui.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: au } = await admin.auth.getUser(authHeader.slice(7))
  const caller = au?.user
  if (!caller) return json({ error: 'unauthorized' }, 401)

  const { data: q } = await admin.from('quotes').select('id, client_email, client_name, owner_id, event_kind').eq('id', body.quote_id).maybeSingle()
  if (!q || !q.client_email) return json({ error: 'quote_or_email_not_found' }, 404)

  const { data: me } = await admin.from('profiles').select('role').eq('id', caller.id).maybeSingle()
  if (q.owner_id !== caller.id && me?.role !== 'ADMIN') return json({ error: 'forbidden' }, 403)

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
      <tr><td style="padding:12px 0;border-bottom:1px solid #E2DFD4">
        <div style="font-size:16px;color:#181F1B;font-weight:700">${esc(name)}</div>
        <div style="font-size:12px;color:#6B6B63">${esc(cap(s.subrole ?? 'Fornitore'))}${s.city ? ' · ' + esc(s.city) : ''}</div>
        <a href="${link}" style="display:inline-block;margin-top:6px;font-size:13px;color:#25402F;text-decoration:none">Vedi il profilo →</a>
      </td></tr>`
  }).join('')

  const html = emailShell({
    eyebrow: 'Fornitori consigliati',
    title: `${referrerName} ti consiglia questi professionisti`,
    subtitleHtml: `Professionisti di fiducia per il tuo${q.event_kind && q.event_kind !== 'matrimonio' ? ' ' + esc(q.event_kind) : ''} evento. Dai un'occhiata ai loro profili.`,
    bodyHtml: `<table role="presentation" width="100%">${cards}</table>`,
    cta: { href: `${APP_BASE}/area-cliente/accedi`, label: 'Apri la tua area cliente' },
    contactHtml: `Ricevi questa email perché ${esc(referrerName)} ti ha consigliato dei colleghi su Planfully.`,
  })

  try {
    await sendEmailSES({ to: String(q.client_email), subject: `${referrerName} ti consiglia alcuni professionisti`, html })
  } catch (e) {
    return json({ error: 'send_failed', detail: String(e) }, 500)
  }
  return json({ ok: true, sent: true, count: ids.length })
})
