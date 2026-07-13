import { test, expect } from '@playwright/test'

// WI-0 · Smoke test di NON-REGRESSIONE per lo Studio immagine.
// Deve passare IDENTICO prima e dopo il refactor (spacchettamento del monolite).
// Copre: render, disegno di un tratto (pixel non vuoti), testo (oggetto editabile),
// undo, salvataggio. NOTE: i selettori usano i `title`/ruoli reali della UI attuale.
test('studio: render, disegno, testo, undo, salva', async ({ page }) => {
  await page.goto('/studio')

  const canvas = page.locator('canvas.touch-none').first()
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  // Pennello + tratto orizzontale al centro
  await page.getByTitle(/Pennello/).first().click()
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * 0.30, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.70, y, { steps: 14 })
  await page.mouse.up()

  // Il display canvas deve avere pixel diversi dal solo sfondo (#3a3d44)
  const changed = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d'); if (!ctx) return 0
    const d = ctx.getImageData(0, 0, el.width, el.height).data
    let diff = 0
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (Math.abs(d[i] - 0x3a) + Math.abs(d[i + 1] - 0x3d) + Math.abs(d[i + 2] - 0x44) > 40) diff++
    }
    return diff
  })
  expect(changed).toBeGreaterThan(0)

  // Testo: crea un box e scrivi
  await page.getByTitle(/Testo/).first().click()
  await canvas.click({ position: { x: box.width * 0.25, y: box.height * 0.25 } })
  const ta = page.locator('textarea').first()
  await expect(ta).toBeVisible()
  await ta.fill('Ciao WI-0')
  await expect(page.locator('textarea').first()).toHaveValue('Ciao WI-0')

  // Undo non deve rompere lo stato
  await page.keyboard.press('Control+z')

  // Salvataggio → toast di conferma
  await page.getByRole('button', { name: /Salva/ }).click()
  await expect(page.getByText(/salvat/i)).toBeVisible({ timeout: 20_000 })

  // TODO(WI-0): estendere con "riapri dalla galleria e verifica testo+pixel"
  // quando l'account di test avrà almeno un progetto salvato stabile.
})
