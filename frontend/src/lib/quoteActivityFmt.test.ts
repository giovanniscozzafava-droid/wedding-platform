import { describe, it, expect } from 'vitest'
import { relTime, deviceFromUa } from './quoteActivityFmt'

const NOW = new Date('2026-06-19T12:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const MIN = 60_000, H = 60 * MIN, D = 24 * H

describe('relTime', () => {
  it('adesso sotto il minuto', () => expect(relTime(ago(30_000), NOW)).toBe('adesso'))
  it('minuti', () => expect(relTime(ago(5 * MIN), NOW)).toBe('5 min fa'))
  it('un\'ora singolare', () => expect(relTime(ago(1 * H), NOW)).toBe('1 ora fa'))
  it('ore plurale', () => expect(relTime(ago(3 * H), NOW)).toBe('3 ore fa'))
  it('ieri', () => expect(relTime(ago(1 * D + H), NOW)).toBe('ieri'))
  it('giorni', () => expect(relTime(ago(3 * D), NOW)).toBe('3 giorni fa'))
  it('oltre la settimana → data', () => expect(relTime(ago(10 * D), NOW)).toMatch(/\d/))
  it('data invalida → stringa vuota', () => expect(relTime('non-una-data', NOW)).toBe(''))
})

describe('deviceFromUa', () => {
  it('iPhone → mobile', () => expect(deviceFromUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('mobile'))
  it('Android → mobile', () => expect(deviceFromUa('Mozilla/5.0 (Linux; Android 14; Pixel)')).toBe('mobile'))
  it('Mac desktop → desktop', () => expect(deviceFromUa('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('desktop'))
  it('null → desktop', () => expect(deviceFromUa(null)).toBe('desktop'))
})
