// Funzioni PURE per i printable dell'evento (segnaposto, cavalieri tavolo, menu). Testate a fondo:
// nessun nome deve perdersi, l'ordine è prevedibile, la paginazione è esatta.

export type PGuest = { id: string; full_name: string; table_id: string | null; rsvp?: string | null; age_group?: string | null; party_size?: number | null }
export type PTable = { id: string; table_no: number; label: string | null; seats?: number | null }

export const tableName = (t: PTable): string => (t.label && t.label.trim()) || `Tavolo ${t.table_no}`

/** Invitati che "ci sono": nome valorizzato, RSVP non NO, niente infant. Ordinati per nome (it). */
export function attendingGuests(guests: PGuest[]): PGuest[] {
  return guests
    .filter((g) => !!g.full_name && g.full_name.trim().length > 0 && (g.rsvp ?? 'PENDING') !== 'NO' && g.age_group !== 'INFANT')
    .slice()
    .sort((a, b) => a.full_name.trim().localeCompare(b.full_name.trim(), 'it', { sensitivity: 'base' }))
}

/** Raggruppa gli invitati presenti per tavolo (in ordine di table_no); i non assegnati vanno in coda. */
export function guestsByTable(guests: PGuest[], tables: PTable[]): Array<{ table: PTable | null; guests: PGuest[] }> {
  const att = attendingGuests(guests)
  const groups = new Map<string, PGuest[]>()
  for (const g of att) {
    const k = g.table_id ?? '∅'
    const arr = groups.get(k) ?? (groups.set(k, []), groups.get(k)!)
    arr.push(g)
  }
  const ordered = [...tables].sort((a, b) => a.table_no - b.table_no)
  const out: Array<{ table: PTable | null; guests: PGuest[] }> = []
  for (const t of ordered) if (groups.has(t.id)) out.push({ table: t, guests: groups.get(t.id)! })
  if (groups.has('∅')) out.push({ table: null, guests: groups.get('∅')! })
  return out
}

/** Spezza un array in pagine da n elementi (n>=1). Nessun elemento perso. */
export function chunk<T>(arr: T[], n: number): T[][] {
  const size = Math.max(1, Math.floor(n))
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Etichetta tavolo per un singolo invitato (per i segnaposto). */
export function guestTableLabel(g: PGuest, tables: PTable[]): string {
  if (!g.table_id) return ''
  const t = tables.find((x) => x.id === g.table_id)
  return t ? tableName(t) : ''
}
