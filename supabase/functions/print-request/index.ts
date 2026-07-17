// Richiesta di stampa di un cliente (beta, no pagamento). Risolve il fotografo (da entry_id o slug),
// salva la richiesta e gli manda una email. Il fotografo poi la evade come preferisce.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (x: string) => (x ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const b = await req.json().catch(() => ({})) as Record<string, string>
  const name = (b.name ?? '').trim(); const email = (b.email ?? '').trim().toLowerCase()
  if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad_contact' }, 400)
  if (!b.productKey || !b.formatKey) return json({ error: 'bad_product' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  // risolvi il fotografo
  let pid: string | null = null
  if (b.entryId) {
    const { data } = await admin.from('event_galleries').select('owner_id').eq('entry_id', b.entryId).maybeSingle()
    pid = data?.owner_id ?? null
  }
  if (!pid && b.slug) {
    const { data } = await admin.from('profiles').select('id').eq('slug', b.slug).maybeSingle()
    pid = data?.id ?? null
  }
  if (!pid) return json({ error: 'no_photographer' }, 404)

  const { data: row, error } = await admin.from('print_requests').insert({
    professional_id: pid, entry_id: b.entryId || null,
    photo_drive_id: b.photoDriveId || null, photo_thumb: b.photoThumb || null,
    product_key: b.productKey, format_key: b.formatKey,
    buyer_name: name, buyer_email: email, buyer_phone: b.phone || null, note: b.note || null,
  }).select('id').single()
  if (error) return json({ error: 'insert_failed', detail: error.message }, 500)

  // email al fotografo
  const { data: proAuth } = await admin.auth.admin.getUserById(pid)
  const proEmail = proAuth?.user?.email
  const product = esc(b.productLabel || b.productKey); const format = esc(b.formatLabel || b.formatKey)
  if (proEmail) {
    const thumb = b.photoThumb ? `<img src="${esc(b.photoThumb)}" alt="" style="max-width:180px;border-radius:10px;margin:12px 0" />` : ''
    await sendEmail({
      to: proEmail,
      subject: `Richiesta stampa: ${product} ${format} — ${esc(name)}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1714;max-width:520px">
        <h2 style="font-size:18px;margin:0 0 4px">Nuova richiesta di stampa</h2>
        <p style="color:#6b6b6b;margin:0 0 16px">Un cliente vuole stampare una sua foto.</p>
        ${thumb}
        <table style="font-size:14px;border-collapse:collapse">
          <tr><td style="color:#8a8a8a;padding:3px 12px 3px 0">Prodotto</td><td><strong>${product}</strong></td></tr>
          <tr><td style="color:#8a8a8a;padding:3px 12px 3px 0">Formato</td><td><strong>${format}</strong></td></tr>
          <tr><td style="color:#8a8a8a;padding:3px 12px 3px 0">Cliente</td><td>${esc(name)} · <a href="mailto:${esc(email)}">${esc(email)}</a>${b.phone ? ' · ' + esc(b.phone) : ''}</td></tr>
          ${b.note ? `<tr><td style="color:#8a8a8a;padding:3px 12px 3px 0">Note</td><td>${esc(b.note)}</td></tr>` : ''}
        </table>
        <p style="margin:20px 0"><a href="${APP_BASE}/richieste-stampa" style="display:inline-block;background:#c9a227;color:#1a2e4f;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:9px">Vedi le richieste</a></p>
        <p style="font-size:12px;color:#9a9a9a">Sei tu a gestire stampa e consegna. In beta Planfully non incassa nulla.</p>
      </div>`,
    }).catch(() => {})
  }

  return json({ ok: true, id: row.id })
})
