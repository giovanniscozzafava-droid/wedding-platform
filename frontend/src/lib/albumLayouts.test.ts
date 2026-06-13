import { describe, it, expect, beforeEach } from 'vitest'
import { pageToFrames, applyLayout, listLayouts, saveLayout, deleteLayout } from './albumLayouts'
import type { AlbumPage } from './albumEngine'

// localStorage in-memory deterministico (evita l'origine opaca di jsdom).
beforeEach(() => {
  const store = new Map<string, string>()
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true })
})

describe('pageToFrames', () => {
  it('pagina a template → frame del template', () => {
    const p: AlbumPage = { id: 'a', moment: null, template: '2h', mediaIds: ['1', '2'] }
    expect(pageToFrames(p)).toHaveLength(2)
  })
  it('pagina libera → bounding box degli elementi', () => {
    const p: AlbumPage = { id: 'a', moment: null, template: '1', mode: 'free', mediaIds: [],
      elements: [{ id: 'e1', mediaId: 'm', x: 0.1, y: 0.1, w: 0.3, h: 0.3, rot: 12, cell: { z: 1, fx: 0.5, fy: 0.5 } }] }
    const fr = pageToFrames(p)
    expect(fr).toEqual([{ x: 0.1, y: 0.1, w: 0.3, h: 0.3 }]) // la rotazione si perde (è uno "stampo")
  })
})

describe('applyLayout', () => {
  it('imposta template custom con i frame e modalità template', () => {
    const p: AlbumPage = { id: 'a', moment: null, template: '2h', mode: 'free', mediaIds: ['1'] }
    const frames = [{ x: 0, y: 0, w: 1, h: 1 }]
    const out = applyLayout(p, frames)
    expect(out.template).toBe('custom')
    expect(out.mode).toBe('template')
    expect(out.frames).toEqual(frames)
    expect(out.frames).not.toBe(frames) // copia difensiva
  })
})

describe('persistenza localStorage', () => {
  it('save → list → delete round-trip', () => {
    expect(listLayouts()).toEqual([])
    const frames = [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }]
    const after = saveLayout('Mio', frames)
    expect(after).toHaveLength(1)
    expect(after[0]!.n).toBe(2)
    expect(listLayouts()).toHaveLength(1)
    const id = after[0]!.id
    expect(deleteLayout(id)).toEqual([])
    expect(listLayouts()).toEqual([])
  })
  it('i nuovi layout vanno in testa', () => {
    saveLayout('A', [{ x: 0, y: 0, w: 1, h: 1 }])
    const list = saveLayout('B', [{ x: 0, y: 0, w: 1, h: 0.5 }])
    expect(list[0]!.name).toBe('B')
  })
})
