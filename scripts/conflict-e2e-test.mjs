#!/usr/bin/env node
/**
 * E2E test anti-disintermediazione + standalone supplier + beta banner.
 * Hybrid: setup via Supabase service-role + UI verification via Playwright.
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = path.resolve(__dirname, `../audit-runs/conflict-test-${RUN_TS}`)
mkdirSync(RUN_DIR, { recursive: true })

const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const PROD = 'https://planfully.it'
const PWD = 'Beta2026!'

const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

const results = { scenarios: { A: [], B: [], C: [], D: [] }, bugs: [], notes: [] }

function rec(scenario, step, pass, info='') {
  const r = { step, pass, info, ts: new Date().toISOString() }
  results.scenarios[scenario].push(r)
  console.log(`[${scenario}] ${pass?'PASS':'FAIL'} ${step}${info?' — '+info:''}`)
}
function bug(severity, title, repro, expected, actual) {
  results.bugs.push({ severity, title, repro, expected, actual })
  console.log(`  BUG [${severity}] ${title}`)
}
function note(msg) { results.notes.push(msg); console.log(`  NOTE ${msg}`) }

// Fetch user ids
async function getUserId(email) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const u = list.data.users.find(x => x.email === email)
  return u?.id ?? null
}

async function getAnonClient(email) {
  // Use anon flow — we don't have anon key handy but service key works for sign in too
  // Better: create a client with service role and use signInWithPassword via auth.admin
  // Approach: use service role to issue a session for the user.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) console.error('magiclink err', error)
  return data
}

const TEST_MARK = 'E2E-TEST-' + RUN_TS

const ids = {}

async function setup() {
  console.log('\n=== SETUP ===')
  ids.wp = await getUserId('wp-mini@planfully-demo.it')
  ids.fornFoto = await getUserId('forn-mini-foto@planfully-demo.it')
  ids.fornFiori = await getUserId('forn-mini-fiori@planfully-demo.it')
  console.log('IDs:', ids)
  if (!ids.wp || !ids.fornFoto) throw new Error('Utenti base mancanti')

  // Cleanup pregresso (per ripetibilità)
  await admin.from('quotes').delete().like('title', `%${TEST_MARK.split('-')[0]}%`)
  await admin.from('supplier_clients').delete().like('full_name', `%E2E-TEST%`)
}

// --- SCENARIO A: EMAIL_MATCH classico ---
async function scenarioA() {
  console.log('\n=== SCENARIO A ===')
  const date = '2027-04-17'
  const email = 'anna.marco.test+wp@planfully-demo.it'
  const location = 'Villa Rosa Tropea'

  // A1 WP crea preventivo
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
  rec('A', '1 WP crea preventivo', true, `quote ${wpQuote.id}`)

  // Aggiungi voce con supplier_id = fornFoto
  const { error: e2 } = await admin.from('quote_items').insert({
    quote_id: wpQuote.id,
    supplier_id: ids.fornFoto,
    name_snapshot: 'Servizio fotografico full day',
    description_snapshot: 'Cerimonia + ricevimento',
    unit_snapshot: 'PEZZO',
    snapshot_price: 2500,
    quantity: 1,
    line_cost: 2500,
    line_client: 2500,
  })
  if (e2) { rec('A','2 voce fornitore', false, e2.message); return }
  rec('A','2 voce fornitore aggiunta', true)

  // A3 verifica alert WP = 0 (manca quote diretto fornitore)
  const wpUser = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'wp-mini@planfully-demo.it' })
  // più semplice: client per-utente con anon impersonation. Usiamo direttamente service role: simuliamo settando auth.uid via custom Postgres role NON è possibile. Quindi richiediamo direttamente la tabella
  const wpAlertsBefore = await callRpcAs(ids.wp, 'my_quote_conflict_alerts')
  rec('A','3 nessun alert prima del quote diretto', wpAlertsBefore.length === 0, `alerts=${wpAlertsBefore.length}`)

  // A4 fornitore crea cliente diretto + quote diretto
  const { data: sclient, error: ec } = await admin.from('supplier_clients').insert({
    supplier_id: ids.fornFoto,
    full_name: 'Anna & Marco (E2E-TEST)',
    email: email,
    event_date: date,
    location_text: location,
    status: 'TRATTATIVA',
  }).select().single()
  if (ec) { rec('A','4a cliente diretto fornitore', false, ec.message); return }
  rec('A','4a cliente diretto fornitore creato', true)

  const { data: fornQuote, error: efq } = await admin.from('quotes').insert({
    owner_id: ids.fornFoto,
    direct_client_id: sclient.id,
    title: `${TEST_MARK} A FORN Anna&Marco`,
    client_name: 'Anna & Marco (E2E-TEST)',
    client_email: email,
    event_date: date,
    event_location: location,
    status: 'BOZZA',
  }).select().single()
  if (efq) { rec('A','4b quote diretto fornitore', false, efq.message); return }
  rec('A','4b quote diretto fornitore creato', true, `quote ${fornQuote.id}`)
  ids.fornQuoteA = fornQuote.id

  // A5 verifica alert WP E fornitore
  const wpAlerts = await callRpcAs(ids.wp, 'my_quote_conflict_alerts')
  const fornAlerts = await callRpcAs(ids.fornFoto, 'my_quote_conflict_alerts')
  const wpHigh = wpAlerts.find(a => a.conflict_severity === 'HIGH' && a.my_quote_id === wpQuote.id)
  const fornHigh = fornAlerts.find(a => a.conflict_severity === 'HIGH' && a.my_quote_id === fornQuote.id)
  rec('A','5 WP vede alert HIGH', !!wpHigh, JSON.stringify(wpHigh?.match_signals))
  rec('A','5 Fornitore vede alert HIGH', !!fornHigh, JSON.stringify(fornHigh?.match_signals))
  if (!wpHigh) bug('CRITICAL','WP non vede alert HIGH EMAIL_MATCH',
    'WP crea quote con email X + voce supplier S; S crea quote diretto stessa email stessa data; chiamare my_quote_conflict_alerts come WP',
    'Riga con conflict_severity=HIGH, match_signals contiene EMAIL_MATCH + DATE_MATCH',
    `alerts=${JSON.stringify(wpAlerts)}`)
  if (!fornHigh) bug('CRITICAL','Fornitore non vede alert HIGH EMAIL_MATCH',
    'Setup come sopra; chiamare RPC come fornitore', 'Riga HIGH', `alerts=${JSON.stringify(fornAlerts)}`)

  // A6 forn segna quote INVIATO -> availability TENTATIVE
  await admin.from('quotes').update({ status: 'INVIATO', sent_at: new Date().toISOString() }).eq('id', fornQuote.id)
  const avail1 = await admin.from('supplier_availability').select('*').eq('fornitore_id', ids.fornFoto).eq('date', date).maybeSingle()
  rec('A','6 availability TENTATIVE su INVIATO', avail1.data?.status === 'TENTATIVE', `status=${avail1.data?.status}`)
  if (avail1.data?.status !== 'TENTATIVE') bug('HIGH','Trigger auto_block_availability_from_quote non setta TENTATIVE',
    'UPDATE quotes SET status=INVIATO WHERE id=fornQuote (direct)',
    'supplier_availability row con status=TENTATIVE', `status=${avail1.data?.status ?? '<no row>'}`)

  // A7 forn ACCETTATO -> BUSY
  await admin.from('quotes').update({ status: 'ACCETTATO', accepted_at: new Date().toISOString() }).eq('id', fornQuote.id)
  const avail2 = await admin.from('supplier_availability').select('*').eq('fornitore_id', ids.fornFoto).eq('date', date).maybeSingle()
  rec('A','7 availability BUSY su ACCETTATO', avail2.data?.status === 'BUSY', `status=${avail2.data?.status}`)
  if (avail2.data?.status !== 'BUSY') bug('HIGH','Trigger non passa ad BUSY su ACCETTATO',
    'UPDATE quotes SET status=ACCETTATO', 'status=BUSY', `status=${avail2.data?.status}`)

  // A8 prova ad inserire quote_item con supplier BUSY → deve fallire
  const { data: newQ } = await admin.from('quotes').insert({
    owner_id: ids.wp,
    title: `${TEST_MARK} A WP nuovo`,
    client_name: 'Test Block',
    event_date: date,
    status: 'BOZZA',
  }).select().single()
  const { error: blockErr } = await admin.from('quote_items').insert({
    quote_id: newQ.id, supplier_id: ids.fornFoto,
    name_snapshot: 'foto', snapshot_price: 100, quantity: 1, line_cost: 100, line_client: 100,
  })
  const blocked = !!blockErr && /non disponibile/i.test(blockErr.message || '')
  rec('A','8 block_busy_supplier_on_quote_item rifiuta voce', blocked, blockErr?.message ?? 'NESSUN ERRORE')
  if (!blocked) bug('HIGH','Trigger block_busy_supplier non blocca inserimento',
    'INSERT quote_items con supplier_id BUSY su quella data', 'errore P0001 "Fornitore non disponibile"', blockErr?.message ?? 'nessun errore')
  // pulisci la quote di prova
  await admin.from('quotes').delete().eq('id', newQ.id)
}

// --- SCENARIO B: LOCATION_MATCH-only ---
async function scenarioB() {
  console.log('\n=== SCENARIO B ===')
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

  const { error: e2 } = await admin.from('quote_items').insert({
    quote_id: wpQuote.id, supplier_id: ids.fornFoto,
    name_snapshot: 'foto', snapshot_price: 2000, quantity: 1, line_cost: 2000, line_client: 2000,
  })
  if (e2) {
    // forse fornFoto BUSY su date 2027-10-09? questa data è diversa quindi non dovrebbe
    rec('B','2 voce fornitore', false, e2.message); return
  }
  rec('B','2 voce fornitore', true)

  // Fornitore: cliente diretto con NOME E EMAIL DIVERSI, stessa data + stessa location
  const { data: sc, error: esc } = await admin.from('supplier_clients').insert({
    supplier_id: ids.fornFoto,
    full_name: 'Sig.ra G. Bianchi (E2E-TEST)',
    email: 'giulia99@altra.it',
    event_date: date,
    location_text: location,
    status: 'TRATTATIVA',
  }).select().single()
  if (esc) { rec('B','3 cliente diretto', false, esc.message); return }
  rec('B','3 cliente diretto creato', true)

  const { data: fQuote, error: efq } = await admin.from('quotes').insert({
    owner_id: ids.fornFoto,
    direct_client_id: sc.id,
    title: `${TEST_MARK} B FORN G.Bianchi`,
    client_name: 'Sig.ra G. Bianchi (E2E-TEST)',
    client_email: 'giulia99@altra.it',
    event_date: date,
    event_location: location,
    status: 'BOZZA',
  }).select().single()
  if (efq) { rec('B','4 quote diretto', false, efq.message); return }
  rec('B','4 quote diretto fornitore creato', true)

  const wpAlerts = await callRpcAs(ids.wp, 'my_quote_conflict_alerts')
  const fornAlerts = await callRpcAs(ids.fornFoto, 'my_quote_conflict_alerts')
  const wpHit = wpAlerts.find(a => a.my_quote_id === wpQuote.id)
  const fornHit = fornAlerts.find(a => a.my_quote_id === fQuote.id)

  const wpLocOnly = wpHit && wpHit.match_signals?.includes('LOCATION_MATCH') && !wpHit.match_signals?.includes('EMAIL_MATCH') && !wpHit.match_signals?.includes('NAME_EXACT')
  rec('B','5 WP vede alert con LOCATION_MATCH (no email/name)', !!wpLocOnly,
    `severity=${wpHit?.conflict_severity} signals=${JSON.stringify(wpHit?.match_signals)}`)
  if (!wpHit) bug('CRITICAL','Disintermediazione mascherata non rilevata da WP (LOCATION_MATCH)',
    'WP crea quote con location L + voce fornitore F; F crea quote diretto stessa data, stessa location, nome+email DIVERSI; chiamare my_quote_conflict_alerts come WP',
    'Riga con conflict_severity=MEDIUM, match_signals=[LOCATION_MATCH, DATE_MATCH]',
    `alerts=${JSON.stringify(wpAlerts)}`)
  else if (!wpHit.match_signals?.includes('LOCATION_MATCH')) bug('HIGH','WP alert manca LOCATION_MATCH signal',
    'Vedi B5', 'match_signals include LOCATION_MATCH', `match_signals=${JSON.stringify(wpHit.match_signals)}`)

  rec('B','5b Fornitore vede alert', !!fornHit, `severity=${fornHit?.conflict_severity} signals=${JSON.stringify(fornHit?.match_signals)}`)
  if (!fornHit) bug('CRITICAL','Fornitore non vede alert disintermediazione mascherata',
    'Vedi B', 'Alert con LOCATION_MATCH', `alerts=${JSON.stringify(fornAlerts)}`)

  // Severity dovrebbe essere MEDIUM (no email, no name, solo location)
  if (wpHit && wpHit.conflict_severity !== 'MEDIUM') bug('MEDIUM',`Severity errata: atteso MEDIUM, ottenuto ${wpHit.conflict_severity}`,
    'Scenario B: solo location coincide', 'MEDIUM', wpHit.conflict_severity)
}

// --- SCENARIO C: PDF brand fornitore ---
async function scenarioC(browser) {
  console.log('\n=== SCENARIO C ===')
  // Profilo fornitore già ha business_name e brand_logo (Marco Bianchi Photography). Verifica
  const prof = await admin.from('profiles').select('business_name,brand_logo_url,brand_primary_color,role,subrole,full_name').eq('id', ids.fornFoto).single()
  rec('C','1 profilo fornitore con brand', !!prof.data?.business_name, JSON.stringify(prof.data))

  // Setta subrole=fotografo se mancante
  if (!prof.data?.subrole) {
    await admin.from('profiles').update({ subrole: 'fotografo' }).eq('id', ids.fornFoto)
    note('subrole settato a fotografo via setup')
  }

  // Crea cliente diretto + quote standalone con voci
  const date = '2027-06-12'
  const { data: sc } = await admin.from('supplier_clients').insert({
    supplier_id: ids.fornFoto,
    full_name: 'Cliente PDF Test (E2E-TEST)',
    email: 'pdf.test@example.com',
    event_date: date,
    location_text: 'Casale Roma',
    status: 'TRATTATIVA',
  }).select().single()

  const { data: q, error: eq } = await admin.from('quotes').insert({
    owner_id: ids.fornFoto,
    direct_client_id: sc.id,
    title: `${TEST_MARK} C PDF Cliente Test`,
    client_name: 'Famiglia Rossi',
    client_email: 'pdf.test@example.com',
    event_date: date,
    event_location: 'Casale Roma',
    status: 'BOZZA',
    guest_count: 80,
  }).select().single()
  if (eq) { rec('C','2 quote diretto creato', false, eq.message); return }
  rec('C','2 quote diretto creato', true, `quote ${q.id}`)
  ids.fornQuoteC = q.id

  // Aggiungi 3 voci
  for (const [name, price, qty] of [['Cerimonia fotografica',1200,1],['Album premium',450,1],['Stampe extra',12,30]]) {
    await admin.from('quote_items').insert({
      quote_id: q.id, supplier_id: ids.fornFoto,
      name_snapshot: name, snapshot_price: price, quantity: qty,
      line_cost: price*qty, line_client: price*qty,
    })
  }
  // Aggiorna totali
  await admin.from('quotes').update({ total_cost: 2010, total_client: 2010 }).eq('id', q.id)

  // Invoca edge function quote-generate-pdf con service role
  const fnUrl = `${SUPA_URL}/functions/v1/quote-generate-pdf`
  const resp = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${SERVICE_KEY}`, 'content-type':'application/json' },
    body: JSON.stringify({ quote_id: q.id, variant: 'NEUTRA' }),
  })
  if (!resp.ok) {
    rec('C','3 chiamata edge function PDF', false, `HTTP ${resp.status} ${await resp.text()}`)
    return
  }
  const pdfData = await resp.json()
  rec('C','3 edge function risponde', true, JSON.stringify(pdfData).slice(0,200))

  // PDF probabilmente arriva come URL o base64
  let pdfPath = null
  if (pdfData.pdf_url) {
    const pdfResp = await fetch(pdfData.pdf_url)
    const buf = Buffer.from(await pdfResp.arrayBuffer())
    pdfPath = path.join(RUN_DIR, 'scenario-C-quote.pdf')
    writeFileSync(pdfPath, buf)
    rec('C','4 PDF scaricato', true, `${pdfPath} (${buf.length} bytes)`)
  } else if (pdfData.pdf_base64) {
    const buf = Buffer.from(pdfData.pdf_base64, 'base64')
    pdfPath = path.join(RUN_DIR, 'scenario-C-quote.pdf')
    writeFileSync(pdfPath, buf)
    rec('C','4 PDF scaricato (base64)', true, `${pdfPath} (${buf.length} bytes)`)
  } else {
    rec('C','4 PDF response shape', false, `keys=${Object.keys(pdfData).join(',')}`)
  }

  if (pdfPath) {
    // Estrai testo per verifica brand. usiamo pdftotext se disponibile
    try {
      const { execSync } = await import('node:child_process')
      const txt = execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf8' })
      writeFileSync(pdfPath.replace('.pdf','.txt'), txt)
      const hasOwnerBrand = /Marco Bianchi Photography/i.test(txt)
      const hasWpBrand = /Sara De Luca|Beta Wedding Studio/i.test(txt)
      const hasFotografo = /fotografo|Fornitore/i.test(txt)
      const hasWedPlanner = /Wedding planner/i.test(txt)
      rec('C','5a PDF mostra brand fornitore (Marco Bianchi Photography)', hasOwnerBrand, hasOwnerBrand?'OK':`testo testa: ${txt.slice(0,200)}`)
      rec('C','5b PDF NON contiene brand WP', !hasWpBrand, hasWpBrand ? 'TROVATO BRAND WP NEL PDF FORNITORE!' : 'OK')
      rec('C','5c PDF subtitle role-aware (fotografo/Fornitore, NO Wedding planner)', hasFotografo && !hasWedPlanner, `fotografo=${hasFotografo} wp=${hasWedPlanner}`)
      if (hasWpBrand) bug('CRITICAL','PDF preventivo diretto fornitore mostra brand WP',
        'Fornitore crea quote standalone, genera PDF NEUTRA via edge function quote-generate-pdf',
        'PDF mostra business_name e logo del FORNITORE',
        `PDF testo contiene Sara De Luca/Beta Wedding Studio: ${hasWpBrand}`)
      if (hasWedPlanner) bug('HIGH','PDF subtitle dice Wedding planner per fornitore',
        'Fornitore (role=FORNITORE) genera PDF standalone',
        'subtitle = subrole (fotografo) o "Fornitore"',
        `PDF contiene "Wedding planner": ${hasWedPlanner}`)
      if (!hasOwnerBrand) bug('HIGH','PDF non contiene business_name fornitore',
        'Vedi C', 'business_name=Marco Bianchi Photography in cover', `presente=${hasOwnerBrand}`)
    } catch (e) {
      note(`pdftotext non disponibile (${e.message}). Sotto: verifica visiva manuale.`)
      // Apri il PDF con headless + screenshot pagina 1
      try {
        const page = await browser.newPage()
        await page.goto('file://' + pdfPath)
        await new Promise(r => setTimeout(r, 1500))
        await page.screenshot({ path: pdfPath.replace('.pdf','.png'), fullPage: false })
        await page.close()
      } catch {}
    }
  }
}

// --- SCENARIO D: Beta banner via UI ---
async function scenarioD(browser) {
  console.log('\n=== SCENARIO D ===')
  // Verifica via DB che beta_status sia configurato
  const { data: betaStatus } = await admin.from('beta_status').select('*')
  rec('D','0 tabella beta_status accessibile', Array.isArray(betaStatus), `rows=${betaStatus?.length}`)
  if (betaStatus && betaStatus.length) note('beta_status rows: ' + JSON.stringify(betaStatus))

  // Login WP via UI
  const ctxWP = await browser.newContext()
  const wpPage = await ctxWP.newPage()
  try {
    await wpPage.goto(`${PROD}/login`, { waitUntil: 'networkidle', timeout: 30000 })
    // dismiss cookie
    await wpPage.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")').first().click({ timeout: 3000 }).catch(()=>{})
    await wpPage.getByLabel(/email/i).fill('wp-mini@planfully-demo.it')
    await wpPage.getByLabel(/password/i).fill(PWD)
    await wpPage.getByRole('button', { name: /^Accedi$/i }).click()
    await wpPage.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{})
    await new Promise(r => setTimeout(r, 2500))
    await wpPage.screenshot({ path: path.join(RUN_DIR, 'D-01-wp-home.png'), fullPage: true })

    // Cerca banner beta
    const wpBetaText = await wpPage.locator('body').innerText().catch(()=>'')
    const hasWpBeta = /beta/i.test(wpBetaText)
    rec('D','1 banner Beta visibile per WP', hasWpBeta, hasWpBeta? '"beta" trovato in pagina' : 'NESSUN testo beta')
    // Cerca specifico testo "partner fondatori" o "gratuita"
    const hasWpSpecific = /partner fondatori|gratis fino al|gratuita/i.test(wpBetaText)
    rec('D','1b testo specifico WP (partner fondatori/gratis fino al)', hasWpSpecific, hasWpSpecific?'OK':'banner generico o assente')

    // Cerca "scopri di più"
    const scopri = wpPage.locator('button:has-text("scopri di"), text=/scopri di pi/i').first()
    if (await scopri.count() > 0) {
      await scopri.click().catch(()=>{})
      await new Promise(r => setTimeout(r, 600))
      await wpPage.screenshot({ path: path.join(RUN_DIR, 'D-02-wp-banner-expanded.png'), fullPage: false })
      rec('D','2 click scopri di più → si espande', true)
    } else {
      rec('D','2 click scopri di più', false, 'pulsante non trovato')
    }

    // Cerca X close
    const closeBtn = wpPage.locator('button[aria-label*="chiudi" i], [data-testid*="beta-close"], button:has-text("×")').first()
    if (await closeBtn.count() > 0) {
      await closeBtn.click().catch(()=>{})
      await new Promise(r => setTimeout(r, 500))
      rec('D','3 click close → banner chiuso', true)
    } else {
      rec('D','3 close button del banner', false, 'pulsante X non trovato (cercato aria-label)')
    }
  } catch (e) {
    rec('D','WP login flow', false, e.message)
  }
  await ctxWP.close()

  // Login Fornitore
  const ctxF = await browser.newContext()
  const fPage = await ctxF.newPage()
  try {
    await fPage.goto(`${PROD}/login`, { waitUntil: 'networkidle', timeout: 30000 })
    await fPage.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")').first().click({ timeout: 3000 }).catch(()=>{})
    await fPage.getByLabel(/email/i).fill('forn-mini-foto@planfully-demo.it')
    await fPage.getByLabel(/password/i).fill(PWD)
    await fPage.getByRole('button', { name: /^Accedi$/i }).click()
    await fPage.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{})
    await new Promise(r => setTimeout(r, 2500))
    await fPage.screenshot({ path: path.join(RUN_DIR, 'D-10-forn-home.png'), fullPage: true })

    const text = await fPage.locator('body').innerText().catch(()=>'')
    const hasBeta = /beta/i.test(text)
    rec('D','4 banner Beta visibile per Fornitore', hasBeta, hasBeta?'OK':'banner assente')
    const hasFornSpec = /€29\s*\/\s*mese|29.*mese|ottobre 2026/i.test(text)
    rec('D','4b testo "€29/mese" o "ottobre 2026" per fornitore', hasFornSpec, hasFornSpec?'OK':'testo specifico non trovato')

    // Verifica ConflictAlertsBanner: scenario A/B dovrebbero aver popolato alert
    const hasAlertBanner = /conflitt|alert|disintermediaz|stesso fornitore|stessa data/i.test(text)
    rec('D','5 banner ConflictAlerts visibile per fornitore (Scenari A/B attivi)', hasAlertBanner, hasAlertBanner?'OK':'NON visibile')
    if (!hasAlertBanner) bug('HIGH','ConflictAlertsBanner non si renderizza in dashboard fornitore nonostante alert RPC',
      'Fornitore con quote diretto in conflitto, apre dashboard',
      'Banner visibile con conteggio alert HIGH',
      'Nessun testo "conflitto/alert/disintermediazione" trovato nel body della home')

    // Vai a /disponibilita: cerca "Sblocca"
    await fPage.goto(`${PROD}/disponibilita`, { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>{})
    await new Promise(r => setTimeout(r, 2000))
    await fPage.screenshot({ path: path.join(RUN_DIR, 'D-11-forn-disponibilita.png'), fullPage: true })
    const dispText = await fPage.locator('body').innerText().catch(()=>'')
    const hasSblocca = /sblocca/i.test(dispText)
    rec('D','6 bottone Sblocca presente in /disponibilita', hasSblocca, hasSblocca?'OK':'non trovato')
  } catch (e) {
    rec('D','Fornitore flow', false, e.message)
  }
  await ctxF.close()

  // verifica anche WP vede ConflictAlertsBanner
  const ctxW2 = await browser.newContext()
  const w2 = await ctxW2.newPage()
  try {
    await w2.goto(`${PROD}/login`, { waitUntil: 'networkidle', timeout: 30000 })
    await w2.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")').first().click({ timeout: 3000 }).catch(()=>{})
    await w2.getByLabel(/email/i).fill('wp-mini@planfully-demo.it')
    await w2.getByLabel(/password/i).fill(PWD)
    await w2.getByRole('button', { name: /^Accedi$/i }).click()
    await w2.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{})
    await new Promise(r => setTimeout(r, 3500))
    await w2.screenshot({ path: path.join(RUN_DIR, 'D-20-wp-home-alerts.png'), fullPage: true })
    const txt = await w2.locator('body').innerText().catch(()=>'')
    const hasWpAlerts = /conflitt|alert|stesso fornitore|disintermediaz/i.test(txt)
    rec('D','7 ConflictAlertsBanner visibile in dashboard WP', hasWpAlerts, hasWpAlerts?'OK':'NON visibile (Scenari A+B dovrebbero produrre alert)')
    if (!hasWpAlerts) bug('HIGH','ConflictAlertsBanner non visibile lato WP',
      'WP ha 2 quote con alert HIGH+MEDIUM via RPC. Apre dashboard.',
      'Banner rosa con n. conflitti', 'banner assente')
  } catch(e) {
    rec('D','WP banner alert', false, e.message)
  }
  await ctxW2.close()
}

// helper: chiama RPC come utente specifico via JWT custom (simulazione service-role + set role)
async function callRpcAs(userId, rpcName, args={}) {
  // crea un JWT con sub=userId firmato con SUPABASE_JWT_SECRET. In assenza del secret, usiamo
  // direttamente service_role e poi un cliente con un signed token via auth.admin.createSession.
  // Più semplice: usiamo direttamente l'SQL della RPC via service-role impostando search_path.
  // Approccio: query SQL diretta che replica la RPC con auth.uid()=userId. Non possibile.
  // Soluzione: chiamare la RPC con header `Authorization: Bearer <user_token>`. Generiamo un JWT.
  // Service role ha permessi: chiama l'endpoint RPC con "x-supabase-auth" custom? Non supportato.
  //
  // Soluzione concreta: per ogni chiamata, signInWithPassword sull'utente di test.
  const anonResp = await fetch(SUPA_URL + '/auth/v1/admin/users/' + userId, {
    headers: { 'authorization': `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  })
  const user = await anonResp.json()
  const email = user.email
  // sign in con password Beta2026!
  const signIn = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method:'POST',
    headers: { apikey: SERVICE_KEY, 'content-type':'application/json' },
    body: JSON.stringify({ email, password: PWD }),
  })
  const sess = await signIn.json()
  if (!sess.access_token) {
    console.error('signIn fallito per', email, sess)
    return []
  }
  const rpc = await fetch(`${SUPA_URL}/rest/v1/rpc/${rpcName}`, {
    method:'POST',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${sess.access_token}`, 'content-type':'application/json' },
    body: JSON.stringify(args),
  })
  if (!rpc.ok) {
    console.error('RPC fallita', rpcName, rpc.status, await rpc.text())
    return []
  }
  return await rpc.json()
}

async function cleanup() {
  console.log('\n=== CLEANUP ===')
  await admin.from('quotes').delete().like('title', `%${TEST_MARK.split('-')[0]}%E2E-TEST%`).then(()=>{})
  await admin.from('quotes').delete().ilike('title', `%E2E-TEST%`)
  await admin.from('supplier_clients').delete().ilike('full_name', `%E2E-TEST%`)
  // sblocca availability bloccate per fornFoto su date di test
  for (const d of ['2027-04-17','2027-10-09','2027-06-12']) {
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
  await scenarioC(browser)
  await scenarioD(browser)
} catch (e) {
  console.error('FATAL', e)
  results.notes.push('FATAL: ' + e.message + '\n' + e.stack)
} finally {
  await cleanup().catch(e => console.error('cleanup err', e))
  await browser.close()
}

// dump JSON results
writeFileSync(path.join(RUN_DIR, 'results.json'), JSON.stringify(results, null, 2))
console.log('\nRun directory:', RUN_DIR)

// Now generate REPORT.md
const lines = []
lines.push(`# E2E Conflict / Standalone / Beta Banner — REPORT`)
lines.push(``)
lines.push(`**Run:** ${RUN_TS}`)
lines.push(`**Target:** ${PROD}`)
lines.push(`**DB:** ${SUPA_URL}`)
lines.push(``)
lines.push(`## Sintesi`)
for (const [sc, steps] of Object.entries(results.scenarios)) {
  const pass = steps.filter(s=>s.pass).length
  const tot = steps.length
  lines.push(`- **Scenario ${sc}:** ${pass}/${tot} step pass`)
}
lines.push(`- **BUG totali:** ${results.bugs.length} (CRITICAL: ${results.bugs.filter(b=>b.severity==='CRITICAL').length}, HIGH: ${results.bugs.filter(b=>b.severity==='HIGH').length}, MEDIUM: ${results.bugs.filter(b=>b.severity==='MEDIUM').length})`)
lines.push(``)

for (const [sc, steps] of Object.entries(results.scenarios)) {
  lines.push(`## Scenario ${sc}`)
  for (const s of steps) {
    lines.push(`- ${s.pass?'PASS':'FAIL'} — ${s.step}${s.info?` (${s.info})`:''}`)
  }
  lines.push(``)
}

lines.push(`## BUG`)
if (!results.bugs.length) lines.push(`Nessun bug rilevato.`)
for (const b of results.bugs) {
  lines.push(`### [${b.severity}] ${b.title}`)
  lines.push(`**Repro:** ${b.repro}`)
  lines.push(`**Expected:** ${b.expected}`)
  lines.push(`**Actual:** ${b.actual}`)
  lines.push(``)
}

lines.push(`## NOTES`)
for (const n of results.notes) lines.push(`- ${n}`)
lines.push(``)

lines.push(`## File`)
lines.push(`- ${path.join(RUN_DIR, 'scenario-C-quote.pdf')}`)
lines.push(`- Screenshot in ${RUN_DIR}`)
lines.push(`- ${path.join(RUN_DIR, 'results.json')}`)

writeFileSync(path.join(RUN_DIR, 'REPORT.md'), lines.join('\n'))
console.log('REPORT in', path.join(RUN_DIR, 'REPORT.md'))
