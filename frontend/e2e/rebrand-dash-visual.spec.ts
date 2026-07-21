import { test, expect } from '@playwright/test'

// Verifica il rebrand DENTRO l'app: login reale come Baronella (LOCATION) su produzione,
// poi screenshot della dashboard e di una pagina interna.
//   PLAYWRIGHT_BASE_URL=https://planfully.it npx playwright test rebrand-dash --project=desktop-noauth

test('dashboard interna col nuovo brand', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.goto('/login')
  await page.getByPlaceholder('tu@esempio.it').fill('giovanni.scozzafava+baronella@gmail.com')
  await page.locator('input[type="password"]').fill('Beta2026!')
  await page.getByRole('button', { name: 'Accedi', exact: true }).click()
  // attende l'uscita dal login (dashboard o area interna)
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'e2e/__screenshots__/rebrand-dash.png' })
  // una pagina interna con liste/card
  await page.goto('/calendar')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'e2e/__screenshots__/rebrand-calendar.png' })
})
