// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'
import { emailShell } from '../_shared/emailLayout.ts'

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

  const body = (await req.json().catch(() => ({}))) as { contract_id?: string }
  if (!body.contract_id) return json({ error: 'contract_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Autenticazione + ownership: solo il proprietario del contratto (o un admin)
  // può inviarlo. Senza questo gate, qualunque utente autenticato potrebbe
  // generare un access_token e mandare email su contratti altrui (IDOR).
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: callerData, error: callerErr } = await admin.auth.getUser(authHeader.slice(7))
  if (callerErr || !callerData.user) return json({ error: 'unauthorized' }, 401)
  const callerId = callerData.user.id

  const { data: c } = await admin.from('contracts')
    .select('id, title, client_name, client_email, total_amount, status, access_token, owner_id, pdf_url')
    .eq('id', body.contract_id).single()
  if (!c) return json({ error: 'contract not found' }, 404)

  if (c.owner_id !== callerId) {
    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerId).maybeSingle()
    if (callerProfile?.role !== 'ADMIN') return json({ error: 'forbidden' }, 403)
  }
  // Assicura un access_token per il link di firma.
  let token = c.access_token as string | null
  if (!token) {
    token = crypto.randomUUID()
    await admin.from('contracts').update({ access_token: token }).eq('id', c.id)
  }

  const { data: owner } = await admin.from('profiles')
    .select('full_name, business_name, brand_primary_color, phone').eq('id', c.owner_id).maybeSingle()
  const { data: ownerAuth } = await admin.auth.admin.getUserById(c.owner_id)
  const ownerEmail = ownerAuth?.user?.email ?? null
  const wpName = owner?.business_name ?? owner?.full_name ?? 'Il tuo organizzatore'
  const primary = owner?.brand_primary_color ?? '#1A2E4F'

  const link = `${APP_BASE}/p/contract/${token}`
  // Nessuna email cliente (es. cliente diretto): il link di firma esiste comunque → si condivide via
  // WhatsApp / copia. "Portare alla firma" non deve fallire solo perché manca l'indirizzo email.
  if (!c.client_email) return json({ ok: true, link, skipped: 'no_email' })
  const totFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(c.total_amount ?? 0))
  const isSigned = c.status === 'FIRMATO'
  const subject = isSigned ? `Copia del contratto · ${c.title}` : `Contratto da firmare · ${c.title}`

  const html = emailShell({
    accent: primary,
    eyebrow: isSigned ? 'Contratto firmato' : 'Contratto da firmare',
    title: c.title,
    subtitleHtml: `Da <strong>${esc(wpName)}</strong> · ${totFmt}`,
    bodyHtml: `<p style="margin:0">${isSigned
      ? 'Trovi qui la copia del contratto. Puoi riaprirlo in qualsiasi momento dal link qui sotto.'
      : 'Apri il contratto e firmalo online in pochi minuti: ti basterà compilare i tuoi dati, il documento d’identità e firmare nel riquadro (stessa procedura del preventivo).'}</p>${c.pdf_url ? `<p style="margin:16px 0 0;font-size:13px"><a href="${esc(c.pdf_url)}" style="color:${primary}">Scarica il PDF</a></p>` : ''}`,
    cta: { href: link, label: isSigned ? 'Apri il contratto' : 'Apri e firma il contratto' },
    contactHtml: `${ownerEmail ? esc(ownerEmail) : ''}${ownerEmail && owner?.phone ? ' · ' : ''}${owner?.phone ? esc(owner.phone) : ''}`,
  })

  const r = await sendEmail({
    to: c.client_name ? `${c.client_name.replace(/[",;<>\r\n]/g, ' ')} <${c.client_email}>` : c.client_email,
    subject,
    html,
    from: `${wpName.replace(/[",;<>\r\n]/g, ' ').slice(0, 60)} via Planfully <${(FROM.match(/<(.+)>/)?.[1]) ?? FROM}>`,
    reply_to: ownerEmail ?? undefined,
    headers: {
      'List-Unsubscribe': `<mailto:${ownerEmail ?? 'noreply@planfully.it'}?subject=unsubscribe>`,
      'X-Entity-Ref-ID': String(c.id),
    },
  })
  if (!r.ok && (r as any).reason === 'no_credentials') return json({ ok: true, skipped: true, link })
  if (!r.ok) return json({ error: (r as any).error ?? 'send_failed', link }, 500)
  return json({ ok: true, link })
})
