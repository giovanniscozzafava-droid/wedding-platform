// Lookup comuni italiani: nome → CAP, provincia (sigla), codice catastale.
// Dataset ISTAT (~540KB) servito statico da /data/comuni-it.json, lazy-loaded.

export type Comune = {
  /** Nome */
  n: string
  /** Sigla provincia (CS, MI, ...) */
  s: string
  /** Nome provincia */
  p: string
  /** CAP (più di uno per città grandi) */
  c: string[]
  /** Codice catastale (4 char) — usato anche nel codice fiscale */
  cc: string
}

let _all: Comune[] | null = null
let _byKey: Map<string, Comune> | null = null
let _loading: Promise<Comune[]> | null = null

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['`’]/g, "'")
    .trim()

export async function loadComuni(): Promise<Comune[]> {
  if (_all) return _all
  if (_loading) return _loading
  _loading = fetch('/data/comuni-it.json')
    .then((r) => {
      if (!r.ok) throw new Error('Impossibile caricare i comuni')
      return r.json()
    })
    .then((data: Comune[]) => {
      _all = data
      _byKey = new Map()
      for (const c of data) {
        const k = norm(c.n)
        if (!_byKey.has(k)) _byKey.set(k, c)
      }
      _loading = null
      return data
    })
  return _loading
}

/**
 * Cerca i comuni che iniziano con la query (case-insensitive, accent-insensitive).
 * Limita a 12 risultati per UX.
 */
export async function searchComuni(query: string, limit = 12): Promise<Comune[]> {
  const all = await loadComuni()
  const q = norm(query)
  if (q.length < 2) return []
  const startsWith: Comune[] = []
  const contains: Comune[] = []
  for (const c of all) {
    const n = norm(c.n)
    if (n.startsWith(q)) startsWith.push(c)
    else if (startsWith.length + contains.length < limit && n.includes(q)) contains.push(c)
    if (startsWith.length >= limit) break
  }
  return startsWith.concat(contains).slice(0, limit)
}

/** Match esatto sul nome (per validare in salvataggio). */
export async function findComune(nome: string): Promise<Comune | null> {
  await loadComuni()
  return _byKey?.get(norm(nome)) ?? null
}
