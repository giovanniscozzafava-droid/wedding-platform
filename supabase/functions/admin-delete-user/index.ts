// deno-lint-ignore-file no-explicit-any
// Cancellazione DEFINITIVA di un utente (cliente / fornitore / capostipite).
// Solo staff/admin. Elimina il profilo (cascata su tutti i dati posseduti) e
// l'account auth. Irreversibile. Protezioni: no auto-cancellazione, no staff.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// SEC-05: endpoint admin (cancellazione utente) → CORS ristretto al dominio dell'app.
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
  if (body.user_id === caller.id) return json({ error: 'Non puoi cancellare te stesso' }, 400)
  const { data: target } = await admin.from('profiles').select('role, full_name, business_name, is_support_staff').eq('id', body.user_id).maybeSingle()
  if (!target) return json({ error: 'Utente non trovato' }, 404)
  if (target.is_support_staff || target.role === 'ADMIN') {
    return json({ error: 'È un membro staff/admin: rimuovi prima il ruolo staff.' }, 400)
  }

  // 1) Profilo → cascata su tutti i dati posseduti (CASCADE) e SET NULL sui condivisi.
  const { error: delProf } = await admin.from('profiles').delete().eq('id', body.user_id)
  if (delProf) return json({ error: 'delete profile failed', detail: delProf.message }, 500)
  // 2) Account auth (login).
  const { error: delAuth } = await admin.auth.admin.deleteUser(body.user_id)
  if (delAuth) return json({ error: 'profilo eliminato, ma rimozione login fallita', detail: delAuth.message }, 500)

  return json({ ok: true, deleted: target.business_name ?? target.full_name ?? body.user_id })
})
