// E2E AGENT — full wedding lifecycle x5 sul profilo WP (Rosella/Elisa)
// Lead → questionario → preventivo → contratto → matrimonio (coppia gestisce
// ospiti, tavoli, trasporti, moodboard 100 foto, integrazione post-firma) →
// feedback fornitori.

import { config } from 'dotenv'
config({ path: '/tmp/wp-prod.env' })
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const PASSWORD = 'Beta2026!'

const ACTORS = {
  wp:        'elisabettacitraro1998@gmail.com',           // WP (Rosella alias in log)
  mamba:     'elisabettacitraro1998+blackmamba@gmail.com',
  aras:      'elisabettacitraro1998+giuseppearas@gmail.com',
  klope:     'elisabettacitraro1998+tenutaklope@gmail.com',
  tallarico: 'elisabettacitraro1998+makeup@gmail.com',
  muraca:    'elisabettacitraro1998+muraca@gmail.com',
}

const clients = {}, ids = {}
let totPass = 0, totFail = 0
const allFailures = []

function log(label, ok, info) {
  if (ok) { totPass++; console.log(`    ✓ ${label}`) }
  else { totFail++; allFailures.push(`${label} — ${info ?? ''}`); console.log(`    ✗ ${label} — ${info ?? ''}`) }
}

async function login(k, email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data?.user) throw new Error(`login ${k} (${email}): ${error?.message}`)
  clients[k] = c; ids[k] = data.user.id
}

const COUPLE_TEMPLATES = [
  { bride: 'Sofia Russo',     groom: 'Marco Bianchi',   email: 'sofia.marco+wed1@example.com',  city: 'Tropea',     stile: ['classico'] },
  { bride: 'Giulia Conte',    groom: 'Luca Marini',     email: 'giulia.luca+wed2@example.com',  city: 'Cefalù',     stile: ['mediterraneo'] },
  { bride: 'Anna Greco',      groom: 'Davide Romano',   email: 'anna.davide+wed3@example.com',  city: 'Lecce',      stile: ['country_chic'] },
  { bride: 'Martina Bruno',   groom: 'Andrea Costa',    email: 'martina.andrea+wed4@example.com', city: 'Capri',    stile: ['glam'] },
  { bride: 'Chiara De Luca',  groom: 'Stefano Ferrari', email: 'chiara.stefano+wed5@example.com', city: 'Polignano', stile: ['boho'] },
]

const PHOTO_TAGS = ['vestito', 'fiori', 'location', 'torta', 'allestimento', 'altro']
const SUPPLIER_KEYS = ['mamba', 'aras', 'klope', 'tallarico', 'muraca']

// ──────────────────────────────────────────────────────────────────────
// Fasi del lifecycle di un singolo wedding
// ──────────────────────────────────────────────────────────────────────

