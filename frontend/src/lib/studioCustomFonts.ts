// Font importati dall'utente nello Studio immagine: persistono in IndexedDB (per browser/utente)
// e si registrano via FontFace così restano disponibili a chi li usa, anche dopo un refresh.
const DB = 'studioFonts'
const STORE = 'fonts'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'name' }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// nome famiglia pulito dal filename (senza estensione, caratteri sicuri)
export function fontNameFromFile(fileName: string): string {
  return fileName.replace(/\.(ttf|otf|woff2?|ttc)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Font importato'
}

async function registerFace(name: string, data: ArrayBuffer): Promise<void> {
  try {
    const face = new FontFace(name, data)
    await face.load()
    ;(document.fonts as FontFaceSet).add(face)
  } catch { /* font non valido: ignora */ }
}

// Salva (IndexedDB) + registra subito. Ritorna il nome famiglia usato.
export async function importCustomFont(file: File): Promise<string> {
  const name = fontNameFromFile(file.name)
  const buf = await file.arrayBuffer()
  await registerFace(name, buf.slice(0))
  try {
    const db = await openDB()
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ name, data: buf })
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
    })
    db.close()
  } catch { /* storage pieno o non disponibile: resta comunque in sessione */ }
  return name
}

// Carica e registra tutti i font salvati. Ritorna i nomi (per il picker).
export async function loadCustomFonts(): Promise<string[]> {
  try {
    const db = await openDB()
    const rows: { name: string; data: ArrayBuffer }[] = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly')
      const rq = tx.objectStore(STORE).getAll()
      rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error)
    })
    db.close()
    await Promise.all(rows.map((r) => registerFace(r.name, r.data.slice(0))))
    return rows.map((r) => r.name)
  } catch { return [] }
}

export async function deleteCustomFont(name: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(name); tx.oncomplete = () => res(); tx.onerror = () => res() })
    db.close()
  } catch { /* */ }
}
