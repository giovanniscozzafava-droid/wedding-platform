// ULTIMATUM sul preventivo: chiede al cliente se è ancora interessato, con i pulsanti
// DENTRO la mail. Se risponde "no, troppo caro", parte da sola la controproposta
// scontata che il professionista ha deciso a monte (profiles.ultimatum_discount_percent).
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

  let body: { quote_id?: string; discount_percent?: number }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const quote_id = body.quote_id
  if (!quote_id) return json({ error: 'bad_input' }, 400)

  const { data: q } = await admin.from('quotes')
    .select('id, owner_id, client_name, client_email, title, event_date, status, total_client, total_client_selected')
    .eq('id', quote_id).maybeSingle()
  if (!q) return json({ error: 'not_found' }, 404)
  if (q.owner_id !== caller.user.id) return json({ error: 'forbidden' }, 403)
  // Ha senso solo su un preventivo che è stato mandato e sta fermo.
  if (q.status !== 'INVIATO') return json({ error: 'bad_status', detail: `Il preventivo è in stato ${q.status}: l'ultimatum si manda solo su un preventivo inviato.` }, 409)
  const to = (q.client_email ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: 'no_email', detail: 'Il preventivo non ha un indirizzo email valido.' }, 400)

  const { data: prof } = await admin.from('profiles')
    .select('business_name, full_name, ultimatum_discount_percent').eq('id', caller.user.id).maybeSingle()
  // Lo sconto arriva dall'impostazione del pro; il pulsante può ritoccarlo per questo
  // caso. Congelato nella riga: se domani cambia l'impostazione, questo ultimatum
  // resta quello che il cliente ha visto promesso.
  const pct = Math.max(0, Math.min(90, Number(
    body.discount_percent ?? prof?.ultimatum_discount_percent ?? 0)))

  const { data: u, error: uErr } = await admin.from('quote_ultimatums')
    .insert({ quote_id, owner_id: caller.user.id, discount_percent: pct })
    .select('token').single()
  // supabase-js NON lancia sugli errori Postgres: senza questo check partirebbe una
  // mail con un link che non esiste.
  if (uErr || !u?.token) return json({ error: 'db', detail: uErr?.message }, 500)

  const base = `${APP_BASE}/p/ultimatum/${u.token}`
  const studio = String(prof?.business_name || prof?.full_name || 'Il tuo professionista')
  const chi = String(q.client_name || '').trim()
  const data = q.event_date ? new Date(q.event_date as string).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  const html = emailShell({
    eyebrow: 'Una domanda sola',
    title: data ? `Teniamo ancora il ${esc(data)}?` : 'Vi teniamo ancora il posto?',
    bodyHtml: `
      <p style="margin:0">Vi avevamo mandato il preventivo per <strong>${esc(String(q.title || 'il vostro evento'))}</strong>${data ? ` del ${esc(data)}` : ''} e non abbiamo più avuto vostre notizie.</p>
      <p style="margin:14px 0 0"><strong>Se non siete più interessati${data ? ' a quella data' : ''}, ditecelo: basta un clic qui sotto.</strong> Nessun problema e nessuna insistenza — ci serve solo sapere se liberarla.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0"><tr>
        <td style="padding-right:10px">
          <a href="${base}?r=si" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1F7A4D;color:#fff;text-decoration:none;font-weight:600">Sì, siamo interessati</a>
        </td>
        <td>
          <a href="${base}?r=no" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#fff;border:1px solid #D8D2C6;color:#4A443B;text-decoration:none;font-weight:600">No, abbiamo cambiato idea</a>
        </td>
      </tr></table>
      <p style="font-size:13px;color:#787164;margin:18px 0 0">Se rispondete di no vi chiediamo solo il motivo, in un clic: ci aiuta a fare meglio la prossima volta.</p>
      <p style="font-size:13px;color:#787164;margin:12px 0 0">Oppure copia questo link nel browser:<br><span style="word-break:break-all">${esc(base)}</span></p>`,
    contactHtml: `Hai ricevuto questa email perché ${esc(studio)} ti ha inviato un preventivo su Planfully.`,
  })

  const r = await sendEmail({ to, subject: chi ? `${chi}, ci fate sapere?` : 'Ci fate sapere?', html })
  if (!r.ok) {
    await admin.from('quote_ultimatums').delete().eq('token', u.token)   // niente riga orfana
    return json({ error: 'email_failed', reason: (r as { reason?: string }).reason }, 502)
  }
  return json({ ok: true, discount_percent: pct, to })
})
