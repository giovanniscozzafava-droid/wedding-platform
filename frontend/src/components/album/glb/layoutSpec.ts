// LA TAVOLA DI OGNI LAYOUT, in frazioni della copertina (origine in alto a sinistra, x→destra, y→basso).
// È l'unica sorgente delle posizioni: la usano il 3D (decal), il PSD per l'azienda e il PDF della
// commessa. Deve combaciare con la geometria di blender/album_gen.py (incassi, fasce, placche).
import type { Layout } from '@/components/album/albumCatalog'

export type Rect = { x: number; y: number; w: number; h: number }   // frazioni 0..1 (centro + misure)
export type LayoutSpec = {
  photos: Rect[]                 // finestre foto (lastra)
  band?: Rect                    // fascia / seconda superficie
  plate?: Rect                   // targhetta
  names: { x: number; y: number; size: number; align?: 'center' | 'left' | 'right' }   // ancora dei nomi (size = altezza in frazione di H)
  logo: { x: number; y: number; w: number }                                            // logo: centro x, BORDO SUPERIORE y, larghezza (frazioni)
  crystals?: { x1: number; y1: number; x2: number; y2: number }[]
}

// Nota: il 3D di album_gen.py lavora in coordinate centrate (y verso l'alto); qui y è verso il basso:
// y_qui = 0.5 − y_3d/h.
export const LAYOUT_SPEC: Record<Layout, LayoutSpec> = {
  plain: { photos: [], names: { x: 0.5, y: 0.84, size: 0.05 }, logo: { x: 0.5, y: 0.4, w: 0.34 } },
  plate: { photos: [], plate: { x: 0.5, y: 0.5, w: 0.12, h: 0.12 }, names: { x: 0.5, y: 0.74, size: 0.05 }, logo: { x: 0.5, y: 0.62, w: 0.26 } },
  monogram: { photos: [], names: { x: 0.5, y: 0.66, size: 0.045 }, logo: { x: 0.5, y: 0.3, w: 0.36 } },
  fascia: { photos: [], band: { x: 0.5, y: 0.5, w: 0.96, h: 0.2 }, plate: { x: 0.74, y: 0.5, w: 0.30, h: 0.055 }, crystals: [{ x1: 0.08, y1: 0.5, x2: 0.62, y2: 0.5 }],
    names: { x: 0.74, y: 0.5, size: 0.03 }, logo: { x: 0.5, y: 0.66, w: 0.28 } },
  'fascia-ornament': { photos: [], band: { x: 0.5, y: 0.46, w: 0.96, h: 0.22 }, crystals: [{ x1: 0.16, y1: 0.36, x2: 0.84, y2: 0.36 }, { x1: 0.16, y1: 0.56, x2: 0.84, y2: 0.56 }],
    names: { x: 0.5, y: 0.46, size: 0.06 }, logo: { x: 0.5, y: 0.37, w: 0.3 } },
  oblique: { photos: [], band: { x: 0.5, y: 0.692, w: 0.989, h: 0.605 }, crystals: [{ x1: 0, y1: 0.66, x2: 1, y2: 0.49 }], names: { x: 0.62, y: 0.86, size: 0.055 }, logo: { x: 0.62, y: 0.72, w: 0.3 } },
  'swarovski-line': { photos: [], plate: { x: 0.34, y: 0.5, w: 0.30, h: 0.055 }, crystals: [{ x1: 0.6, y1: 0.12, x2: 0.6, y2: 0.88 }], names: { x: 0.34, y: 0.5, size: 0.03 }, logo: { x: 0.34, y: 0.6, w: 0.28 } },
  'swarovski-cluster': { photos: [], names: { x: 0.5, y: 0.72, size: 0.055 }, logo: { x: 0.5, y: 0.56, w: 0.32 } },
  'photo-vertical': { photos: [{ x: 0.58, y: 0.5, w: 0.38, h: 0.58 }], names: { x: 0.29, y: 0.78, size: 0.05 }, logo: { x: 0.29, y: 0.5, w: 0.3 } },
  'photo-panoramic': { photos: [{ x: 0.5, y: 0.42, w: 0.76, h: 0.28 }], names: { x: 0.5, y: 0.7, size: 0.055 }, logo: { x: 0.5, y: 0.6, w: 0.3 } },
  'photo-small': { photos: [{ x: 0.6, y: 0.42, w: 0.3, h: 0.24 }], names: { x: 0.6, y: 0.64, size: 0.042 }, logo: { x: 0.3, y: 0.38, w: 0.3 } },
  'photo-full': { photos: [{ x: 0.5, y: 0.5, w: 0.94, h: 0.94 }], names: { x: 0.5, y: 0.88, size: 0.05 }, logo: { x: 0.5, y: 0.72, w: 0.3 } },
  // Azulejo: pannello Cristalplex sul 45% sinistro (decoro), foto a tutta altezza sul 55% destro
  'photo-side': { photos: [{ x: 0.725, y: 0.5, w: 0.55, h: 0.96 }], names: { x: 0.225, y: 0.44, size: 0.045 }, logo: { x: 0.225, y: 0.28, w: 0.3 } },
  trilogy: { photos: [{ x: 0.26, y: 0.45, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.45, w: 0.2, h: 0.2 }, { x: 0.74, y: 0.45, w: 0.2, h: 0.2 }], names: { x: 0.5, y: 0.74, size: 0.048 }, logo: { x: 0.5, y: 0.6, w: 0.3 } },
  print: { photos: [], names: { x: 0.5, y: 0.82, size: 0.05 }, logo: { x: 0.5, y: 0.42, w: 0.36 } },
  laser: { photos: [], band: { x: 0.5, y: 0.5, w: 0.92, h: 0.92 }, names: { x: 0.5, y: 0.5, size: 0.06 }, logo: { x: 0.5, y: 0.34, w: 0.36 } },
}

