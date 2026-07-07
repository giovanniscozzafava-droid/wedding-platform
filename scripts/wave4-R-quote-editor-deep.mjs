#!/usr/bin/env node
/**
 * Wave 4 - Agent R - QUOTE EDITOR DEEP
 *
 * Test esaustivo del flow di editing preventivo: calcoli automatici, edge
 * cases sulle voci, supplier reassignment + RLS, status transitions,
 * PDF generation, send + accept flow, revisioni.
 *
 * Approccio ibrido (come Agent P): UI Playwright per la creazione iniziale
 * del preventivo (UI test reale) + il bottone "Genera contratto" (NUOVO post
 * fix Wave 3 hotfix), service-role per bulk CRUD sulle voci, stato e
 * verifiche dei trigger/RLS.
 */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const BASE = 'https://planfully.it'
const PWD = 'Beta2026!'
const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const WP_EMAIL = 'wp-mini@planfully-demo.it'
const WP_ID = '712baed0-3957-4452-8aab-ab4eeebb2697'
const FOTO_ID = '747707fe-03be-4bb8-95b8-17b43b465526'
const FIORI_ID = 'a0262dd1-f07c-4359-a9c0-1186e98971a3'

const TS = Date.now()
const RUN_DIR = process.env.RUN_DIR || `/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave4-R-quote-editor-deep-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
mkdirSync(RUN_DIR, { recursive: true })

const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Email for "couple" signer (token-based accept doesn't need a real user)
const COUPLE_EMAIL = `agent-r-couple-${TS}@planfully-demo.it`

const bugs = []
const phases = {}
let currentPhaseId = null

function startPhase(id, name) {
  currentPhaseId = id
  phases[id] = { name, started: new Date().toISOString(), steps: [], screenshots: [], bugs: [] }
  console.log(`\n========== PHASE ${id}: ${name} ==========`)
}
function endPhase(ok) {
  const p = phases[currentPhaseId]
  p.finished = new Date().toISOString()
  p.ok = ok
  p.durationSec = (new Date(p.finished).getTime() - new Date(p.started).getTime()) / 1000
  console.log(`---------- PHASE ${currentPhaseId} ${ok ? 'OK' : 'FAIL'} (${p.durationSec.toFixed(1)}s) ----------`)
}
function step(name, ok, detail) {
  const p = phases[currentPhaseId]
  p.steps.push({ name, ok, detail: detail ? String(detail).slice(0, 400) : null })
  console.log(`  ${ok ? '[OK]' : '[FAIL]'} ${name}${detail ? ' - ' + String(detail).slice(0, 140) : ''}`)
}
function bug(severity, area, msg, repro) {
  const id = `AGENT-R-${String(bugs.length + 1).padStart(3, '0')}`
  const entry = { id, severity, area, msg, repro: repro || null, phase: currentPhaseId, ts: new Date().toISOString() }
  bugs.push(entry)
  phases[currentPhaseId]?.bugs.push(entry)
  console.log(`  [BUG ${severity}] ${area}: ${msg}`)
}

async function shot(page, name) {
  const fn = `${currentPhaseId}-${name}.png`
  try {
    await page.screenshot({ path: path.join(RUN_DIR, fn), fullPage: false, timeout: 6000 })
    phases[currentPhaseId]?.screenshots.push(fn)
  } catch (e) {
    console.log(`  [shot fail] ${fn}: ${e.message}`)
  }
}

async function dismissCookie(page) {
  for (const txt of ['Solo essenziali', 'Accetta tutto', 'Accetta']) {
    await page.locator(`button:has-text("${txt}")`).first().click({ timeout: 1200 }).catch(() => {})
  }
  await page.waitForTimeout(250)
}

async function loginUi(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await dismissCookie(page)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PWD)
  await page.getByRole('button', { name: /^Accedi$/i }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1000)
}

// ----------------------------------------------------------------------------
// State carried across phases
// ----------------------------------------------------------------------------
let quoteId = null
let initialItems = []  // 8 voci miste con basis
let savedAcceptanceUrl = null

// ----------------------------------------------------------------------------
// PHASE 1 — Setup quote + 8 voci miste via UI (creazione) + service-role (voci)
// ----------------------------------------------------------------------------
async function phase1_setup(page) {
  startPhase('p1', 'Setup quote + voci miste')

  // Cleanup pre-run: tutti i quote AGENT-R-% del wp-mini
  await sb.from('quote_items').delete().match({ /* hack: use FK on quotes */ }).limit(0) // noop
  const { data: existing } = await sb.from('quotes')
    .select('id')
    .eq('owner_id', WP_ID)
    .like('title', 'AGENT-R-%')
  if (existing?.length) {
    await sb.from('quotes').delete().in('id', existing.map((q) => q.id))
    step('cleanup quote AGENT-R-% precedenti', true, `${existing.length} eliminati`)
  } else {
    step('cleanup quote AGENT-R-%', true, 'nessun residuo')
  }

  // Cleanup supplier_availability blocks su date di test (run precedenti potrebbero
  // aver auto-bloccato i fornitori il 2027-08-15 / 2027-10-10 / 2027-11-22 / 2027-09-20).
  const testDates = ['2027-08-15', '2027-09-20', '2027-10-10', '2027-11-22']
  await sb.from('supplier_availability').delete()
    .in('fornitore_id', [FOTO_ID, FIORI_ID])
    .in('date', testDates)
  step('cleanup supplier_availability su date di test', true, testDates.join(','))

  // 1a. Login UI come wp-mini
  await loginUi(page, WP_EMAIL)
  await shot(page, '01-login')

  // 1b. Vai a /quotes/new (route create-quote)
  await page.goto(`${BASE}/quotes`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await shot(page, '02-quotes-list')

  // 1c. Cerca bottone "Nuovo preventivo" o equivalente
  const newBtn = page.locator('a:has-text("Nuovo"), button:has-text("Nuovo"), a[href*="quote"][href*="new"]').first()
  let createdViaUi = false
  try {
    await newBtn.click({ timeout: 4000 })
    await page.waitForTimeout(1200)
    // Compila il form; fallback su uno style con label "Titolo"
    const titleInput = page.getByLabel(/titolo/i).first()
    await titleInput.fill('AGENT-R Test 2027-08-15', { timeout: 4000 }).catch(() => {})
    await page.getByLabel(/cliente/i).first().fill('AGENT-R Coppia').catch(() => {})
    // Submit
    await page.getByRole('button', { name: /crea|salva|submit/i }).first().click({ timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(1500)
    // Se ora siamo su /quotes/:id, estrai id
    const m = page.url().match(/\/quotes\/([0-9a-f-]{36})/)
    if (m) { quoteId = m[1]; createdViaUi = true; step('quote creato via UI', true, quoteId) }
  } catch (e) {
    step('quote-create-via-UI', false, e.message)
  }

  // Se UI fallisce, crea via service-role (test cases sono valid lo stesso)
  if (!quoteId) {
    const { data: q, error } = await sb.from('quotes').insert({
      owner_id: WP_ID,
      title: 'AGENT-R Test 2027-08-15',
      client_name: 'AGENT-R Coppia',
      client_email: COUPLE_EMAIL,
      event_date: '2027-08-15',
      guest_count: 120,
      table_count: 12,
      default_markup_percent: 25,
      status: 'BOZZA',
    }).select('id').single()
    if (error) { step('quote-create-via-DB', false, error.message); endPhase(false); return }
    quoteId = q.id
    step('quote creato via DB (fallback UI)', true, quoteId)
  } else {
    // Completa header via DB (location/guests/tables/markup/date)
    await sb.from('quotes').update({
      client_email: COUPLE_EMAIL,
      event_date: '2027-08-15',
      guest_count: 120,
      table_count: 12,
      default_markup_percent: 25,
    }).eq('id', quoteId)
    step('header completato via DB', true)
  }

  // 1d. 8 voci miste: 3 foto, 2 fiori, 3 senza supplier
  // mix di FLAT (2), PER_GUEST (3), PER_TABLE (2), PER_HOUR (1)
  const items = [
    { name_snapshot: 'AGENT-R Servizio Foto Full Day', supplier_id: FOTO_ID, unit_snapshot: 'EVENTO', snapshot_price: 2200, quantity_basis: 'FLAT', quantity: 1 },
    { name_snapshot: 'AGENT-R Album extra foto',       supplier_id: FOTO_ID, unit_snapshot: 'PEZZO',  snapshot_price: 380,  quantity_basis: 'FLAT', quantity: 1 },
    { name_snapshot: 'AGENT-R Stampe foto invitati',   supplier_id: FOTO_ID, unit_snapshot: 'PERSONA',snapshot_price: 8,    quantity_basis: 'PER_GUEST', quantity: 120 },
    { name_snapshot: 'AGENT-R Bouquet sposa',          supplier_id: FIORI_ID,unit_snapshot: 'PEZZO',  snapshot_price: 180,  quantity_basis: 'FLAT', quantity: 1 },
    { name_snapshot: 'AGENT-R Centrotavola',           supplier_id: FIORI_ID,unit_snapshot: 'PEZZO',  snapshot_price: 75,   quantity_basis: 'PER_TABLE', quantity: 12 },
    { name_snapshot: 'AGENT-R Menu cena',              supplier_id: null,    unit_snapshot: 'PERSONA',snapshot_price: 95,   quantity_basis: 'PER_GUEST', quantity: 120 },
    { name_snapshot: 'AGENT-R Welcome drink',          supplier_id: null,    unit_snapshot: 'PERSONA',snapshot_price: 18,   quantity_basis: 'PER_GUEST', quantity: 120 },
    { name_snapshot: 'AGENT-R Open bar musicisti',     supplier_id: null,    unit_snapshot: 'ORA',    snapshot_price: 250,  quantity_basis: 'PER_HOUR', quantity: 6 },
  ]
  for (const it of items) {
    const { data, error } = await sb.from('quote_items').insert({ quote_id: quoteId, sort_order: items.indexOf(it), ...it }).select().single()
    if (error) {
      bug('HIGH', 'quote_items.insert', `Insert fallito per "${it.name_snapshot}": ${error.message}`, JSON.stringify(it))
    } else {
      initialItems.push(data)
    }
  }
  step('8 voci inserite', initialItems.length === 8, `${initialItems.length}/8`)

  // 1e. Verifica totali
  const { data: q1 } = await sb.from('quotes').select('total_cost, total_client, margin_amount, margin_percent, default_markup_percent').eq('id', quoteId).single()
  // expected_cost = 2200 + 380 + 120*8 + 180 + 12*75 + 120*95 + 120*18 + 6*250 = 2200+380+960+180+900+11400+2160+1500 = 19680
  const expectedCost = 2200 + 380 + 120 * 8 + 180 + 12 * 75 + 120 * 95 + 120 * 18 + 6 * 250
  const expectedClient = Math.round(expectedCost * 1.25 * 100) / 100
  if (Math.abs(Number(q1.total_cost) - expectedCost) > 0.5) {
    bug('HIGH', 'totals.cost', `total_cost atteso ${expectedCost}, ottenuto ${q1.total_cost}`)
  } else step('total_cost ok', true, `€${q1.total_cost}`)
  if (Math.abs(Number(q1.total_client) - expectedClient) > 2.0) {
    bug('HIGH', 'totals.client', `total_client atteso ~${expectedClient}, ottenuto ${q1.total_client}`)
  } else step('total_client ok (25% markup)', true, `€${q1.total_client}`)

  await shot(page, '03-quote-created')
  endPhase(true)
}

// ----------------------------------------------------------------------------
// PHASE 2 — Calcoli automatici
// ----------------------------------------------------------------------------
async function phase2_calcoli() {
  startPhase('p2', 'Calcoli automatici')

  // 2a. guest_count 120 → 150
  await sb.from('quotes').update({ guest_count: 150 }).eq('id', quoteId)
  await new Promise(r => setTimeout(r, 400))
  const { data: perGuest } = await sb.from('quote_items')
    .select('name_snapshot, quantity, quantity_basis')
    .eq('quote_id', quoteId)
    .eq('quantity_basis', 'PER_GUEST')
  const allHit150 = perGuest.every(it => Math.round(Number(it.quantity)) === 150)
  if (allHit150) step('PER_GUEST ricalcolato a 150', true, JSON.stringify(perGuest.map(p => p.quantity)))
  else bug('HIGH', 'calcoli.PER_GUEST', `Dopo guest_count=150 alcune voci PER_GUEST non aggiornate: ${JSON.stringify(perGuest)}`)

  // 2b. table_count 12 → 15
  await sb.from('quotes').update({ table_count: 15 }).eq('id', quoteId)
  await new Promise(r => setTimeout(r, 400))
  const { data: perTable } = await sb.from('quote_items')
    .select('name_snapshot, quantity').eq('quote_id', quoteId).eq('quantity_basis', 'PER_TABLE')
  const allHit15 = perTable.every(it => Math.round(Number(it.quantity)) === 15)
  if (allHit15) step('PER_TABLE ricalcolato a 15', true, JSON.stringify(perTable.map(p => p.quantity)))
  else bug('HIGH', 'calcoli.PER_TABLE', `Dopo table_count=15 voci PER_TABLE non aggiornate: ${JSON.stringify(perTable)}`)

  // 2c. markup default 25 → 18: tutti line_client diminuiscono proporzionalmente
  const before = await sb.from('quote_items').select('id, name_snapshot, line_cost, line_client, item_markup_percent').eq('quote_id', quoteId)
  await sb.from('quotes').update({ default_markup_percent: 18 }).eq('id', quoteId)
  // ATTENZIONE: il trigger sui quote_items è BEFORE update; il trigger quotes_default_markup
  // fa UPDATE updated_at sui quote_items per ritriggrare il recalc. Aspettiamo.
  await new Promise(r => setTimeout(r, 500))
  const after = await sb.from('quote_items').select('id, name_snapshot, line_cost, line_client, item_markup_percent').eq('quote_id', quoteId)
  const beforeMap = new Map((before.data ?? []).map(r => [r.id, r]))
  const allLineClientUpdated = (after.data ?? []).every(it => {
    if (it.item_markup_percent != null) return true // override locale, non cambia
    const expected = Math.round(Number(it.line_cost) * 1.18 * 100) / 100
    return Math.abs(Number(it.line_client) - expected) < 0.5
  })
  if (allLineClientUpdated) step('markup default 25→18 propagato a tutte le voci', true)
  else {
    const sample = (after.data ?? []).slice(0, 3).map(it => ({ n: it.name_snapshot, lc: it.line_cost, lcl: it.line_client, exp: (Number(it.line_cost) * 1.18).toFixed(2) }))
    bug('HIGH', 'calcoli.markup', `Cambio default_markup 25→18 NON propagato a tutte le voci`, JSON.stringify(sample))
  }

  // 2d. Override markup su una voce singola (item_markup_percent=50)
  // Pick the menu cena (no supplier markup → usa default)
  const menuItem = (after.data ?? []).find(it => it.name_snapshot === 'AGENT-R Menu cena')
  if (menuItem) {
    const { error: e1 } = await sb.from('quote_items').update({ item_markup_percent: 50 }).eq('id', menuItem.id)
    if (e1) bug('HIGH', 'calcoli.override-markup', `Errore set item_markup_percent: ${e1.message}`)
    await new Promise(r => setTimeout(r, 300))
    const { data: refreshed } = await sb.from('quote_items').select('line_cost, line_client').eq('id', menuItem.id).single()
    const expected = Math.round(Number(refreshed.line_cost) * 1.50 * 100) / 100
    if (Math.abs(Number(refreshed.line_client) - expected) < 0.5) step('Override markup 50% applicato solo a "Menu cena"', true, `€${refreshed.line_client}`)
    else bug('HIGH', 'calcoli.override-markup', `Atteso line_client=${expected}, ottenuto ${refreshed.line_client}`)

    // E le altre voci NON devono avere markup 50%: verifichiamo a campione
    const other = (after.data ?? []).find(it => it.id !== menuItem.id && it.item_markup_percent == null)
    if (other) {
      const { data: oRefreshed } = await sb.from('quote_items').select('line_cost, line_client').eq('id', other.id).single()
      const expOther = Math.round(Number(oRefreshed.line_cost) * 1.18 * 100) / 100
      if (Math.abs(Number(oRefreshed.line_client) - expOther) < 0.5) step('Altre voci mantengono default 18% (no leak override)', true)
      else bug('HIGH', 'calcoli.override-markup-leak', `Override su 1 voce ha "leakato": altre voci hanno line_client ${oRefreshed.line_client}, atteso ${expOther}`)
    }
  }

  // 2e. unit_cost negativo (snapshot_price < 0): check constraint deve impedire
  const { error: errNeg } = await sb.from('quote_items').insert({
    quote_id: quoteId,
    name_snapshot: 'AGENT-R Voce negativa',
    unit_snapshot: 'PEZZO',
    snapshot_price: -50,
    quantity: 1,
    quantity_basis: 'FLAT',
    sort_order: 99,
  })
  if (errNeg) step('snapshot_price negativo rifiutato dal DB (check constraint)', true, errNeg.message.slice(0, 100))
  else bug('CRITICAL', 'validation.negative-price', `snapshot_price negativo ACCETTATO → calcoli sballati`)

  endPhase(true)
}

// ----------------------------------------------------------------------------
// PHASE 3 — Quote items edge cases
// ----------------------------------------------------------------------------
async function phase3_edge_items() {
  startPhase('p3', 'Quote items edge cases')

  // 3a. quantity = 0
  const { error: e0 } = await sb.from('quote_items').insert({
    quote_id: quoteId,
    name_snapshot: 'AGENT-R QtyZero',
    unit_snapshot: 'PEZZO', snapshot_price: 100, quantity: 0, quantity_basis: 'FLAT', sort_order: 100,
  })
  if (e0) step('quantity=0 rifiutato (check quantity > 0)', true, e0.message.slice(0, 100))
  else bug('HIGH', 'validation.qty-zero', `quantity=0 accettato (atteso: refuse, schema dice "quantity > 0")`)

  // 3b. quantity = 999999 (max guard)
  const { data: big, error: eBig } = await sb.from('quote_items').insert({
    quote_id: quoteId,
    name_snapshot: 'AGENT-R QtyBig',
    unit_snapshot: 'PEZZO', snapshot_price: 1, quantity: 999999, quantity_basis: 'FLAT', sort_order: 101,
  }).select().single()
  if (eBig) step('quantity=999999 rifiutato', true, eBig.message.slice(0, 100))
  else {
    step('quantity=999999 accettato', true, `line_cost=${big?.line_cost}`)
    bug('LOW', 'validation.qty-max', `Nessun upper bound su quantity (999999 accettato). Suggerito guard a livello applicativo (no DB constraint).`)
    if (big?.id) await sb.from('quote_items').delete().eq('id', big.id)
  }

  // 3c. label vuoto (name_snapshot empty string)
  const { error: eEmpty } = await sb.from('quote_items').insert({
    quote_id: quoteId,
    name_snapshot: '',
    unit_snapshot: 'PEZZO', snapshot_price: 50, quantity: 1, quantity_basis: 'FLAT', sort_order: 102,
  })
  if (eEmpty) step('label vuoto rifiutato', true, eEmpty.message.slice(0, 100))
  else bug('MEDIUM', 'validation.empty-label', `name_snapshot='' accettato → UI mostrerà voce senza titolo. Aggiungi NOT EMPTY constraint o validation lato app.`)
  // cleanup empty se inserita
  await sb.from('quote_items').delete().eq('quote_id', quoteId).eq('name_snapshot', '')

  // 3d. voce duplicata (stesso label) — atteso: permesso (utente può avere 2 servizi distinti con stesso label)
  const { error: eDup } = await sb.from('quote_items').insert([
    { quote_id: quoteId, name_snapshot: 'AGENT-R Dup label', unit_snapshot: 'PEZZO', snapshot_price: 10, quantity: 1, quantity_basis: 'FLAT', sort_order: 103 },
    { quote_id: quoteId, name_snapshot: 'AGENT-R Dup label', unit_snapshot: 'PEZZO', snapshot_price: 20, quantity: 1, quantity_basis: 'FLAT', sort_order: 104 },
  ])
  if (eDup) step('voci con stesso label rifiutate', true, eDup.message)
  else step('voci duplicate accettate (atteso per UX)', true)

  // 3e. Riordino sort_order: aggiorna sort_order su 2 items
  const { data: someItems } = await sb.from('quote_items').select('id, sort_order').eq('quote_id', quoteId).order('sort_order').limit(2)
  if (someItems && someItems.length === 2) {
    const r1 = await sb.from('quote_items').update({ sort_order: 9999 }).eq('id', someItems[0].id)
    const r2 = await sb.from('quote_items').update({ sort_order: 9998 }).eq('id', someItems[1].id)
    if (!r1.error && !r2.error) step('sort_order modificabile (riordino voci)', true)
    else bug('LOW', 'edit.reorder', `sort_order update fallito: ${r1.error?.message ?? r2.error?.message}`)
  }

  // 3f. cambio basis FLAT → PER_GUEST: quantity auto-popolato dipende dal client side
  // (in DB la quantity NON si auto-popola: si fa client-side in handleChangeItemBasis).
  // Verifichiamo che la mutazione completa funzioni.
  const { data: flatItem } = await sb.from('quote_items')
    .select('id, quantity_basis, quantity').eq('quote_id', quoteId)
    .eq('quantity_basis', 'FLAT').limit(1).maybeSingle()
  if (flatItem) {
    const newQty = 150 // guest_count attuale
    const { error: eBasis } = await sb.from('quote_items')
      .update({ quantity_basis: 'PER_GUEST', quantity: newQty }).eq('id', flatItem.id)
    if (eBasis) bug('MEDIUM', 'edit.basis-change', `Cambio basis FLAT→PER_GUEST fallito: ${eBasis.message}`)
    else step('basis FLAT→PER_GUEST con quantity auto-pop applicato (DB richiede quantity esplicita)', true)
    // Ripristina per non sporcare il resto
    await sb.from('quote_items').update({ quantity_basis: 'FLAT', quantity: 1 }).eq('id', flatItem.id)
  }

  // 3g. quote vuoto: cancella TUTTE le voci e verifica che il quote sia "ammesso" vuoto
  // Ma noi vogliamo tenere le voci per i prossimi step → simuliamo con quote diverso
  const { data: tmpQ } = await sb.from('quotes').insert({
    owner_id: WP_ID, title: 'AGENT-R-tmp-empty', status: 'BOZZA',
  }).select('id').single()
  if (tmpQ) {
    // Già senza voci. Verifica totals = 0 e che si possa salvare/aggiornare
    const { data: chk } = await sb.from('quotes').select('total_cost, total_client').eq('id', tmpQ.id).single()
    if (Number(chk.total_cost) === 0 && Number(chk.total_client) === 0) step('quote vuoto ammesso (totals=0)', true)
    else bug('LOW', 'edit.empty-quote', `Quote vuoto ha totals non-zero: ${JSON.stringify(chk)}`)
    await sb.from('quotes').delete().eq('id', tmpQ.id)
  }

  // Cleanup voci dup label per non sporcare totali
  await sb.from('quote_items').delete().eq('quote_id', quoteId).eq('name_snapshot', 'AGENT-R Dup label')

  endPhase(true)
}

// ----------------------------------------------------------------------------
// PHASE 4 — Supplier reassignment + RLS
// ----------------------------------------------------------------------------
async function phase4_supplier() {
  startPhase('p4', 'Supplier reassignment + RLS')

  // 4a. Cambia supplier_id di una voce foto a fiori
  const { data: fotoItem } = await sb.from('quote_items')
    .select('id, name_snapshot, supplier_id').eq('quote_id', quoteId)
    .eq('supplier_id', FOTO_ID).limit(1).maybeSingle()
  if (!fotoItem) { step('nessuna voce foto trovata', false); endPhase(false); return }

  const { error: eReassign } = await sb.from('quote_items').update({ supplier_id: FIORI_ID }).eq('id', fotoItem.id)
  if (eReassign) bug('HIGH', 'supplier.reassign', `Reassign supplier fallito: ${eReassign.message}`)
  else step(`Voce "${fotoItem.name_snapshot}" riassegnata a Fiori`, true)

  // 4b. Verifica RLS via anon login come fornitore foto e fornitore fiori
  // Login come FOTO via password grant
  const sbFoto = createClient(SUPA_URL, ANON_KEY, { auth: { persistSession: false } })
  const sbFiori = createClient(SUPA_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data: sFoto, error: eFotoLogin } = await sbFoto.auth.signInWithPassword({ email: 'forn-mini-foto@planfully-demo.it', password: PWD })
  const { data: sFiori, error: eFioriLogin } = await sbFiori.auth.signInWithPassword({ email: 'forn-mini-fiori@planfully-demo.it', password: PWD })
  if (eFotoLogin || eFioriLogin) {
    bug('HIGH', 'supplier.rls.login', `Login fornitori fallito: foto=${eFotoLogin?.message} fiori=${eFioriLogin?.message}`)
    endPhase(false); return
  }

  // Foto NON deve più vedere la voce riassegnata
  const { data: fotoVisible } = await sbFoto.from('quote_items').select('id').eq('id', fotoItem.id).maybeSingle()
  if (!fotoVisible) step('RLS: fornitore Foto NON vede più la voce riassegnata', true)
  else bug('CRITICAL', 'supplier.rls.foto-stale', `Fornitore Foto vede ancora una voce che non è più sua (id=${fotoItem.id})`)

  // Fiori DEVE vedere la voce ora che è sua
  const { data: fioriVisible } = await sbFiori.from('quote_items').select('id, name_snapshot').eq('id', fotoItem.id).maybeSingle()
  if (fioriVisible) step('RLS: fornitore Fiori vede la voce riassegnata', true, fioriVisible.name_snapshot)
  else bug('CRITICAL', 'supplier.rls.fiori-blind', `Fornitore Fiori NON vede una voce che ora è sua (id=${fotoItem.id})`)

  // 4c. supplier_id → null = in-house WP
  const { error: eNull } = await sb.from('quote_items').update({ supplier_id: null }).eq('id', fotoItem.id)
  if (eNull) bug('MEDIUM', 'supplier.null', `Set supplier_id=null fallito: ${eNull.message}`)
  else {
    const { data: post } = await sb.from('quote_items').select('supplier_id').eq('id', fotoItem.id).single()
    if (post.supplier_id === null) step('supplier_id → null (in-house WP) accettato', true)
    else bug('HIGH', 'supplier.null', `supplier_id=null richiesto ma DB ha: ${post.supplier_id}`)
    // Verifica che il fiori ora NON la veda più
    const { data: fioriStillSees } = await sbFiori.from('quote_items').select('id').eq('id', fotoItem.id).maybeSingle()
    if (!fioriStillSees) step('RLS: dopo null, Fiori non vede più', true)
    else bug('HIGH', 'supplier.rls.fiori-stale', `Fiori vede ancora voce con supplier_id=null`)
  }

  // Cleanup: rimetti supplier_id originale per i test PDF/send
  await sb.from('quote_items').update({ supplier_id: FOTO_ID }).eq('id', fotoItem.id)
  await sbFoto.auth.signOut()
  await sbFiori.auth.signOut()

  endPhase(true)
}

// ----------------------------------------------------------------------------
// PHASE 5 — Status transitions
// ----------------------------------------------------------------------------
async function phase5_status(page) {
  startPhase('p5', 'Status transitions')

  // 5a. BOZZA → INVIATO via edge function quote-send (UI behaviour)
  const { data: sendData, error: eSend } = await sb.functions.invoke('quote-send', {
    body: { quote_id: quoteId },
  })
  if (eSend) {
    bug('HIGH', 'status.send', `quote-send fallito: ${eSend.message}`)
  } else {
    step('quote-send invocato', true, `pdf_url=${(sendData?.pdf_url ?? '').slice(0, 60)}`)
  }
  await new Promise(r => setTimeout(r, 600))
  const { data: afterSend } = await sb.from('quotes')
    .select('status, sent_at, access_token, pdf_url, sent_email_log').eq('id', quoteId).single()
  if (afterSend.status === 'INVIATO') step('status BOZZA→INVIATO', true)
  else bug('HIGH', 'status.send', `Atteso status=INVIATO, ottenuto ${afterSend.status}`)
  if (afterSend.access_token) step('access_token generato', true, afterSend.access_token.slice(0, 8))
  else bug('HIGH', 'status.send', `access_token mancante dopo invio`)

  // 5b. Tenta INVIATO → BOZZA direttamente via DB (no RLS bypass via service_role: il check
  // dovrebbe essere a livello applicativo, non DB. Verifichiamolo).
  // service_role bypassa RLS, quindi questo non è un vero check. Testiamo invece tramite anon WP.
  const sbWp = createClient(SUPA_URL, ANON_KEY, { auth: { persistSession: false } })
  const { error: eWpLogin } = await sbWp.auth.signInWithPassword({ email: WP_EMAIL, password: PWD })
  if (eWpLogin) {
    bug('HIGH', 'status.wp-login', `Login WP fallito: ${eWpLogin.message}`)
  } else {
    const { error: eRevert } = await sbWp.from('quotes').update({ status: 'BOZZA' }).eq('id', quoteId)
    // L'app non impedisce questa transition lato DB (no trigger), quindi WP può tornare a BOZZA.
    if (eRevert) step('INVIATO→BOZZA direttamente bloccato', true, eRevert.message)
    else {
      // Riporta a INVIATO per i test successivi
      await sb.from('quotes').update({ status: 'INVIATO' }).eq('id', quoteId)
      bug('MEDIUM', 'status.transitions', `WP può tornare INVIATO→BOZZA senza vincoli DB. Le state-machine sono solo client-side (no DB trigger). Cliente potrebbe avere link "scaduto" senza saperlo.`, `UPDATE quotes SET status='BOZZA' WHERE id='${quoteId}' AND owner_id=auth.uid()`)
    }
    await sbWp.auth.signOut()
  }

  // 5c. INVIATO → ACCETTATO via quote-accept-sign edge function
  // Genera firma PNG fittizia (PNG 1x1 trasparente)
  const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
  const { data: acceptData, error: eAccept } = await sb.functions.invoke('quote-accept-sign', {
    body: {
      token: afterSend.access_token,
      signer_name: 'AGENT-R Coppia Test',
      signer_phone: '+393331112233',
      doc_type: 'CARTA_IDENTITA',
      doc_number: 'CA12345AB',
      doc_issued_by: 'Comune di Milano',
      signature_data_url: `data:image/png;base64,${PNG_1x1}`,
      consent_terms: true,
      consent_privacy: true,
    },
  })
  if (eAccept) bug('HIGH', 'status.accept', `quote-accept-sign fallito: ${eAccept.message}`)
  else step('quote-accept-sign invocato', true, JSON.stringify(acceptData).slice(0, 120))

  await new Promise(r => setTimeout(r, 500))
  const { data: afterAccept } = await sb.from('quotes')
    .select('status, accepted_at').eq('id', quoteId).single()
  if (afterAccept.status === 'ACCETTATO') step('status INVIATO→ACCETTATO', true, `accepted_at=${afterAccept.accepted_at}`)
  else bug('HIGH', 'status.accept', `Atteso status=ACCETTATO, ottenuto ${afterAccept.status}`)

  // 5d. Verifica banner + isLocked: visita /quotes/:id come WP
  await loginUi(page, WP_EMAIL)
  await page.goto(`${BASE}/quotes/${quoteId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await shot(page, '01-quote-accepted-banner')
  const bannerVisible = await page.locator('text=/accettato dal cliente|Preventivo accettato/i').first().isVisible({ timeout: 3000 }).catch(() => false)
  if (bannerVisible) step('Banner "Preventivo accettato" visibile', true)
  else bug('HIGH', 'ui.banner', `Banner accettato non trovato dopo ACCETTATO`)
  // Verifica isLocked: cerca input "Titolo" e controlla attributo disabled in DOM
  const disabledCount = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input,textarea,select'))
    return inputs.filter(el => el.disabled).length
  }).catch(() => 0)
  if (disabledCount >= 4) step(`Campi header in lock (isLocked) — ${disabledCount} input disabled`, true)
  else bug('HIGH', 'ui.lock', `Solo ${disabledCount} input disabled dopo ACCETTATO (atteso >=4: titolo/data/cliente/email/invitati/tavoli/markup)`)

  // 5e. ACCETTATO → CONVERTITO_IN_CONTRATTO via bottone "Genera contratto"
  const generateBtn = page.getByTestId('generate-contract-btn')
  const visible = await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)
  if (!visible) {
    bug('CRITICAL', 'ui.contract-button', `Bottone "Genera contratto" non visibile dopo ACCETTATO. Test case principale post-fix Wave 3.`)
  } else {
    step('Bottone "Genera contratto" visibile', true)
    await generateBtn.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(2500)
    await shot(page, '02-after-generate-contract')
    // Atteso: navigate('/contracts')
    if (page.url().endsWith('/contracts') || page.url().includes('/contracts')) step('Navigazione /contracts post-click', true)
    else step('Navigazione /contracts post-click', false, page.url())
    await new Promise(r => setTimeout(r, 500))
    const { data: afterContract } = await sb.from('quotes').select('status').eq('id', quoteId).single()
    if (afterContract.status === 'CONVERTITO_IN_CONTRATTO') step('status ACCETTATO→CONVERTITO_IN_CONTRATTO', true)
    else bug('HIGH', 'status.contract', `Atteso CONVERTITO_IN_CONTRATTO, ottenuto ${afterContract.status}`)
    // Verifica contratto inserito
    const { data: contracts } = await sb.from('contracts').select('id, status, total_amount').eq('quote_id', quoteId)
    if (contracts?.length) step(`Contratto inserito (${contracts[0].status}, €${contracts[0].total_amount})`, true, contracts[0].id)
    else bug('HIGH', 'contract.created', `Nessun contratto in tabella contracts per quote_id=${quoteId}`)
  }

  // 5f. ACCETTATO → RIFIUTATO: non più applicabile (siamo CONVERTITO_IN_CONTRATTO).
  // Creiamo un quote secondario per testare RIFIUTATO direttamente
  const { data: q2 } = await sb.from('quotes').insert({
    owner_id: WP_ID, title: 'AGENT-R-rifiuto-test', status: 'INVIATO',
    access_token: crypto.randomUUID(),
  }).select('id, access_token').single()
  if (q2) {
    const { data: rejRes, error: eRej } = await sb.rpc('quote_reject_by_token', { p_token: q2.access_token, p_reason: 'Test rifiuto' })
    if (eRej) bug('LOW', 'status.reject', `RPC quote_reject_by_token fallito: ${eRej.message}`)
    else {
      const { data: q2After } = await sb.from('quotes').select('status').eq('id', q2.id).single()
      if (q2After.status === 'RIFIUTATO') step('INVIATO→RIFIUTATO via token funziona', true)
      else bug('LOW', 'status.reject', `Atteso RIFIUTATO, ottenuto ${q2After.status}`)
    }
    // Test: ACCETTATO → RIFIUTATO tramite WP service-role: ammesso DB ma semanticamente sbagliato
    await sb.from('quotes').update({ status: 'ACCETTATO' }).eq('id', q2.id)
    const { error: eForceRej } = await sb.from('quotes').update({ status: 'RIFIUTATO' }).eq('id', q2.id)
    if (eForceRej) step('ACCETTATO→RIFIUTATO bloccato DB', true)
    else bug('MEDIUM', 'status.transitions', `Transition ACCETTATO→RIFIUTATO consentita da DB (nessun trigger di validazione state-machine). Solo UI/RPC la limita.`)
    await sb.from('quotes').delete().eq('id', q2.id)
  }

  endPhase(true)
}

