import { test } from '@playwright/test'

// Grounding visivo del sistema "I Mondi" su produzione.
//   PLAYWRIGHT_BASE_URL=https://planfully.it npx playwright test mondi-visual --project=desktop-noauth

test('pagina mondo /fotografi', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/fotografi')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'e2e/__screenshots__/mondo-fotografi.png', fullPage: true })
})

test('index — hero + sezione LA RETE', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'e2e/__screenshots__/index-hero.png' })
  // scrolla alla sezione rete
  await page.locator('#rete').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'e2e/__screenshots__/index-rete.png' })
})

test('mobile 375 — pagina mondo', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/catering')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'e2e/__screenshots__/mondo-catering-375.png', fullPage: true })
})
