// Registrazione ospite SEMPLICE per la galleria foto dell'evento ("degna di zia Pina"):
// nome + email → account creato al volo e login immediato (senza aprire mail), gated
// dal token del link ospiti. L'ospite accede SOLO alle foto INVITATI dell'evento.
//
// POST { email, name, gallery_id, token } -> { ok, token_hash }  (no JWT richiesto)
// Il browser poi fa supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; gallery_id?: string; token?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const name = (body.name ?? '').trim()
  if (!email.includes('@') || name.length < 2 || !body.gallery_id || !body.token) {
    return json({ error: 'invalid_input' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  // Gate: la galleria esiste e il token del link ospiti combacia.
  const { data: gal } = await admin.from('event_galleries').select('entry_id, guest_token').eq('id', body.gallery_id).maybeSingle()
  if (!gal || !gal.guest_token || gal.guest_token !== body.token) return json({ error: 'bad_token' }, 403)

  // Crea (se serve) l'utente e genera un magic-link → ne estraiamo il token_hash per
  // il login immediato lato browser (nessuna email da aprire).
  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error || !link.data?.user) {
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } })
    if (created.error) return json({ error: created.error.message }, 500)
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  }
  if (link.error || !link.data?.user || !link.data.properties?.hashed_token) {
    return json({ error: link.error?.message ?? 'link_failed' }, 500)
  }
  const userId = link.data.user.id

  // Registra l'ospite sull'evento (idempotente) così entra subito vedendo le foto.
  await admin.from('gallery_guests').upsert(
    { entry_id: gal.entry_id, guest_user_id: userId, full_name_searched: name },
    { onConflict: 'entry_id,guest_user_id' },
  )

  return json({ ok: true, token_hash: link.data.properties.hashed_token })
})
