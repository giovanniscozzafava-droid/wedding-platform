// Edge function: suggest-alternatives
// Il professionista richiesto è OCCUPATO per quella data → manda al cliente
// un'email che ringrazia e suggerisce 2 colleghi dello stesso settore, iscritti
// e disponibili, con i loro contatti. Da lì il cliente riparte.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail, htmlToText } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s: unknown) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!))

type Alt = { id: string; name: string | null; slug: string | null; subrole: string | null; city: string | null; phone: string | null; role: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { slug?: string; date?: string; client_name?: string; client_email?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const { slug, date, client_email } = body
  const clientName = (body.client_name ?? '').trim()
  if (!slug || !date || !client_email) return json({ error: 'missing_params' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data, error } = await admin.rpc('suggest_alternatives_full', { p_slug: slug, p_date: date })
  if (error) return json({ error: error.message }, 500)
  const r = data as { found?: boolean; busy_name?: string; message?: string | null; alternatives?: Alt[] }
  const alts = r?.alternatives ?? []
  if (!r?.found || alts.length === 0) return json({ ok: true, sent: false, reason: 'no_alternatives' })

  const dateIt = new Date(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  const cards = alts.map((a) => {
    const sector = [a.subrole, a.city].filter(Boolean).join(' · ')
    const url = `${APP_BASE}/p/${a.role === 'WEDDING_PLANNER' ? 'wp' : 'fornitore'}/${a.slug}`
    return `<div style="background:#FDFBF6;border:1px solid #E4DED2;border-radius:12px;padding:16px;margin:10px 0">
      <p style="margin:0 0 4px;font-weight:600;font-size:16px">${esc(a.name)}</p>
      ${sector ? `<p style="margin:0 0 8px;font-size:13px;color:#6E6E6E">${esc(sector)}</p>` : ''}
      ${a.phone ? `<p style="margin:0 0 8px;font-size:14px">📞 <a href="tel:${esc(a.phone)}" style="color:#C49A5C">${esc(a.phone)}</a></p>` : ''}
      <a href="${url}" style="display:inline-block;background:#C49A5C;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;font-size:13px">Vedi profilo e richiedi</a>
    </div>`
  }).join('')

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#FDFBF6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1A1714">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="text-align:center;margin-bottom:24px"><h1 style="font-family:Georgia,serif;font-size:26px;margin:0;color:#C49A5C">Planfully</h1></div>
    <div style="background:#fff;border:1px solid #E4DED2;border-radius:16px;padding:32px">
      <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;line-height:1.3">Grazie${clientName ? `, ${esc(clientName.split(' ')[0])}` : ''}!</h2>
      <p style="font-size:15px;line-height:1.6;color:#3a3a3a;margin:0 0 16px">
        Purtroppo <strong>${esc(r.busy_name)}</strong> non è disponibile per il <strong>${esc(dateIt)}</strong>.
        Ma non ti lasciamo a mani vuote: ti consigliamo due colleghi dello stesso settore, liberi in quella data.
      </p>
      ${r.message ? `<div style="border-left:3px solid #C49A5C;padding:10px 14px;margin:0 0 16px;background:#FDFBF6;font-style:italic;color:#3a3a3a;font-size:14px">"${esc(r.message)}"<br><span style="font-style:normal;color:#6E6E6E;font-size:12px">— ${esc(r.busy_name)}</span></div>` : ''}
      ${cards}
      <p style="font-size:12px;color:#6E6E6E;margin-top:20px">Contattali pure: troverai il loro profilo con portfolio e il modulo per richiedere un preventivo.</p>
    </div>
    <p style="font-size:11px;color:#6E6E6E;text-align:center;margin-top:20px">© Planfully · Fuyue Srl</p>
  </div></body></html>`

  const res = await sendEmail({ to: client_email, subject: `Due alternative per il ${dateIt} · Planfully`, html, text: htmlToText(html) })
  return json({ ok: true, sent: (res as { ok: boolean }).ok, count: alts.length })
})
