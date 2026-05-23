import type { Page } from '@playwright/test'
import type { Persona } from '../personas'
import { logStep, screenshot, sleep, humanType, safeClick } from '../utils'

// Scenario per WP/LOC/FORN: signup → wizard 5 step → home
export async function runProviderScenario(page: Page, p: Persona, runDir: string) {
  logStep(runDir, `>> ${p.role} ${p.fullName} <${p.email}>`)

  // 1. Registrazione
  await page.goto('/register')
  await screenshot(page, runDir, '01-register')
  // Click sulla card del ruolo (Wedding Planner / Location / Fornitore)
  const roleLabel = p.role === 'WP' ? 'Wedding Planner' : p.role === 'LOC' ? 'Location' : 'Fornitore'
  await page.locator('button').filter({ hasText: new RegExp(`^${roleLabel}`, 'i') }).first().click()
  await sleep(200)
  if (p.role === 'FORN' && p.subrole) {
    // select #subrole appare solo per FORNITORE
    // mappa: solo fioraio/fotografo/catering/musicisti/altro sono nel <Select> register; gli altri vanno in "altro"
    const allowed = ['fioraio', 'fotografo', 'catering', 'musicisti', 'altro']
    const sr = allowed.includes(p.subrole) ? p.subrole : 'altro'
    await page.locator('#subrole').selectOption(sr).catch(() => {})
  }
  await humanType(page.getByLabel('Nome e cognome'), p.fullName)
  await humanType(page.getByLabel('Ragione sociale'), p.businessName ?? '')
  await humanType(page.getByLabel('Email'), p.email)
  await humanType(page.getByLabel('Password'), p.password)
  await sleep(400 + Math.random() * 600)
  await page.getByRole('button', { name: /^Crea account$/i }).first().click()
  logStep(runDir, '  ✓ submit signup')

  // 2. Attesa redirect a onboarding (RequireAuth gate)
  await page.waitForURL(/\/onboarding/, { timeout: 15_000 }).catch(async () => {
    logStep(runDir, '  ! signup non ha portato a /onboarding, screenshot ...')
    await screenshot(page, runDir, '02-no-redirect')
  })
  await screenshot(page, runDir, '02-onboarding-step0')

  // 3. Wizard step 0 — Identità
  // full_name è precompilato (dal metadata signup)
  // subrole select
  await page.locator('select').first().selectOption(p.subrole!).catch(async () => {
    logStep(runDir, '  ! select subrole non trovata, skip')
  })
  await humanType(page.locator('input[type=number]').first(), String(p.yearsActive ?? 5))
  await sleep(300)
  await safeClick(page.getByRole('button', { name: /Avanti/i }))
  logStep(runDir, '  ✓ step 0 (identità)')

  // 4. Step 1 — Azienda
  await page.waitForTimeout(300)
  await screenshot(page, runDir, '03-step1-azienda')
  await humanType(page.getByLabel(/Ragione sociale/i).first(), p.businessName!).catch(() => {})
  await humanType(page.getByLabel(/Partita IVA/i).first(), p.vatNumber!).catch(() => {})
  await humanType(page.getByLabel(/Codice fiscale/i).first(), p.fiscalCode!).catch(() => {})
  await humanType(page.getByLabel(/Indirizzo/i).first(), p.address).catch(() => {})
  await humanType(page.getByLabel(/Città/i).first(), p.city).catch(() => {})
  await humanType(page.getByLabel(/CAP/i).first(), p.zip).catch(() => {})
  await humanType(page.locator('input[type=number]').last(), String(p.serviceRadiusKm ?? 200)).catch(() => {})
  await sleep(500)
  await safeClick(page.getByRole('button', { name: /Avanti/i }))
  logStep(runDir, '  ✓ step 1 (azienda)')

  // 5. Step 2 — Contatti
  await page.waitForTimeout(300)
  await screenshot(page, runDir, '04-step2-contatti')
  await humanType(page.getByLabel(/Telefono/i).first(), p.phone).catch(() => {})
  await humanType(page.getByLabel(/Sito web/i).first(), p.website ?? '').catch(() => {})
  await humanType(page.getByLabel(/Instagram/i).first(), p.instagram ?? '').catch(() => {})
  await sleep(500)
  await safeClick(page.getByRole('button', { name: /Avanti/i }))
  logStep(runDir, '  ✓ step 2 (contatti)')

  // 6. Step 3 — Immagine
  await page.waitForTimeout(300)
  await screenshot(page, runDir, '05-step3-immagine')
  await humanType(page.getByPlaceholder(/Racconta in poche righe/i), p.bio ?? '').catch(() => {})
  await sleep(500)
  await safeClick(page.getByRole('button', { name: /Avanti/i }))
  logStep(runDir, '  ✓ step 3 (immagine)')

  // 7. Step 4 — Pronto + Completa
  await page.waitForTimeout(300)
  await screenshot(page, runDir, '06-step4-pronto')
  await safeClick(page.getByRole('button', { name: /Completa profilo/i }))
  logStep(runDir, '  ✓ click "Completa profilo"')

  // 8. Home dashboard
  await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/couple', { timeout: 15_000 })
  await screenshot(page, runDir, '07-home-dashboard')
  logStep(runDir, `  ✓ ${p.role} onboarding completato, atterrato in ${page.url()}`)

  // 9. Azioni casuali
  if (p.role === 'WP' || p.role === 'LOC') {
    await wpRoamAround(page, runDir)
  } else {
    await fornRoamAround(page, runDir)
  }
}

async function wpRoamAround(page: Page, runDir: string) {
  // Naviga: weddings, suppliers, calendar, catalog
  const routes = [
    { path: '/weddings',   shot: '08-weddings' },
    { path: '/suppliers',  shot: '09-suppliers' },
    { path: '/calendar',   shot: '10-calendar' },
    { path: '/catalog',    shot: '11-catalog' },
    { path: '/quotes',     shot: '12-quotes' },
  ]
  for (const r of routes) {
    await page.goto(r.path)
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
    await sleep(800 + Math.random() * 1200)
    await screenshot(page, runDir, r.shot)
    logStep(runDir, `  · visit ${r.path}`)
  }
}

async function fornRoamAround(page: Page, runDir: string) {
  await page.goto('/catalog')
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  await screenshot(page, runDir, '08-catalog')
  logStep(runDir, '  · visit /catalog (fornitore)')

  await page.goto('/profile')
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  await screenshot(page, runDir, '09-profile')
  logStep(runDir, '  · visit /profile')
}
