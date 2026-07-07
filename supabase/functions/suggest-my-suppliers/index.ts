// Edge: suggest-my-suppliers
// Il professionista (referrer) suggerisce i fornitori che SEGUE (follows APPROVED; basta seguirli)
// — oltre alle eventuali collaborazioni ACTIVE — al cliente
// di un preventivo già inviato. Crea i record supplier_suggestions (+ contatti in _private, nascosti
// al fornitore), manda 1 email al CLIENTE con la lista, 1 email a OGNI fornitore ("sei stato
// suggerito, crea la tua offerta — vedi solo la data") + notifica in-app. Nessun money-talk (beta).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/ses.ts'

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
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const COUPLE_KINDS = new Set(['matrimonio', 'anniversario'])
const fmtDate = (d: string | null) => {
  if (!d) return 'da definire'
  try { return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return d }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: { quote_id?: string; supplier_ids?: string[]; message?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (!body.quote_id) return json({ error: 'quote_id_required' }, 400)
  const supplierIds = [...new Set((body.supplier_ids ?? []).filter(Boolean))]
  if (supplierIds.length === 0) return json({ error: 'no_suppliers' }, 400)
  const message = (body.message ?? '').toString().slice(0, 1000).trim()

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Auth: il chiamante deve essere l'OWNER del preventivo (o admin).
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const { data: au } = await admin.auth.getUser(authHeader.slice(7))
  const caller = au?.user
  if (!caller) return json({ error: 'unauthorized' }, 401)

  const { data: q } = await admin.from('quotes')
    .select('id, owner_id, client_name, client_email, event_kind, event_date, event_location, guest_count')
    .eq('id', body.quote_id).maybeSingle()
  if (!q) return json({ error: 'quote_not_found' }, 404)
  const { data: me } = await admin.from('profiles').select('role, full_name, business_name').eq('id', caller.id).maybeSingle()
  if (q.owner_id !== caller.id && me?.role !== 'ADMIN') return json({ error: 'forbidden' }, 403)
  const referrerName = me?.business_name ?? me?.full_name ?? 'Un professionista'

  // Criterio: fornitori che il referrer SEGUE (follows APPROVED) — seguire è sufficiente.
  // In più, per non regredire i capostipiti, accettiamo anche le collaborazioni ACTIVE.
  const [{ data: fol }, { data: collabs }] = await Promise.all([
    admin.from('follows')
      .select('followed_id').eq('follower_id', q.owner_id).eq('status', 'APPROVED').in('followed_id', supplierIds),
    admin.from('collaborations')
      .select('fornitore_id').eq('capostipite_id', q.owner_id).eq('status', 'ACTIVE').in('fornitore_id', supplierIds),
  ])
  const validIds = [...new Set([
    ...(fol ?? []).map((f: { followed_id: string }) => f.followed_id),
    ...(collabs ?? []).map((c: { fornitore_id: string }) => c.fornitore_id),
  ])]
  if (validIds.length === 0) return json({ error: 'no_valid_suppliers' }, 400)

  const { data: sup } = await admin.from('profiles')
    .select('id, full_name, business_name, subrole, slug, city').in('id', validIds)
  const supById = new Map((sup ?? []).map((s: any) => [s.id, s]))

  const coupleWord = COUPLE_KINDS.has(String(q.event_kind ?? 'matrimonio')) ? 'una coppia' : 'un cliente'
  const eventWord = String(q.event_kind ?? 'evento')
  const dateStr = fmtDate(q.event_date as string | null)

  // 1) UPSERT dei suggerimenti (uno per fornitore) + contatti in _private.
  const created: { id: string; supplier_id: string }[] = []
  for (const sid of validIds) {
    const { data: row, error } = await admin.from('supplier_suggestions').upsert({
      referrer_id: q.owner_id, supplier_id: sid, source_quote_id: q.id,
      event_kind: q.event_kind ?? 'matrimonio', event_date: q.event_date, event_location: q.event_location,
      guest_count: q.guest_count, status: 'SENT',
    }, { onConflict: 'referrer_id,supplier_id,source_quote_id' }).select('id').single()
    if (error || !row) continue
    created.push({ id: (row as any).id, supplier_id: sid })
    await admin.from('supplier_suggestions_private').upsert({
      suggestion_id: (row as any).id,
      client_name: q.client_name, client_email: q.client_email, message: message || null,
    }, { onConflict: 'suggestion_id' })
  }
  if (created.length === 0) return json({ error: 'insert_failed' }, 500)

  // 2) Email + notifica a OGNI fornitore suggerito (vede solo la data, niente PII).
  for (const c of created) {
    const s: any = supById.get(c.supplier_id)
    const supName = s?.business_name ?? s?.full_name ?? 'Fornitore'
    let email: string | null = null
    try { const { data: u } = await admin.auth.admin.getUserById(c.supplier_id); email = u?.user?.email ?? null } catch { /* */ }
    // notifica in-app (best-effort)
    try {
      await admin.rpc('push_user_notification', {
        p_user: c.supplier_id, p_type: 'SUGGESTION_RECEIVED',
        p_title: 'Sei stato suggerito',
        p_body: `${referrerName} ti ha suggerito a ${coupleWord} per un ${eventWord} del ${dateStr}. Crea la tua offerta.`,
        p_link: '/suggerimenti-ricevuti', p_ref: c.id,
      })
    } catch { /* */ }
    if (!email) continue
    const html = `
    <div style="background:#F7F4EE;padding:32px 0;font-family:Arial,sans-serif">
      <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF8;border-radius:14px;overflow:hidden">
        <tr><td style="height:6px;background:#B08D57"></td></tr>
        <tr><td style="padding:28px 32px 8px 32px">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B08D57">Nuova opportunità</div>
          <h1 style="font-family:Georgia,serif;font-size:23px;color:#1A1714;margin:6px 0 4px">${esc(referrerName)} ti ha appena suggerito a ${esc(coupleWord)}</h1>
          <p style="font-size:14px;color:#6B6358;line-height:1.6;margin:8px 0 0">
            Per un <strong>${esc(eventWord)}</strong> del <strong>${esc(dateStr)}</strong>${q.guest_count ? ` · ~${esc(q.guest_count)} invitati` : ''}${q.event_location ? ` · ${esc(q.event_location)}` : ''}.
          </p>
          <p style="font-size:14px;color:#6B6358;line-height:1.6;margin:12px 0 0">
            Crea subito la tua offerta e invia il preventivo. In questa fase <strong>non vedi i dati del cliente</strong>: solo la data. I contatti si sbloccano se il cliente accetta la tua proposta.
          </p>
        </td></tr>
        <tr><td style="padding:14px 32px 26px 32px">
          <a href="${APP_BASE}/suggerimenti-ricevuti" style="display:inline-block;background:#1A1714;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px">Crea la tua offerta →</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;font-size:11px;color:#A59C8E">Ricevi questa email perché ${esc(referrerName)} ti segue su Planfully e ti ha suggerito per questo evento.</td></tr>
      </table>
    </div>`
    try { await sendEmailSES({ to: email, subject: `${referrerName} ti ha suggerito a ${coupleWord} — crea la tua offerta`, html }) } catch { /* best-effort */ }
    void supName
  }

  // 3) UNA email al CLIENTE con la lista dei fornitori suggeriti + messaggio del referrer.
  let clientSent = false
  if (q.client_email) {
    const cards = created.map((c) => {
      const s: any = supById.get(c.supplier_id)
      const name = s?.business_name ?? s?.full_name ?? 'Fornitore'
      const link = s?.slug ? `${APP_BASE}/p/fornitore/${s.slug}` : APP_BASE
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #EFEAE0">
        <div style="font-family:Georgia,serif;font-size:16px;color:#1A1714;font-weight:700">${esc(name)}</div>
        <div style="font-size:12px;color:#8A8275">${esc(cap(s?.subrole ?? 'Fornitore'))}${s?.city ? ' · ' + esc(s.city) : ''}</div>
        <a href="${link}" style="display:inline-block;margin-top:6px;font-size:13px;color:#B08D57;text-decoration:none">Vedi il profilo →</a></td></tr>`
    }).join('')
    const html = `
    <div style="background:#F7F4EE;padding:32px 0;font-family:Arial,sans-serif">
      <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF8;border-radius:14px;overflow:hidden">
        <tr><td style="height:6px;background:#B08D57"></td></tr>
        <tr><td style="padding:28px 32px 8px 32px">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B08D57">Fornitori consigliati</div>
          <h1 style="font-family:Georgia,serif;font-size:24px;color:#1A1714;margin:6px 0 6px">${esc(referrerName)} ti consiglia questi professionisti di fiducia</h1>
          ${message ? `<p style="font-size:14px;color:#1A1714;line-height:1.6;margin:0 0 4px;padding:12px 14px;background:#F7F4EE;border-radius:8px">${esc(message)}</p>` : ''}
          <p style="font-size:14px;color:#6B6358;line-height:1.6;margin:8px 0 0">Se vuoi, riceverai da loro un preventivo dedicato per il tuo evento.</p>
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px"><table role="presentation" width="100%">${cards}</table></td></tr>
        <tr><td style="padding:0 32px 24px 32px;font-size:11px;color:#A59C8E">Ricevi questa email perché ${esc(referrerName)} ti ha consigliato dei colleghi su Planfully.</td></tr>
      </table>
    </div>`
    try { await sendEmailSES({ to: String(q.client_email), subject: `${referrerName} ti consiglia alcuni professionisti di fiducia`, html }); clientSent = true } catch { /* */ }
  }

  return json({ ok: true, count: created.length, client_sent: clientSent })
})
