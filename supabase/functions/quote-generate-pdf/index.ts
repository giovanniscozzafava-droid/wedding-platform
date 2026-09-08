// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { jsPDF } from 'npm:jspdf@2.5.2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

function hexToRgb(hex: string | null | undefined, fb: [number, number, number] = [33, 33, 33]): [number, number, number] {
  if (!hex) return fb
  const m = hex.replace('#', '').match(/^([0-9a-fA-F]{6})$/)
  if (!m) return fb
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function tint(rgb: [number, number, number], alpha = 0.06): [number, number, number] {
  return [
    Math.round(255 - (255 - rgb[0]) * alpha),
    Math.round(255 - (255 - rgb[1]) * alpha),
    Math.round(255 - (255 - rgb[2]) * alpha),
  ]
}

async function fetchImage(url: string): Promise<{ data: Uint8Array; format: 'PNG' | 'JPEG' } | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const ct = r.headers.get('content-type') ?? ''
    const buf = new Uint8Array(await r.arrayBuffer())
    if (ct.includes('png')) return { data: buf, format: 'PNG' }
    if (ct.includes('jpeg') || ct.includes('jpg')) return { data: buf, format: 'JPEG' }
    return null
  } catch { return null }
}

const fmtEUR = (n: any) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n ?? 0))
const fmtEURcompact = (n: any) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(Number(n ?? 0))
const fmtDate = (d: any) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) } catch { return String(d) } }
// La riga sotto il nome della voce spiega COME si arriva al totale a destra.
// Prima diceva "1 pezzo · 250,00 € cad.": "pezzo" è la parola sbagliata per un
// pacchetto o un servizio (e "cad." è linguaggio da magazzino). Si dice
// "unità", con il plurale giusto per le altre unità di misura.
const NOMI_UNITA: Record<string, [string, string]> = {
  PEZZO: ['unità', 'unità'],       // invariabile
  PERSONA: ['persona', 'persone'],
  ORA: ['ora', 'ore'],
  EVENTO: ['evento', 'eventi'],
}
function rigaQuantita(qty: number, unit: any, prezzo: string): string {
  const u = String(unit ?? '').toUpperCase()
  const n = Number.isFinite(qty) && qty > 0 ? qty : 1
  const q = Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
  const [sing, plur] = NOMI_UNITA[u] ?? NOMI_UNITA.PEZZO
  // quantità 1: nessuna moltiplicazione da mostrare, solo il prezzo di quella voce
  return n === 1 ? `1 ${sing} · ${prezzo}` : `${q} ${plur} × ${prezzo}`
}

