import { test, expect } from '@playwright/test'

// Verifica: la vecchia /lista-attesa redirige all'unica lista d'attesa.
//   PLAYWRIGHT_BASE_URL=https://planfully.it npx playwright test waitlist-redirect-visual --project=desktop-noauth

test('/lista-attesa redirige a /richiedi-accesso', async ({ page }) => {
  await page.goto('/lista-attesa')
  await page.waitForURL(/\/richiedi-accesso/, { timeout: 15000 })
  await page.waitForTimeout(1500)
  expect(page.url()).toContain('/richiedi-accesso')
  await page.screenshot({ path: 'e2e/__screenshots__/wl-redirect.png' })
})
