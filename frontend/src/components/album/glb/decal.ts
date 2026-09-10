// La decalcomania della copertina: il DECORO proprio del modello (stampa, laser, cristalli — ritagliato
// dalle tavole del catalogo), i nomi (o le iniziali), la data, e il logo del catalogo (cod.NN),
// disegnati su un canvas trasparente che diventa la texture del piano «Decal» sopra il piatto.
// Le posizioni seguono il layout del modello (dove la tavola mette i nomi) o l'ancora del decoro.
import * as THREE from 'three'
import { baseDesignKey, modelByKey, modelLayout, sizeByKey, type Cover } from '@/components/album/albumCatalog'
import { swatchUrl } from '@/components/album/catalog/swatches.generated'
import { LAYOUT_SPEC, logoToInk, inkRgb, type LogoPlace } from '@/components/album/glb/layoutSpec'
import { hasLogoTemplate, LOGO_TEMPLATES } from '@/components/album/glb/logoTemplates'
import { composeLogo, fontsOf, loadLogoFont, onLogoAssetsReady } from '@/components/album/glb/logoCompose'
import { decorOf, type Decor } from '@/components/album/glb/decor.generated'

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
function img(url?: string | null): HTMLImageElement | null {
  if (!url) return null
  if (imgCache.has(url)) return imgCache.get(url) ?? null
  const el = new Image(); el.crossOrigin = 'anonymous'
  imgCache.set(url, null)
  el.onload = () => { imgCache.set(url, el); onReady?.() }
  el.src = url
  return null
}

function initialsOf(t?: string) { return (t ?? '').split(/[&e,+\s]+/i).filter((w) => w && !/^(e|and|&)$/i.test(w)).map((w) => w[0]!.toUpperCase()).slice(0, 2).join(' ') }

