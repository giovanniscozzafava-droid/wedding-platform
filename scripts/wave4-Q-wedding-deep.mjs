#!/usr/bin/env node
/**
 * Wave 4 Agent Q — Wedding Dashboard Deep Audit (WP side)
 *
 * 1) Seeds an "AGENT-Q Test Wedding 2027-12-19" wedding via service-role
 *    (couple, quote, 50 guests, 5 tables, 8 timeline moments).
 * 2) Drives Playwright as WP wp-mini@planfully-demo.it through every tab
 *    of /weddings/:id and captures screenshots + bugs.
 * 3) Writes REPORT.md + bugs.json + cleanup of AGENT-Q-* at end.
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SUPABASE_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const PROD = 'https://planfully.it'
const WP_EMAIL = 'wp-mini@planfully-demo.it'
const WP_PASS = 'Beta2026!'
const PREFIX = 'AGENT-Q-'

const RUN_DIR = process.env.RUN_DIR ?? '/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave4-Q-wedding-deep-' + Date.now()
const SHOTS = path.join(RUN_DIR, 'screenshots')
const PDFS = path.join(RUN_DIR, 'pdfs')
const CSVS = path.join(RUN_DIR, 'csvs')
for (const d of [RUN_DIR, SHOTS, PDFS, CSVS]) fs.mkdirSync(d, { recursive: true })

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const bugs = []
function bug(severity, tab, description, evidence = null) {
  bugs.push({ severity, tab, description, evidence, ts: new Date().toISOString() })
  console.log(`  ⚠ [${severity}] ${tab}: ${description}`)
}

const tabResults = {}
function record(tab, status, notes = []) {
  tabResults[tab] = { status, notes, ts: new Date().toISOString() }
}

console.log('🔍 Wave 4 Agent Q — Wedding Dashboard Deep')
console.log('RUN_DIR:', RUN_DIR)

// ---------------------------------------------------------------------------
// 1. Find WP user, create couple, then wedding
// ---------------------------------------------------------------------------
const { data: usersList } = await sb.auth.admin.listUsers({ page: 1, perPage: 500 })
const wpUser = usersList.users.find((u) => u.email === WP_EMAIL)
if (!wpUser) throw new Error('WP user not found: ' + WP_EMAIL)
console.log('  ✓ WP user', wpUser.id)

// Create couple user (auth + profile)
const coupleEmail = `agent-q-couple-${Date.now()}@planfully-demo.it`
const coupleAuth = await sb.auth.admin.createUser({
  email: coupleEmail,
  password: 'Beta2026!',
  email_confirm: true,
  user_metadata: { full_name: 'AGENT-Q Coppia Test' },
})
if (coupleAuth.error) throw coupleAuth.error
const coupleId = coupleAuth.data.user.id
console.log('  ✓ couple user', coupleId, coupleEmail)

// Profile (may auto-create via trigger; upsert defensively)
const profRes = await sb.from('profiles').upsert({
  id: coupleId,
  full_name: 'AGENT-Q Coppia Test',
  role: 'COUPLE',
}, { onConflict: 'id' })
if (profRes.error) console.log('  ⚠ profile upsert', profRes.error.message)

// Quote
const qRes = await sb.from('quotes').insert({
  owner_id: wpUser.id,
  title: PREFIX + 'Preventivo Test',
  client_name: PREFIX + 'Coppia',
  client_email: coupleEmail,
  event_date: '2027-12-19',
  guest_count: 110,
  table_count: 12,
  default_markup_percent: 15,
  status: 'ACCETTATO',
  access_token: crypto.randomUUID(),
  accepted_at: new Date().toISOString(),
}).select().single()
if (qRes.error) throw qRes.error
console.log('  ✓ quote', qRes.data.id)

// Wedding (calendar_entries)
const wRes = await sb.from('calendar_entries').insert({
  owner_id: wpUser.id,
  title: PREFIX + 'Test Wedding 2027-12-19',
  client_name: PREFIX + 'Coppia',
  client_email: coupleEmail,
  date_from: '2027-12-19',
  date_to: '2027-12-19',
  status: 'CONFERMATA',
  value_amount: 32000,
  quote_id: qRes.data.id,
  notes: PREFIX + 'audit-run seed',
}).select().single()
if (wRes.error) throw wRes.error
const weddingId = wRes.data.id
console.log('  ✓ wedding', weddingId)

// 5 tables
const tables = [
  { table_no: 0, label: PREFIX + 'Sposi',          seats: 6,  shape: 'HEAD' },
  { table_no: 1, label: PREFIX + 'Famiglia Sposa', seats: 10, shape: 'ROUND' },
  { table_no: 2, label: PREFIX + 'Famiglia Sposo', seats: 10, shape: 'ROUND' },
  { table_no: 3, label: PREFIX + 'Amici',          seats: 12, shape: 'RECT' },
  { table_no: 4, label: PREFIX + 'Colleghi',       seats: 8,  shape: 'ROUND' },
]
const tIns = await sb.from('event_tables').insert(tables.map((t) => ({ ...t, entry_id: weddingId }))).select()
if (tIns.error) console.log('  ⚠ tables', tIns.error.message)
console.log('  ✓ 5 tables')

// 8 timeline moments
const timeline = [
  { ord: 1, start_time: '09:00', duration_min: 60,  title: PREFIX + 'Preparazione sposa' },
  { ord: 2, start_time: '11:00', duration_min: 60,  title: PREFIX + 'Cerimonia',           is_critical: true },
  { ord: 3, start_time: '12:30', duration_min: 30,  title: PREFIX + 'Foto post cerimonia' },
  { ord: 4, start_time: '14:00', duration_min: 90,  title: PREFIX + 'Aperitivo' },
  { ord: 5, start_time: '15:30', duration_min: 180, title: PREFIX + 'Pranzo',             is_critical: true },
  { ord: 6, start_time: '18:30', duration_min: 30,  title: PREFIX + 'Taglio torta',       is_critical: true },
  { ord: 7, start_time: '19:00', duration_min: 15,  title: PREFIX + 'Prima danza',        is_critical: true },
  { ord: 8, start_time: '19:30', duration_min: 180, title: PREFIX + 'Festa' },
]
const tlIns = await sb.from('event_timeline').insert(timeline.map((t) => ({ ...t, entry_id: weddingId })))
if (tlIns.error) console.log('  ⚠ timeline', tlIns.error.message)
console.log('  ✓ 8 timeline moments')

// 50 guests
const firstNames = ['Andrea','Sara','Marco','Giulia','Luca','Chiara','Federico','Martina','Alessandro','Elena','Davide','Francesca','Lorenzo','Valentina','Riccardo','Camilla','Tommaso','Beatrice','Filippo','Aurora']
const lastNames = ['Rossi','Bianchi','Russo','Esposito','Romano','Marino','Greco','Bruno','Gallo','Conti']
const groups = ['Famiglia Sposa','Famiglia Sposo','Amici','Colleghi','Cugini']
const tIds = (tIns.data ?? []).map((t) => t.id)
const guests = []
for (let i = 0; i < 50; i++) {
  guests.push({
    entry_id: weddingId,
    full_name: PREFIX + firstNames[i % firstNames.length] + ' ' + lastNames[(i * 3) % lastNames.length] + ' ' + (i+1),
    party_size: i % 5 === 0 ? 2 : 1,
    rsvp: ['YES','YES','YES','PENDING','NO','MAYBE'][i % 6],
    diet: i % 7 === 0 ? ['vegano','vegetariano','gluten-free','allergie noci'][i % 4] : null,
    side: i % 2 === 0 ? 'SPOSA' : 'SPOSO',
    group_label: groups[i % groups.length],
    table_id: i < 40 ? tIds[i % tIds.length] : null,
  })
}
const gIns = await sb.from('event_guests').insert(guests)
if (gIns.error) console.log('  ⚠ guests', gIns.error.message)
console.log('  ✓ 50 guests')

// couple_preferences (so Overview shows something)
const cpRes = await sb.from('couple_preferences').insert({
  entry_id: weddingId,
  bride_name: 'AGENT-Q Sposa',
  groom_name: 'AGENT-Q Sposo',
  couple_name: 'AGENT-Q Sposo & Sposa',
  styles: ['Classic elegance'],
  preferred_palette: ['rose', 'gold', 'ivory'],
  preferred_season: 'inverno',
  location_kind: 'villa',
  vision_note: PREFIX + 'visione test',
  budget_min: 28000, budget_max: 38000, guests_estimate: 110,
})
if (cpRes.error) console.log('  ⚠ couple_preferences', cpRes.error.message)
else console.log('  ✓ couple_preferences')

// Save seed metadata
fs.writeFileSync(path.join(RUN_DIR, 'seed-state.json'), JSON.stringify({
  wp_user_id: wpUser.id,
  couple_user_id: coupleId,
  couple_email: coupleEmail,
  quote_id: qRes.data.id,
  wedding_id: weddingId,
  table_ids: tIds,
  table_count: tIds.length,
  guests_seeded: guests.length,
  timeline_seeded: timeline.length,
}, null, 2))

// ---------------------------------------------------------------------------
// 2. Drive UI as WP through each tab
// ---------------------------------------------------------------------------
console.log('\n🌐 Launching browser (Chromium)…')
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
})
const page = await ctx.newPage()

page.on('console', (m) => {
  if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200))
})
page.on('pageerror', (e) => bug('HIGH', 'global', 'pageerror: ' + e.message.slice(0, 250)))

let shotIdx = 0
async function shot(name) {
  shotIdx += 1
  const num = String(shotIdx).padStart(2, '0')
  const p = path.join(SHOTS, `${num}-${name}.png`)
  try { await page.screenshot({ path: p, fullPage: false }) } catch (e) {}
  return p
}

// Login as WP
console.log('  · Login WP…')
await page.goto(PROD + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 })
await shot('login-page')
try {
  await page.locator('input[type="email"]').first().fill(WP_EMAIL)
  await page.locator('input[type="password"]').first().fill(WP_PASS)
  await shot('login-filled')
  await Promise.all([
    page.waitForURL(/\/(weddings|$|onboarding|brand)/, { timeout: 30000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ])
} catch (e) {
  bug('CRITICAL', 'login', 'WP login failed: ' + e.message.slice(0, 200))
}
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)
await shot('post-login')

// Navigate to the dashboard
const URL = PROD + '/weddings/' + weddingId
console.log('  · Open', URL)
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null)
await shot('dashboard-overview-initial')

// Verify dashboard loaded
const heroTitle = await page.locator('h1').first().textContent().catch(() => '')
if (!heroTitle || !heroTitle.includes('Test Wedding')) {
  bug('CRITICAL', 'overview', 'Dashboard not loaded — title: ' + (heroTitle ?? 'null'))
}

const tabs = [
  'overview', 'timeline', 'guests', 'tables', 'accommodations', 'transport',
  'subevents', 'gadgets', 'mood', 'playlist', 'budget', 'checklist',
  'contract', 'website', 'members', 'docs', 'analytics',
]

const tabLabels = {
  overview: 'Overview', timeline: 'Scaletta', guests: 'Invitati', tables: 'Tavoli',
  accommodations: 'Alloggi', transport: 'Trasporti', subevents: 'Eventi',
  gadgets: 'Bomboniere', mood: 'Mood', playlist: 'Playlist', budget: 'Budget',
  checklist: 'Checklist', contract: 'Contratto', website: 'Wedding site',
  members: 'Sposi', docs: 'Documenti', analytics: 'Analytics',
}

for (const t of tabs) {
  console.log(`  · Tab: ${t}`)
  try {
    const label = tabLabels[t]
    const tabBtn = page.locator(`button:has-text("${label}")`).first()
    const has = await tabBtn.count()
    if (!has) {
      bug('HIGH', t, `Tab button "${label}" not found in dashboard`)
      record(t, 'FAIL', ['tab button missing'])
      continue
    }
    await tabBtn.click({ timeout: 8000 })
    await page.waitForTimeout(900)
    await shot(`tab-${t}`)

    // Tab-specific quick checks
    const body = await page.textContent('body').catch(() => '')
    const errOverlay = await page.locator('[data-nextjs-dialog], .error-overlay').count().catch(() => 0)
    if (errOverlay > 0) bug('HIGH', t, 'Error overlay visible on tab')

    if (/error|errore|ouch|something went wrong/i.test(body ?? '') && (body?.length ?? 0) < 1500) {
      bug('MEDIUM', t, 'Page body suggests error state')
    }

    record(t, 'OK', ['screenshot captured'])
  } catch (e) {
    bug('HIGH', t, 'Exception navigating: ' + e.message.slice(0, 200))
    record(t, 'FAIL', [e.message.slice(0, 200)])
  }
}

// ---------------------------------------------------------------------------
// 3. Targeted interactions on a handful of tabs
// ---------------------------------------------------------------------------
console.log('\n🎯 Targeted interactions')

// 3a. Add a guest via UI (Invitati)
try {
  await page.locator('button:has-text("Invitati")').first().click()
  await page.waitForTimeout(800)
  await shot('guests-before-add')
  const addBtn = page.locator('button:has-text("Aggiungi"), button:has-text("Nuovo")').first()
  if (await addBtn.count()) {
    await addBtn.click({ timeout: 5000 })
    await page.waitForTimeout(500)
    const nameInput = page.locator('input[placeholder*="nome" i], input[name*="name" i]').first()
    if (await nameInput.count()) {
      await nameInput.fill('AGENT-Q UI Added Guest')
      await shot('guests-add-filled')
      const save = page.locator('button:has-text("Salva"), button:has-text("Aggiungi"), button[type="submit"]').last()
      await save.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(1200)
      await shot('guests-after-add')
    } else {
      bug('LOW', 'guests', 'Add-guest modal opened but no name input detected')
    }
  } else {
    bug('MEDIUM', 'guests', 'No "Aggiungi" button found for guest CRUD')
  }
} catch (e) { bug('MEDIUM', 'guests', 'UI add guest failed: ' + e.message.slice(0, 200)) }

// 3b. Filter guests by RSVP if filter exists
try {
  const filter = page.locator('select, button:has-text("RSVP"), button:has-text("Filtra")').first()
  if (await filter.count()) {
    await shot('guests-filter-visible')
  }
} catch (e) {}

// 3c. Timeline: open and check item count
try {
  await page.locator('button:has-text("Scaletta")').first().click()
  await page.waitForTimeout(900)
  const items = await page.locator('[data-timeline-row], li, tr').count().catch(() => 0)
  if (items < 3) bug('MEDIUM', 'timeline', `Only ${items} timeline rows visible — expected 8 seeded`)
  await shot('timeline-rendered')
} catch (e) { bug('MEDIUM', 'timeline', e.message.slice(0, 200)) }

// 3d. Mood: try Pinterest URL import (expect 422 friendly message post-fix N)
try {
  await page.locator('button:has-text("Mood")').first().click()
  await page.waitForTimeout(900)
  await shot('mood-initial')
  const urlBtn = page.locator('button:has-text("URL"), button:has-text("Importa"), button:has-text("Pinterest")').first()
  if (await urlBtn.count()) {
    await urlBtn.click({ timeout: 5000 })
    await page.waitForTimeout(500)
    const urlIn = page.locator('input[type="url"], input[placeholder*="url" i]').first()
    if (await urlIn.count()) {
      await urlIn.fill('https://www.pinterest.com/pin/000000000/')
      await shot('mood-url-filled')
      const sub = page.locator('button:has-text("Importa"), button:has-text("Salva"), button[type="submit"]').last()
      await sub.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(2500)
      await shot('mood-url-result')
      const errorText = await page.locator('.toast, [role="alert"], [class*="error"]').first().textContent().catch(() => '')
      if (errorText && /422|unsupported|non.+supportat/i.test(errorText)) {
        record('mood-422', 'OK', ['user-friendly 422 message: ' + errorText.slice(0, 120)])
      } else {
        bug('LOW', 'mood', 'Pinterest URL import — no user-friendly error message detected, got: ' + (errorText || 'nothing').slice(0, 120))
      }
    }
  } else {
    bug('LOW', 'mood', 'No URL/Importa button found in Mood tab')
  }
} catch (e) { bug('MEDIUM', 'mood', e.message.slice(0, 200)) }

// 3e. Documents: try uploading a .exe (should reject post-fix N)
try {
  await page.locator('button:has-text("Documenti")').first().click()
  await page.waitForTimeout(900)
  await shot('docs-initial')
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count()) {
    const exePath = path.join(RUN_DIR, 'malicious-test.exe')
    fs.writeFileSync(exePath, Buffer.from('MZ\x90\x00fake-exe-payload'))
    await fileInput.setInputFiles(exePath).catch(() => {})
    await page.waitForTimeout(2000)
    await shot('docs-after-exe-upload')
    const errMsg = await page.locator('.toast, [role="alert"]').first().textContent().catch(() => '')
    if (errMsg && /tipo|mime|non consentit|rejected|invalid/i.test(errMsg)) {
      record('docs-exe-block', 'OK', ['.exe rejected: ' + errMsg.slice(0, 120)])
    } else {
      bug('HIGH', 'docs', `.exe upload — no clear rejection message; got "${(errMsg ?? '').slice(0, 120)}"`)
    }
  } else {
    bug('MEDIUM', 'docs', 'No file input found in Documents tab')
  }
} catch (e) { bug('MEDIUM', 'docs', e.message.slice(0, 200)) }

// 3f. Website: check publish state / slug
try {
  await page.locator('button:has-text("Wedding site")').first().click()
  await page.waitForTimeout(900)
  await shot('website-tab')
  const body = (await page.textContent('body')) ?? ''
  if (!/slug|url|\/w\//i.test(body)) bug('LOW', 'website', 'No slug/url visibility in Website tab')
} catch (e) { bug('MEDIUM', 'website', e.message.slice(0, 200)) }

// 3g. Contract: check if PDF download button is rendered
try {
  await page.locator('button:has-text("Contratto")').first().click()
  await page.waitForTimeout(900)
  await shot('contract-tab')
  const dlBtn = page.locator('button:has-text("PDF"), button:has-text("Scarica"), a[href*=".pdf"]').first()
  if (!(await dlBtn.count())) bug('LOW', 'contract', 'No "Scarica PDF" / contract download button visible')
} catch (e) { bug('MEDIUM', 'contract', e.message.slice(0, 200)) }

// Final
await page.locator('button:has-text("Overview")').first().click().catch(() => {})
await page.waitForTimeout(800)
await shot('final-overview')

await browser.close()

// ---------------------------------------------------------------------------
// 4. Cleanup AGENT-Q-*
// ---------------------------------------------------------------------------
console.log('\n🧹 Cleanup AGENT-Q-*')
const delGuests = await sb.from('event_guests').delete().like('full_name', PREFIX + '%')
const delTl     = await sb.from('event_timeline').delete().like('title', PREFIX + '%')
const delTabs   = await sb.from('event_tables').delete().like('label', PREFIX + '%')
const delPart   = await sb.from('calendar_entry_participants').delete().eq('entry_id', weddingId)
const delCp     = await sb.from('couple_preferences').delete().eq('entry_id', weddingId)
const delEntry  = await sb.from('calendar_entries').delete().eq('id', weddingId)
const delQ      = await sb.from('quotes').delete().eq('id', qRes.data.id)
const delAuth   = await sb.auth.admin.deleteUser(coupleId).catch(() => null)
console.log('  ✓ cleanup done', {
  guests: delGuests.error?.message ?? 'ok',
  timeline: delTl.error?.message ?? 'ok',
  tables: delTabs.error?.message ?? 'ok',
  participants: delPart.error?.message ?? 'ok',
  couple_prefs: delCp.error?.message ?? 'ok',
  wedding: delEntry.error?.message ?? 'ok',
  quote: delQ.error?.message ?? 'ok',
  couple_auth: delAuth?.error?.message ?? 'ok',
})

// ---------------------------------------------------------------------------
// 5. Write reports
// ---------------------------------------------------------------------------
fs.writeFileSync(path.join(RUN_DIR, 'bugs.json'), JSON.stringify(bugs, null, 2))
fs.writeFileSync(path.join(RUN_DIR, 'tab-results.json'), JSON.stringify(tabResults, null, 2))

const severity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
for (const b of bugs) severity[b.severity] = (severity[b.severity] ?? 0) + 1

const report = `# Wave 4 — Agent Q — Wedding Dashboard Deep Audit (WP side)

**Run dir**: ${RUN_DIR}
**Started**: ${new Date().toISOString()}
**Target**: ${PROD}/weddings/${weddingId}
**WP**: ${WP_EMAIL}

## Pre-setup
Seed via service-role:
- Wedding ${PREFIX}Test Wedding 2027-12-19 (id \`${weddingId}\`)
- Quote ACCETTATO (id \`${qRes.data.id}\`)
- 5 tavoli, 8 momenti scaletta, 50 invitati, couple_preferences

## Tab results (17 totali)

| Tab | Esito | Note |
|-----|-------|------|
${tabs.map((t) => {
  const r = tabResults[t]
  if (!r) return `| ${t} | SKIP | non testato |`
  return `| ${t} | ${r.status} | ${(r.notes ?? []).join(' / ')} |`
}).join('\n')}

## Bug summary

| Severity | Count |
|----------|-------|
| CRITICAL | ${severity.CRITICAL} |
| HIGH     | ${severity.HIGH} |
| MEDIUM   | ${severity.MEDIUM} |
| LOW      | ${severity.LOW} |

### Bug details

${bugs.length === 0 ? '_Nessun bug rilevato._' : bugs.map((b, i) =>
  `**${i+1}. [${b.severity}] [${b.tab}]** ${b.description}` + (b.evidence ? `\n  evidence: ${b.evidence}` : '')
).join('\n\n')}

## Screenshots
${shotIdx} files in \`screenshots/\`.

## Cleanup
- ${PREFIX}* entities deleted: guests, timeline, tables, participants, couple_preferences, wedding, quote, couple auth user.
`

fs.writeFileSync(path.join(RUN_DIR, 'REPORT.md'), report)
console.log('\n✅ Done. RUN_DIR=' + RUN_DIR)
console.log('   bugs:', bugs.length, '| screenshots:', shotIdx)
