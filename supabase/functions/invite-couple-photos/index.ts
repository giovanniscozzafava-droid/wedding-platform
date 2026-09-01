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

  let body: { entry_id?: string; email?: string; full_name?: string; show?: boolean }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const entry_id = body.entry_id
  if (!entry_id) return json({ error: 'bad_input' }, 400)
  // show = porta gli sposi dritti alla PRESENTAZIONE (non alla griglia).
  const show = body.show !== false
  const one = (body.email ?? '').trim().toLowerCase()
  if (one && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(one)) return json({ error: 'bad_input' }, 400)

  // autorizzazione: proprietario dell'evento o della galleria, o admin
  const { data: ce } = await admin.from('calendar_entries').select('owner_id, title').eq('id', entry_id).maybeSingle()
  if (!ce) return json({ error: 'not_found' }, 404)
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', entry_id).maybeSingle()
  const { data: prof } = await admin.from('profiles').select('role, business_name, full_name').eq('id', caller.user.id).maybeSingle()
  const isOwner = ce.owner_id === caller.user.id || gal?.owner_id === caller.user.id || prof?.role === 'ADMIN'
  if (!isOwner) return json({ error: 'forbidden' }, 403)

  // Destinatari: se il chiamante non ne passa uno, sono gli sposi GIÀ registrati
  // sull'evento — le loro email le abbiamo, non c'è motivo di farle ribattere.
  const { data: membri } = await admin.from('wedding_couple_members')
    .select('email, invite_token').eq('entry_id', entry_id)
  let destinatari: Array<{ email: string; token: string }> = []
  if (one) {
    const ex = (membri ?? []).find((m: { email?: string | null }) => (m.email ?? '').toLowerCase() === one)
    if (ex?.invite_token) destinatari = [{ email: one, token: ex.invite_token as string }]
    else {
      const { data: ins, error } = await admin.from('wedding_couple_members')
        .insert({ entry_id, email: one, full_name: body.full_name ?? null, role: 'PARTNER' })
        .select('invite_token').single()
      if (error) return json({ error: 'invite_failed', detail: error.message }, 500)
      destinatari = [{ email: one, token: ins.invite_token as string }]
    }
  } else {
    destinatari = (membri ?? [])
      .filter((m: { email?: string | null; invite_token?: string | null }) => !!m.email && !!m.invite_token)
      .map((m: { email: string; invite_token: string }) => ({ email: m.email, token: m.invite_token }))
    if (destinatari.length === 0) return json({ error: 'no_recipients', detail: 'Nessuno sposo registrato su questo evento: indica un indirizzo.' }, 400)
  }

  // Link ospiti: è lo STESSO QR con cui gli invitati hanno caricato le foto durante
  // l'evento. Lo rimettiamo nella mail così gli sposi possono girarlo su WhatsApp e
  // guardare le foto insieme agli invitati. Gli invitati NON toccano la selezione
  // dell'album: solo il like di uno sposo diventa una scelta (trg_like_feeds_selection).
  const { data: galFull } = await admin.from('event_galleries')
    .select('id, guest_token').eq('entry_id', entry_id).maybeSingle()
  const guestLink = galFull?.guest_token
    ? `${APP_BASE}/galleria/${galFull.id}?t=${galFull.guest_token}`
    : null

  const rawStudio = String(prof?.business_name || prof?.full_name || 'Il tuo professionista')
  const rawTitle = String(ce.title || 'il vostro evento')
  const soggetto = `Le foto di ${rawTitle} sono pronte`

  const bloccoOspiti = guestLink
    ? `<div style="margin:22px 0 0;padding:16px;background:#FAF7F0;border-radius:10px">
         <p style="margin:0 0 8px;font-weight:600">Guardatele insieme ai vostri invitati</p>
         <p style="margin:0;font-size:14px">È lo stesso link (e lo stesso QR) con cui hanno caricato le loro foto durante ${esc(rawTitle)}. Giratelo pure a tutti: potranno rivedere le foto con voi. Le vostre preferenze restano vostre — quello che scelgono gli invitati non entra nella selezione dell'album.</p>
         <p style="margin:12px 0 0">
           <a href="https://wa.me/?text=${encodeURIComponent('Le foto di ' + rawTitle + ' sono online, guardale qui: ' + guestLink)}"
              style="display:inline-block;padding:9px 16px;border-radius:8px;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Invia su WhatsApp</a>
         </p>
         <p style="margin:10px 0 0;font-size:12px;color:#787164;word-break:break-all">${esc(guestLink)}</p>
       </div>`
    : ''

  let inviate = 0
  const falliti: string[] = []
  for (const d of destinatari) {
    // ?to=foto → atterraggio sulla tab Foto (regola fissa); show=1 apre la presentazione.
    const link = `${APP_BASE}/invito-coppia/${d.token}?to=foto${show ? '&show=1' : ''}`
    const html = emailShell({
      eyebrow: 'Foto pronte',
      title: soggetto,
      bodyHtml: `<p style="margin:0">Le vostre foto sono online. Il pulsante qui sotto apre la <strong>presentazione</strong>: scorretele con calma e mettete un cuore a quelle che vi piacciono — <strong>i vostri cuori diventano la selezione per l'album</strong>, non dovete rifare il lavoro due volte.</p>${bloccoOspiti}<p style="font-size:13px;color:#787164;margin:16px 0 0">Oppure copia questo link nel browser:<br><span style="word-break:break-all">${esc(link)}</span></p>`,
      cta: { href: link, label: 'Guarda la presentazione' },
      contactHtml: `Hai ricevuto questa email perché ${esc(rawStudio)} ha condiviso con te le foto del tuo evento su Planfully.`,
    })
    const r = await sendEmail({ to: d.email, subject: soggetto, html })
    if (r.ok) inviate++
    else falliti.push(d.email)
  }
  if (inviate === 0) return json({ error: 'email_failed', falliti }, 502)
  return json({ ok: true, inviate, falliti, guest_link: guestLink })
})
