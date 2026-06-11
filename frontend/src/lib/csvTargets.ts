import { supabase } from '@/lib/supabase'
import { normalizeHeader, type CsvRow } from '@/lib/csv'

// Importatore CSV universale: legge qualsiasi CSV, capisce di che tipo è
// (auto-detect dai nomi colonna) e mette ogni cosa al posto giusto.
// Ogni "target" sa: alias colonne → campi, come trasformare una riga, e come
// scrivere (rispettando la RLS e risolvendo i riferimenti, es. categorie).

export type ImportResult = { imported: number; skipped: number; errors: string[] }
export type ImportCtx = { userId: string; entryId?: string }

export type ImportTarget = {
  key: string
  label: string
  noun: string
  needsEntry?: boolean
  required: string                              // campo obbligatorio
  aliases: Record<string, string>              // header normalizzato → campo
  preview: { key: string; label: string }[]
  sample: string
  transform: (row: CsvRow, map: Map<string, string>) => Record<string, unknown> | null
  run: (records: Record<string, unknown>[], ctx: ImportCtx) => Promise<ImportResult>
}

// ── utility ────────────────────────────────────────────────────────────────
function num(v: unknown): number | null {
  if (v == null) return null
  let s = String(v).trim().replace(/[€$\s]/g, '')
  if (!s) return null
  // "1.234,56" (IT) → 1234.56 ; "1,234.56" (EN) → 1234.56 ; "1234,56" → 1234.56
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}
function genericMap(row: CsvRow, map: Map<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [h, v] of Object.entries(row)) {
    const f = map.get(normalizeHeader(h))
    if (f && String(v).trim() !== '') out[f] = String(v).trim()
  }
  return out
}
function normUnit(v: unknown): string {
  const x = String(v ?? '').trim().toLowerCase()
  if (['persona', 'persone', 'pax', 'ospite', 'invitato', 'coperto'].some((k) => x.includes(k))) return 'PERSONA'
  if (['ora', 'ore', 'h', 'hour'].some((k) => x === k || x.startsWith(k))) return 'ORA'
  if (['evento', 'event', 'forfait', 'pacchetto', 'servizio'].some((k) => x.includes(k))) return 'EVENTO'
  return 'PEZZO'
}
async function chunkInsert(table: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
  let imported = 0; const errors: string[] = []
  const CHUNK = 200
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error, count } = await (supabase.from(table as never) as never as {
      insert: (v: unknown, o: unknown) => Promise<{ error: { message: string } | null; count: number | null }>
    }).insert(rows.slice(i, i + CHUNK), { count: 'exact' })
    if (error) errors.push(error.message); else imported += count ?? rows.slice(i, i + CHUNK).length
  }
  return { imported, skipped: 0, errors }
}

// ── TARGET: prodotti / servizi (catalogo) ──────────────────────────────────
const SERVICES: ImportTarget = {
  key: 'services', label: 'Prodotti / Servizi (catalogo)', noun: 'servizi', required: 'name',
  aliases: {
    nome: 'name', name: 'name', prodotto: 'name', servizio: 'name', articolo: 'name', titolo: 'name',
    descrizione: 'description', description: 'description', dettaglio: 'description', note: 'description',
    prezzo: 'base_price', price: 'base_price', costo: 'base_price', importo: 'base_price', prezzobase: 'base_price',
    unita: 'unit', unit: 'unit', um: 'unit', unitamisura: 'unit',
    categoria: 'category', category: 'category', tipo: 'category', reparto: 'category', gruppo: 'category',
  },
  preview: [{ key: 'name', label: 'Nome' }, { key: 'category', label: 'Categoria' }, { key: 'base_price', label: 'Prezzo' }, { key: 'unit', label: 'Unità' }],
  sample: 'Nome,Descrizione,Prezzo,Unità,Categoria\nServizio fotografico full day,Copertura completa,1500,evento,Fotografo\nAlbum fine art 30x30,Album rilegato,450,pezzo,Fotografo\nMenu degustazione,5 portate,75,persona,Catering\n',
  transform: (row, map) => {
    const r = genericMap(row, map)
    if (!r.name) return null
    return { name: r.name, description: r.description ?? null, base_price: num(r.base_price) ?? 0, unit: normUnit(r.unit), category: (r.category as string) ?? null }
  },
  run: async (records, ctx) => {
    // profilo (subrole) per categorizzare correttamente
    const { data: prof } = await (supabase.from as never as (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { subrole: string | null } | null }> } } })('profiles').select('subrole').eq('id', ctx.userId).maybeSingle()
    const subrole = prof?.subrole ?? null
    // categorie: find-or-create per nome
    const wanted = Array.from(new Set(records.map((r) => (r.category as string)?.trim()).filter(Boolean))) as string[]
    const catId = new Map<string, string>()
    const { data: existing } = await (supabase.from('service_categories' as never) as never as { select: (s: string) => Promise<{ data: Array<{ id: string; name: string }> | null }> }).select('id, name')
    for (const c of (existing ?? [])) catId.set(c.name.toLowerCase(), c.id)
    for (const name of wanted) {
      if (catId.has(name.toLowerCase())) continue
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + ctx.userId.slice(0, 6)
      const { data: ins } = await (supabase.from('service_categories' as never) as never as { insert: (v: unknown) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null }> } } })
        .insert({ name, slug, subrole, is_standard: false, created_by: ctx.userId }).select('id').single()
      if (ins?.id) catId.set(name.toLowerCase(), ins.id)
    }
    // categoria di default per le righe senza categoria
    let fallback = catId.get('catalogo')
    if (!fallback) {
      const slug = 'catalogo-' + ctx.userId.slice(0, 6)
      const { data: ins } = await (supabase.from('service_categories' as never) as never as { insert: (v: unknown) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null }> } } })
        .insert({ name: 'Catalogo', slug, subrole, is_standard: false, created_by: ctx.userId }).select('id').single()
      fallback = ins?.id; if (fallback) catId.set('catalogo', fallback)
    }
    const rows = records.map((r, i) => ({
      fornitore_id: ctx.userId,
      category_id: (r.category && catId.get((r.category as string).toLowerCase())) || fallback,
      name: r.name, description: r.description ?? null, base_price: r.base_price ?? 0,
      unit: r.unit ?? 'PEZZO', is_active: true, display_order: i, tags: ['import'],
    }))
    return chunkInsert('services', rows)
  },
}

