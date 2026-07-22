// deno-lint-ignore-file no-explicit-any
// Invia alla coppia il link al questionario iniziale (registrazione + form preferenze).
// Crea wedding_couple_members con invite_token, manda email branded WP con CTA registrazione.
// Dopo il signup la coppia atterra in CoupleDashboard tab Questionario.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

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
  // Accento white-label: colore del pro (premium) oppure cipresso (default brand).
  const primaryColor = isPremium && owner?.brand_primary_color ? owner.brand_primary_color : '#25402F'
  const safeName = (s: string) => s.replace(/[",;<>\r\n]/g, ' ').trim().slice(0, 80) || 'Planfully'
  const fromAddr = (RESEND_FROM.match(/<(.+)>/)?.[1]) ?? RESEND_FROM
  const fromHeader = `${safeName(wpBiz ?? wpName)} via Planfully <${fromAddr}>`

  const titleText = _ek === 'matrimonio' ? 'Raccontateci il vostro matrimonio ideale' : `Raccontateci il vostro ${eventNoun} ideale`
  const html = emailShell({
    accent: primaryColor,
    eyebrow: 'Iniziamo a conoscerci',
    title: titleText,
    bodyHtml: `
      <p style="margin:0 0 14px">Ciao, sono <strong>${escapeHtml(wpName)}</strong>. Prima di mettere giù un preventivo personalizzato, mi piacerebbe capire bene chi siete, come vi immaginate il giorno-X e quali sono le cose a cui tenete di più.</p>
      <p style="margin:0 0 14px">Ho preparato un breve questionario che richiede 5-10 minuti. Le vostre risposte mi serviranno per costruire un preventivo davvero su misura.</p>
      ${body.message ? `<div style="margin:0 0 16px;padding:14px 16px;background:#F4F3EE;border-left:3px solid ${escapeHtml(primaryColor)};font-style:italic">“${escapeHtml(body.message)}”</div>` : ''}
      <div style="margin:16px 0 0;padding:16px 18px;background:#F4F3EE;border:1px solid #E2DFD4">
        <div style="font-family:'IBM Plex Mono',Consolas,monospace;font-size:10px;color:#25402F;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Cosa vi chiediamo</div>
        <ul style="margin:0;padding-left:18px;line-height:1.8">
          <li>Stile preferito (boho, classico, garden, ecc.)</li>
          <li>Budget di massima e priorità di spesa</li>
          <li>Numero ospiti stimato e stagione preferita</li>
          <li>Must-have e cose che NON volete</li>
          <li>La vostra visione del giorno-X</li>
        </ul>
      </div>`,
    cta: { href: link, label: 'Crea il tuo account e rispondi al questionario' },
    contactHtml: `<span style="font-style:italic">${owner?.bio ? escapeHtml(owner.bio).slice(0, 200) + (owner.bio.length > 200 ? '…' : '') : 'A prestissimo!'}</span><br><br><strong>— ${escapeHtml(wpName)}</strong>${ownerEmail || owner?.phone ? `<br>${ownerEmail ? escapeHtml(ownerEmail) : ''}${ownerEmail && owner?.phone ? ' · ' : ''}${owner?.phone ? escapeHtml(owner.phone) : ''}` : ''}`,
  })

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
