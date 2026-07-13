import { describe, it, expect } from 'vitest'
import { hexToRgb, rgbToHex, clamp01, hsvToRgb, rgbToHsv } from './color'
import { constrainEnd, lerp, uidgen } from './canvas'

// WI-0: verifica che l'estrazione del motore preservi il comportamento delle funzioni pure.
describe('color', () => {
  it('hexToRgb', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255])
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
    expect(hexToRgb('#1a1a1a')).toEqual([26, 26, 26])
    expect(hexToRgb('c8a24b')).toEqual([200, 162, 75])
    expect(hexToRgb('nope')).toEqual([0, 0, 0])
  })
  it('rgbToHex arrotonda e clampa', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
    expect(rgbToHex(26, 26, 26)).toBe('#1a1a1a')
    expect(rgbToHex(-5, 300, 127.6)).toBe('#00ff80')
  })
  it('clamp01', () => {
    expect(clamp01(-1)).toBe(0); expect(clamp01(2)).toBe(1); expect(clamp01(0.5)).toBe(0.5)
  })
  it('hsv<->rgb round-trip su colori saturi', () => {
    for (const hex of ['#c8a24b', '#3a4a6b', '#c65d5d', '#6b8e6b']) {
      const [r, g, b] = hexToRgb(hex)
      const [h, s, v] = rgbToHsv(r, g, b)
      const [r2, g2, b2] = hsvToRgb(h, s, v)
      expect(Math.round(r2)).toBe(r); expect(Math.round(g2)).toBe(g); expect(Math.round(b2)).toBe(b)
    }
  })
  it('hsvToRgb normalizza h fuori range', () => {
    expect(hsvToRgb(360, 1, 1)).toEqual(hsvToRgb(0, 1, 1))
  })
})

describe('geometria', () => {
  it('lerp', () => { expect(lerp(0, 10, 0.5)).toBe(5); expect(lerp(4, 4, 0.9)).toBe(4) })
  it('constrainEnd senza shift ritorna b', () => {
    expect(constrainEnd({ x: 0, y: 0 }, { x: 7, y: 3 }, 'rect', false)).toEqual({ x: 7, y: 3 })
  })
  it('constrainEnd rect con shift = quadrato (lato = max)', () => {
    expect(constrainEnd({ x: 0, y: 0 }, { x: 10, y: 4 }, 'rect', true)).toEqual({ x: 10, y: 10 })
    expect(constrainEnd({ x: 0, y: 0 }, { x: -3, y: -12 }, 'ellipse', true)).toEqual({ x: -12, y: -12 })
  })
  it('constrainEnd line con shift aggancia a 45°', () => {
    const p = constrainEnd({ x: 0, y: 0 }, { x: 10, y: 1 }, 'line', true) // quasi orizzontale → 0°
    expect(Math.round(p.y)).toBe(0); expect(p.x).toBeGreaterThan(9)
  })
})

describe('uidgen', () => {
  it('produce id stringa non vuota con prefisso l', () => {
    const id = uidgen(); expect(typeof id).toBe('string'); expect(id.startsWith('l')).toBe(true); expect(id.length).toBeGreaterThan(2)
  })
})