// ── TARGET: clienti (anagrafiche fornitore) ────────────────────────────────
const CLIENTS: ImportTarget = {
  key: 'clients', label: 'Clienti', noun: 'clienti', required: 'full_name',
  aliases: {
    nome: 'full_name', nomecognome: 'full_name', fullname: 'full_name', name: 'full_name', cliente: 'full_name', referente: 'full_name',
    email: 'email', mail: 'email', telefono: 'phone', phone: 'phone', cellulare: 'phone', mobile: 'phone',
    partner: 'partner_name', compagno: 'partner_name', sposo: 'partner_name', sposa: 'partner_name',
    dataevento: 'event_date', data: 'event_date', eventdate: 'event_date',
    tipoevento: 'event_kind', evento: 'event_kind', tipo: 'event_kind',
    luogo: 'location_text', location: 'location_text', citta: 'location_text',
    invitati: 'guest_estimate', ospiti: 'guest_estimate', numeroinvitati: 'guest_estimate',
    note: 'notes', notes: 'notes', partitaiva: 'vat_number', piva: 'vat_number', codicefiscale: 'fiscal_code', cf: 'fiscal_code',
  },
  preview: [{ key: 'full_name', label: 'Nome' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Telefono' }, { key: 'event_date', label: 'Data evento' }],
  sample: 'Nome,Email,Telefono,Partner,Data evento,Tipo evento,Luogo,Invitati,Note\nMario e Lucia,mario@email.it,+39 333 1112233,Lucia,2027-06-12,matrimonio,Villa Reale,120,Cliente da fiera\n',
  transform: (row, map) => {
    const r = genericMap(row, map)
    if (!r.full_name) return null
    if (r.guest_estimate) r.guest_estimate = num(r.guest_estimate) ?? undefined
    if (r.event_date) { const d = new Date(String(r.event_date)); r.event_date = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10) }
    return r
  },
  run: async (records, ctx) => chunkInsert('supplier_clients', records.map((r) => ({ supplier_id: ctx.userId, status: 'LEAD', source: 'csv', ...r }))),
}

// ── TARGET: invitati (event_guests) — richiede un evento ───────────────────
const GUESTS: ImportTarget = {
  key: 'guests', label: 'Invitati', noun: 'invitati', required: 'full_name', needsEntry: true,
  aliases: {
    nome: 'full_name', nomecognome: 'full_name', fullname: 'full_name', name: 'full_name', invitato: 'full_name',
    email: 'email', mail: 'email', telefono: 'phone', phone: 'phone', cellulare: 'phone',
    posti: 'party_size', numeropersone: 'party_size', accompagnatori: 'party_size',
    gruppo: 'group_label', group: 'group_label', categoria: 'group_label',
    dieta: 'diet', allergia: 'diet', note: 'notes', notes: 'notes',
  },
  preview: [{ key: 'full_name', label: 'Nome' }, { key: 'email', label: 'Email' }, { key: 'party_size', label: 'Posti' }, { key: 'group_label', label: 'Gruppo' }],
  sample: 'Nome,Email,Telefono,Posti,Gruppo,Dieta,Note\nMario Rossi,mario@email.it,+39 333 1234567,2,Famiglia,Vegetariano,\n',
  transform: (row, map) => {
    const r = genericMap(row, map)
    if (!r.full_name) return null
    if (r.party_size) r.party_size = num(r.party_size) ?? 1
    return r
  },
  run: async (records, ctx) => {
    if (!ctx.entryId) return { imported: 0, skipped: records.length, errors: ['Nessun evento selezionato per gli invitati'] }
    return chunkInsert('event_guests', records.map((r) => ({ entry_id: ctx.entryId, ...r })))
  },
}

export const IMPORT_TARGETS: ImportTarget[] = [SERVICES, CLIENTS, GUESTS]

// auto-detect: il target i cui alias coprono più colonne del CSV
export function detectTarget(headers: string[]): ImportTarget {
  const norm = headers.map(normalizeHeader)
  let best = IMPORT_TARGETS[0]!, bestScore = -1
  for (const t of IMPORT_TARGETS) {
    const score = norm.filter((h) => t.aliases[h]).length + (norm.some((h) => t.aliases[h] === t.required) ? 2 : 0)
    if (score > bestScore) { bestScore = score; best = t }
  }
  return best
}

export function buildMap(headers: string[], target: ImportTarget): Map<string, string> {
  const m = new Map<string, string>()
  for (const h of headers) { const n = normalizeHeader(h); if (target.aliases[n]) m.set(n, target.aliases[n]) }
  return m
}
