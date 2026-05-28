// deno-lint-ignore-file no-explicit-any
// Moodboard PDF editoriale magazine-style.
// Cover hero + capitoli "racconto" per tag con narrazione + masonry 4-col dense.
// Idempotente: ogni call genera key univoco con timestamp+random.

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

// Catalogo capitoli — testi narrativi (editorial / wedding manual)
type Chapter = { label: string; eyebrow: string; title: string; intro: string; closing: string }

const CHAPTERS: Record<string, Chapter> = {
  vestito: {
    label: 'Abito',
    eyebrow: 'C A P I T O L O   U N O',
    title: 'L\'abito che racconta chi sei',
    intro: 'Più di una scelta estetica: l\'abito è la prima cosa che gli ospiti vedono e l\'ultima che la sposa dimenticherà. Ogni linea ha un significato — sirena per chi sceglie sicurezza, principessa per chi sogna fiabe, slip dress per chi cerca ricerca contemporanea.',
    closing: 'Un abito sceglie te, non il contrario.',
  },
  abito: {
    label: 'Abito',
    eyebrow: 'C A P I T O L O   U N O',
    title: 'L\'abito che racconta chi sei',
    intro: 'Più di una scelta estetica: l\'abito è la prima cosa che gli ospiti vedono e l\'ultima che la sposa dimenticherà. Ogni linea ha un significato.',
    closing: 'Un abito sceglie te, non il contrario.',
  },
  fiori: {
    label: 'Fiori & botanica',
    eyebrow: 'C A P I T O L O   D U E',
    title: 'Una sinfonia botanica',
    intro: 'Il fiore non è decorazione: è atmosfera. Stagionalità, palette, formato delle composizioni — tutto contribuisce a quel "wow" silenzioso quando gli ospiti entrano. Dalla peonia primaverile alla protea autunnale, ogni stelo è una scelta.',
    closing: 'I fiori parlano una lingua che tutti capiscono.',
  },
  bouquet: {
    label: 'Bouquet',
    eyebrow: 'D E T T A G L I O',
    title: 'Tra le mani della sposa',
    intro: 'Il bouquet è il dettaglio più fotografato del matrimonio. Tondo classico, cascata romantica, naked stem moderno — la forma riflette lo stile dell\'abito e il temperamento di chi lo porta.',
    closing: 'Un piccolo giardino tutto tuo.',
  },
  location: {
    label: 'Location',
    eyebrow: 'C A P I T O L O   T R E',
    title: 'Il palcoscenico del vostro sì',
    intro: 'La location dà il tono. Villa con vista mare, palazzo storico in città, agriturismo nelle colline — ogni spazio racconta una storia diversa. La scelta della cornice influenza il dress code, lo stile floreale, persino il menu.',
    closing: 'Lo spazio che vi ospita diventa parte della vostra storia.',
  },
  torta: {
    label: 'Wedding cake',
    eyebrow: 'C A P I T O L O   Q U A T T R O',
    title: 'Dolce architettura',
    intro: 'La torta nuziale è scultura commestibile. Naked cake rustic, drip cake contemporanea, classica a tre piani con fiori freschi. Il momento del taglio è uno dei più attesi e fotografati della giornata.',
    closing: 'Un brindisi addolcito.',
  },
  allestimento: {
    label: 'Allestimenti',
    eyebrow: 'C A P I T O L O   C I N Q U E',
    title: 'Atmosfere e dettagli',
    intro: 'Sedie Chiavarine o Tiffany, tovagliato lino o velluto, candele e lighting design — sono le piccole scelte invisibili che fanno la differenza tra "bello" e "indimenticabile". Ogni elemento è coerente con il mood complessivo.',
    closing: 'I dettagli sono l\'arma segreta.',
  },
  trucco: {
    label: 'Beauty',
    eyebrow: 'D E T T A G L I O',
    title: 'Bellezza che resta',
    intro: 'Make-up natural radiance per look nude, smoky elegante per cerimonie serali. La beauty è la cura che la sposa dedica a sé stessa nel mattino più importante. Prova prima, sempre.',
    closing: 'Sei radiosa perché sei felice.',
  },
  altro: {
    label: 'Dettagli',
    eyebrow: 'I N S P I R A Z I O N I',
    title: 'I dettagli che fanno la differenza',
    intro: 'Bomboniere, segnaposto, photo corner, libro degli ospiti, scelte sonore — le rifiniture che gli ospiti notano e ricordano.',
    closing: 'Tutto è racconto.',
  },
}

