import type { CoverBorderKey, CoverDecorationKey, CoverFontKey, CoverTextLayout } from './albumCatalog'

export type CoverFontDef = {
  key: CoverFontKey
  label: string
  hint: string
  css: string
  canvas: string
  weight: number
  italic?: boolean
  letterSpacing?: number
}

export const COVER_FONTS: CoverFontDef[] = [
  { key: 'fraunces', label: 'Editoriale', hint: 'serif morbido', css: '"Fraunces Variable", Georgia, serif', canvas: '"Fraunces Variable", Georgia, serif', weight: 600 },
  { key: 'baskerville', label: 'Classico', hint: 'fine art', css: 'Baskerville, Georgia, serif', canvas: 'Baskerville, Georgia, serif', weight: 500 },
  { key: 'bodoni', label: 'Bodoni', hint: 'moda', css: '"Bodoni 72", Didot, "Bodoni MT", serif', canvas: '"Bodoni 72", Didot, "Bodoni MT", serif', weight: 500 },
  { key: 'script', label: 'Calligrafico', hint: 'firma', css: '"Snell Roundhand", "Brush Script MT", cursive', canvas: '"Snell Roundhand", "Brush Script MT", cursive', weight: 500, italic: true },
  { key: 'modern', label: 'Moderno', hint: 'pulito', css: '"Inter Variable", Inter, system-ui, sans-serif', canvas: '"Inter Variable", Inter, system-ui, sans-serif', weight: 650 },
  { key: 'smallcaps', label: 'Maiuscoletto', hint: 'atelier', css: 'Optima, "Trajan Pro", "Times New Roman", serif', canvas: 'Optima, "Trajan Pro", "Times New Roman", serif', weight: 500, letterSpacing: 0.18 },
]

export const COVER_TEXT_LAYOUTS: { key: CoverTextLayout; label: string; hint: string }[] = [
  { key: 'model', label: 'Da modello', hint: 'come catalogo' },
  { key: 'center', label: 'Centrale', hint: 'monogramma + nomi' },
  { key: 'bottom', label: 'Basso', hint: 'nomi discreti' },
  { key: 'plate', label: 'Targhetta', hint: 'incisione' },
  { key: 'split', label: 'Separato', hint: 'sigla e nomi' },
]

export const COVER_DECORATIONS: { key: CoverDecorationKey; label: string; hint: string }[] = [
  { key: 'none', label: 'Nessuno', hint: 'pulito' },
  { key: 'divider', label: 'Divisore', hint: 'linea ornata' },
  { key: 'botanical', label: 'Ramo', hint: 'botanico' },
  { key: 'laurel', label: 'Alloro', hint: 'classico' },
  { key: 'flourish', label: 'Ghirigoro', hint: 'decorativo' },
  { key: 'hearts', label: 'Cuori', hint: 'romantico' },
  { key: 'sparkles', label: 'Scintille', hint: 'luminoso' },
  { key: 'wreath', label: 'Corona', hint: 'monogramma' },
]

export const COVER_BORDERS: { key: CoverBorderKey; label: string; hint: string }[] = [
  { key: 'none', label: 'Nessuna', hint: 'senza bordo' },
  { key: 'hairline', label: 'Filetto', hint: 'sottile' },
  { key: 'double', label: 'Doppia', hint: 'cornice' },
  { key: 'greca', label: 'Greca', hint: 'classica' },
  { key: 'floral-corners', label: 'Angoli', hint: 'floreale' },
  { key: 'art-deco', label: 'Deco', hint: 'geometrica' },
  { key: 'pearls', label: 'Perle', hint: 'punti luce' },
]

export const COVER_INK_SWATCHES = [
  { key: 'auto', label: 'Auto', text: undefined, accent: undefined },
  { key: 'oro', label: 'Oro', text: '#8a6423', accent: '#c69b42' },
  { key: 'ottone', label: 'Ottone', text: '#62441c', accent: '#b18435' },
  { key: 'avorio', label: 'Avorio', text: '#f5edda', accent: '#ead8b5' },
  { key: 'bruno', label: 'Bruno', text: '#4a3222', accent: '#7a5534' },
  { key: 'argento', label: 'Argento', text: '#e8ebee', accent: '#b8c0c8' },
]

export function coverFont(key?: CoverFontKey): CoverFontDef {
  return COVER_FONTS.find((f) => f.key === key) ?? COVER_FONTS[0]!
}
