// Edge: quote-engagement-notify
// Il CLIENTE (coppia) ha iniziato a valutare un preventivo cliccando una voce (ACCETTATO/FORSE).
// Avvisiamo il professionista UNA sola volta: notifica in-app + email "un cliente sta valutando i
// tuoi servizi". Nessun contatto del cliente viene esposto (per i preventivi suggeriti restano ciechi).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
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

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  // Client "come chiamante": riusa la sicurezza di couple_get_quote_detail per verificare che
  // il chiamante sia davvero un membro dell'evento di quel preventivo (stessa chiave-evento).
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })

  try {
    const { data: detail } = await asCaller.rpc('couple_get_quote_detail', { p_quote_id: body.quote_id })
    const derr = (detail as { error?: string } | null)?.error
    if (!detail || derr) return json({ error: 'forbidden' }, 403)

    // De-dup atomico: setta engagement_notified_at solo se ancora null → avvisa una volta sola.
    const { data: upd } = await admin.from('quotes')
      .update({ engagement_notified_at: new Date().toISOString() })
      .eq('id', body.quote_id).is('engagement_notified_at', null)
      .select('id, owner_id, title, event_kind, event_date').maybeSingle()
    if (!upd) return json({ ok: true, skipped: true }) // gia' avvisato

    const ownerId = upd.owner_id as string
    const evLabel = `${upd.event_kind ?? 'evento'}${upd.event_date ? ` del ${new Date(upd.event_date).toLocaleDateString('it-IT')}` : ''}`

    // 1) notifica in-app
    await admin.rpc('push_user_notification', {
      p_user: ownerId, p_type: 'QUOTE_ENGAGEMENT',
      p_title: 'Un cliente sta valutando i tuoi servizi',
      p_body: `Un cliente ha iniziato a valutare il tuo preventivo${upd.title ? ` «${upd.title}»` : ''} per ${evLabel}. Tienilo d'occhio: potrebbe accettare a breve.`,
      p_link: `/quotes/${upd.id}`, p_ref: upd.id,
    })

    // 2) email al professionista (senza esporre alcun contatto del cliente)
    let sent = false
    try {
      const { data: au } = await admin.auth.admin.getUserById(ownerId)
      const to = au?.user?.email
      if (to) {
        const html = emailShell({
          eyebrow: 'Il cliente si sta muovendo',
          title: 'Un cliente sta valutando i tuoi servizi',
          subtitleHtml: `Ha iniziato a valutare il tuo preventivo${upd.title ? ` <strong>${esc(upd.title)}</strong>` : ''} per il suo <strong>${esc(evLabel)}</strong>`,
          bodyHtml: `<p style="margin:0">Sta selezionando le voci che gli interessano. È il momento giusto per essere pronto: apri il preventivo e, se vuoi, proponigli una call.</p>`,
          cta: { href: `${APP_BASE}/quotes/${upd.id}`, label: 'Apri il preventivo' },
          contactHtml: `Ricevi questa email perché un cliente sta valutando un tuo preventivo su Planfully.`,
        })
        await sendEmailSES({ to, subject: 'Un cliente sta valutando i tuoi servizi', html })
        sent = true
      }
    } catch { /* email best-effort: la notifica in-app è già partita */ }

    return json({ ok: true, notified: true, email_sent: sent })
  } catch (e) { return json({ error: 'exception', detail: String((e as Error)?.message ?? e).slice(0, 200) }, 500) }
})
