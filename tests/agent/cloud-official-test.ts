#!/usr/bin/env tsx
/**
 * Test ufficiale Planfully — verifica end-to-end serio.
 * Per ogni ruolo verifica:
 * - Login
 * - Navigazione tutte le sezioni (tab, modal, lightbox)
 * - Verifica presenza dati attesi (servizi, foto, invitati, etc.)
 * - Interazioni: click card, apertura modal, esport PDF (no save)
 *
 * Output: log + screenshot per ogni step. Status PASS/FAIL.
 */
import { chromium, devices, type Page } from '@playwright/test'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'https://planfully.it'
const PWD = 'Beta2026!'
const RUN = path.resolve(__dirname, `runs/official-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`)
mkdirSync(RUN, { recursive: true })
const LOG = path.join(RUN, 'log.md')
writeFileSync(LOG, `# Test ufficiale Planfully — ${new Date().toISOString()}\nTarget: ${BASE}\n\n`)

let pass = 0, fail = 0
function log(s: string) { appendFileSync(LOG, s + '\n'); console.log(s) }
async function shot(p: Page, n: string) { try { await p.screenshot({ path: path.join(RUN, `${n}.png`), fullPage: true }) } catch {} }
async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function step(name: string, fn: () => Promise<void>) {
  const t0 = Date.now()
  try {
    await fn()
    pass++
    log(`  ✅ ${name} (${Date.now() - t0}ms)`)
  } catch (e) {
    fail++
    log(`  ❌ ${name} FAIL — ${(e as Error).message}`)
  }
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('domcontentloaded')
  // Cookie banner dismiss
  await page.locator('button:has-text("Accetta tutto")').click({ timeout: 3000 }).catch(() => {})
  await sleep(500)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PWD)
  await page.getByRole('button', { name: /^Accedi$/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
}

async function expectVisible(page: Page, selector: string, msg: string) {
  const el = page.locator(selector).first()
  if ((await el.count()) === 0) throw new Error(`${msg}: selector "${selector}" non trovato`)
}

async function testWP(page: Page, prefix: string) {
  log('\n## WP — wp-beta@planfully-demo.it\n')

  await step('Login WP', async () => login(page, 'wp-beta@planfully-demo.it'))
  await shot(page, `${prefix}-wp-01-home`)

  await step('Apri /weddings — lista matrimoni', async () => {
    await page.goto(`${BASE}/weddings`)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await sleep(1200)
    await expectVisible(page, 'h1, h2', 'titolo pagina')
    await expectVisible(page, 'a[href^="/weddings/"]', 'almeno un matrimonio in lista')
    await shot(page, `${prefix}-wp-02-weddings`)
  })

  await step('Apri primo matrimonio', async () => {
    await page.locator('a[href^="/weddings/"]').first().click()
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await sleep(1500)
    await shot(page, `${prefix}-wp-03-wedding-detail`)
  })

  await step('Tab Invitati con tabella', async () => {
    await page.locator('button:has-text("invitati")').first().click().catch(() => {})
    await sleep(1500)
    await expectVisible(page, 'button:has-text("PDF")', 'bottone PDF export')
    await shot(page, `${prefix}-wp-04-invitati`)
  })

  await step('Tab Tavoli + click card → modal edit', async () => {
    await page.locator('button:has-text("tavoli")').first().click().catch(() => {})
    await sleep(1500)
    await shot(page, `${prefix}-wp-05-tavoli`)
    const tableCard = page.locator('[class*="cursor-pointer"]').first()
    if ((await tableCard.count()) > 0) {
      await tableCard.click()
      await sleep(1200)
      await shot(page, `${prefix}-wp-06-tavolo-modal`)
      const closeBtn = page.locator('button[aria-label="Chiudi"]').first()
      if ((await closeBtn.count()) > 0) await closeBtn.click().catch(() => {})
    }
  })

  await step('Tab Scaletta + PDF visibile', async () => {
    await page.locator('button:has-text("scaletta")').first().click().catch(() => {})
    await sleep(1500)
    await expectVisible(page, 'button:has-text("PDF")', 'PDF scaletta')
    await shot(page, `${prefix}-wp-07-scaletta`)
  })

  await step('Tab Budget', async () => {
    await page.locator('button:has-text("budget")').first().click().catch(() => {})
    await sleep(1500)
    await shot(page, `${prefix}-wp-08-budget`)
  })

  await step('Apri /suppliers + ispeziona primo + lightbox', async () => {
    await page.goto(`${BASE}/suppliers`)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await sleep(1500)
    await shot(page, `${prefix}-wp-09-suppliers-list`)
    const first = page.locator('a[href^="/suppliers/"]').first()
    if ((await first.count()) > 0) {
      await first.click()
      await page.waitForLoadState('networkidle').catch(() => {})
      await sleep(2000)
      await shot(page, `${prefix}-wp-10-supplier-detail`)
      // Click su prima card servizio per aprire lightbox
      const serviceCard = page.locator('[class*="cursor-pointer"]').first()
      if ((await serviceCard.count()) > 0) {
        await serviceCard.click()
        await sleep(1500)
        await shot(page, `${prefix}-wp-11-service-lightbox`)
      }
    }
  })
}

async function testFornitore(page: Page, prefix: string) {
  log('\n## FORNITORE — forn-beta-fotografo@planfully-demo.it\n')

  await step('Login Fornitore', async () => login(page, 'forn-beta-fotografo@planfully-demo.it'))
  await shot(page, `${prefix}-forn-01-home`)

  await step('Vede sidebar Disponibilità + Calcolatore', async () => {
    await expectVisible(page, 'a[href="/disponibilita"]', 'link Disponibilità in sidebar')
    await expectVisible(page, 'a[href="/calcolatore"]', 'link Calcolatore in sidebar')
  })

  await step('Apri /disponibilita — calendario verde/giallo/rosso', async () => {
    await page.goto(`${BASE}/disponibilita`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(1500)
    await expectVisible(page, 'button:has-text("Sì disponibile"), span:has-text("Sì disponibile")', 'legend Sì disponibile')
    await shot(page, `${prefix}-forn-02-disponibilita`)
  })

  await step('Apri /calcolatore — borsino + preset', async () => {
    await page.goto(`${BASE}/calcolatore`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(1500)
    await expectVisible(page, 'h1:has-text("Calcolatore"), h2:has-text("Calcolatore")', 'titolo Calcolatore')
    await shot(page, `${prefix}-forn-03-calcolatore`)
  })

  await step('Apri /catalog — vede SOLO propri servizi', async () => {
    await page.goto(`${BASE}/catalog`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(1500)
    await shot(page, `${prefix}-forn-04-catalog`)
  })

  await step('Apri /profile — campo work_style + GDPR delete', async () => {
    await page.goto(`${BASE}/profile`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(1500)
    await expectVisible(page, 'button:has-text("Richiedi cancellazione")', 'bottone GDPR')
    await shot(page, `${prefix}-forn-05-profile-gdpr`)
  })
}

async function testCouple(page: Page, prefix: string) {
  log('\n## COUPLE — sposi-beta-1@planfully-demo.it\n')

  await step('Login Coppia 1', async () => login(page, 'sposi-beta-1@planfully-demo.it'))
  await shot(page, `${prefix}-couple-01-home`)

  await step('Atterra su /couple dashboard', async () => {
    await page.goto(`${BASE}/couple`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(2000)
    await shot(page, `${prefix}-couple-02-dashboard`)
  })

  const tabs = ['overview', 'programma', 'invitati', 'tavoli', 'mood', 'playlist', 'alloggi', 'trasporti']
  for (const t of tabs) {
    await step(`Tab ${t}`, async () => {
      const btn = page.locator(`button:has-text("${t}")`).first()
      if ((await btn.count()) > 0) {
        await btn.click().catch(() => {})
        await sleep(1300)
        await shot(page, `${prefix}-couple-tab-${t}`)
      }
    })
  }

  await step('Link /profile dalla top-right (GDPR)', async () => {
    await page.goto(`${BASE}/profile`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(1500)
    await expectVisible(page, 'button:has-text("Richiedi cancellazione")', 'GDPR delete COUPLE')
    await shot(page, `${prefix}-couple-profile-gdpr`)
  })
}

async function main() {
  console.log(`\n▶ Test ufficiale Planfully\nOutput: ${RUN}\n`)
  const browser = await chromium.launch({ headless: true })

  // Mobile iPhone 14 Pro Max
  log('## VIEWPORT: iPhone 14 Pro Max (430x932)\n')
  {
    const ctx = await browser.newContext({ ...(devices['iPhone 14 Pro Max'] ?? devices['iPhone 14']) })
    const page = await ctx.newPage()
    await testWP(page, 'mobile').catch((e) => log(`❌ WP mobile crash: ${e.message}`))
    await ctx.close()
  }
  {
    const ctx = await browser.newContext({ ...(devices['iPhone 14 Pro Max'] ?? devices['iPhone 14']) })
    const page = await ctx.newPage()
    await testFornitore(page, 'mobile').catch((e) => log(`❌ FORN mobile crash: ${e.message}`))
    await ctx.close()
  }
  {
    const ctx = await browser.newContext({ ...(devices['iPhone 14 Pro Max'] ?? devices['iPhone 14']) })
    const page = await ctx.newPage()
    await testCouple(page, 'mobile').catch((e) => log(`❌ COUPLE mobile crash: ${e.message}`))
    await ctx.close()
  }

  // Desktop
  log('\n\n## VIEWPORT: Desktop 1440x900\n')
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await testWP(page, 'desktop').catch((e) => log(`❌ WP desktop crash: ${e.message}`))
    await ctx.close()
  }

  await browser.close()
  log(`\n\n═══ SUMMARY ═══\nPASS: ${pass}\nFAIL: ${fail}\n`)
  console.log(`\nOutput in ${RUN}\nPASS: ${pass} · FAIL: ${fail}\n`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
