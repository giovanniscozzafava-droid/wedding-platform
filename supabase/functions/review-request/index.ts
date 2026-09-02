// Edge: review-request
// Il professionista, a evento passato, chiede al cliente una recensione su Google e/o
// Matrimonio.com. L'email porta i link del SUO profilo (caricati nelle Impostazioni).
//
// Chi può chiederla lo decide il DB (review_request_context: proprietario dell'evento,
// chi ha la galleria, chi è nel cerchio). Qui si manda la mail e si timbra la richiesta.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell, esc } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

const TERM: Record<string, string> = {
  matrimonio: 'il vostro matrimonio', battesimo: 'il battesimo', comunione: 'la comunione', cresima: 'la cresima',
  compleanno: 'la festa', anniversario: 'il vostro anniversario', corporate: 'il vostro evento', laurea: 'la laurea',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'auth' }, 401)

  let body: { entry_id?: string; note?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const entryId = (body.entry_id ?? '').trim()
  if (!entryId) return json({ error: 'bad_input' }, 400)
  const note = String(body.note ?? '').trim().slice(0, 600)

  // Con il token dell'utente: la RPC applica da sola chi può e chi no.
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: me } = await asUser.auth.getUser()
  if (!me?.user) return json({ error: 'auth' }, 401)
  const { data: ctx, error: ce } = await asUser.rpc('review_request_context', { p_entry: entryId })
  if (ce || !ctx?.ok) return json({ error: ctx?.error ?? 'context_failed' }, ctx?.error === 'forbidden' ? 403 : 400)
  if (!ctx.past) return json({ error: 'not_past' }, 409)
  const google = String(ctx.google ?? '').trim()
  const matrimonio = String(ctx.matrimonio ?? '').trim()
  if (!google && !matrimonio) return json({ error: 'no_links' }, 409)
  const recipients: string[] = Array.isArray(ctx.recipients) ? ctx.recipients : []
  if (recipients.length === 0) return json({ error: 'no_email' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: prof } = await admin.from('profiles')
    .select('business_name, full_name, brand_primary_color, phone').eq('id', me.user.id).maybeSingle()
  const studio = String(prof?.business_name || prof?.full_name || 'Il tuo professionista')
  const chi = String(ctx.chi ?? '').trim()
  const term = TERM[String(ctx.event_kind ?? 'matrimonio')] ?? 'il vostro evento'

  const btn = (href: string, label: string, primary: boolean) =>
    `<a href="${esc(href)}" style="display:inline-block;margin:0 10px 10px 0;padding:13px 26px;text-decoration:none;font-weight:500;font-size:14px;letter-spacing:.3px;${primary ? 'background:#25402F;color:#F4F3EE' : 'border:1px solid #25402F;color:#25402F;background:transparent'}">${esc(label)}</a>`

  const html = emailShell({
    accent: prof?.brand_primary_color ?? undefined,
    eyebrow: 'Com’è andata?',
    title: `${studio} vi chiede due righe`,
    bodyHtml: `
      <p style="margin:0">${chi ? esc(chi) + ', ' : ''}${term} è passato e speriamo sia stato tutto come lo avevate immaginato. Grazie di averci scelto.</p>
      <p style="margin:16px 0 0">Se vi va, <strong>una recensione ci aiuta più di qualsiasi pubblicità</strong>: bastano due righe sincere su com’è andata. È il modo in cui i prossimi sposi ci trovano.</p>
      ${note ? `<div style="margin:18px 0 0;padding:12px 16px;background:#F4F3EE;border-left:3px solid #25402F;white-space:pre-wrap">${esc(note)}</div>` : ''}
      <div style="margin:22px 0 4px">
        ${google ? btn(google, 'Lascia una recensione su Google', true) : ''}
        ${matrimonio ? btn(matrimonio, 'Recensisci su Matrimonio.com', !google) : ''}
      </div>`,
    contactHtml: `Ricevi questa email perché ${esc(studio)} ha lavorato a ${esc(term)} con Planfully.${prof?.phone ? ' Per qualsiasi cosa: ' + esc(String(prof.phone)) : ''}`,
  })

  let sent = 0
  const failed: string[] = []
  for (const to of recipients) {
    const r = await sendEmail({ to, subject: `${studio}: com’è andata? Due righe per noi`, html })
    if (r.ok) sent++; else failed.push(to)
  }
  if (sent === 0) return json({ error: 'email_failed' }, 502)
  const { error: ie } = await admin.from('review_requests')
    .insert({ entry_id: entryId, professional_id: me.user.id, channel: 'email', recipients: recipients.filter((r) => !failed.includes(r)) })
  if (ie) console.error('review_requests insert failed', ie.message)
  return json({ ok: true, sent, to: recipients.filter((r) => !failed.includes(r)) })
})
