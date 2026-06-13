import { describe, it, expect } from 'vitest'
import { autoLayout, framesForPage, gridFrames, chooseTemplate, templatesFor, cycleTemplate, capacity, newPage, TEMPLATES } from './albumEngine'

const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

describe('template & capacità', () => {
  it('chooseTemplate per conteggio', () => {
    expect(chooseTemplate(1, 1)).toBe('1')
    expect(chooseTemplate(2, 1.5)).toBe('2h')
    expect(chooseTemplate(2, 0.8)).toBe('2v')
    expect(chooseTemplate(3, 1.5)).toBe('3l')
    expect(chooseTemplate(4, 1)).toBe('4')
    expect(chooseTemplate(6, 1)).toBe('grid')
  })
  it('templatesFor include grid per >1 + varianti creative', () => {
    expect(templatesFor(2)).toContain('grid')
    expect(templatesFor(2)).toEqual(['2h', '2hL', '2v', '2vT', 'grid'])
    expect(templatesFor(3)).toEqual(['3l', '3t', '3r', '3col', '3v', 'grid'])
    expect(templatesFor(4)).toEqual(['4', '4l', '4r', '4row', '4col', 'grid'])
    expect(templatesFor(5)).toEqual(['5l', '5t', 'grid'])
    expect(templatesFor(6)).toEqual(['grid', '6band'])
    expect(templatesFor(7)).toEqual(['grid'])
  })
  it('cycleTemplate gira tra le alternative (Altro layout)', () => {
    expect(cycleTemplate('4', 4)).toBe('4l')
    expect(cycleTemplate('4l', 4)).toBe('4r')
    expect(cycleTemplate('grid', 4)).toBe('4')
    expect(cycleTemplate('1', 1)).toBe('1')
  })
  it('tutti i template curati hanno capacity = numero di slot e frame entro [0,1]', () => {
    for (const t of ['2hL', '3col', '4r', '4row', '5l', '5t', '6band'] as const) {
      const fr = TEMPLATES[t]
      expect(capacity(t)).toBe(fr.length)
      for (const f of fr) {
        expect(f.x).toBeGreaterThanOrEqual(-1e-9)
        expect(f.y).toBeGreaterThanOrEqual(-1e-9)
        expect(f.x + f.w).toBeLessThanOrEqual(1 + 1e-9)
        expect(f.y + f.h).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })
  it('capacity dei template curati = numero slot; grid = 0 (dinamico)', () => {
    expect(capacity('4')).toBe(4)
    expect(capacity('grid')).toBe(0)
  })
})

describe('gridFrames — griglia bilanciata', () => {
  it('5 foto: 3 colonne, 2 righe, ultima riga distesa', () => {
    const f = gridFrames(5)
    expect(f).toHaveLength(5)
    // prima riga: 3 celle larghe 1/3
    expect(approx(f[0]!.w, 1 / 3)).toBe(true)
    // ultima riga: 2 celle larghe 1/2
    expect(approx(f[3]!.w, 1 / 2)).toBe(true)
    expect(approx(f[4]!.x, 1 / 2)).toBe(true)
  })
  it('le frame coprono [0,1] senza uscire', () => {
    for (const n of [1, 2, 3, 6, 9, 12]) {
      for (const fr of gridFrames(n)) {
        expect(fr.x).toBeGreaterThanOrEqual(-1e-9)
        expect(fr.y).toBeGreaterThanOrEqual(-1e-9)
        expect(fr.x + fr.w).toBeLessThanOrEqual(1 + 1e-9)
        expect(fr.y + fr.h).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })
})

describe('framesForPage', () => {
  it('template grid usa gridFrames(n)', () => {
    const p = { id: 'a', moment: null, template: 'grid' as const, mediaIds: ['1', '2', '3', '4', '5', '6'] }
    expect(framesForPage(p)).toHaveLength(6)
  })
  it('conteggio > 4 ricade su griglia anche con template curato', () => {
    const p = { id: 'a', moment: null, template: '4' as const, mediaIds: ['1', '2', '3', '4', '5'] }
    expect(framesForPage(p)).toHaveLength(5)
  })
  it('template coerente col conteggio usa il template', () => {
    const p = { id: 'a', moment: null, template: '2h' as const, mediaIds: ['1', '2'] }
    expect(framesForPage(p)).toEqual(TEMPLATES['2h'])
  })
  it('pagina vuota → almeno 1 frame (nessun crash)', () => {
    expect(framesForPage(newPage()).length).toBeGreaterThanOrEqual(1)
  })
  it('template custom usa i frame salvati (troncati al numero di foto)', () => {
    const frames = [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }, { x: 0, y: 0.5, w: 1, h: 0.5 }]
    const p = { id: 'a', moment: null, template: 'custom' as const, mediaIds: ['1', '2'], frames }
    expect(framesForPage(p)).toEqual(frames.slice(0, 2))
  })
})

describe('autoLayout — tag-driven', () => {
  it('raggruppa per momento in ordine e impagina tutte le foto', () => {
    const sel = [
      { id: 'c1', moment: 'coppia' }, { id: 'f1', moment: 'famiglia' },
      { id: 'c2', moment: 'coppia' }, { id: 'p1', moment: 'preparativi' },
    ]
    const { pages } = autoLayout(sel, 'SQ_30')
    const placed = pages.flatMap((p) => p.mediaIds)
    expect(placed.sort()).toEqual(['c1', 'c2', 'f1', 'p1'])
    // preparativi (ordine 0) prima di famiglia prima di coppia
    const firstMomentOfPage = pages.map((p) => p.moment)
    expect(firstMomentOfPage[0]).toBe('preparativi')
  })
  it('ogni momento inizia su una nuova pagina', () => {
    const sel = [{ id: 'a', moment: 'coppia' }, { id: 'b', moment: 'famiglia' }]
    const { pages } = autoLayout(sel, 'SQ_30')
    const moments = new Set(pages.map((p) => p.moment))
    expect(moments.size).toBe(2)
  })
})
