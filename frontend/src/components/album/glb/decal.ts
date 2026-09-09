// La decalcomania della copertina: nomi (o iniziali), data, e il logo del catalogo (cod.NN)
// disegnati su un canvas trasparente che diventa la texture del piano «Decal» sopra il piatto.
// Le posizioni seguono il layout del modello (dove la tavola mette i nomi).
import * as THREE from 'three'
import { modelLayout, type Cover } from '@/components/album/albumCatalog'
import { swatchUrl } from '@/components/album/catalog/swatches.generated'

const imgCache = new Map<string, HTMLImageElement | null>()
let onReady: (() => void) | null = null
export function onDecalImagesReady(cb: () => void) { onReady = cb }
function img(url?: string): HTMLImageElement | null {
  if (!url) return null
  if (imgCache.has(url)) return imgCache.get(url) ?? null
  const el = new Image(); el.crossOrigin = 'anonymous'
  imgCache.set(url, null)
  el.onload = () => { imgCache.set(url, el); onReady?.() }
  el.src = url
  return null
}

function initialsOf(t?: string) { return (t ?? '').split(/[&e,+\s]+/i).filter((w) => w && !/^(e|and|&)$/i.test(w)).map((w) => w[0]!.toUpperCase()).slice(0, 2).join(' ') }

export type DecalInk = 'ink' | 'white' | 'gold' | 'silver'
export function drawDecal(cover: Cover & { logoKey?: string; logoTone?: string; ink?: DecalInk }): THREE.CanvasTexture | null {
  const W = 2048, H = 2048
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d'); if (!ctx) return null
  const layout = modelLayout(cover.model)
  const names = (cover.title ?? '').trim()
  const ink = cover.ink === 'white' ? 'rgba(250,246,238,0.96)' : cover.ink === 'gold' ? 'rgba(212,176,96,0.98)' : cover.ink === 'silver' ? 'rgba(215,215,220,0.98)' : 'rgba(58,44,30,0.94)'
  let drew = false
  // posizione dei nomi per layout (frazioni della copertina, origine in alto a sinistra)
  const pos: Record<string, { x: number; y: number; s: number; align?: CanvasTextAlign }> = {
    monogram: { x: 0.5, y: 0.66, s: 0.045 }, fascia: { x: 0.74, y: 0.5, s: 0.03 }, 'fascia-ornament': { x: 0.5, y: 0.46, s: 0.06 },
    oblique: { x: 0.62, y: 0.86, s: 0.055 }, 'swarovski-line': { x: 0.34, y: 0.5, s: 0.03 }, 'swarovski-cluster': { x: 0.5, y: 0.72, s: 0.055 },
    plate: { x: 0.5, y: 0.74, s: 0.05 }, 'photo-vertical': { x: 0.29, y: 0.78, s: 0.05 }, 'photo-panoramic': { x: 0.5, y: 0.72, s: 0.055 },
    'photo-small': { x: 0.6, y: 0.64, s: 0.042 }, 'photo-full': { x: 0.5, y: 0.88, s: 0.05 }, trilogy: { x: 0.5, y: 0.74, s: 0.048 },
    print: { x: 0.5, y: 0.82, s: 0.05 }, laser: { x: 0.5, y: 0.5, s: 0.06 }, plain: { x: 0.5, y: 0.84, s: 0.05 },
  }
  const p = pos[layout] ?? pos.plain!
  // il logo del catalogo (ritaglio cod.NN): centrato sopra i nomi, in tono
  const logo = img(swatchUrl(cover.logoKey))
  if (logo) {
    const lw = W * 0.34, lh = lw * (logo.naturalHeight / logo.naturalWidth)
    ctx.save()
    // dal riquadro bianco al solo tratto: moltiplico e uso il luma come alpha
    const tmp = document.createElement('canvas'); tmp.width = Math.round(lw); tmp.height = Math.round(lh)
    const tc = tmp.getContext('2d')!; tc.drawImage(logo, 0, 0, tmp.width, tmp.height)
    const d = tc.getImageData(0, 0, tmp.width, tmp.height); const px = d.data
    const [r, g, b] = cover.ink === 'white' ? [250, 246, 238] : cover.ink === 'gold' ? [212, 176, 96] : cover.ink === 'silver' ? [215, 215, 220] : [58, 44, 30]
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114) / 255
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = Math.round((1 - lum) * 255)
    }
    tc.putImageData(d, 0, 0)
    ctx.drawImage(tmp, W * p.x - lw / 2, H * (p.y - 0.02) - lh, lw, lh)
    ctx.restore(); drew = true
  } else if (layout === 'monogram' && names) {
    ctx.save(); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `500 ${Math.round(H * 0.22)}px "Bodoni Moda", "Playfair Display", Georgia, serif`
    ctx.fillText(initialsOf(names), W / 2, H * 0.46); ctx.restore(); drew = true
  }
  if (names && (cover.textLayout ?? 'model') === 'model') {
    ctx.save(); ctx.fillStyle = ink; ctx.textAlign = p.align ?? 'center'; ctx.textBaseline = 'middle'
    ctx.font = `italic 400 ${Math.round(H * p.s)}px "Fraunces", "Cormorant Garamond", Georgia, serif`
    ctx.fillText(names, W * p.x, H * p.y); ctx.restore(); drew = true
  }
  if (!drew) return null
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false
  return t
}
