// Color theory helpers for wedding palette suggestions.
// Tutti gli hex sono in lowercase senza alpha.

export type RGB = { r: number; g: number; b: number }
export type HSL = { h: number; s: number; l: number }
export type PaletteSwatch = { hex: string; name?: string }
export type Palette = { id: string; name: string; mood?: string; colors: PaletteSwatch[] }

// ───────────────────────── conversioni ─────────────────────────

export function hexToRgb(hex: string): RGB | null {
  const m = hex.trim().replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case R: h = ((G - B) / d + (G < B ? 6 : 0)); break
      case G: h = ((B - R) / d + 2); break
      case B: h = ((R - G) / d + 4); break
    }
    h *= 60
  }
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const C = (1 - Math.abs(2 * l - 1)) * s
  const Hp = ((h % 360) + 360) % 360 / 60
  const X = C * (1 - Math.abs((Hp % 2) - 1))
  let R = 0, G = 0, B = 0
  if (Hp < 1) [R, G, B] = [C, X, 0]
  else if (Hp < 2) [R, G, B] = [X, C, 0]
  else if (Hp < 3) [R, G, B] = [0, C, X]
  else if (Hp < 4) [R, G, B] = [0, X, C]
  else if (Hp < 5) [R, G, B] = [X, 0, C]
  else [R, G, B] = [C, 0, X]
  const m = l - C / 2
  return { r: (R + m) * 255, g: (G + m) * 255, b: (B + m) * 255 }
}

// ───────────────────────── suggeritori ─────────────────────────

/** Restituisce 5 colori generati da un colore base con la logica scelta. */
export function suggestPalette(baseHex: string, kind: 'monochrome' | 'analogous' | 'complementary' | 'triadic' | 'split-complement' | 'warm-earth' | 'cool-fresh'): string[] {
  const base = hexToRgb(baseHex) ?? { r: 196, g: 154, b: 92 }
  const baseHsl = rgbToHsl(base)

  const adjust = (h: number, s: number, l: number) =>
    rgbToHex(hslToRgb({ h: ((h % 360) + 360) % 360, s: Math.max(0, Math.min(1, s)), l: Math.max(0, Math.min(1, l)) }))

  switch (kind) {
    case 'monochrome':
      return [
        adjust(baseHsl.h, baseHsl.s * 0.4, 0.94),  // chiaro
        adjust(baseHsl.h, baseHsl.s * 0.6, 0.82),
        baseHex,
        adjust(baseHsl.h, baseHsl.s * 1.05, 0.45),
        adjust(baseHsl.h, baseHsl.s * 1.2, 0.22),  // scuro
      ]
    case 'analogous':
      return [
        adjust(baseHsl.h - 30, baseHsl.s * 0.7, 0.88),
        adjust(baseHsl.h - 15, baseHsl.s * 0.9, 0.7),
        baseHex,
        adjust(baseHsl.h + 15, baseHsl.s * 0.9, 0.7),
        adjust(baseHsl.h + 30, baseHsl.s * 0.7, 0.5),
      ]
    case 'complementary':
      return [
        adjust(baseHsl.h, baseHsl.s * 0.4, 0.94),
        baseHex,
        adjust(baseHsl.h, baseHsl.s * 1.1, 0.35),
        adjust(baseHsl.h + 180, baseHsl.s * 0.6, 0.7),
        adjust(baseHsl.h + 180, baseHsl.s * 1.0, 0.5),
      ]
    case 'triadic':
      return [
        baseHex,
        adjust(baseHsl.h + 120, baseHsl.s * 0.8, baseHsl.l),
        adjust(baseHsl.h + 240, baseHsl.s * 0.8, baseHsl.l),
        adjust(baseHsl.h, baseHsl.s * 0.3, 0.92),
        adjust(baseHsl.h, baseHsl.s * 0.7, 0.25),
      ]
    case 'split-complement':
      return [
        baseHex,
        adjust(baseHsl.h + 150, baseHsl.s * 0.85, 0.55),
        adjust(baseHsl.h + 210, baseHsl.s * 0.85, 0.55),
        adjust(baseHsl.h, baseHsl.s * 0.3, 0.94),
        adjust(baseHsl.h, baseHsl.s * 0.6, 0.25),
      ]
    case 'warm-earth':
      // Mix elegante terra di Siena + crema + verde salvia per matrimoni rustic
      return ['#f3eee4', '#d6c4a1', baseHex, '#a3886f', '#5d4d3a']
    case 'cool-fresh':
      // Tons freddi, blu polvere + bianco + grigio perla
      return ['#f7f8fb', '#cfd9e3', baseHex, '#7a8da0', '#3a4a5e']
  }
}

