#!/usr/bin/env node
/**
 * Crea un wedding demo "De Luca" con dati popolati in tutti i moduli:
 * preventivo accettato, scaletta, tavoli, invitati, budget, checklist,
 * mood board (Pexels), playlist, contratto, alcune analytics views.
 *
 * Run: node scripts/seed-demo-wedding.mjs
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PEXELS_KEY = process.env.PEXELS_API_KEY
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const GIULIA = '00000000-aaaa-0000-0000-000000000002'
const VILLA = '00000000-aaaa-0000-0000-000000000003'
const FIORERIA = '00000000-aaaa-0000-0000-000000000004'
const MARIO = '00000000-aaaa-0000-0000-000000000005'
const CATERING = '00000000-aaaa-0000-0000-000000000006'

console.log('🌺 Seed demo wedding De Luca')

// 1. Quote + accettazione --------------------------------------------------
console.log('  · Creo quote De Luca con voci opzionali + alternative...')
await sb.from('quotes').delete().eq('client_name', 'Famiglia De Luca Demo')
const q = await sb.from('quotes').insert({
  owner_id: GIULIA,
  title: 'Matrimonio De Luca · Demo',
  client_name: 'Famiglia De Luca Demo',
  client_email: 'demo@cliente-test.it',
  event_date: '2026-09-15',
  guest_count: 120,
  table_count: 12,
  default_markup_percent: 15,
  status: 'ACCETTATO',
  access_token: crypto.randomUUID(),
  accepted_at: new Date().toISOString(),
}).select().single()
if (q.error) throw q.error
const qid = q.data.id

const items = [
  // Villa Aurora
  { service_id: '22220000-0003-0000-0000-000000000001', supplier_id: VILLA, name_snapshot: 'Affitto sala matrimonio', snapshot_price: 8000, unit_snapshot: 'EVENTO', quantity: 1, quantity_basis: 'FLAT', sort_order: 0 },
  { service_id: '22220000-0003-0000-0000-000000000002', supplier_id: VILLA, name_snapshot: 'Allestimento sala', snapshot_price: 1200, unit_snapshot: 'EVENTO', quantity: 1, quantity_basis: 'FLAT', sort_order: 1 },
  // Fioreria
  { service_id: '22220000-0004-0000-0000-000000000001', supplier_id: FIORERIA, name_snapshot: 'Bouquet sposa classico', snapshot_price: 180, unit_snapshot: 'PEZZO', quantity: 1, quantity_basis: 'FLAT', sort_order: 2 },
  { service_id: '22220000-0004-0000-0000-000000000003', supplier_id: FIORERIA, name_snapshot: 'Addobbi cerimonia chiesa', snapshot_price: 850, unit_snapshot: 'EVENTO', quantity: 1, quantity_basis: 'FLAT', sort_order: 3 },
  { service_id: '22220000-0004-0000-0000-000000000005', supplier_id: FIORERIA, name_snapshot: 'Centrotavola standard', snapshot_price: 45, unit_snapshot: 'PEZZO', quantity: 12, quantity_basis: 'PER_TABLE', sort_order: 4 },
  // Catering — alternative menu (cliente sceglie)
  { service_id: '22220000-0006-0000-0000-000000000001', supplier_id: CATERING, name_snapshot: 'Menu base', snapshot_price: 95, unit_snapshot: 'PERSONA', quantity: 120, quantity_basis: 'PER_GUEST', sort_order: 5, alternative_group: 'menu', selected_by_client: true },
  { service_id: '22220000-0006-0000-0000-000000000002', supplier_id: CATERING, name_snapshot: 'Menu premium', snapshot_price: 130, unit_snapshot: 'PERSONA', quantity: 120, quantity_basis: 'PER_GUEST', sort_order: 6, alternative_group: 'menu', selected_by_client: false },
  // Mario Foto
  { service_id: '22220000-0005-0000-0000-000000000002', supplier_id: MARIO, name_snapshot: 'Servizio fotografico premium', snapshot_price: 2400, unit_snapshot: 'EVENTO', quantity: 1, quantity_basis: 'FLAT', sort_order: 7 },
  { service_id: '22220000-0005-0000-0000-000000000003', supplier_id: MARIO, name_snapshot: 'Album fotografico 30x30', snapshot_price: 650, unit_snapshot: 'PEZZO', quantity: 1, quantity_basis: 'FLAT', sort_order: 8 },
  // Opzionale: drone
  { service_id: '22220000-0005-0000-0000-000000000005', supplier_id: MARIO, name_snapshot: 'Riprese drone', snapshot_price: 450, unit_snapshot: 'EVENTO', quantity: 1, quantity_basis: 'FLAT', sort_order: 9, is_optional: true, selected_by_client: false },
]
const ii = await sb.from('quote_items').insert(items.map((x) => ({
  is_optional: false, selected_by_client: null, alternative_group: null,
  ...x, quote_id: qid,
})))
if (ii.error) throw ii.error
console.log(`    ✓ ${items.length} voci preventivo (1 alternative_group menu, 1 opzionale drone)`)

// 2. Calendar entry --------------------------------------------------------
const ce = await sb.from('calendar_entries').insert({
  owner_id: GIULIA,
  title: 'Matrimonio De Luca · Demo',
  client_name: 'Famiglia De Luca Demo',
  client_email: 'demo@cliente-test.it',
  date_from: '2026-09-15',
  date_to: '2026-09-15',
  status: 'OPZIONATA',
  value_amount: 25000,
  notes: 'VIP, attenzione celiachia sposa',
  quote_id: qid,
}).select().single()
if (ce.error) throw ce.error
const eid = ce.data.id

await sb.from('calendar_entry_participants').insert([
  { entry_id: eid, user_id: VILLA, role_in_entry: 'location' },
  { entry_id: eid, user_id: FIORERIA, role_in_entry: 'fioraio' },
  { entry_id: eid, user_id: MARIO, role_in_entry: 'fotografo' },
  { entry_id: eid, user_id: CATERING, role_in_entry: 'catering' },
])
console.log(`    ✓ calendar entry + 4 participants`)

// 3. Timeline --------------------------------------------------------------
const timeline = [
  { ord: 1, start_time: '08:00', duration_min: 60, title: 'Setup fiori chiesa', supplier_id: FIORERIA, location: 'Chiesa San Pietro' },
  { ord: 2, start_time: '09:30', duration_min: 90, title: 'Trucco e preparazione sposa', location: 'Casa sposa' },
  { ord: 3, start_time: '11:00', duration_min: 60, title: 'Cerimonia in chiesa', is_critical: true, location: 'Chiesa San Pietro' },
  { ord: 4, start_time: '12:30', duration_min: 30, title: 'Foto post-cerimonia', supplier_id: MARIO, location: 'Esterno chiesa' },
  { ord: 5, start_time: '13:00', duration_min: 60, title: 'Trasferimento ospiti a Villa Aurora', location: 'Villa Aurora' },
  { ord: 6, start_time: '14:00', duration_min: 90, title: 'Aperitivo di benvenuto', supplier_id: CATERING, location: 'Villa Aurora · Giardino' },
  { ord: 7, start_time: '15:30', duration_min: 180, title: 'Pranzo matrimoniale', is_critical: true, supplier_id: CATERING, location: 'Villa Aurora · Sala' },
  { ord: 8, start_time: '18:30', duration_min: 30, title: 'Taglio torta', is_critical: true, supplier_id: CATERING },
  { ord: 9, start_time: '19:00', duration_min: 15, title: 'Prima danza', is_critical: true },
  { ord: 10, start_time: '19:30', duration_min: 180, title: 'Festa e musica', location: 'Villa Aurora · Sala' },
]
await sb.from('event_timeline').insert(timeline.map((t) => ({ ...t, entry_id: eid })))
console.log(`    ✓ ${timeline.length} step in timeline`)

// 4. Tavoli + invitati ------------------------------------------------------
const tables = [
  { table_no: 0, label: 'Tavolo Sposi', seats: 6, shape: 'HEAD' },
  { table_no: 1, label: 'Famiglia Sposa', seats: 10, shape: 'ROUND' },
  { table_no: 2, label: 'Famiglia Sposo', seats: 10, shape: 'ROUND' },
  { table_no: 3, label: 'Zii Sposa', seats: 10, shape: 'ROUND' },
  { table_no: 4, label: 'Zii Sposo', seats: 10, shape: 'ROUND' },
  { table_no: 5, label: 'Amici Liceo', seats: 12, shape: 'RECT' },
  { table_no: 6, label: 'Amici Università', seats: 12, shape: 'RECT' },
  { table_no: 7, label: 'Colleghi Sposa', seats: 10, shape: 'ROUND' },
  { table_no: 8, label: 'Colleghi Sposo', seats: 10, shape: 'ROUND' },
  { table_no: 9, label: 'Vicini di casa', seats: 8, shape: 'ROUND' },
  { table_no: 10, label: 'Cugini', seats: 10, shape: 'ROUND' },
  { table_no: 11, label: 'Tavolo bambini', seats: 8, shape: 'ROUND' },
]
const tIns = await sb.from('event_tables').insert(tables.map((t) => ({ ...t, entry_id: eid }))).select()
console.log(`    ✓ ${tables.length} tavoli`)
const tableMap = Object.fromEntries((tIns.data ?? []).map((t) => [t.label, t.id]))

const firstNames = ['Andrea','Sara','Marco','Giulia','Luca','Chiara','Federico','Martina','Alessandro','Elena','Davide','Francesca','Lorenzo','Valentina','Riccardo','Camilla','Tommaso','Beatrice','Filippo','Aurora','Matteo','Alice','Simone','Greta','Stefano','Ilaria','Giovanni','Sofia','Pietro','Anna']
const lastNames = ['Rossi','Bianchi','Russo','Esposito','Romano','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Rizzo','Lombardi']
const groups = ['Famiglia Sposa','Famiglia Sposo','Zii Sposa','Zii Sposo','Amici Liceo','Amici Università','Colleghi Sposa','Colleghi Sposo','Vicini di casa','Cugini']

const guests = []
for (let i = 0; i < 60; i++) {
  const fn = firstNames[Math.floor(Math.random() * firstNames.length)]
  const ln = lastNames[Math.floor(Math.random() * lastNames.length)]
  const grp = groups[Math.floor(Math.random() * groups.length)]
  guests.push({
    entry_id: eid,
    full_name: `${fn} ${ln}`,
    party_size: Math.random() < 0.3 ? 2 : 1,
    rsvp: ['YES','YES','YES','PENDING','NO','MAYBE'][Math.floor(Math.random() * 6)],
    diet: Math.random() < 0.15 ? ['vegano','vegetariano','gluten-free','allergie noci','intolleranza lattosio'][Math.floor(Math.random() * 5)] : null,
    side: Math.random() < 0.5 ? 'SPOSA' : 'SPOSO',
    group_label: grp,
    table_id: tableMap[grp] ?? null,
  })
}
await sb.from('event_guests').insert(guests)
console.log(`    ✓ ${guests.length} invitati`)

// 5. Budget ----------------------------------------------------------------
const cats = [
  { name: 'Location', planned: 9200, color: '#1A2E4F', ord: 0 },
  { name: 'Catering', planned: 12500, color: '#C9A961', ord: 1 },
  { name: 'Fiori', planned: 1800, color: '#D28686', ord: 2 },
  { name: 'Foto e video', planned: 3200, color: '#5D9AC4', ord: 3 },
  { name: 'Musica', planned: 1200, color: '#8DA27D', ord: 4 },
  { name: 'Vestiti e accessori', planned: 3500, color: '#A865B5', ord: 5 },
  { name: 'Auto + transfer', planned: 800, color: '#7A8294', ord: 6 },
  { name: 'Wedding cake', planned: 600, color: '#DD9F2F', ord: 7 },
]
const cIns = await sb.from('budget_categories').insert(cats.map((c) => ({ ...c, entry_id: eid, planned_amount: c.planned }))).select()
const cmap = Object.fromEntries((cIns.data ?? []).map((c) => [c.name, c.id]))
const bEntries = [
  { cat: 'Location', desc: 'Acconto Villa Aurora', amount: 3000, paid: true, paid_at: '2026-04-15' },
  { cat: 'Location', desc: 'Saldo location', amount: 5000, paid: false },
  { cat: 'Catering', desc: 'Acconto catering', amount: 4000, paid: true, paid_at: '2026-05-01' },
  { cat: 'Fiori', desc: 'Acconto fioreria', amount: 600, paid: true, paid_at: '2026-04-20' },
  { cat: 'Foto e video', desc: 'Acconto Mario Foto', amount: 1000, paid: true, paid_at: '2026-03-30' },
  { cat: 'Musica', desc: 'DJ confermato', amount: 800, paid: false },
  { cat: 'Vestiti e accessori', desc: 'Vestito sposa', amount: 2200, paid: true, paid_at: '2026-02-10' },
  { cat: 'Wedding cake', desc: 'Pasticceria torta', amount: 480, paid: false },
]
await sb.from('budget_entries').insert(bEntries.map((e) => ({
  entry_id: eid,
  category_id: cmap[e.cat],
  description: e.desc,
  amount: e.amount,
  paid: e.paid,
  paid_at: e.paid_at ?? null,
})))
console.log(`    ✓ ${cats.length} categorie budget + ${bEntries.length} movimenti`)

// 6. Checklist -------------------------------------------------------------
const tasks = [
  { phase: '12_MESI', title: 'Scegliere la data e la location', done: true },
  { phase: '12_MESI', title: 'Definire il budget complessivo', done: true },
  { phase: '12_MESI', title: 'Selezionare fornitori principali', done: true },
  { phase: '6_MESI',  title: 'Inviare save the date', done: true },
  { phase: '6_MESI',  title: 'Acquistare vestito sposa', done: true },
  { phase: '6_MESI',  title: 'Acquistare abito sposo', done: false, due_at: '2026-06-15' },
  { phase: '3_MESI',  title: 'Confermare menu con catering', done: true },
  { phase: '3_MESI',  title: 'Definire scaletta cerimonia', done: false, due_at: '2026-06-20' },
  { phase: '3_MESI',  title: 'Prenotare auto sposi', done: false, due_at: '2026-07-01' },
  { phase: '1_MESE',  title: 'Confermare RSVP definitivi', done: false, due_at: '2026-08-15' },
  { phase: '1_MESE',  title: 'Pagare acconti finali', done: false, due_at: '2026-08-20' },
  { phase: '1_MESE',  title: 'Prova trucco e parrucco', done: false, due_at: '2026-08-25' },
  { phase: '1_SETTIMANA', title: 'Confermare ordine fiori', done: false, due_at: '2026-09-08' },
  { phase: '1_SETTIMANA', title: 'Briefing finale fornitori', done: false, due_at: '2026-09-12' },
  { phase: 'DAY_OF',  title: 'Distribuire bomboniere', done: false },
  { phase: 'DAY_OF',  title: 'Verificare luci e audio sala', done: false },
]
await sb.from('wedding_tasks').insert(tasks.map((t, i) => ({ ...t, entry_id: eid, ord: i })))
console.log(`    ✓ ${tasks.length} task checklist`)

// 7. Playlist --------------------------------------------------------------
const playlist = [
  { moment: 'CERIMONIA', song_title: 'Canon in D', artist: 'Pachelbel' },
  { moment: 'CERIMONIA', song_title: 'Ave Maria', artist: 'Schubert' },
  { moment: 'CERIMONIA', song_title: 'A Thousand Years', artist: 'Christina Perri' },
  { moment: 'APERITIVO', song_title: 'Fly Me to the Moon', artist: 'Frank Sinatra' },
  { moment: 'APERITIVO', song_title: 'L-O-V-E', artist: 'Nat King Cole' },
  { moment: 'APERITIVO', song_title: 'Quando, Quando, Quando', artist: 'Tony Renis' },
  { moment: 'CENA', song_title: 'La Vie en Rose', artist: 'Édith Piaf' },
  { moment: 'CENA', song_title: 'Volare', artist: 'Domenico Modugno' },
  { moment: 'TAGLIO_TORTA', song_title: 'Marry You', artist: 'Bruno Mars' },
  { moment: 'PRIMA_DANZA', song_title: 'Perfect', artist: 'Ed Sheeran', notes: 'Versione duet con Beyoncé' },
  { moment: 'FESTA', song_title: 'I Wanna Dance with Somebody', artist: 'Whitney Houston' },
  { moment: 'FESTA', song_title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars' },
  { moment: 'FESTA', song_title: 'Dancing Queen', artist: 'ABBA' },
]
await sb.from('event_playlist').insert(playlist.map((p, i) => ({ ...p, entry_id: eid, ord: i })))
console.log(`    ✓ ${playlist.length} brani playlist`)

// 8. Mood board (Pexels) ---------------------------------------------------
if (PEXELS_KEY) {
  const moodQueries = [
    { q: 'wedding bridal dress white lace', tag: 'vestito' },
    { q: 'wedding bouquet peonies', tag: 'fiori' },
    { q: 'italian villa wedding ceremony', tag: 'location' },
    { q: 'wedding cake elegant', tag: 'torta' },
    { q: 'wedding table arrangement candles', tag: 'allestimento' },
    { q: 'wedding aisle decoration outdoor', tag: 'allestimento' },
  ]
  const moodRows = []
  for (const { q, tag } of moodQueries) {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=2&orientation=landscape`, {
      headers: { Authorization: PEXELS_KEY },
    })
    if (r.ok) {
      const j = await r.json()
      for (const p of j.photos ?? []) {
        moodRows.push({ entry_id: eid, url: p.src.large, source: 'pexels', caption: q, tag, ord: moodRows.length })
      }
    }
  }
  await sb.from('mood_images').insert(moodRows)
  console.log(`    ✓ ${moodRows.length} mood images Pexels`)
}

// 9. Contratto ------------------------------------------------------------
const contract = await sb.from('contracts').insert({
  owner_id: GIULIA,
  quote_id: qid,
  entry_id: eid,
  title: 'Contratto matrimonio De Luca · Demo',
  client_name: 'Famiglia De Luca Demo',
  client_email: 'demo@cliente-test.it',
  event_date: '2026-09-15',
  total_amount: 25000,
  status: 'INVIATO',
  access_token: crypto.randomUUID(),
  sections: [
    { heading: 'Oggetto', body: 'Organizzazione del matrimonio del 15/09/2026 presso Villa Aurora.', type: 'CLAUSULE' },
    { heading: 'Pagamento', body: 'Acconto 30% alla firma, 40% 60gg prima evento, saldo il giorno.', type: 'PRICE' },
    { heading: 'Cancellazione', body: 'Disdetta entro 90gg: trattenuto 50% acconto. Oltre: 100%.', type: 'TERMS' },
    { heading: 'Forza maggiore', body: 'Riprogrammazione concordata in caso di eventi imprevedibili.', type: 'TERMS' },
  ],
}).select().single()
console.log(`    ✓ contratto INVIATO`)

// 10. Analytics views simulati --------------------------------------------
const events = ['OPEN','SCROLL','SCROLL','ITEM_FOCUS','ITEM_FOCUS','OPTIONAL_TOGGLE','ALTERNATIVE_PICK','PDF_DOWNLOAD','OPEN','ACCEPT']
for (const e of events) {
  await sb.from('quote_views').insert({
    quote_id: qid,
    event_type: e,
    payload: e === 'ITEM_FOCUS' ? { item_id: items[2].sort_order } : {},
  })
}
console.log(`    ✓ ${events.length} eventi analytics simulati`)

console.log('\n✅ Demo wedding pronto. Login giulia@wp-test.it → /weddings')
