import { describe, it, expect } from 'vitest'
import {
  emptyBoard, addImage, addText, addShape, addIcon, moveEl, resizeEl, snapAngle, snapMove,
  updateEl, removeEl, bringFront, sendBack, duplicateEl, MIN_EL, PRESETS, type MoodEl,
} from './moodBoard'

const approx = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e
const el = (o: Partial<MoodEl> = {}): MoodEl => ({ id: 'a', kind: 'shape', x: 0.3, y: 0.3, w: 0.2, h: 0.2, rot: 0, z: 1, ...o })

describe('fabbriche elementi', () => {
  it('aggiungono un elemento e alzano lo z', () => {
    let b = emptyBoard()
    b = addImage(b, 'http://x/i.jpg'); b = addText(b, 'ciao'); b = addShape(b, 'circle'); b = addIcon(b, 'Heart')
    expect(b.els).toHaveLength(4)
    expect(b.els.map((e) => e.kind)).toEqual(['image', 'text', 'shape', 'icon'])
    expect(b.els[3]!.z).toBeGreaterThan(b.els[0]!.z)
  })
})

describe('moveEl / resizeEl', () => {
  it('clampa lasciando un lembo in tela', () => {
    const m = moveEl(el(), -5, 5)
    expect(m.x).toBeGreaterThanOrEqual(-el().w + 0.04 - 1e-9)
    expect(m.y).toBeLessThanOrEqual(1 - 0.04 + 1e-9)
  })
  it('se: angolo NW fisso', () => {
    const r = resizeEl(el(), 'se', 0.7, 0.8)
    expect(approx(r.x, 0.3)).toBe(true); expect(approx(r.w, 0.4)).toBe(true); expect(approx(r.h, 0.5)).toBe(true)
  })
  it('non scende sotto MIN_EL', () => {
    const r = resizeEl(el(), 'se', 0.3001, 0.3001)
    expect(r.w).toBeGreaterThanOrEqual(MIN_EL - 1e-9); expect(r.h).toBeGreaterThanOrEqual(MIN_EL - 1e-9)
  })
})

describe('snap', () => {
  it('snapAngle aggancia agli angoli retti', () => { expect(snapAngle(2)).toBe(0); expect(snapAngle(88)).toBe(90) })
  it('snapMove aggancia il centro al centro tela', () => {
    const e = el({ x: 0.39, y: 0.39, w: 0.2, h: 0.2 })
    const s = snapMove(e, [])
    expect(approx(s.x + e.w / 2, 0.5, 1e-9)).toBe(true)
    expect(s.vGuides).toContain(0.5)
  })
})

describe('liste / z-order', () => {
  const els = [el({ id: 'a', z: 1 }), el({ id: 'b', z: 2 }), el({ id: 'c', z: 3 })]
  it('updateEl applica patch', () => { expect(updateEl(els, 'b', { rot: 30 }).find((e) => e.id === 'b')!.rot).toBe(30) })
  it('removeEl toglie', () => { expect(removeEl(els, 'b').map((e) => e.id)).toEqual(['a', 'c']) })
  it('bringFront porta z massimo', () => { expect(bringFront(els, 'a').find((e) => e.id === 'a')!.z).toBeGreaterThan(3) })
  it('sendBack porta z minimo', () => { expect(sendBack(els, 'c').find((e) => e.id === 'c')!.z).toBeLessThan(1) })
  it('duplicateEl crea copia spostata con nuovo id', () => {
    const { els: out, newId } = duplicateEl(els, 'a')
    expect(out).toHaveLength(4); expect(newId).not.toBe('a')
    const copy = out.find((e) => e.id === newId)!
    expect(copy.x).toBeGreaterThan(els[0]!.x)
  })
})

describe('preset', () => {
  it('ogni preset costruisce una tela con elementi', () => {
    for (const p of PRESETS) {
      const b = p.build(['a.jpg', 'b.jpg', 'c.jpg'])
      expect(b.els.length).toBeGreaterThan(0)
      expect(typeof b.bg).toBe('string')
    }
  })
})
