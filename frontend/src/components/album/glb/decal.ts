// La decalcomania della copertina: nomi (o iniziali), data, e il logo del catalogo (cod.NN)
// disegnati su un canvas trasparente che diventa la texture del piano «Decal» sopra il piatto.
// Le posizioni seguono il layout del modello (dove la tavola mette i nomi).
import * as THREE from 'three'
import { modelLayout, type Cover } from '@/components/album/albumCatalog'
import { swatchUrl } from '@/components/album/catalog/swatches.generated'
import { LAYOUT_SPEC, logoToInk, inkRgb } from '@/components/album/glb/layoutSpec'
import { hasLogoTemplate, LOGO_TEMPLATES } from '@/components/album/glb/logoTemplates'
import { composeLogo, fontsOf, loadLogoFont, onLogoAssetsReady } from '@/components/album/glb/logoCompose'

/** Data in italiano («15 settembre 2022») da una ISO. */
export const dateIt = (iso?: string | null): string | undefined => {
  if (!iso) return undefined
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}
const fontsRequested = new Set<string>()

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
export function drawDecal(cover: Cover & { logoKey?: string; logoTone?: string; ink?: DecalInk; eventDate?: string | null }): THREE.CanvasTexture | null {
  const W = 2048, H = 2048
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d'); if (!ctx) return null
  const layout = modelLayout(cover.model)
  const names = (cover.title ?? '').trim()
  void LOGO_TEMPLATES
  const ink = cover.ink === 'white' ? 'rgba(250,246,238,0.96)' : cover.ink === 'gold' ? 'rgba(212,176,96,0.98)' : cover.ink === 'silver' ? 'rgba(215,215,220,0.98)' : 'rgba(58,44,30,0.94)'
  let drew = false
  const spec = LAYOUT_SPEC[layout]
  const p = spec.names
  // il logo del catalogo RICOSTRUITO con i nomi veri (template: ornamento estratto + font identificato);
  // se il template non c'è ancora, il ritaglio del catalogo tinto
  let composed: HTMLCanvasElement | null = null
  if (cover.logoKey && hasLogoTemplate(cover.logoKey)) {
    const code = cover.logoKey
    for (const f of fontsOf(code)) if (!fontsRequested.has(f)) { fontsRequested.add(f); void loadLogoFont(f).then(() => onReady?.()) }
    onLogoAssetsReady(() => onReady?.())
    composed = composeLogo({ code, names, date: dateIt(cover.eventDate), ink: inkRgb(cover.ink) }, Math.round(spec.logo.w * W))
  }
  if (composed) {
    ctx.drawImage(composed, Math.round(W * spec.logo.x - composed.width / 2), Math.round(H * spec.logo.y))
    drew = true
  }
  const logo = composed ? null : img(swatchUrl(cover.logoKey))
  if (logo) {
    const lw = Math.round(spec.logo.w * W), lh = Math.round(lw * (logo.naturalHeight / logo.naturalWidth))
    ctx.drawImage(logoToInk(logo, lw, lh, inkRgb(cover.ink)), Math.round(W * spec.logo.x - lw / 2), Math.round(H * spec.logo.y))
    drew = true
  } else if (layout === 'monogram' && names) {
    ctx.save(); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `500 ${Math.round(H * 0.22)}px "Bodoni Moda", "Playfair Display", Georgia, serif`
    ctx.fillText(initialsOf(names), W / 2, H * 0.46); ctx.restore(); drew = true
  }
  if (names && !logo && !composed && (cover.textLayout ?? 'model') === 'model') {
    ctx.save(); ctx.fillStyle = ink; ctx.textAlign = p.align ?? 'center'; ctx.textBaseline = 'middle'
    ctx.font = `italic 400 ${Math.round(H * p.size)}px "Fraunces", "Cormorant Garamond", Georgia, serif`
    ctx.fillText(names, W * p.x, H * p.y); ctx.restore(); drew = true
  }
  if (!drew) return null
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false
  return t
}
