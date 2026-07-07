// Geometria dell'impaginatore — funzioni PURE (testate) condivise da editor ed export,
// così l'anteprima e il PDF coincidono al pixel. Crop/zoom/pan per foto + abbondanza (bleed).
import type { CSSProperties } from 'react'

export type Cell = { z: number; fx: number; fy: number; r?: number; fh?: boolean; fv?: boolean } // zoom>=1, focale (0..1), r = rotazione FOTO (gradi); fh/fv = specchia orizzontale/verticale
export const DEFAULT_CELL: Cell = { z: 1, fx: 0.5, fy: 0.5 }

// Fattore di ingrandimento minimo perché una foto RUOTATA di `rDeg` continui a COPRIRE una
// cornice di aspetto `frameAspect` (larghezza/altezza): niente angoli vuoti. A 0° = 1; a 90° =
// max(a,1/a) (l'aspetto si "gira"); in mezzo la combinazione trigonometrica. Usato SIA in preview
// (coverImgStyle) SIA in export, così stampa e schermo coincidono.
export function coverScaleForRotation(rDeg?: number | null, frameAspect = 1): number {
  const r = ((rDeg ?? 0) * Math.PI) / 180
  if (!r) return 1
  const a = frameAspect > 0 ? frameAspect : 1
  return Math.abs(Math.cos(r)) + Math.max(a, 1 / a) * Math.abs(Math.sin(r))
}
export const BLEED_MM = 3   // abbondanza standard di stampa
export const MARGIN_MM = 8  // margine interno pagina
export const GUTTER_MM = 4  // distanza tra foto

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Finestra del sorgente (normalizzato: larghezza=1, altezza=1/imgAspect) mostrata nello slot,
// per coprire lo slot all'aspetto richiesto, con zoom e focale. Restituisce wx,wy,ww,wh,sw,sh.
export function coverWindow(imgAspect: number, slotAspect: number, cell?: Cell | null) {
  const c = cell ?? DEFAULT_CELL // robusto: dato persistito può avere cell null/assente
  const z = Math.max(1, c.z || 1)
  const ia = imgAspect > 0 ? imgAspect : 1
  const sw = 1, sh = 1 / ia
  let bw: number, bh: number
  if (ia > slotAspect) { bh = sh; bw = sh * slotAspect } else { bw = sw; bh = sw / slotAspect }
  const ww = bw / z, wh = bh / z
  const cx = clamp(c.fx ?? 0.5, 0, 1) * sw
  const cy = clamp(c.fy ?? 0.5, 0, 1) * sh
  const wx = clamp(cx - ww / 2, 0, Math.max(0, sw - ww))
  const wy = clamp(cy - wh / 2, 0, Math.max(0, sh - wh))
  return { wx, wy, ww, wh, sw, sh }
}

// Stile per un <img object-fit:cover> che riproduce il crop (zoom + fuoco) SENZA
// dipendere dall'aspetto dell'immagine: il browser fa il "cover" nativo, quindi le
// proporzioni sono SEMPRE preservate (niente foto stirate). Va su un'<img> dentro un
// contenitore relative+overflow-hidden. Parità con l'export: stesso fuoco e zoom.
export function coverImgStyle(cell?: Cell | null, frameAspect = 1): CSSProperties {
  const c = cell ?? DEFAULT_CELL // robusto: dato persistito può avere cell null/assente
  const z = Math.max(1, c.z || 1)
  const fx = Math.min(1, Math.max(0, c.fx ?? 0.5))
  const fy = Math.min(1, Math.max(0, c.fy ?? 0.5))
  const r = c.r ?? 0
  const sh = c.fh ? -1 : 1, sv = c.fv ? -1 : 1 // specchia orizzontale/verticale
  const flipped = sh < 0 || sv < 0
  if (!r && !flipped) {
    // NESSUNA rotazione né specchio → identico a prima (zero regressioni per gli album esistenti).
    return {
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      objectFit: 'cover', objectPosition: `${fx * 100}% ${fy * 100}%`,
      transform: z > 1 ? `scale(${z})` : undefined,
      transformOrigin: `${fx * 100}% ${fy * 100}%`,
    }
  }
  if (!r) {
    // Solo specchio (niente rotazione): scala negativa attorno al fuoco. Nessuna scala-cover extra.
    return {
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      objectFit: 'cover', objectPosition: `${fx * 100}% ${fy * 100}%`,
      transform: `scale(${z * sh}, ${z * sv})`,
      transformOrigin: `${fx * 100}% ${fy * 100}%`,
    }
  }
  // FOTO RUOTATA (± specchio) nella cornice ferma: ruoto attorno al CENTRO e ingrandisco di k così
  // copre sempre (niente angoli vuoti); il fuoco (fx/fy) resta come pan via objectPosition.
  const k = coverScaleForRotation(r, frameAspect)
  return {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: `${fx * 100}% ${fy * 100}%`,
    transform: `rotate(${r}deg) scale(${(z * k * sh).toFixed(4)}, ${(z * k * sv).toFixed(4)})`,
    transformOrigin: '50% 50%',
  }
}

