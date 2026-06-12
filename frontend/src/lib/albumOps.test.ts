import { describe, it, expect } from 'vitest'
import { placeInPage, clearSlotInPage, setCell, setPageTemplate, movePages, insertPageAfter, removePage } from './albumOps'
import { newPage, MAX_PER_PAGE, type AlbumPage } from './albumEngine'
import { DEFAULT_CELL } from './albumGeometry'

const page = (id: string, ids: string[] = []): AlbumPage => ({ id, moment: null, template: 'grid', mediaIds: ids })

// POV CLIENTE: sceglie/sposta foto sulla bozza. POV FOTOGRAFO: corregge crop, layout, pagine.
describe('placeInPage — inserimento foto', () => {
  it('riempie il primo slot vuoto', () => {
    const p = placeInPage(page('a', ['', '']), null, 'x')
    expect(p.mediaIds[0]).toBe('x')
  })
  it('inserisce in uno slot specifico con crop neutro', () => {
    const p = placeInPage(page('a', ['x', 'y']), 1, 'z')
    expect(p.mediaIds[1]).toBe('z')
    expect(p.cells?.[1]).toEqual(DEFAULT_CELL)
  })
  it('aggiunge in coda fino al massimo, poi blocca (no crash, no duplicati infiniti)', () => {
    let p = page('a', [])
    for (let i = 0; i < MAX_PER_PAGE + 3; i++) p = placeInPage(p, null, `m${i}`)
    expect(p.mediaIds.length).toBe(MAX_PER_PAGE)
  })
})

describe('clearSlotInPage — togli foto', () => {
  it('rimuove la foto e la sua cella, riallineando gli indici', () => {
    const start: AlbumPage = { id: 'a', moment: null, template: 'grid', mediaIds: ['x', 'y', 'z'], cells: [DEFAULT_CELL, { z: 2, fx: 0.3, fy: 0.3 }, DEFAULT_CELL] }
    const p = clearSlotInPage(start, 1)
    expect(p.mediaIds).toEqual(['x', 'z'])
    expect(p.cells?.length).toBe(2)
  })
  it('slot fuori range = nessun cambiamento', () => {
    const p = page('a', ['x'])
    expect(clearSlotInPage(p, 5)).toBe(p)
  })
})

describe('setCell — crop/zoom/pan', () => {
  it('imposta lo zoom mantenendo la focale di default', () => {
    const p = setCell(page('a', ['x']), 0, { z: 2 })
    expect(p.cells?.[0]).toEqual({ z: 2, fx: 0.5, fy: 0.5 })
  })
  it('aggiorna solo la focale senza perdere lo zoom', () => {
    let p = setCell(page('a', ['x']), 0, { z: 3 })
    p = setCell(p, 0, { fx: 0.2 })
    expect(p.cells?.[0]).toEqual({ z: 3, fx: 0.2, fy: 0.5 })
  })
})

describe('riordino/aggiungi/togli pagine', () => {
  const pages = [page('a'), page('b'), page('c')]
  it('movePages sposta e clampa ai bordi', () => {
    expect(movePages(pages, 'a', 1).map((p) => p.id)).toEqual(['b', 'a', 'c'])
    expect(movePages(pages, 'a', -1)).toBe(pages) // già in testa
    expect(movePages(pages, 'c', 1)).toBe(pages)  // già in coda
  })
  it('insertPageAfter inserisce nella posizione giusta', () => {
    const out = insertPageAfter(pages, 'a', () => page('NEW'))
    expect(out.map((p) => p.id)).toEqual(['a', 'NEW', 'b', 'c'])
  })
  it('insertPageAfter con id null aggiunge in coda', () => {
    expect(insertPageAfter(pages, null, () => page('NEW')).map((p) => p.id)).toEqual(['a', 'b', 'c', 'NEW'])
  })
  it('removePage elimina la pagina', () => {
    expect(removePage(pages, 'b').map((p) => p.id)).toEqual(['a', 'c'])
  })
  it('setPageTemplate cambia layout', () => {
    expect(setPageTemplate(page('a', ['x', 'y']), '2h').template).toBe('2h')
  })
  it('newPage genera id univoci', () => {
    expect(newPage().id).not.toBe(newPage().id)
  })
})
