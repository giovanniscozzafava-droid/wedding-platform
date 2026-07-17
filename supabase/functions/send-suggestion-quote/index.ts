// Edge: send-suggestion-quote
// Il FORNITORE suggerito invia il suo preventivo "cieco" al cliente suggerito. Il fornitore NON
// conosce l'email del cliente: la risolviamo lato server dai contatti privati del suggerimento e
// mandiamo noi l'email col link al preventivo (per-token, il cliente può aprirlo e accettarlo).
// Nessun dato cliente finisce in tabelle di proprietà del fornitore (nessun leak).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: { quote_id?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (!body.quote_id) return json({ error: 'quote_id_required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: au } = await admin.auth.getUser(authHeader.slice(7))
  const caller = au?.user
  if (!caller) return json({ error: 'unauthorized' }, 401)

  const { data: q } = await admin.from('quotes')
    .select('id, owner_id, title, revision, access_token, event_date, event_kind, quote_origin, sent_email_log')
    .eq('id', body.quote_id).maybeSingle()
  if (!q) return json({ error: 'quote_not_found' }, 404)
  if (q.owner_id !== caller.id) return json({ error: 'forbidden' }, 403)
  if (q.quote_origin !== 'SUPPLIER_SUGGESTION') return json({ error: 'not_a_suggestion_quote' }, 400)

  // Suggerimento collegato + contatti privati del cliente (service role: nessuna RLS).
  const { data: sugg } = await admin.from('supplier_suggestions').select('id, referrer_id').eq('quote_id', q.id).maybeSingle()
  if (!sugg) return json({ error: 'suggestion_not_found' }, 404)
  const { data: priv } = await admin.from('supplier_suggestions_private').select('client_name, client_email').eq('suggestion_id', sugg.id).maybeSingle()
  const clientEmail = priv?.client_email
  if (!clientEmail) return json({ error: 'client_email_missing' }, 400)

  // token + stato inviato
  const token = (q.access_token as string | null) ?? crypto.randomUUID()
  await admin.from('quotes').update({
    access_token: token, status: 'INVIATO', sent_at: new Date().toISOString(),
    sent_email_log: [...((q.sent_email_log ?? []) as unknown[]), { at: new Date().toISOString(), via: 'suggestion' }],
  }).eq('id', q.id)
  await admin.from('supplier_suggestions').update({ status: 'QUOTE_SENT', updated_at: new Date().toISOString() }).eq('id', sugg.id)

  // nome del fornitore (mittente logico)
  const { data: sup } = await admin.from('profiles').select('full_name, business_name, subrole').eq('id', q.owner_id).maybeSingle()
  const supName = sup?.business_name ?? sup?.full_name ?? 'Un fornitore'
  // Atterra sulla dashboard aggregata del cliente (tutte le offerte insieme), previo accesso.
  const link = `${APP_BASE}/area-cliente/accedi?next=${encodeURIComponent('/area-cliente')}`

  const html = emailShell({
    eyebrow: 'Preventivo dedicato',
    title: `${supName} ti ha preparato un preventivo`,
    subtitleHtml: `Per il tuo <strong>${esc(q.event_kind ?? 'evento')}</strong>${q.event_date ? ` del <strong>${esc(new Date(q.event_date).toLocaleDateString('it-IT'))}</strong>` : ''}`,
    bodyHtml: `<p style="margin:0">Aprilo per vederlo nel dettaglio e, se ti convince, accettarlo.</p>`,
    cta: { href: link, label: 'Apri il preventivo' },
    contactHtml: `Hai ricevuto questo preventivo perché ti è stato suggerito ${esc(supName)}.`,
  })

  let sent = false
  try { await sendEmailSES({ to: String(clientEmail), subject: `${supName} ti ha preparato un preventivo`, html }); sent = true } catch { /* */ }

  return json({ ok: true, sent })
})
