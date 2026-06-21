// Printable dell'evento in stile TABLEAU MARIAGE (carta avorio, inchiostro, oro, serif Times):
//  · segnaposto (place card) — tanti nomi su A4, ritagliabili, 2 stili (cartoncino / tenda)
//  · cavalieri per tavolo — tenda autoportante con nome tavolo + invitati
//  · menu (per la location) — scheda elegante col logo della location
// Tutto testo disegnato in jsPDF (niente raster): la rotazione delle facce usa { angle: 180 }.
import { attendingGuests, guestsByTable, chunk, tableName, guestTableLabel, type PGuest, type PTable } from './eventPrintShared'

type RGB = [number, number, number]
const PAPER: RGB = [253, 251, 246]
const INK: RGB = [26, 23, 20]
const GOLD: RGB = [196, 154, 92]
const MUTED: RGB = [95, 87, 76]

type Doc = import('jspdf').jsPDF
const setFill = (d: Doc, c: RGB) => d.setFillColor(c[0], c[1], c[2])
const setText = (d: Doc, c: RGB) => d.setTextColor(c[0], c[1], c[2])
const setDraw = (d: Doc, c: RGB) => d.setDrawColor(c[0], c[1], c[2])

// riduce la dimensione finché il testo entra in maxW
function fitSize(d: Doc, text: string, maxW: number, base: number, min = 7): number {
  let s = base
  d.setFontSize(s)
  while (s > min && d.getTextWidth(text) > maxW) { s -= 0.5; d.setFontSize(s) }
  return s
}
// scritta centrata con letter-spacing reale
function spaced(d: Doc, t: string, x: number, y: number, cs: number) {
  const w = d.getTextWidth(t) + cs * Math.max(0, t.length - 1)
  d.text(t, x - w / 2, y, { align: 'left', charSpace: cs })
}

async function loadLogoPng(url?: string | null): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null
  try {
    const im = new Image(); im.crossOrigin = 'anonymous'
    await new Promise<void>((res, rej) => { im.onload = () => res(); im.onerror = () => rej(new Error('logo')); im.src = url })
    const w = im.naturalWidth || 1, h = im.naturalHeight || 1
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(im, 0, 0)
    return { data: c.toDataURL('image/png'), w, h }
  } catch { return null }
}

