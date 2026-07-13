import type { Tool } from './types'

export const PAINT = new Set<Tool>(['brush', 'pencil', 'ink', 'marker', 'watercolor', 'chalk', 'pastel', 'floral', 'airbrush', 'smudge', 'eraser', 'stamp'])
export const LINE_TOOLS = new Set<Tool>(['brush', 'pencil', 'ink', 'marker', 'eraser'])
export const MAXDIM = 2400
export const PRESETS: Array<{ key: string; label: string; w: number; h: number }> = [
  { key: 'invito-a6', label: 'Invito A6 (10,5×14,8)', w: 1063, h: 1500 },
  { key: 'invito-quad', label: 'Invito quadrato 15×15', w: 1500, h: 1500 },
  { key: 'menu-a5', label: 'Menu A5 (14,8×21)', w: 1480, h: 2100 },
  { key: 'segnaposto', label: 'Segnaposto (9×5,5)', w: 1080, h: 660 },
  { key: 'tableau', label: 'Tableau 50×70', w: 1800, h: 2520 },
  { key: 'stationery-a4', label: 'Stationery A4', w: 1654, h: 2339 },
  { key: 'social', label: 'Social 1080×1080', w: 1080, h: 1080 },
]
export const BLENDS: Array<{ v: GlobalCompositeOperation; l: string }> = [
  { v: 'source-over', l: 'Normale' }, { v: 'multiply', l: 'Moltiplica' }, { v: 'screen', l: 'Scherma' },
  { v: 'overlay', l: 'Sovrapponi' }, { v: 'darken', l: 'Scurisci' }, { v: 'lighten', l: 'Schiarisci' },
  { v: 'color-dodge', l: 'Scherma colori' }, { v: 'color-burn', l: 'Brucia colori' },
  { v: 'hard-light', l: 'Luce intensa' }, { v: 'soft-light', l: 'Luce soffusa' },
  { v: 'difference', l: 'Differenza' }, { v: 'exclusion', l: 'Esclusione' },
  { v: 'hue', l: 'Tonalità' }, { v: 'saturation', l: 'Saturazione' }, { v: 'color', l: 'Colore' }, { v: 'luminosity', l: 'Luminosità' },
]
export const SWATCHES = ['#1a1a1a', '#ffffff', '#c8a24b', '#b08d3c', '#8a6d3b', '#c65d5d', '#d98c5f', '#6b8e6b', '#5f7d95', '#3a4a6b', '#7a5c8e', '#d9b8c4']
