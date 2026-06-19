// Mood board → PDF EDITORIALE stile rivista (Vogue-like), generato LATO CLIENT con jsPDF.
// Copertina con i nomi degli sposi su foto hero, capitoli "racconto" per categoria con testo,
// griglie editoriali, palette dei colori e firma. Le immagini vengono caricate nel browser
// (crossOrigin) e ritagliate "cover" su canvas: quelle che il CDN blocca per CORS si saltano.

export type MoodPdfImg = { url: string; caption?: string | null; tag?: string | null; source?: string | null }
export type MoodPdfInput = {
  images: MoodPdfImg[]
  coupleNames?: string | null
  dateText?: string | null
  location?: string | null
  brandName?: string | null
  brandEmail?: string | null
  palette?: string[]
}

type Loaded = { img: HTMLImageElement; w: number; h: number }
type RGB = [number, number, number]

const CREAM: RGB = [253, 251, 246]
const INK: RGB = [26, 23, 20]
const GOLD: RGB = [196, 154, 92]
const MUTED: RGB = [120, 113, 100]
const SUBTLE: RGB = [165, 156, 142]

function hexToRgb(hex?: string | null, fb: RGB = INK): RGB {
  if (!hex) return fb
  const m = hex.replace('#', '').match(/^([0-9a-fA-F]{6})$/)
  if (!m) return fb
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const NAME_BY_HEX: Record<string, string> = {
  '#f3eee4': 'Paper', '#fbf5e9': 'Crema', '#f5ebe0': 'Avorio', '#f4f1ea': 'Sabbia',
  '#e8d9b3': 'Vaniglia', '#c49a5c': 'Oro', '#1a1714': 'Inchiostro', '#8a9a7b': 'Salvia',
  '#b08d57': 'Bronzo', '#d8c3a5': 'Lino', '#e6ccb2': 'Cipria',
}
const nameForHex = (hex: string) => NAME_BY_HEX[(hex.startsWith('#') ? hex : '#' + hex).toLowerCase()] ?? hex.toUpperCase().replace('#', '#')

// Catalogo capitoli: testi narrativi editoriali per categoria.
type Chapter = { label: string; eyebrow: string; title: string; intro: string; closing: string }
const CHAPTERS: Record<string, Chapter> = {
  vestito: { label: 'Abito', eyebrow: 'CAPITOLO UNO', title: "L'abito che racconta chi sei", intro: "Più di una scelta estetica: l'abito è la prima cosa che gli ospiti vedono e l'ultima che si dimentica. Ogni linea ha un significato — sirena per chi sceglie sicurezza, principessa per chi sogna le fiabe, slip dress per chi cerca una ricerca contemporanea.", closing: 'Un abito sceglie te, non il contrario.' },
  abito: { label: 'Abito', eyebrow: 'CAPITOLO UNO', title: "L'abito che racconta chi sei", intro: "L'abito è la prima cosa che gli ospiti vedono e l'ultima che si dimentica. Ogni linea ha un significato e racconta un temperamento.", closing: 'Un abito sceglie te, non il contrario.' },
  fiori: { label: 'Fiori & botanica', eyebrow: 'CAPITOLO DUE', title: 'Una sinfonia botanica', intro: "Il fiore non è decorazione: è atmosfera. Stagionalità, palette, formato delle composizioni — tutto contribuisce a quel «wow» silenzioso quando gli ospiti entrano. Dalla peonia primaverile alla protea autunnale, ogni stelo è una scelta.", closing: 'I fiori parlano una lingua che tutti capiscono.' },
  bouquet: { label: 'Bouquet', eyebrow: 'DETTAGLIO', title: 'Tra le mani della sposa', intro: "Il bouquet è il dettaglio più fotografato del matrimonio. Tondo classico, cascata romantica, naked stem moderno — la forma riflette lo stile dell'abito e il temperamento di chi lo porta.", closing: 'Un piccolo giardino tutto tuo.' },
  location: { label: 'Location', eyebrow: 'CAPITOLO TRE', title: 'Il palcoscenico del vostro sì', intro: "La location dà il tono. Villa con vista mare, palazzo storico in città, agriturismo fra le colline — ogni spazio racconta una storia diversa, e influenza il dress code, lo stile floreale, persino il menù.", closing: 'Lo spazio che vi ospita diventa parte della vostra storia.' },
  torta: { label: 'Wedding cake', eyebrow: 'CAPITOLO QUATTRO', title: 'Dolce architettura', intro: "La torta nuziale è scultura commestibile. Naked cake rustica, drip cake contemporanea, classica a piani con fiori freschi: il momento del taglio è fra i più attesi e fotografati della giornata.", closing: 'Un brindisi addolcito.' },
  allestimento: { label: 'Allestimenti', eyebrow: 'CAPITOLO CINQUE', title: 'Atmosfere e dettagli', intro: "Sedute Chiavarine o Tiffany, tovagliato in lino o velluto, candele e lighting design: sono le piccole scelte invisibili che fanno la differenza tra «bello» e «indimenticabile». Ogni elemento dialoga con il mood.", closing: "I dettagli sono l'arma segreta." },
  trucco: { label: 'Beauty', eyebrow: 'DETTAGLIO', title: 'Lo sguardo del giorno', intro: "Trucco e acconciatura non cambiano chi sei: lo mettono a fuoco. Nude luminoso o occhio definito, chignon morbido o capelli sciolti — la coerenza con l'abito e la luce della giornata è tutto.", closing: 'Sei tu, nella tua versione migliore.' },
  altro: { label: 'Ispirazioni', eyebrow: 'CAPITOLO', title: 'Dettagli & suggestioni', intro: "Una selezione di immagini che tengono insieme il racconto: piccoli spunti, colori, materie e atmosfere che danno carattere al progetto.", closing: 'Ogni dettaglio conta.' },
}
const CHAPTER_ORDER = ['vestito', 'abito', 'bouquet', 'fiori', 'allestimento', 'location', 'torta', 'trucco', 'altro']

function loadImage(url: string): Promise<Loaded | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => (img.naturalWidth ? resolve({ img, w: img.naturalWidth, h: img.naturalHeight }) : resolve(null))
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Ritaglio "cover" su canvas → dataURL JPEG. Ritorna null se l'immagine è tainted (CORS).
function coverDataUrl(l: Loaded, targetAspect: number, maxPx = 1000): string | null {
  let sw = l.w, sh = l.w / targetAspect
  if (sh > l.h) { sh = l.h; sw = l.h * targetAspect }
  const sx = (l.w - sw) / 2, sy = (l.h - sh) / 2
  const cw = Math.min(maxPx, Math.round(sw)), ch = Math.max(1, Math.round(cw / targetAspect))
  const c = document.createElement('canvas'); c.width = cw; c.height = ch
  try {
    const ctx = c.getContext('2d')!; ctx.drawImage(l.img, sx, sy, sw, sh, 0, 0, cw, ch)
    return c.toDataURL('image/jpeg', 0.85)
  } catch { return null }
}

export async function buildMoodboardPdf(input: MoodPdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const loaded = new Map<string, Loaded | null>()
  await Promise.all(input.images.map(async (m) => { loaded.set(m.url, await loadImage(m.url)) }))
  const usable = input.images.filter((m) => loaded.get(m.url))
  if (usable.length === 0) throw new Error('le immagini bloccano il salvataggio per CORS')

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  const cx = W / 2, M = 44
  const CW = W - 2 * M

  const palette = (input.palette ?? []).filter((c) => /^#?[0-9a-fA-F]{6}$/.test(c)).slice(0, 6)
  const accent: RGB = palette.length ? hexToRgb(palette[Math.min(2, palette.length - 1)], GOLD) : GOLD
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])

  const paperBg = () => { setFill(CREAM); doc.rect(0, 0, W, H, 'F') }
  // scritta centrata con letter-spacing reale (jsPDF align:center ignora charSpace)
  const spaced = (t: string, x: number, y: number, cs: number) => { const w = doc.getTextWidth(t) + cs * Math.max(0, t.length - 1); doc.text(t, x - w / 2, y, { align: 'left', charSpace: cs }) }
  const ornament = (x: number, y: number, w: number) => { setDraw(accent); doc.setLineWidth(0.7); doc.line(x - w / 2, y, x - 8, y); doc.line(x + 8, y, x + w / 2, y); setFill(accent); doc.circle(x, y, 1.6, 'F') }
  const placeCover = (m: MoodPdfImg, x: number, y: number, w: number, h: number) => {
    const l = loaded.get(m.url); if (!l) return false
    const d = coverDataUrl(l, w / h); if (!d) return false
    doc.addImage(d, 'JPEG', x, y, w, h, undefined, 'FAST'); return true
  }
  // sfumatura scura sul fondo (per leggere il testo bianco sulla cover). GState esiste a runtime.
  const gd = doc as unknown as { setGState: (g: unknown) => void; GState: new (o: { opacity: number }) => unknown }
  const gradientBottom = (h: number, max = 0.7) => {
    const steps = 26, band = h
    for (let i = 0; i < steps; i++) {
      const op = max * (i / (steps - 1))
      gd.setGState(new gd.GState({ opacity: op }))
      setFill([12, 10, 8]); doc.rect(0, H - band + (i / steps) * band, W, band / steps + 1, 'F')
    }
    gd.setGState(new gd.GState({ opacity: 1 }))
  }

  // ── COPERTINA ──────────────────────────────────────────────
  const heroPick = usable.find((m) => (m.tag ?? '') === 'location') ?? usable.find((m) => (m.tag ?? '') === 'fiori') ?? usable[0]!
  if (!placeCover(heroPick, 0, 0, W, H)) { paperBg() }
  gradientBottom(H * 0.6, 0.72)
  // cornice sottile
  setDraw([255, 255, 255]); doc.setLineWidth(0.8); doc.rect(18, 18, W - 36, H - 36)
  // masthead
  setText([255, 255, 255]); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  spaced('THE WEDDING MOOD', cx, 56, 4)
  // nomi sposi
  doc.setFont('times', 'normal'); doc.setFontSize(46); setText([255, 255, 255])
  const names = (input.coupleNames || 'Gli Sposi').trim()
  const nameLines = doc.splitTextToSize(names, CW)
  let ny = H - 168 - (nameLines.length - 1) * 24
  for (const ln of nameLines) { doc.text(ln, cx, ny, { align: 'center' }); ny += 50 }
  ornament(cx, ny - 18, 90)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); setText([245, 240, 232])
  const sub = [input.dateText, input.location].filter(Boolean).join('   ·   ')
  if (sub) spaced(sub.toUpperCase(), cx, ny + 6, 2)
  if (input.brandName) { doc.setFontSize(8.5); setText([225, 218, 208]); spaced('A CURA DI ' + input.brandName.toUpperCase(), cx, H - 40, 2) }

  // ── INTRO EDITORIALE ───────────────────────────────────────
  doc.addPage(); paperBg()
  setText(accent); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); spaced("L'EDITORIALE", cx, 110, 4); ornament(cx, 128, 70)
  setText(INK); doc.setFont('times', 'normal'); doc.setFontSize(34)
  for (const [i, ln] of (doc.splitTextToSize('Il mood del vostro giorno', CW - 40) as string[]).entries()) doc.text(ln, cx, 176 + i * 38, { align: 'center' })
  setText(MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5)
  const intro = 'Queste pagine raccolgono la visione del matrimonio: l\'atmosfera, i colori, i materiali e i dettagli che, messi insieme, diventano un\'unica storia coerente. Non un catalogo, ma un racconto — il primo capitolo del vostro giorno.'
  let iy = 232
  for (const ln of doc.splitTextToSize(intro, CW - 70) as string[]) { doc.text(ln, cx, iy, { align: 'center' }); iy += 17 }
  // palette strip
  if (palette.length) {
    setText(accent); doc.setFontSize(9); spaced('LA PALETTE', cx, iy + 30, 3)
    const sw = 54, gap = 14, tot = sw * palette.length + gap * (palette.length - 1), sx0 = (W - tot) / 2, sy0 = iy + 48
    palette.forEach((hex, i) => {
      const x = sx0 + i * (sw + gap), c = hexToRgb(hex, [200, 190, 175])
      setFill(c); doc.roundedRect(x, sy0, sw, sw, 4, 4, 'F')
      setText(INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); const nm = nameForHex(hex); const nw = doc.getTextWidth(nm); doc.text(nm, x + sw / 2 - nw / 2, sy0 + sw + 14)
    })
  }

  // ── CAPITOLI PER CATEGORIA ─────────────────────────────────
  const byTag = new Map<string, MoodPdfImg[]>()
  for (const m of usable) { const t = (m.tag ?? 'altro').toLowerCase(); (byTag.get(t) ?? byTag.set(t, []).get(t)!).push(m) }
  const tags = [...byTag.keys()].sort((a, b) => { const ia = CHAPTER_ORDER.indexOf(a), ib = CHAPTER_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) })

  const miniHeader = (label?: string) => { setText(SUBTLE); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); spaced('MOOD BOARD', M + 30, 34, 2); if (label) { const t = label.toUpperCase(); doc.text(t, W - M - doc.getTextWidth(t), 34) }; setDraw([230, 224, 214]); doc.setLineWidth(0.5); doc.line(M, 44, W - M, 44) }

  for (const tag of tags) {
    const imgs = byTag.get(tag)!
    const ch = CHAPTERS[tag] ?? { ...CHAPTERS.altro!, label: tag, title: tag.charAt(0).toUpperCase() + tag.slice(1) }
    // pagina-titolo capitolo
    doc.addPage(); paperBg(); miniHeader(ch.label)
    const cyT = H / 2 - 40
    setText(accent); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); spaced(ch.eyebrow, cx, cyT - 64, 3); ornament(cx, cyT - 46, 80)
    setText(INK); doc.setFont('times', 'normal'); doc.setFontSize(34)
    let ty = cyT - 6; for (const ln of doc.splitTextToSize(ch.title, CW - 50) as string[]) { doc.text(ln, cx, ty, { align: 'center' }); ty += 38 }
    ornament(cx, ty + 6, 80)
    setText(MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
    let jy = ty + 34; for (const ln of doc.splitTextToSize(ch.intro, CW - 80) as string[]) { doc.text(ln, cx, jy, { align: 'center' }); jy += 16 }
    setText(accent); doc.setFont('times', 'italic'); doc.setFontSize(13); doc.text('"' + ch.closing + '"', cx, H - 86, { align: 'center' })
    setText(SUBTLE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); spaced(`${imgs.length} ${imgs.length === 1 ? 'ISPIRAZIONE' : 'ISPIRAZIONI'} A SEGUIRE`, cx, H - 62, 1.5)

    // griglie editoriali: prima foto grande, poi righe da 2; ultima pagina caption
    let i = 0
    while (i < imgs.length) {
      doc.addPage(); paperBg(); miniHeader(ch.label)
      let y = 60
      const g = 12
      // hero della pagina
      if ((i === 0 || (imgs.length - i) >= 3) && i < imgs.length) {
        const hw = CW, hh = 250
        if (placeCover(imgs[i]!, M, y, hw, hh)) {
          const cap = (imgs[i]!.caption ?? '').trim()
          if (cap) { setText(MUTED); doc.setFont('times', 'italic'); doc.setFontSize(9.5); doc.text(cap.slice(0, 80), M, y + hh + 13) }
          y += hh + 26; i++
        }
      }
      // righe da 2
      while (i < imgs.length && y < H - 150) {
        const remaining = imgs.length - i
        const cols = remaining === 1 ? 1 : 2
        const cw = (CW - g * (cols - 1)) / cols, chh = 168
        for (let k = 0; k < cols && i < imgs.length; k++) {
          const x = M + k * (cw + g)
          if (placeCover(imgs[i]!, x, y, cw, chh)) {
            const cap = (imgs[i]!.caption ?? '').trim()
            if (cap) { setText(MUTED); doc.setFont('times', 'italic'); doc.setFontSize(8.5); doc.text(cap.slice(0, 46), x, y + chh + 11) }
          }
          i++
        }
        y += chh + 24
      }
    }
  }

  // ── EPILOGO: colori del giorno + firma ─────────────────────
  doc.addPage(); paperBg(); miniHeader()
  setText(accent); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); spaced('EPILOGO', cx, 110, 4); ornament(cx, 128, 70)
  setText(INK); doc.setFont('times', 'normal'); doc.setFontSize(32); doc.text('I colori del giorno', cx, 178, { align: 'center' })
  const epPal = palette.length ? palette : ['#1a1714', '#c49a5c', '#d8c3a5', '#e6ccb2', '#8a9a7b']
  const sw = 66, gap = 16, tot = sw * epPal.length + gap * (epPal.length - 1), sx0 = (W - tot) / 2, sy0 = 214
  epPal.forEach((hex, i) => {
    const x = sx0 + i * (sw + gap), c = hexToRgb(hex, [200, 190, 175])
    setFill(c); doc.roundedRect(x, sy0, sw, sw, 4, 4, 'F')
    const nm = nameForHex(hex); setText(INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(nm, x + sw / 2 - doc.getTextWidth(nm) / 2, sy0 + sw + 14)
    const hx = (hex.startsWith('#') ? hex : '#' + hex).toUpperCase(); setText(SUBTLE); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(hx, x + sw / 2 - doc.getTextWidth(hx) / 2, sy0 + sw + 25)
  })
  const qy = sy0 + sw + 86
  setText(MUTED); doc.setFont('times', 'italic'); doc.setFontSize(13)
  for (const [i, ln] of ['"Ogni matrimonio è una storia unica.', 'Queste pagine sono il primo capitolo della vostra."'].entries()) doc.text(ln, cx, qy + i * 18, { align: 'center' })
  ornament(cx, qy + 64, 70)
  setText(SUBTLE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); spaced('CON AFFETTO DA', cx, qy + 86, 3)
  setText(INK); doc.setFont('times', 'normal'); doc.setFontSize(20); doc.text((input.brandName || 'Planfully'), cx, qy + 110, { align: 'center' })
  const contact = [input.brandEmail, input.location].filter(Boolean).join('   ·   ')
  if (contact) { setText(MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(contact, cx, qy + 128, { align: 'center' }) }

  doc.save('moodboard.pdf')
}
