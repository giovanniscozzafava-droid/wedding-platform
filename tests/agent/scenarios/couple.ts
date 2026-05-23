import type { Page, BrowserContext } from '@playwright/test'
import type { Persona } from '../personas'
import { logStep, screenshot, sleep, humanType, adminFetch } from '../utils'

// Scenario COUPLE: WP esistente (Giulia) invita la coppia → la coppia clicca link → onboarding wizard
export async function runCoupleScenario(ctx: BrowserContext, page: Page, p: Persona, runDir: string) {
  logStep(runDir, `>> COUPLE ${p.firstName} & ${p.partnerName} <${p.email}>`)

  // 1. Setup admin-side: crea wedding (owned by Giulia) + wedding_couple_member con token
  const GIULIA = '00000000-aaaa-0000-0000-000000000002'
  const weddingDate = `2027-0${1 + Math.floor(Math.random() * 9)}-${10 + Math.floor(Math.random() * 18)}`

  const wedding = await adminFetch('/rest/v1/calendar_entries', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      owner_id: GIULIA,
      title: `Matrimonio ${p.firstName} & ${p.partnerName}`,
      date_from: weddingDate,
      date_to: weddingDate,
      status: 'OPZIONATA',
    }),
  })
  const entryId = (wedding as any[])[0].id
  logStep(runDir, `  · wedding ${entryId} creato (data ${weddingDate})`)

  // 2. Crea auth.user COUPLE via admin API (la UI register non permette COUPLE)
  await adminFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: p.email,
      password: p.password,
      email_confirm: true,
      user_metadata: { role: 'COUPLE', full_name: p.fullName },
    }),
  })
  logStep(runDir, '  ✓ COUPLE auth.user creato via admin API')

  // 3. Crea invito couple member con email = p.email
  const member = await adminFetch('/rest/v1/wedding_couple_members', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      entry_id: entryId,
      email: p.email,
      full_name: p.fullName,
      role: 'SPOSA',
    }),
  })
  const token = (member as any[])[0].invite_token
  logStep(runDir, `  · invito couple_member creato token=${token.slice(0,8)}…`)

  // 4. Login UI con retry (race admin user → password grant a volte serve ~500ms)
  let loggedIn = false
  for (let attempt = 1; attempt <= 3 && !loggedIn; attempt++) {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await page.getByLabel('Email').fill(p.email)
    await page.getByLabel('Password').fill(p.password)
    await page.getByRole('button', { name: /^Accedi$/i }).click()
    // Atteso redirect: / oppure /couple oppure /onboarding (mai /login)
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 8_000 })
      loggedIn = true
    } catch {
      logStep(runDir, `  ! login tentativo ${attempt} fallito, retry`)
      await sleep(1500)
    }
  }
  if (!loggedIn) throw new Error('login UI failed dopo 3 tentativi')
  logStep(runDir, '  ✓ login UI')

  // 5. Vai su /couple/accept/:token → RPC accept_invite
  await page.goto(`/couple/accept/${token}`)
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await screenshot(page, runDir, '02-accept-invite')
  // La pagina di accept di solito ha un bottone Conferma/Accetta
  await page.getByRole('button', { name: /(Accett|Confer|Entra)/i }).first().click().catch(() => {})
  await sleep(1500)
  await screenshot(page, runDir, '03-after-accept')
  logStep(runDir, '  ✓ click accept')

  // 5. Vai su /onboarding → wizard couple
  await page.goto('/onboarding')
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await screenshot(page, runDir, '04-couple-onboarding-step0')

  // Step 0: nomi
  const inputs = page.locator('input[type="text"], input:not([type])')
  await humanType(inputs.nth(0), p.firstName).catch(() => {})
  await humanType(inputs.nth(1), p.partnerName ?? 'Partner').catch(() => {})
  await humanType(inputs.nth(2), `${p.firstName} & ${p.partnerName}`).catch(() => {})
  await sleep(500)
  await page.getByRole('button', { name: /Avanti/i }).click()
  logStep(runDir, '  ✓ step 0 (voi)')

  // Step 1 — stile + season + location_kind
  await page.waitForTimeout(300)
  await screenshot(page, runDir, '05-couple-stile')
  // Tocca i bottoni stile
  for (const s of (p.weddingStyle ?? []).slice(0, 3)) {
    await page.locator(`button:has-text("${capitalize(s.toLowerCase())}")`).first().click().catch(() => {})
    await sleep(150)
  }
  await sleep(500)
  await page.getByRole('button', { name: /Avanti/i }).click()
  logStep(runDir, `  ✓ step 1 (stile: ${p.weddingStyle?.join(',')})`)

  // Step 2 — vision
  await page.waitForTimeout(300)
  await screenshot(page, runDir, '06-couple-vision')
  await humanType(
    page.locator('textarea').first(),
    `Vogliamo un matrimonio ${(p.weddingStyle ?? ['classico'])[0]?.toLowerCase()}, con tanti fiori e musica live.`
  ).catch(() => {})
  await sleep(400)
  await page.getByRole('button', { name: /Avanti/i }).click()
  logStep(runDir, '  ✓ step 2 (vision)')

  // Step 3 — numeri
  await page.waitForTimeout(300)
  await screenshot(page, runDir, '07-couple-numeri')
  const numberInputs = page.locator('input[type="number"]')
  await humanType(numberInputs.nth(0), String(p.guestsEstimate ?? 100)).catch(() => {})
  await humanType(numberInputs.nth(1), String(p.budgetMin ?? 25000)).catch(() => {})
  await humanType(numberInputs.nth(2), String(p.budgetMax ?? 50000)).catch(() => {})
  await sleep(400)
  await page.getByRole('button', { name: /Avanti/i }).click()
  logStep(runDir, '  ✓ step 3 (numeri)')

  // Step 4 — Conferma
  await page.waitForTimeout(300)
  await screenshot(page, runDir, '08-couple-pronto')
  await page.getByRole('button', { name: /Conferma|Salva/i }).first().click()
  logStep(runDir, '  ✓ click conferma')

  await page.waitForURL('**/couple', { timeout: 15_000 }).catch(() => {})
  await screenshot(page, runDir, '09-couple-dashboard')
  logStep(runDir, '  ✓ approdo dashboard couple')

  // 6. Naviga le tab della dashboard couple
  await sleep(800)
  const tabs = ['overview', 'programma', 'mood', 'invitati', 'playlist']
  for (const t of tabs) {
    await page.locator(`button:has-text("${t}")`).first().click().catch(() => {})
    await page.waitForTimeout(700)
    await screenshot(page, runDir, `10-couple-tab-${t}`)
    logStep(runDir, `  · tab ${t}`)
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
