import { describe, it, expect } from 'vitest'
import { toFreeElements, newFreeEl, moveEl, resizeEl, snapAngle, snapMove, removeFreeEl, updateFreeEl, bringToFront, MIN_EL, type FreeEl } from './albumFree'

const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps
const el = (over: Partial<FreeEl> = {}): FreeEl => ({ id: 'a', mediaId: 'm', x: 0.3, y: 0.3, w: 0.2, h: 0.2, rot: 0, cell: { z: 1, fx: 0.5, fy: 0.5 }, ...over })

describe('toFreeElements', () => {
  it('crea un elemento per ogni foto del template, dentro i margini', () => {
    const page = { id: 'p', moment: null, template: '2h' as const, mediaIds: ['a', 'b'] }
    const els = toFreeElements(page, 'SQ_30')
    expect(els).toHaveLength(2)
    for (const e of els) { expect(e.x).toBeGreaterThan(0); expect(e.x + e.w).toBeLessThanOrEqual(1.001) }
  })
  it('salta gli slot vuoti', () => {
    const page = { id: 'p', moment: null, template: '2h' as const, mediaIds: ['a', ''] }
    expect(toFreeElements(page, 'SQ_30')).toHaveLength(1)
  })
})

describe('moveEl — resta almeno in parte in pagina', () => {
  it('clampa fuori pagina ma lascia un lembo dentro', () => {
    const m = moveEl(el(), -5, 5)
    expect(m.x).toBeGreaterThanOrEqual(-el().w + 0.03 - 1e-9)
    expect(m.y).toBeLessThanOrEqual(1 - 0.03 + 1e-9)
  })
})

describe('resizeEl — angolo opposto fisso, dimensione minima', () => {
  it('se: cambia w/h, angolo NW fisso', () => {
    const r = resizeEl(el(), 'se', 0.7, 0.8)
    expect(approx(r.x, 0.3)).toBe(true); expect(approx(r.y, 0.3)).toBe(true)
    expect(approx(r.w, 0.4)).toBe(true); expect(approx(r.h, 0.5)).toBe(true)
  })
  it('nw: sposta x/y, angolo SE fisso', () => {
    const r = resizeEl(el(), 'nw', 0.35, 0.35)
    expect(approx(r.x, 0.35)).toBe(true); expect(approx(r.w, 0.15)).toBe(true)
  })
  it('non scende sotto la dimensione minima', () => {
    const r = resizeEl(el(), 'se', 0.30001, 0.30001)
    expect(r.w).toBeGreaterThanOrEqual(MIN_EL - 1e-9)
    expect(r.h).toBeGreaterThanOrEqual(MIN_EL - 1e-9)
  })
})

describe('snapAngle', () => {
  it('aggancia agli angoli retti entro 4°', () => {
    expect(snapAngle(2)).toBe(0)
    expect(snapAngle(88)).toBe(90)
    expect(snapAngle(317)).toBe(315)
  })
  it('aggancia ai multipli di 15 entro 2°', () => {
    expect(snapAngle(31)).toBe(30)
  })
  it('lascia stare gli angoli non vicini', () => {
    expect(snapAngle(52)).toBe(52)
  })
})

describe('snapMove — smart guides come Canva', () => {
  it('aggancia il centro elemento al centro pagina', () => {
    const e = el({ x: 0.39, y: 0.39, w: 0.2, h: 0.2 }) // centro a 0.49 ~ 0.5
    const s = snapMove(e, [], 0.05, 0.05)
    expect(approx(s.x + e.w / 2, 0.5, 1e-9)).toBe(true)
    expect(s.vGuides).toContain(0.5)
  })
  it('aggancia il bordo sinistro al margine', () => {
    const e = el({ x: 0.055, y: 0.5, w: 0.2, h: 0.2 })
    const s = snapMove(e, [], 0.05, 0.05)
    expect(approx(s.x, 0.05, 1e-9)).toBe(true)
    expect(s.vGuides).toContain(0.05)
  })
  it('aggancia all’altro elemento (bordi allineati)', () => {
    const other = el({ id: 'o', x: 0.6, y: 0.1, w: 0.2, h: 0.2 })
    const e = el({ x: 0.605, y: 0.5, w: 0.2, h: 0.2 }) // left ~ other.left 0.6
    const s = snapMove(e, [other], 0.05, 0.05)
    expect(approx(s.x, 0.6, 1e-9)).toBe(true)
  })
  it('nessun aggancio se lontano', () => {
    const e = el({ x: 0.2, y: 0.7, w: 0.1, h: 0.1 })
    const s = snapMove(e, [], 0.05, 0.05)
    expect(s.vGuides.length === 0 || s.hGuides.length === 0).toBe(true)
  })
})

describe('liste elementi', () => {
  const els = [el({ id: 'a' }), el({ id: 'b' }), el({ id: 'c' })]
  it('removeFreeEl', () => { expect(removeFreeEl(els, 'b').map((e) => e.id)).toEqual(['a', 'c']) })
  it('updateFreeEl applica la patch', () => { expect(updateFreeEl(els, 'b', { rot: 30 }).find((e) => e.id === 'b')!.rot).toBe(30) })
  it('bringToFront porta in cima (ultimo = sopra)', () => { expect(bringToFront(els, 'a').map((e) => e.id)).toEqual(['b', 'c', 'a']) })
  it('newFreeEl id univoci', () => { expect(newFreeEl('m').id).not.toBe(newFreeEl('m').id) })
})