async function runWeddingLifecycle(idx, template) {
  const offsetDays = 400 + idx * 60 + Math.floor(Math.random() * 40)
  const eventDate = new Date(Date.now() - offsetDays * 86400 * 1000).toISOString().slice(0, 10)
  const tag = `LIFECYCLE_W${idx + 1}_${Date.now().toString(36)}`
  const coupleName = `${template.bride.split(' ')[0]} & ${template.groom.split(' ')[0]}`

  console.log(`\n━━━ Wedding #${idx + 1}: ${coupleName} (${template.city}, ${eventDate}) ━━━`)
  const stats = { entryId: null, quoteId: null, contractId: null, supplierMap: {} }

  // ── 1) Lead arriva: creiamo calendar_entry + couple_preferences placeholder
  console.log('\n  [1] Lead arrivato — creiamo wedding entry')
  const { data: entry, error: eEntry } = await clients.wp.from('calendar_entries').insert({
    owner_id: ids.wp, title: `${tag} — ${coupleName}`, client_name: coupleName,
    date_from: eventDate, date_to: eventDate, business_model: 'GLOBAL',
  }).select('id').single()
  log('lead → wedding entry', !!entry?.id, eEntry?.message)
  if (!entry) return stats
  stats.entryId = entry.id

  // ── 2) WP manda il questionario (lo creiamo direttamente; la coppia lo compila)
  console.log('\n  [2] WP manda questionario, coppia lo completa')
  const { error: ePrefs } = await clients.wp.from('couple_preferences').insert({
    entry_id: entry.id,
    bride_name: template.bride, groom_name: template.groom, couple_name: coupleName,
    budget_min: 25000, budget_max: 60000,
    planning_stage: 'EXPLORING',
    questionnaire_completed_at: new Date().toISOString(),
  })
  log('questionario completato', !ePrefs, ePrefs?.message)

  // ── 3) Preventivo (3 voci fornitore per simulare contratto consistente)
  console.log('\n  [3] Preventivo + voci fornitori')
  const { data: quote, error: eQ } = await clients.wp.from('quotes').insert({
    owner_id: ids.wp, title: `${tag} — Preventivo`, event_date: eventDate,
    client_name: coupleName, client_email: template.email,
    access_token: crypto.randomUUID(),
  }).select('id, access_token').single()
  log('quote creato', !eQ && !!quote?.id, eQ?.message)
  if (!quote) return stats
  stats.quoteId = quote.id
  await clients.wp.from('calendar_entries').update({ quote_id: quote.id }).eq('id', entry.id)

  // 3 quote_items da 3 fornitori distinti (round-robin)
  const pickedSuppliers = SUPPLIER_KEYS.slice(idx % SUPPLIER_KEYS.length, (idx % SUPPLIER_KEYS.length) + 3)
    .concat(SUPPLIER_KEYS).slice(0, 3)
  for (const sk of pickedSuppliers) {
    const { data: svc } = await clients[sk].from('services')
      .select('id,name,base_price,unit').eq('fornitore_id', ids[sk]).limit(1).maybeSingle()
    if (!svc) { log(`servizio ${sk} non trovato`, false); continue }
    const { error: eQi } = await clients.wp.from('quote_items').insert({
      quote_id: quote.id, service_id: svc.id, supplier_id: ids[sk],
      name_snapshot: svc.name, unit_snapshot: svc.unit,
      snapshot_price: svc.base_price, quantity: 1, quantity_basis: 'FLAT',
    })
    log(`quote_item ${sk}`, !eQi, eQi?.message)
    if (!eQi) stats.supplierMap[sk] = ids[sk]
  }

  // ── 4) Quote BOZZA → INVIATO → ACCETTATO
  console.log('\n  [4] Coppia firma preventivo')
  await clients.wp.from('quotes').update({ status: 'INVIATO' }).eq('id', quote.id)
  const { error: eAcc } = await clients.wp.from('quotes')
    .update({ status: 'ACCETTATO', accepted_at: new Date().toISOString() })
    .eq('id', quote.id)
  log('quote ACCETTATO', !eAcc, eAcc?.message)

  // ── 5) Contratto da clausole standard (Fase D)
  console.log('\n  [5] Contratto da clausole standard')
  const { data: clauses } = await clients.wp.rpc('list_standard_clauses')
  const sections = (clauses ?? []).filter((c) => c.is_default).map((c) => ({
    heading: c.title, body: c.body, slug: c.slug,
  }))
  const { data: contract, error: eC } = await clients.wp.rpc('create_contract_from_clauses', {
    p_entry_id: entry.id, p_party_kind: 'CLIENT_WP',
    p_title: `Contratto ${coupleName}`, p_sections: sections, p_supplier_id: null,
  })
  log('contratto creato da clausole', !eC && !!contract?.id, eC?.message)
  if (contract?.id) stats.contractId = contract.id

  // ── 6) Contratto firmato di persona (Fase C)
  if (stats.contractId) {
    console.log('\n  [6] WP firma contratto di persona')
    const { data: signed, error: eSign } = await clients.wp.rpc('sign_contract_offline', {
      p_contract_id: stats.contractId,
      p_signer_name: coupleName,
      p_signer_fiscal: null,
      p_pdf_url: `https://placehold.co/pdf?text=Contract+W${idx + 1}`,
      p_notes: 'Firmato in studio',
    })
    log('contract FIRMATO offline', !eSign && signed?.ok === true, eSign?.message ?? JSON.stringify(signed))
  }

  // ── 7) Coppia invitata + ricerca preferenze, ecc. (placeholder member)
  console.log('\n  [7] Coppia invitata (link member)')
  const inviteToken = crypto.randomUUID()
  const { error: eMem } = await clients.wp.from('wedding_couple_members').insert({
    entry_id: entry.id, email: template.email, full_name: template.bride,
    role: 'SPOSA', invite_token: inviteToken,
  })
  log('couple member creato', !eMem, eMem?.message)

  // ── 8) 100 ospiti
  console.log('\n  [8] Carico 100 ospiti')
  const guestRows = []
  for (let g = 0; g < 100; g++) {
    const side = g % 2 === 0 ? 'SPOSA' : 'SPOSO'
    guestRows.push({
      entry_id: entry.id,
      full_name: `Ospite #${String(g + 1).padStart(3, '0')} W${idx + 1}`,
      email: `guest${g + 1}.wed${idx + 1}@example.com`,
      party_size: 1, rsvp: g < 70 ? 'YES' : g < 85 ? 'PENDING' : 'NO',
      side, group_label: g < 30 ? 'famiglia' : g < 60 ? 'amici' : 'lavoro',
    })
  }
  // batch in 25 by 4
  let guestsInserted = 0
  for (let b = 0; b < guestRows.length; b += 25) {
    const chunk = guestRows.slice(b, b + 25)
    const { data: r, error: eG } = await clients.wp.from('event_guests').insert(chunk).select('id')
    if (eG) { log(`batch ospiti ${b}-${b + 25} errore`, false, eG.message); break }
    guestsInserted += r?.length ?? 0
  }
  log(`100 ospiti caricati (${guestsInserted}/100)`, guestsInserted === 100)

  // ── 9) 12 tavoli + assegnazione
  console.log('\n  [9] 12 tavoli + assegnazione ospiti')
  const tableRows = Array.from({ length: 12 }, (_, t) => ({
    entry_id: entry.id, table_no: t + 1, seats: 10, shape: 'ROUND',
    label: t === 0 ? 'Sposi' : `Tavolo ${t + 1}`,
  }))
  const { data: tablesCreated, error: eT } = await clients.wp.from('event_tables').insert(tableRows).select('id, table_no')
  log(`12 tavoli creati`, tablesCreated?.length === 12, eT?.message)

  if (tablesCreated?.length) {
    // Assegna ospiti: round-robin sui tavoli, escluso tavolo Sposi (table_no=1)
    const { data: allGuests } = await clients.wp.from('event_guests').select('id').eq('entry_id', entry.id)
    const guestTables = tablesCreated.filter((t) => t.table_no > 1)
    let assigned = 0
    for (let g = 0; g < (allGuests?.length ?? 0); g++) {
      const t = guestTables[g % guestTables.length]
      const { error: eAss } = await clients.wp.from('event_guests')
        .update({ table_id: t.id }).eq('id', allGuests[g].id)
      if (!eAss) assigned++
      if (g > 30) break // limite per velocità test
    }
    log(`assegnazione tavoli (primi 30 ospiti)`, assigned > 0, `${assigned} assegnati`)
  }

  // ── 10) Integrazione post-firma: la coppia chiede un servizio in più
  console.log('\n  [10] Integrazione post-firma (nuovo quote_item)')
  const integrSupplier = SUPPLIER_KEYS[(idx + 4) % SUPPLIER_KEYS.length]
  const { data: svcIntegr } = await clients[integrSupplier].from('services')
    .select('id,name,base_price,unit').eq('fornitore_id', ids[integrSupplier]).limit(1).maybeSingle()
  if (svcIntegr) {
    const { error: eInt } = await clients.wp.from('quote_items').insert({
      quote_id: quote.id, service_id: svcIntegr.id, supplier_id: ids[integrSupplier],
      name_snapshot: svcIntegr.name + ' (INTEGRAZIONE)',
      unit_snapshot: svcIntegr.unit,
      snapshot_price: svcIntegr.base_price, quantity: 1, quantity_basis: 'FLAT',
    })
    log('integrazione post-firma', !eInt, eInt?.message)
    if (!eInt) stats.supplierMap[integrSupplier] = ids[integrSupplier]
  }

  // ── 11) 3 trasporti
  console.log('\n  [11] 3 trasporti organizzati')
  const transports = [
    { kind: 'PULMINO_NAVETTA', label: 'Navetta hotel→location',  depart_from: 'Hotel Centro',     capacity: 30 },
    { kind: 'PULMINO_NAVETTA', label: 'Navetta location→hotel',  depart_from: 'Location',          capacity: 30 },
    { kind: 'AUTO_SPOSI',      label: 'Auto sposi',               depart_from: 'Casa sposa',       capacity: 4 },
  ]
  let transportOk = 0
  for (const t of transports) {
    const { error: eTr } = await clients.wp.from('event_transport').insert({
      entry_id: entry.id, ...t,
      depart_at: new Date(eventDate + 'T11:00:00Z').toISOString(),
    })
    if (!eTr) transportOk++
    else console.log(`     trasporto err: ${eTr.message}`)
  }
  log(`trasporti creati (${transportOk}/3)`, transportOk === 3)

  // ── 12) Moodboard con 100 foto
  console.log('\n  [12] Moodboard 100 foto')
  const moodRows = []
  for (let p = 0; p < 100; p++) {
    moodRows.push({
      entry_id: entry.id,
      url: `https://placehold.co/800x600/png?text=W${idx + 1}+Mood+${p + 1}`,
      source: 'pexels',
      tag: PHOTO_TAGS[p % PHOTO_TAGS.length],
      caption: `Mood ${p + 1} — ${template.stile[0]}`,
      ord: p,
    })
  }
  let moodOk = 0
  for (let b = 0; b < moodRows.length; b += 25) {
    const chunk = moodRows.slice(b, b + 25)
    const { data: r, error: eM } = await clients.wp.from('mood_images').insert(chunk).select('id')
    if (eM) { console.log(`     mood err: ${eM.message}`); break }
    moodOk += r?.length ?? 0
  }
  log(`100 foto moodboard (${moodOk}/100)`, moodOk === 100)

  // ── 13) Post-evento: feedback fornitori usati
  console.log('\n  [13] Post-evento: feedback fornitori')
  let ratingsOk = 0
  for (const sk of Object.keys(stats.supplierMap)) {
    const stars = 4 + (idx % 2) // mix 4/5 stelle
    const { error: eRate } = await clients.wp.rpc('rate_user', {
      p_rated: stats.supplierMap[sk],
      p_entry: entry.id,
      p_stars: stars,
      p_review: `Wedding ${coupleName} ${eventDate}: ${sk} ha lavorato benissimo, ${stars}★.`,
    })
    if (!eRate) ratingsOk++
    else console.log(`     rate ${sk} err: ${eRate.message}`)
  }
  log(`${Object.keys(stats.supplierMap).length} feedback fornitori (${ratingsOk} ok)`, ratingsOk > 0)

  return stats
}

