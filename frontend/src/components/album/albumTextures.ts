import * as THREE from 'three'
import type { Decoro } from './albumCatalog'

// ============================================================================
// Decori incisi/stampati (canvas → normal map) per il mockup 3D.
// La GRANA del materiale arriva da una texture REALE (bumpMap, vedi componente):
// qui generiamo solo l'ornamento del modello: floreale, cornice incisa, stampa.
// ============================================================================

const SIZE = 512

// decoro floreale a secco (Ninfea…)
function drawFloral(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#ffffff'
  for (let s = 0; s < 3; s++) {
    const baseX = SIZE * (0.12 + s * 0.06)
    ctx.lineWidth = 8
    ctx.beginPath(); ctx.moveTo(baseX, SIZE * 0.98)
    ctx.bezierCurveTo(baseX + 40, SIZE * 0.7, baseX - 50, SIZE * 0.45, baseX + 30, SIZE * 0.06); ctx.stroke()
    for (let f = 0; f < 4; f++) {
      const t = 0.15 + f * 0.22
      const fx = baseX + Math.sin(t * 6 + s) * 36 + 10
      const fy = SIZE * (0.92 - t * 0.82)
      const r = 22 + (f % 2) * 9
      ctx.fillStyle = '#ffffff'
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + s
        ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * r * 0.6, fy + Math.sin(a) * r * 0.6, r * 0.55, r * 0.28, a, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#bbbbbb'; ctx.beginPath(); ctx.arc(fx, fy, r * 0.28, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}

// cornice incisa classica (Leda/Brand/Claire…)
function drawFrame(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.save(); ctx.strokeStyle = '#e0e0e0'
  const m = SIZE * 0.12
  ctx.lineWidth = 6; ctx.strokeRect(m, m, SIZE - 2 * m, SIZE - 2 * m)
  ctx.lineWidth = 2; const m2 = m + 14; ctx.strokeRect(m2, m2, SIZE - 2 * m2, SIZE - 2 * m2)
  ctx.lineWidth = 4; ctx.beginPath()
  const cx = SIZE / 2, cy = SIZE / 2
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const r = 36 + Math.sin(a * 3) * 14
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r
    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.stroke(); ctx.restore()
}

// stampa decorativa all-over (Stampati: volute/intrecci)
function drawPrint(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.save(); ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 3
  const step = SIZE / 5
  for (let gx = 0; gx < 5; gx++) {
    for (let gy = 0; gy < 5; gy++) {
      const cx = gx * step + step / 2, cy = gy * step + step / 2
      ctx.beginPath()
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const r = a * 4.0
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        if (r > step * 0.46) break
      }
      ctx.stroke()
    }
  }
  ctx.restore()
}

function heightToNormal(srcCanvas: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = srcCanvas.width, h = srcCanvas.height
  const src = srcCanvas.getContext('2d')!.getImageData(0, 0, w, h).data
  const out = document.createElement('canvas'); out.width = w; out.height = h
  const octx = out.getContext('2d')!
  const dst = octx.createImageData(w, h)
  const lum = (x: number, y: number) => { x = (x + w) % w; y = (y + h) % h; return (src[(y * w + x) * 4] ?? 128) / 255 }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (lum(x - 1, y) - lum(x + 1, y)) * strength
      const dy = (lum(x, y - 1) - lum(x, y + 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      dst.data[i] = ((dx / len) * 0.5 + 0.5) * 255
      dst.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      dst.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      dst.data[i + 3] = 255
    }
  }
  octx.putImageData(dst, 0, 0)
  return out
}

const _decoroCache = new Map<string, THREE.CanvasTexture | null>()

// normal map dell'ornamento del modello (null se nessun decoro inciso)
export function getDecoroNormal(decoro: Decoro): THREE.CanvasTexture | null {
  if (_decoroCache.has(decoro)) return _decoroCache.get(decoro)!
  let tex: THREE.CanvasTexture | null = null
  if (decoro === 'floral' || decoro === 'frame' || decoro === 'print') {
    const c = document.createElement('canvas'); c.width = c.height = SIZE
    const ctx = c.getContext('2d')!
    if (decoro === 'floral') drawFloral(ctx)
    else if (decoro === 'frame') drawFrame(ctx)
    else drawPrint(ctx)
    const normalCanvas = heightToNormal(c, 3.2)
    tex = new THREE.CanvasTexture(normalCanvas)
    tex.colorSpace = THREE.NoColorSpace
    tex.anisotropy = 8
  }
  _decoroCache.set(decoro, tex)
  return tex
}

// texture testo titolo (inciso) — overlay trasparente sulla copertina
export function makeTitleTexture(title: string, light: boolean): THREE.CanvasTexture {
  const w = 1024, h = 256
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  ctx.font = 'italic 96px Georgia, "Times New Roman", serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const ink = light ? 'rgba(70,52,34,0.92)' : 'rgba(245,240,232,0.95)'
  ctx.fillStyle = light ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
  ctx.fillText(title, w / 2, h / 2 + 3)
  ctx.fillStyle = ink
  ctx.fillText(title, w / 2, h / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
