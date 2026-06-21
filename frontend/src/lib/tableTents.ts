// CAVALIERE DA TAVOLO autoportante, UNO per A4. Tre pannelli: faccia A (sopra, ruotata 180°),
// faccia B (sotto, dritta) e una BASE con LINGUETTA che si infila in una FESSURA in cima alla
// faccia A → si chiude a triangolo e sta in piedi da solo. Su entrambe le facce: QR alla galleria
// foto dell'evento, spiegazione e logo Planfully. Si ritaglia il contorno (+ la fessura), si piega
// sulle tratteggiate, si incastra la linguetta.

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export async function exportTableTents(opts: { url: string; title?: string; subtitle?: string }) {
  if (!opts.url) throw new Error('Manca il link della galleria')
  const QRCode = (await import('qrcode')).default
  const html2canvas = (await import('html2canvas-pro')).default
  const { jsPDF } = await import('jspdf')

  const title = opts.title || 'Le foto del nostro evento'
  const subtitle = opts.subtitle || 'Inquadra il QR con la fotocamera del telefono: vedi tutte le foto dell’evento e carichi le tue. È il nostro album condiviso, in un posto solo.'

  const qr = await QRCode.toDataURL(opts.url, { margin: 1, width: 720, color: { dark: '#1A1714', light: '#ffffff' } })

  // Una faccia (600×400 = 1.5, come il riquadro 150×100mm), rasterizzata offscreen (hex puri).
  const face = document.createElement('div')
  face.style.cssText = 'position:fixed;left:-99999px;top:0;width:600px;height:400px;background:#FDFBF6;box-sizing:border-box;padding:26px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;font-family:Arial,Helvetica,sans-serif;color:#1A1714'
  face.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="#C49A5C" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" fill="#C49A5C"/></svg>
      <span style="font-family:Georgia,serif;font-size:22px;letter-spacing:.01em">Planfully</span>
    </div>
    <img src="${qr}" alt="" style="width:196px;height:196px;display:block" crossorigin="anonymous"/>
    <div style="text-align:center;max-width:94%">
      <div style="font-size:19px;font-weight:700;line-height:1.15">${esc(title)}</div>
      <div style="font-size:12.5px;color:#5f574c;margin-top:5px;line-height:1.32">${esc(subtitle)}</div>
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

  // ── Geometria A4 (mm) ──────────────────────────────────────────────
  const PW = 210
  const W = 150, H = 100, BASE = 50, TABH = 10           // faccia 150×100; base 50; linguetta 10
  const x0 = (PW - W) / 2, x1 = x0 + W                    // 30 .. 180
  const yTop = 18                                         // top faccia A (qui la fessura)
  const yApex = yTop + H                                  // 118  piega di colmo (tra le due facce)
  const yBaseFold = yApex + H                             // 218  piega della base
  const yBaseEnd = yBaseFold + BASE                       // 268  fine base / inizio linguetta
  const yTabEnd = yBaseEnd + TABH                         // 278  fine linguetta
  const cx = (x0 + x1) / 2
  const tabHalf = 22, slitHalf = 24                       // linguetta 44mm, fessura 48mm

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  // istruzioni in alto
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(120, 120, 120)
  pdf.text('Ritaglia il contorno e la fessura · piega sulle linee tratteggiate · infila la linguetta della base nella fessura: sta in piedi da solo.', PW / 2, 11, { align: 'center' })

  // facce
  pdf.addImage(img180, 'PNG', x0, yTop, W, H, undefined, 'FAST')   // faccia A (in alto, ruotata)
  pdf.addImage(img, 'PNG', x0, yApex, W, H, undefined, 'FAST')     // faccia B (in basso, dritta)

  // base + linguetta (etichette)
  pdf.setFontSize(9); pdf.setTextColor(150, 140, 125)
  pdf.text('BASE — piega e porta la linguetta nella fessura in cima', cx, yBaseFold + BASE / 2, { align: 'center' })

  // ── Contorno di taglio (continuo) con la linguetta che sporge in basso ──
  pdf.setDrawColor(120, 120, 120); pdf.setLineWidth(0.3); pdf.setLineDashPattern([], 0)
  const cut: Array<[number, number]> = [
    [x0, yTop], [x1, yTop], [x1, yBaseEnd],
    [cx + tabHalf, yBaseEnd], [cx + tabHalf, yTabEnd], [cx - tabHalf, yTabEnd], [cx - tabHalf, yBaseEnd],
    [x0, yBaseEnd], [x0, yTop],
  ]
  for (let i = 0; i < cut.length - 1; i++) pdf.line(cut[i]![0], cut[i]![1], cut[i + 1]![0], cut[i + 1]![1])

  // ── Fessura (taglio interno) in cima alla faccia A ──
  pdf.setLineWidth(0.5)
  pdf.line(cx - slitHalf, yTop + 7, cx + slitHalf, yTop + 7)
  pdf.setFontSize(7.5); pdf.setTextColor(150, 150, 150)
  pdf.text('fessura (taglia)', cx, yTop + 4.5, { align: 'center' })

  // ── Pieghe (tratteggiate) ──
  pdf.setDrawColor(196, 154, 92); pdf.setLineWidth(0.3); pdf.setLineDashPattern([1.6, 1.2], 0)
  pdf.line(x0, yApex, x1, yApex)            // colmo
  pdf.line(x0, yBaseFold, x1, yBaseFold)    // base
  pdf.line(cx - tabHalf, yBaseEnd, cx + tabHalf, yBaseEnd) // piega linguetta
  pdf.setLineDashPattern([], 0)

  pdf.save('cavaliere-tavolo.pdf')
}
