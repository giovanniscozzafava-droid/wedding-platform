#!/usr/bin/env node
/**
 * Riempie i dati mancanti sui wedding gia esistenti (errori schema nello script precedente).
 * - Cancella event_guests/tables/timeline/tasks/accommodations/transport/gadgets/budget orfani
 * - Reinserisce con campi corretti dello schema reale
 */
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker/locale/it'

const SUPABASE_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function check(label, p) {
  const r = await p
  if (r.error) console.error(`  ! ${label}: ${r.error.message}`)
  else console.log(`  ✓ ${label}${Array.isArray(r.data) ? ` (${r.data.length})` : ''}`)
  return r
}

async function main() {
  const { data: weddings } = await sb.from('calendar_entries').select('id, title, owner_id, date_from')
    .like('title', 'Matrimonio%')
  console.log(`\nFound ${weddings.length} weddings to fill\n`)

  for (const w of weddings) {
    console.log(`\n=== ${w.title} ===`)
    const entry_id = w.id
    const date = w.date_from

    // 1. event_guests (era schema sbagliato)
    const { count: guestCount } = await sb.from('event_guests').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
    if (!guestCount) {
      const target = 80 + Math.floor(Math.random() * 60)
      const guests = []
      for (let i = 0; i < target; i++) {
        const sex = Math.random() > 0.5 ? 'male' : 'female'
        guests.push({
          entry_id,
          full_name: faker.person.fullName({ sex }),
          email: Math.random() > 0.7 ? faker.internet.email() : null,
          party_size: Math.random() > 0.8 ? 2 : 1,
          rsvp: faker.helpers.weightedArrayElement([
            { weight: 6, value: 'YES' },
            { weight: 2, value: 'PENDING' },
            { weight: 1, value: 'NO' },
            { weight: 1, value: 'MAYBE' },
          ]),
          diet: Math.random() > 0.85 ? faker.helpers.arrayElement(['vegetariano', 'vegano', 'celiaco', 'allergico noci']) : null,
          side: faker.helpers.arrayElement(['SPOSA', 'SPOSO', 'ENTRAMBI']),
          group_label: faker.helpers.arrayElement(['Famiglia sposa', 'Famiglia sposo', 'Amici', 'Colleghi', 'Vicini']),
        })
      }
      await check(`guests x${target}`, sb.from('event_guests').insert(guests))
    } else {
      console.log(`  · guests gia ${guestCount}`)
    }

    // 2. event_tables (era 'table_number','name' → reale: 'table_no','label')
    const { count: tCount } = await sb.from('event_tables').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
    if (!tCount) {
      const nT = 6 + Math.floor(Math.random() * 5)
      const tables = []
      for (let t = 0; t < nT; t++) {
        tables.push({
          entry_id, table_no: t + 1,
          label: t === 0 ? 'Tavolo sposi' : `Tavolo ${t + 1}`,
          seats: 8, shape: faker.helpers.arrayElement(['ROUND', 'SQUARE', 'RECT']),
        })
      }
      await check(`tables x${nT}`, sb.from('event_tables').insert(tables))
    } else {
      console.log(`  · tables gia ${tCount}`)
    }

    // 3. event_timeline (era 'at_time','sort_order' → reale: 'start_time','ord')
    const { count: tlCount } = await sb.from('event_timeline').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
    if (!tlCount) {
      const steps = [
        { ord: 0, start_time: '10:00', title: 'Preparativi sposa', duration_min: 120, is_critical: false },
        { ord: 1, start_time: '11:30', title: 'Preparativi sposo', duration_min: 60, is_critical: false },
        { ord: 2, start_time: '15:30', title: 'Arrivo invitati cerimonia', duration_min: 30, is_critical: true },
        { ord: 3, start_time: '16:00', title: 'Cerimonia', duration_min: 60, is_critical: true },
        { ord: 4, start_time: '17:30', title: 'Aperitivo di benvenuto', duration_min: 90, is_critical: false },
        { ord: 5, start_time: '19:30', title: 'Cena', duration_min: 150, is_critical: false },
        { ord: 6, start_time: '22:00', title: 'Taglio torta', duration_min: 30, is_critical: true },
        { ord: 7, start_time: '23:00', title: 'Festa & balli', duration_min: 180, is_critical: false },
      ].map((s) => ({ ...s, entry_id }))
      await check(`timeline x${steps.length}`, sb.from('event_timeline').insert(steps))
    } else {
      console.log(`  · timeline gia ${tlCount}`)
    }

    // 4. wedding_tasks (phase '12_PRIMA' → reale '12_MESI')
    const { count: tkCount } = await sb.from('wedding_tasks').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
    if (!tkCount) {
      const tasks = [
        ['12_MESI', 'Sopralluogo location', true],
        ['12_MESI', 'Preventivo definitivo', true],
        ['12_MESI', 'Save the date', true],
        ['6_MESI', 'Inviti stampati', true],
        ['6_MESI', 'Prova abito sposa', false],
        ['6_MESI', 'Lista nozze online', false],
        ['3_MESI', 'Menu degustazione', true],
        ['3_MESI', 'Lista invitati definitiva', false],
        ['3_MESI', 'Acquisto fedi', false],
        ['1_MESE', 'Conferma fornitori', false],
        ['1_MESE', 'Disposizione tavoli', false],
        ['1_MESE', 'Prove acconciatura make-up', false],
        ['1_SETTIMANA', 'Confezione bomboniere', false],
        ['1_SETTIMANA', 'Riconsegna abiti', false],
        ['DAY_OF', 'Sveglia presto + colazione', false],
      ].map(([phase, title, done], i) => ({ entry_id, phase, title, done, done_at: done ? new Date().toISOString() : null, ord: i }))
      await check(`tasks x${tasks.length}`, sb.from('wedding_tasks').insert(tasks))
    } else {
      console.log(`  · tasks gia ${tkCount}`)
    }

    // 5. event_accommodations
    const { count: aCount } = await sb.from('event_accommodations').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
    if (!aCount) {
      const accs = [
        {
          entry_id, kind: 'HOTEL', name: `Hotel ${faker.company.name()}`,
          address: faker.location.streetAddress(), city: faker.location.city(),
          checkin_date: date, checkout_date: date, notes: 'Convenzione 15% per ospiti matrimonio.',
        },
        {
          entry_id, kind: 'BNB', name: `B&B ${faker.location.city()}`,
          address: faker.location.streetAddress(), city: faker.location.city(),
          checkin_date: date, checkout_date: date,
        },
      ]
      await check(`accommodations x${accs.length}`, sb.from('event_accommodations').insert(accs))
    }

    // 6. event_transport (era 'from_addr','to_addr','seats' → reale 'depart_from','depart_to','capacity','label')
    const { count: trCount } = await sb.from('event_transport').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
    if (!trCount) {
      const transports = [
        {
          entry_id, kind: 'AUTO_SPOSI', label: 'Auto sposi vintage',
          provider: 'AutoEpoca Roma', capacity: 2,
          depart_at: `${date}T15:30:00Z`, depart_from: 'Casa sposa',
        },
        {
          entry_id, kind: 'PULMINO_NAVETTA', label: 'Navetta hotel → location',
          provider: 'Trasporti Linea', capacity: 30,
          depart_at: `${date}T15:00:00Z`, depart_from: 'Hotel centrale',
        },
        {
          entry_id, kind: 'AUTOBUS_GRUPPO', label: 'Autobus invitati lontani',
          provider: 'Bus Italia', capacity: 50,
          depart_at: `${date}T14:30:00Z`, depart_from: 'Stazione FS',
        },
      ]
      await check(`transport x${transports.length}`, sb.from('event_transport').insert(transports))
    }

    // 7. event_gadgets (kind enum gia corretto)
    const { count: gCount } = await sb.from('event_gadgets').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
    if (!gCount) {
      const { count: guestN } = await sb.from('event_guests').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
      const n = guestN ?? 100
      const gadgets = [
        { entry_id, kind: 'BOMBONIERA', name: 'Confetti personalizzati', quantity: n, unit_cost: 4.5 },
        { entry_id, kind: 'GADGET', name: 'Ventaglio personalizzato', quantity: n, unit_cost: 2.8 },
        { entry_id, kind: 'WELCOME_BAG', name: 'Welcome bag con prodotti tipici', quantity: Math.floor(n / 3), unit_cost: 18.0 },
        { entry_id, kind: 'TABLEAU', name: 'Tableau marriage stampato', quantity: 1, unit_cost: 180 },
        { entry_id, kind: 'SEGNAPOSTO', name: 'Segnaposto calligrafia', quantity: n, unit_cost: 3.2 },
      ]
      await check(`gadgets x${gadgets.length}`, sb.from('event_gadgets').insert(gadgets))
    }

    // 8. budget_categories
    const { count: bCount } = await sb.from('budget_categories').select('id', { count: 'exact', head: true }).eq('entry_id', entry_id)
    if (!bCount) {
      const cats = [
        ['Location', 12000, '#C49A5C'],
        ['Catering', 18000, '#9CAF88'],
        ['Fiori', 4500, '#D4A5A5'],
        ['Foto/Video', 6500, '#1F3A5F'],
        ['Musica', 2800, '#7E6633'],
        ['Allestimenti', 3500, '#B19CD9'],
        ['Bomboniere/Gadget', 2200, '#DEB887'],
      ].map(([name, planned_amount, color], ord) => ({ entry_id, name, planned_amount, color, ord }))
      await check(`budget x${cats.length}`, sb.from('budget_categories').insert(cats))
    }
  }

  console.log('\n✓ DONE')
}

main().catch((e) => { console.error(e); process.exit(1) })
