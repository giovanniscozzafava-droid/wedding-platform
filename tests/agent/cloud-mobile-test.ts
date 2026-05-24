#!/usr/bin/env tsx
import { chromium, devices } from '@playwright/test'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'https://planfully.it'
const PASSWORD = 'Beta2026!'
const RUN_DIR = path.resolve(__dirname, `runs/mobile-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`)
mkdirSync(RUN_DIR, { recursive: true })
const LOG = path.join(RUN_DIR, 'log.md')
writeFileSync(LOG, `# Mobile test ${new Date().toISOString()}\n\n`)
function log(s: string) { appendFileSync(LOG, s + '\n'); console.log(s) }
async function shot(p: any, n: string) { try { await p.screenshot({ path: path.join(RUN_DIR, `${n}.png`), fullPage: true }) } catch {} }
async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function main() {
  const browser = await chromium.launch({ headless: true })

  // === iPhone 14 Pro Max ===
  const phone = await browser.newContext({ ...(devices['iPhone 14 Pro Max'] ?? devices['iPhone 14']) })
  const page = await phone.newPage()

  log('## iPhone 14 viewport (390x844)\n')

  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle').catch(() => {})
  // Dismiss cookie banner
  await page.locator('button:has-text("Accetta tutto")').click({ timeout: 4000 }).catch(() => {})
  await sleep(400)
  await shot(page, '01-login')
  log('  · login page')

  await page.getByLabel('Email').fill('wp.viliana.pession@planfully-demo.it')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /^Accedi$/i }).click()
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await sleep(1500)
  await shot(page, '02-home')
  log('  · home wp')

  for (const route of ['/weddings', '/suppliers', '/catalog', '/calendar', '/quotes']) {
    await page.goto(`${BASE}${route}`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(1500)
    await shot(page, `03${route.replace(/\//g, '_')}`)
    log(`  · ${route}`)
  }

  // Apri matrimonio
  await page.goto(`${BASE}/weddings`)
  await page.waitForLoadState('networkidle').catch(() => {})
  const firstW = page.locator('a[href^="/weddings/"]').first()
  if (await firstW.count() > 0) {
    await firstW.click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(2000)
    await shot(page, '04-wedding-overview')

    for (const tab of ['scaletta', 'invitati', 'tavoli', 'alloggi', 'trasporti', 'bomboniere', 'budget', 'checklist', 'mood']) {
      const btn = page.locator(`button:has-text("${tab}"), a:has-text("${tab}")`).first()
      if (await btn.count() > 0) {
        await btn.click({ timeout: 3000 }).catch(() => {})
        await sleep(1500)
        await shot(page, `05-wedding-${tab}`)
        log(`    · tab ${tab}`)
      }
    }

    // Test click su prima card tavolo → modal
    const tablesBtn = page.locator('button:has-text("tavoli")').first()
    if (await tablesBtn.count() > 0) {
      await tablesBtn.click().catch(() => {})
      await sleep(1500)
      const firstTableCard = page.locator('[class*="cursor-pointer"]').first()
      if (await firstTableCard.count() > 0) {
        await firstTableCard.click().catch(() => {})
        await sleep(1500)
        await shot(page, '06-tavolo-modal')
        log('    · modal tavolo aperto')
      }
    }
  }

  await phone.close()

  // === Desktop wide ===
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const dp = await desktop.newPage()
  log('\n## Desktop 1440x900\n')

  await dp.goto(`${BASE}/login`)
  await dp.waitForLoadState('networkidle').catch(() => {})
  await dp.locator('button:has-text("Accetta tutto")').click({ timeout: 4000 }).catch(() => {})
  await sleep(400)
  await dp.getByLabel('Email').fill('wp.viliana.pession@planfully-demo.it')
  await dp.getByLabel('Password').fill(PASSWORD)
  await dp.getByRole('button', { name: /^Accedi$/i }).click()
  await dp.waitForLoadState('networkidle').catch(() => {})
  await sleep(1500)

  // Apri matrimonio + tab invitati
  await dp.goto(`${BASE}/weddings`)
  await dp.waitForLoadState('networkidle').catch(() => {})
  const firstD = dp.locator('a[href^="/weddings/"]').first()
  if (await firstD.count() > 0) {
    await firstD.click()
    await dp.waitForLoadState('networkidle').catch(() => {})
    await dp.locator('button:has-text("invitati")').first().click().catch(() => {})
    await sleep(2000)
    await shot(dp, 'desktop-invitati')
    log('  · invitati table desktop')

    await dp.locator('button:has-text("scaletta")').first().click().catch(() => {})
    await sleep(1500)
    await shot(dp, 'desktop-scaletta')

    await dp.locator('button:has-text("budget")').first().click().catch(() => {})
    await sleep(1500)
    await shot(dp, 'desktop-budget')
  }

  await desktop.close()
  await browser.close()
  log('\n--- end ---')
  console.log(`\n✓ Output: ${RUN_DIR}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
