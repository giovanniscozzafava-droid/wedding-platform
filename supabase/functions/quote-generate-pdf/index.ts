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

function hexToRgb(hex: string | null | undefined, fallback: [number, number, number] = [33, 33, 33]): [number, number, number] {
  if (!hex) return fallback
  const m = hex.replace('#', '').match(/^([0-9a-fA-F]{6})$/)
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Converte hex a HSL e ritorna versione più chiara (per row alternato bg)
function tint(hex: string | null | undefined, alpha = 0.06): [number, number, number] {
  const [r, g, b] = hexToRgb(hex, [200, 200, 200])
  return [Math.round(255 - (255 - r) * alpha), Math.round(255 - (255 - g) * alpha), Math.round(255 - (255 - b) * alpha)]
}

async function fetchImageBytes(url: string): Promise<{ data: Uint8Array; format: 'PNG' | 'JPEG' } | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const ct = r.headers.get('content-type') ?? ''
    const buf = new Uint8Array(await r.arrayBuffer())
    if (ct.includes('png')) return { data: buf, format: 'PNG' }
    if (ct.includes('jpeg') || ct.includes('jpg')) return { data: buf, format: 'JPEG' }
    // SVG / webp non supportati direttamente da jsPDF, skip
    return null
  } catch { return null }
}

function fmtEUR(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return d }
}

