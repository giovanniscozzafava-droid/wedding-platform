import { test } from '@playwright/test'

// Grounding visivo della landing pubblica: la renderizzo ai viewport dell'handoff
// (375 / 768 / 1440) e catturo full-page per confrontarla col prototipo.
// Gira senza login (la landing è a `/` per i non autenticati) contro l'anteprima locale:
//   PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test landing-visual --project=mobile-noauth

const VIEWPORTS = [
  { name: '375', w: 375, h: 900 },
  { name: '768', w: 768, h: 1100 },
  { name: '1440', w: 1440, h: 1200 },
]

for (const v of VIEWPORTS) {
  test(`landing @ ${v.name}`, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h })
    await page.goto('/')
    // aspetta che il claim gigante sia montato e i font applicati
    await page.getByRole('heading', { name: /Il lavoro invisibile/ }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(600)
    await page.screenshot({ path: `e2e/__screenshots__/landing-${v.name}.png`, fullPage: true })
  })
}
