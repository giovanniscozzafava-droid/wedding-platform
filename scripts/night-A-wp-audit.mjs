#!/usr/bin/env node
/**
 * NIGHT-A WP AUDIT — Audit totale lato Wedding Planner (Sara De Luca).
 * Naviga ogni voce di menu, prova ogni bottone, compila ogni form.
 * Output: audit-runs/night-A-wp-<timestamp>/{REPORT.md, results.json, *.png}
 */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUN_DIR = process.env.RUN_DIR
  || path.resolve(__dirname, `../audit-runs/night-A-wp-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`)
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })

const BASE = process.env.AUDIT_BASE || 'https://planfully.it'
const PWD = 'Beta2026!'
const WP_EMAIL = 'wp-mini@planfully-demo.it'

const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SUPA_SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const sb = createClient(SUPA_URL, SUPA_SK, { auth: { persistSession: false } })

const bugs = []
const passes = []
const pageResults = {}
let currentPage = 'BOOT'
let shotCounter = 0

function bug(severity, msg, detail) {
  const b = { page: currentPage, severity, msg, detail: detail ? String(detail).slice(0, 400) : null, ts: Date.now() }
  bugs.push(b)
  console.log(`  🐛 [${severity}] ${currentPage}: ${msg}${detail ? ` — ${b.detail.slice(0,140)}` : ''}`)
  pageResults[currentPage] = pageResults[currentPage] || { pass: 0, bug: 0, name: currentPage }
  pageResults[currentPage].bug++
}
function pass(msg) {
  passes.push({ page: currentPage, msg })
  console.log(`  ✅ ${currentPage}: ${msg}`)
  pageResults[currentPage] = pageResults[currentPage] || { pass: 0, bug: 0, name: currentPage }
  pageResults[currentPage].pass++
}
function step(name) {
  currentPage = name
  console.log(`\n━━━ ${name} ━━━`)
  pageResults[currentPage] = pageResults[currentPage] || { pass: 0, bug: 0, name: currentPage }
}
async function shot(page, name) {
  shotCounter++
  const id = String(shotCounter).padStart(2, '0')
  const file = `wp-${id}-${name}.png`
  try {
    await page.screenshot({ path: path.join(RUN_DIR, file), fullPage: false })
  } catch (e) {
    bug('LOW', `Screenshot failed for ${name}`, e?.message)
  }
}
const wait = ms => new Promise(r => setTimeout(r, ms))

async function dismissCookie(page) {
  await page.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")').first().click({ timeout: 2500 }).catch(() => {})
  await wait(400)
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await dismissCookie(page)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PWD)
  await page.getByRole('button', { name: /^Accedi$/i }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {})
  await wait(1800)
}

async function safeClick(page, locator, label) {
  try {
    if ((await locator.count()) === 0) return false
    await locator.first().click({ timeout: 4000 })
    return true
  } catch (e) {
    bug('LOW', `Click failed: ${label}`, e?.message)
    return false
  }
}

async function bodyText(page) {
  try { return (await page.locator('body').innerText()) || '' } catch { return '' }
}

// ─── Cleanup AGENT-A-% entities before/after ────────────────────────────────
async function cleanupAgentA() {
  console.log('\n━━━ CLEANUP AGENT-A-% ━━━')
  try {
    // calendar_entries title LIKE AGENT-A%
    const { data: wedds } = await sb.from('calendar_entries').select('id, title').ilike('title', 'AGENT-A%')
    if (wedds && wedds.length) {
      const ids = wedds.map(w => w.id)
      // cascade-safe deletes
      await sb.from('event_timeline').delete().in('entry_id', ids)
      await sb.from('guests').delete().in('entry_id', ids)
      await sb.from('tables').delete().in('entry_id', ids)
      await sb.from('mood_images').delete().in('entry_id', ids)
      await sb.from('playlist_tracks').delete().in('entry_id', ids)
      await sb.from('checklist_items').delete().in('entry_id', ids)
      await sb.from('documents').delete().in('entry_id', ids)
      await sb.from('accommodations').delete().in('entry_id', ids)
      await sb.from('transports').delete().in('entry_id', ids)
      await sb.from('calendar_entries').delete().in('id', ids)
      console.log(`  ✅ Cleaned ${ids.length} AGENT-A weddings`)
    }
    // services name LIKE AGENT-A%
    const { data: svcs } = await sb.from('services').select('id').ilike('name', 'AGENT-A%')
    if (svcs?.length) {
      await sb.from('services').delete().in('id', svcs.map(s => s.id))
      console.log(`  ✅ Cleaned ${svcs.length} AGENT-A services`)
    }
  } catch (e) {
    console.log(`  ⚠️  Cleanup error: ${e?.message ?? e}`)
  }
}

