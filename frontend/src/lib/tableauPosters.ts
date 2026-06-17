// Pro forma (template) per il poster del tableau mariage: palette + carattere + decoro.
// Pensati per essere "belli da esporre", stile acquarello / sketch. Il cliente sceglie.
export type Palette = { bg: string; ink: string; accent: string; soft: string; card: string; cardLine: string }
export type DecorKey = 'eucalyptus' | 'blush' | 'gold' | 'boho' | 'night' | 'lemon'

export type PosterTemplate = {
  id: string
  name: string
  vibe: string
  decor: DecorKey
  palette: Palette
  titleFont: string
  bodyFont: string
  titleUpper?: boolean
  titleItalic?: boolean
}

const SERIF = "Georgia, 'Times New Roman', 'Cormorant Garamond', serif"
const SANS = "'Helvetica Neue', Arial, sans-serif"

export const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    id: 'botanico', name: 'Botanico acquarello', vibe: 'Eucalipto, verde salvia, classico',
    decor: 'eucalyptus', titleFont: SERIF, bodyFont: SERIF, titleItalic: true,
    palette: { bg: '#faf6ef', ink: '#3f3a34', accent: '#7c8c6f', soft: '#a8b5a2', card: '#ffffff', cardLine: '#e3ddcd' },
  },
  {
    id: 'blush', name: 'Blush romantico', vibe: 'Rosa cipria, acquarello morbido',
    decor: 'blush', titleFont: SERIF, bodyFont: SERIF, titleItalic: true,
    palette: { bg: '#fff7f4', ink: '#5a3a3a', accent: '#c98b7a', soft: '#e7c3b8', card: '#fffdfc', cardLine: '#f0d9d1' },
  },
  {
    id: 'oro', name: 'Oro minimal', vibe: 'Avorio, oro, essenziale ed elegante',
    decor: 'gold', titleFont: SANS, bodyFont: SERIF, titleUpper: true,
    palette: { bg: '#ffffff', ink: '#2a2a2a', accent: '#b8923f', soft: '#dcc187', card: '#ffffff', cardLine: '#e8dcc0' },
  },
  {
    id: 'boho', name: 'Boho terracotta', vibe: 'Terracotta, pampas, archi',
    decor: 'boho', titleFont: SERIF, bodyFont: SANS, titleUpper: true,
    palette: { bg: '#f3ede4', ink: '#4a3f34', accent: '#c0764f', soft: '#dcae8a', card: '#fbf7f1', cardLine: '#e4d6c4' },
  },
  {
    id: 'notte', name: 'Blu notte & oro', vibe: 'Cielo notturno, stelle, lusso',
    decor: 'night', titleFont: SERIF, bodyFont: SERIF, titleItalic: true,
    palette: { bg: '#1e2a44', ink: '#f4f1e8', accent: '#d8b25a', soft: '#3a4a6b', card: '#243154', cardLine: '#3a4a6b' },
  },
  {
    id: 'agrumi', name: 'Dolce vita agrumi', vibe: 'Mediterraneo, limoni, sole',
    decor: 'lemon', titleFont: SERIF, bodyFont: SANS, titleItalic: true,
    palette: { bg: '#fdfbf2', ink: '#2f5d3a', accent: '#e8b94a', soft: '#9bbf6f', card: '#ffffff', cardLine: '#e6e0c8' },
  },
]

// Formati di stampa (mm, ritratto). Il poster si esporta fino a 70×100.
export const POSTER_FORMATS: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: 'A4 (21×29,7)' },
  A3: { w: 297, h: 420, label: 'A3 (29,7×42)' },
  '50x70': { w: 500, h: 700, label: '50×70 cm' },
  '70x100': { w: 700, h: 1000, label: '70×100 cm' },
}

// Suggerisce un template dal tema evento (se impostato).
export function templateForTheme(theme?: string | null): string {
  const t = (theme ?? '').toLowerCase()
  if (t.includes('boho') || t.includes('rustic') || t.includes('terracotta')) return 'boho'
  if (t.includes('botanical') || t.includes('garden') || t.includes('green')) return 'botanico'
  if (t.includes('coastal') || t.includes('mediterran') || t.includes('sicil') || t.includes('tropical') || t.includes('dolce')) return 'agrumi'
  if (t.includes('gala') || t.includes('black-tie') || t.includes('night')) return 'notte'
  if (t.includes('classic') || t.includes('elegance') || t.includes('minimal') || t.includes('scandi')) return 'oro'
  if (t.includes('vintage')) return 'blush'
  return 'botanico'
}

export function getTemplate(id: string): PosterTemplate {
  return POSTER_TEMPLATES.find((t) => t.id === id) ?? POSTER_TEMPLATES[0]!
}