// ── SEGNAPOSTO ──────────────────────────────────────────────────────────────
export async function exportPlaceCards(guests: PGuest[], tables: PTable[], opts: { style?: 'card' | 'tent' } = {}) {
  const att = attendingGuests(guests)
  if (att.length === 0) throw new Error('Nessun invitato da stampare')
  const { jsPDF } = await import('jspdf')
  const d = new jsPDF({ unit: 'mm', format: 'a4' })
  const style = opts.style ?? 'card'
  const items = att.map((g) => ({ name: g.full_name.trim(), table: guestTableLabel(g, tables) }))

  if (style === 'card') {
    const M = 10, cols = 2, rows = 5, gap = 6
    const cw = (210 - 2 * M - (cols - 1) * gap) / cols  // ~92
    const ch = (297 - 2 * M - (rows - 1) * gap) / rows   // ~51
    const pages = chunk(items, cols * rows)
    pages.forEach((page, pi) => {
      if (pi > 0) d.addPage()
      page.forEach((it, i) => {
        const c = i % cols, r = Math.floor(i / cols)
        const x = M + c * (cw + gap), y = M + r * (ch + gap)
        setFill(d, PAPER); d.rect(x, y, cw, ch, 'F')
        setDraw(d, [225, 220, 208]); d.setLineWidth(0.2); d.rect(x, y, cw, ch)
        const cx = x + cw / 2
        setText(d, INK); d.setFont('times', 'normal')
        const s = fitSize(d, it.name, cw - 12, 22)
        d.text(it.name, cx, y + ch / 2 - (it.table ? 1 : -2), { align: 'center' })
        setDraw(d, GOLD); d.setLineWidth(0.4); d.line(cx - 9, y + ch / 2 + 4, cx + 9, y + ch / 2 + 4)
        if (it.table) { setText(d, GOLD); d.setFont('helvetica', 'normal'); d.setFontSize(8); spaced(d, it.table.toUpperCase(), cx, y + ch / 2 + 11, 1.2) }
        void s
      })
    })
  } else {
    // TENDA: ogni cella = due facce (sopra ruotata 180) con piega centrale → segnaposto a tendina
    const M = 10, cols = 2, rows = 4, gap = 7
    const cw = (210 - 2 * M - (cols - 1) * gap) / cols   // ~92
    const th = (297 - 2 * M - (rows - 1) * gap) / rows    // ~64 (tenda intera)
    const fh = th / 2                                     // faccia
    const pages = chunk(items, cols * rows)
    pages.forEach((page, pi) => {
      if (pi > 0) d.addPage()
      page.forEach((it, i) => {
        const c = i % cols, r = Math.floor(i / cols)
        const x = M + c * (cw + gap), y = M + r * (th + gap)
        const cx = x + cw / 2
        setFill(d, PAPER); d.rect(x, y, cw, th, 'F')
        // faccia alta (ruotata 180): centro a y+fh/2
        drawNameFace(d, cx, y + fh / 2, cw, it.name, it.table, true)
        // faccia bassa (dritta)
        drawNameFace(d, cx, y + fh + fh / 2, cw, it.name, it.table, false)
        // bordo taglio + piega
        setDraw(d, [225, 220, 208]); d.setLineWidth(0.2); d.rect(x, y, cw, th)
        setDraw(d, GOLD); d.setLineWidth(0.3); d.setLineDashPattern([1.4, 1.1], 0); d.line(x, y + fh, x + cw, y + fh); d.setLineDashPattern([], 0)
      })
    })
  }
  d.save(`segnaposto-${style}.pdf`)
}

function drawNameFace(d: Doc, cx: number, cy: number, cw: number, name: string, table: string, rotated: boolean) {
  const dir = rotated ? -1 : 1
  const ang = rotated ? 180 : 0
  setText(d, INK); d.setFont('times', 'normal')
  fitSize(d, name, cw - 14, 18)
  d.text(name, cx, cy - dir * 2, { align: 'center', angle: ang })
  setDraw(d, GOLD); d.setLineWidth(0.35); d.line(cx - 8, cy + dir * 3, cx + 8, cy + dir * 3)
  if (table) { setText(d, GOLD); d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.text(table.toUpperCase(), cx, cy + dir * 8, { align: 'center', angle: ang }) }
}

