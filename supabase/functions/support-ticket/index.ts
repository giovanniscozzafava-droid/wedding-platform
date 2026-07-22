// deno-lint-ignore-file no-explicit-any
// Apertura ticket di assistenza: salva il ticket e NOTIFICA lo staff via email,
// così la richiesta "arriva" davvero (non resta solo nel database).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell, esc } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = Deno.env.get('SES_FROM_EMAIL') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'
const STAFF_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? 'hello@planfully.it'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

// Destinatari staff: tutti i profili is_support_staff + la casella generale.
async function staffRecipients(admin: any): Promise<string[]> {
  const set = new Set<string>([STAFF_EMAIL])
  const { data: staff } = await admin.from('profiles').select('id').eq('is_support_staff', true)
  for (const s of (staff ?? [])) {
    const { data: u } = await admin.auth.admin.getUserById(s.id)
    if (u?.user?.email) set.add(u.user.email)
  }
  return Array.from(set)
}

const REPARTO_LABEL: Record<string, string> = {
  GENERALE: 'Domanda generale', TECNICO: 'Problema tecnico',
  FATTURAZIONE: 'Abbonamento / fatturazione', SUGGERIMENTO: 'Suggerimento / idea',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { reparto?: string; subject?: string; message?: string }
  const subject = (body.subject ?? '').trim()
  const message = (body.message ?? '').trim()
  const reparto = (body.reparto ?? 'GENERALE').trim()
  if (!subject || !message) return json({ error: 'subject + message required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Identifica il richiedente (per reply-to + contesto).
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: ud } = await admin.auth.getUser(authHeader.slice(7))
  const user = ud?.user
  if (!user) return json({ error: 'unauthorized' }, 401)

  const { data: prof } = await admin.from('profiles')
    .select('full_name, business_name, role, phone').eq('id', user.id).maybeSingle()
  const who = prof?.business_name ?? prof?.full_name ?? user.email ?? 'Utente'

  // Salva il ticket.
  await admin.from('support_tickets').insert({
    user_id: user.id, reparto, subject, message,
  })

  // Notifica lo staff.
  const repartoLabel = REPARTO_LABEL[reparto] ?? reparto
  const html = emailShell({
    eyebrow: `Nuovo ticket · ${repartoLabel}`,
    title: subject,
    subtitleHtml: `Da <strong>${esc(who)}</strong> (${esc(user.email ?? '')})${prof?.role ? ` · ${esc(prof.role)}` : ''}${prof?.phone ? ` · ${esc(prof.phone)}` : ''}`,
    bodyHtml: `<div style="white-space:pre-wrap">${esc(message)}</div>`,
    contactHtml: `Rispondi a questa email per scrivere direttamente a ${esc(who)}.`,
  })

  const r = await sendEmail({
    to: await staffRecipients(admin),
    subject: `[Assistenza · ${repartoLabel}] ${subject}`,
    html,
    from: FROM,
    reply_to: user.email ?? undefined,
  })
  if (!r.ok && (r as any).reason === 'no_credentials') return json({ ok: true, emailed: false })
  return json({ ok: true, emailed: r.ok })
})
