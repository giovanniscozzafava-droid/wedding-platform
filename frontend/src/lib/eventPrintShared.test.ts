import { describe, it, expect } from 'vitest'
import { attendingGuests, guestsByTable, chunk, tableName, guestTableLabel, type PGuest, type PTable } from './eventPrintShared'

const G = (id: string, full_name: string, table_id: string | null = null, extra: Partial<PGuest> = {}): PGuest => ({ id, full_name, table_id, ...extra })
const tables: PTable[] = [
  { id: 't2', table_no: 2, label: null },
  { id: 't1', table_no: 1, label: 'Sposi' },
]

describe('attendingGuests', () => {
  it('esclude RSVP NO, infant e nomi vuoti', () => {
    const g = [G('1', 'Marco'), G('2', 'Lucia', null, { rsvp: 'NO' }), G('3', 'Bimbo', null, { age_group: 'INFANT' }), G('4', '   ')]
    expect(attendingGuests(g).map((x) => x.full_name)).toEqual(['Marco'])
  })
  it('tiene PENDING e MAYBE e ordina per nome', () => {
    const g = [G('1', 'Zoe'), G('2', 'Anna', null, { rsvp: 'MAYBE' }), G('3', 'bruno', null, { rsvp: 'PENDING' })]
    expect(attendingGuests(g).map((x) => x.full_name)).toEqual(['Anna', 'bruno', 'Zoe'])
  })
  it('non perde nessuno (count)', () => {
    const g = Array.from({ length: 50 }, (_, i) => G(String(i), `Ospite ${i}`))
    expect(attendingGuests(g)).toHaveLength(50)
  })
})

describe('guestsByTable', () => {
  it('raggruppa in ordine di table_no e mette i non assegnati in coda', () => {
    const g = [G('a', 'Anna', 't2'), G('b', 'Bea', 't1'), G('c', 'Carlo', null), G('d', 'Dora', 't1')]
    const res = guestsByTable(g, tables)
    expect(res.map((r) => (r.table ? tableName(r.table) : 'NON ASSEGNATI'))).toEqual(['Sposi', 'Tavolo 2', 'NON ASSEGNATI'])
    expect(res[0]!.guests.map((x) => x.full_name)).toEqual(['Bea', 'Dora'])
    expect(res[2]!.guests.map((x) => x.full_name)).toEqual(['Carlo'])
  })
  it('somma invitati = invitati presenti (nessuno perso)', () => {
    const g = [G('a', 'Anna', 't2'), G('b', 'Bea', 't1'), G('c', 'Carlo', null), G('x', 'No', 't1', { rsvp: 'NO' })]
    const total = guestsByTable(g, tables).reduce((s, r) => s + r.guests.length, 0)
    expect(total).toBe(3)
  })
})

describe('chunk', () => {
  it('pagina esattamente senza perdere elementi', () => {
    const a = Array.from({ length: 23 }, (_, i) => i)
    const pages = chunk(a, 10)
    expect(pages.map((p) => p.length)).toEqual([10, 10, 3])
    expect(pages.flat()).toEqual(a)
  })
  it('n<1 non va in loop infinito', () => expect(chunk([1, 2, 3], 0).flat()).toEqual([1, 2, 3]))
})

describe('tableName / guestTableLabel', () => {
  it('usa label se c\'è, altrimenti Tavolo N', () => {
    expect(tableName({ id: 't1', table_no: 1, label: 'Sposi' })).toBe('Sposi')
    expect(tableName({ id: 't2', table_no: 2, label: null })).toBe('Tavolo 2')
  })
  it('etichetta tavolo del singolo invitato', () => {
    expect(guestTableLabel(G('a', 'Anna', 't1'), tables)).toBe('Sposi')
    expect(guestTableLabel(G('b', 'Bea', null), tables)).toBe('')
  })
})