/** Preset selezionati a mano da wedding pinterest/editorial — categorie tipiche. */
export const PRESET_PALETTES: Palette[] = [
  {
    id: 'sage-blush', name: 'Sage & blush', mood: 'Garden romantic',
    colors: [
      { hex: '#f5ebe0', name: 'Avorio' },
      { hex: '#e7c9b9', name: 'Cipria' },
      { hex: '#c2b89c', name: 'Lino' },
      { hex: '#8a9a7b', name: 'Salvia' },
      { hex: '#4e5d4c', name: 'Bosco' },
    ],
  },
  {
    id: 'tuscan-gold', name: 'Tuscan gold', mood: 'Italian elegance',
    colors: [
      { hex: '#fbf5e9', name: 'Crema' },
      { hex: '#e8d9b3', name: 'Vaniglia' },
      { hex: '#25402F', name: 'Oro' },
      { hex: '#7a4f25', name: 'Caramello' },
      { hex: '#3a2a1a', name: 'Cuoio' },
    ],
  },
  {
    id: 'mediterranean', name: 'Mediterranean blue', mood: 'Coastal chic',
    colors: [
      { hex: '#f4f1ea', name: 'Sabbia' },
      { hex: '#e2cba5', name: 'Lino' },
      { hex: '#7fb1c2', name: 'Cielo' },
      { hex: '#3a6f87', name: 'Egeo' },
      { hex: '#1d3d50', name: 'Notte' },
    ],
  },
  {
    id: 'dusty-rose', name: 'Dusty rose', mood: 'Vintage romantic',
    colors: [
      { hex: '#fbeaea', name: 'Quarzo' },
      { hex: '#e3b4b4', name: 'Rosa antica' },
      { hex: '#b07c7c', name: 'Mauve' },
      { hex: '#7a5050', name: 'Bordeaux soft' },
      { hex: '#2f1e1e', name: 'Cacao' },
    ],
  },
  {
    id: 'autumn-burgundy', name: 'Autumn burgundy', mood: 'Fall harvest',
    colors: [
      { hex: '#f4ecdc', name: 'Avena' },
      { hex: '#e0a87e', name: 'Pesca' },
      { hex: '#a14b3b', name: 'Terracotta' },
      { hex: '#6a1f2a', name: 'Bordeaux' },
      { hex: '#2c1117', name: 'Vinaccia' },
    ],
  },
  {
    id: 'winter-emerald', name: 'Winter emerald', mood: 'Cold glamour',
    colors: [
      { hex: '#f6f4ee', name: 'Perla' },
      { hex: '#cdd5c5', name: 'Eucalipto' },
      { hex: '#1f6b48', name: 'Smeraldo' },
      { hex: '#0a3a25', name: 'Bosco profondo' },
      { hex: '#0a0a0a', name: 'Nero' },
    ],
  },
  {
    id: 'modern-minimal', name: 'Modern minimal', mood: 'Editorial clean',
    colors: [
      { hex: '#ffffff', name: 'Bianco' },
      { hex: '#e9e7e0', name: 'Bianco caldo' },
      { hex: '#bdb7a8', name: 'Tortora' },
      { hex: '#3d3d3d', name: 'Grafite' },
      { hex: '#0a0a0a', name: 'Nero' },
    ],
  },
  {
    id: 'boho-terracotta', name: 'Boho terracotta', mood: 'Desert warm',
    colors: [
      { hex: '#f8f0e7', name: 'Sabbia chiara' },
      { hex: '#deba8c', name: 'Albicocca' },
      { hex: '#c98756', name: 'Argilla' },
      { hex: '#7e4a3c', name: 'Mattone' },
      { hex: '#3a261d', name: 'Caffè' },
    ],
  },
]

export function isValidHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(s.trim())
}

export function normalizeHex(s: string): string {
  const c = s.trim().toLowerCase()
  return c.startsWith('#') ? c : `#${c}`
}
