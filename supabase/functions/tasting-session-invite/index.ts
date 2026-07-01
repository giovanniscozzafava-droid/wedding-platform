// Invia gli inviti di una prova menu a sessioni. Input: { inviteId } (un cliente) oppure
// { sessionId } (tutti i clienti in PENDING con email). Manda una email con le date + link RSVP.
// Il WhatsApp lo apre il gestore lato frontend (wa.me con testo precompilato).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (x: string) => (x ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
const whenIt = (iso: string) => { try { return new Date(iso).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) } catch { return iso } }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const b = await req.json().catch(() => ({})) as Record<string, any>
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  // Raccogli gli inviti da spedire
  let invites: any[] = []
  if (b.inviteId) {
    const { data } = await admin.from('fb_tasting_invites').select('*').eq('id', b.inviteId)
    invites = data ?? []
  } else if (b.sessionId) {
    const { data } = await admin.from('fb_tasting_invites').select('*').eq('session_id', b.sessionId).eq('rsvp', 'PENDING')
    invites = data ?? []
  } else {
    return json({ error: 'no_target' }, 400)
  }
  if (!invites.length) return json({ ok: true, sent: 0 })

  const sessionId = invites[0].session_id
  const { data: session } = await admin.from('fb_tasting_sessions').select('name, season, notes, location_id').eq('id', sessionId).maybeSingle()
  const { data: dates } = await admin.from('fb_tasting_session_dates').select('scheduled_at, sala, sort_order').eq('session_id', sessionId).order('sort_order')
  const { data: loc } = await admin.from('profiles').select('business_name, display_name, full_name').eq('id', session?.location_id).maybeSingle()
  const locName = loc?.business_name || loc?.display_name || loc?.full_name || 'La location'

  const datesHtml = (dates ?? []).map((d: any) =>
    `<li style="margin:2px 0">${esc(whenIt(d.scheduled_at))}${d.sala ? ` · ${esc(d.sala)}` : ''}</li>`).join('')

  let sent = 0
  for (const inv of invites) {
    if (!inv.email) continue
    const link = `${APP_BASE}/prova-menu-invito/${inv.token}`
    await sendEmail({
      to: inv.email,
      subject: `Invito alla prova menu — ${esc(session?.name || 'Degustazione')} · ${esc(locName)}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1714;max-width:560px">
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#c9a227;margin:0 0 6px">Prova menu · ${esc(locName)}</p>
        <h2 style="font-size:20px;margin:0 0 6px">${esc(inv.client_name)}, siete invitati alla degustazione</h2>
        <p style="color:#6b6b6b;margin:0 0 14px">${esc(session?.name || '')}${session?.notes ? ` — ${esc(session.notes)}` : ''}. Scegliete una delle date e confermate: da lì si sblocca la scelta del vostro menu.</p>
        <p style="font-weight:600;margin:0 0 4px">Date disponibili</p>
        <ul style="font-size:14px;color:#333;margin:0 0 18px;padding-left:18px">${datesHtml || '<li>Date in via di definizione</li>'}</ul>
        <p style="margin:18px 0"><a href="${link}" style="display:inline-block;background:#c9a227;color:#1a2e4f;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:9px">Conferma la tua presenza</a></p>
        <p style="font-size:12px;color:#9a9a9a">Se il pulsante non funziona, apri: ${link}</p>
      </div>`,
    }).catch(() => {})
    await admin.from('fb_tasting_invites').update({ invited_at: new Date().toISOString() }).eq('id', inv.id)
    sent++
  }
  return json({ ok: true, sent })
})
