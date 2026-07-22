// Notifica al fotografo che un cliente ha firmato una commessa album (scelta dal catalogo PDF).
// Risolve il fotografo dall'evento e gli manda una email con modello, specifiche e nota del cliente.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell, esc } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const b = await req.json().catch(() => ({})) as Record<string, any>
  if (!b.entryId) return json({ error: 'no_entry' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', b.entryId).maybeSingle()
  const pid = gal?.owner_id
  if (!pid) return json({ error: 'no_photographer' }, 404)
  const { data: proAuth } = await admin.auth.admin.getUserById(pid)
  const proEmail = proAuth?.user?.email
  if (!proEmail) return json({ ok: true, sent: false })

  const sp = b.specs ?? {}
  const specLine = [sp.format && `Formato: ${sp.format}`, sp.size && `Misura: ${sp.size}`, sp.pages && `Pagine: ${sp.pages}`,
    sp.box && sp.box !== 'nessuno' && `Box: ${sp.box}`, sp.finishes?.length && `Finiture: ${sp.finishes.join(', ')}`].filter(Boolean).join(' · ')

  const row = (k: string, v: string) => `<tr><td style="color:#6B6B63;padding:3px 12px 3px 0;vertical-align:top">${k}</td><td>${v}</td></tr>`
  await sendEmail({
    to: proEmail,
    subject: `Commessa album firmata: ${esc(b.model_label || 'Modello')} — ${esc(b.signed_by || 'cliente')}`,
    html: emailShell({
      eyebrow: 'Commessa album',
      title: 'Un cliente ha firmato una commessa album',
      subtitleHtml: 'Scelta dal tuo catalogo PDF.',
      bodyHtml: `<table style="font-size:14px;border-collapse:collapse">
        ${row('Modello', `<strong>${esc(b.model_label || '—')}</strong>${b.page ? ` · pag. ${esc(String(b.page))}` : ''}`)}
        ${row('Specifiche', esc(specLine || 'Standard'))}
        ${sp.note ? row('Nota del cliente', `<span style="font-style:italic">“${esc(sp.note)}”</span>`) : ''}
        ${row('Firmata da', esc(b.signed_by || '—'))}
      </table>`,
      cta: { href: `${APP_BASE}/album-lab`, label: 'Apri le commesse album' },
      contactHtml: 'Il prezzo finale può variare in base a modello/formato/finiture: concordalo col cliente.',
    }),
  }).catch(() => {})

  return json({ ok: true, sent: true })
})