// ─── Main audit ────────────────────────────────────────────────────────────
async function main() {
  await cleanupAgentA()

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'it-IT',
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('pageerror', e => consoleErrors.push({ page: currentPage, type: 'pageerror', msg: e.message }))
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text()
      // filter known noise
      if (/Failed to load resource|net::ERR_|favicon|Manifest/i.test(t)) return
      consoleErrors.push({ page: currentPage, type: 'console.error', msg: t.slice(0, 300) })
    }
  })

  try {
    // ─── LOGIN ─────────────────────────────────────────────────
    step('LOGIN')
    await login(page, WP_EMAIL)
    if (page.url().includes('/login')) {
      bug('CRITICAL', 'Login fallito: ancora su /login', `URL=${page.url()}`)
      await shot(page, 'login-failed')
      await browser.close()
      return finalize()
    }
    pass('Login WP OK url=' + page.url())
    await shot(page, 'after-login')

    // ─── 1. HOMEPAGE ───────────────────────────────────────────
    step('HOME')
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'home')
    const home = await bodyText(page)
    if (home.length < 200) bug('HIGH', 'Home sembra vuota', `len=${home.length}`)
    else pass('Home renderizzata')

    // KPI cards
    const kpiNumbers = await page.locator('[class*="tabular-nums"]').count()
    if (kpiNumbers === 0) bug('MEDIUM', 'Nessuna KPI numerica visibile su Home')
    else pass(`KPI numerici visibili: ${kpiNumbers}`)

    // shortcuts/links
    for (const label of ['Catalogo', 'Matrimoni', 'Calendario', 'Preventivi', 'Contratti']) {
      const cnt = await page.locator(`a:has-text("${label}"), button:has-text("${label}")`).count()
      if (cnt === 0) bug('MEDIUM', `Link/shortcut "${label}" non trovato su Home`)
    }
    pass('Verifica shortcut home eseguita')

    // ─── 2. CATALOG ────────────────────────────────────────────
    step('CATALOG')
    await page.goto(`${BASE}/catalog`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'catalog')
    const catBody = await bodyText(page)
    if (catBody.length < 100) bug('HIGH', 'Catalog page vuota')
    else pass('Catalog caricato')

    // Look for new-service button
    const newSvcBtn = page.locator('button:has-text("uovo"), button:has-text("Aggiungi"), button:has-text("Crea")').first()
    if (await newSvcBtn.count() > 0) {
      await newSvcBtn.click().catch(() => {})
      await wait(1200)
      await shot(page, 'catalog-new-modal')
      // Compile fields if modal opened
      const nameField = page.locator('input[name*="name"], input[placeholder*="ome"], input[placeholder*="Nome"]').first()
      if (await nameField.count() > 0) {
        await nameField.fill('AGENT-A Servizio test').catch(() => {})
        // price
        const priceField = page.locator('input[type="number"], input[name*="price"], input[placeholder*="rezzo"]').first()
        if (await priceField.count() > 0) await priceField.fill('1500').catch(() => {})
        // try save
        const saveBtn = page.locator('button:has-text("alva"), button:has-text("Crea"), button:has-text("onferma")').last()
        if (await saveBtn.count() > 0) {
          await saveBtn.click().catch(() => {})
          await wait(2000)
          await shot(page, 'catalog-after-save')
          pass('Tentato salvataggio nuovo servizio AGENT-A')
        } else bug('MEDIUM', 'Modal nuovo servizio senza bottone salva')
      } else {
        bug('MEDIUM', 'Modal nuovo servizio aperto ma nessun campo nome')
        // close
        await page.keyboard.press('Escape').catch(() => {})
      }
    } else {
      bug('MEDIUM', 'Bottone "Nuovo servizio" non trovato in Catalog')
    }

    // try filters
    const filterChips = await page.locator('button[class*="badge"], button[class*="chip"], select').count()
    if (filterChips > 0) pass(`Filtri/chip presenti: ${filterChips}`)

    // ─── 3. WEDDINGS LIST ──────────────────────────────────────
    step('WEDDINGS_LIST')
    await page.goto(`${BASE}/weddings`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'weddings-list')
    const wList = await page.locator('a[href^="/weddings/"]').count()
    if (wList === 0) bug('HIGH', 'Lista matrimoni vuota')
    else pass(`Matrimoni in lista: ${wList}`)

    // try create new wedding
    const newWedBtn = page.locator('button:has-text("uovo"), button:has-text("Aggiungi"), button:has-text("Crea matrimonio")').first()
    if (await newWedBtn.count() > 0) {
      await newWedBtn.click().catch(() => {})
      await wait(1500)
      await shot(page, 'weddings-new-modal')
      const titleField = page.locator('input[placeholder*="itolo"], input[name*="title"], input[placeholder*="ome"]').first()
      if (await titleField.count() > 0) {
        await titleField.fill('AGENT-A Test Wedding').catch(() => {})
        // date
        const dateField = page.locator('input[type="date"], input[type="datetime-local"]').first()
        if (await dateField.count() > 0) await dateField.fill('2027-11-13').catch(() => {})
        // budget
        const budgetField = page.locator('input[type="number"]').first()
        if (await budgetField.count() > 0) await budgetField.fill('25000').catch(() => {})
        const saveBtn = page.locator('button:has-text("alva"), button:has-text("Crea"), button:has-text("onferma")').last()
        if (await saveBtn.count() > 0) {
          await saveBtn.click().catch(() => {})
          await wait(2500)
          await shot(page, 'weddings-after-create')
          pass('Tentato creazione AGENT-A Test Wedding')
        }
      } else {
        bug('MEDIUM', 'Modal nuovo wedding senza campo titolo')
        await page.keyboard.press('Escape').catch(() => {})
      }
    } else {
      bug('MEDIUM', 'Bottone crea matrimonio non trovato')
    }

    // ─── 4. WEDDING DETAIL TABS ────────────────────────────────
    step('WEDDING_DETAIL')
    await page.goto(`${BASE}/weddings`, { waitUntil: 'networkidle' })
    await wait(1500)
    const firstWed = page.locator('a[href^="/weddings/"]').first()
    if ((await firstWed.count()) === 0) {
      bug('CRITICAL', 'Nessun matrimonio cliccabile')
    } else {
      await firstWed.click()
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await wait(2200)
      await shot(page, 'wedding-detail-overview')
      pass('Wedding detail aperto: ' + page.url())

      // For each known tab key, try clicking matching button & screenshot
      const tabsToTry = [
        { label: 'Overview', key: 'overview' },
        { label: 'Documenti', key: 'docs' },
        { label: 'Programma', key: 'programma' },
        { label: 'Invitati', key: 'invitati' },
        { label: 'Tavoli', key: 'tavoli' },
        { label: 'Mood', key: 'mood' },
        { label: 'Playlist', key: 'playlist' },
        { label: 'Sito', key: 'website' },
        { label: 'Contratto', key: 'contract' },
        { label: 'Trasporti', key: 'transport' },
        { label: 'Alloggi', key: 'accommodations' },
        { label: 'Budget', key: 'budget' },
        { label: 'Checklist', key: 'checklist' },
        { label: 'Analytics', key: 'analytics' },
      ]
      for (const t of tabsToTry) {
        const btn = page.locator(`button:has-text("${t.label}")`).first()
        if (await btn.count() > 0) {
          await btn.click().catch(() => {})
          await wait(1300)
          await shot(page, `wed-tab-${t.key}`)
          // tab-specific probes
          const tBody = await bodyText(page)
          if (tBody.toLowerCase().includes('errore') && !tBody.toLowerCase().includes('nessun')) {
            bug('MEDIUM', `Tab ${t.label} mostra "errore" nel body`)
          }
          // tab-specific bottoni
          if (t.key === 'invitati') {
            const pdfCnt = await page.locator('button:has-text("PDF"), button:has-text("Esporta")').count()
            if (pdfCnt === 0) bug('LOW', 'Tab invitati senza pulsanti PDF/Esporta')
          }
          if (t.key === 'tavoli') {
            const addBtn = await page.locator('button:has-text("Aggiungi"), button:has-text("Nuovo tavolo")').count()
            if (addBtn === 0) bug('LOW', 'Tab tavoli senza bottone aggiungi tavolo')
          }
          if (t.key === 'mood') {
            const upload = await page.locator('button:has-text("arica"), button:has-text("Aggiungi"), input[type="file"]').count()
            if (upload === 0) bug('LOW', 'Tab mood senza upload')
          }
          if (t.key === 'playlist') {
            const add = await page.locator('button:has-text("Aggiungi"), button:has-text("Nuovo brano")').count()
            if (add === 0) bug('LOW', 'Tab playlist senza bottone aggiungi brano')
          }
          if (t.key === 'website') {
            const pubBtn = await page.locator('button:has-text("Pubblica"), button:has-text("Anteprima"), button:has-text("ubblic")').count()
            if (pubBtn === 0) bug('LOW', 'Tab sito ospiti senza pubblica/anteprima')
          }
          if (t.key === 'contract') {
            const dl = await page.locator('button:has-text("Scarica"), a:has-text("PDF")').count()
            if (dl === 0) bug('LOW', 'Tab contratto senza pulsante scarica')
          }
          pass(`Tab ${t.label} aperto`)
        } else {
          bug('LOW', `Tab "${t.label}" non trovato`)
        }
      }
    }

    // ─── 5. SUPPLIERS LIST ─────────────────────────────────────
    step('SUPPLIERS')
    await page.goto(`${BASE}/suppliers`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'suppliers')
    const supCnt = await page.locator('a[href^="/suppliers/"]').count()
    if (supCnt === 0) bug('HIGH', 'Nessun fornitore visibile in rete')
    else pass(`Fornitori rete: ${supCnt}`)

    // filter chips
    const supFilters = await page.locator('button[class*="badge"], select').count()
    pass(`Filtri categoria supplier: ${supFilters}`)

    // ─── 6. SUPPLIER DETAIL ────────────────────────────────────
    if (supCnt > 0) {
      step('SUPPLIER_DETAIL')
      await page.locator('a[href^="/suppliers/"]').first().click()
      await page.waitForLoadState('networkidle').catch(() => {})
      await wait(2000)
      await shot(page, 'supplier-detail')
      const sd = await bodyText(page)
      if (sd.length < 200) bug('MEDIUM', 'Pagina fornitore vuota')
      else pass('Dettaglio fornitore caricato')

      const inviteBtn = await page.locator('button:has-text("Invita")').count()
      if (inviteBtn === 0) bug('LOW', 'Bottone Invita a wedding mancante in dettaglio fornitore')
    }

    // ─── 7. CALENDAR ───────────────────────────────────────────
    step('CALENDAR')
    await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'calendar')
    const calBody = await bodyText(page)
    if (calBody.length < 100) bug('HIGH', 'Calendar vuoto')
    else pass('Calendar caricato')

    // ─── 8. QUOTES LIST ────────────────────────────────────────
    step('QUOTES_LIST')
    await page.goto(`${BASE}/quotes`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'quotes')
    const qCnt = await page.locator('a[href^="/quotes/"]').count()
    if (qCnt === 0) bug('MEDIUM', 'Lista preventivi vuota')
    else pass(`Preventivi: ${qCnt}`)

    // ─── 9. QUOTE EDITOR ───────────────────────────────────────
    if (qCnt > 0) {
      step('QUOTE_EDITOR')
      await page.locator('a[href^="/quotes/"]').first().click()
      await page.waitForLoadState('networkidle').catch(() => {})
      await wait(2200)
      await shot(page, 'quote-editor')
      const qe = await bodyText(page)
      if (qe.length < 200) bug('HIGH', 'Quote editor vuoto')
      else pass('Quote editor aperto')

      // probe key buttons
      for (const lbl of ['Genera PDF', 'Invia', 'Aggiungi', 'Markup', 'Anteprima']) {
        const cnt = await page.locator(`button:has-text("${lbl}")`).count()
        if (cnt > 0) pass(`Quote editor: bottone "${lbl}" presente`)
      }
    }

    // ─── 10. CONTRACTS ─────────────────────────────────────────
    step('CONTRACTS')
    await page.goto(`${BASE}/contracts`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'contracts')
    pass('Contracts page')

    // ─── 11. FINANCE COMING SOON ───────────────────────────────
    step('FINANCE')
    await page.goto(`${BASE}/finanziamento`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'finance')
    const finT = await bodyText(page)
    if (!/COMING SOON|in arrivo|presto/i.test(finT)) bug('LOW', 'Banner COMING SOON non visibile in Finanziamento')
    else pass('Finanziamento mostra COMING SOON')

    // ─── 12. INSURANCE COMING SOON ─────────────────────────────
    step('INSURANCE')
    await page.goto(`${BASE}/assicurazione`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'insurance')
    const insT = await bodyText(page)
    if (!/COMING SOON|in arrivo|presto/i.test(insT)) bug('LOW', 'Banner COMING SOON non visibile in Assicurazione')
    else pass('Assicurazione mostra COMING SOON')

    // ─── 13. BRAND SETTINGS ────────────────────────────────────
    step('BRAND')
    await page.goto(`${BASE}/settings/brand`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'brand')
    const brandT = await bodyText(page)
    if (brandT.length < 200) bug('MEDIUM', 'Brand settings sembra vuoto')
    else pass('Brand settings caricato')
    const colorInputs = await page.locator('input[type="color"]').count()
    if (colorInputs < 1) bug('LOW', 'Brand settings senza color picker')
    else pass(`Color picker: ${colorInputs}`)

    // ─── 14. PROFILE ───────────────────────────────────────────
    step('PROFILE')
    await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' })
    await wait(1500)
    await shot(page, 'profile')
    const profT = await bodyText(page)
    if (profT.length < 200) bug('MEDIUM', 'Profile sembra vuoto')
    else pass('Profile caricato')
    // try update bio (non-destructive: leave existing)
    const bioField = page.locator('textarea, input[name*="bio"]').first()
    if (await bioField.count() > 0) pass('Bio editabile presente')
    else bug('LOW', 'Profile senza textarea bio')

    // logout button
    const logoutCnt = await page.locator('[data-testid="logout-btn"], button:has-text("Esci"), button:has-text("Logout")').count()
    if (logoutCnt === 0) bug('LOW', 'Bottone logout non trovato in profile')
    else pass('Logout presente')

  } catch (e) {
    bug('CRITICAL', 'Crash audit principale', e?.message)
  }

  // collect console errors as bugs
  if (consoleErrors.length) {
    for (const ce of consoleErrors) {
      const sev = ce.type === 'pageerror' ? 'HIGH' : 'MEDIUM'
      bugs.push({ page: ce.page, severity: sev, msg: `JS ${ce.type}: ${ce.msg}`, ts: Date.now() })
      pageResults[ce.page] = pageResults[ce.page] || { pass: 0, bug: 0, name: ce.page }
      pageResults[ce.page].bug++
    }
  }

  await browser.close()
  await cleanupAgentA()
  finalize()
}

