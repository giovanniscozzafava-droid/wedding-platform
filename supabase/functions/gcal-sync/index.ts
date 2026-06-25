// Sincronizza gli impegni Google del professionista nella cache google_calendar_busy.
// Modi:
//  - { slug }  → pubblico: sincronizza quel pro SE la cache è vecchia (guard 5 min). Usato dalla
//                pagina pubblica di prenotazione per avere gli slot aggiornati, senza esporre token.
//  - JWT pro   → sincronizza me (forzato).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { syncBusy } from '../_shared/gcal.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const STALE_MS = 5 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const body = await req.json().catch(() => ({})) as { slug?: string }

  let proId: string | null = null
  let guard = false

  if (body.slug) {
    const { data: prof } = await admin.from('profiles').select('id').eq('slug', body.slug).maybeSingle()
    proId = prof?.id ?? null
    guard = true
  } else {
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await sb.auth.getUser()
    proId = user?.id ?? null
  }
  if (!proId) return json({ ok: false, error: 'no_target' }, 200)

  const { data: conn } = await admin.from('google_calendar_connections').select('last_sync_at').eq('professional_id', proId).maybeSingle()
  if (!conn) return json({ ok: true, connected: false }) // non collegato: nessun blocco da Google
  if (guard && conn.last_sync_at && Date.now() - new Date(conn.last_sync_at).getTime() < STALE_MS) {
    return json({ ok: true, skipped: true }) // già fresco
  }

  const res = await syncBusy(admin, proId)
  return json(res)
})
