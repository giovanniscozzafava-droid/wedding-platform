// Geometria dell'impaginatore — funzioni PURE (testate) condivise da editor ed export,
// così l'anteprima e il PDF coincidono al pixel. Crop/zoom/pan per foto + abbondanza (bleed).

export type Cell = { z: number; fx: number; fy: number } // zoom>=1, focale (0..1) nel sorgente
export const DEFAULT_CELL: Cell = { z: 1, fx: 0.5, fy: 0.5 }
export const BLEED_MM = 3   // abbondanza standard di stampa
export const MARGIN_MM = 8  // margine interno pagina
export const GUTTER_MM = 4  // distanza tra foto

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Finestra del sorgente (normalizzato: larghezza=1, altezza=1/imgAspect) mostrata nello slot,
// per coprire lo slot all'aspetto richiesto, con zoom e focale. Restituisce wx,wy,ww,wh,sw,sh.
export function coverWindow(imgAspect: number, slotAspect: number, cell: Cell) {
  const z = Math.max(1, cell.z || 1)
  const ia = imgAspect > 0 ? imgAspect : 1
  const sw = 1, sh = 1 / ia
  let bw: number, bh: number
  if (ia > slotAspect) { bh = sh; bw = sh * slotAspect } else { bw = sw; bh = sw / slotAspect }
  const ww = bw / z, wh = bh / z
  const cx = clamp(cell.fx ?? 0.5, 0, 1) * sw
  const cy = clamp(cell.fy ?? 0.5, 0, 1) * sh
  const wx = clamp(cx - ww / 2, 0, Math.max(0, sw - ww))
  const wy = clamp(cy - wh / 2, 0, Math.max(0, sh - wh))
  return { wx, wy, ww, wh, sw, sh }
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
