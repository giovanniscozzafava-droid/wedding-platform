import { jsPDF } from 'jspdf'
import type { CommissionSpecs } from '@/hooks/useAlbumCatalog'

// Genera la COPIA COMMESSA firmata (PDF A4) da inviare all'azienda: studio, coppia,
// modello scelto, specifiche, miniatura della pagina del catalogo e firma del cliente.

export type CommissionDoc = {
  studio: string
  couple: string
  modelLabel: string
  specs: CommissionSpecs
  signatureDataUrl: string | null
  pageImageDataUrl?: string | null
  catalogName?: string
  dateLabel: string
}

const GOLD = [176, 141, 60] as const
const INK = [38, 34, 28] as const
const MUTED = [120, 112, 100] as const

export function buildCommissionPdf(d: CommissionDoc): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 18
  let y = M

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...INK)
  doc.text('Copia commessa album', M, y); y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED)
  doc.text(`${d.studio || 'Studio'} · ${d.dateLabel}`, M, y); y += 6
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 9

  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), M, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...INK)
    doc.text(value || '—', M, y + 5.5)
    y += 13
  }

  row('Sposi / Cliente', d.couple)
  row('Modello scelto', d.modelLabel)

  const sp = d.specs
  const specLine = [
    sp.format ? `Formato: ${sp.format}` : null,
    sp.size ? `Misura: ${sp.size}` : null,
    sp.pages ? `Pagine: ${sp.pages}` : null,
    sp.box && sp.box !== 'nessuno' ? `Box: ${sp.box}` : null,
    sp.finishes && sp.finishes.length ? `Finiture: ${sp.finishes.join(', ')}` : null,
  ].filter(Boolean).join('   ·   ')
  row('Specifiche', specLine || 'Standard')

  // miniatura della pagina del catalogo scelta
  if (d.pageImageDataUrl) {
    try {
      const props = doc.getImageProperties(d.pageImageDataUrl)
      const maxW = 80, maxH = 60
      const r = Math.min(maxW / props.width, maxH / props.height)
      const w = props.width * r, h = props.height * r
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED)
      doc.text('PAGINA CATALOGO', M, y); y += 3
      doc.addImage(d.pageImageDataUrl, 'JPEG', M, y, w, h)
      doc.setDrawColor(220, 214, 204); doc.setLineWidth(0.3); doc.rect(M, y, w, h)
      y += h + 10
    } catch { /* miniatura opzionale */ }
  }

  // firma
  const signY = Math.max(y, 232)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED)
  doc.text('FIRMA DEL CLIENTE', M, signY)
  if (d.signatureDataUrl) {
    try { doc.addImage(d.signatureDataUrl, 'PNG', M, signY + 3, 70, 26) } catch { /* */ }
  }
  doc.setDrawColor(...INK); doc.setLineWidth(0.3); doc.line(M, signY + 32, M + 80, signY + 32)
  doc.setFontSize(8); doc.setTextColor(...MUTED)
  doc.text(`${d.couple} — ${d.dateLabel}`, M, signY + 37)

  doc.setFontSize(7.5); doc.setTextColor(...MUTED)
  doc.text('Documento generato dal configuratore Planfully · scelta e firma confermate dal cliente.', M, 290)

  return doc.output('blob')
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
