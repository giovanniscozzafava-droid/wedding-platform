// Cambia l'email (e opzionalmente la password) del PROPRIO account, direttamente via
// service-role con email_confirm=true — senza il flusso di conferma via email di Supabase
// (che falliva con "Error sending email change email" quando l'SMTP non è configurato).
// Ogni utente può cambiare SOLO il proprio account (verificato dal JWT).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password
  if (!email && !password) return json({ error: 'email_or_password_required' }, 400)
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid_email' }, 400)
  if (password && password.length < 8) return json({ error: 'weak_password' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: ud } = await admin.auth.getUser(authHeader.slice(7))
  const caller = ud?.user
  if (!caller) return json({ error: 'unauthorized' }, 401)

  // Se cambia email, controlla che non sia già usata da un ALTRO utente.
  if (email && email !== (caller.email ?? '').toLowerCase()) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const taken = (list?.users ?? []).some((u) => (u.email ?? '').toLowerCase() === email && u.id !== caller.id)
    if (taken) return json({ error: 'email_already_in_use' }, 409)
  }

  const patch: Record<string, unknown> = { email_confirm: true }
  if (email) patch.email = email
  if (password) patch.password = password
  const { error } = await admin.auth.admin.updateUserById(caller.id, patch)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, email: email || caller.email })
})
