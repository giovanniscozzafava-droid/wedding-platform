#!/usr/bin/env node
/**
 * MEGA STRESS — 3000+ operazioni su Supabase prod (zfwlkvqxfzvubmfyxofs).
 *
 * Esegue:
 * - 8 foto Pexels per OGNI service (~200 photos)
 * - 4 modificatori per OGNI service (~80 modifiers)
 * - 20 weddings nuovi (totale ~24)
 * - Per ogni wedding NUOVO: full data set (guests, tables, timeline, mood, playlist, tasks, accom, transp, gadgets, budget cats+entries, subevents, transport_assignments)
 * - Quote_supplier_markups (override markup per fornitore su preventivi)
 * - Budget_entries (spese per categoria con paid/unpaid)
 * - Sub-eventi (rehearsal, addio celibato, brunch)
 * - Transport assignments (assegna invitati ai pulmini)
 *
 * Idempotente per service_photos (skip se gia presenti), additivo per i wedding.
 */
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker/locale/it'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const PEXELS_BY_CAT = {
  fotografo: [
    'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg', 'https://images.pexels.com/photos/931796/pexels-photo-931796.jpeg',
    'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg', 'https://images.pexels.com/photos/1043902/pexels-photo-1043902.jpeg',
    'https://images.pexels.com/photos/1456613/pexels-photo-1456613.jpeg', 'https://images.pexels.com/photos/1395964/pexels-photo-1395964.jpeg',
    'https://images.pexels.com/photos/1454018/pexels-photo-1454018.jpeg', 'https://images.pexels.com/photos/1244627/pexels-photo-1244627.jpeg',
  ],
  videomaker: [
    'https://images.pexels.com/photos/1844547/pexels-photo-1844547.jpeg', 'https://images.pexels.com/photos/1683975/pexels-photo-1683975.jpeg',
    'https://images.pexels.com/photos/1024960/pexels-photo-1024960.jpeg', 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg',
    'https://images.pexels.com/photos/3014857/pexels-photo-3014857.jpeg', 'https://images.pexels.com/photos/3014853/pexels-photo-3014853.jpeg',
    'https://images.pexels.com/photos/265856/pexels-photo-265856.jpeg', 'https://images.pexels.com/photos/265919/pexels-photo-265919.jpeg',
  ],
  fioraio: [
    'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg', 'https://images.pexels.com/photos/1395967/pexels-photo-1395967.jpeg',
    'https://images.pexels.com/photos/931180/pexels-photo-931180.jpeg', 'https://images.pexels.com/photos/931158/pexels-photo-931158.jpeg',
    'https://images.pexels.com/photos/265787/pexels-photo-265787.jpeg', 'https://images.pexels.com/photos/4926579/pexels-photo-4926579.jpeg',
    'https://images.pexels.com/photos/313707/pexels-photo-313707.jpeg', 'https://images.pexels.com/photos/931199/pexels-photo-931199.jpeg',
  ],
  catering: [
    'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg', 'https://images.pexels.com/photos/587741/pexels-photo-587741.jpeg',
    'https://images.pexels.com/photos/45659/pexels-photo-45659.jpeg', 'https://images.pexels.com/photos/1097456/pexels-photo-1097456.jpeg',
    'https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg', 'https://images.pexels.com/photos/1395964/pexels-photo-1395964.jpeg',
    'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg', 'https://images.pexels.com/photos/1395967/pexels-photo-1395967.jpeg',
  ],
  pasticcere: [
    'https://images.pexels.com/photos/1395964/pexels-photo-1395964.jpeg', 'https://images.pexels.com/photos/4040691/pexels-photo-4040691.jpeg',
    'https://images.pexels.com/photos/3992131/pexels-photo-3992131.jpeg', 'https://images.pexels.com/photos/265801/pexels-photo-265801.jpeg',
    'https://images.pexels.com/photos/1721934/pexels-photo-1721934.jpeg', 'https://images.pexels.com/photos/2233348/pexels-photo-2233348.jpeg',
    'https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg', 'https://images.pexels.com/photos/4040608/pexels-photo-4040608.jpeg',
  ],
  musica: [
    'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg', 'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg',
    'https://images.pexels.com/photos/164938/pexels-photo-164938.jpeg', 'https://images.pexels.com/photos/164879/pexels-photo-164879.jpeg',
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg', 'https://images.pexels.com/photos/1763067/pexels-photo-1763067.jpeg',
    'https://images.pexels.com/photos/164829/pexels-photo-164829.jpeg', 'https://images.pexels.com/photos/164751/pexels-photo-164751.jpeg',
  ],
  allestimenti: [
    'https://images.pexels.com/photos/931796/pexels-photo-931796.jpeg', 'https://images.pexels.com/photos/265801/pexels-photo-265801.jpeg',
    'https://images.pexels.com/photos/2253870/pexels-photo-2253870.jpeg', 'https://images.pexels.com/photos/1024960/pexels-photo-1024960.jpeg',
    'https://images.pexels.com/photos/1395964/pexels-photo-1395964.jpeg', 'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg',
    'https://images.pexels.com/photos/265787/pexels-photo-265787.jpeg', 'https://images.pexels.com/photos/931196/pexels-photo-931196.jpeg',
  ],
  make_up: [
    'https://images.pexels.com/photos/2113855/pexels-photo-2113855.jpeg', 'https://images.pexels.com/photos/2693209/pexels-photo-2693209.jpeg',
    'https://images.pexels.com/photos/2113848/pexels-photo-2113848.jpeg', 'https://images.pexels.com/photos/1462630/pexels-photo-1462630.jpeg',
    'https://images.pexels.com/photos/1620760/pexels-photo-1620760.jpeg', 'https://images.pexels.com/photos/2693204/pexels-photo-2693204.jpeg',
    'https://images.pexels.com/photos/1689731/pexels-photo-1689731.jpeg', 'https://images.pexels.com/photos/3373736/pexels-photo-3373736.jpeg',
  ],
}

