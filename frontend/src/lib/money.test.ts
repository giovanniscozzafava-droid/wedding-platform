import { describe, it, expect } from 'vitest'
import { eur, eurInt, roundCents, sumEuro } from './money'

describe('sumEuro — somma esatta (niente drift float)', () => {
  it('0.1 + 0.2 = 0.30 (il classico)', () => expect(sumEuro([0.1, 0.2])).toBe(0.3))
  it('19.99 + 0.01 = 20', () => expect(sumEuro([19.99, 0.01])).toBe(20))
  it('100 centesimi = 1.00 esatto', () => expect(sumEuro(Array(100).fill(0.01))).toBe(1))
  it('importi a 2 decimali sommati esattamente', () => expect(sumEuro([1234.56, 7.89, 0.55])).toBe(1243))
  it('mille righe da 0.07 = 70.00', () => expect(sumEuro(Array(1000).fill(0.07))).toBe(70))
  it('stringhe dal DB e null/undefined gestiti', () => expect(sumEuro(['10.10', '0.90', null, undefined, ''])).toBe(11))
  it('non perde un centesimo su importi reali', () => {
    const v = [299.99, 1500.0, 45.5, 12.34, 0.17]
    expect(sumEuro(v)).toBe(1858)
  })
})

describe('roundCents', () => {
  it('arrotonda al centesimo', () => expect(roundCents(0.1 + 0.2)).toBe(0.3))
  it('lascia gli importi a 2 decimali invariati', () => expect(roundCents(1234.56)).toBe(1234.56))
  it('gestisce stringhe e nulli', () => { expect(roundCents('9.99')).toBe(9.99); expect(roundCents(null)).toBe(0) })
})

describe('formattazione EUR (it-IT)', () => {
  // NB: il separatore migliaia dipende dall'ICU del runtime (nel browser raggruppa: 1.234,50);
  // qui asseriamo le parti stabili: virgola decimale e arrotondamento.
  it('eur due decimali', () => expect(eur(1234.5)).toMatch(/1\.?234,50/))
  it('eurInt arrotonda senza decimali', () => expect(eurInt(1234.56)).toMatch(/1\.?235/))
  it('null → 0', () => { expect(eur(null)).toMatch(/0,00/); expect(eurInt(undefined)).toMatch(/0/) })
})
