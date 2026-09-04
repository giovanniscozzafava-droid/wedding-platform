// Legge dal VERO account Fatture in Cloud del professionista i tipi di IVA e i
// metodi di pagamento già configurati (regime fiscale, esenzioni…): non si
// indovinano, si leggono. Servono per emettere la fattura con l'IVA giusta.
// Il path esatto di questi due endpoint non è documentato in modo affidabile:
// proviamo la rotta più comune di Fatture in Cloud (Company Info) e, se cambia,
// l'errore torna leggibile invece di un'IVA sbagliata su una fattura vera.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getFicAccessToken } from '../_shared/fic.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const tok = await getFicAccessToken(admin, user.id)
  if (!tok.ok) return json({ error: tok.error }, 400)

  const fic = (path: string) => fetch(`https://api-v2.fattureincloud.it/c/${tok.companyId}${path}`, { headers: { Authorization: `Bearer ${tok.accessToken}` } })

  const [vr, pr] = await Promise.all([fic('/info/vat_types'), fic('/info/payment_methods')])
  const [vd, pd] = await Promise.all([vr.json().catch(() => null), pr.json().catch(() => null)])

  return json({
    ok: vr.ok && pr.ok,
    vat_types: vr.ok ? (vd?.data ?? vd) : null,
    payment_methods: pr.ok ? (pd?.data ?? pd) : null,
    errors: { vat_types: vr.ok ? null : { status: vr.status, body: vd }, payment_methods: pr.ok ? null : { status: pr.status, body: pd } },
  })
})
