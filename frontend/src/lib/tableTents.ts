// CAVALIERE DA TAVOLO autoportante, UNO per A4. Tre pannelli: faccia A (sopra, ruotata 180°),
// faccia B (sotto, dritta) e una BASE con LINGUETTA che si infila in una FESSURA al bordo-base
// della faccia A → si chiude a triangolo e sta in piedi da solo. Su entrambe le facce: QR alla
// galleria foto dell'evento, spiegazione e LOGO PLANFULLY reale.
// Ogni faccia lascia una fascia bianca (lip) sul bordo che tocca il tavolo: lì sta la fessura,
// così la linea non finisce mai sopra il testo.

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export async function exportTableTents(opts: { url: string; title?: string; subtitle?: string }) {
  if (!opts.url) throw new Error('Manca il link della galleria')
  const QRCode = (await import('qrcode')).default
  const html2canvas = (await import('html2canvas-pro')).default
  const { jsPDF } = await import('jspdf')

  const title = opts.title || 'Le foto del nostro evento'
  const subtitle = opts.subtitle || 'Inquadra il QR con la fotocamera del telefono: vedi tutte le foto dell’evento e carichi le tue. È il nostro album condiviso, in un posto solo.'

  const qr = await QRCode.toDataURL(opts.url, { margin: 1, width: 720, color: { dark: '#1A1714', light: '#ffffff' } })

  // LOGO Planfully reale (lockup orizzontale: simbolo + wordmark). Rimuoviamo la media-query
  // dark-mode dell'SVG (altrimenti su OS scuro il logo diventa avorio → invisibile sull'avorio).
  let logoTag = '<span style="font-family:Georgia,serif;font-size:24px;letter-spacing:.01em">Planfully</span>'
  try {
    let txt = await (await fetch('/brand/planfully-logo-horizontal.svg')).text()
    txt = txt.replace(/@media\(prefers-color-scheme:dark\)\{[^{}]*\{[^{}]*\}\}/g, '')
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt)
    logoTag = `<img src="${url}" alt="Planfully" style="height:34px;width:auto;display:block"/>`
  } catch { /* resta il wordmark testuale */ }

  // ── Geometria A4 (mm) ──────────────────────────────────────────────
  const PW = 210
  const W = 150, H = 100, BASE = 50, TABH = 10, LIP = 13   // LIP = fascia bianca sul bordo-tavolo
  const imageH = H - LIP                                    // 87 — area stampata della faccia
  const x0 = (PW - W) / 2, x1 = x0 + W                      // 30 .. 180
  const yTop = 18                                           // bordo-base faccia A (qui la fessura)
  const yApex = yTop + H                                    // 118  piega di colmo
  const yBaseFold = yApex + H                               // 218  piega della base
  const yBaseEnd = yBaseFold + BASE                         // 268
  const yTabEnd = yBaseEnd + TABH                           // 278
  const cx = (x0 + x1) / 2
  const tabHalf = 22, slitHalf = 24

  // Una faccia (stessa proporzione dell'area stampata W×imageH), rasterizzata offscreen (hex puri).
  const domW = 620, domH = Math.round(domW * imageH / W)
  const face = document.createElement('div')
  face.style.cssText = `position:fixed;left:-99999px;top:0;width:${domW}px;height:${domH}px;background:#FDFBF6;box-sizing:border-box;padding:22px 26px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;font-family:Arial,Helvetica,sans-serif;color:#1A1714`
  face.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:34px">${logoTag}</div>
    <img src="${qr}" alt="" style="width:188px;height:188px;display:block" crossorigin="anonymous"/>
    <div style="text-align:center;max-width:95%">
      <div style="font-size:19px;font-weight:700;line-height:1.15">${esc(title)}</div>
      <div style="font-size:12px;color:#5f574c;margin-top:5px;line-height:1.32">${esc(subtitle)}</div>
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

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(120, 120, 120)
  pdf.text('Ritaglia il contorno e la fessura · piega sulle linee tratteggiate · infila la linguetta della base nella fessura: sta in piedi da solo.', PW / 2, 11, { align: 'center' })

  // facce: l'area stampata lascia la fascia LIP sul bordo-tavolo (in alto per A, in basso per B).
  pdf.addImage(img180, 'PNG', x0, yTop + LIP, W, imageH, undefined, 'FAST')  // faccia A (ruotata)
  pdf.addImage(img, 'PNG', x0, yApex, W, imageH, undefined, 'FAST')          // faccia B (dritta)

  pdf.setFontSize(9); pdf.setTextColor(150, 140, 125)
  pdf.text('BASE — piega e porta la linguetta nella fessura in cima', cx, yBaseFold + BASE / 2, { align: 'center' })

  // contorno di taglio (continuo) con linguetta sporgente in basso
  pdf.setDrawColor(120, 120, 120); pdf.setLineWidth(0.3); pdf.setLineDashPattern([], 0)
  const cut: Array<[number, number]> = [
    [x0, yTop], [x1, yTop], [x1, yBaseEnd],
    [cx + tabHalf, yBaseEnd], [cx + tabHalf, yTabEnd], [cx - tabHalf, yTabEnd], [cx - tabHalf, yBaseEnd],
    [x0, yBaseEnd], [x0, yTop],
  ]
  for (let i = 0; i < cut.length - 1; i++) pdf.line(cut[i]![0], cut[i]![1], cut[i + 1]![0], cut[i + 1]![1])

  // fessura nella fascia bianca della faccia A (sopra l'area stampata → mai sul testo)
  pdf.setFontSize(7); pdf.setTextColor(150, 150, 150)
  pdf.text('fessura (taglia)', cx, yTop + 4, { align: 'center' })
  pdf.setLineWidth(0.5); pdf.setDrawColor(120, 120, 120)
  pdf.line(cx - slitHalf, yTop + 6.5, cx + slitHalf, yTop + 6.5)

  // pieghe (tratteggiate)
  pdf.setDrawColor(196, 154, 92); pdf.setLineWidth(0.3); pdf.setLineDashPattern([1.6, 1.2], 0)
  pdf.line(x0, yApex, x1, yApex)
  pdf.line(x0, yBaseFold, x1, yBaseFold)
  pdf.line(cx - tabHalf, yBaseEnd, cx + tabHalf, yBaseEnd)
  pdf.setLineDashPattern([], 0)

  pdf.save('cavaliere-tavolo.pdf')
}
