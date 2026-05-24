// deno-lint-ignore-file no-explicit-any
// Genera PDF moodboard editoriale magazine-style.
// Layout collage masonry, gruppi per tag, palette colori estratta, frasi mood,
// brand WP. Salva su quote-pdfs/moodboard/<entry>/v<n>.pdf signed URL.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { jsPDF } from 'npm:jspdf@2.5.2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

function hexToRgb(hex: string | null | undefined, fb: [number, number, number] = [33, 33, 33]): [number, number, number] {
  if (!hex) return fb
  const m = hex.replace('#', '').match(/^([0-9a-fA-F]{6})$/)
  if (!m) return fb
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

async function fetchImage(url: string): Promise<{ data: Uint8Array; format: 'PNG' | 'JPEG' } | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const ct = r.headers.get('content-type') ?? ''
    const buf = new Uint8Array(await r.arrayBuffer())
    if (ct.includes('png')) return { data: buf, format: 'PNG' }
    if (ct.includes('jpeg') || ct.includes('jpg') || ct.includes('webp')) return { data: buf, format: 'JPEG' }
    return null
  } catch { return null }
}

const safeText = (s: any) => String(s ?? '').trim()

const TAG_LABELS: Record<string, string> = {
  vestito: 'Abito',
  fiori: 'Fiori',
  location: 'Location',
  torta: 'Wedding cake',
  allestimento: 'Allestimenti',
  altro: 'Dettagli',
  bouquet: 'Bouquet',
  trucco: 'Beauty',
}

