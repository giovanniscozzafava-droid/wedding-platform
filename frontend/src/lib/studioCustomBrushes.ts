// Pennelli IMPORTATI dall'utente nello Studio: una "punta" (PNG con trasparenza) che viene stampata
// fitta lungo il tratto per formare un pennello texturizzato. Persistono in IndexedDB (per browser).
// tint=true → la punta viene colorata col colore selezionato (usa solo l'alpha come forma);
// tint=false → mantiene i colori originali (utile per timbri decorativi già colorati).
export type CustomBrush = { id: string; name: string; tint: boolean }

const DB = 'studioBrushes'
const STORE = 'brushes'
const tips = new Map<string, HTMLCanvasElement>()      // id → canvas della punta (base)
const meta = new Map<string, CustomBrush>()            // id → {name, tint}
const tinted = new Map<string, HTMLCanvasElement>()     // `${id}|${color}` → punta colorata

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
const nameFromFile = (f: string) => f.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Pennello'

function decodeToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const max = 512, s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s))
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); res(c)
    }
    img.onerror = rej; img.src = dataUrl
  })
}

export function listCustomBrushes(): CustomBrush[] { return [...meta.values()] }

export async function loadCustomBrushes(): Promise<CustomBrush[]> {
  try {
    const db = await openDB()
    const rows: { id: string; name: string; tint: boolean; dataUrl: string }[] = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).getAll()
      rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error)
    })
    db.close()
    for (const r of rows) { try { tips.set(r.id, await decodeToCanvas(r.dataUrl)); meta.set(r.id, { id: r.id, name: r.name, tint: r.tint }) } catch { /* punta corrotta */ } }
    return listCustomBrushes()
  } catch { return [] }
}

export async function importCustomBrush(file: File, tint: boolean): Promise<CustomBrush> {
  const dataUrl: string = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(file) })
  const id = `cb-${Date.now()}-${Math.floor(performance.now() % 9999)}`
  const name = nameFromFile(file.name)
  tips.set(id, await decodeToCanvas(dataUrl)); meta.set(id, { id, name, tint })
  try {
    const db = await openDB()
    await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put({ id, name, tint, dataUrl }); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
    db.close()
  } catch { /* storage pieno: resta in sessione */ }
  return { id, name, tint }
}

export async function deleteCustomBrush(id: string): Promise<void> {
  tips.delete(id); meta.delete(id); for (const k of [...tinted.keys()]) if (k.startsWith(id + '|')) tinted.delete(k)
  try { const db = await openDB(); await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = () => res(); tx.onerror = () => res() }); db.close() } catch { /* */ }
}

// Disegna la punta (id) centrata in (x,y), grande 2R, col colore/alpha dati (tinta se richiesto dalla punta).
export function drawCustomBrush(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, R: number, color: string, alpha: number) {
  const tip = tips.get(id); if (!tip) return
  const m = meta.get(id)
  let src: HTMLCanvasElement = tip
  if (m?.tint) {
    const key = `${id}|${color}`; let t = tinted.get(key)
    if (!t) { t = document.createElement('canvas'); t.width = tip.width; t.height = tip.height; const c = t.getContext('2d')!; c.drawImage(tip, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, t.width, t.height); tinted.set(key, t) }
    src = t
  }
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.drawImage(src, x - R, y - R, R * 2, R * 2); ctx.restore()
}
export function isCustomBrushLoaded(id: string): boolean { return tips.has(id) }
