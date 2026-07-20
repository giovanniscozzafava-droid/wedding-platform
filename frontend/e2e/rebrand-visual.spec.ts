import { test } from '@playwright/test'

// Grounding del rebrand app: pagine che usano i componenti UI (Button/Card/Input) col
// nuovo brand filiera. Contro l'anteprima locale, senza login.
//   PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test rebrand-visual --project=desktop-noauth

test('login — brand app', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/login')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'e2e/__screenshots__/rebrand-login.png' })
})

test('registrazione — brand app', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/register')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'e2e/__screenshots__/rebrand-register.png', fullPage: true })
})
