// deno-lint-ignore-file no-explicit-any
// ============================================================================
// Email del CERCHIO evento. Chiamata via net.http_post da suggest_supplier_to_event
// e respond_circle_suggestion (pattern lead-notify). La notifica in-app (campanello)
// la fanno già le RPC con push_user_notification: qui si aggiunge SOLO l'email, così
// ogni movimento del cerchio ha sempre notifica + email.
//
// Payload: { entry_id, supplier_id, suggested_by, phase }
//   phase 'proposed' → evento futuro: email agli sposi (devono confermare) + al fornitore
//   phase 'added'    → evento passato: email al fornitore (entra subito)
//   phase 'accepted' → sposi hanno confermato: email al fornitore + a chi l'ha proposto
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const FROM = Deno.env.get('SES_FROM_EMAIL') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const b = (await req.json().catch(() => ({}))) as
    { entry_id?: string; supplier_id?: string; suggested_by?: string; phase?: string }
  if (!b.entry_id || !b.supplier_id || !b.phase) return json({ error: 'missing fields' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: entry } = await admin.from('calendar_entries')
    .select('title, event_kind').eq('id', b.entry_id).maybeSingle()
  const titolo = entry?.title ?? 'il vostro evento'

  const { data: sup } = await admin.from('profiles')
    .select('full_name, business_name').eq('id', b.supplier_id).maybeSingle()
  const supName = sup?.business_name ?? sup?.full_name ?? 'Il fornitore'
  const { data: supAuth } = await admin.auth.admin.getUserById(b.supplier_id)
  const supEmail = supAuth?.user?.email ?? null

  const linkEvento = `${APP_BASE}/weddings/${b.entry_id}`
  const linkCouple = `${APP_BASE}/couple`
  const sent: string[] = []

  async function invia(to: string, eyebrow: string, title: string, bodyHtml: string, cta: { href: string; label: string }) {
    const html = emailShell({ eyebrow, title, bodyHtml, cta })
    const r = await sendEmail({ to, subject: title, html, from: FROM })
    if (r.ok) sent.push(to)
  }

  if (b.phase === 'proposed') {
    // agli sposi: devono confermare
    const { data: members } = await admin.from('wedding_couple_members')
      .select('email, full_name').eq('entry_id', b.entry_id)
    for (const m of (members ?? [])) {
      if (!m.email) continue
      await invia(m.email, 'Cerchio dell’evento', 'Un fornitore è stato proposto per il vostro evento',
        `<p style="margin:0 0 14px"><strong>${esc(supName)}</strong> è stato proposto per <strong>${esc(titolo)}</strong>. ` +
        `Puoi approvarlo o rifiutarlo dalla tua area: entra nel cerchio solo se lo confermi tu.</p>`,
        { href: linkCouple, label: 'Approva o rifiuta' })
    }
    // al fornitore proposto: sa di essere stato proposto
    if (supEmail) {
      await invia(supEmail, 'Cerchio dell’evento', `Sei stato proposto per ${titolo}`,
        `<p style="margin:0 0 14px">Sei stato proposto per collaborare a <strong>${esc(titolo)}</strong>. ` +
        `Entri nel cerchio dell’evento — e vedi materiali e foto condivise — appena gli sposi confermano. ` +
        `Ti avvisiamo noi quando succede.</p>`,
        { href: linkEvento, label: 'Vedi l’evento' })
    }
  } else if (b.phase === 'added') {
    if (supEmail) {
      await invia(supEmail, 'Cerchio dell’evento', `Sei nel cerchio di ${titolo}`,
        `<p style="margin:0 0 14px">Sei stato aggiunto al cerchio di <strong>${esc(titolo)}</strong>: ` +
        `trovi le foto e i materiali condivisi dell’evento nella tua area.</p>`,
        { href: linkEvento, label: 'Apri l’evento' })
    }
  } else if (b.phase === 'accepted') {
    if (supEmail) {
      await invia(supEmail, 'Cerchio dell’evento', `Sei stato accettato in ${titolo}`,
        `<p style="margin:0 0 14px">Gli sposi ti hanno accettato nel cerchio di <strong>${esc(titolo)}</strong>. ` +
        `Ora fai parte dell’evento: trovi tutto nella tua area.</p>`,
        { href: linkEvento, label: 'Apri l’evento' })
    }
    if (b.suggested_by && b.suggested_by !== b.supplier_id) {
      const { data: byAuth } = await admin.auth.admin.getUserById(b.suggested_by)
      if (byAuth?.user?.email) {
        await invia(byAuth.user.email, 'Cerchio dell’evento', 'La tua proposta è stata accettata',
          `<p style="margin:0 0 14px">Gli sposi hanno accettato <strong>${esc(supName)}</strong>, ` +
          `che avevi proposto per <strong>${esc(titolo)}</strong>.</p>`,
          { href: linkEvento, label: 'Apri l’evento' })
      }
    }
  } else {
    return json({ error: 'unknown phase' }, 400)
  }

  return json({ ok: true, sent })
})
