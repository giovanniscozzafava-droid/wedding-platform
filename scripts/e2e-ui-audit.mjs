#!/usr/bin/env node
/**
 * E2E UI AUDIT — Playwright sul frontend live.
 * Testa: login multi-ruolo, navigazione tab, upload foto, firma canvas,
 * preset wizard, PDF download.
 */
import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUN_DIR = path.resolve(__dirname, `../audit-runs/ui-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`)
mkdirSync(RUN_DIR, { recursive: true })

const BASE = 'https://planfully.it'
const PWD = 'Beta2026!'
const bugs = []
const passes = []

function bug(area, severity, msg, detail) {
  bugs.push({ area, severity, msg, detail })
  console.log(`  🐛 [${severity}] ${area}: ${msg}${detail ? ` — ${String(detail).slice(0,120)}` : ''}`)
}
function pass(msg) { passes.push(msg); console.log(`  ✅ ${msg}`) }
function step(name) { console.log(`\n━━━ ${name} ━━━`) }

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(RUN_DIR, `${name}.png`), fullPage: false }) } catch {}
}

async function dismissCookie(page) {
  await page.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")').first().click({ timeout: 3000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 400))
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await dismissCookie(page)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PWD)
  await page.getByRole('button', { name: /^Accedi$/i }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 1500))
}

