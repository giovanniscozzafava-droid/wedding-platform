// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { jsPDF } from 'npm:jspdf@2.5.2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

function hexToRgb(hex: string | null): [number, number, number] {
  if (!hex) return [33, 33, 33]
  const m = hex.replace('#', '').match(/^([0-9a-fA-F]{6})$/)
  if (!m) return [33, 33, 33]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const body = (await req.json().catch(() => ({}))) as { quote_id?: string; variant?: 'NEUTRA' | 'PREMIUM' }
  if (!body.quote_id) return json({ error: 'quote_id required' }, 400)

  const { data: quote, error } = await admin
    .from('quotes')
    .select('*')
    .eq('id', body.quote_id)
    .maybeSingle()
  if (error || !quote) return json({ error: 'quote not found' }, 404)

  const { data: items } = await admin
    .from('quote_items')
    .select('*')
    .eq('quote_id', quote.id)
    .order('sort_order', { ascending: true })

  const { data: owner } = await admin
    .from('profiles')
    .select('full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, subscription_tier')
    .eq('id', quote.owner_id)
    .maybeSingle()

  const variant: 'NEUTRA' | 'PREMIUM' = body.variant ?? quote.pdf_variant ?? 'NEUTRA'
  const isPremium = variant === 'PREMIUM' && owner?.subscription_tier === 'PREMIUM'

  // Build PDF
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  let y = 50

  // Brand color band
  const [r, g, b] = isPremium ? hexToRgb(owner?.brand_primary_color) : [26, 46, 79]
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, W, 30, 'F')

  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text(isPremium && owner?.business_name ? owner.business_name : 'Wedding Platform', 40, y)
  y += 24

  doc.setFontSize(12)
  doc.setTextColor(80, 80, 80)
  doc.text(`Preventivo v${quote.revision}`, 40, y); y += 14
  doc.text(quote.title, 40, y); y += 14
  if (quote.client_name) { doc.text(`Cliente: ${quote.client_name}`, 40, y); y += 14 }
  if (quote.event_date) { doc.text(`Data evento: ${quote.event_date}`, 40, y); y += 14 }
  y += 6

  // Items table (no supplier info se variant NEUTRA)
  doc.setFontSize(11); doc.setTextColor(0, 0, 0)
  doc.setDrawColor(220, 220, 220)
  doc.line(40, y, W - 40, y); y += 16
  doc.text('Voce', 40, y)
  doc.text('Qta', W - 220, y)
  doc.text('Prezzo', W - 160, y)
  doc.text('Totale', W - 80, y)
  y += 8
  doc.line(40, y, W - 40, y); y += 14

  for (const it of (items ?? [])) {
    if (y > 770) { doc.addPage(); y = 50 }
    doc.text(String(it.name_snapshot).substring(0, 60), 40, y)
    doc.text(Number(it.quantity).toString(), W - 220, y, { align: 'left' })
    doc.text(`€ ${Number(it.snapshot_price).toFixed(2)}`, W - 160, y)
    doc.text(`€ ${Number(it.line_client).toFixed(2)}`, W - 80, y)
    y += 14
  }

  y += 8
  doc.line(40, y, W - 40, y); y += 18
  doc.setFontSize(13)
  doc.text(`TOTALE CLIENTE: € ${Number(quote.total_client).toFixed(2)}`, W - 40, y, { align: 'right' })

  // Footer
  if (isPremium && owner) {
    const [pr, pg, pb] = hexToRgb(owner.brand_secondary_color ?? owner.brand_primary_color)
    doc.setFillColor(pr, pg, pb)
    doc.rect(0, 810, W, 32, 'F')
  }

  const pdfBytes = doc.output('arraybuffer')
  const data = new Uint8Array(pdfBytes)
  const key = `${quote.id}/v${quote.revision}.pdf`

  const up = await admin.storage.from('quote-pdfs').upload(key, data, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (up.error) return json({ error: 'upload failed', detail: up.error.message }, 500)

  const signed = await admin.storage.from('quote-pdfs').createSignedUrl(key, 60 * 60 * 24 * 7)
  if (signed.error) return json({ error: 'signed url failed', detail: signed.error.message }, 500)

  await admin.from('quotes').update({
    pdf_url: signed.data.signedUrl,
    pdf_variant: variant,
  }).eq('id', quote.id)

  return json({ ok: true, url: signed.data.signedUrl, key, variant, premium_applied: isPremium })
})