function safeText(s: any): string {
  return String(s ?? '').replace(/ /g, ' ').trim()
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
    .select('full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, subscription_tier, phone, city, country')
    .eq('id', quote.owner_id)
    .maybeSingle()

  // Email WP (per footer)
  const { data: ownerAuth } = await admin.auth.admin.getUserById(quote.owner_id)
  const ownerEmail = ownerAuth?.user?.email ?? null

  const variant: 'NEUTRA' | 'PREMIUM' = body.variant ?? quote.pdf_variant ?? 'NEUTRA'
  const isPremium = variant === 'PREMIUM' && owner?.subscription_tier === 'PREMIUM'

  // ── Color palette ─────────────────────────────────────────
  const PRIMARY = hexToRgb(isPremium ? owner?.brand_primary_color : '#1A2E4F', [26, 46, 79])
  const ACCENT = hexToRgb(isPremium ? owner?.brand_secondary_color : '#C49A5C', [196, 154, 92])
  const TEXT = [26, 23, 20] as [number, number, number]
  const MUTED = [110, 110, 110] as [number, number, number]
  const BORDER = [225, 222, 216] as [number, number, number]
  const ROW_ALT = tint(isPremium ? owner?.brand_primary_color : '#1A2E4F', 0.04)

  // ── PDF setup ─────────────────────────────────────────────
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()  // 595
  const H = doc.internal.pageSize.getHeight() // 842
  const M = 50  // margine
  const CONTENT_W = W - M * 2

  // Pre-fetch logo se disponibile
  let logoImg: { data: Uint8Array; format: 'PNG' | 'JPEG' } | null = null
  if (isPremium && owner?.brand_logo_url) {
    logoImg = await fetchImageBytes(owner.brand_logo_url)
  }

  const brandLabel = isPremium && owner?.business_name
    ? owner.business_name
    : owner?.full_name ?? 'Planfully'

  // ── HEADER (su ogni pagina) ───────────────────────────────
  function drawHeader(pageNum: number) {
    // Top brand band
    doc.setFillColor(...PRIMARY)
    doc.rect(0, 0, W, 6, 'F')
    doc.setFillColor(...ACCENT)
    doc.rect(0, 6, W, 1.5, 'F')

    // Brand label / logo
    if (logoImg) {
      try {
        doc.addImage(logoImg.data, logoImg.format, M, 22, 38, 38, undefined, 'FAST')
        doc.setFontSize(13)
        doc.setTextColor(...TEXT)
        doc.setFont('helvetica', 'bold')
        doc.text(safeText(brandLabel), M + 48, 38)
        if (owner?.city) {
          doc.setFontSize(9)
          doc.setTextColor(...MUTED)
          doc.setFont('helvetica', 'normal')
          doc.text(safeText(`${owner.city}${owner.country ? ', ' + owner.country : ''}`), M + 48, 52)
        }
      } catch { /* fallback to text-only */ }
    } else {
      doc.setFontSize(15)
      doc.setTextColor(...TEXT)
      doc.setFont('helvetica', 'bold')
      doc.text(safeText(brandLabel), M, 38)
      if (owner?.city) {
        doc.setFontSize(9)
        doc.setTextColor(...MUTED)
        doc.setFont('helvetica', 'normal')
        doc.text(safeText(`${owner.city}${owner.country ? ', ' + owner.country : ''}`), M, 52)
      }
    }

    // Page number (top right)
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.text(`Pagina ${pageNum}`, W - M, 38, { align: 'right' })
    doc.text(`Preventivo v${quote.revision}`, W - M, 52, { align: 'right' })

    // Divider
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.5)
    doc.line(M, 72, W - M, 72)
  }

  // ── FOOTER (su ogni pagina) ───────────────────────────────
  function drawFooter() {
    const fy = H - 50
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.5)
    doc.line(M, fy, W - M, fy)

    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')

    const left: string[] = [safeText(brandLabel)]
    if (ownerEmail) left.push(ownerEmail)
    if (owner?.phone) left.push(safeText(owner.phone))
    doc.text(left.join(' · '), M, fy + 14)

    doc.text('Generato con Planfully · planfully.it', W - M, fy + 14, { align: 'right' })

    // Mini brand strip in basso
    doc.setFillColor(...ACCENT)
    doc.rect(0, H - 4, W, 4, 'F')
  }

  let y = 92
  let pageNum = 1
  drawHeader(pageNum)

  function ensureSpace(needed: number) {
    if (y + needed > H - 70) {
      drawFooter()
      doc.addPage()
      pageNum++
      drawHeader(pageNum)
      y = 92
    }
  }

  // ── TITLE BLOCK ───────────────────────────────────────────
  doc.setFontSize(11)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.text('PREVENTIVO', M, y)
  y += 6

  doc.setFontSize(24)
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  doc.text(safeText(quote.title || 'Matrimonio'), M, y + 22)
  y += 38

  // ── CLIENT + EVENT INFO CARD ──────────────────────────────
  const infoCardH = 88
  doc.setFillColor(248, 246, 240)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(M, y, CONTENT_W, infoCardH, 6, 6, 'FD')

  const colW = CONTENT_W / 3
  const cy1 = y + 24
  const cy2 = y + 56

  function infoCell(label: string, value: string, col: 0 | 1 | 2, row: 1 | 2) {
    const x = M + 16 + col * colW
    const yy = row === 1 ? cy1 : cy2
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.text(label.toUpperCase(), x, yy - 10)
    doc.setFontSize(11)
    doc.setTextColor(...TEXT)
    doc.setFont('helvetica', 'bold')
    doc.text(safeText(value || '—').substring(0, 30), x, yy + 4)
  }

  infoCell('Cliente', quote.client_name ?? '—', 0, 1)
  infoCell('Data evento', fmtDate(quote.event_date), 1, 1)
  infoCell('Invitati previsti', quote.guest_count ? String(quote.guest_count) : '—', 2, 1)
  infoCell('Email cliente', quote.client_email ?? '—', 0, 2)
  infoCell('Tavoli', (quote as any).table_count ? String((quote as any).table_count) : '—', 1, 2)
  infoCell('Stato', quote.status ?? 'BOZZA', 2, 2)

  y += infoCardH + 24

  // ── ITEMS TABLE ───────────────────────────────────────────
  doc.setFontSize(11)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.text('VOCI DEL PREVENTIVO', M, y)
  y += 14

  // Table header
  const COL_DESC_W = CONTENT_W * 0.5
  const COL_QTY_W = CONTENT_W * 0.12
  const COL_UNIT_W = CONTENT_W * 0.18
  const COL_TOT_W = CONTENT_W * 0.20

  const COL_DESC_X = M
  const COL_QTY_X = COL_DESC_X + COL_DESC_W
  const COL_UNIT_X = COL_QTY_X + COL_QTY_W
  const COL_TOT_X = COL_UNIT_X + COL_UNIT_W

  doc.setFillColor(...PRIMARY)
  doc.rect(M, y, CONTENT_W, 24, 'F')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('DESCRIZIONE', COL_DESC_X + 10, y + 15)
  doc.text('QUANTITÀ', COL_QTY_X + COL_QTY_W - 6, y + 15, { align: 'right' })
  doc.text('UNITARIO', COL_UNIT_X + COL_UNIT_W - 6, y + 15, { align: 'right' })
  doc.text('TOTALE', COL_TOT_X + COL_TOT_W - 10, y + 15, { align: 'right' })
  y += 24

  doc.setFont('helvetica', 'normal')

  let rowIdx = 0
  for (const it of (items ?? [])) {
    ensureSpace(40)
    const rowH = 28

    // Alt row background
    if (rowIdx % 2 === 1) {
      doc.setFillColor(...ROW_ALT)
      doc.rect(M, y, CONTENT_W, rowH, 'F')
    }

    doc.setFontSize(10)
    doc.setTextColor(...TEXT)
    doc.setFont('helvetica', 'bold')
    const nameText = safeText(it.name_snapshot).substring(0, 65)
    doc.text(nameText, COL_DESC_X + 10, y + 12)

    // Description snapshot piccolo grigio
    if (it.description_snapshot) {
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.setFont('helvetica', 'normal')
      doc.text(safeText(it.description_snapshot).substring(0, 80), COL_DESC_X + 10, y + 22)
    }

    // Qty
    doc.setFontSize(10)
    doc.setTextColor(...TEXT)
    doc.setFont('helvetica', 'normal')
    const qtyStr = `${Number(it.quantity)} ${String(it.unit_snapshot ?? '').toLowerCase()}`
    doc.text(qtyStr, COL_QTY_X + COL_QTY_W - 6, y + 16, { align: 'right' })

    // Unit price
    doc.text(fmtEUR(it.snapshot_price), COL_UNIT_X + COL_UNIT_W - 6, y + 16, { align: 'right' })

    // Total
    doc.setFont('helvetica', 'bold')
    doc.text(fmtEUR(it.line_client), COL_TOT_X + COL_TOT_W - 10, y + 16, { align: 'right' })

    y += rowH
    rowIdx++
  }

  if (!items || items.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'italic')
    doc.text('Nessuna voce inserita.', M + 10, y + 14)
    y += 28
  }

  // Linea separatore prima totali
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.5)
  doc.line(M, y + 4, W - M, y + 4)
  y += 16

  // ── TOTALS BOX ────────────────────────────────────────────
  ensureSpace(100)
  const totW = 260
  const totX = W - M - totW
  const totH = 70

  doc.setFillColor(...PRIMARY)
  doc.roundedRect(totX, y, totW, totH, 6, 6, 'F')

  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.text('TOTALE PREVENTIVO', totX + 16, y + 22)

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(fmtEUR(quote.total_client), totX + totW - 16, y + 46, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const ivaNote = 'IVA inclusa salvo diversa indicazione'
  doc.text(ivaNote, totX + totW - 16, y + 62, { align: 'right' })

  y += totH + 20

  // ── TERMS / NOTES ─────────────────────────────────────────
  ensureSpace(80)
  doc.setFontSize(10)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.text('CONDIZIONI', M, y)
  y += 14

  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')

  const terms = [
    'Preventivo valido 30 giorni dalla data di emissione.',
    'Acconto del 30% all\'accettazione, saldo 30 giorni prima dell\'evento.',
    'Modifiche post-accettazione richiedono nuova conferma scritta del cliente.',
    'Per finanziamento dedicato e polizza annullamento eventi, rivolgersi al wedding planner.',
  ]
  for (const t of terms) {
    ensureSpace(14)
    doc.text('· ' + t, M, y)
    y += 12
  }

  drawFooter()

  // ── Upload PDF ────────────────────────────────────────────
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
