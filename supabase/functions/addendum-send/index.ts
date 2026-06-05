// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = Deno.env.get('SES_FROM_EMAIL') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { addendum_id?: string }
  if (!body.addendum_id) return json({ error: 'addendum_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Autenticazione + ownership: solo il proprietario del contratto (o admin).
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: callerData, error: callerErr } = await admin.auth.getUser(authHeader.slice(7))
  if (callerErr || !callerData.user) return json({ error: 'unauthorized' }, 401)
  const callerId = callerData.user.id

  const { data: a } = await admin.from('contract_addendums')
    .select('id, title, amount_delta, status, access_token, contract_id')
    .eq('id', body.addendum_id).single()
  if (!a) return json({ error: 'addendum not found' }, 404)

  const { data: c } = await admin.from('contracts')
    .select('id, title, client_name, client_email, owner_id').eq('id', a.contract_id).single()
  if (!c) return json({ error: 'contract not found' }, 404)

  if (c.owner_id !== callerId) {
    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerId).maybeSingle()
    if (callerProfile?.role !== 'ADMIN') return json({ error: 'forbidden' }, 403)
  }
  if (!c.client_email) return json({ error: 'no_client_email' }, 400)

  let token = a.access_token as string | null
  if (!token) {
    token = crypto.randomUUID()
    await admin.from('contract_addendums').update({ access_token: token }).eq('id', a.id)
  }
  // Marca come INVIATO se ancora in bozza.
  if (a.status === 'BOZZA') await admin.from('contract_addendums').update({ status: 'INVIATO', sent_at: new Date().toISOString() }).eq('id', a.id)

  const { data: owner } = await admin.from('profiles')
    .select('full_name, business_name, brand_primary_color, phone').eq('id', c.owner_id).maybeSingle()
  const { data: ownerAuth } = await admin.auth.admin.getUserById(c.owner_id)
  const ownerEmail = ownerAuth?.user?.email ?? null
  const wpName = owner?.business_name ?? owner?.full_name ?? 'Il tuo organizzatore'
  const primary = owner?.brand_primary_color ?? '#1A2E4F'

  const link = `${APP_BASE}/p/addendum/${token}`
  const delta = Number(a.amount_delta ?? 0)
  const deltaFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', signDisplay: 'always' }).format(delta)

  const html = `<!doctype html><html lang="it"><body style="font-family:Georgia,serif;background:#F8F5EE;margin:0;padding:32px 16px;color:#1A1714">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="560" style="max-width:560px;background:#FDFBF6;border-radius:14px;overflow:hidden">
    <tr><td style="background:${primary};height:4px"></td></tr>
    <tr><td style="padding:32px 36px">
      <img src="https://planfully.it/brand/planfully-symbol.png" width="40" height="40" style="display:block;border-radius:8px;border:0" alt="Planfully" />
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A59C8E;margin:18px 0 4px">Addendum da firmare</p>
      <h1 style="font-size:26px;margin:0 0 6px;color:${primary}">${esc(a.title ?? 'Addendum al contratto')}</h1>
      <p style="font-size:14px;color:#787164;margin:0 0 18px">Da <strong>${esc(wpName)}</strong> · variazione ${deltaFmt}</p>
      <p style="font-size:15px;line-height:1.7;color:#1A1714;margin:0 0 22px">
        Le voci concordate sono cambiate rispetto al contratto firmato. Trovi qui l'atto integrativo (addendum): aprilo e firmalo online, come hai già fatto per il contratto.
      </p>
      <a href="${link}" style="display:inline-block;background:${primary};color:#FFFFFF;padding:14px 32px;border-radius:40px;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:1px">Apri e firma l'addendum</a>
      <p style="margin:26px 0 0;font-size:12px;color:#A59C8E">${ownerEmail ? esc(ownerEmail) : ''}${ownerEmail && owner?.phone ? ' · ' : ''}${owner?.phone ? esc(owner.phone) : ''}</p>
    </td></tr>
    <tr><td style="background:${primary};height:3px"></td></tr>
  </table>
  <p style="font-size:10px;color:#A59C8E;margin-top:16px;letter-spacing:1px">Powered by Planfully · Un progetto Fuyue Srl</p>
</td></tr></table>
</body></html>`

  const r = await sendEmail({
    to: c.client_name ? `${c.client_name.replace(/[",;<>\r\n]/g, ' ')} <${c.client_email}>` : c.client_email,
    subject: `Addendum da firmare · ${c.title}`,
    html,
    from: `${wpName.replace(/[",;<>\r\n]/g, ' ').slice(0, 60)} via Planfully <${(FROM.match(/<(.+)>/)?.[1]) ?? FROM}>`,
    reply_to: ownerEmail ?? undefined,
    headers: {
      'List-Unsubscribe': `<mailto:${ownerEmail ?? 'noreply@planfully.it'}?subject=unsubscribe>`,
      'X-Entity-Ref-ID': String(a.id),
    },
  })
  if (!r.ok && (r as any).reason === 'no_credentials') return json({ ok: true, skipped: true, link })
  if (!r.ok) return json({ error: (r as any).error ?? 'send_failed', link }, 500)
  return json({ ok: true, link })
})
