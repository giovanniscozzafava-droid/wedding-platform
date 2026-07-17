import { test, expect } from '@playwright/test'

/**
 * Blocker pre-Stories: con 263 mestieri, una select nativa su mobile uccide la
 * conversione. Questo test verifica sul SITO LIVE, a 375px, che il campo mestiere
 * sia un autocomplete e non una tendina — e che si usi con un dito.
 *
 * Gira contro produzione (la pagina è pubblica, non serve login):
 *   npx playwright test maestranze-waitlist-mobile --project=mobile-noauth
 */
const URL = 'https://planfully.it/maestranze/lista-attesa?source=instagram'

test.use({ viewport: { width: 375, height: 812 }, storageState: { cookies: [], origins: [] } })

test('picker mestieri: autocomplete, non select nativa', async ({ page }) => {
  await page.goto(URL)

  // Chiudo il cookie banner (un bottone solo, o strict mode fallisce): coprirebbe il
  // picker negli screenshot, ed è ciò che fa anche la persona vera prima di compilare.
  await page.getByRole('button', { name: 'Accetta tutto' }).click({ timeout: 5000 }).catch(() => {})

  // 1. Il vocabolario è arrivato dalla RPC (la pagina è anonima: se la RPC non fosse
  //    aperta ad anon, qui ci sarebbero 0 mestieri e il campo sarebbe inutile).
  await expect(page.getByText(/263 mestieri in elenco/)).toBeVisible({ timeout: 15000 })

  // 2. Il campo mestiere NON deve essere una <select>.
  const mestiereInput = page.getByPlaceholder(/Cerca: cameriere, organetto, fonico/)
  await expect(mestiereInput).toBeVisible()
  expect(await mestiereInput.evaluate((el) => el.tagName)).toBe('INPUT')

  // 3. Le uniche <select> ammesse sono zona e (in bacheca) esperienza: qui solo provincia.
  const selects = page.locator('select')
  expect(await selects.count()).toBe(1)

  // 4. Ricerca: digito "organ" → deve uscire l'organettista, con la sua famiglia accanto.
  await mestiereInput.fill('organ')
  const risultato = page.getByRole('button', { name: /Organettista/ })
  await expect(risultato).toBeVisible()
  await expect(page.getByText('Tradizione popolare').first()).toBeVisible()
  // Il momento che conta: dropdown aperto coi risultati, come lo vede la persona.
  // Porto il campo verso l'alto del viewport così input + risultati stanno nello scatto.
  await mestiereInput.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/__screenshots__/waitlist-375-autocomplete.png', fullPage: false })

  // 5. Il target del dito è abbastanza grande? (44px = minimo Apple HIG)
  const box = await risultato.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)

  // 6. Lo scelgo → il campo mostra la scelta, i risultati spariscono.
  await risultato.click()
  await expect(page.getByRole('button', { name: /Organettista.*cambia/s })).toBeVisible()

  await page.screenshot({ path: 'e2e/__screenshots__/waitlist-375-picker.png', fullPage: false })
})

test('niente scroll orizzontale a 375px', async ({ page }) => {
  await page.goto(URL)
  await expect(page.getByText(/263 mestieri in elenco/)).toBeVisible({ timeout: 15000 })
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  await page.screenshot({ path: 'e2e/__screenshots__/waitlist-375-full.png', fullPage: true })
})

test('elenco completo raggruppato per famiglia', async ({ page }) => {
  await page.goto(URL)
  await page.getByText(/Guarda tutti i 263 mestieri/).click()
  await expect(page.getByText('Tradizione popolare').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Portatore di vara' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/waitlist-375-famiglie.png', fullPage: false })
})