// ---------- il decoro del modello (bouquet, xante, ninfea, amelie, darling, …) ----------
/** La famiglia del modello («Bouquet Swarovski · Unique» → «bouquet»). */
export const decorFamily = (model?: string): string => baseDesignKey(modelByKey(model))
export const decorFor = (model?: string): Decor | undefined => decorOf(decorFamily(model))
/** «Anna e Marco» → ['Anna', 'Marco'] (per i decori con i nomi ai due lati, come Darling). */
export function splitNames(names: string): [string, string] | null {
  const m = names.match(/^(.+?)\s+(?:e|&|and|\+)\s+(.+)$/i)
  return m ? [m[1]!.trim(), m[2]!.trim()] : null
}
export type NamePlacement = { text: string; x: number; y: number; align: 'left' | 'right' | 'center' }
/** Dove vanno i nomi: l'ancora del decoro del modello se c'è (anche divisa in due), altrimenti quella del layout. */
export function namePlacements(names: string, decor: Decor | undefined, fallback: { x: number; y: number; align?: 'left' | 'right' | 'center' }): NamePlacement[] {
  const n = decor?.names
  if (n && 'split' in n) {
    const parts = splitNames(names)
    if (parts) return [{ text: parts[0], x: n.split[0].x, y: n.split[0].y, align: n.split[0].align ?? 'right' }, { text: parts[1], x: n.split[1].x, y: n.split[1].y, align: n.split[1].align ?? 'left' }]
    return [{ text: names, x: (n.split[0].x + n.split[1].x) / 2, y: n.split[1].y, align: 'center' }]
  }
  if (n) return [{ text: names, x: n.x, y: n.y, align: n.align ?? 'center' }]
  return [{ text: names, x: fallback.x, y: fallback.y, align: fallback.align ?? 'center' }]
}
/** Il tratto (PNG con la sola alpha) tinto nell'inchiostro, alla misura richiesta. */
export function tintAlpha(im: HTMLImageElement, w: number, h: number, rgb: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(im, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; ctx.fillRect(0, 0, w, h)
  return c
}
/** Le immagini del decoro (cache; al primo giro partono in caricamento e arrivano con onDecalImagesReady). */
export function decorImages(decor: Decor): { print: HTMLImageElement | null; stones: HTMLImageElement | null } {
  return { print: img(decor.print), stones: decor.stones ? img(decor.stones) : null }
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
}
export const PLATE_MARGIN = 0.035     // bordo della piastra Cristalwhite rispetto alla copertina (frazione)
/** Disegna il decoro del modello a tutta copertina: stampa (tinta o a colori), fascia, pannello, piastra intagliata, cristalli.
 *  I PNG sono in coordinate della COPERTINA (0..1); `inset` è il bordo che il canvas non copre (decal 3D = 0.02).
 *  true se ha disegnato qualcosa. */
export function drawDecor(ctx: CanvasRenderingContext2D, W: number, H: number, decor: Decor, ink: [number, number, number],
  images: { print: HTMLImageElement | null; stones: HTMLImageElement | null }, opts: { stoneAlpha?: number; inset?: number; skipPlate?: boolean } = {}): boolean {
  const inset = opts.inset ?? 0
  const sc = 1 / (1 - 2 * inset); const ox = -inset * sc * W, oy = -inset * sc * H, dw = W * sc, dh = H * sc
  const rgb: [number, number, number] = decor.tint === 'white' ? [246, 243, 236] : ink
  let drew = false
  if (decor.kind === 'plate') {
    // la piastra bianca (Cristalwhite) con un bordo, poi i fori intagliati: il tessuto resta a vista.
    // Nel 3D col layout «laser» la piastra è una mesh vera (skipPlate): qui restano solo i nomi.
    if (opts.skipPlate) return false
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d')!
    const m = PLATE_MARGIN * sc; const rx = ox + m * W, ry = oy + m * H, rw = dw - 2 * m * W, rh = dh - 2 * m * H
    x.fillStyle = 'rgb(247,245,240)'; roundRect(x, rx, ry, rw, rh, Math.min(rw, rh) * 0.02); x.fill()
    if (images.print) { x.globalCompositeOperation = 'destination-out'; x.drawImage(images.print, ox, oy, dw, dh) }
    ctx.drawImage(c, 0, 0); return true
  }
  if (images.print) {
    if (decor.color) ctx.drawImage(images.print, ox, oy, dw, dh)
    else ctx.drawImage(tintAlpha(images.print, Math.round(dw), Math.round(dh), rgb), ox, oy)
    drew = true
  }
  if (images.stones) {
    ctx.save(); ctx.globalAlpha = opts.stoneAlpha ?? 1; ctx.shadowColor = 'rgba(255,255,255,0.85)'; ctx.shadowBlur = Math.round(W * 0.004)
    ctx.drawImage(images.stones, ox, oy, dw, dh); ctx.restore(); drew = true
  }
  return drew
}
/** Per la piastra 3D (mesh «Band» del layout laser): bianco = piastra, trasparente = foro. Va in alphaMap (canale verde). */
export function plateAlphaCanvas(holes: HTMLImageElement, size = 1024): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = size; c.height = size; const x = c.getContext('2d')!
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size)
  x.globalCompositeOperation = 'destination-out'; x.drawImage(holes, 0, 0, size, size)
  return c
}

