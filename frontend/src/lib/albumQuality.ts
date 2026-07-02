// Controllo QUALITÀ DI STAMPA delle foto nell'impaginatore.
//
// Le foto arrivano da Google Drive e nell'editor si caricano SOLO come thumbnail (hiUrl = sz=w1600):
// Drive non ingrandisce mai una foto, quindi se la thumb torna SOTTO i 1600px l'originale è davvero
// piccolo — ed è esattamente quello che finirà in stampa, perché l'export scarica l'originale
// full-res (album-image). Se invece la thumb è cappata a 1600, l'originale è ≥1600 e ignoto
// (verosimilmente grande) → non lo giudichiamo. Risultato: ZERO falsi positivi, segnaliamo solo le
// foto realmente a bassa risoluzione. Il DPI effettivo usa la STESSA geometria dell'export
// (sourceRect), così l'avviso coincide col risultato stampato (crop/zoom inclusi).
import { sourceRect, type Cell } from './albumGeometry'
import { getFormat, type AlbumFormat } from './albumFormats'
import type { AlbumPage } from './albumEngine'
import type { FreeEl } from './albumFree'

export const DPI_GOOD = 150 // sopra = stampa nitida
export const DPI_MIN = 100  // 100–150 = al limite; sotto = sgranata
// Larghezza della thumbnail Drive richiesta (hiUrl, sz=w1600). Se la larghezza misurata è sotto
// questa soglia, la thumb NON è cappata → la sua dimensione È quella reale dell'originale.
export const HIURL_CAP = 1600

export type RealDim = { w: number; h: number; capped: boolean }
export type QualityLevel = 'ok' | 'warn' | 'low' | 'unknown'
export type Quality = { level: QualityLevel; dpi: number }

const DEFAULT_CELL: Cell = { z: 1, fx: 0.5, fy: 0.5 }

// mm stampati dell'elemento sulla superficie. spread = tavola unica (larga 2× la pagina singola).
export function elPrintMm(el: Pick<FreeEl, 'w' | 'h'>, fmt: AlbumFormat, spread: boolean): { w: number; h: number } {
  const effW = spread ? fmt.w * 2 : fmt.w
  return { w: Math.max(1, el.w * effW), h: Math.max(1, el.h * fmt.h) }
}

// DPI effettivo con cui la porzione visibile della foto verrà stampata nello slot.
export function slotDpi(dim: RealDim, printWmm: number, printHmm: number, cell?: Cell | null): number {
  const slotAspect = printWmm / Math.max(0.001, printHmm)
  const sr = sourceRect(dim.w, dim.h, slotAspect, cell ?? DEFAULT_CELL)
  const dpiX = sr.sw / Math.max(0.001, printWmm / 25.4)
  const dpiY = sr.sh / Math.max(0.001, printHmm / 25.4)
  return Math.min(dpiX, dpiY)
}

// Verdetto qualità per una foto in un dato slot. `dim` assente → 'unknown' (misura non pronta).
export function photoQuality(dim: RealDim | undefined | null, printWmm: number, printHmm: number, cell?: Cell | null): Quality {
  if (!dim || !(dim.w > 0) || !(dim.h > 0)) return { level: 'unknown', dpi: 0 }
  if (dim.capped) return { level: 'ok', dpi: 0 } // originale grande/ignoto: nessun allarme
  const dpi = slotDpi(dim, printWmm, printHmm, cell)
  const level: QualityLevel = dpi < DPI_MIN ? 'low' : dpi < DPI_GOOD ? 'warn' : 'ok'
  return { level, dpi: Math.round(dpi) }
}

// Testo esplicativo mostrato sul badge di avviso.
export function qualityHint(q: Quality): string {
  if (q.level === 'low') return `Bassa risoluzione (~${q.dpi} dpi): in stampa risulterà sgranata. Rimpicciolisci la foto o sostituiscila.`
  if (q.level === 'warn') return `Risoluzione al limite (~${q.dpi} dpi) per questa dimensione di stampa.`
  return ''
}

// Conta le foto piazzate a rischio su tutte le tavole (per l'indicatore globale in toolbar).
export function countLowRes(pages: AlbumPage[], formatKey: string, realDims: Record<string, RealDim>): { low: number; warn: number } {
  const fmt = getFormat(formatKey)
  let low = 0, warn = 0
  const bump = (q: Quality) => { if (q.level === 'low') low++; else if (q.level === 'warn') warn++ }
  for (const p of pages) {
    // superficie: tavolaFree = spread (2× pagina); pagina libera singola = 1× pagina.
    const spread = !!p.tavolaFree
    if (p.spreadImage) {
      const fr = p.spreadImage.frame ?? { x: 0, y: 0, w: 1, h: 1 }
      bump(photoQuality(realDims[p.spreadImage.mediaId], fr.w * fmt.w * 2, fr.h * fmt.h, p.spreadImage.cell))
    }
    for (const el of p.elements ?? []) {
      const pm = elPrintMm(el, fmt, spread)
      bump(photoQuality(realDims[el.mediaId], pm.w, pm.h, el.cell))
    }
  }
  return { low, warn }
}
