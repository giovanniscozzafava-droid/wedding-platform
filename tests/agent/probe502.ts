import { chromium } from '@playwright/test'

const run = async () => {
  const b = await chromium.launch({ headless: true })
  const ctx = await b.newContext()
  const page = await ctx.newPage()
  const reqs: any[] = []
  page.on('response', async (r) => {
    if (r.status() >= 400) {
      reqs.push({ url: r.url(), status: r.status() })
    }
  })

  // login
  await page.goto('https://planfully.it/login', { waitUntil: 'networkidle' })
  await page.locator('input[type="email"]').fill('giovanni.scozzafava+sposo@gmail.com')
  await page.locator('input[type="password"]').fill('Beta2026!')
  await Promise.all([
    page.waitForURL(/\/couple/, { timeout: 20000 }),
    page.locator('button[type="submit"]').click(),
  ])
  await page.waitForTimeout(2000)
  // mood tab
  await page.locator('nav button:has-text("Mood board")').click()
  await page.waitForTimeout(2000)
  // playlist
  await page.locator('nav button:has-text("Playlist")').click()
  await page.waitForTimeout(2000)
  // bomboniere
  await page.locator('nav button:has-text("Bomboniere")').click()
  await page.waitForTimeout(2000)

  console.log('FAILED REQUESTS:')
  reqs.forEach(r => console.log(' ', r.status, r.url))
  await b.close()
}
run().catch(console.error)