export type DecalInk = 'ink' | 'white' | 'gold' | 'silver'
export function drawDecal(cover: Cover & { logoKey?: string; logoTone?: string; ink?: DecalInk; eventDate?: string | null; logoPlace?: LogoPlace }): THREE.CanvasTexture | null {
  const W = 2048, H = 2048
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d'); if (!ctx) return null
  const layout = modelLayout(cover.model)
  const names = (cover.title ?? '').trim()
  void LOGO_TEMPLATES
  const ink = cover.ink === 'white' ? 'rgba(250,246,238,0.96)' : cover.ink === 'gold' ? 'rgba(212,176,96,0.98)' : cover.ink === 'silver' ? 'rgba(215,215,220,0.98)' : 'rgba(58,44,30,0.94)'
  let drew = false
  const spec0 = LAYOUT_SPEC[layout]
  // se la coppia ha posizionato il blocco nomi/logo nell'editor, vince la sua posizione (coordinate copertina → decal)
  const DI = 0.02, toD = (v: number) => (v - DI) / (1 - 2 * DI)
  const lp = cover.logoPlace
  const spec = lp ? { ...spec0, logo: { x: toD(lp.x), y: toD(lp.y), w: lp.w / (1 - 2 * DI) }, names: { ...spec0.names, x: toD(lp.x), y: toD(lp.y + 0.03), align: 'center' as const } } : spec0
  const p = spec.names
  // il canvas è quadrato ma la copertina no: testi e loghi vanno compressi in orizzontale del rapporto
  // larghezza/altezza, altrimenti sull'album orizzontale escono allargati
  const sz = sizeByKey(cover.sizeKey); const aspect = sz && sz.h > 0 ? sz.w / sz.h : 1
  // 1) il decoro proprio del modello (fiori, mandala, ninfee, sposini, albero…): sotto tutto il resto.
  //    Il piano Decal copre la copertina meno un bordo del 2%: i PNG (in coordinate copertina) si allargano di conseguenza.
  const DECAL_INSET = 0.02
  const decor = decorFor(cover.model)
  if (decor && drawDecor(ctx, W, H, decor, inkRgb(cover.ink), decorImages(decor), { stoneAlpha: 0.7, inset: DECAL_INSET, skipPlate: layout === 'laser' })) drew = true
  const dx = (x: number) => (x - DECAL_INSET) / (1 - 2 * DECAL_INSET), dy = (y: number) => (y - DECAL_INSET) / (1 - 2 * DECAL_INSET)
  // 2) il logo del catalogo RICOSTRUITO con i nomi veri (template: ornamento estratto + font identificato);
  //    se il template non c'è ancora, il ritaglio del catalogo tinto
  let composed: HTMLCanvasElement | null = null
  if (cover.logoKey && hasLogoTemplate(cover.logoKey)) {
    const code = cover.logoKey
    for (const f of fontsOf(code)) if (!fontsRequested.has(f)) { fontsRequested.add(f); void loadLogoFont(f).then(() => onReady?.()) }
    onLogoAssetsReady(() => onReady?.())
    composed = composeLogo({ code, names, date: dateIt(cover.eventDate), ink: inkRgb(cover.ink) }, Math.round(spec.logo.w * W))
  }
  if (composed) {
    const lw = composed.width, lh = Math.round(composed.height * aspect)
    ctx.drawImage(composed, Math.round(W * spec.logo.x - lw / 2), Math.round(H * spec.logo.y), lw, lh)
    drew = true
  }
  const logo = composed ? null : img(swatchUrl(cover.logoKey))
  if (logo) {
    const lw = Math.round(spec.logo.w * W), lh = Math.round(lw * (logo.naturalHeight / logo.naturalWidth) * aspect)
    ctx.drawImage(logoToInk(logo, lw, lh, inkRgb(cover.ink)), Math.round(W * spec.logo.x - lw / 2), Math.round(H * spec.logo.y))
    drew = true
  } else if (layout === 'monogram' && names) {
    ctx.save(); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.translate(W / 2, H * 0.46); ctx.scale(1 / aspect, 1)
    ctx.font = `500 ${Math.round(H * 0.22)}px "Bodoni Moda", "Playfair Display", Georgia, serif`
    ctx.fillText(initialsOf(names), 0, 0); ctx.restore(); drew = true
  }
  // 3) i nomi: dove li mette il decoro del modello (Bouquet sotto i fiori, Darling ai lati del tronco…) o il layout
  if (names && !logo && !composed && (cover.textLayout ?? 'model') === 'model') {
    ctx.save(); ctx.fillStyle = ink; ctx.textBaseline = 'middle'
    ctx.font = `italic 400 ${Math.round(H * (decor ? 0.045 : p.size))}px "Fraunces", "Cormorant Garamond", Georgia, serif`
    for (const pl of namePlacements(names, lp ? undefined : decor, p)) {
      // le ancore del decoro sono in coordinate copertina (→ decal); quelle del layout (o della coppia) sono già sul decal
      const px = decor && !lp ? dx(pl.x) : pl.x, py = decor && !lp ? dy(pl.y) : pl.y
      ctx.save(); ctx.translate(W * px, H * py); ctx.scale(1 / aspect, 1); ctx.textAlign = pl.align; ctx.fillText(pl.text, 0, 0); ctx.restore()
    }
    ctx.restore(); drew = true
  }
  if (!drew) return null
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false
  return t
}