// Phrases ispirazione per ogni tag (editorial fillers)
const TAG_PHRASES: Record<string, string> = {
  vestito: 'L\'abito che racconta chi sei',
  fiori: 'Una sinfonia botanica',
  location: 'Il palcoscenico del vostro sì',
  torta: 'Dolce architettura',
  allestimento: 'Atmosfere e dettagli',
  bouquet: 'Tra le mani della sposa',
  trucco: 'Bellezza che resta',
  altro: 'Ispirazioni',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { entry_id?: string }
  if (!body.entry_id) return json({ error: 'entry_id required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: entry } = await admin.from('calendar_entries').select('*').eq('id', body.entry_id).maybeSingle()
  if (!entry) return json({ error: 'wedding not found' }, 404)

  const { data: images } = await admin.from('mood_images').select('*').eq('entry_id', body.entry_id).order('ord', { ascending: true })
  if (!images || images.length === 0) return json({ error: 'no images yet' }, 400)

  const { data: owner } = await admin.from('profiles')
    .select('full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, subscription_tier, city, phone')
    .eq('id', entry.owner_id).maybeSingle()
  const { data: ownerAuth } = await admin.auth.admin.getUserById(entry.owner_id)
  const ownerEmail = ownerAuth?.user?.email ?? null
  const isPremium = owner?.subscription_tier === 'PREMIUM'

  // Palette
  const PRIMARY = hexToRgb(isPremium ? owner?.brand_primary_color : '#1A2E4F', [26, 46, 79])
  const ACCENT = hexToRgb(isPremium ? owner?.brand_secondary_color : '#C49A5C', [196, 154, 92])
  const INK = [26, 23, 20] as [number, number, number]
  const MUTED = [120, 113, 100] as [number, number, number]
  const SUBTLE = [165, 156, 142] as [number, number, number]
  const BORDER = [228, 222, 210] as [number, number, number]
  const PAPER = [253, 251, 246] as [number, number, number]

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40
  const CONTENT_W = W - M * 2

  // Logo
  let logoImg: { data: Uint8Array; format: 'PNG' | 'JPEG' } | null = null
  if (isPremium && owner?.brand_logo_url) logoImg = await fetchImage(owner.brand_logo_url)

  const brandName = isPremium && owner?.business_name ? owner.business_name : (owner?.full_name ?? 'Planfully')
  const title = safeText(entry.title || 'Matrimonio')

  function paperBg() {
    doc.setFillColor(...PAPER); doc.rect(0, 0, W, H, 'F')
  }

  function pageStripes() {
    doc.setFillColor(...ACCENT); doc.rect(0, 0, W, 4, 'F')
    doc.setFillColor(...PRIMARY); doc.rect(0, 4, W, 1, 'F')
    doc.setFillColor(...ACCENT); doc.rect(0, H - 4, W, 4, 'F')
  }

  function ornament(yPos: number, width = 90) {
    const cx = W / 2
    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.6)
    doc.line(cx - width / 2, yPos, cx - 6, yPos)
    doc.line(cx + 6, yPos, cx + width / 2, yPos)
    doc.setFillColor(...ACCENT)
    doc.circle(cx, yPos, 1.6, 'F')
  }

  // ╔════ COVER ═══════════════════════════════════════════╗
  paperBg()
  pageStripes()

  // Logo
  if (logoImg) {
    try { doc.addImage(logoImg.data, logoImg.format, M, 32, 36, 36, undefined, 'FAST') } catch {}
    doc.setFontSize(11); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(safeText(brandName), M + 46, 48)
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    doc.text(safeText(owner?.city ?? 'Wedding planner'), M + 46, 60)
  } else {
    doc.setFontSize(12); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(safeText(brandName), M, 44)
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    doc.text(safeText(owner?.city ?? 'Wedding planner'), M, 56)
  }

  doc.setFontSize(8)
  doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
  doc.text(new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }), W - M, 44, { align: 'right' })
  doc.text(`${images.length} ispirazioni`, W - M, 56, { align: 'right' })

  // Hero text editorial
  const heroCy = 260
  doc.setFontSize(10); doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'normal')
  doc.text('M O O D B O A R D', W / 2, heroCy - 90, { align: 'center', charSpace: 3 })
  ornament(heroCy - 70)

  doc.setFontSize(48); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  const titleLines = doc.splitTextToSize(title, CONTENT_W - 40)
  doc.text(titleLines, W / 2, heroCy, { align: 'center' })

  if (entry.date_from) {
    doc.setFontSize(12); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'italic')
    try {
      const dt = new Date(entry.date_from).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
      doc.text(dt, W / 2, heroCy + 36, { align: 'center' })
    } catch {}
  }

  ornament(heroCy + 64)

  doc.setFontSize(10); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'italic')
  const subtitle = 'Una raccolta visiva di ispirazioni curate per il vostro giorno più importante'
  doc.text(subtitle, W / 2, heroCy + 100, { align: 'center', maxWidth: 380 })

  // Bottom signature
  doc.setFontSize(9); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
  doc.text('C U R A T A   D A', W / 2, H - 110, { align: 'center', charSpace: 2 })
  doc.setFontSize(16); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  doc.text(safeText(brandName), W / 2, H - 86, { align: 'center' })

  // ╔════ Group per tag ═══════════════════════════════════╗
  const byTag = new Map<string, any[]>()
  for (const img of images) {
    const t = img.tag ?? 'altro'
    if (!byTag.has(t)) byTag.set(t, [])
    byTag.get(t)!.push(img)
  }

  // Pre-fetch tutte le immagini (parallelo, max 30 concorrenti)
  async function fetchAllImages(imgs: any[]) {
    const results: Record<string, { data: Uint8Array; format: 'PNG' | 'JPEG' } | null> = {}
    const batchSize = 8
    for (let i = 0; i < imgs.length; i += batchSize) {
      const batch = imgs.slice(i, i + batchSize)
      const promises = batch.map((it) => fetchImage(it.url).then(r => ({ id: it.id, r })))
      const settled = await Promise.all(promises)
      for (const { id, r } of settled) results[id] = r
    }
    return results
  }

  const allFetched = await fetchAllImages(images)

  // ╔════ TAG PAGES ═══════════════════════════════════════╗
  for (const [tag, imgs] of byTag) {
    doc.addPage()
    paperBg()
    pageStripes()

    // Page header mini
    if (logoImg) {
      try { doc.addImage(logoImg.data, logoImg.format, M, 32, 22, 22, undefined, 'FAST') } catch {}
      doc.setFontSize(10); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
      doc.text(safeText(brandName), M + 30, 48)
    } else {
      doc.setFontSize(10); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
      doc.text(safeText(brandName), M, 48)
    }
    doc.setFontSize(8); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
    doc.text(`${title} · moodboard`, W - M, 48, { align: 'right' })

    let y = 110

    // Section title editorial
    doc.setFontSize(10); doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'normal')
    doc.text((TAG_LABELS[tag] ?? tag).toUpperCase(), M, y, { charSpace: 2.5 })
    y += 12
    doc.setFontSize(28); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(TAG_PHRASES[tag] ?? 'Ispirazioni', M, y + 22)
    y += 38

    doc.setDrawColor(...ACCENT); doc.setLineWidth(1)
    doc.line(M, y, M + 50, y); y += 28

    // Layout: griglia masonry semplice. Le righe alternano formati.
    // Per A4 con M=40, CONTENT_W = 515. Uso 2-3 cols variabili.
    const GAP = 12
    const colN = 3
    const colW = (CONTENT_W - GAP * (colN - 1)) / colN

    // Calcola colonna heights
    const colHeights = new Array(colN).fill(y)
    const PAGE_BOTTOM = H - 60

    function addImageBlock(img: any, col: number, x: number, yy: number, h: number) {
      const fetched = allFetched[img.id]
      doc.setFillColor(235, 230, 220)
      doc.rect(x, yy, colW, h, 'F')
      if (fetched) {
        try { doc.addImage(fetched.data, fetched.format, x, yy, colW, h, undefined, 'FAST') }
        catch { /* placeholder lascia bg color */ }
      }
      // Caption opzionale
      if (img.caption) {
        doc.setFontSize(7.5); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'italic')
        const lines = doc.splitTextToSize(safeText(img.caption).slice(0, 60), colW)
        doc.text(lines[0], x, yy + h + 10)
      }
    }

    let imgIdx = 0
    while (imgIdx < imgs.length) {
      // pick shortest column
      let minH = Math.min(...colHeights)
      let col = colHeights.indexOf(minH)
      if (minH > PAGE_BOTTOM - 80) break  // pagina piena → next page

      const img = imgs[imgIdx]
      // varia altezze per masonry: aspect 4:5 / 3:4 / 1:1 / 2:3
      const aspects = [1.25, 1.33, 1.0, 1.5]
      const aspect = aspects[imgIdx % aspects.length]
      const h = Math.round(colW * aspect)

      const x = M + col * (colW + GAP)
      addImageBlock(img, col, x, colHeights[col], h)
      colHeights[col] = colHeights[col] + h + GAP + (img.caption ? 14 : 0)
      imgIdx++
    }

    // Se rimangono immagini per questo tag, sovrappagina
    if (imgIdx < imgs.length) {
      const remaining = imgs.slice(imgIdx)
      // Sposta tutto su nuova pagina con stesso layout — semplificato: aggiungo nuova pagina e richiamo logica
      doc.addPage()
      paperBg()
      pageStripes()
      doc.setFontSize(10); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
      doc.text(safeText(brandName), M, 48)
      doc.setFontSize(8); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
      doc.text(`${title} · ${TAG_LABELS[tag] ?? tag} (continua)`, W - M, 48, { align: 'right' })

      let yy = 100
      const ch = [yy, yy, yy]
      for (const img of remaining) {
        let minH = Math.min(...ch)
        let col = ch.indexOf(minH)
        if (minH > H - 80) break
        const aspect = [1.25, 1.33, 1.0, 1.5][remaining.indexOf(img) % 4]
        const h = Math.round(colW * aspect)
        const x = M + col * (colW + GAP)
        addImageBlock(img, col, x, ch[col], h)
        ch[col] = ch[col] + h + GAP + (img.caption ? 14 : 0)
      }
    }
  }

  // ╔════ Final page — palette + signature ════════════════╗
  doc.addPage()
  paperBg()
  pageStripes()

  doc.setFontSize(10); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  doc.text(safeText(brandName), M, 48)

  let y = 140
  doc.setFontSize(10); doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'normal')
  doc.text('P A L E T T E   E   T O N I', M, y, { charSpace: 2.5 })
  y += 12
  doc.setFontSize(28); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  doc.text('I colori del giorno', M, y + 22)
  y += 60

  // 5 swatch — palette pseudo dal brand WP + complementari
  const swatches: [number[], string][] = [
    [PRIMARY as any, 'Profondo'],
    [ACCENT as any, 'Oro'],
    [[200, 190, 175], 'Sabbia'],
    [[230, 222, 210], 'Cipria'],
    [[140, 138, 128], 'Salvia'],
  ]
  const sw = (CONTENT_W - 16 * 4) / 5
  for (let i = 0; i < swatches.length; i++) {
    const [c, name] = swatches[i]
    const x = M + i * (sw + 16)
    doc.setFillColor(c[0], c[1], c[2])
    doc.roundedRect(x, y, sw, sw, 4, 4, 'F')
    doc.setFontSize(9); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(name, x, y + sw + 18)
    const hex = '#' + c.map((v: number) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
    doc.setFontSize(7); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
    doc.text(hex, x, y + sw + 30)
  }
  y += sw + 70

  // Closing quote
  doc.setFontSize(11); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'italic')
  const quote = '"Ogni matrimonio è una storia unica. Queste pagine sono il primo capitolo della vostra."'
  const qLines = doc.splitTextToSize(quote, CONTENT_W - 40)
  for (const l of qLines) { doc.text(l, W / 2, y, { align: 'center' }); y += 16 }
  y += 16

  // Signature
  ornament(y + 4); y += 28
  doc.setFontSize(9); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
  doc.text('C O N   A F F E T T O   D A', W / 2, y, { align: 'center', charSpace: 2 })
  y += 22
  doc.setFontSize(20); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  doc.text(safeText(brandName), W / 2, y, { align: 'center' })
  y += 22
  doc.setFontSize(10); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
  const contact = [ownerEmail, owner?.phone, owner?.city].filter(Boolean).join('  ·  ')
  if (contact) doc.text(contact, W / 2, y, { align: 'center' })

  // Upload
  const pdfBytes = new Uint8Array(doc.output('arraybuffer'))
  const key = `moodboard/${entry.id}/v${Date.now()}.pdf`
  const up = await admin.storage.from('quote-pdfs').upload(key, pdfBytes, {
    contentType: 'application/pdf', upsert: false,
  })
  if (up.error) return json({ error: 'upload failed', detail: up.error.message }, 500)

  const signed = await admin.storage.from('quote-pdfs').createSignedUrl(key, 60 * 60 * 24 * 30)
  if (signed.error) return json({ error: 'signed url failed', detail: signed.error.message }, 500)

  return json({ ok: true, url: signed.data.signedUrl, count: images.length })
})
