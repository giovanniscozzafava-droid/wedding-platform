import { CoverCanvas } from '../albumCoverCanvas'
import {
  coverDims, modelByKey, modelLayout, isWoodModel, materialsForModel, paletteFor,
  type Cover, type Model,
} from '../albumCatalog'

// Thumbnail UNIFORME per ogni modello del picker: render dello STESSO motore 2D
// (CoverCanvas) → niente più grab-bag di jpg incoerenti. Un solo painter 1280px
// condiviso e riusato in coda → ogni design renderizzato una volta, downscalato a
// dataURL piccolo e cachato. Così 60+ card costano una sola canvas grande, non 60.

const THUMB = 360 // lato lungo della thumbnail (px)
const cache = new Map<string, string>()
const subs = new Map<string, Set<(url: string) => void>>()
let painter: CoverCanvas | null = null
let down: HTMLCanvasElement | null = null
let queue: string[] = []
let busy = false

function thumbCover(m: Model): Cover {
  const lay = modelLayout(m.key)
  const fabric = isWoodModel(m.key) ? 'wood' : (materialsForModel(m.key)[0]?.key ?? 'alcantara')
  const col = paletteFor(fabric)[0]
  return {
    model: m.key, fabric, color: col?.hex ?? '#e8d8c4', colorKey: col?.key ?? '',
    format: m.format, sizeKey: '', box: 'nessuno',
    photo_url: lay.startsWith('photo') ? '/textures/demo/couple.jpg' : null,
    title: 'Anna & Marco', subtitle: '', monogram: 'AM',
    fontKey: 'fraunces', textLayout: 'model', decorationKey: 'none', borderKey: 'none',
  } as Cover
}

function snapshot(key: string) {
  if (!painter || !down) return
  const pw = painter.canvas.width, ph = painter.canvas.height
  if (!pw || !ph) return
  const s = THUMB / Math.max(pw, ph)
  down.width = Math.round(pw * s); down.height = Math.round(ph * s)
  const ctx = down.getContext('2d'); if (!ctx) return
  ctx.clearRect(0, 0, down.width, down.height)
  ctx.drawImage(painter.canvas, 0, 0, down.width, down.height)
  const url = down.toDataURL('image/jpeg', 0.82)
  cache.set(key, url)
  subs.get(key)?.forEach((cb) => cb(url))
}

function pump() {
  if (busy) return
  const key = queue.shift(); if (!key) return
  const m = modelByKey(key)
  if (!m) { pump(); return }
  busy = true
  if (!painter) { painter = new CoverCanvas(() => {}); down = document.createElement('canvas') }
  const cover = thumbCover(m)
  const d = coverDims(cover)
  painter.setAspect(d.w / d.h)
  painter.paint(cover)
  // attende il caricamento delle texture condivise (cachate dopo il primo modello), poi scatta
  window.setTimeout(() => { snapshot(key); busy = false; pump() }, 200)
}

// Richiede la thumbnail di un modello. Ritorna subito la dataURL se in cache,
// altrimenti null e chiama onReady(url) appena pronta.
export function requestModelThumb(key: string, onReady: (url: string) => void): string | null {
  const hit = cache.get(key)
  if (hit) return hit
  let s = subs.get(key); if (!s) { s = new Set(); subs.set(key, s) }
  s.add(onReady)
  if (!queue.includes(key)) queue.push(key)
  pump()
  return null
}

export function releaseModelThumb(key: string, onReady: (url: string) => void): void {
  subs.get(key)?.delete(onReady)
}
