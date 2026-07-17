// Invita gli SPOSI a vedere le foto del loro evento via email.
// Il proprietario della galleria/evento (es. il fotografo) invia un'email agli sposi con un link
// (/invito-coppia/:token): da lì si registrano (lato CLIENTE, non fornitore) o accedono, e vedono le foto.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

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

  // ?to=foto → dopo registrazione/login il cliente atterra sulla tab Foto (regola fissa)
  const link = `${APP_BASE}/invito-coppia/${token}?to=foto`
  const rawStudio = String(prof?.business_name || prof?.full_name || 'Il tuo professionista')
  const rawTitle = String(ce.title || 'il vostro evento')
  const html = emailShell({
    eyebrow: 'Foto pronte',
    title: `Le foto di ${rawTitle} sono pronte`,
    bodyHtml: `<p style="margin:0">Le vostre foto sono online. Per vederle, entrate nella vostra area: vi basta <strong>registrarvi</strong> (è gratis) o <strong>accedere</strong> se avete già un account.</p><p style="font-size:13px;color:#787164;margin:16px 0 0">Oppure copia questo link nel browser:<br><span style="word-break:break-all">${esc(link)}</span></p>`,
    cta: { href: link, label: 'Guarda le foto' },
    contactHtml: `Hai ricevuto questa email perché ${esc(rawStudio)} ha condiviso con te le foto del tuo evento su Planfully.`,
  })

  const r = await sendEmail({ to: email, subject: `Le foto di ${rawTitle} sono pronte`, html })
  if (!r.ok) return json({ error: 'email_failed', reason: (r as { reason?: string }).reason }, 502)
  return json({ ok: true })
})
