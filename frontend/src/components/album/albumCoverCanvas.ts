// ============================================================================
// Compositore COPERTINA su canvas — sorgente della texture stampata sul piatto 3D.
// Tutto parametrico: materiale (texture reale tinta dal colore) + decoro del modello
// (fedele alle tavole tecniche) + accessori (Swarovski/targhetta/iniziali/logo) + foto
// + nomi. Ogni selezione del configuratore ridisegna → il 3D si aggiorna LIVE.
// ============================================================================
import { materialByKey, modelLayout, modelByKey, COLORS, type Cover, type Layout } from './albumCatalog'

const LONG = 1280 // lato lungo del canvas (px) → testo nitido

function hexLum(hex?: string): number {
  if (!hex) return 0.78
  const m = hex.replace('#', '')
  if (m.length < 6) return 0.78
  return (parseInt(m.slice(0, 2), 16) * 0.299 + parseInt(m.slice(2, 4), 16) * 0.587 + parseInt(m.slice(4, 6), 16) * 0.114) / 255
}
function initialsOf(title?: string): string {
  const parts = (title || '').split(/[^A-Za-zÀ-ÿ]+/).filter(Boolean)
  return parts.map((s) => s[0]!.toUpperCase()).slice(0, 2).join('') || 'A'
}
function namesOf(title?: string): string { return (title || '').trim() }

// CoverCanvas: possiede il canvas, la cache immagini (asincrone) e il ridisegno.
// onChange() viene chiamato quando una immagine finisce di caricare → ridisegna.
export class CoverCanvas {
  canvas: HTMLCanvasElement = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private cache = new Map<string, HTMLImageElement>()
  private onChange: () => void
  private last: Cover | null = null
  private aspect = 1 // w/h del fronte

  constructor(onChange: () => void) {
    this.onChange = onChange
    this.ctx = this.canvas.getContext('2d')!
  }

  // immagine dalla cache; se non pronta avvia il load e ritorna null (ridisegno on-load)
  private img(url?: string | null): HTMLImageElement | null {
    if (!url) return null
    const c = this.cache.get(url)
    if (c) return c.complete && c.naturalWidth ? c : null
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => this.onChange()
    im.onerror = () => {}
    im.src = url
    this.cache.set(url, im)
    return null
  }

  setAspect(aspect: number) {
    const a = Math.max(0.5, Math.min(2, aspect))
    if (Math.abs(a - this.aspect) < 0.001 && this.canvas.width) return
    this.aspect = a
    if (a >= 1) { this.canvas.width = LONG; this.canvas.height = Math.round(LONG / a) }
    else { this.canvas.height = LONG; this.canvas.width = Math.round(LONG * a) }
  }

  paint(cover: Cover) {
    this.last = cover
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height
    const mat = materialByKey(cover.fabric) ?? materialByKey('alcantara')!
    const colorHex = cover.color || mat.swatch
    const isWood = !!mat.albedo
    const woodTex = isWood ? (cover.colorKey ? COLORS[cover.colorKey]?.tex : undefined) || '/textures/wood/noce.jpg' : undefined
    const grain = this.img(`/textures/materials/${mat.texture}.jpg`)

    // ---- base materiale ----
    ctx.clearRect(0, 0, W, H)
    if (isWood) {
      const wimg = this.img(woodTex)
      if (wimg) drawCover(ctx, wimg, 0, 0, W, H)
      else { ctx.fillStyle = colorHex; ctx.fillRect(0, 0, W, H) }
    } else {
      ctx.fillStyle = colorHex; ctx.fillRect(0, 0, W, H)
      if (grain) { // grana reale del tessuto in multiply leggero
        ctx.save(); ctx.globalAlpha = mat.pbr.sheen ? 0.16 : 0.24; ctx.globalCompositeOperation = 'multiply'
        tile(ctx, grain, W, H, 2.0); ctx.restore()
        ctx.save(); ctx.globalAlpha = 0.06; ctx.globalCompositeOperation = 'screen'
        tile(ctx, grain, W, H, 2.0); ctx.restore()
      }
    }

    // ---- luce/ombra copertina (volume) ----
    const sheen = ctx.createLinearGradient(0, 0, W, H)
    sheen.addColorStop(0, 'rgba(255,255,255,0.10)'); sheen.addColorStop(0.4, 'rgba(255,255,255,0)')
    sheen.addColorStop(1, 'rgba(0,0,0,0.06)')
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H)
    // piega del dorso a sinistra
    const fold = ctx.createLinearGradient(0, 0, W * 0.08, 0)
    fold.addColorStop(0, 'rgba(0,0,0,0.22)'); fold.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = fold; ctx.fillRect(0, 0, W * 0.08, H)

