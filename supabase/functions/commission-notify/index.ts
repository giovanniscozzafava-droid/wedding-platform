// Notifica al fotografo che un cliente ha firmato una commessa album (scelta dal catalogo PDF).
// Risolve il fotografo dall'evento e gli manda una email con modello, specifiche e nota del cliente.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (x: string) => (x ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

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

  await sendEmail({
    to: proEmail,
    subject: `Commessa album firmata: ${esc(b.model_label || 'Modello')} — ${esc(b.signed_by || 'cliente')}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1714;max-width:540px">
      <h2 style="font-size:18px;margin:0 0 4px">Un cliente ha firmato una commessa album</h2>
      <p style="color:#6b6b6b;margin:0 0 16px">Scelta dal tuo catalogo PDF.</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="color:#8a8a8a;padding:3px 12px 3px 0">Modello</td><td><strong>${esc(b.model_label || '—')}</strong>${b.page ? ` · pag. ${esc(String(b.page))}` : ''}</td></tr>
        <tr><td style="color:#8a8a8a;padding:3px 12px 3px 0">Specifiche</td><td>${esc(specLine || 'Standard')}</td></tr>
        ${sp.note ? `<tr><td style="color:#8a8a8a;padding:3px 12px 3px 0;vertical-align:top">Nota del cliente</td><td style="font-style:italic">“${esc(sp.note)}”</td></tr>` : ''}
        <tr><td style="color:#8a8a8a;padding:3px 12px 3px 0">Firmata da</td><td>${esc(b.signed_by || '—')}</td></tr>
      </table>
      <p style="margin:20px 0"><a href="${APP_BASE}/album-lab" style="display:inline-block;background:#c9a227;color:#1a2e4f;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:9px">Apri le commesse album</a></p>
      <p style="font-size:12px;color:#9a9a9a">Il prezzo finale può variare in base a modello/formato/finiture: concordalo col cliente.</p>
    </div>`,
  }).catch(() => {})

  return json({ ok: true, sent: true })
})
