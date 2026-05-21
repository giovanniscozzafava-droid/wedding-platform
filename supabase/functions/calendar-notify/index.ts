// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@wedding-platform.test'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', ...cors },
  })
}

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { skipped: true }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!r.ok) {
    const text = await r.text()
    return { error: text }
  }
  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const body = (await req.json().catch(() => ({}))) as {
    entry_id?: string
    event?: 'entry_created' | 'entry_updated' | 'status_change'
  }
  if (!body.entry_id) return json({ error: 'entry_id required' }, 400)

  const { data: entry, error: e1 } = await admin
    .from('calendar_entries')
    .select('id, title, date_from, date_to, status, owner_id')
    .eq('id', body.entry_id)
    .maybeSingle()
  if (e1 || !entry) return json({ error: 'entry not found' }, 404)

  const { data: parts, error: e2 } = await admin
    .from('calendar_entry_participants')
    .select('user_id, user:profiles!calendar_entry_participants_user_id_fkey(id, full_name, business_name)')
    .eq('entry_id', entry.id)
  if (e2) return json({ error: 'participants error', detail: e2.message }, 500)

  const { data: owner } = await admin
    .from('profiles')
    .select('full_name, business_name')
    .eq('id', entry.owner_id)
    .maybeSingle()

  const recipients: Array<{ user_id: string; email: string }> = []
  for (const p of (parts ?? []) as any[]) {
    const { data: au } = await admin.auth.admin.getUserById(p.user_id)
    if (au.user?.email) recipients.push({ user_id: p.user_id, email: au.user.email })
  }

  const subject =
    body.event === 'entry_updated'
      ? `Aggiornamento evento ${entry.date_from}`
      : `Nuova richiesta per ${entry.date_from}`
  const html = `
    <p>Ciao,</p>
    <p>${owner?.business_name ?? owner?.full_name ?? 'Un capostipite'} ti ha ${body.event === 'entry_updated' ? 'aggiornato' : 'inserito in'} un evento sul calendario:</p>
    <ul>
      <li><strong>Titolo:</strong> ${entry.title}</li>
      <li><strong>Data:</strong> dal ${entry.date_from} al ${entry.date_to}</li>
      <li><strong>Stato:</strong> ${entry.status}</li>
    </ul>
    <p>Accedi alla piattaforma per vedere i dettagli.</p>
  `

  const results: Array<{ to: string; status: string }> = []
  for (const r of recipients) {
    const send = await sendResendEmail(r.email, subject, html)
    const status = (send as any).ok ? 'sent' : (send as any).skipped ? 'skipped_no_resend' : 'error'
    results.push({ to: r.email, status })

    await admin.from('notification_queue').insert({
      user_id: r.user_id,
      event_type: body.event ?? 'entry_event',
      payload: { entry_id: entry.id, subject, status, detail: (send as any).error ?? null },
      scheduled_for: new Date().toISOString(),
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      last_error: (send as any).error ?? null,
    })
  }

  return json({ ok: true, recipients: results.length, results })
})
