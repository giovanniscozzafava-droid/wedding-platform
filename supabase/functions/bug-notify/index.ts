// deno-lint-ignore-file no-explicit-any
// Avvisa lo staff via email quando arriva una segnalazione ALTA/BLOCCANTE,
// così non deve controllare il pannello per accorgersi dei problemi gravi.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell, esc } from '../_shared/emailLayout.ts'

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

  const html = emailShell({
    accent: '#C03B2A', // lacca: allerta staff
    eyebrow: `Segnalazione ${severity}`,
    title: 'Nuova segnalazione',
    subtitleHtml: `Da <strong>${esc(reporter)}</strong>${body.url ? ` · su ${esc(body.url)}` : ''}`,
    bodyHtml: `<div style="white-space:pre-wrap">${esc(message)}</div>`,
    cta: { href: `${APP_BASE}/admin`, label: 'Apri il pannello' },
  })

  const r = await sendEmail({ to: Array.from(set), subject: `[Segnalazione ${severity}] ${message.slice(0, 60)}`, html, from: FROM, reply_to: replyTo })
  return json({ ok: true, emailed: r.ok })
})
