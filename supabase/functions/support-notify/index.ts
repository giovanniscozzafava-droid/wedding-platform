// deno-lint-ignore-file no-explicit-any
// Notifica una replica del ticket alla parte giusta:
//  - to_role='CUSTOMER': lo staff ha risposto → email al cliente.
//  - to_role='STAFF':    il cliente ha ribattuto → email allo staff.
// L'inserimento del messaggio lo fa il frontend (RLS + trigger). Qui solo email.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail, htmlToText } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = Deno.env.get('SES_FROM_EMAIL') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'
const STAFF_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? 'hello@planfully.it'
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { ticket_id?: string; body?: string; to_role?: 'CUSTOMER' | 'STAFF' }
  if (!body.ticket_id || !body.body || !body.to_role) return json({ error: 'ticket_id + body + to_role required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: ud } = await admin.auth.getUser(authHeader.slice(7))
  if (!ud?.user) return json({ error: 'unauthorized' }, 401)
  const caller = ud.user

  const { data: t } = await admin.from('support_tickets')
    .select('id, user_id, subject, reparto').eq('id', body.ticket_id).maybeSingle()
  if (!t) return json({ error: 'ticket not found' }, 404)

  let to: string
  let replyTo: string | undefined
  let subject: string
  let intro: string
  if (body.to_role === 'CUSTOMER') {
    // Solo lo staff può scrivere al cliente.
    const { data: cp } = await admin.from('profiles').select('role, is_support_staff').eq('id', caller.id).maybeSingle()
    if (!(cp?.is_support_staff || cp?.role === 'ADMIN')) return json({ error: 'forbidden' }, 403)
    const { data: cu } = await admin.auth.admin.getUserById(t.user_id)
    to = cu?.user?.email ?? ''
    if (!to) return json({ error: 'no customer email' }, 400)
    replyTo = STAFF_EMAIL
    subject = `Risposta alla tua richiesta · ${t.subject}`
    intro = 'Hai ricevuto una risposta dal nostro staff:'
  } else {
    // Cliente → staff: solo il proprietario del ticket può notificare lo staff.
    if (t.user_id !== caller.id) return json({ error: 'forbidden' }, 403)
    to = STAFF_EMAIL
    replyTo = caller.email ?? undefined
    subject = `Nuova risposta del cliente · ${t.subject}`
    intro = `${esc(caller.email ?? 'Il cliente')} ha aggiunto un messaggio:`
  }

  const link = `${APP_BASE}/assistenza`
  const html = `<!doctype html><html lang="it"><body style="font-family:Georgia,serif;color:#1A1714">
    <p style="font-size:14px;color:#787164;margin:0 0 12px">${intro}</p>
    <p style="font-size:15px;font-weight:600;margin:0 0 6px">${esc(t.subject)}</p>
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;background:#FBF7EF;border-left:3px solid #C49A5C;padding:12px 16px;border-radius:6px">${esc(body.body)}</div>
    <p style="margin-top:16px"><a href="${link}" style="color:#1A2E4F">Apri la conversazione</a></p>
  </body></html>`

  const r = await sendEmail({ to, subject, html, text: htmlToText(html), from: FROM, reply_to: replyTo })
  return json({ ok: true, emailed: r.ok })
})
