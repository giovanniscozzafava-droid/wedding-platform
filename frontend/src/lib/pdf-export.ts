/**
 * PDF export client-side universale.
 * Cattura un nodo DOM e lo esporta in PDF (multi-page automatico).
 * Brand: header con logo Planfully + titolo, footer con data.
 *
 * jspdf + html2canvas (~185KB gz) caricati dinamicamente: il chunk pdf
 * viene scaricato solo quando l'utente clicca "Esporta PDF".
 */

export type ExportOptions = {
  title?: string
  subtitle?: string
  filename?: string
  landscape?: boolean
}

export async function exportNodeToPdf(node: HTMLElement, opts: ExportOptions = {}) {
  const {
    title = 'Planfully',
    subtitle = '',
    filename = `${(title ?? 'planfully').toLowerCase().replace(/\s+/g, '-')}.pdf`,
    landscape = false,
  } = opts

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  // Render nodo a canvas (PNG ad alta risoluzione)
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })

  const orientation = landscape ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 12
  const contentW = pageW - margin * 2
  const headerH = 22
  const footerH = 12
  const usableH = pageH - margin - headerH - footerH

  // Header function
  function drawHeader() {
    pdf.setFillColor(196, 154, 92) // gold #C49A5C
    pdf.rect(margin, margin, 4, 12, 'F')
    pdf.setFontSize(11)
    pdf.setTextColor(60, 60, 60)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PLANFULLY', margin + 6, margin + 5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(14)
    pdf.setTextColor(20, 20, 20)
    pdf.text(title, margin + 6, margin + 11)
    if (subtitle) {
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text(subtitle, margin + 6, margin + 16)
    }
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, margin + headerH - 2, pageW - margin, margin + headerH - 2)
  }

  // Footer function
  function drawFooter(pageNum: number, totalPages: number) {
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, pageH - footerH, pageW - margin, pageH - footerH)
    pdf.setFontSize(8)
    pdf.setTextColor(140, 140, 140)
    const date = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    pdf.text(`Generato il ${date}`, margin, pageH - footerH + 5)
    pdf.text(`Planfully · planfully.it`, pageW / 2, pageH - footerH + 5, { align: 'center' })
    pdf.text(`Pag. ${pageNum} / ${totalPages}`, pageW - margin, pageH - footerH + 5, { align: 'right' })
  }

  // Calcola scaling immagine
  const imgRatio = canvas.height / canvas.width
  const imgW = contentW
  const imgH = imgW * imgRatio

  // Multi-page split se l'immagine eccede usableH
  let remainingH = imgH
  let yOffsetCanvas = 0
  let pageNum = 1
  const totalPages = Math.ceil(imgH / usableH)

  while (remainingH > 0) {
    if (pageNum > 1) pdf.addPage()
    drawHeader()

    const drawH = Math.min(remainingH, usableH)
    // Calcola porzione del canvas per questa pagina
    const sliceHeightOnCanvas = (drawH / imgH) * canvas.height
    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceHeightOnCanvas
    const ctx = sliceCanvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(canvas, 0, yOffsetCanvas, canvas.width, sliceHeightOnCanvas, 0, 0, canvas.width, sliceHeightOnCanvas)
      const sliceData = sliceCanvas.toDataURL('image/png')
      pdf.addImage(sliceData, 'PNG', margin, margin + headerH, imgW, drawH)
    }

    drawFooter(pageNum, totalPages)
    yOffsetCanvas += sliceHeightOnCanvas
    remainingH -= drawH
    pageNum++
  }

  pdf.save(filename)
}

/**
 * Crea un PDF strutturato da dati (no DOM capture).
 * Usalo per liste tabulari pulite (invitati, tavoli, budget).
 */
export type TableExportOptions = {
  title: string
  subtitle?: string
  filename?: string
  columns: Array<{ header: string; key: string; width?: number }>
  rows: Array<Record<string, unknown>>
  landscape?: boolean
}

export async function exportTableToPdf(opts: TableExportOptions) {
  const { title, subtitle = '', filename = `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`, columns, rows, landscape = false } = opts

  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 12
  const headerH = 22
  const footerH = 12
  const contentW = pageW - margin * 2

  // Calcola width default colonne
  const totalDefinedWidth = columns.reduce((s, c) => s + (c.width ?? 0), 0)
  const remainingWidth = contentW - totalDefinedWidth
  const undefCols = columns.filter((c) => !c.width).length
  const defaultColW = undefCols > 0 ? remainingWidth / undefCols : 0
  const colWidths: number[] = columns.map((c) => c.width ?? defaultColW)

  let y = margin + headerH + 2
  let pageNum = 1

  function drawHeader() {
    pdf.setFillColor(196, 154, 92)
    pdf.rect(margin, margin, 4, 12, 'F')
    pdf.setFontSize(11)
    pdf.setTextColor(60, 60, 60)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PLANFULLY', margin + 6, margin + 5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(14)
    pdf.setTextColor(20, 20, 20)
    pdf.text(title, margin + 6, margin + 11)
    if (subtitle) {
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text(subtitle, margin + 6, margin + 16)
    }
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, margin + headerH - 2, pageW - margin, margin + headerH - 2)
  }
  function drawFooter() {
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, pageH - footerH, pageW - margin, pageH - footerH)
    pdf.setFontSize(8)
    pdf.setTextColor(140, 140, 140)
    const date = new Date().toLocaleDateString('it-IT')
    pdf.text(`Generato il ${date}`, margin, pageH - footerH + 5)
    pdf.text(`Planfully · planfully.it`, pageW / 2, pageH - footerH + 5, { align: 'center' })
    pdf.text(`Pag. ${pageNum}`, pageW - margin, pageH - footerH + 5, { align: 'right' })
  }
  function drawTableHeader() {
    pdf.setFillColor(247, 243, 235) // crema chiara
    pdf.rect(margin, y - 5, contentW, 8, 'F')
    pdf.setFontSize(8)
    pdf.setTextColor(80, 80, 80)
    pdf.setFont('helvetica', 'bold')
    let x = margin + 2
    columns.forEach((c, i) => {
      pdf.text(c.header, x, y)
      x += colWidths[i] ?? defaultColW
    })
    y += 6
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(40, 40, 40)
  }

  drawHeader()
  drawTableHeader()

  for (const row of rows) {
    if (y > pageH - footerH - 8) {
      drawFooter()
      pdf.addPage()
      pageNum++
      y = margin + headerH + 2
      drawHeader()
      drawTableHeader()
    }
    pdf.setFontSize(8.5)
    let x = margin + 2
    columns.forEach((c, i) => {
      const w = colWidths[i] ?? defaultColW
      const val = row[c.key]
      const text = val == null ? '' : String(val)
      const truncated = text.length > (w / 1.6) ? text.slice(0, Math.floor(w / 1.6)) + '…' : text
      pdf.text(truncated, x, y)
      x += w
    })
    y += 5
    pdf.setDrawColor(245, 240, 230)
    pdf.line(margin, y - 2, pageW - margin, y - 2)
  }
  drawFooter()

  pdf.save(filename)
}
