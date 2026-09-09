// La decalcomania della copertina: nomi (o iniziali), data, e il logo del catalogo (cod.NN)
// disegnati su un canvas trasparente che diventa la texture del piano «Decal» sopra il piatto.
// Le posizioni seguono il layout del modello (dove la tavola mette i nomi).
import * as THREE from 'three'
import { modelLayout, type Cover } from '@/components/album/albumCatalog'
import { swatchUrl } from '@/components/album/catalog/swatches.generated'
import { LAYOUT_SPEC, logoToInk, inkRgb } from '@/components/album/glb/layoutSpec'

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
  const spec = LAYOUT_SPEC[layout]
  const p = spec.names
  // il logo del catalogo (ritaglio cod.NN → tratto nel colore d'inchiostro), dal suo bordo superiore
  const logo = img(swatchUrl(cover.logoKey))
  if (logo) {
    const lw = Math.round(spec.logo.w * W), lh = Math.round(lw * (logo.naturalHeight / logo.naturalWidth))
    ctx.drawImage(logoToInk(logo, lw, lh, inkRgb(cover.ink)), Math.round(W * spec.logo.x - lw / 2), Math.round(H * spec.logo.y))
    drew = true
  } else if (layout === 'monogram' && names) {
    ctx.save(); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `500 ${Math.round(H * 0.22)}px "Bodoni Moda", "Playfair Display", Georgia, serif`
    ctx.fillText(initialsOf(names), W / 2, H * 0.46); ctx.restore(); drew = true
  }
  if (names && !logo && (cover.textLayout ?? 'model') === 'model') {
    ctx.save(); ctx.fillStyle = ink; ctx.textAlign = p.align ?? 'center'; ctx.textBaseline = 'middle'
    ctx.font = `italic 400 ${Math.round(H * p.size)}px "Fraunces", "Cormorant Garamond", Georgia, serif`
    ctx.fillText(names, W * p.x, H * p.y); ctx.restore(); drew = true
  }
  if (!drew) return null
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false
  return t
}