const CHAPTER_ORDER = ['vestito', 'abito', 'bouquet', 'fiori', 'allestimento', 'location', 'torta', 'trucco', 'altro']

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

  // Palette scelta dalla coppia (couple_preferences.preferred_palette)
  const { data: prefs } = await admin
    .from('couple_preferences')
    .select('preferred_palette')
    .eq('entry_id', body.entry_id)
    .maybeSingle()
  const couplePalette: string[] = Array.isArray(prefs?.preferred_palette)
    ? (prefs!.preferred_palette as string[]).filter((c) => /^#?[0-9a-fA-F]{6}$/.test(c))
    : []
  const NAME_BY_HEX: Record<string, string> = {
    '#f3eee4': 'Paper', '#fbf5e9': 'Crema', '#f5ebe0': 'Avorio', '#f4f1ea': 'Sabbia',
    '#e8d9b3': 'Vaniglia', '#c49a5c': 'Oro', '#1a1714': 'Inchiostro', '#8a9a7b': 'Salvia',
  }
  function nameForHex(hex: string): string {
    const k = hex.toLowerCase().startsWith('#') ? hex.toLowerCase() : '#' + hex.toLowerCase()
    return NAME_BY_HEX[k] ?? k.toUpperCase().replace('#', '')
  }

  // Palette principale del PDF: priorità alla scelta della coppia,
  // poi brand WP, infine default Planfully.
  const PRIMARY = couplePalette.length >= 2
    ? hexToRgb(couplePalette[couplePalette.length - 1]!, [26, 46, 79])
    : hexToRgb(isPremium ? owner?.brand_primary_color : '#1A2E4F', [26, 46, 79])
  const ACCENT = couplePalette.length >= 1
    ? hexToRgb(couplePalette[Math.min(2, couplePalette.length - 1)]!, [196, 154, 92])
    : hexToRgb(isPremium ? owner?.brand_secondary_color : '#C49A5C', [196, 154, 92])
  const INK = [26, 23, 20] as [number, number, number]
  const MUTED = [120, 113, 100] as [number, number, number]
  const SUBTLE = [165, 156, 142] as [number, number, number]
  const PAPER = [253, 251, 246] as [number, number, number]

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 36                // margine più stretto per dare spazio
  const CONTENT_W = W - M * 2

  // Logo
  let logoImg: { data: Uint8Array; format: 'PNG' | 'JPEG' } | null = null
  if (isPremium && owner?.brand_logo_url) logoImg = await fetchImage(owner.brand_logo_url)

  const brandName = isPremium && owner?.business_name ? owner.business_name : (owner?.full_name ?? 'Planfully')
  const title = safeText(entry.title || 'Matrimonio')

  // ── Helpers stile ─────────────────────────────────────────
  function paperBg() {
    doc.setFillColor(...PAPER); doc.rect(0, 0, W, H, 'F')
  }

  function topBottomStripes() {
    doc.setFillColor(...ACCENT); doc.rect(0, 0, W, 3, 'F')
    doc.setFillColor(...ACCENT); doc.rect(0, H - 3, W, 3, 'F')
  }

  function ornament(cx: number, yPos: number, width = 80) {
    doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6)
    doc.line(cx - width / 2, yPos, cx - 5, yPos)
    doc.line(cx + 5, yPos, cx + width / 2, yPos)
    doc.setFillColor(...ACCENT)
    doc.circle(cx, yPos, 1.5, 'F')
  }

  function miniHeader(chapterLabel?: string) {
    const _cx = W / 2
    if (logoImg) {
      try { doc.addImage(logoImg.data, logoImg.format, _cx - 10, 14, 20, 20, undefined, 'FAST') } catch {}
    }
    const brandY = logoImg ? 44 : 30
    doc.setFontSize(9); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(safeText(brandName), _cx, brandY, { align: 'center' })
    if (chapterLabel) {
      doc.setFontSize(7); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
      doc.text(
        `${safeText(title).slice(0, 30).toUpperCase()} · ${chapterLabel.toUpperCase()}`,
        _cx, brandY + 12, { align: 'center', charSpace: 1.2 }
      )
    }
  }

  function pageFooter(pageNum: number, totalPages: number, chapterLabel?: string) {
    doc.setFontSize(8); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
    const left = chapterLabel ?? safeText(brandName)
    doc.text(`${left} · ${pageNum} / ${totalPages}`, W / 2, H - 18, { align: 'center' })
  }

  // ╔════ COVER ═══════════════════════════════════════════╗
  paperBg(); topBottomStripes()

  // Brand top — centrato
  const _coverCx = W / 2
  if (logoImg) {
    try { doc.addImage(logoImg.data, logoImg.format, _coverCx - 16, 22, 32, 32, undefined, 'FAST') } catch {}
    doc.setFontSize(11); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(safeText(brandName), _coverCx, 68, { align: 'center' })
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    doc.text(safeText(owner?.city ?? 'Wedding planner'), _coverCx, 80, { align: 'center' })
  } else {
    doc.setFontSize(12); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(safeText(brandName), _coverCx, 36, { align: 'center' })
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    doc.text(safeText(owner?.city ?? 'Wedding planner'), _coverCx, 48, { align: 'center' })
  }

  doc.setFontSize(8); doc.setTextColor(...SUBTLE)
  const coverMeta = `${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })} · ${images.length} ispirazioni curate`
  doc.text(coverMeta, _coverCx, logoImg ? 92 : 60, { align: 'center', charSpace: 0.5 })

  // Hero centrato verticalmente
  const heroCy = H / 2 - 20
  const cx = W / 2

  doc.setFontSize(10); doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'normal')
  doc.text('M O O D B O A R D', cx, heroCy - 96, { align: 'center', charSpace: 4 })

  ornament(cx, heroCy - 76, 90)

  // Title - sposi names XL centered
  doc.setFontSize(46); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  const titleLines = doc.splitTextToSize(title, CONTENT_W - 40)
  let titleY = heroCy - 30
  for (const line of titleLines) {
    doc.text(line, cx, titleY, { align: 'center' })
    titleY += 50
  }

  if (entry.date_from) {
    doc.setFontSize(13); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'italic')
    try {
      const dt = new Date(entry.date_from).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
      doc.text(dt, cx, titleY + 4, { align: 'center' })
    } catch {}
  }

  ornament(cx, titleY + 36, 90)

  doc.setFontSize(11); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'italic')
  const subtitle = 'Un viaggio visivo attraverso le scelte che renderanno unico\nil vostro giorno più importante.'
  const subLines = subtitle.split('\n')
  let subY = titleY + 70
  for (const l of subLines) { doc.text(l, cx, subY, { align: 'center' }); subY += 16 }

  // Cover bottom signature
  doc.setFontSize(9); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
  doc.text('C U R A T A   D A', cx, H - 92, { align: 'center', charSpace: 3 })
  doc.setFontSize(14); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  doc.text(safeText(brandName), cx, H - 72, { align: 'center' })
  if (owner?.city) {
    doc.setFontSize(9); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'italic')
    doc.text(safeText(owner.city), cx, H - 56, { align: 'center' })
  }

  // ╔════ Group by tag ═══════════════════════════════════╗
  const byTag = new Map<string, any[]>()
  for (const img of images) {
    const t = img.tag ?? 'altro'
    if (!byTag.has(t)) byTag.set(t, [])
    byTag.get(t)!.push(img)
  }

  // Pre-fetch in parallelo
  const allFetched: Record<string, { data: Uint8Array; format: 'PNG' | 'JPEG' } | null> = {}
  const concurrent = 10
  for (let i = 0; i < images.length; i += concurrent) {
    const batch = images.slice(i, i + concurrent)
    const settled = await Promise.all(batch.map((it) => fetchImage(it.url).then(r => ({ id: it.id, r }))))
    for (const { id, r } of settled) allFetched[id] = r
  }

  // Ordine capitoli: prima i tag in CHAPTER_ORDER, poi gli altri alfabetici
  const sortedTags = Array.from(byTag.keys()).sort((a, b) => {
    const ai = CHAPTER_ORDER.indexOf(a)
    const bi = CHAPTER_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  // ╔════ CHAPTERS ═══════════════════════════════════════╗
  // Strategia: pagina prima del capitolo è "title page" con narrazione editorial.
  // Poi pagine grid 4-col dense fino a esaurimento immagini.

  const GAP = 6
  const COLS = 4
  const colW = (CONTENT_W - GAP * (COLS - 1)) / COLS

  function gridPage(chapter: Chapter, imgs: any[], imgIdx: number): number {
    // imgIdx = puntatore corrente nella lista imgs. Ritorna nuovo puntatore.
    doc.addPage(); paperBg(); topBottomStripes()
    miniHeader(chapter.label)

    const startY = 64
    const bottomLimit = H - 50
    const colHeights = new Array(COLS).fill(startY)

    while (imgIdx < imgs.length) {
      const img = imgs[imgIdx]
      const fetched = allFetched[img.id]

      // Aspect ratio REALE dell'immagine (altezza / larghezza). Fallback su
      // un mix masonry se non leggibile. Clamp per evitare foto eccessivamente
      // lunghe che spaccano la composizione (max 1.8 verticale, min 0.6 land).
      let aspectHW = 1.1
      if (fetched) {
        try {
          const props = (doc as any).getImageProperties(fetched.data)
          if (props?.width && props?.height) {
            aspectHW = props.height / props.width
          }
        } catch {
          // fallback
          const fallbacks = [1.0, 1.2, 1.33, 0.85, 1.1]
          aspectHW = fallbacks[imgIdx % fallbacks.length]
        }
      }
      aspectHW = Math.max(0.6, Math.min(1.8, aspectHW))

      const h = Math.round(colW * aspectHW)
      const captionH = img.caption ? 14 : 0
      const totalH = h + GAP + captionH

      // Trova colonna più corta
      let minH = Math.min(...colHeights)
      let col = colHeights.indexOf(minH)

      // Se la più corta è già oltre il limite di pagina, esci (continua next page)
      if (colHeights[col] + totalH > bottomLimit) break

      const x = M + col * (colW + GAP)
      const y = colHeights[col]

      // Background placeholder
      doc.setFillColor(238, 232, 222)
      doc.rect(x, y, colW, h, 'F')

      // Disegno l'immagine mantenendo le proporzioni reali (aspectHW = h/w
      // della foto reale, h = colW * aspectHW → ratio rispettato → no stretch).
      if (fetched) {
        try { doc.addImage(fetched.data, fetched.format, x, y, colW, h, undefined, 'FAST') } catch {}
      }

      if (img.caption) {
        doc.setFontSize(6.5); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'italic')
        const cap = safeText(img.caption).slice(0, 50)
        doc.text(cap, x + colW / 2, y + h + 9, { align: 'center' })
      }

      colHeights[col] = y + totalH
      imgIdx++
    }

    return imgIdx
  }

  function chapterTitlePage(chapter: Chapter, count: number) {
    doc.addPage(); paperBg(); topBottomStripes()
    miniHeader(chapter.label)

    const cy = H / 2 - 30

    doc.setFontSize(10); doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'normal')
    doc.text(chapter.eyebrow, cx, cy - 70, { align: 'center', charSpace: 3 })
    ornament(cx, cy - 50, 80)

    doc.setFontSize(36); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    const tLines = doc.splitTextToSize(chapter.title, CONTENT_W - 60)
    let ty = cy - 8
    for (const l of tLines) { doc.text(l, cx, ty, { align: 'center' }); ty += 40 }

    ornament(cx, ty + 8, 80)

    doc.setFontSize(11); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    const introLines = doc.splitTextToSize(chapter.intro, CONTENT_W - 80)
    let iy = ty + 36
    for (const l of introLines) { doc.text(l, cx, iy, { align: 'center' }); iy += 16 }

    // Bottom: closing italic
    doc.setFontSize(13); doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'italic')
    doc.text(`"${chapter.closing}"`, cx, H - 90, { align: 'center' })

    doc.setFontSize(9); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
    doc.text(`${count} ${count === 1 ? 'ispirazione' : 'ispirazioni'} a seguire`, cx, H - 64, { align: 'center', charSpace: 1.5 })
  }

  for (const tag of sortedTags) {
    const imgs = byTag.get(tag)!
    const chapter = CHAPTERS[tag] ?? {
      label: tag,
      eyebrow: 'C A P I T O L O',
      title: tag.charAt(0).toUpperCase() + tag.slice(1),
      intro: 'Una selezione di ispirazioni per questo aspetto del matrimonio.',
      closing: 'Ogni dettaglio conta.',
    }
    // Title page del capitolo
    chapterTitlePage(chapter, imgs.length)
    // Pagine grid dense
    let idx = 0
    while (idx < imgs.length) {
      const prev = idx
      idx = gridPage(chapter, imgs, idx)
      if (idx === prev) break  // safety: nessun progress
    }
  }

  // ╔════ Closing page: palette + signature ═════════════╗
  doc.addPage(); paperBg(); topBottomStripes()
  miniHeader()

  doc.setFontSize(10); doc.setTextColor(...ACCENT); doc.setFont('helvetica', 'normal')
  doc.text('E P I L O G O', cx, 110, { align: 'center', charSpace: 4 })
  ornament(cx, 128, 70)

  doc.setFontSize(36); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  doc.text('I colori del giorno', cx, 180, { align: 'center' })

  // Palette: usa quella scelta dalla coppia se disponibile, altrimenti fallback default
  const swatches: { color: number[]; name: string }[] = couplePalette.length >= 2
    ? couplePalette.slice(0, 6).map((hex) => ({
        color: hexToRgb(hex, [200, 190, 175]) as any,
        name: nameForHex(hex),
      }))
    : [
        { color: PRIMARY as any, name: 'Profondo' },
        { color: ACCENT as any, name: 'Oro' },
        { color: [200, 190, 175], name: 'Sabbia' },
        { color: [230, 222, 210], name: 'Cipria' },
        { color: [140, 138, 128], name: 'Salvia' },
      ]
  const sw = 70
  const gapSw = 16
  const totalSwW = sw * swatches.length + gapSw * (swatches.length - 1)
  const sxStart = (W - totalSwW) / 2
  const syStart = 220

  for (let i = 0; i < swatches.length; i++) {
    const { color, name } = swatches[i]
    const x = sxStart + i * (sw + gapSw)
    doc.setFillColor(color[0], color[1], color[2])
    doc.roundedRect(x, syStart, sw, sw, 4, 4, 'F')
    doc.setFontSize(9); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(name, x + sw / 2, syStart + sw + 14, { align: 'center' })
    const hex = '#' + color.map((v: number) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
    doc.setFontSize(7); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
    doc.text(hex, x + sw / 2, syStart + sw + 26, { align: 'center' })
  }

  // Quote chiusura
  const qy = syStart + sw + 80
  doc.setFontSize(13); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'italic')
  const closingQuote = '"Ogni matrimonio è una storia unica.\nQueste pagine sono il primo capitolo della vostra."'
  for (const l of closingQuote.split('\n')) {
    doc.text(l, cx, qy + closingQuote.split('\n').indexOf(l) * 18, { align: 'center' })
  }

  // Signature centered
  const sigY = qy + 80
  ornament(cx, sigY, 70)
  doc.setFontSize(9); doc.setTextColor(...SUBTLE); doc.setFont('helvetica', 'normal')
  doc.text('C O N   A F F E T T O   D A', cx, sigY + 22, { align: 'center', charSpace: 3 })
  doc.setFontSize(20); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
  doc.text(safeText(brandName), cx, sigY + 46, { align: 'center' })
  doc.setFontSize(9); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
  const contact = [ownerEmail, owner?.phone, owner?.city].filter(Boolean).join('  ·  ')
  if (contact) doc.text(contact, cx, sigY + 64, { align: 'center' })

  // ── Upload (idempotente con timestamp+random) ────────────
  const pdfBytes = new Uint8Array(doc.output('arraybuffer'))
  const rand = Math.random().toString(36).slice(2, 8)
  const key = `moodboard/${entry.id}/${Date.now()}-${rand}.pdf`
  const up = await admin.storage.from('quote-pdfs').upload(key, pdfBytes, {
    contentType: 'application/pdf', upsert: true,
  })
  if (up.error) return json({ error: 'upload failed', detail: up.error.message }, 500)

  const signed = await admin.storage.from('quote-pdfs').createSignedUrl(key, 60 * 60 * 24 * 30)
  if (signed.error) return json({ error: 'signed url failed', detail: signed.error.message }, 500)

  return json({ ok: true, url: signed.data.signedUrl, count: images.length, chapters: sortedTags.length })
})
