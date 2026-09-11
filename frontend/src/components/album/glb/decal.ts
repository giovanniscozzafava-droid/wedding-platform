// La decalcomania della copertina: il DECORO proprio del modello (stampa, laser, cristalli — ritagliato
// dalle tavole del catalogo), i nomi (o le iniziali), la data, e il logo del catalogo (cod.NN),
// disegnati su un canvas trasparente che diventa la texture del piano «Decal» sopra il piatto.
// Le posizioni seguono il layout del modello (dove la tavola mette i nomi) o l'ancora del decoro.
import * as THREE from 'three'
import { baseDesignKey, modelByKey, modelLayout, sizeByKey, type Cover } from '@/components/album/albumCatalog'
import { swatchUrl } from '@/components/album/catalog/swatches.generated'
import { LAYOUT_SPEC, logoToInk, inkRgb, drawCoverText, coverTextMetrics, type LogoPlace, type TextPlace } from '@/components/album/glb/layoutSpec'
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
// ---------- il decoro a misura reale, su qualunque formato ----------
// I PNG dei decori sono ritagli di copertine FOTOGRAFATE sul catalogo, quasi sempre orizzontali
// (1200×850). Stirarli sulla copertina dell'album deformava tutto: su un 30×40 il ramo di Darling
// diventava alto e storto, gli sposini di Amelie schiacciati. Qui il decoro si tratta come un
// OGGETTO: si trova il suo riquadro dentro il PNG, se ne conserva la misura in rapporto al lato
// corto della copertina, e lo si ancora al bordo a cui sta vicino sulla tavola (in basso, a
// sinistra…). Stessa mappa per i cristalli e per l'ancora dei nomi.
const bboxCache = new Map<string, [number, number, number, number]>()
/** Il riquadro del disegno nel PNG (frazioni x0,y0,x1,y1), letto dall'alpha una volta sola. */
export function decorBBox(img: HTMLImageElement): [number, number, number, number] {
  const k = img.src
  const hit = bboxCache.get(k); if (hit) return hit
  const c = document.createElement('canvas'); const sw = 300, sh = Math.max(1, Math.round(300 * img.naturalHeight / img.naturalWidth))
  c.width = sw; c.height = sh
  const x = c.getContext('2d')!; x.drawImage(img, 0, 0, sw, sh)
  const d = x.getImageData(0, 0, sw, sh).data
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) if (d[(j * sw + i) * 4 + 3]! > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j }
  const bb: [number, number, number, number] = x1 < 0 ? [0, 0, 1, 1] : [x0 / sw, y0 / sh, (x1 + 1) / sw, (y1 + 1) / sh]
  bboxCache.set(k, bb); return bb
}
export type DecorMap = {
  toX: (fx: number, fy?: number) => number
  toY: (fy: number, fx?: number) => number
  /** come si disegna: 'tutto' = un pezzo solo; 'angoli' = ogni quarto della tavola ancorato al suo angolo */
  modo: 'tutto' | 'angoli'
  /** i pezzi da disegnare: regione della tavola (frazioni) e dove va (frazioni della copertina) */
  pezzi: { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }[]
}
/** La mappa dalle frazioni della tavola (PNG) alle frazioni della copertina di destinazione.
 *  `aspect` = larghezza/altezza della copertina. Le misure si conservano in rapporto al lato corto.
 *  - un disegno che tocca un bordo resta attaccato a quel bordo (i fiori di Bouquet partono dal basso);
 *  - un disegno che tocca sopra E sotto (le liane di Ninfea) si scala per toccarli ancora;
 *  - un disegno che occupa TUTTA la tavola (gli ornamenti agli angoli di Dhyana e Frejus) si divide
 *    in quattro e ogni quarto resta attaccato al suo angolo. */