function finalize() {
  const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  bugs.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9))

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const b of bugs) counts[b.severity] = (counts[b.severity] || 0) + 1

  // results.json
  const results = {
    runId: path.basename(RUN_DIR),
    base: BASE,
    user: WP_EMAIL,
    timestamp: new Date().toISOString(),
    totals: { pass: passes.length, bug: bugs.length, ...counts },
    pages: Object.values(pageResults),
    bugs,
  }
  writeFileSync(path.join(RUN_DIR, 'results.json'), JSON.stringify(results, null, 2))

  // REPORT.md
  const lines = []
  lines.push(`# Night-A WP Audit — ${results.timestamp}`)
  lines.push('')
  lines.push(`**Base**: ${BASE}  ·  **User**: ${WP_EMAIL}`)
  lines.push('')
  lines.push(`**Pass**: ${passes.length}  ·  **Bug**: ${bugs.length}`)
  lines.push('')
  lines.push(`Severità → CRITICAL: ${counts.CRITICAL} · HIGH: ${counts.HIGH} · MEDIUM: ${counts.MEDIUM} · LOW: ${counts.LOW}`)
  lines.push('')

  lines.push('## Pages summary')
  lines.push('')
  lines.push('| Page | Pass | Bug |')
  lines.push('|---|---:|---:|')
  for (const p of Object.values(pageResults)) {
    lines.push(`| ${p.name} | ${p.pass} | ${p.bug} |`)
  }
  lines.push('')

  lines.push('## Bugs (sorted by severity)')
  lines.push('')
  if (!bugs.length) {
    lines.push('_Nessun bug rilevato._')
  } else {
    for (const b of bugs) {
      lines.push(`- **[${b.severity}] ${b.page}** — ${b.msg}`)
      if (b.detail) lines.push(`  _Detail_: \`${b.detail.replace(/`/g, '\'')}\``)
      lines.push(`  _Repro_: login con ${WP_EMAIL} → vai a sezione **${b.page}** → osserva.`)
    }
  }
  lines.push('')

  lines.push('## Passed checks')
  lines.push('')
  for (const p of passes) lines.push(`- [${p.page}] ${p.msg}`)
  lines.push('')

  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), lines.join('\n'))

  console.log('\n══════════════════════════════════════')
  console.log(`Run dir: ${RUN_DIR}`)
  console.log(`Pass=${passes.length}  Bug=${bugs.length}  (CRIT=${counts.CRITICAL} HIGH=${counts.HIGH} MED=${counts.MEDIUM} LOW=${counts.LOW})`)
  console.log('══════════════════════════════════════')
}

main().catch(e => {
  console.error('FATAL', e)
  finalize()
  process.exit(1)
})
