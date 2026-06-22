// Foglio di servizio dell'evento (PDF A4): un unico documento operativo che fonde brigata + piatti +
// fabbisogno + lotti da prelevare (FEFO) + tavoli. Dati da fb_event_sheet. Stampabile per la squadra.
import type { jsPDF } from 'jspdf'

export type EventSheet = {
  evento: { titolo: string | null; data: string | null; coperti: number; tavoli: number; coperti_per_tavolo: number }
  brigata: Array<{ reparto: string; ruolo: string; nome: string; postazione: string | null; chiamata: string | null; fine: string | null; tel: string | null }>
  menu: string[]
  piatti: Array<{ piatto: string; per_coperto: number; porzioni: number }>
  fabbisogno: Array<{ ingrediente: string; qta: number; unita: string }>
  magazzino: Array<{ ingrediente: string; lotto: string | null; disponibile: number; unita: string; scadenza: string | null }>
}
export type Brand = { businessName: string; primary?: string | null }

function hexToRgb(hex?: string | null, fb: [number, number, number] = [26, 46, 79]): [number, number, number] {
  if (!hex) return fb
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return fb
  const n = parseInt(m[1]!, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const big = (q: number, u: string) => (u === 'G' || u === 'ML' ? `${(q / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} ${u === 'G' ? 'kg' : 'L'}` : `${q.toLocaleString('it-IT')} ${u === 'PZ' ? 'pz' : ''}`.trim())

export async function buildFoglioServizio(s: EventSheet, brand: Brand): Promise<jsPDF> {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 14
  const col = hexToRgb(brand.primary)
  let y = 0

  const ensure = (need: number) => { if (y + need > H - 14) { doc.addPage(); y = M } }
  const section = (title: string) => {
    ensure(16); y += 3
    doc.setFillColor(col[0], col[1], col[2]); doc.rect(M, y, W - 2 * M, 7, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text(title.toUpperCase(), M + 2, y + 4.8); y += 11
    doc.setTextColor(40, 40, 40)
  }
  const row = (cells: string[], xs: number[], bold = false, size = 9) => {
    ensure(6); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size)
    cells.forEach((c, i) => doc.text(String(c ?? ''), xs[i]!, y))
    y += 5.4
  }

  // Testata
  doc.setFillColor(col[0], col[1], col[2]); doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text('FOGLIO DI SERVIZIO', M, 13)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(brand.businessName, M, 20)
  const dataStr = s.evento.data ? new Date(s.evento.data).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  doc.text(`${s.evento.coperti} coperti · ${s.evento.tavoli} tavoli`, W - M, 13, { align: 'right' })
  doc.text(dataStr, W - M, 20, { align: 'right' })
  y = 32
  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(s.evento.titolo || 'Evento', M, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110)
  doc.text('Menu: ' + (s.menu.join(' · ') || '—'), M, y); y += 2

  // Brigata per reparto
  section('Brigata di servizio')
  const reparti = ['CUCINA', 'SALA', 'BAR', 'PLONGE']
  const repLabel: Record<string, string> = { CUCINA: 'Cucina', SALA: 'Sala', BAR: 'Bar', PLONGE: 'Lavaggio' }
  for (const rp of reparti) {
    const mem = s.brigata.filter((b) => b.reparto === rp)
    if (!mem.length) continue
    ensure(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(col[0], col[1], col[2])
    doc.text(`${repLabel[rp]} (${mem.length})`, M, y); y += 5; doc.setTextColor(40, 40, 40)
    row(['Ruolo', 'Nome', 'Postazione', 'Chiamata'], [M, M + 48, M + 110, M + 158], true, 8.5)
    for (const b of mem) row([b.ruolo, b.nome, b.postazione || '—', b.chiamata || '—'], [M, M + 48, M + 110, M + 158], false, 9)
    y += 2
  }

  // Menu & produzione
  section('Menu & produzione (porzioni per ' + s.evento.coperti + ' coperti)')
  row(['Piatto', 'Per coperto', 'Porzioni'], [M, M + 110, M + 150], true, 8.5)
  for (const p of s.piatti) row([p.piatto, String(p.per_coperto), String(p.porzioni)], [M, M + 110, M + 150], false, 9)

  // Mise en place + magazzino (fabbisogno + lotti FEFO da prelevare)
  section('Mise en place & prelievo magazzino (FEFO)')
  row(['Ingrediente', 'Fabbisogno', 'Lotto da prelevare', 'Scadenza'], [M, M + 70, M + 110, M + 165], true, 8.5)
  const lotsByIng = new Map<string, EventSheet['magazzino']>()
  for (const l of s.magazzino) { const a = lotsByIng.get(l.ingrediente) || []; a.push(l); lotsByIng.set(l.ingrediente, a) }
  for (const f of s.fabbisogno) {
    const lots = lotsByIng.get(f.ingrediente) || []
    const first = lots[0]
    row([f.ingrediente, big(f.qta, f.unita), first ? `${first.lotto || '—'} (${big(first.disponibile, first.unita)})` : '— non a magazzino —', first?.scadenza ? new Date(first.scadenza).toLocaleDateString('it-IT') : ''], [M, M + 70, M + 110, M + 165], false, 8.5)
  }

  // Sala / tavoli
  section('Sala')
  row([`${s.evento.tavoli} tavoli da ~${s.evento.coperti_per_tavolo} coperti — totale ${s.evento.coperti} ospiti`], [M], false, 10)

  // footer
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150)
    doc.text(`${brand.businessName} · Foglio di servizio · pag. ${i}/${pages}`, M, H - 8)
    doc.text('Generato con Planfully', W - M, H - 8, { align: 'right' })
  }
  return doc
}
