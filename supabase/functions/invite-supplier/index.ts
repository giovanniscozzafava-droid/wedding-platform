// deno-lint-ignore-file no-explicit-any
// Invita un fornitore via email.
// Caller deve essere autenticato (capostipite). JWT obbligatorio.
//
// Flow:
// 1) Verifica caller → capostipite_id = caller.uid
// 2) Se email esiste già in auth.users come FORNITORE → crea collaboration PENDING (no email)
// 3) Altrimenti → crea record supplier_invites + Supabase auth.admin.inviteUserByEmail
//    con user_metadata { role: FORNITORE, invite_token, subrole?, invited_by }
//    redirect a /onboarding (wizard fornitore).
//
// POST { email, subrole?, message? } -> { ok, mode: 'collab_direct' | 'email_sent', invite_id? }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <onboarding@resend.dev>'

async function sendInviteEmail(
  to: string,
  acceptUrl: string,
  inviterName: string,
  customMessage: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not set' }
  const html = `<!doctype html>
<html lang="it"><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f4ef;margin:0;padding:32px;color:#1A2E4F">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.06)">
  <div style="background:linear-gradient(135deg,#1A2E4F 0%,#C49A5C 100%);padding:32px;text-align:center;color:#fff">
    <h1 style="margin:0;font-size:28px;font-weight:600;letter-spacing:-0.02em">Planfully</h1>
    <p style="margin:8px 0 0;opacity:0.9;font-size:13px">Network indipendente per il wedding italiano</p>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;font-size:20px">Sei stato invitato come fornitore</h2>
    <p style="line-height:1.6;font-size:15px;color:#4a5568">
      <strong>${escapeHtml(inviterName)}</strong> ti ha invitato a far parte del suo network professionale su Planfully.
      Accetta l'invito per popolare il tuo catalogo servizi, gestire la tua disponibilità e ricevere preventivi.
    </p>
    ${customMessage ? `<div style="margin:20px 0;padding:16px;background:#f6f4ef;border-left:3px solid #C49A5C;border-radius:6px;font-style:italic;color:#4a5568">${escapeHtml(customMessage)}</div>` : ''}
    <div style="margin:28px 0;text-align:center">
      <a href="${acceptUrl}" style="display:inline-block;background:#C49A5C;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">Accetta l'invito</a>
    </div>
    <p style="font-size:12px;color:#a0aec0;text-align:center;margin:24px 0 0">
      Se il pulsante non funziona, copia questo link nel browser:<br>
      <a href="${acceptUrl}" style="color:#1A2E4F;word-break:break-all">${acceptUrl}</a>
    </p>
  </div>
  <div style="background:#f6f4ef;padding:20px;text-align:center;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0">
    Un progetto Fuyue Srl · planfully.it
  </div>
</div>
</body></html>`
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject: `${inviterName} ti ha invitato su Planfully`,
        html,
      }),
    })
    if (!r.ok) {
      const t = await r.text()
      return { ok: false, error: `Resend HTTP ${r.status}: ${t.slice(0, 300)}` }
    }
    const j = await r.json()
    return { ok: true, id: j.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing authorization' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // verifica caller
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: me } = await userClient.auth.getUser()
  if (!me?.user) return json({ error: 'unauthorized' }, 401)
  const callerId = me.user.id

  const body = (await req.json().catch(() => ({}))) as {
    email?: string; subrole?: string; message?: string; skip_email?: boolean
  }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return json({ error: 'invalid email' }, 400)
  const skipEmail = body.skip_email === true

  // 1. Cerca user esistente per email
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = existing?.users?.find((u: any) => u.email?.toLowerCase() === email)

  if (found) {
    const { data: prof } = await admin.from('profiles').select('id, role').eq('id', found.id).maybeSingle()
    if (!prof) return json({ error: 'profilo non trovato per utente' }, 404)
    if (prof.role !== 'FORNITORE') {
      return json({ error: `utente esiste ma il suo ruolo è ${prof.role}, non FORNITORE` }, 409)
    }
    const { error: e } = await admin.from('collaborations')
      .insert({ capostipite_id: callerId, fornitore_id: prof.id, status: 'PENDING' })
    if (e && !String(e.message).includes('duplicate')) return json({ error: e.message }, 500)
    return json({ ok: true, mode: 'collab_direct' })
  }

  // 2. Crea record supplier_invites
  const { data: invite, error: insErr } = await admin.from('supplier_invites').insert({
    email,
    capostipite_id: callerId,
    subrole_hint: body.subrole ?? null,
    message: body.message ?? null,
  }).select().single()
  if (insErr) {
    const msg = String(insErr.message ?? '').toLowerCase()
    const code = (insErr as { code?: string }).code
    if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
      return json({ error: 'Hai già un invito in sospeso per questa email' }, 409)
    }
    return json({ error: insErr.message }, 500)
  }

  const acceptUrl = `${APP_BASE}/invito-fornitore/${invite.token}`

  if (skipEmail) {
    // Solo link, no email send (WP copia + manda manualmente via WhatsApp/etc)
    return json({ ok: true, mode: 'link_only', invite_id: invite.id, accept_url: acceptUrl, token: invite.token })
  }

  // 3. Email via Resend (NON Supabase auth, perché SES è in sandbox)
  // Recupera nome del WP per personalizzare l'email
  const { data: inviterProf } = await admin.from('profiles')
    .select('business_name, full_name').eq('id', callerId).maybeSingle()
  const inviterName = inviterProf?.business_name ?? inviterProf?.full_name ?? 'Un wedding planner'

  const send = await sendInviteEmail(email, acceptUrl, inviterName, body.message ?? null)
  if (!send.ok) {
    return json({
      ok: true, mode: 'email_failed_link_fallback', invite_id: invite.id,
      accept_url: acceptUrl, token: invite.token,
      email_error: send.error,
    })
  }

  return json({
    ok: true, mode: 'email_sent', invite_id: invite.id,
    accept_url: acceptUrl, token: invite.token, email_id: send.id,
  })
})