/** Il ritaglio del logo del catalogo diventa un tratto su fondo trasparente, nel colore d'inchiostro;
 *  la sigla «cod.NN» stampata in alto a destra nel riquadro viene cancellata. */
export function logoToInk(img: HTMLImageElement, w: number, h: number, rgb: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(w * 0.7), 0, Math.round(w * 0.3), Math.round(h * 0.16))   // via la sigla cod.NN
  const d = ctx.getImageData(0, 0, w, h); const px = d.data
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114) / 255
    px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = Math.round((1 - lum) * 255)
  }
  ctx.putImageData(d, 0, 0)
  return c
}
export const inkRgb = (ink?: string): [number, number, number] =>
  ink === 'white' ? [246, 241, 232] : ink === 'gold' ? [212, 176, 96] : ink === 'silver' ? [215, 215, 220] : [58, 44, 30]

/** Ritaglio «a copertura» di un'immagine dentro un rettangolo (come object-fit: cover). */
export function coverFit(iw: number, ih: number, w: number, h: number): { sx: number; sy: number; sw: number; sh: number } {
  const s = Math.max(w / iw, h / ih)
  const sw = w / s, sh = h / s
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh }
}

/** Il RITAGLIO scelto dalla coppia per una finestra: spostamento (ox, oy) in frazioni della finestra
 *  (positivo = la foto scivola a destra/in basso, come nel CSS translate) e ingrandimento zoom ≥ 1. */
export type PhotoCrop = { ox: number; oy: number; zoom: number }
/** IL RIQUADRO di una foto quando la coppia lo sposta: centro x/y, misure w/h (frazioni della
 *  copertina) e inclinazione in gradi. Assente = quello del modello (LAYOUT_SPEC). L'artigiano
 *  monta a mano: la tavola PSD riporta il riquadro con le sue misure in millimetri. */
export type PhotoFrame = { x: number; y: number; w: number; h: number; rot?: number }
/** Il riquadro buono per la finestra i: quello scelto dalla coppia, se c'è, altrimenti il modello. */
export function frameOf(windows: Rect[], i: number, frames?: Record<number, PhotoFrame> | null): PhotoFrame | null {
  const f = frames?.[i]
  const w = windows[i] ?? windows[0]
  if (f) return f
  return w ? { x: w.x, y: w.y, w: w.w, h: w.h, rot: 0 } : null
}
/** Dove sta il blocco nomi/logo: centro x, BORDO SUPERIORE y, larghezza (frazioni della copertina). */
export type LogoPlace = { x: number; y: number; w: number }
/** stessa forma del logo, ma per la scritta (nomi e data): la coppia la muove e la ingrandisce a parte */
export type TextPlace = LogoPlace
export const DEFAULT_CROP: PhotoCrop = { ox: 0, oy: 0, zoom: 1 }

// LA SCRITTA DELLA COPERTINA (nomi + data): misure e disegno stanno qui una volta sola, così
// l'editor della coppia, il 3D e la tavola PSD per l'azienda scrivono identico.
export const COVER_TEXT_FONT = '"Fraunces", "Cormorant Garamond", Georgia, serif'
export const DATE_RATIO = 0.52            // la data è poco più della metà dei nomi
const LINE_NAMES = 1.15, LINE_DATE = 1.5  // interlinee, in corpi
let measureCtx: CanvasRenderingContext2D | null = null
/** Larghezza e altezza del blocco misurate a CORPO 100 (senza compressione orizzontale):
 *  corpo = 100 · larghezzaVoluta / w (per il decal quadrato, moltiplicato per la compressione). */