export function decorMap(decor: Decor, aspect: number, bbox?: [number, number, number, number]): DecorMap {
  const As = decor.size[0] / decor.size[1]                    // la copertina della tavola
  const Tw = aspect >= 1 ? aspect : 1, Th = aspect >= 1 ? 1 : 1 / aspect
  const [bx0, by0, bx1, by1] = bbox ?? [0, 0, 1, 1]
  const spanX = bx1 - bx0 >= 0.85, spanY = by1 - by0 >= 0.85
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2
  // scala: 1 = misura reale; se il disegno tocca sopra e sotto (o destra e sinistra) si adatta
  let k = 1
  const Sw0 = As >= 1 ? As : 1, Sh0 = As >= 1 ? 1 : 1 / As
  if (spanY && !spanX) k = Th / Sh0
  else if (spanX && !spanY) k = Tw / Sw0
  const Sw = Sw0 * k, Sh = Sh0 * k
  const lato = (): number => (bx0 <= 0.12 && bx1 < 0.88) ? 0 : (bx1 >= 0.88 && bx0 > 0.12) ? Tw - Sw : cx < 0.35 ? 0 : cx > 0.65 ? Tw - Sw : (Tw - Sw) / 2
  const alto = (): number => (by1 >= 0.88 && by0 > 0.12) ? Th - Sh : (by0 <= 0.12 && by1 < 0.88) ? 0 : cy > 0.5 ? Th - Sh : cy < 0.35 ? 0 : (Th - Sh) / 2
  if (spanX && spanY) {
    // ANGOLI: quattro quarti, ognuno col margine dal proprio angolo
    const q = (sx: number, sy: number) => ({ sx, sy, sw: 0.5, sh: 0.5, dx: (sx * Sw + (sx ? Tw - Sw : 0)) / Tw, dy: (sy * Sh + (sy ? Th - Sh : 0)) / Th, dw: Sw / 2 / Tw, dh: Sh / 2 / Th })
    const pezzi = [q(0, 0), q(0.5, 0), q(0, 0.5), q(0.5, 0.5)]
    return {
      modo: 'angoli', pezzi,
      toX: (fx) => (fx * Sw + (fx >= 0.5 ? Tw - Sw : 0)) / Tw,
      toY: (fy) => (fy * Sh + (fy >= 0.5 ? Th - Sh : 0)) / Th,
    }
  }
  const dx = lato(), dy = alto()
  return {
    modo: 'tutto', pezzi: [{ sx: 0, sy: 0, sw: 1, sh: 1, dx: dx / Tw, dy: dy / Th, dw: Sw / Tw, dh: Sh / Th }],
    toX: (fx) => (fx * Sw + dx) / Tw,
    toY: (fy) => (fy * Sh + dy) / Th,
  }
}

/** Disegna il decoro del modello a tutta copertina: stampa (tinta o a colori), fascia, pannello, piastra intagliata, cristalli.
 *  I PNG sono in coordinate della COPERTINA (0..1); `inset` è il bordo che il canvas non copre (decal 3D = 0.02).
 *  true se ha disegnato qualcosa. */
