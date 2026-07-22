// Edge: album-final-notify
// Quando il fotografo segna l'album come FINALE (trigger DB su album_projects), avvisa la COPPIA
// via email con un link che porta DIRETTAMENTE a visionare l'album. La notifica in-app la crea il
// trigger; qui mandiamo solo le email. Service role.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/resend.ts'
import { emailShell, esc } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

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
  const html = emailShell({
    eyebrow: 'Il tuo album è pronto',
    title: `${photographerName} ha completato il tuo album`,
    subtitleHtml: 'Le foto sono impaginate e pronte da sfogliare. Aprilo per vederlo nel dettaglio, tavola per tavola.',
    bodyHtml: note
      ? `<div style="padding:12px 16px;background:#F4F3EE;border-left:3px solid #25402F"><div style="font-family:'IBM Plex Mono',Consolas,monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#25402F;margin-bottom:6px">Una nota da ${esc(photographerName)}</div><div style="line-height:1.7;white-space:pre-wrap">${esc(note)}</div></div>`
      : '',
    cta: { href: link, label: 'Guarda il tuo album' },
    contactHtml: `Ricevi questa email perché ${esc(photographerName)} ha segnato come finale il tuo album su Planfully.`,
  })

  let sent = 0
  for (const to of recipients) {
    try { await sendEmailSES({ to, subject: `${photographerName}: il tuo album è pronto da vedere`, html }); sent++ } catch { /* best-effort */ }
  }
  return json({ ok: true, sent })
})