// ── CAVALIERI PER TAVOLO (autoportanti, stile tableau) ───────────────────────
export async function exportTableSigns(tables: PTable[], guests: PGuest[], opts: { coupleNames?: string; dateText?: string } = {}) {
  const groups = guestsByTable(guests, tables).filter((g) => g.table) // solo tavoli reali
  if (groups.length === 0) throw new Error('Nessun tavolo con invitati')
  const { jsPDF } = await import('jspdf')
  const d = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 150, H = 100, BASE = 50, TABH = 10, LIP = 12
  const x0 = (210 - W) / 2, x1 = x0 + W, cx = (x0 + x1) / 2
  const yTop = 18, yApex = yTop + H, yBaseFold = yApex + H, yBaseEnd = yBaseFold + BASE, yTabEnd = yBaseEnd + TABH
  const tabHalf = 22, slitHalf = 24

  groups.forEach((g, gi) => {
    if (gi > 0) d.addPage()
    const tname = tableName(g.table!)
    const names = g.guests.map((x) => x.full_name.trim())
    drawTableFace(d, x0, yTop + LIP, W, H - LIP, tname, names, opts, true)   // faccia A (ruotata)
    drawTableFace(d, x0, yApex, W, H - LIP, tname, names, opts, false)       // faccia B (dritta)
    // base
    setText(d, [150, 140, 125]); d.setFont('helvetica', 'normal'); d.setFontSize(9)
    d.text('BASE — piega e infila la linguetta nella fessura in cima', cx, yBaseFold + BASE / 2, { align: 'center' })
    // contorno + linguetta
    setDraw(d, [120, 120, 120]); d.setLineWidth(0.3); d.setLineDashPattern([], 0)
    const cut: Array<[number, number]> = [[x0, yTop], [x1, yTop], [x1, yBaseEnd], [cx + tabHalf, yBaseEnd], [cx + tabHalf, yTabEnd], [cx - tabHalf, yTabEnd], [cx - tabHalf, yBaseEnd], [x0, yBaseEnd], [x0, yTop]]
    for (let i = 0; i < cut.length - 1; i++) d.line(cut[i]![0], cut[i]![1], cut[i + 1]![0], cut[i + 1]![1])
    // fessura nella fascia bianca
    setText(d, [150, 150, 150]); d.setFont('helvetica', 'normal'); d.setFontSize(7); d.text('fessura (taglia)', cx, yTop + 4, { align: 'center' })
    d.setLineWidth(0.5); d.line(cx - slitHalf, yTop + 6.5, cx + slitHalf, yTop + 6.5)
    // pieghe
    setDraw(d, GOLD); d.setLineWidth(0.3); d.setLineDashPattern([1.6, 1.2], 0)
    d.line(x0, yApex, x1, yApex); d.line(x0, yBaseFold, x1, yBaseFold); d.line(cx - tabHalf, yBaseEnd, cx + tabHalf, yBaseEnd)
    d.setLineDashPattern([], 0)
  })
  d.save('cavalieri-tavolo.pdf')
}

function drawTableFace(d: Doc, x: number, y: number, w: number, h: number, tname: string, names: string[], opts: { coupleNames?: string; dateText?: string }, rotated: boolean) {
  setFill(d, PAPER); d.rect(x, y, w, h, 'F')
  // Per la faccia ruotata disegniamo in un sistema "capovolto" calcolando da sé gli y mirror.
  const cx = x + w / 2
  const top = (yy: number) => (rotated ? y + h - (yy - y) : yy) // specchia verticalmente
  const ang = rotated ? 180 : 0
  // header coppia (piccolo)
  const head = [opts.coupleNames?.trim(), opts.dateText?.trim()].filter(Boolean).join(' · ')
  if (head) { setText(d, MUTED); d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.text(head.toUpperCase(), cx, top(y + 9), { align: 'center', angle: ang }) }
  // nome tavolo
  setText(d, INK); d.setFont('times', 'normal'); fitSize(d, tname, w - 20, 26)
  d.text(tname, cx, top(y + 22), { align: 'center', angle: ang })
  setDraw(d, GOLD); d.setLineWidth(0.5); const ry = top(y + 27); d.line(cx - 14, ry, cx + 14, ry)
  // invitati (due colonne se tanti)
  setText(d, INK); d.setFont('helvetica', 'normal')
  const fs = names.length > 8 ? 9 : 11; d.setFontSize(fs)
  const startY = y + 33, lineH = fs * 0.52
  const twoCol = names.length > 6
  if (!twoCol) {
    names.forEach((n, i) => d.text(n, cx, top(startY + i * lineH), { align: 'center', angle: ang }))
  } else {
    const half = Math.ceil(names.length / 2)
    const colL = x + w * 0.27, colR = x + w * 0.73
    names.forEach((n, i) => {
      const col = i < half ? colL : colR, row = i < half ? i : i - half
      d.text(n, col, top(startY + row * lineH), { align: 'center', angle: ang })
    })
  }
}