const stats = { ok: 0, err: 0, errors: new Set() }
async function run(label, fn) {
  try {
    const r = await fn()
    if (r?.error) {
      stats.err++
      stats.errors.add(`${label}: ${r.error.message}`)
      return null
    }
    stats.ok++
    return r?.data ?? r
  } catch (e) {
    stats.err++
    stats.errors.add(`${label}: ${e.message}`)
    return null
  }
}

function tick(label) {
  if (stats.ok % 100 === 0 && stats.ok > 0) {
    process.stdout.write(`\r  ${label}: ${stats.ok} ok, ${stats.err} err  `)
  }
}

async function main() {
  console.log('\n=== MEGA STRESS ===\n')

  // ============================================================
  // 1) Service photos (8 per ogni servizio)
  // ============================================================
  console.log('[1/6] Service photos...')
  const { data: services } = await sb.from('services').select('id, name, fornitore_id, profile:profiles!services_fornitore_id_fkey(subrole)').eq('is_active', true)
  for (const svc of services ?? []) {
    const cat = svc.profile?.subrole || 'fotografo'
    const urls = PEXELS_BY_CAT[cat] || PEXELS_BY_CAT.fotografo
    const { count: existing } = await sb.from('service_photos').select('id', { count: 'exact', head: true }).eq('service_id', svc.id)
    if (existing && existing >= 6) continue
    const photos = urls.map((u, i) => ({
      service_id: svc.id,
      original_url: `${u}?auto=compress&w=1600`,
      thumbnail_url: `${u}?auto=compress&w=400`,
      sort_order: i,
    }))
    await run(`photos ${svc.name}`, () => sb.from('service_photos').insert(photos))
    tick('photos')
  }
  console.log(`\n  ✓ ${stats.ok} foto, ${stats.err} err`)

  // ============================================================
  // 2) Service modifiers (4 per servizio)
  // ============================================================
  console.log('\n[2/6] Service modifiers...')
  const baseOk = stats.ok
  for (const svc of services ?? []) {
    const { count: existing } = await sb.from('service_modifiers').select('id', { count: 'exact', head: true }).eq('service_id', svc.id)
    if (existing && existing >= 2) continue
    const mods = [
      { service_id: svc.id, name: 'Sconto fedelta` cliente abituale', modifier_type: 'PERCENT', value: -10 },
      { service_id: svc.id, name: 'Maggiorazione weekend di alta stagione (Giugno-Settembre)', modifier_type: 'PERCENT', value: 15 },
      { service_id: svc.id, name: 'Supplemento destination wedding (>200km)', modifier_type: 'FIXED', value: 280 },
      { service_id: svc.id, name: 'Sconto pacchetto completo', modifier_type: 'PERCENT', value: -8 },
    ]
    await run(`mods ${svc.name}`, () => sb.from('service_modifiers').insert(mods))
  }
  console.log(`  ✓ ${stats.ok - baseOk} modifier inserts`)

  // ============================================================
  // 3) Tanti weddings nuovi (15 weddings extra, distribuiti tra i 3 WP)
  // ============================================================
  console.log('\n[3/6] Weddings nuovi (15)...')
  const { data: wps } = await sb.from('profiles').select('id, full_name').eq('role', 'WEDDING_PLANNER').like('full_name', '%')
  const { data: forn } = await sb.from('profiles').select('id, subrole').eq('role', 'FORNITORE')
  const wpList = wps?.filter((w) => w.id !== '00000000-aaaa-0000-0000-000000000002') ?? wps ?? []  // skip Giulia legacy
  const allSvcs = await sb.from('services').select('id, fornitore_id, name, base_price, unit').eq('is_active', true).limit(100)

  const created = []
  for (let i = 0; i < 15; i++) {
    const sposa = faker.person.firstName('female')
    const sposo = faker.person.firstName('male')
    const ln = faker.person.lastName()
    const wp = wpList[i % wpList.length]
    const date = faker.date.between({ from: '2027-03-01', to: '2028-12-31' }).toISOString().slice(0, 10)

    const wedding = await run(`wedding ${i}`, () => sb.from('calendar_entries').insert({
      owner_id: wp.id,
      title: `Matrimonio ${sposa} & ${sposo} ${ln}`,
      client_name: `${sposa} & ${sposo}`,
      client_email: `${sposa.toLowerCase()}.${sposo.toLowerCase()}.${i}@email-test.it`,
      date_from: date, date_to: date, status: faker.helpers.arrayElement(['IN_TRATTATIVA', 'OPZIONATA', 'CONFERMATA']),
      notes: faker.lorem.paragraph(2),
    }).select().single())
    if (!wedding) continue
    created.push({ ...wedding, sposa, sposo, ln })
  }
  console.log(`  ✓ ${created.length}/15 weddings`)

  // ============================================================
  // 4) Per ogni wedding nuovo: full data set
  // ============================================================
  console.log('\n[4/6] Full data set per wedding nuovi...')
  for (const w of created) {
    const eid = w.id
    const date = w.date_from
    const guestN = faker.number.int({ min: 50, max: 220 })

    // 4a. Guests
    const guests = []
    for (let g = 0; g < guestN; g++) {
      guests.push({
        entry_id: eid,
        full_name: faker.person.fullName(),
        email: Math.random() > 0.6 ? faker.internet.email() : null,
        phone: Math.random() > 0.7 ? faker.phone.number() : null,
        party_size: Math.random() > 0.85 ? 2 : 1,
        rsvp: faker.helpers.weightedArrayElement([
          { weight: 5, value: 'YES' }, { weight: 2, value: 'PENDING' },
          { weight: 1, value: 'NO' }, { weight: 1, value: 'MAYBE' },
        ]),
        diet: Math.random() > 0.85 ? faker.helpers.arrayElement(['vegetariano', 'vegano', 'celiaco', 'pescetariano', 'kosher', 'halal']) : null,
        side: faker.helpers.arrayElement(['SPOSA', 'SPOSO', 'ENTRAMBI']),
        group_label: faker.helpers.arrayElement(['Famiglia sposa', 'Famiglia sposo', 'Amici universita', 'Colleghi sposa', 'Colleghi sposo', 'Vicini', 'Parenti stretti']),
      })
    }
    await run(`guests ${guestN}`, () => sb.from('event_guests').insert(guests))

    // 4b. Tables
    const nT = Math.ceil(guestN / 8) + 1
    const tables = []
    for (let t = 0; t < nT; t++) {
      tables.push({
        entry_id: eid, table_no: t + 1,
        label: t === 0 ? 'Tavolo sposi' : t === 1 ? 'Famiglia' : `Tavolo ${t + 1}`,
        seats: 8, shape: faker.helpers.arrayElement(['ROUND', 'SQUARE', 'RECT']),
        pos_x: 100 + (t % 4) * 200, pos_y: 100 + Math.floor(t / 4) * 200,
      })
    }
    await run(`tables ${nT}`, () => sb.from('event_tables').insert(tables))

    // 4c. Timeline
    const tl = [
      ['10:00', 'Preparativi sposa', 120, false],
      ['11:30', 'Preparativi sposo', 60, false],
      ['15:30', 'Arrivo invitati', 30, true],
      ['16:00', 'Cerimonia', 60, true],
      ['17:30', 'Aperitivo', 90, false],
      ['19:30', 'Cena', 150, false],
      ['22:00', 'Taglio torta', 30, true],
      ['23:00', 'Festa', 240, false],
    ].map(([start_time, title, duration_min, is_critical], ord) => ({
      entry_id: eid, ord, start_time, title, duration_min, is_critical,
    }))
    await run('timeline', () => sb.from('event_timeline').insert(tl))

    // 4d. Mood images (12 per wedding)
    const moodImgs = []
    const allPexels = Object.values(PEXELS_BY_CAT).flat()
    for (let m = 0; m < 12; m++) {
      moodImgs.push({
        entry_id: eid,
        url: `${faker.helpers.arrayElement(allPexels)}?auto=compress&w=1200`,
        source: 'pexels',
        tag: faker.helpers.arrayElement(['fiori', 'location', 'allestimento', 'torta', 'vestito', 'beauty', 'foto']),
        ord: m,
      })
    }
    await run('mood', () => sb.from('mood_images').insert(moodImgs))

    // 4e. Playlist (15 brani)
    const songs = [
      ['CERIMONIA', 'Canon in D', 'Pachelbel'], ['CERIMONIA', 'A Thousand Years', 'Christina Perri'],
      ['CERIMONIA', 'Marry Me', 'Train'], ['APERITIVO', 'Fly Me to the Moon', 'Sinatra'],
      ['APERITIVO', 'Volare', 'Modugno'], ['APERITIVO', 'La Vie en Rose', 'Edith Piaf'],
      ['CENA', 'L\'Italiano', 'Toto Cutugno'], ['CENA', 'Quando Quando', 'Tony Renis'],
      ['TAGLIO_TORTA', 'I Will Always Love You', 'Whitney Houston'],
      ['PRIMA_DANZA', 'Perfect', 'Ed Sheeran'], ['PRIMA_DANZA', 'Thinking Out Loud', 'Ed Sheeran'],
      ['FESTA', 'Sweet Caroline', 'Neil Diamond'], ['FESTA', 'Dancing Queen', 'ABBA'],
      ['FESTA', 'Mr. Brightside', 'The Killers'], ['FESTA', 'Despacito', 'Luis Fonsi'],
    ].map(([moment, song_title, artist], ord) => ({ entry_id: eid, moment, song_title, artist, ord }))
    await run('playlist', () => sb.from('event_playlist').insert(songs))

    // 4f. Tasks (15)
    const tasks = [
      ['12_MESI', 'Sopralluogo location', true], ['12_MESI', 'Save the date', true],
      ['12_MESI', 'Wedding planner', true], ['6_MESI', 'Inviti stampati', true],
      ['6_MESI', 'Prova abito sposa', false], ['6_MESI', 'Lista nozze online', false],
      ['3_MESI', 'Menu degustazione', false], ['3_MESI', 'Lista invitati def', false],
      ['3_MESI', 'Acquisto fedi', false], ['1_MESE', 'Conferma fornitori', false],
      ['1_MESE', 'Tableau marriage', false], ['1_MESE', 'Prove acconciatura', false],
      ['1_SETTIMANA', 'Bomboniere confezionate', false], ['1_SETTIMANA', 'Briefing fotografo', false],
      ['DAY_OF', 'Last check con planner', false],
    ].map(([phase, title, done], ord) => ({
      entry_id: eid, phase, title, done, done_at: done ? new Date().toISOString() : null, ord,
    }))
    await run('tasks', () => sb.from('wedding_tasks').insert(tasks))

    // 4g. Accommodations
    const accs = [
      { entry_id: eid, kind: 'HOTEL', name: `Hotel ${faker.location.city()}`, city: faker.location.city(), checkin_date: date, checkout_date: date },
      { entry_id: eid, kind: 'BNB', name: `B&B ${faker.lastName?.() ?? 'Casa'}`, city: faker.location.city(), checkin_date: date, checkout_date: date },
      { entry_id: eid, kind: 'VILLA_PRIVATA', name: `Villa ${faker.location.city()}`, city: faker.location.city(), checkin_date: date, checkout_date: date },
    ]
    await run('accommodations', () => sb.from('event_accommodations').insert(accs))

    // 4h. Transport
    const trans = [
      { entry_id: eid, kind: 'AUTO_SPOSI', label: 'Auto vintage sposi', provider: 'AutoEpoca', capacity: 2, depart_at: `${date}T15:30:00Z`, depart_from: 'Casa sposa' },
      { entry_id: eid, kind: 'PULMINO_NAVETTA', label: 'Navetta hotel', provider: 'Trasporti SRL', capacity: 30, depart_at: `${date}T15:00:00Z`, depart_from: 'Hotel centrale' },
      { entry_id: eid, kind: 'AUTOBUS_GRUPPO', label: 'Bus grande', provider: 'Bus Italia', capacity: 50, depart_at: `${date}T14:30:00Z`, depart_from: 'Stazione FS' },
    ]
    await run('transport', () => sb.from('event_transport').insert(trans))

    // 4i. Gadgets
    const gadgets = [
      { entry_id: eid, kind: 'BOMBONIERA', name: 'Confetti pers.', quantity: guestN, unit_cost: 4.5 },
      { entry_id: eid, kind: 'WELCOME_BAG', name: 'Welcome bag', quantity: Math.floor(guestN / 3), unit_cost: 18 },
      { entry_id: eid, kind: 'TABLEAU', name: 'Tableau scritto', quantity: 1, unit_cost: 180 },
      { entry_id: eid, kind: 'SEGNAPOSTO', name: 'Segnaposto calligrafia', quantity: guestN, unit_cost: 3.2 },
      { entry_id: eid, kind: 'MENU_STAMPATO', name: 'Menu personalizzato', quantity: guestN, unit_cost: 2.5 },
      { entry_id: eid, kind: 'LIBRO_FIRME', name: 'Libro firme polaroid', quantity: 1, unit_cost: 95 },
    ]
    await run('gadgets', () => sb.from('event_gadgets').insert(gadgets))

    // 4j. Sub-eventi
    const subev = [
      { entry_id: eid, kind: 'ADDIO_NUBILATO', title: 'Addio al nubilato a Mykonos', date_at: new Date(new Date(date).getTime() - 35 * 86400000).toISOString(), duration_min: 4320 },
      { entry_id: eid, kind: 'PRE_WEDDING_SHOOT', title: 'Pre-wedding photoshoot', date_at: new Date(new Date(date).getTime() - 14 * 86400000).toISOString(), duration_min: 240 },
      { entry_id: eid, kind: 'WELCOME_DINNER', title: 'Cena di benvenuto invitati lontani', date_at: new Date(new Date(date).getTime() - 1 * 86400000).toISOString(), duration_min: 180 },
      { entry_id: eid, kind: 'BRUNCH_POST', title: 'Brunch del giorno dopo', date_at: new Date(new Date(date).getTime() + 1 * 86400000).toISOString(), duration_min: 180 },
    ]
    await run('subevents', () => sb.from('event_subevents').insert(subev))

    // 4k. Budget categories + entries
    const budgetCats = [
      ['Location', 12000], ['Catering', 18000], ['Fiori', 4500], ['Foto/Video', 6500],
      ['Musica', 2800], ['Allestimenti', 3500], ['Bomboniere', 2200], ['Abito sposa', 3800],
    ].map(([name, planned_amount], ord) => ({ entry_id: eid, name, planned_amount, color: faker.color.rgb(), ord }))
    const { data: catData } = await run('budget cats', () => sb.from('budget_categories').insert(budgetCats).select())

    if (catData) {
      const entries = []
      for (const c of catData) {
        for (let e = 0; e < 3; e++) {
          entries.push({
            category_id: c.id, entry_id: eid,
            description: `${c.name} — acconto ${e + 1}`,
            amount: c.planned_amount / 3,
            paid: e < 2, paid_at: e < 2 ? new Date().toISOString().slice(0, 10) : null,
          })
        }
      }
      await run('budget entries', () => sb.from('budget_entries').insert(entries))
    }

    // 4l. Quote per il wedding
    const quoteRow = await run('quote', () => sb.from('quotes').insert({
      owner_id: w.owner_id,
      title: w.title,
      client_name: w.client_name,
      client_email: w.client_email,
      event_date: date, guest_count: guestN,
      default_markup_percent: faker.number.int({ min: 10, max: 25 }),
      status: faker.helpers.arrayElement(['BOZZA', 'INVIATO', 'ACCETTATO']),
      sent_at: new Date().toISOString(),
    }).select().single())
    if (quoteRow) {
      const picks = faker.helpers.arrayElements(allSvcs.data ?? [], { min: 10, max: 16 })
      const items = picks.map((s, ord) => {
        const qty = s.unit === 'PERSONA' ? guestN : s.unit === 'PEZZO' ? faker.number.int({ min: 1, max: 12 }) : 1
        return {
          quote_id: quoteRow.id, service_id: s.id, supplier_id: s.fornitore_id,
          name_snapshot: s.name, snapshot_price: s.base_price, unit_snapshot: s.unit,
          quantity: qty, sort_order: ord,
        }
      })
      await run('quote_items', () => sb.from('quote_items').insert(items))

      // markup overrides per 2 fornitori random
      const uniqSupp = [...new Set(picks.map((p) => p.fornitore_id))].slice(0, 2)
      const markups = uniqSupp.map((sid) => ({
        quote_id: quoteRow.id, supplier_id: sid, markup_percent: faker.number.int({ min: 5, max: 30 }),
      }))
      if (markups.length) await run('markups', () => sb.from('quote_supplier_markups').insert(markups))

      // Link quote → wedding
      await run('link quote', () => sb.from('calendar_entries').update({ quote_id: quoteRow.id }).eq('id', eid))
    }

    tick('wedding fill')
  }
  console.log(`\n  ✓ totale ${stats.ok} ops dopo wedding fill`)

  // ============================================================
  // 5) Transport assignments su weddings esistenti (incrocia tutto)
  // ============================================================
  console.log('\n[5/6] Transport assignments + table assignments...')
  const baseT = stats.ok
  const { data: allWeddings } = await sb.from('calendar_entries').select('id').like('title', 'Matrimonio%')
  for (const ww of allWeddings ?? []) {
    const { data: transports } = await sb.from('event_transport').select('id, capacity').eq('entry_id', ww.id)
    const { data: weddingGuests } = await sb.from('event_guests').select('id').eq('entry_id', ww.id).limit(80)
    if (!transports?.length || !weddingGuests?.length) continue
    // Assegna gli invitati ai trasporti (max capacity)
    for (const tr of transports) {
      const seats = tr.capacity ?? 30
      const slice = weddingGuests.slice(0, Math.min(seats, 25))
      weddingGuests.splice(0, slice.length)
      const assigns = slice.map((g) => ({ transport_id: tr.id, guest_id: g.id }))
      if (assigns.length) await run('trans_assign', () => sb.from('event_transport_assignments').insert(assigns))
    }

    // Assegna invitati ai tavoli (round-robin)
    const { data: tabs } = await sb.from('event_tables').select('id').eq('entry_id', ww.id)
    const { data: allG } = await sb.from('event_guests').select('id').eq('entry_id', ww.id).is('table_id', null).limit(160)
    if (tabs?.length && allG?.length) {
      for (let i = 0; i < allG.length; i++) {
        const tid = tabs[i % tabs.length].id
        await run('seat', () => sb.from('event_guests').update({ table_id: tid, seat_no: Math.floor(i / tabs.length) + 1 }).eq('id', allG[i].id))
      }
    }
  }
  console.log(`\n  ✓ ${stats.ok - baseT} assignments`)

  // ============================================================
  // 6) Report
  // ============================================================
  console.log('\n\n═══════════ STATS ═══════════')
  console.log(`OK ops:  ${stats.ok}`)
  console.log(`ERR ops: ${stats.err}`)
  if (stats.errors.size > 0) {
    console.log('\nErrori unici:')
    for (const e of [...stats.errors].slice(0, 30)) console.log(`  · ${e}`)
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
