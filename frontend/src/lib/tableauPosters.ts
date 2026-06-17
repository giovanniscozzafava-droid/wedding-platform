// Pro forma del poster tableau mariage: 6 stili curati, di livello, cross-browser
// (Google Fonts: Cormorant Garamond, Playfair Display, Great Vibes, Jost).
const CORM = "'Cormorant Garamond', Georgia, serif"
const PLAY = "'Playfair Display', Georgia, serif"
const SCRIPT = "'Great Vibes', 'Snell Roundhand', cursive"
const SANS = "'Jost', 'Helvetica Neue', Arial, sans-serif"

export type DecorKey = 'sereno' | 'giardino' | 'deco' | 'cipria' | 'riviera' | 'terra'

export type PosterTemplate = {
  id: string
  name: string
  vibe: string
  decor: DecorKey
  dark?: boolean
  bg: string; ink: string; accent: string; soft: string
  nameColor: string; tableColor: string; guestColor: string
  nameFont: string; tableFont: string; bodyFont: string
  nameItalic?: boolean; tableItalic?: boolean
  nameUpper?: boolean; tableUpper?: boolean
  nameSize: number            // px @ larghezza 800
  tableRule?: boolean         // filetto sotto il nome tavolo
  eyebrow: string
  closing?: string
  dateUpper?: boolean
  dateItalic?: boolean
}

export const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    id: 'sereno', name: 'Sereno', vibe: 'Editoriale minimale, oro tenue', decor: 'sereno',
    bg: '#fcfbf7', ink: '#26241f', accent: '#a98c5b', soft: '#cdbd9b',
    nameColor: '#26241f', tableColor: '#26241f', guestColor: '#3f3a31',
    nameFont: CORM, tableFont: CORM, bodyFont: CORM, eyebrow: 'Tableau de mariage',
    nameSize: 72, tableRule: true, dateUpper: true,
  },
  {
    id: 'giardino', name: 'Giardino', vibe: 'Acquarello salvia, calligrafia', decor: 'giardino',
    bg: '#f7f8f3', ink: '#37402f', accent: '#7e9166', soft: '#aebd9a',
    nameColor: '#445236', tableColor: '#5f7049', guestColor: '#46503b',
    nameFont: SCRIPT, tableFont: SCRIPT, bodyFont: CORM, eyebrow: 'I nostri tavoli',
    nameSize: 70, dateItalic: true,
  },
  {
    id: 'deco', name: 'Déco', vibe: 'Smeraldo & oro, art déco', decor: 'deco', dark: true,
    bg: '#11352c', ink: '#eadfae', accent: '#c9a44c', soft: '#1c4a3d',
    nameColor: '#eadfae', tableColor: '#eadfae', guestColor: '#d8cfa8',
    nameFont: PLAY, tableFont: PLAY, bodyFont: SANS, eyebrow: 'Tableau de mariage',
    nameSize: 56, nameUpper: true, tableUpper: true, tableRule: true, dateUpper: true,
  },
  {
    id: 'cipria', name: 'Cipria', vibe: 'Rosa cipria, romantico fine-art', decor: 'cipria',
    bg: '#fbf3f0', ink: '#5a3f3c', accent: '#bd8475', soft: '#e3b6ab',
    nameColor: '#a4665a', tableColor: '#b07064', guestColor: '#6b4a45',
    nameFont: SCRIPT, tableFont: SCRIPT, bodyFont: CORM, eyebrow: 'Con affetto, i nostri tavoli',
    nameSize: 80,
  },
  {
    id: 'riviera', name: 'Riviera', vibe: 'Mediterraneo, agrumi, dolce vita', decor: 'riviera',
    bg: '#fcfaf0', ink: '#33513a', accent: '#c79a2e', soft: '#7f9e54',
    nameColor: '#2f4d36', tableColor: '#2f4d36', guestColor: '#3d5a43',
    nameFont: CORM, tableFont: CORM, bodyFont: CORM, eyebrow: 'Dolce vita · i nostri tavoli',
    nameSize: 64, nameItalic: true, tableItalic: true, dateUpper: true,
  },
  {
    id: 'terra', name: 'Terra', vibe: 'Terracotta, archi, boho moderno', decor: 'terra',
    bg: '#f1e9dd', ink: '#4b3a2c', accent: '#bd7b4f', soft: '#c98b5e',
    nameColor: '#433428', tableColor: '#9c5a32', guestColor: '#5c4836',
    nameFont: CORM, tableFont: CORM, bodyFont: CORM, eyebrow: 'Tableau',
    nameSize: 58, tableRule: true, dateUpper: true,
  },
]

// Formati di stampa (mm, ritratto). Fino a 70×100.
export const POSTER_FORMATS: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: 'A4 (21×29,7)' },
  A3: { w: 297, h: 420, label: 'A3 (29,7×42)' },
  '50x70': { w: 500, h: 700, label: '50×70 cm' },
  '70x100': { w: 700, h: 1000, label: '70×100 cm' },
}

export function templateForTheme(theme?: string | null): string {
  const t = (theme ?? '').toLowerCase()
  if (t.includes('boho') || t.includes('rustic') || t.includes('terracotta')) return 'terra'
  if (t.includes('botanical') || t.includes('garden') || t.includes('green')) return 'giardino'
  if (t.includes('coastal') || t.includes('mediterran') || t.includes('sicil') || t.includes('tropical') || t.includes('dolce')) return 'riviera'
  if (t.includes('gala') || t.includes('black-tie') || t.includes('night') || t.includes('luxe')) return 'deco'
  if (t.includes('vintage') || t.includes('blush') || t.includes('romantic')) return 'cipria'
  return 'sereno'
}

export function getTemplate(id: string): PosterTemplate {
  return POSTER_TEMPLATES.find((t) => t.id === id) ?? POSTER_TEMPLATES[0]!
}
