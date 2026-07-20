import { test } from '@playwright/test'

// Grounding visivo: landing con link ACCEDI + cookie banner nuovo brand, e il form
// /richiedi-accesso. Anteprima locale, senza login.
//   PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test access-visual --project=desktop-noauth

test('landing: nav ACCEDI + cookie banner nuovo brand', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('heading', { name: /Il lavoro invisibile/ }).waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'e2e/__screenshots__/access-landing-top.png', clip: { x: 0, y: 0, width: 1440, height: 700 } })
})

test('form richiedi-accesso', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 1100 })
  await page.goto('/richiedi-accesso')
  await page.getByRole('heading', { name: /Richiedi accesso/ }).waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'e2e/__screenshots__/access-form.png', fullPage: true })
})
