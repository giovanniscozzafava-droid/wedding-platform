// deno-lint-ignore-file no-explicit-any
// Risposta a una email in entrata, dalla casella planfully.it (via Resend).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail, htmlToText } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

  const body = (await req.json().catch(() => ({}))) as { inbound_id?: string; body?: string }
  if (!body.inbound_id || !body.body?.trim()) return json({ error: 'inbound_id + body required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: ud } = await admin.auth.getUser(authHeader.slice(7))
  if (!ud?.user) return json({ error: 'unauthorized' }, 401)
  const { data: cp } = await admin.from('profiles').select('role, is_support_staff').eq('id', ud.user.id).maybeSingle()
  if (!(cp?.is_support_staff || cp?.role === 'ADMIN')) return json({ error: 'forbidden' }, 403)

  const { data: mail } = await admin.from('inbound_emails')
    .select('from_addr, to_addr, subject, message_id').eq('id', body.inbound_id).maybeSingle()
  if (!mail) return json({ error: 'email not found' }, 404)
  if (!mail.from_addr) return json({ error: 'no sender to reply to' }, 400)

  const subject = (mail.subject ?? '').toLowerCase().startsWith('re:') ? mail.subject! : `Re: ${mail.subject ?? ''}`
  const fromAddr = mail.to_addr ?? 'hello@planfully.it' // rispondiamo dall'indirizzo a cui hanno scritto
  const html = `<div style="font-family:Georgia,serif;color:#1A1714;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(body.body.trim())}</div>`

  const r = await sendEmail({
    to: mail.from_addr,
    subject,
    html,
    text: htmlToText(html),
    from: `Planfully <${fromAddr}>`,
    reply_to: fromAddr,
    headers: mail.message_id ? { 'In-Reply-To': mail.message_id, 'References': mail.message_id } : undefined,
  })
  if (r.ok) await admin.from('inbound_emails').update({ status: 'READ' }).eq('id', body.inbound_id)
  return json({ ok: r.ok })
})
