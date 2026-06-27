// Notifica sui pin del catalogo: quando il CLIENTE scrive (nuovo pin o messaggio), avvisa il fotografo.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (x: string) => (x ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const b = await req.json().catch(() => ({})) as Record<string, string>
  if (!b.entryId || b.from_role !== 'client') return json({ ok: true, skipped: true }) // v1: notifichiamo solo il fotografo
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', b.entryId).maybeSingle()
  const pid = gal?.owner_id
  if (!pid) return json({ ok: true, sent: false })
  const { data: proAuth } = await admin.auth.admin.getUserById(pid)
  const proEmail = proAuth?.user?.email
  if (!proEmail) return json({ ok: true, sent: false })

  await sendEmail({
    to: proEmail,
    subject: 'Un cliente ti ha scritto sul catalogo album',
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1714;max-width:520px">
      <h2 style="font-size:18px;margin:0 0 6px">Domanda sul catalogo album</h2>
      ${b.pin_comment ? `<p style="margin:0 0 8px;color:#6b6b6b">Sul modello: <em>“${esc(b.pin_comment)}”</em></p>` : ''}
      <p style="margin:0 0 16px;font-size:15px"><strong>“${esc(b.message || '')}”</strong></p>
      <p style="margin:18px 0"><a href="${APP_BASE}/album-lab" style="display:inline-block;background:#c9a227;color:#1a2e4f;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:9px">Apri e rispondi</a></p>
      <p style="font-size:12px;color:#9a9a9a">Rispondi dal catalogo dell'evento: il cliente vede la tua risposta nel pin.</p>
    </div>`,
  }).catch(() => {})
  return json({ ok: true, sent: true })
})
