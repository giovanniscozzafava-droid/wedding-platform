// deno-lint-ignore-file no-explicit-any
// Webhook Resend Inbound: riceve l'evento email.received (solo metadati), recupera
// il corpo completo via API e lo salva in inbound_emails (casella in-app).
// Protetto da un secret nell'URL: .../inbound-email?key=INBOUND_WEBHOOK_SECRET
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SECRET = Deno.env.get('INBOUND_WEBHOOK_SECRET') ?? ''

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  // Gate: secret nell'URL (Resend permette di impostare l'endpoint con query).
  const key = new URL(req.url).searchParams.get('key') ?? ''
  if (SECRET && key !== SECRET) return json({ error: 'unauthorized' }, 401)

  const evt = (await req.json().catch(() => ({}))) as any
  if (evt?.type !== 'email.received' || !evt?.data?.email_id) return json({ ok: true, skipped: true })
  const d = evt.data
  const emailId = String(d.email_id)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Recupera il corpo completo.
  let full: any = {}
  try {
    const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    })
    if (r.ok) full = await r.json()
  } catch { /* salvo comunque i metadati */ }

  const toArr = (full.to ?? d.to ?? []) as string[]
  await admin.from('inbound_emails').upsert({
    resend_id:  emailId,
    from_addr:  full.from ?? d.from ?? null,
    to_addr:    Array.isArray(toArr) ? toArr[0] ?? null : String(toArr ?? ''),
    subject:    full.subject ?? d.subject ?? '(senza oggetto)',
    text:       full.text ?? null,
    html:       full.html ?? null,
    headers:    full.headers ?? null,
    message_id: full.message_id ?? d.message_id ?? null,
    reply_to:   Array.isArray(full.reply_to) ? full.reply_to[0] : (full.reply_to ?? null),
    received_at: full.created_at ?? d.created_at ?? new Date().toISOString(),
  }, { onConflict: 'resend_id', ignoreDuplicates: true })
  return json({ ok: true })
})
