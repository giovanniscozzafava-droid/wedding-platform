// deno-lint-ignore-file no-explicit-any
// Avvisa lo staff via email quando arriva una segnalazione ALTA/BLOCCANTE,
// così non deve controllare il pannello per accorgersi dei problemi gravi.
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

  const body = (await req.json().catch(() => ({}))) as { message?: string; url?: string; severity?: string }
  const message = (body.message ?? '').trim()
  const severity = (body.severity ?? 'NORMALE').trim()
  if (!message) return json({ error: 'message required' }, 400)
  // Notifichiamo solo i problemi gravi (gli altri restano nel pannello).
  if (severity !== 'ALTA' && severity !== 'BLOCCANTE') return json({ ok: true, skipped: true })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authHeader = req.headers.get('authorization') ?? ''
  let reporter = 'Un utente'
  let replyTo: string | undefined
  if (authHeader.startsWith('Bearer ')) {
    const { data: ud } = await admin.auth.getUser(authHeader.slice(7))
    if (ud?.user) {
      replyTo = ud.user.email ?? undefined
      const { data: p } = await admin.from('profiles').select('business_name, full_name').eq('id', ud.user.id).maybeSingle()
      reporter = p?.business_name ?? p?.full_name ?? ud.user.email ?? 'Un utente'
    }
  }

  // Destinatari: tutti gli staff + casella generale.
  const set = new Set<string>([STAFF_EMAIL])
  const { data: staff } = await admin.from('profiles').select('id').eq('is_support_staff', true)
  for (const s of (staff ?? [])) {
    const { data: su } = await admin.auth.admin.getUserById(s.id)
    if (su?.user?.email) set.add(su.user.email)
  }

  const html = `<!doctype html><html lang="it"><body style="font-family:Georgia,serif;color:#1A1714">
    <h2 style="margin:0 0 4px;color:#b91c1c">Segnalazione ${esc(severity)}</h2>
    <p style="color:#787164;margin:0 0 14px;font-size:13px">Da <strong>${esc(reporter)}</strong>${body.url ? ` · su ${esc(body.url)}` : ''}</p>
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;background:#FBF7EF;border-left:3px solid #b91c1c;padding:12px 16px;border-radius:6px">${esc(message)}</div>
    <p style="margin-top:16px"><a href="${APP_BASE}/admin" style="color:#1A2E4F">Apri il pannello</a></p>
  </body></html>`

  const r = await sendEmail({ to: Array.from(set), subject: `[Segnalazione ${severity}] ${message.slice(0, 60)}`, html, text: htmlToText(html), from: FROM, reply_to: replyTo })
  return json({ ok: true, emailed: r.ok })
})
