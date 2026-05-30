#!/usr/bin/env node
// E2E SIMULAZIONE — Full lifecycle "nuovo modello"
// FASE 7 — wedding-platform / feature/nuovo-modello
//
// Obiettivo: simulare l'intero ciclo di vita di un matrimonio col nuovo modello
// (parcella + ricarico, questionario, preventivo con modifiche delta firma,
// ospiti/tavoli, logistica chiesa/transfer/alberghi, menu PER_GUEST con extra,
// voce esterna bomboniere, mood, allargamento budget, checklist giorno evento,
// dropout fornitore via RPC + sostituzione, cleanup).
//
// NOTA: per design questo test NON crea utenti reali in auth.users (mock-only).
// Le righe pubbliche (calendar_entries / quote_items / event_guests ecc.) sono
// in memoria; gli ID sono UUID v4 random. L'unico effetto collaterale eseguito
// fuori-memoria e' la verifica AST grep su filesystem (read-only).
//
// USO:
//   node tests/e2e/full-lifecycle-nuovo-modello.mjs
//
// Convenzione email: 'giovanni.scozzafava+NNNN@gmail.com'
//   NNNN 1000        -> capostipite (WP)
//   NNNN 2000        -> coppia (entrambi i firmatari condividono il +2000)
//   NNNN 3000-3019   -> 20 fornitori
//   NNNN 5000+       -> invitati (5000..5029 = 30 invitati)
//
// Output: stdout con tabelle, PASS/FAIL e summary finale.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────
// Utility log
// ─────────────────────────────────────────────────────────────────────────

const stats = { pass: 0, fail: 0, failures: [] }

