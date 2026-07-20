// Edge: gallery-deadline-run
// Cron giornaliero (via gallery_deadline_kick): avvisa via email la COPPIA che deve finire la selezione
// foto entro la data massima impostata dal fotografo. Manda a 7/3/1/0 giorni dalla scadenza e, se scaduta,
// ogni ~3 giorni. Solo selezioni ancora ATTIVE (non inviate). Service role.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/resend.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const dayMs = 86400000
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / dayMs)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const today = new Date().toISOString().slice(0, 10)

  // selezioni con scadenza, ancora attive
  const { data: sels } = await admin.from('gallery_selection')
    .select('gallery_id, entry_id, deadline, last_reminder_on, status')
    .not('deadline', 'is', null).eq('status', 'ACTIVE')

  let sent = 0
  for (const s of (sels ?? []) as { gallery_id: string; entry_id: string; deadline: string; last_reminder_on: string | null }[]) {
    const left = daysBetween(s.deadline, today) // >0 mancano giorni, 0 oggi, <0 scaduta
    // già avvisati oggi? salta
    if (s.last_reminder_on === today) continue
    const dueApproach = left === 7 || left === 3 || left === 1 || left === 0
    const dueOverdue = left < 0 && (s.last_reminder_on == null || daysBetween(today, s.last_reminder_on) >= 3)
    if (!dueApproach && !dueOverdue) continue

    // gallery + fotografo + coppia
    const { data: gal } = await admin.from('event_galleries').select('owner_id, share_token, couple_label, title').eq('id', s.gallery_id).maybeSingle()
    if (!gal?.share_token) continue
    let photographerName = 'Il tuo fotografo'
    if (gal.owner_id) {
      const { data: p } = await admin.from('profiles').select('full_name, business_name').eq('id', gal.owner_id).maybeSingle()
      photographerName = p?.business_name ?? p?.full_name ?? photographerName
    }
    const { data: members } = await admin.from('wedding_couple_members').select('email').eq('entry_id', s.entry_id)
    const recipients = [...new Set((members ?? []).map((m: { email: string | null }) => (m.email ?? '').trim().toLowerCase()).filter(Boolean))]
    if (recipients.length === 0) { await admin.from('gallery_selection').update({ last_reminder_on: today }).eq('gallery_id', s.gallery_id); continue }

    const link = `${APP_BASE}/g/${gal.share_token}/selezione`
    const overdue = left < 0
    const dl = new Date(s.deadline + 'T00:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    const headline = overdue ? 'La selezione delle foto è scaduta' : left === 0 ? 'Ultimo giorno per la selezione delle foto' : `Mancano ${left} giorni per la selezione delle foto`
    const sub = overdue
      ? `Il termine per scegliere le foto dell'album (${dl}) è passato: completatela il prima possibile, così ${esc(photographerName)} può procedere.`
      : `${esc(photographerName)} aspetta la vostra selezione entro il ${dl}. Aprite la galleria e finite di scegliere le foto per l'album.`
    const html = `
    <div style="background:#F7F4EE;padding:32px 0;font-family:Arial,sans-serif">
      <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF8;border-radius:14px;overflow:hidden">
        <tr><td style="height:6px;background:${overdue ? '#C0552F' : '#B08D57'}"></td></tr>
        <tr><td style="padding:28px 32px 8px 32px">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${overdue ? '#C0552F' : '#B08D57'}">Selezione album${overdue ? ' · scaduta' : ''}</div>
          <h1 style="font-family:Georgia,serif;font-size:23px;color:#1A1714;margin:6px 0 6px">${esc(headline)}</h1>
          <p style="font-size:14px;color:#6B6358;line-height:1.6;margin:0">${sub}</p>
        </td></tr>
        <tr><td style="padding:16px 32px 26px 32px">
          <a href="${link}" style="display:inline-block;background:#1A1714;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px">Continua la selezione →</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;font-size:11px;color:#A59C8E">Ricevi questa email perché ${esc(photographerName)} ha fissato una data per la selezione delle foto su Planfully.</td></tr>
      </table>
    </div>`
    for (const to of recipients) {
      try { await sendEmailSES({ to, subject: overdue ? `${photographerName}: selezione foto scaduta` : `${photographerName}: ${headline.toLowerCase()}`, html }); sent++ } catch { /* best-effort */ }
    }
    await admin.from('gallery_selection').update({ last_reminder_on: today }).eq('gallery_id', s.gallery_id)
  }
  return json({ ok: true, sent })
})