// ── MENU (per la location, col suo logo) ─────────────────────────────────────
const MENU_ORDER: Array<{ key: string; label: string }> = [
  { key: 'BENVENUTO', label: 'Aperitivo di benvenuto' }, { key: 'ANTIPASTO', label: 'Antipasti' },
  { key: 'PRIMO', label: 'Primi piatti' }, { key: 'SECONDO', label: 'Secondi piatti' },
  { key: 'CONTORNO', label: 'Contorni' }, { key: 'FRUTTA', label: 'Frutta' },
  { key: 'DOLCE', label: 'Dolci' }, { key: 'TORTA', label: 'Taglio torta' },
  { key: 'CAFFE', label: 'Caffè' }, { key: 'BEVANDA', label: 'Bevande' },
]
type MenuItem = { section: string; name: string; description?: string | null }

export async function exportMenu(items: MenuItem[], opts: { logoUrl?: string | null; venueName?: string | null; coupleNames?: string; dateText?: string } = {}) {
  const valid = (items ?? []).filter((i) => i.name && i.name.trim())
  if (valid.length === 0) throw new Error('Il menu è vuoto')
  const { jsPDF } = await import('jspdf')
  const d = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogoPng(opts.logoUrl)

  // Due menu identici per A4 (A5 ciascuno, da tagliare a metà).
  const halfW = 210, halfH = 297 / 2
  drawMenu(d, 0, 0, halfW, halfH, valid, opts, logo)
  setDraw(d, [220, 214, 202]); d.setLineWidth(0.2); d.setLineDashPattern([1.6, 1.4], 0); d.line(8, halfH, 202, halfH); d.setLineDashPattern([], 0)
  drawMenu(d, 0, halfH, halfW, halfH, valid, opts, logo)
  d.save('menu.pdf')
}

function drawMenu(d: Doc, ox: number, oy: number, w: number, h: number, items: MenuItem[], opts: { logoUrl?: string | null; venueName?: string | null; coupleNames?: string; dateText?: string }, logo: { data: string; w: number; h: number } | null) {
  setFill(d, PAPER); d.rect(ox, oy, w, h, 'F')
  const cx = ox + w / 2
  let y = oy + 14
  if (logo) { const lw = Math.min(34, (logo.w / logo.h) * 14), lh = lw * (logo.h / logo.w); d.addImage(logo.data, 'PNG', cx - lw / 2, y - 4, lw, lh); y += lh + 4 }
  else if (opts.venueName) { setText(d, INK); d.setFont('times', 'normal'); d.setFontSize(16); d.text(opts.venueName, cx, y + 4, { align: 'center' }); y += 10 }
  // titolo + coppia/data
  setText(d, GOLD); d.setFont('helvetica', 'normal'); d.setFontSize(9); spaced(d, 'M E N U', cx, y + 4, 3); y += 8
  const head = [opts.coupleNames?.trim(), opts.dateText?.trim()].filter(Boolean).join(' · ')
  if (head) { setText(d, MUTED); d.setFont('times', 'italic'); d.setFontSize(10); d.text(head, cx, y + 2, { align: 'center' }); y += 7 }
  y += 2
  // sezioni
  const present = MENU_ORDER.map((s) => ({ ...s, dishes: items.filter((i) => (i.section || '').toUpperCase() === s.key) })).filter((s) => s.dishes.length)
  for (const s of present) {
    if (y > oy + h - 16) break
    setText(d, GOLD); d.setFont('helvetica', 'normal'); d.setFontSize(7.5); spaced(d, s.label.toUpperCase(), cx, y, 2); y += 5
    for (const dish of s.dishes) {
      if (y > oy + h - 12) break
      setText(d, INK); d.setFont('times', 'normal'); d.setFontSize(11.5)
      for (const ln of d.splitTextToSize(dish.name, w - 40) as string[]) { d.text(ln, cx, y, { align: 'center' }); y += 5 }
      if (dish.description) { setText(d, MUTED); d.setFont('helvetica', 'normal'); d.setFontSize(8); for (const ln of d.splitTextToSize(dish.description, w - 48) as string[]) { d.text(ln, cx, y, { align: 'center' }); y += 3.6 } }
      y += 1.5
    }
    y += 3
  }
}