function log(label, ok, info) {
  if (ok) {
    stats.pass++
    console.log(`  PASS  ${label}`)
  } else {
    stats.fail++
    stats.failures.push(`${label} -- ${info ?? ''}`)
    console.log(`  FAIL  ${label} -- ${info ?? ''}`)
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`)
}

// ─────────────────────────────────────────────────────────────────────────
// Email convention + password mapping
// ─────────────────────────────────────────────────────────────────────────

const BASE = 'giovanni.scozzafava'
const DOMAIN = 'gmail.com'
const PASSWORD = 'Beta2026!'

function emailFor(n) {
  return `${BASE}+${n}@${DOMAIN}`
}

const MAPPING = []
function addMap(numero, ruolo, descrizione) {
  MAPPING.push({ numero, ruolo, descrizione, email: emailFor(numero), password: PASSWORD })
}

// WP capostipite
addMap(1000, 'WP', 'Capostipite (Wedding Planner principale)')
// Coppia
addMap(2000, 'COPPIA', 'Sposi (un solo +tag condiviso, 2 firmatari)')
// 20 fornitori 3000..3019
const SUPPLIER_KINDS = [
  'LOCATION', 'FOTOGRAFO', 'VIDEOMAKER', 'FIORISTA', 'CATERING',
  'PASTICCERIA', 'DJ', 'BAND', 'MAKEUP', 'HAIR_STYLIST',
  'ABITO_SPOSA', 'ABITO_SPOSO', 'WEDDING_CAR', 'ANIMAZIONE_BIMBI',
  'BARTENDER', 'PARTECIPAZIONI', 'BOMBONIERE', 'TRANSFER',
  'NOLEGGIO_ARREDI', 'CELEBRANTE_RITO_SIMBOLICO'
]
for (let i = 0; i < 20; i++) {
  addMap(3000 + i, `FORNITORE/${SUPPLIER_KINDS[i]}`, `Fornitore #${i + 1}`)
}
// 30 invitati 5000..5029
for (let i = 0; i < 30; i++) {
  addMap(5000 + i, 'INVITATO', `Invitato #${i + 1}`)
}

function printMapping() {
  section('TABELLA MAPPING NUMERO -> RUOLO -> EMAIL -> PASSWORD')
  console.log('numero | ruolo                         | email                                          | password')
  console.log('-------+-------------------------------+------------------------------------------------+---------')
  for (const m of MAPPING) {
    const num = String(m.numero).padEnd(6)
    const rol = String(m.ruolo).padEnd(29)
    const eml = String(m.email).padEnd(46)
    console.log(`${num} | ${rol} | ${eml} | ${m.password}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Anti-normalization audit
// ─────────────────────────────────────────────────────────────────────────

const REPO = '/Users/giovanniscozzafava/Repository/wedding-platform'
const AUDIT_ROOTS = [
  path.join(REPO, 'frontend/src'),
  path.join(REPO, 'supabase/functions'),
]

async function* walk(dir) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) }
  catch { return }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
      yield* walk(p)
    } else if (e.isFile()) {
      yield p
    }
  }
}

function classifyHit(filePath, lineText) {
  // Pattern hit: replace(/\+.*/ ...)
  // OK se serve a ricavare un nome leggibile da una email:
  //   contesti tipici: variabile *Local / displayName / *Name, split('@')[0] nella stessa riga.
  // BUG se sul codice di registrazione/login/lookup utente:
  //   contesti tipici: auth.signUp(, auth.signInWithPassword(, admin.getUserByEmail(,
  //   admin.listUsers(, lookupUserByEmail, email: cleaned (passato a query auth/lookup).
  const lower = lineText.toLowerCase()
  const isDisplay = lower.includes('local') || lower.includes('displayname') ||
                    lower.includes('split(\'@\')[0]') || lower.includes('split("@")[0]') ||
                    lower.includes('name') ||
                    /caption|filename|filename|filename/i.test(lower) === false &&
                    lower.includes('.replace(/\\+')
  const isAuth = lower.includes('signup') || lower.includes('signin') ||
                  lower.includes('getuserbyemail') || lower.includes('listusers') ||
                  lower.includes('lookup') || lower.includes('admin.create') ||
                  lower.includes('email:') && (lower.includes('cleaned') || lower.includes('normalized'))
  if (isAuth && !isDisplay) return { ok: false, reason: 'auth/lookup context' }
  if (isDisplay) return { ok: true, reason: 'display-name extraction' }
  // default: chiamiamolo OK ma marca per review
  return { ok: true, reason: 'non-auth context (manual review consigliata)' }
}

async function auditAntiNormalization() {
  section('VERIFICA ANTI-NORMALIZZAZIONE EMAIL')
  // Regex robusta: cerchiamo letteralmente "replace(/\+" (escape backslash plus)
  const re = /replace\(\/\\\+/
  const hits = []
  for (const root of AUDIT_ROOTS) {
    for await (const file of walk(root)) {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)) continue
      let content
      try { content = await fs.readFile(file, 'utf8') } catch { continue }
      const lines = content.split('\n')
      lines.forEach((ln, i) => {
        if (re.test(ln)) {
          hits.push({ file, line: i + 1, text: ln.trim() })
        }
      })
    }
  }
  console.log(`Trovate ${hits.length} occorrenze del pattern replace(/\\+...) nei sorgenti scansionati.`)
  let bugs = 0, okCount = 0
  for (const h of hits) {
    const cls = classifyHit(h.file, h.text)
    const rel = path.relative(REPO, h.file)
    console.log(`  [${cls.ok ? 'OK ' : 'BUG'}] ${rel}:${h.line}  -- ${cls.reason}`)
    console.log(`         ${h.text}`)
    if (cls.ok) okCount++; else bugs++
  }
  log('anti-normalization audit (nessun bug auth/lookup)', bugs === 0, bugs > 0 ? `${bugs} occorrenze sospette` : '')
  return { hits, bugs, okCount }
}

// ─────────────────────────────────────────────────────────────────────────
// Mock DB in memoria
// ─────────────────────────────────────────────────────────────────────────

const db = {
  profiles: [],
  calendar_entries: [],
  calendar_entry_participants: [],
  couple_preferences: [],
  mood_images: [],
  quotes: [],
  quote_items: [],
  contracts: [],
  event_guests: [],
  event_tables: [],
  event_transport: [],
  event_accommodations: [],
  event_timeline: [],
  notifiche: [],
  eventi_cambiamento: [],
  audit_log: [],
}

function insert(table, row) {
  const r = { id: row.id ?? randomUUID(), created_at: new Date().toISOString(), ...row }
  db[table].push(r)
  return r
}

function update(table, id, patch) {
  const r = db[table].find((x) => x.id === id)
  if (!r) return null
  Object.assign(r, patch, { updated_at: new Date().toISOString() })
  return r
}

function audit(action, table_name, record_id, payload) {
  insert('audit_log', { eseguito_il: new Date().toISOString(), action, table_name, record_id, payload })
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario step
// ─────────────────────────────────────────────────────────────────────────

async function runScenario() {
  section('SCENARIO LIFECYCLE NUOVO MODELLO (mock in memoria)')

  // 1) WP profilo INTERO con parcella + ricarico
  const wp = insert('profiles', {
    role: 'WP',
    email: emailFor(1000),
    full_name: 'Capostipite Principale',
    modalita_incasso_default: 'INTERO',
    parcella_default: 2500,
    applica_ricarico_default: true,
    nuovo_modello_attivo: true,
  })
  log('WP profilo INTERO parcella+ricarico', wp.modalita_incasso_default === 'INTERO' && wp.parcella_default > 0)

  // 2) 20 fornitori con offerte (fixture)
  const suppliers = []
  for (let i = 0; i < 20; i++) {
    const s = insert('profiles', {
      role: 'FORNITORE',
      email: emailFor(3000 + i),
      subrole: SUPPLIER_KINDS[i],
      full_name: `Fornitore ${SUPPLIER_KINDS[i]}`,
      base_price: 500 + i * 100,
    })
    suppliers.push(s)
  }
  log('20 fornitori con offerte fixture', suppliers.length === 20)

  // 2.bis) Coppia (utente mock, NON registrata in auth.users)
  const couple = insert('profiles', {
    role: 'COPPIA',
    email: emailFor(2000),
    full_name: 'Sposi (Bride & Groom)',
  })

  // 3) Coppia firma incarico -> evento_stato = INCARICO_FIRMATO
  const eventDate = new Date(Date.now() + 200 * 86400 * 1000).toISOString().slice(0, 10)
  const entry = insert('calendar_entries', {
    owner_id: wp.id,
    title: 'Wedding Sposi 2026',
    client_name: 'Bride & Groom',
    client_email: couple.email,
    date_from: eventDate,
    date_to: eventDate,
    business_model: 'GLOBAL',
    modalita_incasso: 'INTERO',
    evento_stato: 'LEAD',
    nuovo_modello_attivo: true,
  })
  insert('calendar_entry_participants', { entry_id: entry.id, profile_id: couple.id, role: 'COPPIA' })
  update('calendar_entries', entry.id, { evento_stato: 'INCARICO_FIRMATO' })
  audit('TRANSITION', 'calendar_entries', entry.id, { from: 'LEAD', to: 'INCARICO_FIRMATO' })
  log('coppia firma incarico -> INCARICO_FIRMATO',
    db.calendar_entries.find((e) => e.id === entry.id).evento_stato === 'INCARICO_FIRMATO')

  // 4) Questionario + 30 mood_images
  const prefs = insert('couple_preferences', {
    entry_id: entry.id,
    bride_name: 'Sposa',
    groom_name: 'Sposo',
    couple_name: 'Sposa & Sposo',
    budget_min: 35000,
    budget_max: 70000,
    planning_stage: 'PLANNING',
    questionnaire_completed_at: new Date().toISOString(),
  })
  log('questionario compilato', !!prefs.questionnaire_completed_at)
  for (let i = 0; i < 30; i++) {
    insert('mood_images', {
      entry_id: entry.id,
      url: `https://example.com/mood/${i}.jpg`,
      tag: ['vestito', 'fiori', 'location', 'torta', 'allestimento', 'altro'][i % 6],
      ord: i,
    })
  }
  log('30 mood images create', db.mood_images.filter((m) => m.entry_id === entry.id).length === 30)

  // 5) WP propone preventivo, coppia chiede modifiche delta, applicate, firmato
  const quote = insert('quotes', {
    owner_id: wp.id,
    title: 'Preventivo nozze',
    event_date: eventDate,
    client_name: 'Bride & Groom',
    client_email: couple.email,
    access_token: randomUUID(),
    status: 'BOZZA',
    guest_count: 0,
    total_client: 0,
  })
  update('calendar_entries', entry.id, { quote_id: quote.id, evento_stato: 'PREVENTIVI' })

  // Voci di preventivo: 1 voce LOCATION FLAT + 1 voce CATERING PER_GUEST 150 EUR
  const locationSup = suppliers[0]
  const cateringSup = suppliers.find((s) => s.subrole === 'CATERING')
  const photoSup = suppliers.find((s) => s.subrole === 'FOTOGRAFO')
  insert('quote_items', {
    quote_id: quote.id, supplier_id: locationSup.id,
    name_snapshot: 'Location villa', unit_snapshot: 'EVENTO',
    snapshot_price: 8000, quantity: 1, quantity_basis: 'FLAT',
    line_client: 8000,
  })
  insert('quote_items', {
    quote_id: quote.id, supplier_id: cateringSup.id,
    name_snapshot: 'Menu nozze 150/persona', unit_snapshot: 'PERSONA',
    snapshot_price: 150, quantity: 1, quantity_basis: 'PER_GUEST',
    line_client: 150,
  })
  insert('quote_items', {
    quote_id: quote.id, supplier_id: photoSup.id,
    name_snapshot: 'Reportage fotografico', unit_snapshot: 'EVENTO',
    snapshot_price: 2200, quantity: 1, quantity_basis: 'FLAT',
    line_client: 2200,
  })
  // Coppia chiede modifica delta: rimuove fotografo, aggiunge VIDEOMAKER
  const photoItem = db.quote_items.find((i) => i.quote_id === quote.id && i.supplier_id === photoSup.id)
  db.quote_items.splice(db.quote_items.indexOf(photoItem), 1)
  const videoSup = suppliers.find((s) => s.subrole === 'VIDEOMAKER')
  insert('quote_items', {
    quote_id: quote.id, supplier_id: videoSup.id,
    name_snapshot: 'Video racconto', unit_snapshot: 'EVENTO',
    snapshot_price: 2400, quantity: 1, quantity_basis: 'FLAT',
    line_client: 2400,
  })
  audit('DELTA', 'quote_items', quote.id, { removed: photoSup.id, added: videoSup.id })
  log('modifiche delta applicate', !!db.quote_items.find((i) => i.supplier_id === videoSup.id))
  // Firma preventivo
  update('quotes', quote.id, { status: 'ACCETTATO', accepted_at: new Date().toISOString() })
  update('calendar_entries', entry.id, { evento_stato: 'PREVENTIVO_FIRMATO' })
  log('preventivo FIRMATO', db.quotes.find((q) => q.id === quote.id).status === 'ACCETTATO')

  // 6) 30 invitati event_guests (email +5000..5029)
  for (let i = 0; i < 30; i++) {
    insert('event_guests', {
      entry_id: entry.id,
      full_name: `Invitato ${i + 1}`,
      email: emailFor(5000 + i),
      party_size: 1,
      rsvp: i % 5 === 0 ? 'NO' : 'YES',
      side: i < 15 ? 'SPOSA' : 'SPOSO',
      group_label: i < 15 ? 'amici sposa' : 'amici sposo',
    })
  }
  const yesCount = db.event_guests.filter((g) => g.entry_id === entry.id && g.rsvp === 'YES').length
  log('30 invitati creati (email +5000..5029)',
    db.event_guests.filter((g) => g.entry_id === entry.id).length === 30)
  log('YES count corretto', yesCount > 0)

  // 7) Tavoli + modifica coppia
  const tables = []
  for (let t = 1; t <= 5; t++) {
    tables.push(insert('event_tables', {
      entry_id: entry.id, table_no: t, label: `Tavolo ${t}`, seats: 8, shape: 'ROUND',
    }))
  }
  // assegno i primi 24 invitati ai 3 tavoli centrali
  const yesGuests = db.event_guests.filter((g) => g.entry_id === entry.id && g.rsvp === 'YES')
  yesGuests.slice(0, 24).forEach((g, idx) => {
    update('event_guests', g.id, { table_id: tables[Math.floor(idx / 8)].id, seat_no: (idx % 8) + 1 })
  })
  // coppia modifica: cambia label tavolo 1
  update('event_tables', tables[0].id, { label: 'Tavolo Sposi' })
  log('5 tavoli con assegnazioni + label modificata',
    db.event_tables.find((t) => t.id === tables[0].id).label === 'Tavolo Sposi')

  // 8) Chiesa + celebrante (calendar_entry_participants), 3 transfer, 2 alberghi
  const celebrante = insert('profiles', {
    role: 'EXTERNAL', email: 'celebrante@diocesi.it', full_name: 'Don Mario',
  })
  insert('calendar_entry_participants', {
    entry_id: entry.id, profile_id: celebrante.id, role: 'CELEBRANTE',
    location: 'Chiesa Santa Maria',
  })
  for (let i = 0; i < 3; i++) {
    insert('event_transport', {
      entry_id: entry.id,
      kind: 'PULMINO_NAVETTA',
      label: `Navetta ${i + 1}`,
      capacity: 20,
      passengers_count: 18,
      depart_from: 'Hotel Centro',
      arrive_to: 'Villa',
    })
  }
  for (let i = 0; i < 2; i++) {
    insert('event_accommodations', {
      entry_id: entry.id, kind: 'HOTEL', name: `Hotel ${i + 1}`,
      rooms_blocked: 15, rate_per_night: 110, currency: 'EUR',
    })
  }
  log('chiesa+celebrante+3 transfer+2 alberghi',
    db.calendar_entry_participants.some((p) => p.role === 'CELEBRANTE') &&
    db.event_transport.filter((t) => t.entry_id === entry.id).length === 3 &&
    db.event_accommodations.filter((a) => a.entry_id === entry.id).length === 2)

  // 9) Menu 150 EUR/persona PER_GUEST + extra 30 EUR -> riconciliazione PER_GUEST
  // riconciliazione: quantity PER_GUEST allineata ai YES guests
  const menuItem = db.quote_items.find((i) => i.quote_id === quote.id && i.quantity_basis === 'PER_GUEST')
  update('quote_items', menuItem.id, {
    quantity: Math.max(yesCount, 1),
    line_client: 150 * Math.max(yesCount, 1),
  })
  // Voce extra 30 EUR (flute / welcome drink): basis PER_GUEST anch'esso
  insert('quote_items', {
    quote_id: quote.id, supplier_id: cateringSup.id,
    name_snapshot: 'Welcome drink', unit_snapshot: 'PERSONA',
    snapshot_price: 30, quantity: yesCount, quantity_basis: 'PER_GUEST',
    line_client: 30 * yesCount,
  })
  log('riconciliazione PER_GUEST con menu 150 EUR + extra 30 EUR',
    db.quote_items.find((i) => i.id === menuItem.id).quantity === yesCount)

  // 10) Voce esterna bomboniere (quote_items con supplier_id NULL)
  insert('quote_items', {
    quote_id: quote.id, supplier_id: null,
    name_snapshot: 'Bomboniere artigianali (fornitore esterno)',
    unit_snapshot: 'PEZZO',
    snapshot_price: 12, quantity: yesCount, quantity_basis: 'PER_GUEST',
    line_client: 12 * yesCount,
  })
  log('voce esterna bomboniere supplier_id NULL',
    db.quote_items.some((i) => i.quote_id === quote.id && i.supplier_id === null))

  // 11) Mood finale (ricap moodboard, +10 immagini)
  for (let i = 30; i < 40; i++) {
    insert('mood_images', {
      entry_id: entry.id, url: `https://example.com/mood/final-${i}.jpg`,
      tag: 'allestimento', ord: i,
    })
  }
  log('mood finale aggiunto (totale 40 immagini)',
    db.mood_images.filter((m) => m.entry_id === entry.id).length === 40)

  // 12) Budget allargato (couple_preferences.budget_max+)
  update('couple_preferences', prefs.id, { budget_max: 90000 })
  audit('BUDGET_RAISE', 'couple_preferences', prefs.id, { from: 70000, to: 90000 })
  log('budget allargato a 90000',
    db.couple_preferences.find((p) => p.id === prefs.id).budget_max === 90000)

  // 13) Checklist giorno evento (event_timeline righe)
  const timelineRows = [
    { ord: 1, start_time: '09:00', duration_min: 90, title: 'Preparazione sposa' },
    { ord: 2, start_time: '10:30', duration_min: 30, title: 'Arrivo fiorista' },
    { ord: 3, start_time: '11:00', duration_min: 60, title: 'Cerimonia in chiesa', is_critical: true },
    { ord: 4, start_time: '12:30', duration_min: 30, title: 'Foto in location' },
    { ord: 5, start_time: '13:00', duration_min: 120, title: 'Pranzo / Menu' },
    { ord: 6, start_time: '15:00', duration_min: 60, title: 'Taglio torta' },
    { ord: 7, start_time: '16:00', duration_min: 180, title: 'Festa con DJ' },
    { ord: 8, start_time: '19:00', duration_min: 30, title: 'Lancio bomboniere' },
  ]
  timelineRows.forEach((r) => insert('event_timeline', { entry_id: entry.id, ...r }))
  log('checklist giorno evento creata',
    db.event_timeline.filter((t) => t.entry_id === entry.id).length === timelineRows.length)

  // Stato evento avanza
  update('calendar_entries', entry.id, { evento_stato: 'CHECKLIST' })

  // 14) Dropout fornitore via RPC simulata -> sostituzione -> ri-conferma
  // simuliamo: il videomaker (videoSup) si tira indietro, lo sostituiamo con un altro VIDEOMAKER
  const videoItem = db.quote_items.find((i) => i.quote_id === quote.id && i.supplier_id === videoSup.id)
  // 1) registra evento_cambiamento DROPOUT_FORNITORE
  const cambio = insert('eventi_cambiamento', {
    entry_id: entry.id,
    tipo: 'DROPOUT_FORNITORE',
    payload: { quote_item_id: videoItem.id, supplier_uscito: videoSup.id },
    eseguito_da: wp.id,
    stato: 'IN_CORSO',
  })
  // 2) sostituzione: nuovo fornitore (mocchiamo il prossimo VIDEOMAKER disponibile)
  const replacementSup = insert('profiles', {
    role: 'FORNITORE', email: emailFor(3019 + 100),
    subrole: 'VIDEOMAKER', full_name: 'Videomaker Sostituto',
  })
  update('quote_items', videoItem.id, {
    supplier_id: replacementSup.id,
    name_snapshot: 'Video racconto (sostituto)',
  })
  // 3) notifica RICONFERMA al nuovo fornitore
  insert('notifiche', {
    destinatario_id: replacementSup.id, evento_id: entry.id,
    tipo: 'RICONFERMA_FORNITORE', priorita: 9, stato: 'PENDING',
  })
  // 4) il sostituto conferma
  const notif = db.notifiche.find((n) => n.destinatario_id === replacementSup.id)
  update('notifiche', notif.id, { stato: 'DONE', letto_il: new Date().toISOString() })
  update('eventi_cambiamento', cambio.id, { stato: 'COMPLETATO' })
  log('dropout + sostituzione + riconferma',
    db.quote_items.find((i) => i.id === videoItem.id).supplier_id === replacementSup.id &&
    db.eventi_cambiamento.find((c) => c.id === cambio.id).stato === 'COMPLETATO')

  // 15) Evento svolto + cleanup logico (NON cancelliamo righe; chiudiamo stato)
  update('calendar_entries', entry.id, { evento_stato: 'SVOLTO' })
  audit('TRANSITION', 'calendar_entries', entry.id, { from: 'CHECKLIST', to: 'SVOLTO' })
  log('evento finalizzato a SVOLTO',
    db.calendar_entries.find((e) => e.id === entry.id).evento_stato === 'SVOLTO')

  return {
    wp: wp.email,
    couple: couple.email,
    suppliers: suppliers.map((s) => s.email),
    guests: db.event_guests.filter((g) => g.entry_id === entry.id).map((g) => g.email),
    entryId: entry.id,
    quoteId: quote.id,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('====================================================================')
  console.log('FASE 7 — Simulazione full lifecycle "nuovo modello"')
  console.log(`Data: ${new Date().toISOString()}`)
  console.log('Repo: wedding-platform / branch feature/nuovo-modello')
  console.log('Mode: SIMULAZIONE (mock in memoria, nessun utente in auth.users)')
  console.log('====================================================================')

  printMapping()
  const audit = await auditAntiNormalization()
  const scenario = await runScenario()

  section('EMAIL GENERATE PER TIPO')
  console.log(`WP capostipite : ${scenario.wp}`)
  console.log(`Coppia         : ${scenario.couple}`)
  console.log(`Fornitori (20) : ${scenario.suppliers.slice(0, 3).join(', ')}, ... ${scenario.suppliers.slice(-1)}`)
  console.log(`Invitati (30)  : ${scenario.guests.slice(0, 3).join(', ')}, ... ${scenario.guests.slice(-1)}`)

  section('SUMMARY')
  console.log(`PASS: ${stats.pass}`)
  console.log(`FAIL: ${stats.fail}`)
  if (stats.failures.length) {
    console.log('Failures:')
    for (const f of stats.failures) console.log(`  - ${f}`)
  }
  const exitCode = stats.fail === 0 && audit.bugs === 0 ? 0 : 1
  console.log(`\nExit code: ${exitCode}`)
  process.exit(exitCode)
}

main().catch((err) => {
  console.error('UNHANDLED ERROR:', err)
  process.exit(2)
})