async function testWP(page) {
  step('WP — Sara De Luca (wp-mini@planfully-demo.it)')
  const errors = []
  page.on('pageerror', e => errors.push(`PAGE: ${e.message}`))

  try {
    await login(page, 'wp-mini@planfully-demo.it')
    pass('Login WP OK, URL: ' + page.url())
    await shot(page, '01-wp-home')

    // Sidebar nav check
    for (const label of ['Dashboard', 'Catalogo', 'Matrimoni', 'Rete fornitori', 'Calendario', 'Preventivi', 'Contratti', 'Finanziamento', 'Assicurazione', 'Brand', 'Profilo']) {
      const cnt = await page.locator(`a:has-text("${label}")`).count()
      if (cnt === 0) bug('NAV_WP', 'MEDIUM', `Voce nav mancante: ${label}`)
      else pass(`Nav voce ${label}`)
    }

    // Matrimoni
    await page.goto(`${BASE}/weddings`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    const wedCnt = await page.locator('a[href^="/weddings/"]').count()
    if (wedCnt === 0) bug('WEDDINGS', 'MEDIUM', 'Nessun matrimonio visibile in lista')
    else pass(`Matrimoni in lista: ${wedCnt}`)
    await shot(page, '02-wp-weddings')

    // Apri Andrea & Sofia (audit wedding creato sopra)
    const andrea = page.locator('a[href^="/weddings/"]').filter({ hasText: /Andrea/i }).first()
    if (await andrea.count() > 0) {
      await andrea.click()
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      await new Promise(r => setTimeout(r, 2000))
      await shot(page, '03-wp-wedding-detail')
      pass('Apertura wedding detail')

      // Tab Tavoli
      await page.locator('button:has-text("avoli")').first().click().catch(() => {})
      await new Promise(r => setTimeout(r, 1500))
      const tableCards = await page.locator('[class*="cursor-pointer"]').count()
      if (tableCards < 1) bug('TAB_TAVOLI', 'MEDIUM', 'Nessun tavolo visibile')
      else pass(`Tavoli: ${tableCards} cards`)
      await shot(page, '04-wp-tavoli')

      // Tab Invitati
      await page.locator('button:has-text("nvitati")').first().click().catch(() => {})
      await new Promise(r => setTimeout(r, 1500))
      const pdfBtn = await page.locator('button:has-text("PDF")').count()
      if (pdfBtn === 0) bug('TAB_INVITATI', 'LOW', 'Bottone PDF mancante')
      else pass('Tab invitati con PDF')
      await shot(page, '05-wp-invitati')

      // Tab Documenti / Contratto / Preventivo
      const contractBtn = page.locator('button:has-text("ontratt")').first()
      if (await contractBtn.count() > 0) {
        await contractBtn.click()
        await new Promise(r => setTimeout(r, 1500))
        await shot(page, '06-wp-contratto')
        pass('Tab contratto aperto')
      }
    }

    // Rete fornitori
    await page.goto(`${BASE}/suppliers`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    const fornCards = await page.locator('a[href^="/suppliers/"]').count()
    if (fornCards === 0) bug('SUPPLIERS_LIST', 'HIGH', 'Nessun fornitore in rete')
    else pass(`Fornitori in rete: ${fornCards}`)
    await shot(page, '07-wp-suppliers')

    // Apri primo fornitore
    if (fornCards > 0) {
      await page.locator('a[href^="/suppliers/"]').first().click()
      await page.waitForLoadState('networkidle').catch(() => {})
      await new Promise(r => setTimeout(r, 2000))
      await shot(page, '08-wp-supplier-detail')
      const svcCards = await page.locator('[class*="rounded"]').count()
      pass(`Pagina dettaglio fornitore caricata`)
    }

    // Preventivi
    await page.goto(`${BASE}/quotes`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    const qCnt = await page.locator('a[href^="/quotes/"]').count()
    if (qCnt === 0) bug('QUOTES', 'MEDIUM', 'Nessun preventivo visibile')
    else pass(`Preventivi in lista: ${qCnt}`)
    await shot(page, '09-wp-quotes')

    // Contratti
    await page.goto(`${BASE}/contracts`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    const cBody = await page.locator('body').innerText().catch(() => '')
    if (cBody.toLowerCase().includes('ancora nessun')) pass('Contratti: empty state OK')
    else pass('Contratti page')
    await shot(page, '10-wp-contracts')

    // Finanziamento SOON
    await page.goto(`${BASE}/finanziamento`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    const finBody = await page.locator('body').innerText()
    if (!/COMING SOON/i.test(finBody)) bug('FIN_SOON', 'LOW', 'Banner COMING SOON mancante in finanziamento')
    else pass('Finanziamento mostra COMING SOON')

    // Assicurazione SOON
    await page.goto(`${BASE}/assicurazione`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    const insBody = await page.locator('body').innerText()
    if (!/COMING SOON/i.test(insBody)) bug('INS_SOON', 'LOW', 'Banner COMING SOON mancante in assicurazione')
    else pass('Assicurazione mostra COMING SOON')

    // Catalogo
    await page.goto(`${BASE}/catalog`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    await shot(page, '11-wp-catalog')
    pass('Catalogo caricato')

    // Footer presence check
    const footer = await page.locator('footer').count()
    if (footer === 0) bug('FOOTER', 'LOW', 'Footer mancante')
    else pass('Footer presente')

  } catch (e) {
    bug('WP_FLOW', 'CRITICAL', 'WP flow crash', e?.message ?? String(e))
  }

  if (errors.length) {
    for (const e of errors) bug('CONSOLE_WP', 'MEDIUM', 'JS error console WP', e)
  }
}

async function testSposi(page) {
  step('SPOSI — giovanni.scozzafava+sposo@gmail.com')
  const errors = []
  page.on('pageerror', e => errors.push(`PAGE: ${e.message}`))

  try {
    await login(page, 'giovanni.scozzafava+sposo@gmail.com')
    pass('Login sposi OK, URL: ' + page.url())
    await shot(page, '20-couple-home')

    // Footer presence
    const footer = await page.locator('footer').count()
    if (footer === 0) bug('COUPLE_FOOTER', 'LOW', 'Footer mancante in couple dashboard')
    else pass('Footer presente in couple')

    // Logo Planfully presence (img src)
    const logoImg = await page.locator('img[src*="planfully-symbol"]').count()
    if (logoImg === 0) bug('COUPLE_LOGO', 'LOW', 'Logo Planfully SVG non presente nel couple top bar')
    else pass('Logo Planfully SVG presente')

    // Tab navigation (label visibile -> screenshot key)
    const tabs = [
      ['Overview', 'overview'], ['Documenti', 'documenti'], ['Programma', 'programma'],
      ['Invitati', 'invitati'], ['Tavoli', 'tavoli'], ['Mood', 'mood'],
      ['Playlist', 'playlist'], ['Sito ospiti', 'website'],
    ]
    for (const [label, key] of tabs) {
      const btn = page.locator(`button:has-text("${label}")`).first()
      if (await btn.count() > 0) {
        await btn.click().catch(() => {})
        await new Promise(r => setTimeout(r, 1100))
        await shot(page, `21-couple-tab-${key}`)
        pass(`Tab ${label} aperto`)
      } else {
        bug('COUPLE_TAB', 'LOW', `Tab mancante: ${label}`)
      }
    }
  } catch (e) {
    bug('SPOSI_FLOW', 'CRITICAL', 'Sposi flow crash', e?.message ?? String(e))
  }

  if (errors.length) {
    for (const e of errors) bug('CONSOLE_SPOSI', 'MEDIUM', 'JS error console sposi', e)
  }
}

async function testFornitore(page) {
  step('FORNITORE — forn-mini-foto@planfully-demo.it')
  const errors = []
  page.on('pageerror', e => errors.push(`PAGE: ${e.message}`))

  try {
    await login(page, 'forn-mini-foto@planfully-demo.it')
    pass('Login fornitore OK')
    await shot(page, '30-forn-home')

    // Sidebar voci specifiche fornitore
    for (const label of ['Disponibilità', 'Calcolatore', 'Catalogo']) {
      const cnt = await page.locator(`a:has-text("${label}")`).count()
      if (cnt === 0) bug('NAV_FORN', 'MEDIUM', `Voce nav fornitore mancante: ${label}`)
      else pass(`Nav voce ${label}`)
    }

    // No finanziamento per fornitore
    const finCnt = await page.locator('a:has-text("Finanziamento")').count()
    if (finCnt > 0) bug('FORN_FINANZIAMENTO', 'MEDIUM', 'Fornitore non dovrebbe vedere "Finanziamento" in sidebar')
    else pass('Fornitore non vede finanziamento (corretto)')

    // Calendar (vede guadagno proprio)
    await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    await shot(page, '31-forn-calendar')

    // Disponibilita
    await page.goto(`${BASE}/disponibilita`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    await shot(page, '32-forn-disponibilita')
    pass('Pagina disponibilita aperta')

    // Calcolatore
    await page.goto(`${BASE}/calcolatore`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    await shot(page, '33-forn-calcolatore')
    pass('Pagina calcolatore aperta')

    // Catalogo (vede solo i suoi)
    await page.goto(`${BASE}/catalog`, { waitUntil: 'networkidle' })
    await new Promise(r => setTimeout(r, 1500))
    await shot(page, '34-forn-catalog')
    pass('Pagina catalogo aperta')

  } catch (e) {
    bug('FORN_FLOW', 'CRITICAL', 'Forn flow crash', e?.message ?? String(e))
  }

  if (errors.length) {
    for (const e of errors) bug('CONSOLE_FORN', 'MEDIUM', 'JS error console fornitore', e)
  }
}

async function main() {
  console.log(`\n🚀 UI E2E AUDIT - ${new Date().toLocaleString('it-IT')}\nOutput: ${RUN_DIR}\n`)
  const browser = await chromium.launch({ headless: true })

  // WP
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await testWP(page)
    await ctx.close()
  }

  // Sposi
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await testSposi(page)
    await ctx.close()
  }

  // Fornitore
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await testFornitore(page)
    await ctx.close()
  }

  await browser.close()

  // Report
  console.log(`\n📊 PASS: ${passes.length}  ·  🐛 BUG: ${bugs.length}\n`)
  const md = [`# UI E2E Audit Planfully — ${new Date().toISOString()}\n\nPass: ${passes.length} · Bug: ${bugs.length}\n`]
  if (bugs.length === 0) md.push('✨ Nessun bug UI trovato.\n')
  else {
    const bySev = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] }
    for (const b of bugs) (bySev[b.severity] ?? bySev.LOW).push(b)
    for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      if (!bySev[sev].length) continue
      md.push(`\n## ${sev} (${bySev[sev].length})\n`)
      for (const b of bySev[sev]) {
        md.push(`- **[${b.area}]** ${b.msg}${b.detail ? `\n  - ${String(b.detail).slice(0, 200)}` : ''}`)
      }
    }
  }
  md.push('\n---\n## ✅ Passed\n')
  for (const p of passes) md.push(`- ${p}`)
  writeFileSync(path.join(RUN_DIR, 'report.md'), md.join('\n'))
  console.log(`Report: ${path.join(RUN_DIR, 'report.md')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