    // ---- decoro del modello ----
    const layout = modelLayout(cover.model)
    const light = isWood ? false : hexLum(colorHex) > 0.55
    const ink = light ? 'rgba(60,46,32,0.92)' : 'rgba(244,238,228,0.95)'
    const inkSoft = light ? 'rgba(60,46,32,0.55)' : 'rgba(244,238,228,0.6)'
    const names = namesOf(cover.title)
    this.drawDecoro(ctx, W, H, layout, cover, { ink, inkSoft, light, names })

    // ---- accessori (finiture) ----
    const fin = cover.finishes ?? []
    if (fin.includes('iniziali')) brassInitials(ctx, W, H, initialsOf(cover.title))
    if (fin.includes('swarovski') && layout !== 'oblique' && !layout.startsWith('swarovski')) crystalLine(ctx, W * 0.18, H * 0.8, W * 0.82, H * 0.8)
    if (fin.includes('targhetta')) plaque(ctx, W / 2, H * 0.86, W * 0.3, H * 0.09, false, '')
    if (fin.includes('logo')) logoMark(ctx, W / 2, H * 0.92, H * 0.05, inkSoft)

    this.onChange()
  }

  repaint() { if (this.last) this.paint(this.last) }

  private drawDecoro(ctx: CanvasRenderingContext2D, W: number, H: number, layout: Layout, cover: Cover,
    o: { ink: string; inkSoft: string; light: boolean; names: string }) {
    const decoro = modelByKey(cover.model)?.decoro
    const photo = this.img(cover.photo_url) || this.img('/textures/demo/couple.jpg')
    switch (layout) {
      case 'monogram': {
        const sz = Math.min(W, H) * 0.3
        engraved(ctx, initialsOf(cover.title), W / 2, H * 0.46, sz, o.light)
        if (o.names) script(ctx, o.names.toLowerCase(), W / 2, H * 0.46 + sz * 0.62, sz * 0.16, o.inkSoft)
        break
      }
      case 'fascia': { // banda + linea cristalli + targhetta nomi (Claire/Plaza)
        band(ctx, W, H, 0.5, 0.2, o.light ? '#6f7f93' : '#e9e3d4')
        crystalLine(ctx, W * 0.08, H * 0.5, W * 0.62, H * 0.5)
        plaque(ctx, W * 0.74, H * 0.5, W * 0.36, H * 0.12, decoro === 'ottone', o.names)
        break
      }
      case 'fascia-ornament': { // banda cremisi + doppia linea cristalli + nomi (Thea/Comete)
        const cream = '#efe9da'
        band(ctx, W, H, 0.46, 0.22, cream)
        crystalLine(ctx, W * 0.16, H * 0.36, W * 0.84, H * 0.36)
        crystalLine(ctx, W * 0.16, H * 0.56, W * 0.84, H * 0.56)
        script(ctx, o.names, W / 2, H * 0.46, H * 0.07, 'rgba(70,52,34,0.9)')
        break
      }
      case 'oblique': { // taglio diagonale + linea cristalli + nomi (Almond)
        ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H * 0.62); ctx.lineTo(W, H); ctx.closePath()
        ctx.fillStyle = '#f1ece1'; ctx.fill(); ctx.restore()
        crystalLine(ctx, 0, H * 0.66, W, H * 0.49)
        script(ctx, o.names, W * 0.62, H * 0.86, H * 0.066, 'rgba(70,52,34,0.9)')
        break
      }
      case 'swarovski-line': { // riga verticale cristalli + targhetta (Diez)
        crystalLineV(ctx, W * 0.6, H * 0.12, H * 0.88)
        plaque(ctx, W * 0.34, H * 0.5, W * 0.4, H * 0.12, decoro === 'ottone', o.names)
        break
      }
      case 'swarovski-cluster': { // grappolo cristalli + nomi (Bouquet/Ninfea/Xante)
        cluster(ctx, W / 2, H * 0.4, Math.min(W, H) * 0.18)
        if (o.names) script(ctx, o.names, W / 2, H * 0.72, H * 0.06, o.ink)
        break
      }
      case 'plate': { // placca metallo centrale (Rimboccato/Adel/Almond-base)
        plaque(ctx, W / 2, H * 0.5, W * 0.32, H * 0.18, decoro === 'ottone', '')
        logoMark(ctx, W / 2, H * 0.5, H * 0.045, 'rgba(20,22,26,0.6)')
        if (o.names) script(ctx, o.names, W / 2, H * 0.74, H * 0.055, o.ink)
        break
      }
      case 'photo-vertical': { photoBox(ctx, photo, W * 0.56, H * 0.5, W * 0.4, H * 0.62); script(ctx, o.names, W * 0.27, H * 0.78, H * 0.05, o.ink); break }
      case 'photo-panoramic': { photoBox(ctx, photo, W * 0.5, H * 0.42, W * 0.78, H * 0.3); script(ctx, o.names, W / 2, H * 0.72, H * 0.06, o.ink); break }
      case 'photo-small': { photoBox(ctx, photo, W * 0.6, H * 0.42, W * 0.34, H * 0.26); script(ctx, o.names, W * 0.6, H * 0.64, H * 0.045, o.ink); break }
      case 'photo-full': { photoBox(ctx, photo, W / 2, H / 2, W * 0.9, H * 0.9); script(ctx, o.names, W / 2, H * 0.88, H * 0.055, 'rgba(255,255,255,0.95)'); break }
      case 'trilogy': { // trittico foto
        const pw = W * 0.2, gap = W * 0.04
        for (let i = -1; i <= 1; i++) photoBox(ctx, photo, W / 2 + i * (pw + gap), H * 0.45, pw, pw)
        if (o.names) script(ctx, o.names, W / 2, H * 0.74, H * 0.05, o.ink)
        break
      }
      case 'print': { sprig(ctx, W / 2, H * 0.62, Math.min(W, H) * 0.16, o.light); script(ctx, o.names, W / 2, H * 0.82, H * 0.055, o.ink); break }
      case 'laser': { engravedFrame(ctx, W, H, o.light); script(ctx, o.names, W / 2, H * 0.5, H * 0.06, o.ink); break }
      case 'plain': default: { if (o.names) script(ctx, o.names, W / 2, H * 0.84, H * 0.05, o.ink); break }
    }
  }
}

