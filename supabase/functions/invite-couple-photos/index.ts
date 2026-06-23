// Invita gli SPOSI a vedere le foto del loro evento via email.
// Il proprietario della galleria/evento (es. il fotografo) invia un'email agli sposi con un link
// (/invito-coppia/:token): da lì si registrano (lato CLIENTE, non fornitore) o accedono, e vedono le foto.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: caller } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').slice(7))
  if (!caller?.user) return json({ error: 'auth' }, 401)

  let body: { entry_id?: string; email?: string; full_name?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const entry_id = body.entry_id
  const email = (body.email ?? '').trim().toLowerCase()
  if (!entry_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad_input' }, 400)

  // autorizzazione: proprietario dell'evento o della galleria, o admin
  const { data: ce } = await admin.from('calendar_entries').select('owner_id, title').eq('id', entry_id).maybeSingle()
  if (!ce) return json({ error: 'not_found' }, 404)
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', entry_id).maybeSingle()
  const { data: prof } = await admin.from('profiles').select('role, business_name, full_name').eq('id', caller.user.id).maybeSingle()
  const isOwner = ce.owner_id === caller.user.id || gal?.owner_id === caller.user.id || prof?.role === 'ADMIN'
  if (!isOwner) return json({ error: 'forbidden' }, 403)

  // crea/recupera il membro coppia → token invito
  let token: string | null = null
  const { data: existing } = await admin.from('wedding_couple_members').select('invite_token').eq('entry_id', entry_id).eq('email', email).maybeSingle()
  if (existing?.invite_token) token = existing.invite_token as string
  else {
    const { data: ins, error } = await admin.from('wedding_couple_members')
      .insert({ entry_id, email, full_name: body.full_name ?? null, role: 'PARTNER' })
      .select('invite_token').single()
    if (error) return json({ error: 'invite_failed', detail: error.message }, 500)
    token = ins.invite_token as string
  }

  const link = `${APP_BASE}/invito-coppia/${token}`
  const studio = esc((prof?.business_name || prof?.full_name || 'Il tuo professionista') as string)
  const title = esc((ce.title || 'il vostro evento') as string)
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
    <div style="background:#1a2e4f;color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">
      <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.8">${studio}</p>
      <h1 style="margin:6px 0 0;font-size:22px">Le foto di ${title} sono pronte</h1>
    </div>
    <div style="border:1px solid #e6e8ec;border-top:none;border-radius:0 0 14px 14px;padding:24px">
      <p>Le vostre foto sono online. Per vederle, entrate nella vostra area: vi basta <strong>registrarvi</strong> (è gratis) o <strong>accedere</strong> se avete già un account.</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${link}" style="display:inline-block;background:#c9a227;color:#1a2e4f;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px">Guarda le foto</a>
      </p>
      <p style="font-size:13px;color:#64748b">Oppure copia questo link nel browser:<br><span style="word-break:break-all">${link}</span></p>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px">Hai ricevuto questa email perché ${studio} ha condiviso con te le foto del tuo evento su Planfully.</p>
    </div>
  </div>`

  const r = await sendEmail({ to: email, subject: `Le foto di ${title} sono pronte`, html })
  if (!r.ok) return json({ error: 'email_failed', reason: (r as { reason?: string }).reason }, 502)
  return json({ ok: true })
})
