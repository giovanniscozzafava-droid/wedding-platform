// La controproposta finisce anche nella POSTA del cliente, non solo sullo schermo.
// Chi chiude la pagina dopo aver letto "sconto applicato" non avrebbe più nulla in
// mano: nessun numero, nessun link, e domani non si ricorda nemmeno di quanto era.
//
// Nessuna autenticazione: vale il token dell'ultimatum, esattamente come la pagina.
// Il server NON si fida di quello che gli dice il browser: rilegge se lo sconto è
// stato davvero applicato e a chi va mandato.
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
const eur = (n: number) => `€ ${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: { token?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const token = (body.token ?? '').trim()
  if (!token) return json({ error: 'bad_input' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: u } = await admin.from('quote_ultimatums')
    .select('id, quote_id, owner_id, discount_percent, discount_applied, discount_email_at')
    .eq('token', token).maybeSingle()
  if (!u) return json({ error: 'not_found' }, 404)
  // Si manda SOLO se lo sconto è davvero partito, e una volta sola.
  if (!u.discount_applied) return json({ error: 'no_discount' }, 409)
  if (u.discount_email_at) return json({ ok: true, gia_inviata: true })

  const { data: q } = await admin.from('quotes')
    .select('id, title, client_name, client_email, event_date, access_token, total_client, total_client_selected, total_discount_percent')
    .eq('id', u.quote_id).maybeSingle()
  if (!q) return json({ error: 'not_found' }, 404)
  const to = (q.client_email ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: 'no_email' }, 400)

  const { data: prof } = await admin.from('profiles')
    .select('business_name, full_name').eq('id', u.owner_id).maybeSingle()
  const studio = String(prof?.business_name || prof?.full_name || 'Il tuo professionista')
  // Regola R1: il cliente vede il totale di ciò che ha scelto, non l'offerta piena.
  const tot = Number(q.total_client_selected ?? 0) > 0 ? Number(q.total_client_selected) : Number(q.total_client ?? 0)
  const link = q.access_token ? `${APP_BASE}/p/preview/${q.access_token}` : null
  const chi = String(q.client_name || '').trim()

  const html = emailShell({
    eyebrow: 'Nuova cifra',
    title: 'Abbiamo rivisto il preventivo',
    bodyHtml: `
      <p style="margin:0">${chi ? esc(chi) + ', c' : 'C'}i avete detto che a fermarvi era il prezzo. Ci abbiamo pensato su.</p>
      <p style="margin:16px 0 0">Abbiamo previsto per voi <strong>un ulteriore sconto del ${esc(String(Number(u.discount_percent)))}% sul totale</strong>,
         già applicato al preventivo per <strong>${esc(String(q.title || 'il vostro evento'))}</strong>.</p>
      <p style="margin:18px 0 0;font-size:22px"><strong>Nuovo totale: ${esc(eur(tot))}</strong></p>
      <p style="margin:14px 0 0">Ricontrollatelo con calma. Se ora la cifra funziona, ne riparliamo volentieri; se non funziona lo stesso, nessun problema e grazie di averci dato una possibilità.</p>
      ${link ? `<p style="font-size:13px;color:#787164;margin:18px 0 0">Oppure copia questo link nel browser:<br><span style="word-break:break-all">${esc(link)}</span></p>` : ''}`,
    cta: link ? { href: link, label: 'Vedi il preventivo aggiornato' } : undefined,
    contactHtml: `Hai ricevuto questa email perché ${esc(studio)} ti ha inviato un preventivo su Planfully.`,
  })

  const r = await sendEmail({ to, subject: 'Abbiamo rivisto il preventivo per voi', html })
  if (!r.ok) return json({ error: 'email_failed', reason: (r as { reason?: string }).reason }, 502)
  // supabase-js non lancia sugli errori Postgres: se il timbro non si scrive la mail
  // ripartirebbe a ogni riapertura della pagina.
  const { error: se } = await admin.from('quote_ultimatums')
    .update({ discount_email_at: new Date().toISOString() }).eq('id', u.id)
  if (se) console.error('stamp_failed', u.id, se.message)
  return json({ ok: true, to, totale: tot })
})