// ---------------------------------------------------------------------------
// primitive di disegno
// ---------------------------------------------------------------------------
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height, r = w / h
  let sw = img.width, sh = img.height, sx = 0, sy = 0
  if (ir > r) { sw = img.height * r; sx = (img.width - sw) / 2 } else { sh = img.width / r; sy = (img.height - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}
function tile(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, reps: number) {
  const tw = W / reps, th = tw * (img.height / img.width)
  for (let yy = 0; yy < H; yy += th) for (let xx = 0; xx < W; xx += tw) ctx.drawImage(img, xx, yy, tw, th)
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
// banda orizzontale di materiale contrastante, centrata in cy (frazione), alta fh (frazione)
function band(ctx: CanvasRenderingContext2D, W: number, H: number, cy: number, fh: number, color: string) {
  const y = H * (cy - fh / 2), h = H * fh
  ctx.save()
  ctx.fillStyle = color; ctx.fillRect(0, y, W, h)
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)')
  ctx.fillStyle = g; ctx.fillRect(0, y, W, h)
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(0, y, W, 2); ctx.fillRect(0, y + h - 2, W, 2)
  ctx.restore()
}
// fila orizzontale di cristalli (pietre) tra due punti
function crystalLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const r = Math.max(3.5, len * 0.0085)
  const n = Math.floor(len / (r * 2.1))
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; stone(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r) }
}
function crystalLineV(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number) { crystalLine(ctx, x, y1, x, y2) }
function stone(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(x + r * 0.18, y + r * 0.22, r, 0, Math.PI * 2); ctx.fill()
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#eef1f4'); g.addColorStop(1, '#b9c0c8')
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.34, r * 0.28, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}
function cluster(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 * 1.6; const rr = R * (0.2 + (i % 4) * 0.24); stone(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(4, R * 0.07)) }
}
// targhetta metallo (argento/ottone) con nomi opzionali incisi
function plaque(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, gold: boolean, text: string) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = h * 0.25; ctx.shadowOffsetY = h * 0.06
  const g = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx - w / 2, cy + h / 2)
  if (gold) { g.addColorStop(0, '#f0d89a'); g.addColorStop(0.5, '#c79a4e'); g.addColorStop(1, '#9c7430') }
  else { g.addColorStop(0, '#f1f2f4'); g.addColorStop(0.5, '#cdd0d4'); g.addColorStop(1, '#a7abb1') }
  ctx.fillStyle = g; roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.16); ctx.fill()
  ctx.restore()
  ctx.save(); ctx.strokeStyle = gold ? 'rgba(90,64,24,0.5)' : 'rgba(120,124,130,0.6)'; ctx.lineWidth = Math.max(1, h * 0.02)
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.16); ctx.stroke(); ctx.restore()
  if (text) script(ctx, text, cx, cy, h * 0.42, gold ? 'rgba(70,48,16,0.92)' : 'rgba(60,64,70,0.92)')
}
function brassInitials(ctx: CanvasRenderingContext2D, W: number, H: number, ini: string) {
  ctx.save()
  ctx.font = `600 ${H * 0.12}px "Fraunces Variable", Georgia, serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3
  const grad = ctx.createLinearGradient(0, H * 0.12, 0, H * 0.26)
  grad.addColorStop(0, '#f0d89a'); grad.addColorStop(1, '#a9802f')
  ctx.fillStyle = grad; ctx.fillText(ini.split('').join(' '), W / 2, H * 0.2)
  ctx.restore()
}
function logoMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.2, r * 0.12)
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
}
function engraved(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, light: boolean) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `500 ${size}px "Fraunces Variable", Georgia, serif`
  ctx.fillStyle = light ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)'; ctx.fillText(text, cx + size * 0.012, cy + size * 0.012)
  ctx.fillStyle = light ? 'rgba(70,52,34,0.55)' : 'rgba(255,255,255,0.45)'; ctx.fillText(text, cx - size * 0.012, cy - size * 0.012)
  ctx.fillStyle = light ? 'rgba(74,56,38,0.82)' : 'rgba(235,228,216,0.85)'; ctx.fillText(text, cx, cy)
  ctx.restore()
}
function engravedFrame(ctx: CanvasRenderingContext2D, W: number, H: number, light: boolean) {
  ctx.save(); ctx.strokeStyle = light ? 'rgba(70,52,34,0.5)' : 'rgba(240,234,222,0.55)'
  const m = Math.min(W, H) * 0.1
  ctx.lineWidth = Math.max(2, W * 0.006); ctx.strokeRect(m, m, W - 2 * m, H - 2 * m)
  ctx.lineWidth = Math.max(1, W * 0.002); ctx.strokeRect(m + 14, m + 14, W - 2 * m - 28, H - 2 * m - 28)
  ctx.restore()
}
function sprig(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, light: boolean) {
  ctx.save(); ctx.translate(cx, cy)
  ctx.strokeStyle = light ? 'rgba(90,70,46,0.7)' : 'rgba(230,222,210,0.7)'; ctx.lineWidth = Math.max(2, r * 0.05); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(0, r); ctx.bezierCurveTo(r * 0.2, r * 0.3, -r * 0.2, -r * 0.3, 0, -r); ctx.stroke()
  ctx.fillStyle = 'rgba(196,72,72,0.9)'
  for (let i = 0; i < 5; i++) { const t = i / 4; const x = Math.sin(t * 5) * r * 0.5; const y = r - t * 2 * r; heart(ctx, x, y, r * (0.16 - t * 0.02)) }
  ctx.restore()
}
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y); ctx.beginPath()
  ctx.moveTo(0, s * 0.3); ctx.bezierCurveTo(s, -s * 0.6, s * 1.2, s * 0.5, 0, s)
  ctx.bezierCurveTo(-s * 1.2, s * 0.5, -s, -s * 0.6, 0, s * 0.3); ctx.fill(); ctx.restore()
}
function photoBox(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, w: number, h: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = h * 0.06; ctx.shadowOffsetY = h * 0.02
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - w / 2 - 6, cy - h / 2 - 6, w + 12, h + 12)
  ctx.restore()
  ctx.save(); ctx.beginPath(); ctx.rect(cx - w / 2, cy - h / 2, w, h); ctx.clip()
  if (img) drawCover(ctx, img, cx - w / 2, cy - h / 2, w, h)
  else { ctx.fillStyle = '#cdc6ba'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h) }
  ctx.restore()
}
function script(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, color: string) {
  if (!text) return
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `italic 600 ${size}px "Fraunces Variable", Georgia, serif`
  ctx.fillStyle = color; ctx.fillText(text, cx, cy); ctx.restore()
}
