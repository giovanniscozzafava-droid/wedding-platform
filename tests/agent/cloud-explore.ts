#!/usr/bin/env tsx
/**
 * Cloud explore agent: login come utenti reali su planfully.it, esegue azioni e screenshot.
 * Tutto rimane su planfully.it (modifiche persistenti).
 *
 * Esegui: tsx tests/agent/cloud-explore.ts
 */
import { chromium, type Page } from '@playwright/test'
import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.APP_BASE_URL ?? 'https://planfully.it'
const PASSWORD = 'Beta2026!'

const RUN_DIR = path.resolve(__dirname, `runs/cloud-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`)
mkdirSync(RUN_DIR, { recursive: true })
const LOG = path.join(RUN_DIR, 'log.md')
writeFileSync(LOG, `# Cloud explore — ${new Date().toISOString()}\n\nTarget: ${BASE}\n\n`)
function log(s: string) { appendFileSync(LOG, s + '\n'); process.stdout.write(s + '\n') }
async function shot(page: Page, name: string) {
  try { await page.screenshot({ path: path.join(RUN_DIR, `${name}.png`), fullPage: true }) } catch {}
}
async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('domcontentloaded')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /^Accedi$/i }).click()
  try {
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 })
  } catch {
    await shot(page, `login-fail-${email.split('@')[0]}`)
    throw new Error(`login fail ${email}`)
  }
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
}

async function explorePages(page: Page, paths: string[], prefix: string) {
  for (const p of paths) {
    await page.goto(`${BASE}${p}`)
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
    await sleep(1500 + Math.random() * 1500)
    const slug = p.replace(/\//g, '_') || '_root'
    await shot(page, `${prefix}${slug}`)
    log(`  · ${p}`)
  }
}

async function exploreWP(page: Page, email: string) {
  log(`\n## WP ${email}\n`)
  await login(page, email, PASSWORD)
  await shot(page, `wp-${email.split('@')[0]}-01-home`)

  // Naviga sezioni principali
  await explorePages(page, ['/', '/weddings', '/suppliers', '/calendar', '/catalog', '/quotes', '/settings/brand', '/profile'], `wp-${email.split('@')[0]}-`)

  // Apri primo matrimonio
  await page.goto(`${BASE}/weddings`)
  await page.waitForLoadState('networkidle').catch(() => {})
  const firstWedding = page.locator('a[href^="/weddings/"]').first()
  if (await firstWedding.count() > 0) {
    await firstWedding.click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(2000)
    await shot(page, `wp-${email.split('@')[0]}-wedding-detail`)
    log('  · aperto primo matrimonio')

    // Click tab uno per uno
    const tabs = ['overview', 'scaletta', 'tavoli', 'invitati', 'budget', 'checklist', 'mood', 'playlist', 'contratto', 'docs', 'analytics', 'members', 'alloggi', 'trasporti', 'bomboniere', 'sito']
    for (const t of tabs) {
      const btn = page.locator(`button:has-text("${t}"), a:has-text("${t}")`).first()
      if (await btn.count() > 0) {
        await btn.click({ timeout: 3000 }).catch(() => {})
        await sleep(1500)
        await shot(page, `wp-${email.split('@')[0]}-tab-${t}`)
        log(`    · tab ${t}`)
      }
    }
  }

  // Apri /suppliers e ispeziona primo fornitore
  await page.goto(`${BASE}/suppliers`)
  await page.waitForLoadState('networkidle').catch(() => {})
  await sleep(1500)
  await shot(page, `wp-${email.split('@')[0]}-suppliers-list`)
  const firstSupp = page.locator('a[href^="/suppliers/"]').first()
  if (await firstSupp.count() > 0) {
    await firstSupp.click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(1500)
    await shot(page, `wp-${email.split('@')[0]}-supplier-detail`)
    log('  · supplier detail')
  }
}

async function exploreFornitore(page: Page, email: string) {
  log(`\n## FORN ${email}\n`)
  await login(page, email, PASSWORD)
  await shot(page, `forn-${email.split('@')[0]}-01-home`)
  await explorePages(page, ['/', '/catalog', '/calendar', '/profile'], `forn-${email.split('@')[0]}-`)
}

async function exploreCouple(page: Page, email: string) {
  log(`\n## COUPLE ${email}\n`)
  await login(page, email, PASSWORD)
  await sleep(1500)
  await shot(page, `couple-${email.split('@')[0]}-01-home`)

  // Couple dashboard ha tab inline
  await page.goto(`${BASE}/couple`)
  await page.waitForLoadState('networkidle').catch(() => {})
  await sleep(2000)
  await shot(page, `couple-${email.split('@')[0]}-dashboard`)

  const tabs = ['overview', 'programma', 'alloggi', 'trasporti', 'invitati', 'tavoli', 'mood', 'playlist', 'bomboniere', 'sito ospiti']
  for (const t of tabs) {
    const btn = page.locator(`button:has-text("${t}")`).first()
    if (await btn.count() > 0) {
      await btn.click({ timeout: 3000 }).catch(() => {})
      await sleep(1500)
      await shot(page, `couple-${email.split('@')[0]}-tab-${t.replace(/\s+/g, '_')}`)
      log(`  · tab ${t}`)
    }
  }
}

async function main() {
  console.log(`\n▶ Cloud explore su ${BASE}\nOutput in ${RUN_DIR}\n`)
  const browser = await chromium.launch({ headless: true })

  const WP = 'wp.viliana.pession@planfully-demo.it'
  const FORN = 'forn.fotografo.visconti@planfully-demo.it'
  const COUPLE = 'sposi.asella.elpidio@planfully-demo.it'

  // WP
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    try { await exploreWP(page, WP) } catch (e) { log(`❌ WP fail: ${(e as Error).message}`) }
    await ctx.close()
  }

  // Fornitore
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    try { await exploreFornitore(page, FORN) } catch (e) { log(`❌ FORN fail: ${(e as Error).message}`) }
    await ctx.close()
  }

  // Couple
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    try { await exploreCouple(page, COUPLE) } catch (e) { log(`❌ COUPLE fail: ${(e as Error).message}`) }
    await ctx.close()
  }

  await browser.close()
  log('\n--- end ---')
  console.log(`\n✓ Done. Output: ${RUN_DIR}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