export function coverTextMetrics(names?: string, date?: string): { w: number; h: number } {
  const n = (names ?? '').trim(), d = (date ?? '').trim()
  if (!n && !d) return { w: 1, h: 0 }
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  const ctx = measureCtx
  let wn = 0, wd = 0
  if (ctx) {
    if (n) { ctx.font = `italic 400 100px ${COVER_TEXT_FONT}`; wn = ctx.measureText(n).width }
    if (d) { ctx.font = `italic 400 ${Math.round(100 * DATE_RATIO)}px ${COVER_TEXT_FONT}`; wd = ctx.measureText(d).width }
  } else { wn = n.length * 42; wd = d.length * 42 * DATE_RATIO }      // senza canvas: stima
  return { w: Math.max(wn, wd, 1), h: (n ? 100 * LINE_NAMES : 0) + (d ? 100 * DATE_RATIO * LINE_DATE : 0) }
}
/** Scrive nomi e data larghi `wPx`, col BORDO SUPERIORE in `topPx`, centrati su `xPx`; `squeeze`
 *  comprime in orizzontale (il decal è quadrato anche quando l'album non lo è). Torna l'altezza scritta. */
export function drawCoverText(
  ctx: CanvasRenderingContext2D, text: { names?: string; date?: string },
  xPx: number, topPx: number, wPx: number, fill: string, squeeze = 1,
): number {
  const n = (text.names ?? '').trim(), d = (text.date ?? '').trim()
  if (!n && !d) return 0
  const m = coverTextMetrics(n, d)
  const f = (100 * wPx * squeeze) / m.w
  ctx.save(); ctx.fillStyle = fill; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  let y = topPx
  if (n) {
    ctx.save(); ctx.translate(xPx, y + (f * LINE_NAMES) / 2); ctx.scale(1 / squeeze, 1)
    ctx.font = `italic 400 ${Math.round(f)}px ${COVER_TEXT_FONT}`; ctx.fillText(n, 0, 0); ctx.restore()
    y += f * LINE_NAMES
  }
  if (d) {
    const fd = f * DATE_RATIO
    ctx.save(); ctx.translate(xPx, y + (fd * LINE_DATE) / 2); ctx.scale(1 / squeeze, 1)
    ctx.font = `italic 400 ${Math.round(fd)}px ${COVER_TEXT_FONT}`; ctx.fillText(d, 0, 0); ctx.restore()
    y += fd * LINE_DATE
  }
  ctx.restore()
  return y - topPx
}

/** Il rettangolo SORGENTE (px dell'immagine) che riempie una finestra w×h col ritaglio scelto: stessa
 *  geometria del CSS `object-fit: cover` + `translate(ox, oy) scale(zoom)` dell'editor, così 3D, PSD e
 *  anteprima combaciano. Il rettangolo resta dentro l'immagine. */
export function cropRect(iw: number, ih: number, w: number, h: number, crop?: PhotoCrop | null): { sx: number; sy: number; sw: number; sh: number } {
  const base = coverFit(iw, ih, w, h)
  const z = Math.max(1, crop?.zoom ?? 1)
  const sw = base.sw / z, sh = base.sh / z
  // lo scorrimento della foto a destra di ox·w (schermo) sposta il centro visibile a sinistra di ox·sw/z (sorgente)
  let cx = base.sx + base.sw / 2 - (crop?.ox ?? 0) * base.sw / z
  let cy = base.sy + base.sh / 2 - (crop?.oy ?? 0) * base.sh / z
  cx = Math.min(Math.max(cx, sw / 2), iw - sw / 2); cy = Math.min(Math.max(cy, sh / 2), ih - sh / 2)
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh }
}
/** Quanto si può far scorrere la foto (frazioni della finestra) senza scoprire il fondo. */
export function cropSlack(iw: number, ih: number, w: number, h: number, zoom: number): { x: number; y: number } {
  const s = Math.max(w / iw, h / ih)
  const rw = iw * s / w, rh = ih * s / h      // misura resa / finestra (≥ 1)
  return { x: Math.max(0, (rw * zoom - 1) / 2), y: Math.max(0, (rh * zoom - 1) / 2) }
}
