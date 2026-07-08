// Lista della spesa (PDF A4) per lo chef: ordini d'acquisto raggruppati per fornitore, con confezioni,
// quantità e costo. Dati da fb_purchase_orders (+ righe). Stampabile e consegnabile alla cucina.
import type { jsPDF } from 'jspdf'

export type PoForPrint = {
  status: string; expected_date: string | null; total_cost: number
  supplier: { name: string } | null
  items: Array<{ qty_packs: number; unit_price: number; product: { pack_label: string; ingredient: { name: string } | null } | null }>
}
export type Brand = { businessName: string; primary?: string | null }

function hexToRgb(hex?: string | null, fb: [number, number, number] = [26, 46, 79]): [number, number, number] {
  if (!hex) return fb
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return fb
  const n = parseInt(m[1]!, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const eur = (n: number) => '€ ' + (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export async function buildListaSpesa(orders: PoForPrint[], brand: Brand): Promise<jsPDF> {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 14
  const col = hexToRgb(brand.primary)
  let y = 0
  const ensure = (need: number) => { if (y + need > H - 14) { doc.addPage(); y = M } }
  const section = (title: string, right?: string) => {
    ensure(16); y += 3
    doc.setFillColor(col[0], col[1], col[2]); doc.rect(M, y, W - 2 * M, 7, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text(title.toUpperCase(), M + 2, y + 4.8)
    if (right) doc.text(right, W - M - 2, y + 4.8, { align: 'right' })
    y += 11; doc.setTextColor(40, 40, 40)
  }
  const row = (cells: string[], xs: number[], bold = false, size = 9) => {
    ensure(6); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size)
    cells.forEach((c, i) => doc.text(String(c ?? ''), xs[i]!, y)); y += 5.4
  }

  // Testata
  doc.setFillColor(col[0], col[1], col[2]); doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text('LISTA DELLA SPESA', M, 13)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(brand.businessName, M, 20)
  const grand = orders.reduce((s, o) => s + (o.total_cost ?? 0), 0)
  doc.text(`${orders.length} ordini · ${eur(grand)}`, W - M, 20, { align: 'right' })
  y = 32
  doc.setTextColor(110, 110, 110); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Materie prime da acquistare, raggruppate per fornitore. Consegnare allo chef / responsabile acquisti.', M, y); y += 2

  for (const o of orders) {
    const supName = o.supplier?.name ?? '— senza fornitore —'
    section(supName, `${o.status} · ${eur(o.total_cost)}`)
    row(['Ingrediente', 'Confezione', 'Q.tà', 'Costo'], [M, M + 78, M + 135, M + 165], true, 8.5)
    for (const it of o.items) {
      const name = it.product?.ingredient?.name ?? '—'
      const pack = it.product?.pack_label ?? '—'
      row([name, pack, String(it.qty_packs), eur((it.qty_packs ?? 0) * (it.unit_price ?? 0))], [M, M + 78, M + 135, M + 165], false, 8.5)
    }
    y += 2
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150)
    doc.text(`${brand.businessName} · Lista della spesa · pag. ${i}/${pages}`, M, H - 8)
    doc.text('Generato con Planfully', W - M, H - 8, { align: 'right' })
  }
  return doc
}
