// Notifica via email quando un professionista inizia a seguirti (o si candida).
// Chiamata dal client subito dopo request_follow. Anti-spam: deve esistere davvero la
// riga follows (caller → target). Il destinatario è il professionista SEGUITO.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: caller } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').slice(7))
  if (!caller?.user) return json({ error: 'auth' }, 401)

  let body: { target_id?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const target = body.target_id
  if (!target || target === caller.user.id) return json({ error: 'bad_input' }, 400)

  // anti-spam: il follow caller→target deve esistere davvero
  const { data: rel } = await admin.from('follows').select('status').eq('follower_id', caller.user.id).eq('followed_id', target).maybeSingle()
  if (!rel) return json({ error: 'no_follow' }, 403)
  const approved = String((rel as { status: string }).status) === 'APPROVED'

  const { data: me } = await admin.from('profiles').select('full_name, business_name').eq('id', caller.user.id).maybeSingle()
  const { data: tgtAuth } = await admin.auth.admin.getUserById(target)
  const toEmail = tgtAuth?.user?.email
  if (!toEmail) return json({ error: 'no_target_email' }, 404)
  const { data: tgt } = await admin.from('profiles').select('full_name').eq('id', target).maybeSingle()

  const follower = esc((me?.business_name || me?.full_name || 'Un professionista') as string)
  const firstName = esc(((tgt?.full_name as string | null) ?? '').split(' ')[0] ?? '')
  const link = `${APP_BASE}/suppliers/${caller.user.id}`
  const verb = approved ? 'ha iniziato a seguirti' : 'vuole seguirti'
  const intro = approved
    ? `<strong>${follower}</strong> ha iniziato a seguirti su Planfully. Da ora vede i tuoi aggiornamenti nel feed.`
    : `<strong>${follower}</strong> si è candidato a seguirti: puoi approvare o ignorare la richiesta dalla tua rete.`
  const cta = approved ? 'Guarda il suo profilo' : 'Vedi la richiesta'

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
    <div style="background:#1a2e4f;color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">
      <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.8">Planfully · Rete</p>
      <h1 style="margin:6px 0 0;font-size:22px">${follower} ${verb}</h1>
    </div>
    <div style="border:1px solid #e6e8ec;border-top:none;border-radius:0 0 14px 14px;padding:24px">
      <p>${firstName ? 'Ciao ' + firstName + ',' : 'Ciao,'}</p>
      <p>${intro}</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${link}" style="display:inline-block;background:#c9a227;color:#1a2e4f;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px">${cta}</a>
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px">Ricevi questa email perché un altro professionista ti ha aggiunto alla sua rete su Planfully.</p>
    </div>
  </div>`

  const r = await sendEmail({ to: toEmail, subject: `${follower} ${verb} su Planfully`, html })
  if (!r.ok) return json({ error: 'email_failed', reason: (r as { reason?: string }).reason }, 502)
  return json({ ok: true })
})
