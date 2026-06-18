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
  // TAVOLA UNICA: se true (solo sulla pagina SINISTRA dello spread), l'intera tavola è una
  // sola superficie libera. `elements` sono in coordinate 0..1 dell'INTERA tavola (largh. 2×W,
  // alt. H); la riga centrale è solo la piega. La pagina destra dello spread viene assorbita.
  tavolaFree?: boolean
  frozen?: boolean             // libera "uscita": composizione bloccata (identica, non editabile a mano)
  bg?: string                  // colore di sfondo pagina
  elements?: FreeEl[]          // elementi liberi (in mode 'free')
  frames?: Frame[]             // frame espliciti per template === 'custom' (layout salvato)
  // Foto a PIENA TAVOLA: una singola immagine su ENTRAMBE le pagine della tavola, attraversa
  // il dorso. Vive sulla pagina SINISTRA. `frame` (0..1 dello spread) = trasformazione libera
  // stile Canva sulle due tavole; se assente = piena tavola (0,0,1,1).
  spreadImage?: { mediaId: string; cell: Cell; frame?: Frame } | null
}
export type AlbumLayout = { pages: AlbumPage[] }
export type MediaLite = { id: string; moment: string | null }

export const MAX_PER_PAGE = 12
export type TemplateKey =
  | '1'
  | '2h' | '2hL' | '2v' | '2vT'
  | '3l' | '3t' | '3r' | '3col' | '3v'
  | '4' | '4l' | '4r' | '4row' | '4col'
  | '5l' | '5t'
  | '6band'
  | 'grid' | 'custom'

const r3 = 1 / 3, r4 = 0.25
// Frame normalizzati per ogni template (il gutter lo applica il renderer). 'grid'/'custom' calcolati a parte.
export const TEMPLATES: Record<Exclude<TemplateKey, 'grid' | 'custom'>, Frame[]> = {
  '1':  [{ x: 0, y: 0, w: 1, h: 1 }],
  '2h': [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }],
  '2hL': [{ x: 0, y: 0, w: 0.62, h: 1 }, { x: 0.62, y: 0, w: 0.38, h: 1 }],
  '2v': [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }],
  '2vT': [{ x: 0, y: 0, w: 1, h: 0.62 }, { x: 0, y: 0.62, w: 1, h: 0.38 }],
  '3l': [{ x: 0, y: 0, w: 0.6, h: 1 }, { x: 0.6, y: 0, w: 0.4, h: 0.5 }, { x: 0.6, y: 0.5, w: 0.4, h: 0.5 }],
  '3t': [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: 0.5, h: 0.4 }, { x: 0.5, y: 0.6, w: 0.5, h: 0.4 }],
  '3r': [{ x: 0.4, y: 0, w: 0.6, h: 1 }, { x: 0, y: 0, w: 0.4, h: 0.5 }, { x: 0, y: 0.5, w: 0.4, h: 0.5 }],
  '3col': [{ x: 0, y: 0, w: r3, h: 1 }, { x: r3, y: 0, w: r3, h: 1 }, { x: 2 * r3, y: 0, w: r3, h: 1 }],
  '3v': [{ x: 0, y: 0, w: 1, h: r3 }, { x: 0, y: r3, w: 1, h: r3 }, { x: 0, y: 2 * r3, w: 1, h: r3 }],
  '4':  [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }],
  '4l': [{ x: 0, y: 0, w: 0.6, h: 1 }, { x: 0.6, y: 0, w: 0.4, h: r3 }, { x: 0.6, y: r3, w: 0.4, h: r3 }, { x: 0.6, y: 2 * r3, w: 0.4, h: r3 }],
  '4r': [{ x: 0.4, y: 0, w: 0.6, h: 1 }, { x: 0, y: 0, w: 0.4, h: r3 }, { x: 0, y: r3, w: 0.4, h: r3 }, { x: 0, y: 2 * r3, w: 0.4, h: r3 }],
  '4row': [{ x: 0, y: 0, w: r4, h: 1 }, { x: r4, y: 0, w: r4, h: 1 }, { x: 0.5, y: 0, w: r4, h: 1 }, { x: 0.75, y: 0, w: r4, h: 1 }],
  '4col': [{ x: 0, y: 0, w: 1, h: r4 }, { x: 0, y: r4, w: 1, h: r4 }, { x: 0, y: 0.5, w: 1, h: r4 }, { x: 0, y: 0.75, w: 1, h: r4 }],
  '5l': [{ x: 0, y: 0, w: 0.58, h: 1 }, { x: 0.58, y: 0, w: 0.21, h: 0.5 }, { x: 0.79, y: 0, w: 0.21, h: 0.5 }, { x: 0.58, y: 0.5, w: 0.21, h: 0.5 }, { x: 0.79, y: 0.5, w: 0.21, h: 0.5 }],
  '5t': [{ x: 0, y: 0, w: 1, h: 0.58 }, { x: 0, y: 0.58, w: r4, h: 0.42 }, { x: r4, y: 0.58, w: r4, h: 0.42 }, { x: 0.5, y: 0.58, w: r4, h: 0.42 }, { x: 0.75, y: 0.58, w: r4, h: 0.42 }],
  '6band': [{ x: 0, y: 0, w: 0.5, h: 0.55 }, { x: 0.5, y: 0, w: 0.5, h: 0.55 }, { x: 0, y: 0.55, w: r4, h: 0.45 }, { x: r4, y: 0.55, w: r4, h: 0.45 }, { x: 0.5, y: 0.55, w: r4, h: 0.45 }, { x: 0.75, y: 0.55, w: r4, h: 0.45 }],
}

export function capacity(t: TemplateKey): number {
  if (t === 'grid' || t === 'custom') return 0 // dipende dal numero di foto / dai frame salvati
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
  if (count === 2) return ['2h', '2hL', '2v', '2vT', 'grid']
  if (count === 3) return ['3l', '3t', '3r', '3col', '3v', 'grid']
  if (count === 4) return ['4', '4l', '4r', '4row', '4col', 'grid']
  if (count === 5) return ['5l', '5t', 'grid']
  if (count === 6) return ['grid', '6band']
  return ['grid']
}

// "Altro layout" (stile SmartAlbums): ciclo tra le disposizioni alternative.
export function cycleTemplate(current: TemplateKey, count: number): TemplateKey {
  const opts = templatesFor(count)
  const i = opts.indexOf(current)
  return opts[(i + 1) % opts.length]!
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
  const n = (p.mediaIds ?? []).length // robusto: dato persistito può non avere mediaIds
  if (p.template === 'custom') {
    const f = p.frames ?? []
    if (f.length >= n && n > 0) return f.slice(0, n)
    return f.length ? f : gridFrames(Math.max(1, n))
  }
  if (p.template === 'grid') return gridFrames(Math.max(1, n))
  const tpl = TEMPLATES[p.template as Exclude<TemplateKey, 'grid' | 'custom'>]
  if (tpl && tpl.length === n) return tpl
  if (n > 4) return gridFrames(n)
  // fallback: template coerente col conteggio attuale (dopo swap/aggiunte)
  const alt = chooseTemplate(Math.max(1, n), 1)
  if (alt === 'grid' || alt === 'custom') return gridFrames(Math.max(1, n))
  return TEMPLATES[alt].slice(0, Math.max(1, n))
}

export function newPage(moment: string | null = null): AlbumPage {
  return { id: uid(), moment, template: '1', mediaIds: [] }
}
