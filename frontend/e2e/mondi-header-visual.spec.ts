import { test } from '@playwright/test'

// Verifica pittogramma nelle testate + badge provenienza mondo sul form.
//   PLAYWRIGHT_BASE_URL=https://planfully.it npx playwright test mondi-header --project=desktop-noauth

test('testata index col pittogramma', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 })
  await page.goto('/')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/__screenshots__/hdr-index.png' })
})

test('testata mondo /fioristi (pittogramma + marchio firmato)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 })
  await page.goto('/fioristi')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/__screenshots__/hdr-fioristi.png' })
})

test('form richiedi-accesso da mondo — badge + pittogramma', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await page.goto('/richiedi-accesso?mondo=fotografi')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/__screenshots__/accesso-mondo.png' })
})