export function drawDecor(ctx: CanvasRenderingContext2D, W: number, H: number, decor: Decor, ink: [number, number, number],
  images: { print: HTMLImageElement | null; stones: HTMLImageElement | null }, opts: { stoneAlpha?: number; inset?: number; skipPlate?: boolean; aspect?: number } = {}): boolean {
  const inset = opts.inset ?? 0
  const sc = 1 / (1 - 2 * inset); const ox = -inset * sc * W, oy = -inset * sc * H, dw = W * sc, dh = H * sc
  const aspect = opts.aspect ?? 1
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
  // fascia e pannello coprono la copertina per costruzione: si stirano (sono geometria, non disegno)
  const stira = decor.kind === 'strip' || decor.kind === 'panel'
  const disegna = (img: HTMLImageElement, tinta: boolean) => {
    const src = tinta ? tintAlpha(img, img.naturalWidth, img.naturalHeight, rgb) : img
    const iw = img.naturalWidth, ih = img.naturalHeight
    if (stira) { ctx.drawImage(src, ox, oy, dw, dh); return }
    const m = decorMap(decor, aspect, decorBBox(img))
    for (const p of m.pezzi) ctx.drawImage(src, p.sx * iw, p.sy * ih, p.sw * iw, p.sh * ih, ox + p.dx * dw, oy + p.dy * dh, p.dw * dw, p.dh * dh)
  }
  if (images.print) { disegna(images.print, !decor.color); drew = true }
  if (images.stones) {
    ctx.save(); ctx.globalAlpha = opts.stoneAlpha ?? 1; ctx.shadowColor = 'rgba(255,255,255,0.85)'; ctx.shadowBlur = Math.round(W * 0.004)
    // le pietre seguono la stessa mappa del disegno (bbox del disegno, non delle pietre)
    const iw = images.stones.naturalWidth, ih = images.stones.naturalHeight
    if (stira) ctx.drawImage(images.stones, ox, oy, dw, dh)
    else { const m = decorMap(decor, aspect, decorBBox(images.print ?? images.stones)); for (const p of m.pezzi) ctx.drawImage(images.stones, p.sx * iw, p.sy * ih, p.sw * iw, p.sh * ih, ox + p.dx * dw, oy + p.dy * dh, p.dw * dw, p.dh * dh) }
    ctx.restore(); drew = true
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
export function drawDecal(cover: Cover & { logoKey?: string; logoTone?: string; ink?: DecalInk; eventDate?: string | null; logoPlace?: LogoPlace; dateText?: string | null; textPlace?: TextPlace }): THREE.CanvasTexture | null {
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
  if (decor && drawDecor(ctx, W, H, decor, inkRgb(cover.ink), decorImages(decor), { stoneAlpha: 0.7, inset: DECAL_INSET, skipPlate: layout === 'laser', aspect })) drew = true
  // la stessa mappa per l'ancora dei nomi del decoro (in basso ai lati del tronco, sotto i fiori…)
  const dimg = decor ? decorImages(decor).print : null
  const dmap = decor && dimg ? decorMap(decor, aspect, decorBBox(dimg)) : null
  const dx = (x: number) => (x - DECAL_INSET) / (1 - 2 * DECAL_INSET), dy = (y: number) => (y - DECAL_INSET) / (1 - 2 * DECAL_INSET)
  // 2) il logo del catalogo RICOSTRUITO con i nomi veri (template: ornamento estratto + font identificato);
  //    se il template non c'è ancora, il ritaglio del catalogo tinto
  let composed: HTMLCanvasElement | null = null
  if (cover.logoKey && hasLogoTemplate(cover.logoKey)) {
    const code = cover.logoKey
    for (const f of fontsOf(code)) if (!fontsRequested.has(f)) { fontsRequested.add(f); void loadLogoFont(f).then(() => onReady?.()) }
    onLogoAssetsReady(() => onReady?.())
    // il logo ricomposto porta dentro i nomi e la data SCELTI dalla coppia (non più solo quelli dell'evento)
    composed = composeLogo({ code, names, date: (cover.dateText ?? '').trim() || dateIt(cover.eventDate), ink: inkRgb(cover.ink) }, Math.round(spec.logo.w * W))
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
  // 2b) LA TARGHETTA D'OTTONE porta i nomi: è fatta per quello. Se la coppia ha scelto la
  //     targhetta e ha scritto qualcosa, i nomi vengono incisi dentro la placca del layout.
  const plate = spec0.plate
  if (cover.logoKey === 'ottone-targhetta' && plate && (names || (cover.dateText ?? '').trim())) {
    const dateP = (cover.dateText ?? '').trim()
    const pw = plate.w * W * 0.8 / (1 - 2 * DI)
    const px = dx(plate.x) * W, py = dy(plate.y) * H
    // l'altezza del blocco si conosce dalle misure, senza disegnare due volte
    const m = coverTextMetrics(names, dateP)
    const hBlocco = (m.h / m.w) * pw / aspect
    const inciso = 'rgba(74,56,26,0.88)'          // inciso nell'ottone: bruno scuro, non nero
    drawCoverText(ctx, { names, date: dateP }, px, py - hBlocco / 2, pw, inciso, aspect)
    drew = true
  }

  // 3) LA SCRITTA (nomi e data), scelta dalla coppia. Se il logo del catalogo ha il template, i nomi
  //    sono già dentro il logo e non si ripetono; col ritaglio del catalogo, invece, la scritta ci vuole.
  const dateTxt = (cover.dateText ?? '').trim()
  const tp = cover.textPlace
  const suTarghetta = cover.logoKey === 'ottone-targhetta' && !!spec0.plate
  if ((names || dateTxt) && !composed && !suTarghetta && (cover.textLayout ?? 'model') === 'model') {
    if (tp) {
      // dove l'ha messa la coppia: coordinate copertina → decal
      drawCoverText(ctx, { names, date: dateTxt }, W * toD(tp.x), H * toD(tp.y), (tp.w / (1 - 2 * DI)) * W, ink, aspect)
      drew = true
    } else if (names) {
      // dove li mette il decoro del modello (Bouquet sotto i fiori, Darling ai lati del tronco…) o il layout
      ctx.save(); ctx.fillStyle = ink; ctx.textBaseline = 'middle'
      ctx.font = `italic 400 ${Math.round(H * (decor ? 0.045 : p.size))}px "Fraunces", "Cormorant Garamond", Georgia, serif`
      let lastY = p.y
      for (const pl of namePlacements(names, lp ? undefined : decor, p)) {
        // le ancore del decoro sono in coordinate della tavola: passano dalla mappa del decoro e poi al decal;
        // quelle del layout (o della coppia) sono già sul decal
        const mx = dmap && !lp ? dmap.toX(pl.x) : pl.x, my = dmap && !lp ? dmap.toY(pl.y) : pl.y
        const px = decor && !lp ? dx(mx) : mx, py = decor && !lp ? dy(my) : my
        ctx.save(); ctx.translate(W * px, H * py); ctx.scale(1 / aspect, 1); ctx.textAlign = pl.align; ctx.fillText(pl.text, 0, 0); ctx.restore()
        lastY = py
      }
      ctx.restore(); drew = true
      if (dateTxt) {
        // la data sotto i nomi, alla stessa larghezza della riga più lunga
        const m = coverTextMetrics(names, undefined)
        const nameW = (m.w / 100) * H * (decor ? 0.045 : p.size) / aspect
        drawCoverText(ctx, { date: dateTxt }, W * (decor && !lp ? dx(p.x) : p.x), H * lastY + H * (decor ? 0.045 : p.size) * 0.75, nameW, ink, aspect)
      }
    } else if (dateTxt) {
      drawCoverText(ctx, { date: dateTxt }, W * p.x, H * p.y, 0.3 * W, ink, aspect)
      drew = true
    }
  }
  if (!drew) return null
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false
  return t
}
