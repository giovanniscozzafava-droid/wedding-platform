// deno-lint-ignore-file no-explicit-any
// Invia alla coppia il link al questionario iniziale (registrazione + form preferenze).
// Crea wedding_couple_members con invite_token, manda email branded WP con CTA registrazione.
// Dopo il signup la coppia atterra in CoupleDashboard tab Questionario.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: {
    from?: string
    reply_to?: string
    attachments?: Array<{ filename: string; content_base64: string; content_type: string }>
  },
) {
  return sendEmailSES({
    to,
    subject,
    html,
    from: opts?.from,
    reply_to: opts?.reply_to,
    attachments: opts?.attachments,
  })
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as {
    entry_id?: string
    couple_email?: string
    couple_name?: string  // "Giovanni & Pingu"
    message?: string      // nota custom WP
  }
  if (!body.entry_id || !body.couple_email) return json({ error: 'entry_id + couple_email required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Verifica auth caller (deve essere owner del wedding)
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'missing bearer' }, 401)
  const { data: me } = await admin.auth.getUser(auth.slice(7))
  if (!me.user) return json({ error: 'unauthorized' }, 401)

  const { data: entry } = await admin.from('calendar_entries').select('id, title, owner_id, date_from, event_kind').eq('id', body.entry_id).maybeSingle()
  if (!entry) return json({ error: 'wedding not found' }, 404)
  if (entry.owner_id !== me.user.id) return json({ error: 'not your wedding' }, 403)

  // Terminologia coerente col tipo evento (no "matrimonio" per una cresima)
  const _ek = String((entry as { event_kind?: string }).event_kind ?? 'matrimonio').toLowerCase()
  const eventNoun = _ek === 'matrimonio' ? 'matrimonio'
    : _ek === 'compleanno' ? 'compleanno' : _ek === 'laurea' ? 'laurea'
    : _ek === 'anniversario' ? 'anniversario' : _ek === 'corporate' ? 'evento'
    : _ek === 'battesimo' ? 'battesimo' : _ek === 'comunione' ? 'comunione'
    : _ek === 'cresima' ? 'cresima' : 'evento'
  const eventTitleHtml = _ek === 'matrimonio' ? 'il vostro<br>matrimonio ideale' : `il vostro<br>${eventNoun} ideale`

  // Recupera info WP
  const { data: owner } = await admin.from('profiles')
    .select('full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, phone, city, bio, subscription_tier')
    .eq('id', entry.owner_id).maybeSingle()
  const { data: ownerAuth } = await admin.auth.admin.getUserById(entry.owner_id)
  const ownerEmail = ownerAuth?.user?.email ?? null
  const isPremium = owner?.subscription_tier === 'PREMIUM'

  // Crea/recupera invite_token per la coppia
  const email = body.couple_email.toLowerCase().trim()
  const { data: existing } = await admin.from('wedding_couple_members')
    .select('invite_token').eq('entry_id', entry.id).eq('email', email).maybeSingle()
  let inviteToken = existing?.invite_token
  if (!inviteToken) {
    const ins = await admin.from('wedding_couple_members').insert({
      entry_id: entry.id, email, full_name: body.couple_name ?? email.split('@')[0], role: 'SPOSA',
    }).select('invite_token').single()
    if (ins.error) return json({ error: 'invite insert failed', detail: ins.error.message }, 500)
    inviteToken = ins.data?.invite_token
  }

  const link = `${APP_BASE}/invito-coppia/${inviteToken}?step=questionario`

  // Branding — display name priorita: business_name > full_name > local part email
  const cleanName = (s: string | null | undefined): string | null => {
    if (!s) return null
    const t = s.trim()
    if (!t || t.includes('@')) return null
    return t
  }
  const ownerEmailLocal = ownerEmail ? ownerEmail.split('@')[0].replace(/\+.*$/, '').replace(/[._-]+/g, ' ').trim() : null
  const wpName = cleanName(owner?.business_name) ?? cleanName(owner?.full_name) ?? cleanName(ownerEmailLocal) ?? 'Il tuo wedding planner'
  const wpBiz = cleanName(owner?.business_name)
  const primaryColor = isPremium && owner?.brand_primary_color ? owner.brand_primary_color : '#1A2E4F'
  const accentColor = isPremium && owner?.brand_secondary_color ? owner.brand_secondary_color : '#C49A5C'
  const logoUrl = isPremium && owner?.brand_logo_url ? owner.brand_logo_url : 'https://planfully.it/brand/planfully-symbol.png'
  const safeName = (s: string) => s.replace(/[",;<>\r\n]/g, ' ').trim().slice(0, 80) || 'Planfully'
  const fromAddr = (RESEND_FROM.match(/<(.+)>/)?.[1]) ?? RESEND_FROM
  const fromHeader = `${safeName(wpBiz ?? wpName)} via Planfully <${fromAddr}>`

  const html = `<!doctype html>
<html lang="it">
<body style="font-family:Georgia,'Times New Roman',serif;background:#F8F5EE;margin:0;padding:0;color:#1A1714">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F8F5EE;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FDFBF6;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,23,20,0.08)">
      <tr><td style="background:${accentColor};height:4px;font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="background:${primaryColor};height:1px;font-size:0;line-height:0">&nbsp;</td></tr>

      <!-- HEADER -->
      <tr><td style="padding:36px 40px 20px 40px">
        <table role="presentation" width="100%"><tr>
          <td style="vertical-align:middle">
            <img src="${logoUrl}" alt="${escapeHtml(wpBiz ?? wpName)}" width="56" height="56" style="display:block;border-radius:8px;border:0" />
          </td>
          <td style="vertical-align:middle;padding-left:14px">
            <div style="font-family:Georgia,serif;font-size:18px;color:#1A1714;font-weight:700">${escapeHtml(wpBiz ?? wpName)}</div>
            ${owner?.city ? `<div style="font-family:Arial,sans-serif;font-size:11px;color:#A59C8E;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px">${escapeHtml(owner.city)}</div>` : ''}
          </td>
        </tr></table>
      </td></tr>

      <!-- DIVIDER -->
      <tr><td style="padding:0 40px 24px 40px;text-align:center">
        <table role="presentation" width="100%"><tr>
          <td style="border-bottom:1px solid #E4DED2;height:0;line-height:0">&nbsp;</td>
          <td style="width:24px;text-align:center;padding:0 8px">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${accentColor}"></span>
          </td>
          <td style="border-bottom:1px solid #E4DED2;height:0;line-height:0">&nbsp;</td>
        </tr></table>
      </td></tr>

      <!-- EYEBROW + TITLE -->
      <tr><td style="padding:0 40px;text-align:center">
        <div style="font-family:Arial,sans-serif;font-size:11px;color:${accentColor};letter-spacing:3px;text-transform:uppercase;font-weight:600">Iniziamo a conoscerci</div>
      </td></tr>
      <tr><td style="padding:12px 40px 0 40px;text-align:center">
        <h1 style="font-family:Georgia,serif;font-weight:700;font-size:32px;line-height:1.2;color:#1A1714;margin:0;letter-spacing:-0.02em">Raccontateci ${eventTitleHtml}</h1>
      </td></tr>

      <!-- BODY -->
      <tr><td style="padding:28px 40px 8px 40px">
        <p style="font-family:Georgia,serif;font-size:15px;color:#4a5568;line-height:1.7;margin:0">
          Ciao, sono <strong>${escapeHtml(wpName)}</strong>. Prima di mettere giù un preventivo personalizzato, mi piacerebbe capire bene chi siete, come vi immaginate il giorno-X e quali sono le cose a cui tenete di più.
        </p>
        <p style="font-family:Georgia,serif;font-size:15px;color:#4a5568;line-height:1.7;margin:14px 0 0">
          Ho preparato un breve questionario che richiede 5-10 minuti. Le vostre risposte mi serviranno per costruire un preventivo davvero su misura.
        </p>
        ${body.message ? `<div style="margin:20px 0 0;padding:14px 16px;background:#F8F5EE;border-left:3px solid ${accentColor};border-radius:6px;color:#1A1714;line-height:1.5;font-style:italic">"${escapeHtml(body.message)}"</div>` : ''}
      </td></tr>

      <!-- CHE COSA CHIEDIAMO -->
      <tr><td style="padding:20px 40px 8px 40px">
        <div style="background:#F8F5EE;border-radius:10px;padding:18px 20px">
          <div style="font-family:Arial,sans-serif;font-size:10px;color:${accentColor};letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-bottom:10px">Cosa vi chiediamo</div>
          <ul style="margin:0;padding-left:18px;font-family:Georgia,serif;font-size:14px;color:#1A1714;line-height:1.7">
            <li>Stile preferito (boho, classico, garden, ecc.)</li>
            <li>Budget di massima e priorità di spesa</li>
            <li>Numero ospiti stimato e stagione preferita</li>
            <li>Must-have e cose che NON volete</li>
            <li>La vostra visione del giorno-X</li>
          </ul>
        </div>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:30px 40px;text-align:center">
        <a href="${link}" style="display:inline-block;background:${primaryColor};color:#FDFBF6;padding:16px 36px;border-radius:50px;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:1.5px;text-transform:uppercase">Crea il tuo account · rispondi al questionario</a>
        <div style="margin-top:16px;font-family:Arial,sans-serif;font-size:11px;color:#A59C8E">5 minuti · solo per noi · niente spam</div>
      </td></tr>

      <!-- FIRMA WP -->
      <tr><td style="padding:0 40px 32px 40px;text-align:center">
        <table role="presentation" width="100%"><tr>
          <td style="border-bottom:1px solid #E4DED2">&nbsp;</td>
        </tr></table>
        <div style="margin-top:20px;font-family:Georgia,serif;font-style:italic;font-size:13px;color:#787164">
          ${owner?.bio ? escapeHtml(owner.bio).slice(0, 200) + (owner.bio.length > 200 ? '…' : '') : 'A prestissimo!'}
        </div>
        <div style="margin-top:14px;font-family:Georgia,serif;font-size:14px;color:#1A1714;font-weight:700">— ${escapeHtml(wpName)}</div>
        ${ownerEmail || owner?.phone ? `
        <div style="margin-top:10px;font-family:Arial,sans-serif;font-size:11px;color:#787164">
          ${ownerEmail ? `<a href="mailto:${escapeHtml(ownerEmail)}" style="color:#787164;text-decoration:none">${escapeHtml(ownerEmail)}</a>` : ''}
          ${ownerEmail && owner?.phone ? '  ·  ' : ''}
          ${owner?.phone ? escapeHtml(owner.phone) : ''}
        </div>` : ''}
      </td></tr>

      <tr><td style="background:${accentColor};height:3px;font-size:0;line-height:0">&nbsp;</td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin-top:20px">
      <tr><td style="text-align:center;font-family:Arial,sans-serif;font-size:10px;color:#A59C8E;letter-spacing:1.5px">
        <a href="https://planfully.it" style="color:#A59C8E;text-decoration:none">Powered by Planfully · Un progetto Fuyue Srl</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const r = await sendEmail(
    email,
    `${wpName} vuole conoscervi · raccontateci il vostro ${eventNoun}`,
    html,
    { from: fromHeader, reply_to: ownerEmail ?? undefined },
  )
  if (!r.ok) {
    if (r.reason === 'no_credentials') {
      return json({ ok: true, mode: 'no_resend', link, invite_token: inviteToken })
    }
    return json({ ok: true, mode: 'email_failed', link, email_error: (r.error ?? '').slice(0, 300) })
  }
  return json({ ok: true, mode: 'sent', email_id: r.message_id, link, invite_token: inviteToken })
})
