// Motore di auto-impaginazione tag-driven. Raggruppa i media per "momento" (in
// ordine), poi spezza ogni gruppo in pagine usando template per N foto. Il
// fotografo/sposi possono poi cambiare template, scambiare foto, aggiungere/togliere pagine.
import { pageAspect } from './albumFormats'
import { momentOrder } from './albumMoments'

export type Frame = { x: number; y: number; w: number; h: number } // normalizzati 0..1
export type AlbumPage = { id: string; moment: string | null; template: TemplateKey; mediaIds: string[] }
export type AlbumLayout = { pages: AlbumPage[] }
export type MediaLite = { id: string; moment: string | null }

export type TemplateKey = '1' | '2h' | '2v' | '3l' | '3t' | '4'

// Frame normalizzati per ogni template (il gutter lo applica il renderer).
export const TEMPLATES: Record<TemplateKey, Frame[]> = {
  '1':  [{ x: 0, y: 0, w: 1, h: 1 }],
  '2h': [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }],
  '2v': [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }],
  '3l': [{ x: 0, y: 0, w: 0.6, h: 1 }, { x: 0.6, y: 0, w: 0.4, h: 0.5 }, { x: 0.6, y: 0.5, w: 0.4, h: 0.5 }],
  '3t': [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: 0.5, h: 0.4 }, { x: 0.5, y: 0.6, w: 0.5, h: 0.4 }],
  '4':  [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }],
}

export function capacity(t: TemplateKey): number {
  return TEMPLATES[t].length
}

export function chooseTemplate(count: number, aspect: number): TemplateKey {
  if (count <= 1) return '1'
  if (count === 2) return aspect > 1.1 ? '2h' : '2v'
  if (count === 3) return aspect > 1.1 ? '3l' : '3t'
  return '4'
}

// Template alternativi disponibili per un dato numero di foto (per il selettore nell'editor).
export function templatesFor(count: number): TemplateKey[] {
  if (count <= 1) return ['1']
  if (count === 2) return ['2h', '2v']
  if (count === 3) return ['3l', '3t']
  return ['4']
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
  const tpl = TEMPLATES[p.template]
  if (tpl && tpl.length === p.mediaIds.length) return tpl
  // fallback: ricava un template coerente col conteggio attuale (dopo swap/aggiunte)
  const alt = chooseTemplate(p.mediaIds.length, 1)
  return TEMPLATES[alt].slice(0, Math.max(1, p.mediaIds.length))
}

export function newPage(moment: string | null = null): AlbumPage {
  return { id: uid(), moment, template: '1', mediaIds: [] }
}
