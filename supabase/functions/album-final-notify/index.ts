// Edge: album-final-notify
// Quando il fotografo segna l'album come FINALE (trigger DB su album_projects), avvisa la COPPIA
// via email con un link che porta DIRETTAMENTE a visionare l'album. La notifica in-app la crea il
// trigger; qui mandiamo solo le email. Service role.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  let body: { entry_id?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (!body.entry_id) return json({ error: 'entry_id_required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Evento + fotografo (owner della gallery) per personalizzare
  const { data: entry } = await admin.from('calendar_entries').select('title, event_kind, owner_id').eq('id', body.entry_id).maybeSingle()
  const { data: proj } = await admin.from('album_projects').select('final_note').eq('entry_id', body.entry_id).maybeSingle()
  const note = (proj?.final_note ?? '').toString().trim()
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', body.entry_id).maybeSingle()
  const photographerId = gal?.owner_id ?? entry?.owner_id
  let photographerName = 'Il tuo fotografo'
  if (photographerId) {
    const { data: p } = await admin.from('profiles').select('full_name, business_name').eq('id', photographerId).maybeSingle()
    photographerName = p?.business_name ?? p?.full_name ?? photographerName
  }

  // Destinatari = membri coppia (email diretta se presente)
  const { data: members } = await admin.from('wedding_couple_members').select('email, full_name').eq('entry_id', body.entry_id)
  const recipients = [...new Set((members ?? []).map((m: { email: string | null }) => (m.email ?? '').trim().toLowerCase()).filter(Boolean))]
  if (recipients.length === 0) return json({ ok: true, sent: 0, reason: 'no_recipients' })

  // Link: porta direttamente a visionare l'album (via accesso cliente → /album/:entry).
  const link = `${APP_BASE}/area-cliente/accedi?next=${encodeURIComponent('/album/' + body.entry_id)}`
  const html = `
  <div style="background:#F7F4EE;padding:32px 0;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF8;border-radius:14px;overflow:hidden">
      <tr><td style="height:6px;background:#B08D57"></td></tr>
      <tr><td style="padding:28px 32px 8px 32px">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B08D57">Il tuo album è pronto</div>
        <h1 style="font-family:Georgia,serif;font-size:24px;color:#1A1714;margin:6px 0 6px">${esc(photographerName)} ha completato il tuo album</h1>
        <p style="font-size:14px;color:#6B6358;line-height:1.6;margin:0">Le foto sono impaginate e pronte da sfogliare. Aprilo per vederlo nel dettaglio, tavola per tavola.</p>
        ${note ? `<div style="margin-top:14px;padding:12px 14px;background:#F7F4EE;border-radius:8px;border-left:3px solid #B08D57"><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#B08D57;margin-bottom:4px">Una nota da ${esc(photographerName)}</div><div style="font-size:14px;color:#1A1714;line-height:1.6;white-space:pre-wrap">${esc(note)}</div></div>` : ''}
      </td></tr>
      <tr><td style="padding:16px 32px 26px 32px">
        <a href="${link}" style="display:inline-block;background:#1A1714;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px">Guarda il tuo album →</a>
      </td></tr>
      <tr><td style="padding:0 32px 24px 32px;font-size:11px;color:#A59C8E">Ricevi questa email perché ${esc(photographerName)} ha segnato come finale il tuo album su Planfully.</td></tr>
    </table>
  </div>`

  let sent = 0
  for (const to of recipients) {
    try { await sendEmailSES({ to, subject: `${photographerName}: il tuo album è pronto da vedere`, html }); sent++ } catch { /* best-effort */ }
  }
  return json({ ok: true, sent })
})
