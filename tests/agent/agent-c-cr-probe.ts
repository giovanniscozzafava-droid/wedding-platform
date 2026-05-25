/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium } from '@playwright/test'

async function main() {
  const b = await chromium.launch({ headless: true })
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const failed: any[] = []
  page.on('response', async (r) => {
    if (r.status() >= 400) {
      const url = r.url()
      let body = ''
      try { body = await r.text() } catch { body = '' }
      failed.push({ url, status: r.status(), body: body.slice(0, 300) })
    }
  })
  page.on('request', (req) => {
    if (req.method() !== 'GET' && req.url().includes('supabase')) {
      console.log('REQ', req.method(), req.url())
    }
  })

  await page.goto('https://planfully.it/login', { waitUntil: 'networkidle' })
  await page.locator('input[type="email"]').fill('giovanni.scozzafava+sposo@gmail.com')
  await page.locator('input[type="password"]').fill('Beta2026!')
  await Promise.all([
    page.waitForURL(/\/couple/, { timeout: 20_000 }),
    page.locator('button[type="submit"]').click(),
  ])
  await page.waitForTimeout(2000)
  await page.locator('nav button:has-text("Alloggi")').click()
  await page.waitForTimeout(700)
  await page.locator('button:has-text("Suggerisci modifica"), button:has-text("Richiedi modifica")').first().click()
  await page.waitForTimeout(700)
  await page.locator('input[placeholder*="Cambiare"], input[placeholder*="tavolo"]').first().fill('AGENT-C-probe')
  await page.locator('textarea').first().fill('AGENT-C details')
  await page.locator('button:has-text("Invia richiesta")').click()
  await page.waitForTimeout(3500)
  console.log('FAILED:', JSON.stringify(failed, null, 2))
  await b.close()
}
main().catch(console.error)
