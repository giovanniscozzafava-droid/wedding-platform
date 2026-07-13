import { test as setup } from '@playwright/test'
import fs from 'node:fs'

// Login una volta e salva lo storageState per gli spec autenticati.
// Imposta le credenziali di un account di TEST (non di produzione reale):
//   PLAYWRIGHT_EMAIL=... PLAYWRIGHT_PASSWORD=... npx playwright test
const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_EMAIL
  const password = process.env.PLAYWRIGHT_PASSWORD
  if (!email || !password) throw new Error('Imposta PLAYWRIGHT_EMAIL e PLAYWRIGHT_PASSWORD (account di test).')
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
  fs.mkdirSync('e2e/.auth', { recursive: true })
  await page.context().storageState({ path: authFile })
})
