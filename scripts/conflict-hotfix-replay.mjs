#!/usr/bin/env node
/**
 * Replay focalizzato post-hotfix: solo Scenari A (EMAIL_MATCH HIGH) e B (LOCATION_MATCH MEDIUM mascherato).
 * Verifica RPC my_quote_conflict_alerts() + banner UI lato WP e Fornitore.
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = path.resolve(__dirname, `../audit-runs/conflict-test-hotfix-${RUN_TS}`)
mkdirSync(RUN_DIR, { recursive: true })

const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const PROD = 'https://planfully.it'
const PWD = 'Beta2026!'
const TEST_MARK = 'E2E-HOTFIX-' + RUN_TS

const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

const out = { scenarios: { A: [], B: [] }, rpc: { A: null, B: null }, ui: { wp: null, forn: null }, bugs: [], notes: [] }

function rec(scenario, step, pass, info='') {
  const r = { step, pass, info, ts: new Date().toISOString() }
  out.scenarios[scenario].push(r)
  console.log(`[${scenario}] ${pass?'PASS':'FAIL'} ${step}${info?' — '+info:''}`)
}
function bug(severity, title, repro, expected, actual) {
  out.bugs.push({ severity, title, repro, expected, actual })
  console.log(`  BUG [${severity}] ${title}`)
}
function note(msg) { out.notes.push(msg); console.log(`  NOTE ${msg}`) }

async function getUserId(email) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const u = list.data.users.find(x => x.email === email)
  return u?.id ?? null
}

const ids = {}
async function setup() {
  console.log('\n=== SETUP ===')
  ids.wp = await getUserId('wp-mini@planfully-demo.it')
  ids.fornFoto = await getUserId('forn-mini-foto@planfully-demo.it')
  console.log('IDs:', ids)
  if (!ids.wp || !ids.fornFoto) throw new Error('Utenti base mancanti')
  // Cleanup pregresso
  await admin.from('quotes').delete().ilike('title', `%E2E-HOTFIX%`)
  await admin.from('quotes').delete().ilike('title', `%E2E-TEST%`)
  await admin.from('supplier_clients').delete().ilike('full_name', `%E2E-TEST%`)
  await admin.from('supplier_clients').delete().ilike('full_name', `%E2E-HOTFIX%`)
  for (const d of ['2027-04-17','2027-10-09','2027-06-12']) {
    await admin.from('supplier_availability').delete().eq('fornitore_id', ids.fornFoto).eq('date', d)
  }
  // Profile sanity
  const prof = await admin.from('profiles').select('business_name,full_name,role').eq('id', ids.fornFoto).single()
  note(`fornFoto profile: ${JSON.stringify(prof.data)}`)
}

// helper: chiama RPC come utente specifico via signInWithPassword
async function callRpcAs(userId, rpcName, args={}) {
  const userResp = await fetch(SUPA_URL + '/auth/v1/admin/users/' + userId, {
    headers: { 'authorization': `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  })
  const user = await userResp.json()
  const email = user.email
  const signIn = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method:'POST',
    headers: { apikey: SERVICE_KEY, 'content-type':'application/json' },
    body: JSON.stringify({ email, password: PWD }),
  })
  const sess = await signIn.json()
  if (!sess.access_token) {
    return { ok: false, http: signIn.status, error: sess, data: [] }
  }
  const rpc = await fetch(`${SUPA_URL}/rest/v1/rpc/${rpcName}`, {
    method:'POST',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${sess.access_token}`, 'content-type':'application/json' },
    body: JSON.stringify(args),
  })
  const txt = await rpc.text()
  let parsed
  try { parsed = JSON.parse(txt) } catch { parsed = txt }
  return { ok: rpc.ok, http: rpc.status, data: rpc.ok ? parsed : [], error: rpc.ok ? null : parsed }
}

// ===== SCENARIO A =====
async function scenarioA() {
  console.log('\n=== SCENARIO A — EMAIL_MATCH HIGH ===')
  const date = '2027-04-17'
  const email = 'anna.marco.test+wp@planfully-demo.it'
  const location = 'Villa Rosa Tropea'

  const { data: wpQuote, error: e1 } = await admin.from('quotes').insert({
    owner_id: ids.wp,
    title: `${TEST_MARK} A WP Anna&Marco`,
    client_name: 'Anna & Marco',
    client_email: email,
    event_date: date,
    event_location: location,
    status: 'BOZZA',
    guest_count: 100,
  }).select().single()
  if (e1) { rec('A','1 WP crea preventivo', false, e1.message); return }
  rec('A','1 WP crea preventivo', true, `quote ${wpQuote.id}`)
  ids.wpQuoteA = wpQuote.id

  const { error: e2 } = await admin.from('quote_items').insert({
    quote_id: wpQuote.id, supplier_id: ids.fornFoto,
    name_snapshot: 'Servizio fotografico full day',
    description_snapshot: 'Cerimonia + ricevimento',
    unit_snapshot: 'PEZZO',
    snapshot_price: 2500, quantity: 1, line_cost: 2500, line_client: 2500,
  })
  if (e2) { rec('A','2 voce fornitore', false, e2.message); return }
  rec('A','2 voce fornitore aggiunta', true)

  const { data: sclient, error: ec } = await admin.from('supplier_clients').insert({
    supplier_id: ids.fornFoto,
    full_name: 'Anna & Marco (E2E-HOTFIX)',
    email,
    event_date: date,
    location_text: location,
    status: 'TRATTATIVA',
  }).select().single()
  if (ec) { rec('A','3 cliente diretto', false, ec.message); return }
  rec('A','3 cliente diretto fornitore creato', true)

  const { data: fornQuote, error: efq } = await admin.from('quotes').insert({
    owner_id: ids.fornFoto, direct_client_id: sclient.id,
    title: `${TEST_MARK} A FORN Anna&Marco`,
    client_name: 'Anna & Marco (E2E-HOTFIX)',
    client_email: email,
    event_date: date,
    event_location: location,
    status: 'BOZZA',
  }).select().single()
  if (efq) { rec('A','4 quote diretto fornitore', false, efq.message); return }
  rec('A','4 quote diretto fornitore creato', true, `quote ${fornQuote.id}`)
  ids.fornQuoteA = fornQuote.id

  // RPC come fornitore
  const fornRes = await callRpcAs(ids.fornFoto, 'my_quote_conflict_alerts')
  const wpRes = await callRpcAs(ids.wp, 'my_quote_conflict_alerts')
  out.rpc.A = {
    forn: { http: fornRes.http, ok: fornRes.ok, count: Array.isArray(fornRes.data)?fornRes.data.length:0, sample: Array.isArray(fornRes.data)?fornRes.data.slice(0,3):fornRes.data, error: fornRes.error },
    wp:   { http: wpRes.http,   ok: wpRes.ok,   count: Array.isArray(wpRes.data)?wpRes.data.length:0,   sample: Array.isArray(wpRes.data)?wpRes.data.slice(0,3):wpRes.data,   error: wpRes.error },
  }

  rec('A','5a RPC forn HTTP 200', fornRes.http === 200, `http=${fornRes.http} err=${JSON.stringify(fornRes.error)}`)
  rec('A','5b RPC wp HTTP 200', wpRes.http === 200, `http=${wpRes.http} err=${JSON.stringify(wpRes.error)}`)

  const fornHigh = Array.isArray(fornRes.data) ? fornRes.data.find(a => a.conflict_severity === 'HIGH' && a.my_quote_id === fornQuote.id) : null
  const wpHigh = Array.isArray(wpRes.data) ? wpRes.data.find(a => a.conflict_severity === 'HIGH' && a.my_quote_id === wpQuote.id) : null

  rec('A','6a Fornitore vede alert HIGH', !!fornHigh,
    `severity=${fornHigh?.conflict_severity} signals=${JSON.stringify(fornHigh?.match_signals)} other_owner=${fornHigh?.other_owner_name}`)
  rec('A','6b WP vede alert HIGH', !!wpHigh,
    `severity=${wpHigh?.conflict_severity} signals=${JSON.stringify(wpHigh?.match_signals)} other_owner=${wpHigh?.other_owner_name}`)

  // match_signals devono includere EMAIL_MATCH + LOCATION_MATCH + DATE_MATCH
  const wantedA = ['EMAIL_MATCH','LOCATION_MATCH','DATE_MATCH']
  const fornOK = fornHigh && wantedA.every(s => fornHigh.match_signals?.includes(s))
  const wpOK = wpHigh && wantedA.every(s => wpHigh.match_signals?.includes(s))
  rec('A','7a Forn signals include EMAIL+LOCATION+DATE', !!fornOK, `signals=${JSON.stringify(fornHigh?.match_signals)}`)
  rec('A','7b WP signals include EMAIL+LOCATION+DATE', !!wpOK, `signals=${JSON.stringify(wpHigh?.match_signals)}`)

  if (!fornHigh || !wpHigh || !fornOK || !wpOK) {
    bug('CRITICAL','Scenario A: alert HIGH EMAIL_MATCH non corretto post-hotfix',
      'WP crea quote+voce fornitore; Forn crea cliente+quote diretto stessa email/data/location; RPC entrambi i lati',
      'Forn e WP vedono riga HIGH con signals EMAIL_MATCH+LOCATION_MATCH+DATE_MATCH',
      `forn=${JSON.stringify(fornHigh)} wp=${JSON.stringify(wpHigh)}`)
  }
}

// ===== SCENARIO B =====
async function scenarioB() {
  console.log('\n=== SCENARIO B — LOCATION_MATCH MEDIUM mascherato ===')
  const date = '2027-10-09'
  const location = 'Tenuta degli Ulivi, Lecce'

  const { data: wpQuote, error: e1 } = await admin.from('quotes').insert({
    owner_id: ids.wp,
    title: `${TEST_MARK} B WP Giulia&Stefano`,
    client_name: 'Giulia Bianchi & Stefano Verdi',
    client_email: 'giulia.b.dec2027@example.com',
    event_date: date,
    event_location: location,
    status: 'BOZZA',
  }).select().single()
  if (e1) { rec('B','1 WP crea preventivo', false, e1.message); return }
  rec('B','1 WP crea preventivo', true, `quote ${wpQuote.id}`)
  ids.wpQuoteB = wpQuote.id

  const { error: e2 } = await admin.from('quote_items').insert({
    quote_id: wpQuote.id, supplier_id: ids.fornFoto,
    name_snapshot: 'foto', snapshot_price: 2000, quantity: 1, line_cost: 2000, line_client: 2000,
  })
  if (e2) { rec('B','2 voce fornitore', false, e2.message); return }
  rec('B','2 voce fornitore aggiunta', true)

  const { data: sc, error: esc } = await admin.from('supplier_clients').insert({
    supplier_id: ids.fornFoto,
    full_name: 'Sig.ra G. Bianchi (E2E-HOTFIX)',
    email: 'giulia99@altra.it',
    event_date: date,
    location_text: location,
    status: 'TRATTATIVA',
  }).select().single()
  if (esc) { rec('B','3 cliente diretto', false, esc.message); return }
  rec('B','3 cliente diretto creato (nome+email diversi)', true)

  const { data: fQuote, error: efq } = await admin.from('quotes').insert({
    owner_id: ids.fornFoto, direct_client_id: sc.id,
    title: `${TEST_MARK} B FORN G.Bianchi`,
    client_name: 'Sig.ra G. Bianchi (E2E-HOTFIX)',
    client_email: 'giulia99@altra.it',
    event_date: date,
    event_location: location,
    status: 'BOZZA',
  }).select().single()
  if (efq) { rec('B','4 quote diretto', false, efq.message); return }
  rec('B','4 quote diretto fornitore creato', true)
  ids.fornQuoteB = fQuote.id

  const fornRes = await callRpcAs(ids.fornFoto, 'my_quote_conflict_alerts')
  const wpRes = await callRpcAs(ids.wp, 'my_quote_conflict_alerts')
  out.rpc.B = {
    forn: { http: fornRes.http, ok: fornRes.ok, count: Array.isArray(fornRes.data)?fornRes.data.length:0, sample: Array.isArray(fornRes.data)?fornRes.data.slice(0,5):fornRes.data, error: fornRes.error },
    wp:   { http: wpRes.http,   ok: wpRes.ok,   count: Array.isArray(wpRes.data)?wpRes.data.length:0,   sample: Array.isArray(wpRes.data)?wpRes.data.slice(0,5):wpRes.data,   error: wpRes.error },
  }

  rec('B','5a RPC forn HTTP 200', fornRes.http === 200, `http=${fornRes.http}`)
  rec('B','5b RPC wp HTTP 200', wpRes.http === 200, `http=${wpRes.http}`)

  const fornHit = Array.isArray(fornRes.data) ? fornRes.data.find(a => a.my_quote_id === fQuote.id) : null
  const wpHit = Array.isArray(wpRes.data) ? wpRes.data.find(a => a.my_quote_id === wpQuote.id) : null

  const isLocOnly = (h) => h && h.match_signals?.includes('LOCATION_MATCH')
    && h.match_signals?.includes('DATE_MATCH')
    && !h.match_signals?.includes('EMAIL_MATCH')
    && !h.match_signals?.includes('NAME_EXACT')

  rec('B','6a Forn vede alert MEDIUM LOCATION-only',
    !!isLocOnly(fornHit) && fornHit?.conflict_severity === 'MEDIUM',
    `severity=${fornHit?.conflict_severity} signals=${JSON.stringify(fornHit?.match_signals)}`)
  rec('B','6b WP vede alert MEDIUM LOCATION-only',
    !!isLocOnly(wpHit) && wpHit?.conflict_severity === 'MEDIUM',
    `severity=${wpHit?.conflict_severity} signals=${JSON.stringify(wpHit?.match_signals)}`)

  if (!fornHit || !wpHit || !isLocOnly(fornHit) || !isLocOnly(wpHit) || fornHit?.conflict_severity !== 'MEDIUM' || wpHit?.conflict_severity !== 'MEDIUM') {
    bug('CRITICAL','Scenario B: LOCATION_MATCH mascherato non rilevato correttamente',
      'WP+Forn stessa location/data, nome+email DIVERSI',
      'Entrambi lato vedono row MEDIUM con signals=[LOCATION_MATCH,DATE_MATCH] (no EMAIL_MATCH, no NAME_EXACT)',
      `forn=${JSON.stringify(fornHit)} wp=${JSON.stringify(wpHit)}`)
  }
}

// ===== UI banner check =====
async function uiCheck(browser) {
  console.log('\n=== UI — ConflictAlertsBanner ===')

  // WP
  const ctxWP = await browser.newContext()
  const wpPage = await ctxWP.newPage()
  try {
    await wpPage.goto(`${PROD}/login`, { waitUntil: 'networkidle', timeout: 30000 })
    await wpPage.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")').first().click({ timeout: 3000 }).catch(()=>{})
    await wpPage.getByLabel(/email/i).fill('wp-mini@planfully-demo.it')
    await wpPage.getByLabel(/password/i).fill(PWD)
    await wpPage.getByRole('button', { name: /^Accedi$/i }).click()
    await wpPage.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{})
    await new Promise(r => setTimeout(r, 4000))
    const shotPath = path.join(RUN_DIR, 'ui-wp-home.png')
    await wpPage.screenshot({ path: shotPath, fullPage: true })
    const txt = await wpPage.locator('body').innerText().catch(()=>'')
    const hasBeta = /beta/i.test(txt)
    const hasAlert = /conflitt|alert|disintermediaz|stesso fornitore|stessa data|stessa location/i.test(txt)
    out.ui.wp = { screenshot: shotPath, hasBeta, hasAlert, sampleText: txt.slice(0, 800) }
    rec('A','UI WP banner Beta visibile', hasBeta, hasBeta ? 'OK' : 'mancante')
    rec('A','UI WP ConflictAlertsBanner visibile', hasAlert, hasAlert ? 'testo trovato' : 'mancante')
    if (!hasAlert) bug('HIGH','ConflictAlertsBanner non visibile lato WP post-hotfix',
      'WP ha alert HIGH+MEDIUM via RPC, apre /', 'Banner rosa con conteggio conflitti', 'banner assente')
  } catch (e) {
    rec('A','UI WP flow', false, e.message)
  }
  await ctxWP.close()

  // Fornitore
  const ctxF = await browser.newContext()
  const fPage = await ctxF.newPage()
  try {
    await fPage.goto(`${PROD}/login`, { waitUntil: 'networkidle', timeout: 30000 })
    await fPage.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")').first().click({ timeout: 3000 }).catch(()=>{})
    await fPage.getByLabel(/email/i).fill('forn-mini-foto@planfully-demo.it')
    await fPage.getByLabel(/password/i).fill(PWD)
    await fPage.getByRole('button', { name: /^Accedi$/i }).click()
    await fPage.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{})
    await new Promise(r => setTimeout(r, 4000))
    const shotPath = path.join(RUN_DIR, 'ui-forn-home.png')
    await fPage.screenshot({ path: shotPath, fullPage: true })
    const txt = await fPage.locator('body').innerText().catch(()=>'')
    const hasBeta = /beta/i.test(txt)
    const hasAlert = /conflitt|alert|disintermediaz|stesso fornitore|stessa data|stessa location/i.test(txt)
    out.ui.forn = { screenshot: shotPath, hasBeta, hasAlert, sampleText: txt.slice(0, 800) }
    rec('B','UI Forn banner Beta visibile', hasBeta, hasBeta ? 'OK' : 'mancante')
    rec('B','UI Forn ConflictAlertsBanner visibile', hasAlert, hasAlert ? 'testo trovato' : 'mancante')
    if (!hasAlert) bug('HIGH','ConflictAlertsBanner non visibile lato Fornitore post-hotfix',
      'Fornitore con quote diretto in conflitto, apre /', 'Banner con conteggio alert', 'banner assente')
  } catch (e) {
    rec('B','UI Forn flow', false, e.message)
  }
  await ctxF.close()
}

async function cleanup() {
  console.log('\n=== CLEANUP ===')
  await admin.from('quotes').delete().ilike('title', `%E2E-HOTFIX%`)
  await admin.from('quotes').delete().ilike('title', `%E2E-TEST%`)
  await admin.from('supplier_clients').delete().ilike('full_name', `%E2E-HOTFIX%`)
  await admin.from('supplier_clients').delete().ilike('full_name', `%E2E-TEST%`)
  for (const d of ['2027-04-17','2027-10-09']) {
    await admin.from('supplier_availability').delete().eq('fornitore_id', ids.fornFoto).eq('date', d)
  }
  console.log('cleanup done')
}

// MAIN
const browser = await chromium.launch({ headless: true })
try {
  await setup()
  await scenarioA()
  await scenarioB()
  await uiCheck(browser)
} catch (e) {
  console.error('FATAL', e)
  out.notes.push('FATAL: ' + e.message + '\n' + e.stack)
} finally {
  await cleanup().catch(e => console.error('cleanup err', e))
  await browser.close()
}

writeFileSync(path.join(RUN_DIR, 'results.json'), JSON.stringify(out, null, 2))

// REPORT.md
const lines = []
lines.push(`# E2E Conflict Hotfix Replay — REPORT`)
lines.push('')
lines.push(`**Run:** ${RUN_TS}`)
lines.push(`**Target:** ${PROD}`)
lines.push(`**DB:** ${SUPA_URL}`)
lines.push(`**Hotfix migration:** 20260525200000_fix_conflict_alerts_owner_name.sql`)
lines.push('')

// Verdict
const aFornOK = out.rpc.A?.forn?.sample?.some?.(a => a.conflict_severity === 'HIGH'
  && a.match_signals?.includes('EMAIL_MATCH') && a.match_signals?.includes('LOCATION_MATCH') && a.match_signals?.includes('DATE_MATCH'))
const aWpOK = out.rpc.A?.wp?.sample?.some?.(a => a.conflict_severity === 'HIGH'
  && a.match_signals?.includes('EMAIL_MATCH') && a.match_signals?.includes('LOCATION_MATCH') && a.match_signals?.includes('DATE_MATCH'))
const bFornOK = out.rpc.B?.forn?.sample?.some?.(a => a.conflict_severity === 'MEDIUM'
  && a.match_signals?.includes('LOCATION_MATCH') && a.match_signals?.includes('DATE_MATCH')
  && !a.match_signals?.includes('EMAIL_MATCH') && !a.match_signals?.includes('NAME_EXACT'))
const bWpOK = out.rpc.B?.wp?.sample?.some?.(a => a.conflict_severity === 'MEDIUM'
  && a.match_signals?.includes('LOCATION_MATCH') && a.match_signals?.includes('DATE_MATCH')
  && !a.match_signals?.includes('EMAIL_MATCH') && !a.match_signals?.includes('NAME_EXACT'))

const rpcAllOK = aFornOK && aWpOK && bFornOK && bWpOK
const uiOK = !!(out.ui.wp?.hasAlert && out.ui.forn?.hasAlert)
const verdict = rpcAllOK ? (uiOK ? 'HOTFIX OK (RPC + UI)' : 'HOTFIX RPC OK / UI banner ancora rotto') : 'HOTFIX ANCORA ROTTO'

lines.push(`## Verdetto: **${verdict}**`)
lines.push('')
lines.push(`- RPC Scenario A forn HIGH+EMAIL+LOC+DATE: ${aFornOK ? 'PASS' : 'FAIL'}`)
lines.push(`- RPC Scenario A wp   HIGH+EMAIL+LOC+DATE: ${aWpOK ? 'PASS' : 'FAIL'}`)
lines.push(`- RPC Scenario B forn MEDIUM LOC-only:     ${bFornOK ? 'PASS' : 'FAIL'}`)
lines.push(`- RPC Scenario B wp   MEDIUM LOC-only:     ${bWpOK ? 'PASS' : 'FAIL'}`)
lines.push(`- UI WP banner alert visibile:             ${out.ui.wp?.hasAlert ? 'PASS' : 'FAIL'}`)
lines.push(`- UI Forn banner alert visibile:           ${out.ui.forn?.hasAlert ? 'PASS' : 'FAIL'}`)
lines.push('')

lines.push(`## RPC Status`)
lines.push('### Scenario A (EMAIL_MATCH HIGH)')
lines.push('```json')
lines.push(JSON.stringify(out.rpc.A, null, 2))
lines.push('```')
lines.push('### Scenario B (LOCATION_MATCH MEDIUM mascherato)')
lines.push('```json')
lines.push(JSON.stringify(out.rpc.B, null, 2))
lines.push('```')
lines.push('')

lines.push(`## Step results`)
for (const [sc, steps] of Object.entries(out.scenarios)) {
  lines.push(`### Scenario ${sc}`)
  for (const s of steps) lines.push(`- ${s.pass?'PASS':'FAIL'} — ${s.step}${s.info?` (${s.info})`:''}`)
  lines.push('')
}

lines.push(`## BUG`)
if (!out.bugs.length) lines.push('Nessun bug rilevato.')
for (const b of out.bugs) {
  lines.push(`### [${b.severity}] ${b.title}`)
  lines.push(`**Repro:** ${b.repro}`)
  lines.push(`**Expected:** ${b.expected}`)
  lines.push(`**Actual:** ${b.actual}`)
  lines.push('')
}

lines.push(`## NOTES`)
for (const n of out.notes) lines.push(`- ${n}`)
lines.push('')

lines.push(`## File`)
lines.push(`- Screenshot WP: ${out.ui.wp?.screenshot ?? '(missing)'}`)
lines.push(`- Screenshot Forn: ${out.ui.forn?.screenshot ?? '(missing)'}`)
lines.push(`- ${path.join(RUN_DIR, 'results.json')}`)

writeFileSync(path.join(RUN_DIR, 'REPORT.md'), lines.join('\n'))
console.log('\nREPORT:', path.join(RUN_DIR, 'REPORT.md'))
console.log('VERDICT:', verdict)
