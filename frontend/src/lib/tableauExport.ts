// Export GRAFICO del tableau mariage come poster da stampa (A3 o 70×100 cm).
// Disegna la piantina in scala: ogni tavolo nella sua forma, alla sua posizione,
// con nome + elenco degli invitati seduti. Pensato per essere appeso/letto dagli ospiti.
type T = { id: string; table_no: number; label: string | null; seats: number; shape: string; pos_x: number | null; pos_y: number | null; is_staff?: boolean | null }
type G = { id: string; full_name: string; table_id: string | null }

// Esporta un nodo DOM (il poster renderizzato) come PDF nel formato scelto (mm, ritratto).
export async function exportPosterNode(node: HTMLElement, sizeMm: { w: number; h: number }, filename: string) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: null, useCORS: true, logging: false })
  const pdf = new jsPDF({ orientation: sizeMm.h >= sizeMm.w ? 'portrait' : 'landscape', unit: 'mm', format: [sizeMm.w, sizeMm.h] })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, sizeMm.w, sizeMm.h)
  pdf.save(filename)
}

export type TableauFormat = 'A3' | '70x100'
const SIZES: Record<TableauFormat, [number, number]> = { A3: [420, 297], '70x100': [1000, 700] } // mm, landscape

const labelOf = (t: T) => t.label ?? `Tavolo ${t.table_no}`

// posizione 0..1 (default griglia se mancante, identica alla piantina a schermo)
function positions(tables: T[]): Array<{ t: T; x: number; y: number }> {
  const cols = Math.ceil(Math.sqrt(Math.max(1, tables.length)))
  const rows = Math.ceil(tables.length / cols)
  return tables.map((t, i) => {
    if (t.pos_x != null && t.pos_y != null) return { t, x: t.pos_x, y: t.pos_y }
    const r = Math.floor(i / cols), c = i % cols
    return { t, x: (c + 1) / (cols + 1), y: rows > 0 ? (r + 1) / (rows + 1) : 0.5 }
  })
}

export async function exportTableauPlanPdf(tables: T[], guests: G[], opts: { format?: TableauFormat; title?: string; subtitle?: string; filename?: string } = {}) {
  const { format = 'A3', title = 'Tableau Mariage', subtitle = '', filename } = opts
  const [W, H] = SIZES[format]
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] })

  // intestazione
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(40, 40, 40)
  pdf.setFontSize(format === '70x100' ? 48 : 26)
  pdf.text(title, W / 2, format === '70x100' ? 40 : 22, { align: 'center' })
  if (subtitle) { pdf.setFontSize(format === '70x100' ? 18 : 11); pdf.setTextColor(120, 120, 120); pdf.text(subtitle, W / 2, format === '70x100' ? 58 : 32, { align: 'center' }) }

  // area sala (margini)
  const top = format === '70x100' ? 80 : 42
  const m = format === '70x100' ? 50 : 18
  const roomX = m, roomY = top, roomW = W - 2 * m, roomH = H - top - m
  const seatedBy = (id: string) => guests.filter((g) => g.table_id === id)
  const scale = format === '70x100' ? 1.9 : 1

  for (const { t, x, y } of positions(tables)) {
    const cx = roomX + x * roomW, cy = roomY + y * roomH
    const seated = seatedBy(t.id)
    const staff = !!t.is_staff
    pdf.setDrawColor(staff ? 120 : 150, staff ? 90 : 150, staff ? 200 : 150)
    pdf.setFillColor(245, 244, 248)
    pdf.setLineWidth(staff ? 0.9 : 0.6)

    // forma
    if (t.shape === 'ROUND') {
      const r = 7 * scale
      pdf.circle(cx, cy, r, 'FD')
    } else if (t.shape === 'FERRO_CAVALLO') {
      const w = 22 * scale, h = 14 * scale
      pdf.lines([[0, h], [w, 0], [0, -h]], cx - w / 2, cy - h / 2, [1, 1], 'S', false)
    } else if (t.shape === 'HEAD') {
      const w = 26 * scale, h = 5 * scale
      pdf.roundedRect(cx - w / 2, cy - h / 2, w, h, 1.5, 1.5, 'FD')
    } else { // RECT / IMPERIALE / SQUARE
      const w = (t.shape === 'SQUARE' ? 11 : 22) * scale, h = (t.shape === 'SQUARE' ? 11 : 6) * scale
      pdf.roundedRect(cx - w / 2, cy - h / 2, w, h, 1.5, 1.5, 'FD')
    }

    // nome tavolo (sopra)
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 30, 30)
    pdf.setFontSize((format === '70x100' ? 16 : 10) * 1)
    const nameY = cy - (t.shape === 'ROUND' ? 9 : 6) * scale
    pdf.text(labelOf(t), cx, nameY, { align: 'center', maxWidth: 60 * scale })

    // invitati (sotto)
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(70, 70, 70)
    pdf.setFontSize((format === '70x100' ? 11 : 7))
    const lh = (format === '70x100' ? 5.2 : 3.3)
    let gy = cy + (t.shape === 'ROUND' ? 9 : 7) * scale
    const names = seated.map((g) => g.full_name)
    const maxShown = 14
    for (const n of names.slice(0, maxShown)) { pdf.text(n, cx, gy, { align: 'center', maxWidth: 64 * scale }); gy += lh }
    if (names.length > maxShown) { pdf.text(`+${names.length - maxShown} altri`, cx, gy, { align: 'center' }) }
    if (names.length === 0) { pdf.setTextColor(170, 170, 170); pdf.text('—', cx, gy, { align: 'center' }) }
  }

  pdf.save(filename ?? `tableau-${format.toLowerCase()}.pdf`)
}
