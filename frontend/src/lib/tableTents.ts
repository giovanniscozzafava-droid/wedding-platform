// CAVALIERI DA TAVOLO (table tent) stampabili in A4: 4 per foglio, da ritagliare lungo il bordo e
// piegare a metà sulla linea tratteggiata → tenda triangolare con DUE facce leggibili, ognuna con
// QR (alla galleria foto dell'evento) + spiegazione + logo Planfully.
// La faccia inferiore è ruotata 180°, così a tenda montata entrambe si leggono dritte.

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export async function exportTableTents(opts: { url: string; title?: string; subtitle?: string; perPageRows?: number }) {
  if (!opts.url) throw new Error('Manca il link della galleria')
  const QRCode = (await import('qrcode')).default
  const html2canvas = (await import('html2canvas-pro')).default
  const { jsPDF } = await import('jspdf')

  const title = opts.title || 'Le foto dell’evento'
  const subtitle = opts.subtitle || 'Inquadra il QR: vedi e carichi le foto dell’evento.'

  // QR ad alta risoluzione, colori brand.
  const qr = await QRCode.toDataURL(opts.url, { margin: 1, width: 640, color: { dark: '#1A1714', light: '#ffffff' } })

  // Una faccia, costruita offscreen e rasterizzata (hex puri → niente problemi oklch).
  const face = document.createElement('div')
  face.style.cssText = 'position:fixed;left:-99999px;top:0;width:600px;height:400px;background:#FDFBF6;border:2px solid #C49A5C;border-radius:16px;box-sizing:border-box;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;font-family:Arial,Helvetica,sans-serif;color:#1A1714'
  face.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="#C49A5C" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" fill="#C49A5C"/></svg>
      <span style="font-family:Georgia,serif;font-size:21px;letter-spacing:.01em">Planfully</span>
    </div>
    <img src="${qr}" alt="" style="width:188px;height:188px;display:block" crossorigin="anonymous"/>
    <div style="text-align:center;max-width:90%">
      <div style="font-size:18px;font-weight:700;line-height:1.15">${esc(title)}</div>
      <div style="font-size:13px;color:#6E6E6E;margin-top:4px;line-height:1.3">${esc(subtitle)}</div>
    </div>`
  document.body.appendChild(face)
  let img: string, img180: string
  try {
    const canvas = await html2canvas(face, { scale: 2, backgroundColor: '#FDFBF6', useCORS: true })
    img = canvas.toDataURL('image/png')
    const c2 = document.createElement('canvas'); c2.width = canvas.width; c2.height = canvas.height
    const ctx = c2.getContext('2d')!; ctx.translate(c2.width, c2.height); ctx.rotate(Math.PI); ctx.drawImage(canvas, 0, 0)
    img180 = c2.toDataURL('image/png')
  } finally { face.remove() }

  // Impaginazione A4 (mm): 2 colonne × N righe (default 2 → 4 cavalieri/foglio).
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW = 210, M = 8, GAP = 8, rows = Math.max(1, Math.min(3, opts.perPageRows ?? 2))
  const cellW = (PW - 2 * M - GAP) / 2     // ~93 mm
  const faceH = cellW / 1.5                  // faccia 600×400 → 1.5
  const tentH = faceH * 2
  const topY = 12

  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(110, 110, 110)
  pdf.text('Ritaglia lungo il bordo continuo · piega a metà sulla linea tratteggiata · monta a tenda sul tavolo.', PW / 2, 7, { align: 'center' })

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 2; c++) {
      const x = M + c * (cellW + GAP)
      const y = topY + r * (tentH + GAP)
      pdf.addImage(img, 'PNG', x, y, cellW, faceH, undefined, 'FAST')             // faccia alta (dritta)
      pdf.addImage(img180, 'PNG', x, y + faceH, cellW, faceH, undefined, 'FAST')  // faccia bassa (180°)
      // bordo di taglio (continuo) + linea di piega (tratteggiata, sul mezzo)
      pdf.setDrawColor(170, 170, 170); pdf.setLineWidth(0.2); pdf.rect(x, y, cellW, tentH)
      pdf.setLineDashPattern([1.6, 1.2], 0); pdf.setDrawColor(196, 154, 92); pdf.setLineWidth(0.25)
      pdf.line(x, y + faceH, x + cellW, y + faceH)
      pdf.setLineDashPattern([], 0)
    }
  }

  pdf.save('cavalieri-tavolo.pdf')
}
