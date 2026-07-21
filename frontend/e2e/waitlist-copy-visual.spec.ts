import { test } from '@playwright/test'

// Verifica reword lista d'attesa su prod.
//   PLAYWRIGHT_BASE_URL=https://planfully.it npx playwright test waitlist-copy-visual --project=desktop-noauth

test('index — CTA lista d\'attesa', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(2200)
  await page.screenshot({ path: 'e2e/__screenshots__/wl-index.png' })
})

test('login — no Registrati, sì lista d\'attesa', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await page.goto('/login')
  await page.waitForTimeout(2200)
  await page.screenshot({ path: 'e2e/__screenshots__/wl-login.png' })
})