const safeText = (s: any) => String(s ?? '')
  .replace(/\p{Extended_Pictographic}/gu, '')
  .replace(/[\u200D\uFE0F\u20E3]/g, '')
  .replace(/[\x00-\x1f]/g, '')
  .trim()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const body = (await req.json().catch(() => ({}))) as { quote_id?: string; variant?: 'NEUTRA' | 'PREMIUM' }
  if (!body.quote_id) return json({ error: 'quote_id required' }, 400)

  // Autenticazione + ownership: il PDF contiene PII cliente, totali e fornitori.
  // Solo il proprietario del preventivo (o admin) può generarlo (anti-IDOR).
  // Il service_role (chiamate interne server-to-server, es. quote-send) è fidato.
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const bearer = authHeader.slice(7)
  const isInternal = bearer === SERVICE_KEY
  let callerId: string | null = null
  if (!isInternal) {
    const { data: callerData, error: callerErr } = await admin.auth.getUser(bearer)
    if (callerErr || !callerData.user) return json({ error: 'unauthorized' }, 401)
    callerId = callerData.user.id
  }

  const { data: quote } = await admin.from('quotes').select('*').eq('id', body.quote_id).maybeSingle()
  if (!quote) return json({ error: 'quote not found' }, 404)

  if (!isInternal && quote.owner_id !== callerId) {
    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerId!).maybeSingle()
    if (callerProfile?.role !== 'ADMIN') {
      // Consenti anche alla COPPIA dell'evento: riusa la sicurezza di couple_get_quote_detail
      // (membership via chiave-evento) così può scaricare il PDF anche dei preventivi SUGGERITI
      // (di cui non è owner). Il PDF rispetta il blind e mostra solo le voci accettate.
      const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
      const { data: detail } = await asCaller.rpc('couple_get_quote_detail', { p_quote_id: quote.id })
      if (!detail || (detail as { error?: string }).error) return json({ error: 'forbidden' }, 403)
    }
  }

  const { data: allItems } = await admin.from('quote_items').select('*').eq('quote_id', quote.id).order('sort_order', { ascending: true })
  // Logica "accettato": se il cliente ha fatto una selezione per-voce
  // (total_client_selected>0), il PDF di output somma SOLO le voci accettate e usa
  // il totale selezionato. Sull'offerta ancora aperta (nessuna selezione) mostra
  // tutte le voci e il totale pieno. Coerente con contratto/atto (R1/M2).
  const hasSelection = Number(quote.total_client_selected) > 0
  const items = hasSelection
    ? (allItems ?? []).filter((it: any) => it.client_decision === 'ACCETTATO')
    : (allItems ?? [])
  const outTotal = hasSelection ? Number(quote.total_client_selected) : Number(quote.total_client)

  // Blind CANONICO: la modalità di vendita del capostipite (profiles.capostipite_sale_mode)
  // con override per-voce supplier_blind — la stessa regola di quote_item_is_blind
  // (coalesce(supplier_blind, mode='BUNDLE')). BUNDLE => voce cieca (nessun nome fornitore
  // al cliente); ITEMIZED => nome visibile salvo supplier_blind sulla singola voce.
  // (Prima si usava calendar_entries.business_model, disallineato dal blind canonico:
  // un capostipite BUNDLE con business_model=BROKER esponeva i nomi sul PDF.)
  const { data: ownerMode } = await admin.from('profiles')
    .select('capostipite_sale_mode').eq('id', quote.owner_id).maybeSingle()
  const saleMode: 'BUNDLE' | 'ITEMIZED' = (ownerMode?.capostipite_sale_mode as 'BUNDLE' | 'ITEMIZED') ?? 'BUNDLE'
  const itemBlind = (it: any): boolean => it.supplier_blind ?? (saleMode === 'BUNDLE')

  // Carica i fornitori solo per le voci NON cieche.
  const supplierIds = Array.from(new Set((items ?? []).filter((i: any) => !itemBlind(i)).map((i: any) => i.supplier_id).filter(Boolean)))
  const { data: suppliers } = supplierIds.length
    ? await admin.from('profiles').select('id, full_name, business_name, subrole').in('id', supplierIds)
    : { data: [] }
  const supById = new Map((suppliers ?? []).map((s: any) => [s.id, s]))

  // Categoria vera per l'header non-premium (prima mostrava la stringa letterale
  // "CATEGORIA": nessun join con services/service_categories la rendeva possibile).
  const serviceIds = Array.from(new Set((items ?? []).map((i: any) => i.service_id).filter(Boolean)))
  const { data: svcRows } = serviceIds.length
    ? await admin.from('services').select('id, category_id').in('id', serviceIds)
    : { data: [] }
  const categoryIdByService = new Map((svcRows ?? []).map((s: any) => [s.id, s.category_id]))
  const categoryIds = Array.from(new Set(Array.from(categoryIdByService.values()).filter(Boolean)))
  const { data: catRows } = categoryIds.length
    ? await admin.from('service_categories').select('id, name').in('id', categoryIds)
    : { data: [] }
  const categoryNameById = new Map((catRows ?? []).map((c: any) => [c.id, c.name]))
  const categoryLabel = (it: any): string =>
    categoryNameById.get(categoryIdByService.get(it.service_id)) ?? 'Altri servizi'

  const { data: owner } = await admin.from('profiles')
    .select('full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, subscription_tier, phone, city, country, bio, role, subrole')
    .eq('id', quote.owner_id).maybeSingle()
  const { data: ownerAuth } = await admin.auth.admin.getUserById(quote.owner_id)
  const ownerEmail = ownerAuth?.user?.email ?? null

  const variant: 'NEUTRA' | 'PREMIUM' = body.variant ?? quote.pdf_variant ?? 'NEUTRA'
  const isPremium = variant === 'PREMIUM' && owner?.subscription_tier === 'PREMIUM'

  // ── Palette editorial ─────────────────────────────────────
  // Brand colors: usa SEMPRE il brand dell'owner se impostato (anche FREE).
  // PREMIUM sblocca layout/sezioni extra, non il branding di base.
  const PRIMARY = hexToRgb(owner?.brand_primary_color || '#1A2E4F', [26, 46, 79])
  const ACCENT = hexToRgb(owner?.brand_secondary_color || '#C49A5C', [196, 154, 92])
  const INK = [26, 23, 20] as [number, number, number]      // testo principale
  const MUTED = [120, 113, 100] as [number, number, number] // testo secondario
  const SUBTLE = [165, 156, 142] as [number, number, number] // mini-label
  const CREAM = [248, 245, 238] as [number, number, number]  // bg sezione
  const BORDER = [228, 222, 210] as [number, number, number]
  const PAPER = [253, 251, 246] as [number, number, number]  // page bg sottile

  // ── PDF setup ─────────────────────────────────────────────
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 56
  const CONTENT_W = W - M * 2

  // Pre-fetch logo
  // Brand logo viene sempre caricato se disponibile (anche per fornitori NEUTRA
  // su preventivi diretti, dove devono presentare la propria identita).
  let logoImg: { data: Uint8Array; format: 'PNG' | 'JPEG' } | null = null
  if (owner?.brand_logo_url) logoImg = await fetchImage(owner.brand_logo_url)

  const brandName = owner?.business_name || owner?.full_name || 'Planfully'
  const ROLE_LABEL: Record<string, string> = {
    WEDDING_PLANNER: 'Wedding planner',
    LOCATION: 'Location',
    FORNITORE: owner?.subrole ? owner.subrole.toLowerCase().replace(/_/g, ' ') : 'Fornitore',
    ADMIN: 'Planfully',
  }
  const roleLabel = ROLE_LABEL[owner?.role ?? ''] ?? 'Wedding planner'
  const brandSubtitle = isPremium && owner?.city
    ? `${owner.city}${owner.country ? ', ' + owner.country : ''}`
    : roleLabel

  // ── Page background sottile ───────────────────────────────
  function paperBg() {
    doc.setFillColor(...PAPER)
    doc.rect(0, 0, W, H, 'F')
  }

  function ornament(yPos: number, width = 80) {
    const cx = W / 2
    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.6)
    doc.line(cx - width / 2, yPos, cx - 6, yPos)
    doc.line(cx + 6, yPos, cx + width / 2, yPos)
    doc.setFillColor(...ACCENT)
    doc.circle(cx, yPos, 1.5, 'F')
  }

  // ╔═══════════════════════════════════════════════════════╗
  // ║  PAGE 1 — COVER                                        ║
  // ╚═══════════════════════════════════════════════════════╝
  paperBg()

  // Top accent stripe
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, W, 4, 'F')
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 4, W, 1, 'F')

  // Logo + brand block (top left)
  let topY = 40
  if (logoImg) {
    try {
      doc.addImage(logoImg.data, logoImg.format, M, topY, 44, 44, undefined, 'FAST')
      doc.setFontSize(13)
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.text(safeText(brandName), M + 56, topY + 18)
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
      doc.setFont('helvetica', 'normal')
      doc.text(safeText(brandSubtitle), M + 56, topY + 32)
    } catch { /* fallthrough */ }
  } else {
    doc.setFontSize(14)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.text(safeText(brandName), M, topY + 14)
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.text(safeText(brandSubtitle), M, topY + 28)
  }

  // Doc meta top right
  doc.setFontSize(8)
  doc.setTextColor(...SUBTLE)
  doc.setFont('helvetica', 'normal')
  doc.text(`Preventivo · revisione v${quote.revision}`, W - M, topY + 14, { align: 'right' })
  doc.text(new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }), W - M, topY + 28, { align: 'right' })

  // Cover hero — editorial centered
  const coverCy = 280

  doc.setFontSize(10)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'normal')
  const eyebrow = 'P R E V E N T I V O   P E R'
  // jsPDF con align:'center' NON conta il charSpace nella larghezza → il testo
  // spaziato finisce spostato a sinistra. Centriamo a mano sulla larghezza REALE
  // (glifi + charSpace) e disegniamo left-aligned, così è centrato come il titolo.
  const eyebrowW = doc.getTextWidth(eyebrow) + 2 * (eyebrow.length - 1)
  doc.text(eyebrow, (W - eyebrowW) / 2, coverCy - 80, { charSpace: 2 })

  ornament(coverCy - 62)

  // Title - sposi names XL.
  // FIX overlap nomi/data: il titolo lungo va a 2 righe; se la data restasse a Y fisso ci finirebbe
  // SOTTO. Qui (1) auto-riduco il corpo finche' il titolo non supera 2 righe, (2) tutto cio' che segue
  // scende da un cursore ancorato al fondo REALE del titolo -> la data non puo' mai sovrapporsi.
  const title = safeText(quote.title || 'Matrimonio')
  let titleSize = 40
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(titleSize)
  let titleLines = doc.splitTextToSize(title, CONTENT_W - 40)
  while (titleLines.length > 2 && titleSize > 26) {
    titleSize -= 2
    doc.setFontSize(titleSize)
    titleLines = doc.splitTextToSize(title, CONTENT_W - 40)
  }
  doc.setTextColor(...INK)
  const titleTop = coverCy - 20                 // baseline prima riga (ancora fissa in alto)
  const titleLineH = titleSize * 1.15           // interlinea jsPDF (unit pt)
  doc.text(titleLines, W / 2, titleTop, { align: 'center' })
  // Cursore di flusso: parte dal fondo effettivo del titolo. Con 1 riga vale titleTop (layout invariato),
  // con N righe scende di (N-1)*interlinea, spingendo giu' data/totale senza collisioni.
  let cy = titleTop + (titleLines.length - 1) * titleLineH

  // Data + luogo (una riga italica) — posizionata SOTTO il titolo, mai a Y fisso.
  const coverMeta = [
    quote.event_date ? fmtDate(quote.event_date) : null,
    (safeText((quote as any).event_location || '').slice(0, 70)) || null,
  ].filter(Boolean).join('  ·  ')
  if (coverMeta) {
    cy += 48
    doc.setFontSize(11)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'italic')
    doc.text(coverMeta, W / 2, cy, { align: 'center' })
  }

  cy += 28
  ornament(cy)

  // Totale teaser
  cy += 34
  doc.setFontSize(9)
  doc.setTextColor(...SUBTLE)
  doc.setFont('helvetica', 'normal')
  const invLabel = 'I N V E S T I M E N T O   T O T A L E'
  const invW = doc.getTextWidth(invLabel) + 2 * (invLabel.length - 1)
  doc.text(invLabel, (W - invW) / 2, cy, { charSpace: 2 })

  cy += 35
  doc.setFontSize(32)
  doc.setTextColor(...PRIMARY)
  doc.setFont('helvetica', 'bold')
  doc.text(fmtEURcompact(outTotal), W / 2, cy, { align: 'center' })

  cy += 19
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text(fmtEUR(outTotal) + ' · IVA inclusa salvo diversa indicazione', W / 2, cy, { align: 'center' })

  // Cliente + Invitati card bottom
  const infoY = H - 200
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.5)
  doc.line(M, infoY, W - M, infoY)

  doc.setFontSize(8)
  doc.setTextColor(...SUBTLE)
  doc.setFont('helvetica', 'normal')
  doc.text('CLIENTE', M, infoY + 18, { charSpace: 1.2 })
  doc.text('INVITATI', W / 2, infoY + 18, { charSpace: 1.2 })
  doc.text('TAVOLI', W - M, infoY + 18, { charSpace: 1.2, align: 'right' })

  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.text(safeText(quote.client_name || '—'), M, infoY + 38)
  doc.text(quote.guest_count ? String(quote.guest_count) : '—', W / 2, infoY + 38)
  doc.text((quote as any).table_count ? String((quote as any).table_count) : '—', W - M, infoY + 38, { align: 'right' })

  // Footer cover
  doc.setFillColor(...ACCENT)
  doc.rect(0, H - 4, W, 4, 'F')

  // ╔═══════════════════════════════════════════════════════╗
  // ║  PAGE 2+ — VOCI (raggruppate per fornitore)            ║
  // ╚═══════════════════════════════════════════════════════╝
  doc.addPage()
  paperBg()

  function pageHeader(pageNum: number) {
    // Accent stripe top
    doc.setFillColor(...ACCENT)
    doc.rect(0, 0, W, 3, 'F')

    // Brand mini header
    if (logoImg) {
      try { doc.addImage(logoImg.data, logoImg.format, M, 22, 20, 20, undefined, 'FAST') } catch {}
      doc.setFontSize(10)
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.text(safeText(brandName), M + 26, 36)
    } else {
      doc.setFontSize(10)
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.text(safeText(brandName), M, 36)
    }
    doc.setFontSize(8)
    doc.setTextColor(...SUBTLE)
    doc.setFont('helvetica', 'normal')
    doc.text(safeText(title), W - M, 36, { align: 'right' })

    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.4)
    doc.line(M, 56, W - M, 56)
  }

  function pageFooter(pageNum: number) {
    const fy = H - 40
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.4)
    doc.line(M, fy, W - M, fy)
    doc.setFontSize(8)
    doc.setTextColor(...SUBTLE)
    doc.setFont('helvetica', 'normal')
    const left = [safeText(brandName)]
    if (ownerEmail) left.push(safeText(ownerEmail))
    if (owner?.phone) left.push(safeText(owner.phone))
    doc.text(left.join('  ·  '), M, fy + 14)
    doc.text(`${pageNum}`, W - M, fy + 14, { align: 'right' })

    doc.setFillColor(...ACCENT)
    doc.rect(0, H - 3, W, 3, 'F')
  }

  let pageNum = 2
  let y = 90
  pageHeader(pageNum)

  function ensure(needed: number) {
    if (y + needed > H - 60) {
      pageFooter(pageNum)
      doc.addPage()
      paperBg()
      pageNum++
      pageHeader(pageNum)
      y = 90
    }
  }

  // Section title editorial
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'normal')
  doc.text('I L   D E T T A G L I O', M, y, { charSpace: 2 })
  y += 10
  doc.setFontSize(26)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.text('Servizi inclusi', M, y + 22)
  y += 38

  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(1)
  doc.line(M, y, M + 40, y)
  y += 22

  // Raggruppa items.
  // - GLOBAL (default): TUTTI gli items in un unico blocco "Servizi coordinati" — niente
  //   header per fornitore, niente identificazione possibile dal payload PDF.
  // - BROKER: raggruppa per fornitore come prima (gli sposi devono firmare separato).
  type Group = { supplierLabel: string; categoryLabel: string; items: any[]; blind: boolean }
  const groups = new Map<string, Group>()
  for (const it of (items ?? [])) {
    if (itemBlind(it)) {
      // Voci cieche raggruppate sotto un'etichetta neutra: nessun nome fornitore.
      if (!groups.has('__BLIND__')) groups.set('__BLIND__', { supplierLabel: 'Servizi coordinati', categoryLabel: '', items: [], blind: true })
      groups.get('__BLIND__')!.items.push(it)
    } else {
      const sup = it.supplier_id ? supById.get(it.supplier_id) as any : null
      const label = sup ? (sup.business_name ?? sup.full_name ?? 'Fornitore') : 'Servizi vari'
      const subLabel = isPremium && sup?.subrole ? sup.subrole : ''
      const key = label + (subLabel ? ` · ${subLabel}` : '')
      if (!groups.has(key)) groups.set(key, { supplierLabel: key, categoryLabel: categoryLabel(it), items: [], blind: false })
      groups.get(key)!.items.push(it)
    }
  }

  let subtotal = 0
  for (const [, group] of groups) {
    ensure(60)

    // Group header
    doc.setFontSize(8)
    doc.setTextColor(...SUBTLE)
    doc.setFont('helvetica', 'normal')
    // GLOBAL: usa label generico "Servizi coordinati" (no brand).
    // BROKER: se PREMIUM espone il nome fornitore, altrimenti la categoria vera
    // del servizio (prima era la stringa letterale "CATEGORIA").
    const headerLabel = group.blind
      ? group.supplierLabel.toUpperCase()
      : (isPremium ? group.supplierLabel.toUpperCase() : group.categoryLabel.toUpperCase())
    doc.text(headerLabel, M, y, { charSpace: 1.2 })
    y += 4
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.4)
    doc.line(M, y + 8, W - M, y + 8)
    y += 22

    let groupTotal = 0
    for (const it of group.items) {
      ensure(48)
      const lineTot = Number(it.line_client ?? 0)
      groupTotal += lineTot

      // Item name
      doc.setFontSize(11)
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      const name = safeText(it.name_snapshot)
      doc.text(name.length > 60 ? name.slice(0, 58) + '…' : name, M, y)

      // Total right
      doc.setFontSize(11)
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.text(fmtEUR(lineTot), W - M, y, { align: 'right' })
      y += 14

      // Sub-line: qty · unit · unit price
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
      doc.setFont('helvetica', 'normal')
      doc.text(rigaQuantita(Number(it.quantity), it.unit_snapshot, fmtEUR(it.snapshot_price)), M, y)
      y += 12

      // Sconto applicato alla singola voce: il cliente vede "-X%" e il prezzo pieno barrato.
      // Il trigger fa line_client = base*(1 - pct/100) ⇒ pieno = line_client / (1 - pct/100).
      const discPct = Number((it as any).item_discount_percent ?? 0)
      if (discPct > 0 && discPct < 100 && lineTot > 0) {
        const grossTot = lineTot / (1 - discPct / 100)
        ensure(14)
        const pctLabel = Number.isInteger(discPct) ? String(discPct) : discPct.toFixed(1)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...PRIMARY)
        doc.text(`Prezzo riservato −${pctLabel}%`, M, y)
        // Destra: "invece di € pieno" col prezzo pieno barrato.
        doc.setFont('helvetica', 'normal')
        const amt = fmtEUR(grossTot)
        doc.setTextColor(...MUTED)
        doc.text(amt, W - M, y, { align: 'right' })
        const wAmt = doc.getTextWidth(amt)
        doc.setDrawColor(...MUTED)
        doc.setLineWidth(0.5)
        doc.line(W - M - wAmt, y - 2.5, W - M, y - 2.5)  // barratura sul prezzo pieno
        doc.setTextColor(...SUBTLE)
        doc.text('invece di ', W - M - wAmt - 3, y, { align: 'right' })
        y += 13
      }

      // Descrizione COMPLETA (niente taglio a 2 righe come prima): scorre riga per riga e va a capo
      // pagina se serve, cosi' il testo del catalogo arriva intero nel preventivo.
      if (it.description_snapshot) {
        const descLines = doc.splitTextToSize(safeText(it.description_snapshot), CONTENT_W - 100)
        for (const dl of descLines) {
          ensure(14)
          doc.setFontSize(9)
          doc.setTextColor(...SUBTLE)
          doc.setFont('helvetica', 'italic')
          doc.text(dl, M, y)
          y += 11
        }
      }
      y += 10

      // Sottile separatore tra voci
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.2)
      doc.line(M, y, W - M, y)
      y += 12
    }

    subtotal += groupTotal

    // Group subtotal (solo se più gruppi)
    if (groups.size > 1) {
      ensure(20)
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.setFont('helvetica', 'normal')
      doc.text(`Subtotale ${group.supplierLabel}`, M, y, { charSpace: 0.3 })
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...INK)
      doc.text(fmtEUR(groupTotal), W - M, y, { align: 'right' })
      y += 24
    }
  }

  if (!items || items.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'italic')
    doc.text('Nessuna voce ancora inserita.', M, y)
    y += 24
  }

  // ── TOTALS BLOCK — editorial ──────────────────────────────
  ensure(160)
  y += 16

  // Top divider con label
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(M, y, W - M, y)
  y += 18

  // Subtotale (se presente IVA o sconti, qui)
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotale servizi', M, y)
  doc.setTextColor(...INK)
  doc.text(fmtEUR(subtotal), W - M, y, { align: 'right' })
  y += 20

  // Righe intermedie (sconto totale / maggiorazione / trasferta) così il salto
  // Subtotale -> Totale è spiegato. Lo SCONTO SUL TOTALE va sempre mostrato, anche
  // in presenza di selezione per-voce: in quel caso lo sconto fisso € è pro-quotato
  // sul subtotale accettato (come fa quotes_recalc_totals), così le righe
  // riconciliano con "TOTALE CLIENTE" in entrambi i casi.
  {
    const pct = Number(quote.total_discount_percent) || 0
    const amt = Number(quote.total_discount_amount) || 0
    const surPct = Number(quote.surcharge_percent) || 0
    const dist = Number(quote.distance_surcharge) || 0
    const subtotalFull = Number(quote.subtotal_client) || subtotal
    // Sconto fisso € pro-quotato sul subtotale mostrato quando c'è una selezione.
    const amtEff = (hasSelection && subtotalFull > 0) ? Math.round(amt * subtotal / subtotalFull * 100) / 100 : amt
    const discounted = Math.max(0, subtotal * (1 - pct / 100) - amtEff)
    const smallRow = (label: string, val: string) => {
      doc.setFontSize(9); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
      doc.text(label, M, y); doc.setTextColor(...INK); doc.text(val, W - M, y, { align: 'right' }); y += 16
    }
    if (pct > 0) smallRow(`Sconto ${pct}%`, `− ${fmtEUR(Math.round(subtotal * pct) / 100)}`)
    if (amtEff > 0) smallRow('Sconto', `− ${fmtEUR(amtEff)}`)
    if (surPct > 0) smallRow(`Maggiorazione ${surPct}%`, `+ ${fmtEUR(Math.round(discounted * surPct) / 100)}`)
    if (dist > 0) smallRow('Trasferta', `+ ${fmtEUR(dist)}`)
  }

  // Total HUGE
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.4)
  doc.line(M, y, W - M, y)
  y += 28

  doc.setFontSize(10)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'normal')
  // "TOTALE CLIENTE" era il nome interno del campo: su un documento che legge
  // il cliente stesso, parlargli in terza persona stona.
  doc.text('T O T A L E', M, y, { charSpace: 2 })

  doc.setFontSize(32)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.text(fmtEUR(outTotal), W - M, y + 6, { align: 'right' })
  y += 28

  doc.setFontSize(9)
  doc.setTextColor(...SUBTLE)
  doc.setFont('helvetica', 'italic')
  doc.text('IVA inclusa salvo diversa indicazione · valido 30 giorni dall\'emissione', W - M, y, { align: 'right' })
  y += 32

  // ── MESSAGGIO PERSONALE WP (se bio presente) ──────────────
  if (owner?.bio) {
    ensure(120)
    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.6)
    doc.line(M, y, M + 40, y)
    y += 18

    doc.setFontSize(9)
    doc.setTextColor(...ACCENT)
    doc.setFont('helvetica', 'normal')
    doc.text('U N   M E S S A G G I O', M, y, { charSpace: 2 })
    y += 22

    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'italic')
    const bioLines = doc.splitTextToSize(safeText(owner.bio).slice(0, 400), CONTENT_W)
    for (const l of bioLines.slice(0, 6)) {
      doc.text(l, M, y)
      y += 16
    }
    y += 6
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.text(`— ${safeText(owner.full_name ?? brandName)}`, M, y)
    y += 24
  }

  // ── TERMINI (in box CREAM) ────────────────────────────────
  ensure(160)
  const tBoxY = y
  const tBoxH = 130
  doc.setFillColor(...CREAM)
  doc.roundedRect(M, tBoxY, CONTENT_W, tBoxH, 4, 4, 'F')

  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.setFont('helvetica', 'normal')
  doc.text('C O N D I Z I O N I', M + 18, tBoxY + 22, { charSpace: 2 })

  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  const terms = [
    'Preventivo valido 30 giorni dalla data di emissione.',
    'Accettazione formalizzata con firma elettronica semplice sul portale.',
    'Acconto del 30% all\'accettazione, saldo 30 giorni prima dell\'evento.',
    'Modifiche post-accettazione richiedono nuova conferma scritta del cliente.',
  ]
  let ty = tBoxY + 44
  for (const t of terms) {
    doc.setTextColor(...ACCENT)
    doc.text('·', M + 18, ty)
    doc.setTextColor(...INK)
    const tLines = doc.splitTextToSize(t, CONTENT_W - 50)
    doc.text(tLines, M + 28, ty)
    ty += 11 * tLines.length + 4
  }
  y = tBoxY + tBoxH + 20

  // ── CONTATTI WP card ──────────────────────────────────────
  ensure(80)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.4)
  doc.line(M, y, W - M, y)
  y += 18

  doc.setFontSize(9)
  doc.setTextColor(...SUBTLE)
  doc.setFont('helvetica', 'normal')
  doc.text('C O N   A F F E T T O   D A', M, y, { charSpace: 2 })
  y += 16

  doc.setFontSize(14)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.text(safeText(brandName), M, y)
  y += 16

  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  const contactLine: string[] = []
  if (ownerEmail) contactLine.push(safeText(ownerEmail))
  if (owner?.phone) contactLine.push(safeText(owner.phone))
  if (owner?.city) contactLine.push(safeText(owner.city))
  if (contactLine.length) doc.text(contactLine.join('  ·  '), M, y)

  pageFooter(pageNum)

  // ── Upload ────────────────────────────────────────────────
  const pdfBytes = new Uint8Array(doc.output('arraybuffer'))
  const key = `${quote.id}/v${quote.revision}.pdf`

  const up = await admin.storage.from('quote-pdfs').upload(key, pdfBytes, {
    contentType: 'application/pdf', upsert: true,
  })
  if (up.error) return json({ error: 'upload failed', detail: up.error.message }, 500)

  const signed = await admin.storage.from('quote-pdfs').createSignedUrl(key, 60 * 60 * 24 * 7)
  if (signed.error) return json({ error: 'signed url failed', detail: signed.error.message }, 500)

  await admin.from('quotes').update({ pdf_url: signed.data.signedUrl, pdf_variant: variant }).eq('id', quote.id)

  return json({ ok: true, url: signed.data.signedUrl, key, variant, premium_applied: isPremium })
})
