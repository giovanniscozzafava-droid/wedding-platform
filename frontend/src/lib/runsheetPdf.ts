// Genera i due PDF "alta organizzazione" del fornitore per un evento:
//  • 'vetrina'   → elegante, brandizzato, per il cliente (niente telefoni/note interne)
//  • 'operativo' → per la squadra: run-sheet completo, presenze, checklist attrezzatura
import type { jsPDF } from 'jspdf'

export type RunItem = { start_time?: string | null; title: string; role_label?: string | null; note?: string | null }
export type TeamMember = { full_name: string; role_label?: string | null; phone?: string | null; presence?: string | null }
export type PackItem = { name: string; category?: string | null; qty?: number | null; checked?: boolean | null }

export type EventPdfCtx = {
  mode: 'vetrina' | 'operativo'
  brand: { businessName: string; primary?: string | null; secondary?: string | null; logoDataUrl?: string | null }
  event: { title: string; event_date?: string | null; call_time?: string | null; location?: string | null }
  runItems: RunItem[]
  members: TeamMember[]
  packing: PackItem[]
}

function hexToRgb(hex?: string | null, fallback: [number, number, number] = [26, 46, 79]): [number, number, number] {
  if (!hex) return fallback
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return fallback
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function presenceLabel(p?: string | null) {
  return p === 'PRESENTE' ? 'Presente' : p === 'ASSENTE' ? 'Assente' : p === 'FORSE' ? 'Forse' : '—'
}

export async function buildEventPdf(ctx: EventPdfCtx): Promise<jsPDF> {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const primary = hexToRgb(ctx.brand.primary)
  const secondary = hexToRgb(ctx.brand.secondary, [212, 175, 55])
  const M = 16
  let y = 0

  const dateStr = ctx.event.event_date
    ? new Date(ctx.event.event_date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // ---- Intestazione: fascia colore brand + logo + titolo ----
  doc.setFillColor(primary[0], primary[1], primary[2])
  doc.rect(0, 0, W, 34, 'F')
  if (ctx.brand.logoDataUrl) {
    try { doc.addImage(ctx.brand.logoDataUrl, 'PNG', M, 7, 20, 20) } catch { /* logo non caricabile */ }
  }
  const tx = ctx.brand.logoDataUrl ? M + 26 : M
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text(ctx.brand.businessName, tx, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(ctx.mode === 'vetrina' ? 'Piano operativo dell’evento' : 'Foglio operativo · uso interno squadra', tx, 23)
  // riga accento secondario
  doc.setFillColor(secondary[0], secondary[1], secondary[2])
  doc.rect(0, 34, W, 2, 'F')
  y = 46

  // ---- Titolo evento + meta ----
  doc.setTextColor(primary[0], primary[1], primary[2])
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
  doc.text(ctx.event.title, M, y); y += 7
  doc.setTextColor(90, 90, 90); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  const meta = [dateStr, ctx.event.location].filter(Boolean).join('  ·  ')
  if (meta) { doc.text(meta, M, y); y += 6 }
  if (ctx.mode === 'operativo' && ctx.event.call_time) {
    doc.setTextColor(secondary[0], secondary[1], secondary[2]); doc.setFont('helvetica', 'bold')
    doc.text(`Ritrovo: ${ctx.event.call_time}`, M, y); y += 6
  }
  y += 3

  // ---- Banda statistiche (solo vetrina): effetto "wow organizzazione" ----
  if (ctx.mode === 'vetrina') {
    const stats: Array<[string, string]> = [
      [String(ctx.members.length), ctx.members.length === 1 ? 'professionista' : 'professionisti'],
      [String(ctx.runItems.length), 'momenti coordinati'],
      [String(ctx.packing.length), 'attrezzature in dotazione'],
    ]
    const bw = (W - M * 2) / stats.length
    doc.setDrawColor(225, 225, 225)
    stats.forEach(([n, l], i) => {
      const x = M + bw * i
      doc.setTextColor(primary[0], primary[1], primary[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
      doc.text(n, x + bw / 2, y + 6, { align: 'center' })
      doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
      doc.text(l.toUpperCase(), x + bw / 2, y + 12, { align: 'center' })
    })
    y += 20
  }

  const ensure = (need: number) => { if (y + need > 285) { doc.addPage(); y = 20 } }
  const sectionTitle = (t: string) => {
    ensure(12); doc.setTextColor(primary[0], primary[1], primary[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(t, M, y); y += 2; doc.setDrawColor(secondary[0], secondary[1], secondary[2]); doc.setLineWidth(0.6)
    doc.line(M, y, M + 28, y); y += 6
  }

  // ---- Programma / Run-sheet ----
  if (ctx.runItems.length > 0) {
    sectionTitle(ctx.mode === 'vetrina' ? 'Il programma' : 'Run-sheet')
    doc.setFontSize(10)
    for (const it of ctx.runItems) {
      ensure(8)
      doc.setTextColor(secondary[0], secondary[1], secondary[2]); doc.setFont('helvetica', 'bold')
      doc.text(it.start_time || '—', M, y)
      doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal')
      doc.text(it.title, M + 18, y)
      if (ctx.mode === 'operativo' && it.role_label) {
        doc.setTextColor(120, 120, 120); doc.setFontSize(9)
        doc.text(it.role_label, W - M, y, { align: 'right' }); doc.setFontSize(10)
      }
      y += 5.5
      if (ctx.mode === 'operativo' && it.note) {
        ensure(6); doc.setTextColor(140, 140, 140); doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5)
        doc.text(doc.splitTextToSize(it.note, W - M - (M + 18)), M + 18, y); y += 5; doc.setFontSize(10); doc.setFont('helvetica', 'normal')
      }
    }
    y += 4
  }

  // ---- Squadra ----
  if (ctx.members.length > 0) {
    sectionTitle(ctx.mode === 'vetrina' ? 'La squadra dedicata' : 'Presenze squadra')
    doc.setFontSize(10)
    for (const m of ctx.members) {
      ensure(7)
      doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.text(m.full_name, M, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120)
      doc.text(m.role_label || '—', M + 70, y)
      if (ctx.mode === 'operativo') {
        doc.text(presenceLabel(m.presence), M + 130, y)
        if (m.phone) doc.text(m.phone, W - M, y, { align: 'right' })
      }
      y += 5.5
    }
    y += 4
  }

  // ---- Checklist attrezzatura (solo operativo) ----
  if (ctx.mode === 'operativo' && ctx.packing.length > 0) {
    sectionTitle('Checklist attrezzatura')
    doc.setFontSize(10)
    for (const p of ctx.packing) {
      ensure(6)
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3); doc.rect(M, y - 3.2, 3.6, 3.6)
      if (p.checked) { doc.setTextColor(secondary[0], secondary[1], secondary[2]); doc.setFont('helvetica', 'bold'); doc.text('x', M + 0.7, y - 0.4) }
      doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal')
      const qty = p.qty && p.qty > 1 ? `${p.qty}× ` : ''
      doc.text(`${qty}${p.name}`, M + 7, y)
      if (p.category) { doc.setTextColor(150, 150, 150); doc.setFontSize(8.5); doc.text(p.category, W - M, y, { align: 'right' }); doc.setFontSize(10) }
      y += 5.6
    }
    y += 4
  }

  // ---- Footer ----
  const fy = 290
  doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.3); doc.line(M, fy - 4, W - M, fy - 4)
  doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(`${ctx.brand.businessName} · organizzato con Planfully`, M, fy)
  return doc
}

// Scarica un'immagine (logo) come dataURL PNG per inserirla nel PDF. Best-effort.
export async function fetchLogoDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch { return null }
}
