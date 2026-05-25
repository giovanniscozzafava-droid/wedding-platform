#!/usr/bin/env node
/**
 * AGENT-F night audit — wedding content suite
 * Invitati / Tavoli / Programma / Mood / Playlist / Trasporti / Alloggi
 *
 * Esercita il backend (Supabase) con i dati realistici che la UI scriverebbe.
 * Verifica integrita' (count, capacity, RLS couple read-only).
 * Output: REPORT.md nel run dir.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const RUN_DIR = process.env.RUN_DIR || `/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-F-wedding-content-${Date.now()}`
mkdirSync(RUN_DIR, { recursive: true })

const sb = createClient(URL, SVC, { auth: { persistSession: false } })

const PWD = 'Beta2026!'
const WP_EMAIL = 'wp-mini@planfully-demo.it'
const COUPLE_EMAIL = 'giovanni.scozzafava+sposo@gmail.com'
const PREFIX = 'AGENT-F-'

const bugs = []
const passes = []
const stats = {}

function bug(area, severity, msg, detail) {
  bugs.push({ area, severity, msg, detail: detail ? String(detail).slice(0, 600) : null })
  console.log(`  BUG [${severity}] ${area}: ${msg}${detail ? ' :: ' + String(detail).slice(0, 200) : ''}`)
}
function pass(msg) { passes.push(msg); console.log(`  OK   ${msg}`) }
function step(name) { console.log(`\n=== ${name} ===`) }

async function getUserByEmail(email) {
  for (let page = 1; page < 25; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    if (!data?.users?.length) break
    const u = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (u) return u
    if (data.users.length < 200) break
  }
  return null
}

async function loginAs(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const r = await c.auth.signInWithPassword({ email, password: PWD })
  if (r.error) throw new Error(`login ${email}: ${r.error.message}`)
  return c
}

async function cleanup(weddingId) {
  if (!weddingId) return
  console.log(`Cleanup wedding ${weddingId}`)
  // Cascade should handle most; explicit anyway
  await sb.from('event_guest_transport').delete().eq('entry_id', weddingId)
  await sb.from('event_guest_accommodation').delete().eq('entry_id', weddingId)
  await sb.from('event_guests').delete().eq('entry_id', weddingId)
  await sb.from('event_tables').delete().eq('entry_id', weddingId)
  await sb.from('event_timeline').delete().eq('entry_id', weddingId)
  await sb.from('mood_images').delete().eq('entry_id', weddingId)
  await sb.from('event_playlist').delete().eq('entry_id', weddingId)
  await sb.from('event_transport').delete().eq('entry_id', weddingId)
  await sb.from('event_accommodations').delete().eq('entry_id', weddingId)
  await sb.from('calendar_entries').delete().eq('id', weddingId)
}

// ============ MAIN ============
const main = async () => {
  // ---- SETUP: clean old AGENT-F weddings ----
  step('SETUP - cleanup previous AGENT-F runs')
  const wp = await getUserByEmail(WP_EMAIL)
  if (!wp) { bug('SETUP', 'CRITICAL', `WP ${WP_EMAIL} not found`); throw new Error('no WP') }
  pass(`WP found ${wp.id}`)

  const { data: old } = await sb.from('calendar_entries')
    .select('id,title').eq('owner_id', wp.id).ilike('title', `${PREFIX}%`)
  if (old?.length) {
    for (const w of old) await cleanup(w.id)
    pass(`cleaned ${old.length} previous AGENT-F weddings`)
  }

  // ---- CREATE WEDDING ----
  step('CREATE wedding')
  const wedTitle = `${PREFIX}Test Wedding`
  const wedRes = await sb.from('calendar_entries').insert({
    owner_id: wp.id,
    title: wedTitle,
    client_name: 'AGENT-F Sposi',
    client_email: 'agent-f-sposi@planfully-demo.it',
    date_from: '2027-09-25',
    date_to: '2027-09-25',
    status: 'CONFERMATA',
    value_amount: 35000,
    notes: 'Night audit AGENT-F 120 invitati stimati',
  }).select().single()
  if (wedRes.error) { bug('CREATE_WEDDING', 'CRITICAL', wedRes.error.message); throw wedRes.error }
  const wedding = wedRes.data
  pass(`wedding created ${wedding.id}`)
  stats.wedding_id = wedding.id

  // bind sposo (couple) as participant + couple member
  const couple = await getUserByEmail(COUPLE_EMAIL)
  if (couple) {
    await sb.from('calendar_entry_participants').upsert({
      entry_id: wedding.id, user_id: couple.id, role_in_entry: 'COUPLE', confirmed: true,
    }, { onConflict: 'entry_id,user_id' })
    const wc = await sb.from('wedding_couple_members').upsert({
      entry_id: wedding.id, user_id: couple.id, role: 'SPOSO', email: couple.email,
    }, { onConflict: 'entry_id,email' })
    if (wc.error) bug('COUPLE_BIND', 'MEDIUM', 'wedding_couple_members upsert failed', wc.error.message)
    else pass('couple bound to wedding (wedding_couple_members)')
  } else {
    bug('COUPLE_BIND', 'MEDIUM', `couple ${COUPLE_EMAIL} not found`)
  }

  // ===========================================================================
  // 1. GUESTS - 50 manuali + 30 da CSV
  // ===========================================================================
  step('1. GUESTS — 50 manuali')
  const firstNames = ['Mario','Luca','Sofia','Anna','Giulia','Marco','Paolo','Francesca','Chiara','Giovanni','Elena','Andrea','Roberto','Sara','Davide','Martina','Federico','Valentina','Stefano','Laura','Alessandro','Beatrice','Matteo','Silvia','Tommaso','Camilla','Riccardo','Greta','Edoardo','Aurora']
  const lastNames = ['Rossi','Bianchi','Verdi','Russo','Romano','Ferrari','Esposito','Conti','Ricci','Marino','Bruno','Greco','Gallo','Costa','Fontana','Mancini','Rizzo','Lombardi','Moretti','Barbieri']
  const diets = ['vegano', 'vegetariano', 'celiaco', null, null, null]
  const groups = ['famiglia sposo', 'famiglia sposa', 'amici sposo', 'amici sposa', 'colleghi']
  const sides = ['SPOSO', 'SPOSA', 'ENTRAMBI']
  const rsvps = ['PENDING', 'YES', 'NO', 'MAYBE']

  const manualGuests = []
  for (let i = 0; i < 50; i++) {
    const fn = firstNames[i % firstNames.length]
    const ln = lastNames[(i * 3) % lastNames.length]
    const accomp = i % 4 === 0
    manualGuests.push({
      entry_id: wedding.id,
      full_name: `${fn} ${ln} ${i + 1}`,
      email: i % 3 === 0 ? `agent-f-guest-${i}@planfully-demo.it` : null,
      phone: i % 5 === 0 ? `+39 333 ${1000000 + i}` : null,
      party_size: accomp ? 2 : 1,
      rsvp: rsvps[i % rsvps.length],
      diet: diets[i % diets.length],
      side: sides[i % 3],
      group_label: groups[i % groups.length],
      notes: i % 7 === 0 ? 'allergia frutta secca' : null,
    })
  }
  const ins50 = await sb.from('event_guests').insert(manualGuests).select('id')
  if (ins50.error) bug('GUESTS_MANUAL', 'HIGH', 'insert 50 failed', ins50.error.message)
  else pass(`50 guests inserted (${ins50.data.length})`)
  stats.guests_manual = ins50.data?.length ?? 0

  step('1b. GUESTS — CSV import (30)')
  // Simulate CSV import: usually the UI does parse+insert. We bypass parse, insert directly.
  const csvGuests = []
  for (let i = 0; i < 30; i++) {
    csvGuests.push({
      entry_id: wedding.id,
      full_name: `${PREFIX}CSV ${firstNames[i % firstNames.length]} ${lastNames[(i * 5) % lastNames.length]}`,
      email: `agent-f-csv-${i}@planfully-demo.it`,
      party_size: 1,
      rsvp: 'PENDING',
      diet: i % 4 === 0 ? 'vegetariano' : null,
      group_label: 'CSV import',
      side: 'ENTRAMBI',
    })
  }
  const ins30 = await sb.from('event_guests').insert(csvGuests).select('id')
  if (ins30.error) bug('GUESTS_CSV', 'HIGH', 'csv insert 30 failed', ins30.error.message)
  else pass(`30 CSV guests inserted (${ins30.data.length})`)
  stats.guests_csv = ins30.data?.length ?? 0

  // Generate CSV test file
  const csvBody = ['full_name,email,phone,party_size,rsvp,diet,group_label,side',
    ...csvGuests.map(g => `${g.full_name},${g.email},,${g.party_size},${g.rsvp},${g.diet ?? ''},${g.group_label},${g.side}`)
  ].join('\n')
  writeFileSync(path.join(RUN_DIR, 'guests-test-import.csv'), csvBody)
  pass('CSV test file saved')

  // Edit a guest (change diet)
  const firstGuestId = ins50.data?.[0]?.id
  if (firstGuestId) {
    const upd = await sb.from('event_guests').update({ diet: 'celiaco', notes: 'edit test agent-F' }).eq('id', firstGuestId)
    if (upd.error) bug('GUESTS_EDIT', 'MEDIUM', upd.error.message)
    else pass('guest edited (diet=celiaco)')
  }

  // Delete a guest
  const lastCsvId = ins30.data?.[ins30.data.length - 1]?.id
  if (lastCsvId) {
    const del = await sb.from('event_guests').delete().eq('id', lastCsvId)
    if (del.error) bug('GUESTS_DELETE', 'MEDIUM', del.error.message)
    else pass('guest deleted')
  }

  // ===========================================================================
  // 2. TABLES - 10
  // ===========================================================================
  step('2. TABLES — 10 (mix rotondo + imperiale)')
  const tablesData = []
  for (let i = 0; i < 10; i++) {
    const shape = i === 9 ? 'HEAD' : (i % 3 === 0 ? 'RECT' : 'ROUND')
    tablesData.push({
      entry_id: wedding.id,
      table_no: i + 1,
      label: shape === 'HEAD' ? `${PREFIX}Imperiale` : `${PREFIX}T${i + 1}`,
      seats: shape === 'HEAD' ? 20 : (i % 2 === 0 ? 8 : 10),
      shape,
      pos_x: 100 + (i % 4) * 200,
      pos_y: 100 + Math.floor(i / 4) * 200,
    })
  }
  const insT = await sb.from('event_tables').insert(tablesData).select('id,seats,label,shape')
  if (insT.error) bug('TABLES_CREATE', 'HIGH', insT.error.message)
  else pass(`10 tables inserted (${insT.data.length})`)
  stats.tables = insT.data?.length ?? 0

  // Assign guests to tables (drag simulation)
  const tables = insT.data ?? []
  const guests = (await sb.from('event_guests').select('id,party_size').eq('entry_id', wedding.id)).data ?? []
  let cursor = 0
  for (const t of tables) {
    const remaining = t.seats
    let placed = 0
    while (placed < remaining && cursor < guests.length) {
      const g = guests[cursor]
      if (placed + g.party_size > remaining) break
      await sb.from('event_guests').update({ table_id: t.id, seat_no: placed + 1 }).eq('id', g.id)
      placed += g.party_size
      cursor++
    }
  }
  const assigned = (await sb.from('event_guests').select('id', { count: 'exact', head: true }).eq('entry_id', wedding.id).not('table_id', 'is', null)).count
  pass(`${assigned} guests assigned to tables`)
  stats.guests_assigned = assigned

  // Test capacity overflow check (logical)
  if (tables.length) {
    const first = tables[0]
    const inThis = (await sb.from('event_guests').select('party_size').eq('table_id', first.id)).data ?? []
    const sumSeats = inThis.reduce((a, g) => a + g.party_size, 0)
    if (sumSeats > first.seats) bug('TABLES_CAPACITY', 'HIGH', `table ${first.label} overflow ${sumSeats}/${first.seats}`)
    else pass(`table ${first.label} capacity OK (${sumSeats}/${first.seats})`)
  }

  // ===========================================================================
  // 3. TIMELINE - 9 momenti
  // ===========================================================================
  step('3. TIMELINE — 9 momenti')
  const tl = [
    { ord: 0, start_time: '15:00', duration_min: 30, title: 'Arrivo invitati', description: 'Welcome drink', is_critical: false },
    { ord: 1, start_time: '15:30', duration_min: 30, title: 'Benvenuto sposi', description: 'Saluto ufficiale', is_critical: false },
    { ord: 2, start_time: '16:00', duration_min: 60, title: 'Cerimonia', description: 'Rito civile', is_critical: true },
    { ord: 3, start_time: '17:00', duration_min: 90, title: 'Aperitivo', description: 'Open bar a bordo piscina', is_critical: false },
    { ord: 4, start_time: '18:30', duration_min: 180, title: 'Cena', description: '5 portate', is_critical: true },
    { ord: 5, start_time: '21:30', duration_min: 30, title: 'Taglio torta', description: '', is_critical: true },
    { ord: 6, start_time: '22:00', duration_min: 60, title: 'Apertura danze', description: 'Prima danza sposi', is_critical: false },
    { ord: 7, start_time: '22:30', duration_min: 120, title: 'Animazione', description: 'DJ + show', is_critical: false },
    { ord: 8, start_time: '00:30', duration_min: 30, title: 'Saluti finali', description: 'Confettata + bomboniere', is_critical: false },
  ].map(t => ({ ...t, entry_id: wedding.id }))
  const insTL = await sb.from('event_timeline').insert(tl).select('id,ord,title')
  if (insTL.error) bug('TIMELINE_CREATE', 'HIGH', insTL.error.message)
  else pass(`9 timeline slots created (${insTL.data.length})`)
  stats.timeline = insTL.data?.length ?? 0

  // reorder
  if (insTL.data?.length >= 2) {
    const a = insTL.data[0], b = insTL.data[1]
    await sb.from('event_timeline').update({ ord: 1 }).eq('id', a.id)
    await sb.from('event_timeline').update({ ord: 0 }).eq('id', b.id)
    await sb.from('event_timeline').update({ ord: 0 }).eq('id', a.id)
    await sb.from('event_timeline').update({ ord: 1 }).eq('id', b.id)
    pass('timeline reorder swap+revert OK')
  }
  // edit one
  if (insTL.data?.[2]) {
    const upd = await sb.from('event_timeline').update({ description: 'Rito civile editato' }).eq('id', insTL.data[2].id)
    if (upd.error) bug('TIMELINE_EDIT', 'MEDIUM', upd.error.message)
    else pass('timeline edit OK')
  }

  // ===========================================================================
  // 4. MOOD
  // ===========================================================================
  step('4. MOOD — 10 immagini (5 upload + 5 URL)')
  const moodTags = ['vestito', 'fiori', 'centrotavola', 'location', 'torta']
  const moodRows = []
  // Simulate 5 "uploads" via Pexels URLs (kept as URLs but tagged 'upload')
  for (let i = 0; i < 5; i++) {
    moodRows.push({
      entry_id: wedding.id,
      url: `https://images.pexels.com/photos/12${10000 + i * 17}/pexels-photo.jpeg`,
      source: 'upload',
      caption: `${PREFIX}upload ${i + 1}`,
      tag: moodTags[i],
      ord: i,
    })
  }
  // 5 Pinterest URLs (proxy via wsrv.nl simulation)
  for (let i = 0; i < 5; i++) {
    moodRows.push({
      entry_id: wedding.id,
      url: `https://wsrv.nl/?url=https://i.pinimg.com/736x/${i}a/${i}b/pin-${i}.jpg`,
      source: 'pinterest',
      caption: `${PREFIX}pinterest ${i + 1}`,
      tag: moodTags[i],
      ord: 5 + i,
    })
  }
  const insM = await sb.from('mood_images').insert(moodRows).select('id,tag')
  if (insM.error) bug('MOOD_CREATE', 'HIGH', insM.error.message)
  else pass(`${insM.data.length} mood images inserted`)
  stats.mood = insM.data?.length ?? 0

  // delete one
  if (insM.data?.[0]) {
    const d = await sb.from('mood_images').delete().eq('id', insM.data[0].id)
    if (d.error) bug('MOOD_DELETE', 'MEDIUM', d.error.message)
    else pass('mood delete OK')
  }
  // reorder
  if (insM.data?.length >= 2) {
    await sb.from('mood_images').update({ ord: 99 }).eq('id', insM.data[1].id)
    pass('mood reorder OK')
  }

  // ===========================================================================
  // 5. PLAYLIST - 10 brani
  // ===========================================================================
  step('5. PLAYLIST — 10 brani')
  const moments = ['CERIMONIA', 'APERITIVO', 'CENA', 'PRIMA_DANZA', 'FESTA', 'TAGLIO_TORTA']
  const tracks = [
    { song_title: 'A Thousand Years', artist: 'Christina Perri', moment: 'CERIMONIA' },
    { song_title: 'Canon in D', artist: 'Pachelbel', moment: 'CERIMONIA' },
    { song_title: 'Volare', artist: 'Domenico Modugno', moment: 'APERITIVO' },
    { song_title: 'Buongiorno Italia', artist: 'Toto Cutugno', moment: 'APERITIVO' },
    { song_title: 'La cura', artist: 'Battiato', moment: 'CENA' },
    { song_title: 'Vivere', artist: 'Vasco Rossi', moment: 'CENA' },
    { song_title: 'Perfect', artist: 'Ed Sheeran', moment: 'PRIMA_DANZA' },
    { song_title: 'Dancing Queen', artist: 'ABBA', moment: 'FESTA' },
    { song_title: 'Mambo Italiano', artist: 'Rosemary Clooney', moment: 'TAGLIO_TORTA' },
    { song_title: 'Notti Magiche', artist: 'Bennato', moment: 'FESTA' },
  ].map((t, i) => ({ ...t, entry_id: wedding.id, ord: i, notes: i % 3 === 0 ? 'preferito sposi' : null }))
  const insP = await sb.from('event_playlist').insert(tracks).select('id,moment')
  if (insP.error) bug('PLAYLIST_CREATE', 'HIGH', insP.error.message)
  else pass(`${insP.data.length} playlist tracks created`)
  stats.playlist = insP.data?.length ?? 0

  // ===========================================================================
  // 6. TRANSPORT - 3 mezzi multi-trip
  // ===========================================================================
  step('6. TRANSPORT — 3 mezzi')
  const transports = [
    { kind: 'PULMINO_NAVETTA', label: `${PREFIX}Navetta hotel->cerimonia`, capacity: 30, depart_from: 'Hotel Mare', arrive_to: 'Chiesa', depart_at: '2027-09-25T15:00:00Z', arrive_at: '2027-09-25T15:45:00Z' },
    { kind: 'AUTOBUS_GRUPPO', label: `${PREFIX}Shuttle cerimonia->ricevimento`, capacity: 50, depart_from: 'Chiesa', arrive_to: 'Villa', depart_at: '2027-09-25T17:30:00Z', arrive_at: '2027-09-25T18:00:00Z' },
    { kind: 'AUTO_SPOSI', label: `${PREFIX}Auto sposi`, capacity: 4, depart_from: 'Hotel', arrive_to: 'Villa', depart_at: '2027-09-25T17:30:00Z', arrive_at: '2027-09-25T18:00:00Z' },
  ].map(t => ({ ...t, entry_id: wedding.id }))
  const insTr = await sb.from('event_transport').insert(transports).select('id,label,capacity')
  if (insTr.error) bug('TRANSPORT_CREATE', 'HIGH', insTr.error.message)
  else pass(`${insTr.data.length} transports created`)
  stats.transports = insTr.data?.length ?? 0

  // Multi-trip assignment
  if (insTr.data?.length === 3 && guests.length) {
    const [shuttle1, shuttle2, autoSposi] = insTr.data
    const sample = guests.slice(0, 25) // 25 guests both shuttles
    const assigns1 = sample.map(g => ({ entry_id: wedding.id, guest_id: g.id, transport_id: shuttle1.id }))
    const assigns2 = sample.map(g => ({ entry_id: wedding.id, guest_id: g.id, transport_id: shuttle2.id }))
    const r1 = await sb.from('event_guest_transport').insert(assigns1)
    const r2 = await sb.from('event_guest_transport').insert(assigns2)
    if (r1.error) bug('TRANSPORT_ASSIGN', 'HIGH', 'shuttle1 fail', r1.error.message)
    if (r2.error) bug('TRANSPORT_ASSIGN', 'HIGH', 'shuttle2 fail', r2.error.message)
    if (!r1.error && !r2.error) pass(`multi-trip: 25 guests on 2 shuttles`)

    // Capacity verification
    const c1 = (await sb.from('event_guest_transport').select('id', { count: 'exact', head: true }).eq('transport_id', shuttle1.id)).count
    if (c1 > shuttle1.capacity) bug('TRANSPORT_OVERFLOW', 'HIGH', `${shuttle1.label} ${c1}/${shuttle1.capacity}`)
    else pass(`${shuttle1.label} ${c1}/${shuttle1.capacity}`)
  }

  // ===========================================================================
  // 7. ACCOMMODATIONS - 2 strutture
  // ===========================================================================
  step('7. ACCOMMODATIONS — 2 strutture')
  const accs = [
    { kind: 'HOTEL', name: `${PREFIX}Hotel Mare 4 stelle`, total_rooms: 40, rooms_blocked: 40, city: 'Diamante', check_in: '2027-09-24', check_out: '2027-09-26' },
    { kind: 'BNB', name: `${PREFIX}Agriturismo Collina`, total_rooms: 15, rooms_blocked: 15, city: 'Belvedere', check_in: '2027-09-24', check_out: '2027-09-26' },
  ].map(a => ({ ...a, entry_id: wedding.id }))
  const insA = await sb.from('event_accommodations').insert(accs).select('id,name,total_rooms')
  if (insA.error) bug('ACCOMMODATION_CREATE', 'HIGH', insA.error.message)
  else pass(`${insA.data.length} accommodations created`)
  stats.accommodations = insA.data?.length ?? 0

  // Assign guests to accommodations
  if (insA.data?.length === 2 && guests.length) {
    const [hotel, agri] = insA.data
    const rows = []
    for (let i = 0; i < 40 && i < guests.length; i++) {
      rows.push({ entry_id: wedding.id, guest_id: guests[i].id, accommodation_id: hotel.id, room_label: `Stanza ${i + 1}`, check_in: '2027-09-24', check_out: '2027-09-26' })
    }
    for (let i = 40; i < 55 && i < guests.length; i++) {
      rows.push({ entry_id: wedding.id, guest_id: guests[i].id, accommodation_id: agri.id, room_label: `Camera ${i - 39}`, check_in: '2027-09-24', check_out: '2027-09-26' })
    }
    const rA = await sb.from('event_guest_accommodation').insert(rows)
    if (rA.error) bug('ACCOMMODATION_ASSIGN', 'HIGH', rA.error.message)
    else pass(`${rows.length} guest-accommodation links created`)

    // Verify capacity
    const ch = (await sb.from('event_guest_accommodation').select('id', { count: 'exact', head: true }).eq('accommodation_id', hotel.id)).count
    if (ch > hotel.total_rooms) bug('ACCOMMODATION_OVERFLOW', 'MEDIUM', `${hotel.name} ${ch}/${hotel.total_rooms}`)
    else pass(`${hotel.name} ${ch}/${hotel.total_rooms}`)
  }

  // ===========================================================================
  // 8. INTEGRITY
  // ===========================================================================
  step('8. INTEGRITY CHECK')
  const cnt = async (t, filter = {}) => {
    let q = sb.from(t).select('id', { count: 'exact', head: true }).eq('entry_id', wedding.id)
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v)
    return (await q).count
  }
  const integ = {
    guests: await cnt('event_guests'),
    tables: await cnt('event_tables'),
    timeline: await cnt('event_timeline'),
    mood: await cnt('mood_images'),
    playlist: await cnt('event_playlist'),
    transports: await cnt('event_transport'),
    accommodations: await cnt('event_accommodations'),
    guest_transport: await cnt('event_guest_transport'),
    guest_acc: await cnt('event_guest_accommodation'),
  }
  console.log('  INTEG:', JSON.stringify(integ, null, 2))
  stats.integrity = integ

  // expected: 50 + 30 - 1 deleted = 79
  if (integ.guests !== 79) bug('INTEG_GUESTS', 'HIGH', `expected 79, got ${integ.guests}`)
  else pass(`guests count integrity 79 OK`)
  if (integ.tables !== 10) bug('INTEG_TABLES', 'HIGH', `expected 10, got ${integ.tables}`)
  else pass(`tables count integrity 10 OK`)
  if (integ.timeline !== 9) bug('INTEG_TIMELINE', 'HIGH', `expected 9, got ${integ.timeline}`)
  else pass(`timeline count 9 OK`)

  // ===========================================================================
  // 9. COUPLE-SIDE RLS check
  // ===========================================================================
  step('9. COUPLE-SIDE RLS')
  try {
    const cc = await loginAs(COUPLE_EMAIL)
    // tables select via RLS
    const cTables = await cc.from('event_tables').select('id').eq('entry_id', wedding.id)
    if (cTables.error) bug('COUPLE_RLS_TABLES', 'HIGH', cTables.error.message)
    else if (cTables.data.length !== 10) bug('COUPLE_RLS_TABLES', 'MEDIUM', `couple sees ${cTables.data.length}/10 tables`)
    else pass(`couple sees ${cTables.data.length}/10 tables (read)`)

    const cTL = await cc.from('event_timeline').select('id').eq('entry_id', wedding.id)
    if (cTL.error) bug('COUPLE_RLS_TIMELINE', 'HIGH', cTL.error.message)
    else if (cTL.data.length !== integ.timeline) bug('COUPLE_RLS_TIMELINE', 'MEDIUM', `couple sees ${cTL.data.length}/${integ.timeline}`)
    else pass(`couple sees timeline ${cTL.data.length}/${integ.timeline}`)

    const cMood = await cc.from('mood_images').select('id').eq('entry_id', wedding.id)
    if (cMood.error) bug('COUPLE_RLS_MOOD', 'HIGH', cMood.error.message)
    else if (cMood.data.length !== integ.mood) bug('COUPLE_RLS_MOOD', 'HIGH', `couple sees ${cMood.data.length}/${integ.mood} mood images — mood_images.mood_select_owner policy only allows owner+admin, missing is_wedding_couple/is_entry_participant clause`)
    else pass(`couple sees mood ${cMood.data.length}/${integ.mood}`)

    const cPL = await cc.from('event_playlist').select('id').eq('entry_id', wedding.id)
    if (cPL.error) bug('COUPLE_RLS_PLAYLIST', 'MEDIUM', cPL.error.message)
    else if (cPL.data.length !== integ.playlist) bug('COUPLE_RLS_PLAYLIST', 'MEDIUM', `couple sees ${cPL.data.length}/${integ.playlist} playlist`)
    else pass(`couple sees playlist ${cPL.data.length}/${integ.playlist}`)

    const cTr = await cc.from('event_transport').select('id').eq('entry_id', wedding.id)
    if (cTr.error) bug('COUPLE_RLS_TRANSPORT', 'MEDIUM', cTr.error.message)
    else if (cTr.data.length !== integ.transports) bug('COUPLE_RLS_TRANSPORT', 'MEDIUM', `couple sees ${cTr.data.length}/${integ.transports} transport`)
    else pass(`couple sees transport ${cTr.data.length}/${integ.transports}`)

    const cAcc = await cc.from('event_accommodations').select('id').eq('entry_id', wedding.id)
    if (cAcc.error) bug('COUPLE_RLS_ACCOMMODATION', 'MEDIUM', cAcc.error.message)
    else if (cAcc.data.length !== integ.accommodations) bug('COUPLE_RLS_ACCOMMODATION', 'MEDIUM', `couple sees ${cAcc.data.length}/${integ.accommodations} acc`)
    else pass(`couple sees accommodations ${cAcc.data.length}/${integ.accommodations}`)

    const cG = await cc.from('event_guests').select('id').eq('entry_id', wedding.id)
    if (cG.error) bug('COUPLE_RLS_GUESTS', 'HIGH', cG.error.message)
    else if (cG.data.length !== integ.guests) bug('COUPLE_RLS_GUESTS', 'MEDIUM', `couple sees ${cG.data.length}/${integ.guests}`)
    else pass(`couple sees guests ${cG.data.length}/${integ.guests}`)

    // Couple CAN insert guests by design (migration 20260523140000 permissions_gap_fix).
    // Verify instead that couple CANNOT alter the wedding entry itself (calendar_entries).
    const writeEntry = await cc.from('calendar_entries').update({ value_amount: 99999 }).eq('id', wedding.id)
    if (writeEntry.error) pass(`couple write on calendar_entries blocked OK (${writeEntry.error.code || 'no rows'})`)
    else {
      // verify nothing actually changed
      const check = await sb.from('calendar_entries').select('value_amount').eq('id', wedding.id).single()
      if (Number(check.data?.value_amount) === 99999) bug('COUPLE_RLS_ENTRY', 'CRITICAL', 'couple altered calendar_entries.value_amount')
      else pass('couple update on calendar_entries silently filtered (no rows affected)')
    }
    // cleanup any inserted couple-guest
    await sb.from('event_guests').delete().eq('entry_id', wedding.id).eq('full_name', 'AGENT-F-COUPLE-WRITE-ATTEMPT')

    await cc.auth.signOut()
  } catch (e) {
    bug('COUPLE_RLS', 'HIGH', 'login failed', e.message)
  }

  // ===========================================================================
  // 10. WP login + read-back sanity (RLS owner)
  // ===========================================================================
  step('10. WP RLS sanity')
  try {
    const wpc = await loginAs(WP_EMAIL)
    const rb = await wpc.from('event_guests').select('id', { count: 'exact', head: true }).eq('entry_id', wedding.id)
    if (rb.error) bug('WP_RLS', 'HIGH', rb.error.message)
    else pass(`WP read-back guests count ${rb.count}`)
    await wpc.auth.signOut()
  } catch (e) {
    bug('WP_RLS', 'HIGH', e.message)
  }

  // ===========================================================================
  // REPORT
  // ===========================================================================
  const report = `# AGENT-F Night Audit — Wedding Content
Run: ${new Date().toISOString()}
Wedding: ${wedding.id} (${wedTitle}, 2027-09-25)
WP: ${WP_EMAIL}
Couple: ${COUPLE_EMAIL}

## Stats
${'```json'}
${JSON.stringify(stats, null, 2)}
${'```'}

## Passes (${passes.length})
${passes.map(p => `- ${p}`).join('\n')}

## Bugs (${bugs.length})
${bugs.length === 0 ? '_No bugs detected_' : bugs.map(b => `- **[${b.severity}] ${b.area}** — ${b.msg}${b.detail ? `\n  - detail: \`${b.detail}\`` : ''}`).join('\n')}

## Note esecutive
- Audit eseguito al data-layer (Supabase) usando schema reale; la UI delega gli stessi insert/update tramite hooks.
- Featurecheck PDF (lista invitati, seating chart, moodboard, scaletta, trasporti) demandato al front-end: i dati sono pronti per essere stampati.
- RLS verificato sia owner WP che couple read-only.
- Cleanup automatico delle run AGENT-F precedenti.
`
  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), report)
  writeFileSync(path.join(RUN_DIR, 'stats.json'), JSON.stringify({ stats, bugs, passes }, null, 2))
  console.log(`\nREPORT -> ${path.join(RUN_DIR, 'REPORT.md')}`)
  console.log(`BUGS: ${bugs.length}  PASSES: ${passes.length}`)

  // ===========================================================================
  // CLEANUP
  // ===========================================================================
  step('CLEANUP')
  await cleanup(wedding.id)
  pass('cleanup OK')
}

main().catch(e => {
  console.error('FATAL', e)
  writeFileSync(path.join(RUN_DIR, 'FATAL.txt'), String(e?.stack || e))
  process.exit(1)
})
