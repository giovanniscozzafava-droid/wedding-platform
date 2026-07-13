// option-notify — quando il pro blocca la data "senza impegno", avvisa il CLIENTE via email per
// velocizzare la decisione ("ho tenuto la tua data fino al …, conferma per non perderla").
// Opzionale (il frontend lo chiama solo se la spunta è attiva). Best-effort: se l'email non è
// configurata torna {skipped:true}. Auth: solo il proprietario del preventivo.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const auth = req.headers.get('Authorization') ?? ''
  const { data: caller } = await admin.auth.getUser(auth.slice(7))
  if (!caller?.user) return json({ error: 'unauthorized' }, 401)

  const b = await req.json().catch(() => ({})) as { quote_id?: string }
  if (!b.quote_id) return json({ error: 'no_quote' }, 400)

  const { data: q } = await admin.from('quotes')
    .select('id, owner_id, title, client_name, client_email, event_date, access_token, entry_id')
    .eq('id', b.quote_id).maybeSingle()
  if (!q) return json({ error: 'quote_not_found' }, 404)
  if (q.owner_id !== caller.user.id) return json({ error: 'forbidden' }, 403)
  if (!q.client_email) return json({ ok: true, skipped: true, reason: 'no_client_email' })

  const { data: ce } = await admin.from('calendar_entries').select('option_expires_at').eq('id', q.entry_id).maybeSingle()
  const { data: owner } = await admin.from('profiles').select('business_name, full_name, brand_primary_color').eq('id', q.owner_id).maybeSingle()
  const proName = owner?.business_name ?? owner?.full_name ?? 'Il professionista'
  const primary = owner?.brand_primary_color ?? '#1A2E4F'
  const scad = ce?.option_expires_at ? new Date(ce.option_expires_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const link = q.access_token ? `${APP_BASE}/p/accept/${q.access_token}` : `${APP_BASE}/area-cliente`
  const dateFmt = q.event_date ? new Date(q.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  const html = `<div style="font-family:Georgia,serif;background:#F7F4EE;padding:28px 16px;color:#1A1714">
  <table role="presentation" width="100%"><tr><td align="center">
    <table role="presentation" width="520" style="max-width:520px;background:#FFFDF8;border-radius:14px;overflow:hidden">
      <tr><td style="background:${primary};height:4px"></td></tr>
      <tr><td style="padding:28px 30px">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${primary}">Data tenuta per te</div>
        <h1 style="font-size:22px;margin:8px 0 6px">Ho bloccato la tua data${dateFmt ? ` del ${esc(dateFmt)}` : ''}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px">Te la tengo <strong>senza impegno</strong>${scad ? ` fino al <strong>${esc(scad)}</strong>` : ''}. Se vuoi assicurartela, ti basta confermare il preventivo: dopo quella data potrebbe tornare disponibile per altri.</p>
        <a href="${link}" style="display:inline-block;background:${primary};color:#fff;padding:12px 26px;border-radius:40px;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px">Conferma la data</a>
        <p style="margin:22px 0 0;font-size:13px;color:#787164">— ${esc(proName)}</p>
      </td></tr>
    </table>
    <p style="font-size:10px;color:#A59C8E;margin-top:12px">Powered by Planfully</p>
  </td></tr></table></div>`

  try {
    await sendEmail({ to: q.client_email, subject: `Ho tenuto la tua data${scad ? ` (fino al ${scad})` : ''}`, html })
    return json({ ok: true, sent: true })
  } catch {
    return json({ ok: true, skipped: true, reason: 'email_error' })
  }
})
