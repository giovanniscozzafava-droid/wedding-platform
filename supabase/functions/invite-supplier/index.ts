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

  // 3. Manda email Supabase nativa con metadata + redirect a /invito-fornitore
  const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      role: 'FORNITORE',
      subrole: body.subrole ?? null,
      invite_token: invite.token,
      invited_by: callerId,
    },
    redirectTo: acceptUrl,
  })
  if (invErr) {
    // Email fallita ma record c'e': ritorna link comunque
    return json({
      ok: true, mode: 'email_failed_link_fallback', invite_id: invite.id,
      accept_url: acceptUrl, token: invite.token,
      email_error: invErr.message,
    })
  }

  return json({ ok: true, mode: 'email_sent', invite_id: invite.id, accept_url: acceptUrl, token: invite.token })
})
