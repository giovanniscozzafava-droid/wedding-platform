import { test, expect } from '@playwright/test'

const SEED = {
  giulia: { email: 'giulia@wp-test.it', password: 'Test123!' },
}

test.describe('Auth flow', () => {
  test('route protetta redirige a /login se non autenticato', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('login-form')).toBeVisible()
  })

  test('login KO con password errata', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(SEED.giulia.email)
    await page.getByLabel('Password').fill('WRONG_PASSWORD')
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('login OK + logout', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(SEED.giulia.email)
    await page.getByLabel('Password').fill(SEED.giulia.password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page).toHaveURL('/', { timeout: 10_000 })
    await expect(page.getByText(/Giulia Rossi|giulia@wp-test.it/)).toBeVisible()

    await page.getByRole('link', { name: 'Profilo' }).click()
    await expect(page).toHaveURL(/\/profile/)
    await page.getByTestId('logout-btn').click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('registrazione nuovo WP + onboarding visibile', async ({ page }) => {
    const stamp = Date.now()
    const email = `e2e_${stamp}@wp-test.it`
    await page.goto('/register')
    await page.getByLabel('Nome e cognome').fill(`E2E Test ${stamp}`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('Test123!')
    await page.getByRole('button', { name: 'Crea account' }).click()
    // attesa: uscire da /register significa signup OK
    await page.waitForURL((u) => !u.pathname.startsWith('/register'), { timeout: 20_000 })
    expect(page.url()).toMatch(/\/onboarding$|\/$/)
  })

  test('forgot-password invia email (Mailpit)', async ({ page, request }) => {
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill(SEED.giulia.email)
    await page.getByRole('button', { name: 'Invia link reset' }).click()
    await expect(page.getByTestId('forgot-sent')).toBeVisible({ timeout: 15_000 })

    // Mailpit espone /api/v1/messages (hostname rimasto 'inbucket' per backward compat)
    await page.waitForTimeout(2000)
    const res = await request.get('http://127.0.0.1:54324/api/v1/messages')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { messages?: Array<{ To: Array<{ Address: string }> }> }
    const found = (body.messages ?? []).some((m) =>
      (m.To ?? []).some((t) => t.Address.toLowerCase() === SEED.giulia.email.toLowerCase()),
    )
    expect(found).toBe(true)
  })
})
