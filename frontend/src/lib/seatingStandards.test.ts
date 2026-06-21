import { describe, it, expect } from 'vitest'
import { tableFootprint, recommendedSeats, roomCapacity, seatedCount, COVER } from './seatingStandards'

describe('tableFootprint', () => {
  it('rotondo 8 posti ≈ Ø1,65 m (standard ~Ø1,5–1,7)', () => {
    const f = tableFootprint('ROUND', 8)
    expect(f.round).toBe(true)
    expect(f.w).toBeCloseTo(1.65, 1)
    expect(f.w).toEqual(f.l)
  })
  it('rotondo cresce con i posti (8 < 10 < 12)', () => {
    expect(tableFootprint('ROUND', 8).w).toBeLessThan(tableFootprint('ROUND', 10).w)
    expect(tableFootprint('ROUND', 10).w).toBeLessThan(tableFootprint('ROUND', 12).w)
  })
  it('rettangolare 12: lunghezza = 6 coperti per lato, profondità ~0,95', () => {
    const f = tableFootprint('RECT', 12)
    expect(f.w).toBeCloseTo(6 * COVER, 2)
    expect(f.l).toBeCloseTo(0.95, 2)
  })
  it('imperiale è più profondo del rettangolare', () => {
    expect(tableFootprint('IMPERIALE', 12).l).toBeGreaterThan(tableFootprint('RECT', 12).l)
  })
  it('presidenza (HEAD): un solo lato, profondità ridotta', () => {
    const f = tableFootprint('HEAD', 6)
    expect(f.l).toBeCloseTo(0.8, 2)
    expect(f.w).toBeCloseTo(6 * COVER, 2)
  })
  it('non esplode con posti assurdi (clamp)', () => {
    expect(tableFootprint('ROUND', 75).w).toBeLessThanOrEqual(3.2)
  })
})

describe('recommendedSeats', () => {
  it('Ø1,5 m → ~7 posti', () => expect(recommendedSeats('ROUND', 1.5)).toBe(7))
  it('Ø1,8 m → ~8 posti', () => expect(recommendedSeats('ROUND', 1.8)).toBe(8))
  it('rettangolo 3 m → ~8 posti (2 lati)', () => expect(recommendedSeats('RECT', 3)).toBe(8))
})

describe('roomCapacity', () => {
  it('10×8 = 80 m² → ~57 invitati (1,4 m²/ospite)', () => {
    const c = roomCapacity(10, 8)
    expect(c.area).toBe(80)
    expect(c.guests).toBe(57)
  })
  it('sala vuota → 0', () => expect(roomCapacity(0, 0).guests).toBe(0))
})

describe('seatedCount', () => {
  it('conta solo i seduti reali (no senza-tavolo, no NO, no infant)', () => {
    const g = [
      { table_id: 't1' }, { table_id: 't1', rsvp: 'NO' },
      { table_id: null }, { table_id: 't2', age_group: 'INFANT' }, { table_id: 't2' },
    ]
    expect(seatedCount(g)).toBe(2)
  })
})
