// Operazioni PURE sull'impaginazione (place/clear/crop/template/riordino/aggiungi/togli pagina).
// Usate dall'editor e testate: sono il punto dove il cliente "interviene" e il fotografo "corregge".
import { framesForPage, MAX_PER_PAGE, type AlbumPage, type TemplateKey } from './albumEngine'
import { DEFAULT_CELL, type Cell } from './albumGeometry'

export function placeInPage(p: AlbumPage, slot: number | null, mediaId: string): AlbumPage {
  const ids = [...(p.mediaIds ?? [])]; const cells = [...(p.cells ?? [])]
  const cap = framesForPage(p).length
  if (slot != null && slot >= 0 && slot < Math.max(cap, ids.length) && slot < MAX_PER_PAGE) {
    ids[slot] = mediaId; cells[slot] = { ...DEFAULT_CELL }
  } else {
    const empty = ids.findIndex((x) => !x)
    if (empty >= 0) { ids[empty] = mediaId; cells[empty] = { ...DEFAULT_CELL } }
    else if (ids.length < MAX_PER_PAGE) { ids.push(mediaId); cells[ids.length - 1] = { ...DEFAULT_CELL } }
    else return p // pagina piena
  }
  return { ...p, mediaIds: ids, cells }
}

export function clearSlotInPage(p: AlbumPage, slot: number): AlbumPage {
  if (slot < 0 || slot >= (p.mediaIds ?? []).length) return p
  const ids = [...(p.mediaIds ?? [])]; const cells = [...(p.cells ?? [])]
  ids.splice(slot, 1); cells.splice(slot, 1)
  return { ...p, mediaIds: ids, cells }
}

export function setCell(p: AlbumPage, slot: number, partial: Partial<Cell>): AlbumPage {
  const cells = [...(p.cells ?? [])]
  cells[slot] = { ...DEFAULT_CELL, ...(cells[slot] ?? {}), ...partial }
  return { ...p, cells }
}

export function setPageTemplate(p: AlbumPage, t: TemplateKey): AlbumPage {
  return { ...p, template: t }
}

export function movePages(pages: AlbumPage[], id: string, dir: -1 | 1): AlbumPage[] {
  const i = pages.findIndex((p) => p.id === id); const j = i + dir
  if (i < 0 || j < 0 || j >= pages.length) return pages
  const c = [...pages]; const t = c[i]!; c[i] = c[j]!; c[j] = t; return c
}

export function insertPageAfter(pages: AlbumPage[], id: string | null, mk: () => AlbumPage): AlbumPage[] {
  const np = mk()
  if (!id) return [...pages, np]
  const i = pages.findIndex((p) => p.id === id)
  if (i < 0) return [...pages, np]
  const c = [...pages]; c.splice(i + 1, 0, np); return c
}

export function removePage(pages: AlbumPage[], id: string): AlbumPage[] {
  return pages.filter((p) => p.id !== id)
}
