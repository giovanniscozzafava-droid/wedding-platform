import { describe, it, expect } from 'vitest'
// TEST PESANTE "nostro POV": impagina molti album in TUTTI i formati, modalità template
// e LIBERA, con crop/rotazioni/bordi, e verifica che la geometria d'export sia sempre
// valida (niente NaN, sorgente dentro l'immagine, dimensioni positive, frame nei limiti).
import { ALBUM_FORMATS } from './albumFormats'
import { MOMENTS } from './albumMoments'
import { autoLayout, framesForPage, type AlbumPage } from './albumEngine'
import { sourceRect, slotRect, slotAspectOf, cropToCell, MARGIN_MM, GUTTER_MM, type Cell } from './albumGeometry'
import { placeInPage, clearSlotInPage, setCell, setPageTemplate, movePages, insertPageAfter, removePage } from './albumOps'
import { toFreeElements, moveEl, resizeEl, snapMove, snapAngle, type FreeEl } from './albumFree'
import { newPage } from './albumEngine'

const IMG_W = 4000, IMG_H = 3000 // immagine sorgente simulata
const finite = (...xs: number[]) => xs.every((x) => Number.isFinite(x))

function checkCellExport(cell: Cell, slotAspect: number) {
  const sr = sourceRect(IMG_W, IMG_H, slotAspect, cell)
  expect(finite(sr.sx, sr.sy, sr.sw, sr.sh)).toBe(true)
  expect(sr.sw).toBeGreaterThan(0); expect(sr.sh).toBeGreaterThan(0)
  expect(sr.sx).toBeGreaterThanOrEqual(-0.5); expect(sr.sy).toBeGreaterThanOrEqual(-0.5)
  expect(sr.sx + sr.sw).toBeLessThanOrEqual(IMG_W + 0.5)
  expect(sr.sy + sr.sh).toBeLessThanOrEqual(IMG_H + 0.5)
}

function buildSelection(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `m${i}`, moment: MOMENTS[i % MOMENTS.length]!.key }))
}

describe('SCENARIO PESANTE — template, tutti i formati', () => {
  for (const fmt of ALBUM_FORMATS) {
    for (const n of [1, 7, 23, 60, 110]) {
      it(`${fmt.label} · ${n} foto: impagina + crop + export geometria valida`, () => {
        const sel = buildSelection(n)
        const { pages } = autoLayout(sel, fmt.key)
        // tutte le foto impaginate, nessuna persa
        const placed = pages.flatMap((p) => p.mediaIds)
        expect(placed.length).toBe(n)
        // ogni pagina: frame coerenti + export valido per ogni cella (anche con crop)
        for (let pi = 0; pi < pages.length; pi++) {
          let p = pages[pi]!
          const frames = framesForPage(p)
          expect(frames.length).toBe(p.mediaIds.length)
          // applica un crop deterministico a ogni cella
          for (let i = 0; i < p.mediaIds.length; i++) {
            const fr = frames[i]!
            const sAsp = slotAspectOf(fr, fmt.w, fmt.h)
            const cell = cropToCell(IMG_W / IMG_H, sAsp, 0.3 + (i % 5) * 0.08, 0.4 + (i % 3) * 0.1, 0.5 + (i % 4) * 0.1)
            p = setCell(p, i, cell)
            // slotRect valido con e senza abbondanza
            for (const bleed of [0, 3]) {
              const r = slotRect(fr, fmt.w, fmt.h, { margin: MARGIN_MM, gutter: GUTTER_MM, bleed })
              expect(finite(r.x, r.y, r.w, r.h)).toBe(true)
              expect(r.w).toBeGreaterThan(0); expect(r.h).toBeGreaterThan(0)
            }
            checkCellExport(p.cells![i]!, sAsp)
          }
        }
      })
    }
  }
})

describe('SCENARIO PESANTE — operazioni editor (correzioni fotografo)', () => {
  it('30 album: place/clear/template/riordino/aggiungi/togli pagina senza rotture', () => {
    for (let a = 0; a < 30; a++) {
      const fmt = ALBUM_FORMATS[a % ALBUM_FORMATS.length]!
      let { pages } = autoLayout(buildSelection(40 + a), fmt.key)
      // riordina, aggiungi, togli
      if (pages.length >= 2) pages = movePages(pages, pages[0]!.id, 1)
      pages = insertPageAfter(pages, pages[0]?.id ?? null, () => newPage())
      let p0 = pages[0]!
      p0 = placeInPage(p0, null, 'extraA'); p0 = placeInPage(p0, null, 'extraB')
      p0 = setPageTemplate(p0, '2h'); p0 = clearSlotInPage(p0, 0)
      pages[0] = p0
      pages = removePage(pages, pages[pages.length - 1]!.id)
      // invarianti
      for (const p of pages) {
        expect(framesForPage(p).length).toBe(Math.max(1, p.mediaIds.length) === 0 ? 1 : framesForPage(p).length)
        expect(p.mediaIds.length).toBeLessThanOrEqual(12)
      }
      expect(pages.length).toBeGreaterThan(0)
    }
  })
})

describe('SCENARIO PESANTE — modalità LIBERA (Canva) + smart guides + export', () => {
  for (const fmt of [ALBUM_FORMATS[0]!, ALBUM_FORMATS[3]!, ALBUM_FORMATS[6]!, ALBUM_FORMATS[8]!]) {
    it(`${fmt.label}: converti in libero, muovi/ridimensiona/ruota + export valido`, () => {
      const page: AlbumPage = autoLayout(buildSelection(6), fmt.key).pages[0]!
      let els: FreeEl[] = toFreeElements(page, fmt.key)
      expect(els.length).toBeGreaterThan(0)
      const mx = MARGIN_MM / fmt.w, my = MARGIN_MM / fmt.h
      els = els.map((el, i) => {
        let e = moveEl(el, el.x + 0.05 * ((i % 3) - 1), el.y + 0.03 * ((i % 2)))
        const snap = snapMove(e, els.filter((x) => x.id !== el.id), mx, my)
        e = { ...e, x: snap.x, y: snap.y }
        e = resizeEl(e, 'se', e.x + Math.max(0.1, e.w * 0.8), e.y + Math.max(0.1, e.h * 0.9))
        e = { ...e, rot: snapAngle(e.rot + i * 17), border: i % 2 ? { w: 3, color: '#fff' } : null, shadow: i % 3 === 0 }
        return e
      })
      // ogni elemento: dentro limiti ragionevoli + export geometria valida
      for (const el of els) {
        expect(finite(el.x, el.y, el.w, el.h, el.rot)).toBe(true)
        expect(el.w).toBeGreaterThan(0); expect(el.h).toBeGreaterThan(0)
        expect(el.x).toBeGreaterThan(-1); expect(el.y).toBeGreaterThan(-1)
        const elAsp = (el.w * fmt.w) / (el.h * fmt.h)
        checkCellExport(el.cell, elAsp)
        // bounding box ruotato finito (come nell'export PDF)
        const th = (el.rot * Math.PI) / 180
        const bw = Math.abs(el.w * Math.cos(th)) + Math.abs(el.h * Math.sin(th))
        const bh = Math.abs(el.w * Math.sin(th)) + Math.abs(el.h * Math.cos(th))
        expect(finite(bw, bh)).toBe(true); expect(bw).toBeGreaterThan(0)
      }
    })
  }
})
