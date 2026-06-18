// Layout personalizzati salvati dall'utente: si prende la disposizione corrente di
// una pagina (i frame) e la si ripropone come "stampo" applicabile ad altre pagine.
// Persistenza locale (per-browser) in localStorage: niente backend, zero attriti.
import { framesForPage, type AlbumPage, type Frame } from './albumEngine'

export type FreeSlot = { x: number; y: number; w: number; h: number; rot: number }
// `els` (facoltativo) = composizione LIBERA completa (con rotazione): se presente, il
// preset si riapplica come modalità libera fedele, non come griglia.
export type SavedLayout = { id: string; name: string; n: number; frames: Frame[]; els?: FreeSlot[] }
const KEY = 'planfully:album:layouts'

function uid(): string {
  try { return crypto.randomUUID() } catch { return `l-${Date.now()}-${Math.floor(Math.random() * 1e9)}` }
}

// Frame normalizzati della disposizione attuale della pagina (per salvarla).
export function pageToFrames(page: AlbumPage): Frame[] {
  if (page.mode === 'free') {
    // dagli elementi liberi: bounding box di ciascuno (la rotazione si perde, è uno "stampo")
    return (page.elements ?? []).map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }))
  }
  return framesForPage(page).map((f) => ({ ...f }))
}

// Composizione libera completa (con rotazione) di una pagina libera → per i preset.
export function pageToFreeEls(page: AlbumPage): FreeSlot[] {
  if (page.mode !== 'free') return []
  return (page.elements ?? []).map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h, rot: e.rot }))
}

// Applica un layout salvato a una pagina (modalità template con frame espliciti).
export function applyLayout(page: AlbumPage, frames: Frame[]): AlbumPage {
  return { ...page, mode: 'template', template: 'custom', frames: frames.map((f) => ({ ...f })) }
}

export function listLayouts(): SavedLayout[] {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return []
    const arr = JSON.parse(raw) as SavedLayout[]
    return Array.isArray(arr) ? arr.filter((l) => l && Array.isArray(l.frames) && l.frames.length) : []
  } catch { return [] }
}

export function saveLayout(name: string, frames: Frame[], els?: FreeSlot[]): SavedLayout[] {
  const item: SavedLayout = { id: uid(), name: name.trim() || `Layout ${frames.length} foto`, n: frames.length, frames: frames.map((f) => ({ ...f })), ...(els && els.length ? { els: els.map((s) => ({ ...s })) } : {}) }
  const next = [item, ...listLayouts()].slice(0, 60)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* quota */ }
  return next
}

export function deleteLayout(id: string): SavedLayout[] {
  const next = listLayouts().filter((l) => l.id !== id)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* quota */ }
  return next
}