// Proprietà CSS background per l'anteprima editor (stessa identica finestra dell'export).
export function cellBackground(imgAspect: number, slotAspect: number, cell: Cell) {
  const { wx, wy, ww, wh, sw, sh } = coverWindow(imgAspect, slotAspect, cell)
  const sizeX = (sw / ww) * 100, sizeY = (sh / wh) * 100
  const posX = sw - ww <= 1e-6 ? 50 : (wx / (sw - ww)) * 100
  const posY = sh - wh <= 1e-6 ? 50 : (wy / (sh - wh)) * 100
  return {
    backgroundSize: `${sizeX}% ${sizeY}%`,
    backgroundPosition: `${posX}% ${posY}%`,
    backgroundRepeat: 'no-repeat' as const,
  }
}

// Rettangolo sorgente in PIXEL per ctx.drawImage (export canvas).
export function sourceRect(imgW: number, imgH: number, slotAspect: number, cell: Cell) {
  const { wx, wy, ww, wh, sw, sh } = coverWindow(imgW / imgH, slotAspect, cell)
  return { sx: (wx / sw) * imgW, sy: (wy / sh) * imgH, sw: (ww / sw) * imgW, sh: (wh / sh) * imgH }
}

export type Frame = { x: number; y: number; w: number; h: number }

// Rettangolo dello slot nella pagina (mm o px), con margine, gutter e abbondanza.
// La pagina-canvas è (pageW+2*bleed) × (pageH+2*bleed); il taglio (trim) è inset di `bleed`.
// Con bleed>0 le foto a filo bordo si estendono fino al bordo pagina (full-bleed).
export function slotRect(fr: Frame, pageW: number, pageH: number, o: { margin: number; gutter: number; bleed: number }) {
  const { margin, gutter, bleed } = o
  const eps = 1e-6
  const contentW = pageW - 2 * margin, contentH = pageH - 2 * margin
  let x = bleed + margin + fr.x * contentW + (fr.x > eps ? gutter / 2 : 0)
  let y = bleed + margin + fr.y * contentH + (fr.y > eps ? gutter / 2 : 0)
  let w = fr.w * contentW - (fr.x > eps ? gutter / 2 : 0) - (fr.x + fr.w < 1 - eps ? gutter / 2 : 0)
  let h = fr.h * contentH - (fr.y > eps ? gutter / 2 : 0) - (fr.y + fr.h < 1 - eps ? gutter / 2 : 0)
  if (bleed > 0) {
    if (fr.x <= eps) { const ext = margin + bleed; x -= ext; w += ext }
    if (fr.x + fr.w >= 1 - eps) { w += margin + bleed }
    if (fr.y <= eps) { const ext = margin + bleed; y -= ext; h += ext }
    if (fr.y + fr.h >= 1 - eps) { h += margin + bleed }
  }
  return { x, y, w, h }
}

// dimensione canvas/pagina export (incl. abbondanza)
export function pageBox(pageW: number, pageH: number, bleed: number) {
  return { w: pageW + 2 * bleed, h: pageH + 2 * bleed }
}

// aspetto di uno slot dato il frame e l'aspetto pagina-contenuto
export function slotAspectOf(fr: Frame, pageW: number, pageH: number) {
  const cw = (pageW - 2 * MARGIN_MM), ch = (pageH - 2 * MARGIN_MM)
  return (fr.w * cw) / (fr.h * ch)
}

// ── strumento RITAGLIO: rettangolo di crop ⇄ cella (zoom/focale) ──────────────
// Il rettangolo è espresso in FRAZIONI dell'immagine: centro (cx,cy) 0..1 e larghezza w (0..1).
// L'altezza si ricava dall'aspetto dello slot.
export function baseWindowFrac(imgAspect: number, slotAspect: number): number {
  return coverWindow(imgAspect, slotAspect, { z: 1, fx: 0.5, fy: 0.5 }).ww // = bw (larghezza copertura a zoom 1)
}

export function cropToCell(imgAspect: number, slotAspect: number, cx: number, cy: number, wFrac: number): Cell {
  const bw = baseWindowFrac(imgAspect, slotAspect)
  const z = clamp(bw / Math.max(1e-4, wFrac), 1, 4)
  return { z, fx: clamp(cx, 0, 1), fy: clamp(cy, 0, 1) }
}

export function cellToCrop(imgAspect: number, slotAspect: number, cell: Cell): { cx: number; cy: number; w: number; h: number } {
  const bw = baseWindowFrac(imgAspect, slotAspect)
  const w = bw / Math.max(1, cell.z || 1)
  const h = (w * imgAspect) / slotAspect // frazione di ALTEZZA immagine (lo slot ha aspetto slotAspect in px)
  return { cx: clamp(cell.fx ?? 0.5, 0, 1), cy: clamp(cell.fy ?? 0.5, 0, 1), w, h }
}

// Allineamento della foto nello slot: 9 ancore (focale).
export const CROP_ANCHORS: Record<string, { fx: number; fy: number }> = {
  tl: { fx: 0, fy: 0 }, tc: { fx: 0.5, fy: 0 }, tr: { fx: 1, fy: 0 },
  cl: { fx: 0, fy: 0.5 }, cc: { fx: 0.5, fy: 0.5 }, cr: { fx: 1, fy: 0.5 },
  bl: { fx: 0, fy: 1 }, bc: { fx: 0.5, fy: 1 }, br: { fx: 1, fy: 1 },
}
