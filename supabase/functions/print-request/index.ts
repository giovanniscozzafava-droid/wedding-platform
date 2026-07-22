// Richiesta di stampa di un cliente (beta, no pagamento). Risolve il fotografo (da entry_id o slug),
// salva la richiesta e gli manda una email. Il fotografo poi la evade come preferisce.
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
    const thumb = b.photoThumb ? `<img src="${esc(b.photoThumb)}" alt="" style="max-width:180px;border-radius:10px;margin:0 0 12px;display:block" />` : ''
    const row = (k: string, v: string) => `<tr><td style="color:#6B6B63;padding:3px 12px 3px 0;vertical-align:top">${k}</td><td>${v}</td></tr>`
    await sendEmail({
      to: proEmail,
      subject: `Richiesta stampa: ${product} ${format} — ${esc(name)}`,
      html: emailShell({
        eyebrow: 'Richiesta di stampa',
        title: 'Nuova richiesta di stampa',
        subtitleHtml: 'Un cliente vuole stampare una sua foto.',
        bodyHtml: `${thumb}<table style="font-size:14px;border-collapse:collapse">
          ${row('Prodotto', `<strong>${product}</strong>`)}
          ${row('Formato', `<strong>${format}</strong>`)}
          ${row('Cliente', `${esc(name)} · <a href="mailto:${esc(email)}" style="color:#25402F">${esc(email)}</a>${b.phone ? ' · ' + esc(b.phone) : ''}`)}
          ${b.note ? row('Note', esc(b.note)) : ''}
        </table>`,
        cta: { href: `${APP_BASE}/richieste-stampa`, label: 'Vedi le richieste' },
        contactHtml: 'Sei tu a gestire stampa e consegna. In beta Planfully non incassa nulla.',
      }),
    }).catch(() => {})
  }

  return json({ ok: true, id: row.id })
})