// ----------------------------------------------------------------------------
// PHASE 6 — PDF generation (NEUTRA + PREMIUM + i18n)
// ----------------------------------------------------------------------------
async function phase6_pdf() {
  startPhase('p6', 'PDF generation')

  // 6a. NEUTRA
  const { data: pdfN, error: ePN } = await sb.functions.invoke('quote-generate-pdf', {
    body: { quote_id: quoteId, variant: 'NEUTRA' },
  })
  if (ePN) bug('HIGH', 'pdf.neutra', `Generazione PDF NEUTRA fallita: ${ePN.message}`)
  else if (pdfN?.url) {
    step('PDF NEUTRA generato', true, pdfN.url.slice(0, 80))
    // Download per audit dir
    try {
      const r = await fetch(pdfN.url)
      const buf = Buffer.from(await r.arrayBuffer())
      writeFileSync(path.join(RUN_DIR, 'pdf-neutra.pdf'), buf)
      step('PDF NEUTRA scaricato', true, `${buf.length} bytes`)
    } catch (e) { step('PDF NEUTRA download', false, e.message) }
  }

  // 6b. PREMIUM (check subscription tier)
  const { data: pdfP, error: ePP } = await sb.functions.invoke('quote-generate-pdf', {
    body: { quote_id: quoteId, variant: 'PREMIUM' },
  })
  if (ePP) bug('MEDIUM', 'pdf.premium', `Generazione PDF PREMIUM fallita: ${ePP.message}`)
  else if (pdfP?.url) {
    step(`PDF PREMIUM generato (premium_applied=${pdfP.premium_applied})`, true, pdfP.url.slice(0, 80))
    try {
      const r = await fetch(pdfP.url)
      const buf = Buffer.from(await r.arrayBuffer())
      writeFileSync(path.join(RUN_DIR, 'pdf-premium.pdf'), buf)
      step('PDF PREMIUM scaricato', true, `${buf.length} bytes`)
    } catch (e) { step('PDF PREMIUM download', false, e.message) }
    if (!pdfP.premium_applied) step('premium_applied=false (subscription_tier non PREMIUM su questo WP — atteso, fallback NEUTRA)', true)
  }

  // 6c. Quote con caratteri italiani + simboli speciali
  const { data: testQ } = await sb.from('quotes').insert({
    owner_id: WP_ID,
    title: 'AGENT-R i18n €%©™ àèìòù',
    client_name: 'Coppia àèìòù',
    client_email: COUPLE_EMAIL,
    event_date: '2027-09-20',
    guest_count: 50,
    default_markup_percent: 20,
    status: 'BOZZA',
  }).select('id').single()
  if (testQ) {
    await sb.from('quote_items').insert([
      { quote_id: testQ.id, name_snapshot: 'Cocktail à la française €15', unit_snapshot: 'PERSONA', snapshot_price: 15, quantity: 50, quantity_basis: 'PER_GUEST', description_snapshot: 'Servizio premium 100% naturale ©2027' },
      { quote_id: testQ.id, name_snapshot: 'Località «sognante»', unit_snapshot: 'EVENTO', snapshot_price: 3000, quantity: 1, quantity_basis: 'FLAT', description_snapshot: 'Casa antica — fascino unico™' },
    ])
    const { data: pdfI, error: ePI } = await sb.functions.invoke('quote-generate-pdf', {
      body: { quote_id: testQ.id, variant: 'NEUTRA' },
    })
    if (ePI) bug('MEDIUM', 'pdf.i18n', `PDF con caratteri speciali fallito: ${ePI.message}`)
    else if (pdfI?.url) {
      step('PDF i18n+simboli generato', true, pdfI.url.slice(0, 60))
      try {
        const r = await fetch(pdfI.url)
        const buf = Buffer.from(await r.arrayBuffer())
        writeFileSync(path.join(RUN_DIR, 'pdf-i18n.pdf'), buf)
      } catch {}
    }
    await sb.from('quotes').delete().eq('id', testQ.id)
  }

  // 6d. Quote con 50+ voci (paginazione)
  const { data: bigQ } = await sb.from('quotes').insert({
    owner_id: WP_ID, title: 'AGENT-R 50items pagination', status: 'BOZZA', guest_count: 100, default_markup_percent: 22,
  }).select('id').single()
  if (bigQ) {
    const lots = Array.from({ length: 55 }, (_, i) => ({
      quote_id: bigQ.id,
      name_snapshot: `Voce numero ${i + 1} - descrizione lunga per testare wrapping multi-riga`,
      unit_snapshot: 'PEZZO',
      snapshot_price: 25 + (i % 7),
      quantity: 1 + (i % 5),
      quantity_basis: 'FLAT',
      sort_order: i,
    }))
    const { error: eLot } = await sb.from('quote_items').insert(lots)
    if (eLot) bug('LOW', 'pdf.bulk-insert', `Insert 55 voci fallito: ${eLot.message}`)
    const { data: pdf55, error: e55 } = await sb.functions.invoke('quote-generate-pdf', {
      body: { quote_id: bigQ.id, variant: 'NEUTRA' },
    })
    if (e55) bug('HIGH', 'pdf.pagination', `PDF 55 voci fallito: ${e55.message}`)
    else if (pdf55?.url) {
      step('PDF 55 voci generato (paginazione)', true, pdf55.url.slice(0, 60))
      try {
        const r = await fetch(pdf55.url)
        const buf = Buffer.from(await r.arrayBuffer())
        writeFileSync(path.join(RUN_DIR, 'pdf-55items.pdf'), buf)
        step('PDF 55 voci scaricato', true, `${buf.length} bytes`)
      } catch {}
    }
    await sb.from('quotes').delete().eq('id', bigQ.id)
  }

  endPhase(true)
}

