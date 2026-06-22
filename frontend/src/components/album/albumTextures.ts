import * as THREE from 'three'
import type { GrainKey } from './albumCatalog'

// ============================================================================
// Texture procedurali (canvas) per il mockup 3D — nessun asset esterno.
// HEIGHT map -> NORMAL map (Sobel). Il grain dipende dal tessuto; il decoro
// "baked" (floreale / cornice incisa) dal modello. Il colore è solo material.color.
// ============================================================================

export type BakedDecoro = 'none' | 'floral' | 'frame'

const SIZE = 512

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(seed: number) {
  const rnd = mulberry32(seed)
  const G = 256
  const grid = new Float32Array(G * G)
  for (let i = 0; i < grid.length; i++) grid[i] = rnd()
  const at = (x: number, y: number) => grid[((y & (G - 1)) * G) + (x & (G - 1))] ?? 0
  const smooth = (t: number) => t * t * (3 - 2 * t)
  function noise(x: number, y: number) {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = x - xi, yf = y - yi
    const u = smooth(xf), v = smooth(yf)
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v)
  }
  return function fbm(x: number, y: number, oct = 4, freq = 1) {
    let amp = 0.5, sum = 0, norm = 0
    for (let o = 0; o < oct; o++) { sum += amp * noise(x * freq, y * freq); norm += amp; amp *= 0.5; freq *= 2 }
    return sum / norm
  }
}

