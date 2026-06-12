import { describe, it, expect } from 'vitest'
import { coverWindow, cellBackground, sourceRect, slotRect, pageBox, slotAspectOf, cropToCell, cellToCrop, baseWindowFrac, CROP_ANCHORS, DEFAULT_CELL, MARGIN_MM } from './albumGeometry'

const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

describe('coverWindow — crop/zoom/pan', () => {
  it('immagine quadrata in slot quadrato, zoom 1 = intera', () => {
    const w = coverWindow(1, 1, DEFAULT_CELL)
    expect(approx(w.ww, 1)).toBe(true); expect(approx(w.wh, 1)).toBe(true)
    expect(approx(w.wx, 0)).toBe(true); expect(approx(w.wy, 0)).toBe(true)
  })
  it('zoom 2 mostra metà, centrata', () => {
    const w = coverWindow(1, 1, { z: 2, fx: 0.5, fy: 0.5 })
    expect(approx(w.ww, 0.5)).toBe(true); expect(approx(w.wx, 0.25)).toBe(true)
  })
  it('focale clampata: pan oltre il bordo non esce dall’immagine', () => {
    const w = coverWindow(1, 1, { z: 2, fx: 5, fy: -5 })
    expect(w.wx).toBeGreaterThanOrEqual(0); expect(w.wx).toBeLessThanOrEqual(0.5)
    expect(w.wy).toBeGreaterThanOrEqual(0); expect(w.wy).toBeLessThanOrEqual(0.5)
  })
  it('immagine orizzontale (2:1) in slot quadrato: copre (window 0.5×0.5 in sorgente alto 0.5)', () => {
    const w = coverWindow(2, 1, DEFAULT_CELL)
    expect(approx(w.sh, 0.5)).toBe(true)
    expect(approx(w.ww, 0.5)).toBe(true); expect(approx(w.wh, 0.5)).toBe(true)
  })
  it('nessun zoom < 1 (clamp a 1)', () => {
    const w = coverWindow(1, 1, { z: 0.2, fx: 0.5, fy: 0.5 })
    expect(approx(w.ww, 1)).toBe(true)
  })
})

describe('cellBackground — anteprima CSS', () => {
  it('zoom 1 quadrato: size 100%, position centrata', () => {
    const b = cellBackground(1, 1, DEFAULT_CELL)
    expect(b.backgroundSize).toBe('100% 100%')
    expect(b.backgroundPosition).toBe('50% 50%')
  })
  it('zoom 2: size 200%', () => {
    const b = cellBackground(1, 1, { z: 2, fx: 0.5, fy: 0.5 })
    expect(b.backgroundSize).toBe('200% 200%')
  })
})

describe('sourceRect — pixel per drawImage', () => {
  it('immagine 1000×1000 in slot quadrato zoom1 = intera', () => {
    const r = sourceRect(1000, 1000, 1, DEFAULT_CELL)
    expect(approx(r.sx, 0)).toBe(true); expect(approx(r.sw, 1000)).toBe(true)
  })
  it('immagine 2000×1000 in slot quadrato = crop centrale 1000×1000', () => {
    const r = sourceRect(2000, 1000, 1, DEFAULT_CELL)
    expect(approx(r.sw, 1000, 1e-3)).toBe(true); expect(approx(r.sh, 1000, 1e-3)).toBe(true)
    expect(approx(r.sx, 500, 1e-3)).toBe(true); expect(approx(r.sy, 0, 1e-3)).toBe(true)
  })
})

describe('slotRect — margine, gutter, abbondanza', () => {
  const full = { x: 0, y: 0, w: 1, h: 1 }
  it('pagina piena senza abbondanza: inset del margine', () => {
    const r = slotRect(full, 300, 300, { margin: 8, gutter: 4, bleed: 0 })
    expect(approx(r.x, 8)).toBe(true); expect(approx(r.y, 8)).toBe(true)
    expect(approx(r.w, 284)).toBe(true); expect(approx(r.h, 284)).toBe(true)
  })
  it('pagina piena CON abbondanza: arriva al bordo pagina ingrandita', () => {
    const r = slotRect(full, 300, 300, { margin: 8, gutter: 4, bleed: 3 })
    expect(approx(r.x, 0)).toBe(true); expect(approx(r.y, 0)).toBe(true)
    expect(approx(r.w, 306)).toBe(true); expect(approx(r.h, 306)).toBe(true) // 300 + 2*3
  })
  it('slot sinistro di 2: gutter solo a destra (interno), bleed estende sinistra/alto/basso', () => {
    const left = { x: 0, y: 0, w: 0.5, h: 1 }
    const r = slotRect(left, 300, 300, { margin: 8, gutter: 4, bleed: 3 })
    expect(approx(r.x, 0)).toBe(true) // bordo sinistro
    // larghezza = metà contenuto - mezzo gutter (destra=dorso) + estensione bleed a sinistra
    expect(r.w).toBeGreaterThan(0)
    expect(approx(r.y, 0)).toBe(true) // alto al bordo
    expect(approx(r.h, 306)).toBe(true) // alto+basso bleed
  })
})

describe('strumento ritaglio — cropToCell ⇄ cellToCrop', () => {
  it('round-trip: cella → crop → cella', () => {
    for (const ia of [0.7, 1, 1.5, 2]) {
      for (const sa of [0.8, 1, 1.6]) {
        const cell = { z: 2.2, fx: 0.4, fy: 0.6 }
        const crop = cellToCrop(ia, sa, cell)
        const back = cropToCell(ia, sa, crop.cx, crop.cy, crop.w)
        expect(approx(back.z, cell.z, 1e-3)).toBe(true)
        expect(approx(back.fx, cell.fx, 1e-6)).toBe(true)
        expect(approx(back.fy, cell.fy, 1e-6)).toBe(true)
      }
    }
  })
  it('rettangolo più piccolo = zoom maggiore', () => {
    const big = cropToCell(1.5, 1, 0.5, 0.5, baseWindowFrac(1.5, 1))      // pieno
    const small = cropToCell(1.5, 1, 0.5, 0.5, baseWindowFrac(1.5, 1) / 2) // metà
    expect(approx(big.z, 1)).toBe(true)
    expect(approx(small.z, 2, 1e-3)).toBe(true)
  })
  it('zoom clampato a [1,4]', () => {
    expect(cropToCell(1, 1, 0.5, 0.5, 999).z).toBe(1)
    expect(cropToCell(1, 1, 0.5, 0.5, 0.0001).z).toBe(4)
  })
  it('ancore di allineamento ai 9 punti', () => {
    expect(CROP_ANCHORS.tl).toEqual({ fx: 0, fy: 0 })
    expect(CROP_ANCHORS.cc).toEqual({ fx: 0.5, fy: 0.5 })
    expect(CROP_ANCHORS.br).toEqual({ fx: 1, fy: 1 })
  })
})

describe('pageBox & slotAspectOf', () => {
  it('pageBox aggiunge 2*bleed', () => {
    const b = pageBox(300, 200, 3); expect(b.w).toBe(306); expect(b.h).toBe(206)
  })
  it('slotAspectOf di frame pieno = aspetto contenuto', () => {
    const a = slotAspectOf({ x: 0, y: 0, w: 1, h: 1 }, 300, 200)
    const expected = (300 - 2 * MARGIN_MM) / (200 - 2 * MARGIN_MM)
    expect(approx(a, expected)).toBe(true)
  })
})