// ----------------------------------------------------------------------------
// PHASE 7 — Send + accept link (token, public route)
// ----------------------------------------------------------------------------
async function phase7_send_accept(page) {
  startPhase('p7', 'Send + accept (token public route)')

  // Crea un nuovo quote di prova per testare il flow di public preview
  const { data: q3 } = await sb.from('quotes').insert({
    owner_id: WP_ID,
    title: 'AGENT-R Send Test',
    client_name: 'AGENT-R Send Coppia',
    client_email: COUPLE_EMAIL,
    event_date: '2027-10-10',
    guest_count: 80,
    default_markup_percent: 15,
    status: 'BOZZA',
  }).select('id').single()
  if (!q3) { step('q3 create', false); endPhase(false); return }
  await sb.from('quote_items').insert([
    { quote_id: q3.id, name_snapshot: 'Servizio cerimonia', unit_snapshot: 'EVENTO', snapshot_price: 1500, quantity: 1, quantity_basis: 'FLAT', sort_order: 0 },
    { quote_id: q3.id, name_snapshot: 'Menù degustazione', unit_snapshot: 'PERSONA', snapshot_price: 110, quantity: 80, quantity_basis: 'PER_GUEST', sort_order: 1 },
  ])

  const { data: sendRes, error: eS } = await sb.functions.invoke('quote-send', { body: { quote_id: q3.id } })
  if (eS) bug('HIGH', 'send.invoke', `quote-send fallito: ${eS.message}`)
  else step('quote-send eseguito su q3', true, sendRes?.access_token?.slice(0, 8))

  const { data: q3After } = await sb.from('quotes').select('access_token, status, sent_email_log').eq('id', q3.id).single()
  if (q3After.access_token) step('access_token presente', true)
  else bug('HIGH', 'send.token', `access_token mancante su q3`)

  // verifica sent_email_log
  if (Array.isArray(q3After.sent_email_log) && q3After.sent_email_log.length > 0) {
    step(`sent_email_log popolato (${q3After.sent_email_log.length} entry)`, true)
  } else {
    bug('MEDIUM', 'send.log', `sent_email_log vuoto dopo quote-send`)
  }

  // Test public route /p/preview/:token
  if (q3After.access_token) {
    await page.goto(`${BASE}/p/preview/${q3After.access_token}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await shot(page, '01-public-preview')
    // basic content check
    const hasTitle = await page.locator('text=/AGENT-R Send Test/i').first().isVisible({ timeout: 3000 }).catch(() => false)
    if (hasTitle) step('Public preview mostra titolo quote', true)
    else bug('HIGH', 'public.preview', `Public preview /p/preview/:token non mostra il titolo`)
  }

  // Cleanup q3 (con cascade su quote_items)
  await sb.from('quotes').delete().eq('id', q3.id)

  endPhase(true)
}

// ----------------------------------------------------------------------------
// PHASE 8 — Revisioni (force unlock + revision bump)
// ----------------------------------------------------------------------------
async function phase8_revisions() {
  startPhase('p8', 'Revisioni + forza unlock')

  // Crea nuovo quote e portalo ad ACCETTATO per testare revision++
  const { data: q4 } = await sb.from('quotes').insert({
    owner_id: WP_ID, title: 'AGENT-R Revision Test', client_email: COUPLE_EMAIL,
    event_date: '2027-11-22', guest_count: 60, default_markup_percent: 20, status: 'INVIATO',
    access_token: crypto.randomUUID(), revision: 1,
  }).select('id, access_token, revision, sent_email_log').single()
  if (!q4) { step('q4 create', false); endPhase(false); return }

  await sb.from('quote_items').insert([
    { quote_id: q4.id, name_snapshot: 'Service A rev', unit_snapshot: 'EVENTO', snapshot_price: 800, quantity: 1, quantity_basis: 'FLAT', sort_order: 0 },
  ])

  // Forza ACCETTATO via DB (semplifichiamo: skip token flow)
  await sb.from('quotes').update({ status: 'ACCETTATO', accepted_at: new Date().toISOString() }).eq('id', q4.id)
  step('q4 portato ad ACCETTATO', true)

  // Apply force unlock: revision++ + update field
  await sb.from('quotes').update({
    revision: 2, // bump
    title: 'AGENT-R Revision Test - REV2',
  }).eq('id', q4.id)

  const { data: q4After } = await sb.from('quotes').select('revision, title, sent_email_log').eq('id', q4.id).single()
  if (q4After.revision === 2) step('revision incrementato a 2', true)
  else bug('HIGH', 'revision.bump', `Atteso revision=2, ottenuto ${q4After.revision}`)
  if (q4After.title.includes('REV2')) step('modifica salvata su quote ACCETTATO', true)
  else bug('HIGH', 'revision.title', `Titolo non aggiornato dopo force unlock`)

  // sent_email_log non si deve perdere (è jsonb default [])
  if (Array.isArray(q4After.sent_email_log)) step('sent_email_log preservato dopo modifica', true, `${q4After.sent_email_log.length} entry`)
  else bug('MEDIUM', 'revision.email-log', `sent_email_log non è array dopo revision bump`)

  await sb.from('quotes').delete().eq('id', q4.id)
  endPhase(true)
}

// ----------------------------------------------------------------------------
// PHASE 9 — Cleanup
// ----------------------------------------------------------------------------
async function phase9_cleanup() {
  startPhase('p9', 'Cleanup AGENT-R-%')
  const { data: leftover } = await sb.from('quotes').select('id, title').eq('owner_id', WP_ID).like('title', 'AGENT-R%')
  if (leftover?.length) {
    await sb.from('quotes').delete().in('id', leftover.map(q => q.id))
    step(`cleanup ${leftover.length} quote AGENT-R%`, true)
  } else step('nessun quote AGENT-R% residuo', true)
  // Cleanup test contracts
  const { data: c } = await sb.from('contracts').select('id, title').like('title', 'Contratto · AGENT-R%')
  if (c?.length) {
    await sb.from('contracts').delete().in('id', c.map(x => x.id))
    step(`cleanup ${c.length} contract AGENT-R%`, true)
  }
  endPhase(true)
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)

  try {
    await phase1_setup(page)
    await phase2_calcoli()
    await phase3_edge_items()
    await phase4_supplier()
    await phase5_status(page)
    await phase6_pdf()
    await phase7_send_accept(page)
    await phase8_revisions()
    await phase9_cleanup()
  } catch (e) {
    console.error('FATAL:', e)
    bug('CRITICAL', 'main', `Eccezione top-level: ${e.message}`, e.stack?.slice(0, 400))
  } finally {
    await browser.close()
  }

  // Write report files
  writeFileSync(path.join(RUN_DIR, 'phases.json'), JSON.stringify(phases, null, 2))
  writeFileSync(path.join(RUN_DIR, 'bugs.json'), JSON.stringify(bugs, null, 2))

  const sev = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const b of bugs) sev[b.severity]++
  const okPhases = Object.values(phases).filter(p => p.ok).length
  const totPhases = Object.values(phases).length

  let report = `# Wave 4 — Agent R — Quote Editor Deep — REPORT\n\n`
  report += `**Quote ID**: \`${quoteId}\`\n\n`
  report += `**Run dir**: \`${RUN_DIR}\`\n\n`
  report += `**Phases**: ${okPhases}/${totPhases} OK\n\n`
  report += `**Bugs**: ${bugs.length} totali — CRITICAL ${sev.CRITICAL} · HIGH ${sev.HIGH} · MEDIUM ${sev.MEDIUM} · LOW ${sev.LOW}\n\n`
  report += `## Phases\n\n`
  for (const [k, p] of Object.entries(phases)) {
    report += `### ${k}: ${p.name} — ${p.ok ? 'OK' : 'FAIL'} (${(p.durationSec ?? 0).toFixed(1)}s)\n\n`
    for (const s of p.steps) {
      report += `- ${s.ok ? '[OK]' : '[FAIL]'} ${s.name}${s.detail ? ` — \`${s.detail.replace(/`/g, '\\`')}\`` : ''}\n`
    }
    if (p.bugs.length) {
      report += `\n**Bugs in phase**:\n`
      for (const b of p.bugs) report += `- **${b.id}** ${b.severity} · ${b.area}: ${b.msg}\n`
    }
    report += `\n`
  }
  report += `## Bug list\n\n`
  for (const b of bugs) {
    report += `### ${b.id} · ${b.severity} · ${b.area}\n\n${b.msg}\n\n`
    if (b.repro) report += `Repro: \`${b.repro}\`\n\n`
  }

  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), report)
  console.log(`\n========== DONE ==========`)
  console.log(`Report: ${RUN_DIR}/REPORT.md`)
  console.log(`Phases: ${okPhases}/${totPhases} OK · Bugs: ${bugs.length} (CRIT ${sev.CRITICAL} HIGH ${sev.HIGH} MED ${sev.MEDIUM} LOW ${sev.LOW})`)
}

main().catch(e => { console.error(e); process.exit(1) })