function heightCanvas(grain: GrainKey): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(SIZE, SIZE)
  const d = img.data
  const fbm = makeNoise(grain.length * 7 + 13)
  const set = (i: number, h: number) => { const v = Math.max(0, Math.min(255, h * 255)); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255 }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      const nx = x / SIZE, ny = y / SIZE
      let h = 0.5
      switch (grain) {
        case 'leather':
          h = 0.5 + (fbm(nx * 90, ny * 90, 5) - 0.5) * 0.34
          h += (fbm(nx * 240, ny * 240, 3) - 0.5) * 0.12
          break
        case 'leatherCoarse':
          h = 0.5 + (fbm(nx * 45, ny * 45, 5) - 0.5) * 0.9
          h += (fbm(nx * 160, ny * 160, 3) - 0.5) * 0.2
          break
        case 'fine':
          h = 0.5 + (fbm(nx * 300, ny * 300, 2) - 0.5) * 0.25
          break
        case 'sparkle': {
          h = 0.5 + (fbm(nx * 120, ny * 120, 3) - 0.5) * 0.2
          const s = fbm(nx * 520, ny * 520, 1)
          if (s > 0.82) h += (s - 0.82) * 3.5
          break
        }
        case 'weave': {
          const cells = 18
          const u = nx * cells, v = ny * cells
          const cu = Math.floor(u), cv = Math.floor(v)
          const over = (cu + cv) % 2 === 0
          const fu = u - cu - 0.5, fv = v - cv - 0.5
          const rib = over ? Math.cos(fu * Math.PI) : Math.cos(fv * Math.PI)
          h = 0.5 + rib * 0.45 + (fbm(nx * 200, ny * 200, 2) - 0.5) * 0.08
          break
        }
        case 'quilt': {
          const cells = 7
          const u = nx * cells, v = ny * cells
          const r1 = u + v, r2 = u - v
          const puff = Math.cos(r1 * Math.PI) + Math.cos(r2 * Math.PI)
          h = 0.5 + puff * 0.22
          const bu = (u + v) % 1, bv = (u - v) % 1
          const db = Math.hypot(bu - 0.5, bv - 0.5)
          if (db < 0.12) h -= (0.12 - db) * 1.6
          h += (fbm(nx * 220, ny * 220, 2) - 0.5) * 0.05
          break
        }
      }
      set(i, h)
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// decoro floreale a secco (Ninfea/Elektra/Artemis/Cordelia) in rilievo
function drawFloral(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#ffffff'
  const stems = 3
  for (let s = 0; s < stems; s++) {
    const baseX = SIZE * (0.12 + s * 0.06)
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(baseX, SIZE * 0.98)
    ctx.bezierCurveTo(baseX + 40, SIZE * 0.7, baseX - 50, SIZE * 0.45, baseX + 30, SIZE * 0.06)
    ctx.stroke()
    for (let f = 0; f < 4; f++) {
      const t = 0.15 + f * 0.22
      const fx = baseX + Math.sin(t * 6 + s) * 36 + 10
      const fy = SIZE * (0.92 - t * 0.82)
      const r = 22 + (f % 2) * 9
      ctx.fillStyle = '#ffffff'
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + s
        ctx.beginPath()
        ctx.ellipse(fx + Math.cos(a) * r * 0.6, fy + Math.sin(a) * r * 0.6, r * 0.55, r * 0.28, a, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#cccccc'
      ctx.beginPath(); ctx.arc(fx, fy, r * 0.28, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}

// cornice incisa classica (Leda/Roman/Solar): doppio filetto + svolazzo
function drawFrame(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.strokeStyle = '#dddddd'
  const m = SIZE * 0.12
  ctx.lineWidth = 6
  ctx.strokeRect(m, m, SIZE - 2 * m, SIZE - 2 * m)
  ctx.lineWidth = 2
  const m2 = m + 14
  ctx.strokeRect(m2, m2, SIZE - 2 * m2, SIZE - 2 * m2)
  // svolazzo centrale
  ctx.lineWidth = 4
  ctx.beginPath()
  const cx = SIZE / 2, cy = SIZE / 2
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const r = 36 + Math.sin(a * 3) * 14
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r
    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.restore()
}

function heightToNormal(srcCanvas: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = srcCanvas.width, h = srcCanvas.height
  const src = srcCanvas.getContext('2d')!.getImageData(0, 0, w, h).data
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  const octx = out.getContext('2d')!
  const dst = octx.createImageData(w, h)
  const lum = (x: number, y: number) => { x = (x + w) % w; y = (y + h) % h; return (src[(y * w + x) * 4] ?? 0) / 255 }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (lum(x - 1, y) - lum(x + 1, y)) * strength
      const dy = (lum(x, y - 1) - lum(x, y + 1)) * strength
      const nz = 1.0
      const len = Math.hypot(dx, dy, nz)
      const i = (y * w + x) * 4
      dst.data[i] = ((dx / len) * 0.5 + 0.5) * 255
      dst.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      dst.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255
      dst.data[i + 3] = 255
    }
  }
  octx.putImageData(dst, 0, 0)
  return out
}

export type CoverMaps = { normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture | null }
const _cache = new Map<string, CoverMaps>()

export function getCoverMaps(grain: GrainKey, decoro: BakedDecoro): CoverMaps {
  const key = `${grain}|${decoro}`
  const cached = _cache.get(key)
  if (cached) return cached

  const hc = heightCanvas(grain)
  const hctx = hc.getContext('2d')!
  if (decoro === 'floral') drawFloral(hctx)
  if (decoro === 'frame') drawFrame(hctx)

  const base = grain === 'quilt' || grain === 'weave' ? 3.2 : 2.0
  const strength = decoro === 'none' ? base : Math.max(base, 3.0)
  const normalCanvas = heightToNormal(hc, strength)

  const normalMap = new THREE.CanvasTexture(normalCanvas)
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping
  normalMap.colorSpace = THREE.NoColorSpace
  normalMap.anisotropy = 8

  let roughnessMap: THREE.CanvasTexture | null = null
  if (grain === 'sparkle') {
    const rt = new THREE.CanvasTexture(hc)
    rt.wrapS = rt.wrapT = THREE.RepeatWrapping
    rt.colorSpace = THREE.NoColorSpace
    roughnessMap = rt
  }

  const maps: CoverMaps = { normalMap, roughnessMap }
  _cache.set(key, maps)
  return maps
}

// texture testo titolo (inciso) — overlay trasparente sulla copertina
export function makeTitleTexture(title: string, light: boolean): THREE.CanvasTexture {
  const w = 1024, h = 256
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  ctx.font = 'italic 96px Georgia, "Times New Roman", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const ink = light ? 'rgba(70,52,34,0.92)' : 'rgba(245,240,232,0.95)'
  // leggero rilievo
  ctx.fillStyle = light ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
  ctx.fillText(title, w / 2, h / 2 + 3)
  ctx.fillStyle = ink
  ctx.fillText(title, w / 2, h / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
