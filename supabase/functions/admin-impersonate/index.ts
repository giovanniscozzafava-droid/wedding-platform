// deno-lint-ignore-file no-explicit-any
// "Accedi come utente" per il supporto: genera un token magic-link per il target
// così lo staff può vedere l'app come lui. Gating forte + audit log.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// SEC-05: endpoint admin (impersonazione) → CORS ristretto al dominio dell'app, non '*'.
const cors = {
  'Access-Control-Allow-Origin': 'https://planfully.it',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { user_id?: string }
  if (!body.user_id) return json({ error: 'user_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Chi chiama deve essere staff/admin.
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: ud } = await admin.auth.getUser(authHeader.slice(7))
  const caller = ud?.user
  if (!caller) return json({ error: 'unauthorized' }, 401)
  const { data: cp } = await admin.from('profiles').select('role, is_support_staff').eq('id', caller.id).maybeSingle()
  if (!(cp?.is_support_staff || cp?.role === 'ADMIN')) return json({ error: 'forbidden' }, 403)

  // Protezioni.
  if (body.user_id === caller.id) return json({ error: 'Sei già te stesso' }, 400)
  const { data: target } = await admin.from('profiles').select('role, is_support_staff, full_name, business_name').eq('id', body.user_id).maybeSingle()
  if (!target) return json({ error: 'Utente non trovato' }, 404)
  if (target.is_support_staff || target.role === 'ADMIN') return json({ error: 'Non puoi impersonare un membro staff/admin' }, 400)

  const { data: tu } = await admin.auth.admin.getUserById(body.user_id)
  const email = tu?.user?.email
  if (!email) return json({ error: 'Utente senza email' }, 400)

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link?.properties?.hashed_token) return json({ error: 'generateLink failed', detail: linkErr?.message }, 500)

  // Audit.
  const label = target.business_name ?? target.full_name ?? email
  await admin.from('admin_audit').insert({
    actor_id: caller.id, actor_email: caller.email, action: 'IMPERSONATE',
    target_id: body.user_id, target_label: label,
  })

  return json({ ok: true, token_hash: link.properties.hashed_token, label })
})
