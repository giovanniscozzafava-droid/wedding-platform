import { jsPDF } from 'jspdf'
import type { OptionChoices } from '@/hooks/useAlbumOrder'

// Scheda ordine album per il fotografo: stesso stile/libreria di commissionPdf.ts (copia
// commessa del catalogo PDF), qui per la conferma "colore/logo/box/finiture" dello stepper.
// Un solo PDF A4, brandizzato con i dati del fotografo, pronto per la stampa/allegato.

export type AlbumOrderDoc = {
  studio: string
  studioContact?: string | null
  coupleLabel: string
  eventDateLabel?: string | null
  albumFormatLabel?: string | null
  pages?: number | null
  optionChoices: OptionChoices
  note?: string | null
  coverPhotoDataUrl?: string | null
  coverPhotoLabel?: string | null
  coverPhotoNote?: string | null
  confirmedAt: string
  confirmedByName?: string | null
}

const GOLD = [176, 141, 60] as const
const INK = [38, 34, 28] as const
const MUTED = [120, 112, 100] as const

export function buildAlbumOrderPdf(d: AlbumOrderDoc): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 18
  let y = M

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...INK)
  doc.text('Scheda ordine album', M, y); y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED)
  doc.text(`${d.studio || 'Studio'}${d.studioContact ? ` · ${d.studioContact}` : ''}`, M, y); y += 6
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 9

  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), M, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...INK)
    doc.text(value || '—', M, y + 5.5)
    y += 13
  }

  row('Sposi / Cliente', d.coupleLabel)
  if (d.eventDateLabel) row('Data evento', d.eventDateLabel)
  const albumLine = [d.albumFormatLabel, d.pages ? `${d.pages} pagine` : null].filter(Boolean).join('   ·   ')
  if (albumLine) row('Album', albumLine)

  const oc = d.optionChoices
  // Una riga per caratteristica, sempre tutte e quattro: la stamperia non deve
  // indovinare cosa manca — se manca, si legge «—».
  row('Colore copertina', oc.cover_color?.label ?? '—')
  row('Logo / impressione', oc.logo?.label ?? '—')
  row('Box / cofanetto', oc.box?.label ?? '—')
  row('Finitura', oc.finish?.label ?? '—')

  if (d.note?.trim()) row('Nota per il fotografo', d.note.trim())

  // foto di copertina, se scelta
  if (d.coverPhotoDataUrl) {
    try {
      const props = doc.getImageProperties(d.coverPhotoDataUrl)
      const maxW = 55, maxH = 55
      const r = Math.min(maxW / props.width, maxH / props.height)
      const w = props.width * r, h = props.height * r
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED)
      doc.text('FOTO IN COPERTINA', M, y); y += 3
      doc.addImage(d.coverPhotoDataUrl, 'JPEG', M, y, w, h)
      doc.setDrawColor(220, 214, 204); doc.setLineWidth(0.3); doc.rect(M, y, w, h)
      if (d.coverPhotoLabel) { doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(d.coverPhotoLabel, M, y + h + 4) }
      if (d.coverPhotoNote) { doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(d.coverPhotoNote, M + maxW + 8, y + 4, { maxWidth: W - 2 * M - maxW - 8 }) }
      y += h + 10
    } catch { /* miniatura opzionale */ }
  }

  // conferma
  const confY = Math.max(y, 250)
  doc.setDrawColor(...INK); doc.setLineWidth(0.3); doc.line(M, confY, W - M, confY)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED)
  doc.text('CONFERMATO DA', M, confY + 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...INK)
  doc.text(`${d.confirmedByName ?? d.coupleLabel} — ${d.confirmedAt}`, M, confY + 13)

  doc.setFontSize(7.5); doc.setTextColor(...MUTED)
  doc.text('Documento generato da Planfully · scelte confermate dal cliente per la stampa.', M, 290)

  return doc.output('blob')
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

// jsPDF vuole un'immagine come data URL: converte l'URL (Drive o Supabase Storage) in JPEG
// data URL passando per un <canvas> (evita problemi CORS con addImage su URL remoti diretti).
export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const loaded = new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('img')) })
    img.src = url
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch { return null }
}