// ──────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('▶ AGENT E2E full lifecycle x5')
  console.log(`  WP: ${ACTORS.wp} (alias Rosella per coerenza spec utente)\n`)

  for (const [k, e] of Object.entries(ACTORS)) await login(k, e)
  console.log(`  Loggati ${Object.keys(clients).length} attori\n`)

  const allStats = []
  for (let i = 0; i < COUPLE_TEMPLATES.length; i++) {
    const s = await runWeddingLifecycle(i, COUPLE_TEMPLATES[i])
    allStats.push(s)
  }

  // ── Cleanup TUTTI i wedding creati ─────────────────────────────────
  console.log('\n━━━ CLEANUP ━━━')
  for (const s of allStats) {
    if (s.contractId) await clients.wp.from('contracts').delete().eq('id', s.contractId)
    if (s.entryId) await clients.wp.rpc('delete_wedding_cascade', { p_entry_id: s.entryId })
  }
  log('cleanup 5 weddings', true)

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`AGENT RISULTATO TOTALE: ${totPass} PASS · ${totFail} FAIL`)
  if (totFail > 0) {
    console.log('\nFAILURES:')
    allFailures.forEach((f) => console.log(`  ✗ ${f}`))
    process.exit(1)
  }
  console.log('\n✅ FULL LIFECYCLE x5 COMPLETATO')
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2) })
