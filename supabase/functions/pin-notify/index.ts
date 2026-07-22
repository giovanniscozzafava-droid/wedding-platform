// Notifica sui pin del catalogo: quando il CLIENTE scrive (nuovo pin o messaggio), avvisa il fotografo.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell, esc } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

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
    html: emailShell({
      eyebrow: 'Catalogo album',
      title: 'Domanda sul catalogo album',
      subtitleHtml: b.pin_comment ? `Sul modello: <em>“${esc(b.pin_comment)}”</em>` : undefined,
      bodyHtml: `<p style="margin:0;font-size:15px"><strong>“${esc(b.message || '')}”</strong></p>`,
      cta: { href: `${APP_BASE}/album-lab`, label: 'Apri e rispondi' },
      contactHtml: "Rispondi dal catalogo dell'evento: il cliente vede la tua risposta nel pin.",
    }),
  }).catch(() => {})
  return json({ ok: true, sent: true })
})
