// Motore di auto-impaginazione tag-driven. Raggruppa i media per "momento" (in
// ordine), poi spezza ogni gruppo in pagine usando template per N foto. Il
// fotografo/sposi possono poi cambiare template, scambiare foto, aggiungere/togliere pagine.
import { pageAspect } from './albumFormats'
import { momentOrder } from './albumMoments'
import type { Cell } from './albumGeometry'
import type { FreeEl } from './albumFree'

export type Frame = { x: number; y: number; w: number; h: number } // normalizzati 0..1
export type AlbumPage = {
  id: string; moment: string | null; template: TemplateKey; mediaIds: string[]; cells?: (Cell | null)[]
  mode?: 'template' | 'free'   // 'free' = elementi liberi stile Canva
  bg?: string                  // colore di sfondo pagina
  elements?: FreeEl[]          // elementi liberi (in mode 'free')
}
export type AlbumLayout = { pages: AlbumPage[] }
export type MediaLite = { id: string; moment: string | null }

export const MAX_PER_PAGE = 12
export type TemplateKey = '1' | '2h' | '2v' | '3l' | '3t' | '4' | 'grid'

// Frame normalizzati per ogni template (il gutter lo applica il renderer).
export const TEMPLATES: Record<Exclude<TemplateKey, 'grid'>, Frame[]> = {
  '1':  [{ x: 0, y: 0, w: 1, h: 1 }],
  '2h': [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }],
  '2v': [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }],
  '3l': [{ x: 0, y: 0, w: 0.6, h: 1 }, { x: 0.6, y: 0, w: 0.4, h: 0.5 }, { x: 0.6, y: 0.5, w: 0.4, h: 0.5 }],
  '3t': [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: 0.5, h: 0.4 }, { x: 0.5, y: 0.6, w: 0.5, h: 0.4 }],
  '4':  [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }],
}

export function capacity(t: TemplateKey): number {
  if (t === 'grid') return 0 // dipende dal numero di foto
  return TEMPLATES[t].length
}

export function chooseTemplate(count: number, aspect: number): TemplateKey {
  if (count <= 1) return '1'
  if (count === 2) return aspect > 1.1 ? '2h' : '2v'
  if (count === 3) return aspect > 1.1 ? '3l' : '3t'
  if (count === 4) return '4'
  return 'grid'
}

// Template alternativi disponibili per un dato numero di foto (per il selettore nell'editor).
export function templatesFor(count: number): TemplateKey[] {
  if (count <= 1) return ['1']
  if (count === 2) return ['2h', '2v', 'grid']
  if (count === 3) return ['3l', '3t', 'grid']
  if (count === 4) return ['4', 'grid']
  return ['grid']
}

// Griglia bilanciata per N foto (ultima riga distesa a riempire la larghezza).
export function gridFrames(n: number): Frame[] {
  if (n <= 0) return []
  const cols = Math.ceil(Math.sqrt(n)); const rows = Math.ceil(n / cols)
  const out: Frame[] = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols)
    const rowCount = r === rows - 1 ? n - cols * (rows - 1) : cols
    const c = i - r * cols
    out.push({ x: c / rowCount, y: r / rows, w: 1 / rowCount, h: 1 / rows })
  }
  return out
}

function uid(): string {
  try { return crypto.randomUUID() } catch { return `p-${Date.now()}-${Math.floor(Math.random() * 1e9)}` }
}

// Auto-impagina: ogni momento inizia su una nuova pagina; ritmo variabile di foto/pagina.
export function autoLayout(selected: MediaLite[], formatKey: string): AlbumLayout {
  const aspect = pageAspect(formatKey)
  // raggruppa per momento, in ordine
  const groups = new Map<string, string[]>()
  const order: string[] = []
  const sorted = [...selected].sort((a, b) => momentOrder(a.moment) - momentOrder(b.moment))
  for (const m of sorted) {
    const key = m.moment ?? '_senza'
    if (!groups.has(key)) { groups.set(key, []); order.push(key) }
    groups.get(key)!.push(m.id)
  }

  const pages: AlbumPage[] = []
  const rhythm = [1, 3, 2, 4, 2, 3] // varia il numero di foto per pagina
  for (const key of order) {
    const ids = groups.get(key)!
    let i = 0, r = 0
    while (i < ids.length) {
      const target = rhythm[r % rhythm.length]!
      const chunk = ids.slice(i, i + target)
      i += chunk.length; r++
      pages.push({ id: uid(), moment: key === '_senza' ? null : key, template: chooseTemplate(chunk.length, aspect), mediaIds: chunk })
    }
  }
  return { pages }
}

// Frame per una pagina, ricalcolati se il numero di foto non combacia col template.
export function framesForPage(p: AlbumPage): Frame[] {
  const n = p.mediaIds.length
  if (p.template === 'grid') return gridFrames(Math.max(1, n))
  const tpl = TEMPLATES[p.template as Exclude<TemplateKey, 'grid'>]
  if (tpl && tpl.length === n) return tpl
  if (n > 4) return gridFrames(n)
  // fallback: template coerente col conteggio attuale (dopo swap/aggiunte)
  const alt = chooseTemplate(Math.max(1, n), 1)
  if (alt === 'grid') return gridFrames(Math.max(1, n))
  return TEMPLATES[alt].slice(0, Math.max(1, n))
}

export function newPage(moment: string | null = null): AlbumPage {
  return { id: uid(), moment, template: '1', mediaIds: [] }
}
