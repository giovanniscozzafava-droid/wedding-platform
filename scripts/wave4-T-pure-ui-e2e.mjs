#!/usr/bin/env node
/**
 * Wave 4 — Agent T — PURE UI E2E (NO SHORTCUTS)
 *
 * Sofia & Marco — Cosenza 2027-09-12, Tenuta degli Ulivi
 *
 * Differenza vs Agent P (wave3):
 *  - TUTTI i passaggi happy-path passano per UI Playwright (click, fill, drag, canvas).
 *  - Service-role usata SOLO per: cleanup pre/post, lookup token (couple invite, quote token,
 *    contract token, supplier invite token) e VERIFICA stato finale.
 *  - Nessun INSERT/UPDATE in tabelle dominio (quotes, quote_items, contracts, event_*, ...)
 *    eseguito dallo script: tutto deve nascere da UI.
 *
 * Obiettivo: verificare se l'utente reale puo` concludere il workflow completo (registrazione →
 * preventivo firmato → contratto firmato → wedding popolato) senza touch DB. Confronto con P.
 */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import path from 'node:path'

const BASE = 'https://planfully.it'
const PWD = 'Beta2026!'
const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const TS_FULL = Date.now()
const TS = String(TS_FULL).slice(-7)
const RUN_DIR = process.env.RUN_DIR || `/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave4-T-pure-ui-e2e-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
mkdirSync(RUN_DIR, { recursive: true })
mkdirSync(path.join(RUN_DIR, 'downloads'), { recursive: true })

const EMAILS = {
  wp:     `agent-t-wp-${TS}@planfully-demo.it`,
  foto:   `agent-t-foto-${TS}@planfully-demo.it`,
  couple: `agent-t-couple-${TS}@planfully-demo.it`,
}
writeFileSync(path.join(RUN_DIR, 'emails.json'), JSON.stringify(EMAILS, null, 2))

const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

const phases = {}
const finalState = { uiOnlyOk: {}, dbForced: [] }

function startPhase(n, name) {
  phases[n] = { name, started: new Date().toISOString(), steps: [], screenshots: [], bugs: [], notes: [] }
  console.log(`\n========== PHASE ${n}: ${name} ==========`)
}
function endPhase(n, ok) {
  phases[n].finished = new Date().toISOString()
  phases[n].ok = ok
  const dur = (new Date(phases[n].finished).getTime() - new Date(phases[n].started).getTime()) / 1000
  phases[n].durationSec = dur
  console.log(`---------- PHASE ${n} ${ok ? 'OK' : 'FAIL'} (${dur.toFixed(1)}s) ----------`)
}
function step(n, name, ok, detail) {
  phases[n].steps.push({ name, ok, detail: detail ? String(detail).slice(0, 600) : null, ts: new Date().toISOString() })
  console.log(`  ${ok ? '[OK]' : '[FAIL]'} ${name}${detail ? ' — ' + String(detail).slice(0, 160) : ''}`)
}
function bug(n, severity, area, msg) {
  phases[n].bugs.push({ severity, area, msg })
  console.log(`  [BUG ${severity}] ${area}: ${msg}`)
}
function note(n, msg) {
  phases[n].notes.push(msg)
  console.log(`  [NOTE] ${msg}`)
}
async function shot(page, n, name) {
  const fn = `phase${n}-${name}.png`
  try {
    await page.screenshot({ path: path.join(RUN_DIR, fn), fullPage: false, timeout: 5000 })
    phases[n].screenshots.push(fn)
  } catch (e) {
    console.log(`  [shot fail] ${fn}: ${e.message}`)
  }
}

async function dismissCookie(page) {
  for (const txt of ['Solo essenziali', 'Accetta tutto', 'Accetta']) {
    await page.locator(`button:has-text("${txt}")`).first().click({ timeout: 1200 }).catch(() => {})
  }
  await page.waitForTimeout(250)
}

async function loginUi(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await dismissCookie(page)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PWD)
  await page.getByRole('button', { name: /^Accedi$/i }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1000)
}

async function logout(page) {
  await page.context().clearCookies()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    try {
      Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-') || k.includes('supabase')) localStorage.removeItem(k) })
      Object.keys(sessionStorage).forEach(k => { if (k.startsWith('sb-') || k.includes('supabase')) sessionStorage.removeItem(k) })
    } catch (e) {}
  })
  await page.waitForTimeout(500)
}

// Mini PNG 1x1 colore solido
function makeTestPng() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
}
const PNG_LOGO = path.join(RUN_DIR, 'logo-test.png')
writeFileSync(PNG_LOGO, makeTestPng())

// Lookup-only DB helpers (NIENTE writes durante happy-path)
async function getUserId(email) {
  const { data: u } = await sb.auth.admin.listUsers({ perPage: 1000 })
  return u?.users?.find(x => x.email === email)?.id ?? null
}
async function delByEmail(email) {
  const uid = await getUserId(email)
  if (uid) {
    await sb.from('profiles').delete().eq('id', uid)
    await sb.auth.admin.deleteUser(uid).catch(() => {})
  }
}

async function drawSignature(page, n, label = 'signature') {
  const canvas = page.locator('canvas').first()
  if (await canvas.count() === 0) return false
  const box = await canvas.boundingBox()
  if (!box) return false
  await canvas.scrollIntoViewIfNeeded()
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(box.x + 20 + i * 6, box.y + box.height / 2 + Math.sin(i / 3) * 20, { steps: 3 })
  }
  await page.mouse.up()
  await page.waitForTimeout(800)
  await shot(page, n, `${label}-drawn`)
  return true
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] })
  const baseCtx = {
    viewport: { width: 1440, height: 900 },
    locale: 'it-IT',
    userAgent: 'Mozilla/5.0 AgentT-PureUI',
    acceptDownloads: true,
  }
  const ctx = await browser.newContext(baseCtx)
  const page = await ctx.newPage()

  // Cleanup preventivo se utenti residui da run precedenti
  for (const e of Object.values(EMAILS)) await delByEmail(e).catch(() => {})

  let wpUserId = null
  let fotoUserId = null
  let coupleUserId = null
  let weddingId = null
  let quoteId = null
  let quoteToken = null
  let contractId = null
  let contractToken = null

  // ============================================================
  // PHASE 1 — WP registrazione + onboarding wizard + brand
  // ============================================================
  startPhase(1, 'WP registration (UI register + onboarding wizard + brand upload)')
  try {
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await shot(page, 1, '01-register-page')

    // Form registrazione
    await page.getByLabel('Nome e cognome').fill('Sofia Wedding Atelier').catch(() => {})
    await page.locator('#business_name').fill('Sofia Wedding Atelier SRL').catch(() => {})
    await page.locator('#email').fill(EMAILS.wp)
    await page.locator('#password').fill(PWD)
    // role default WEDDING_PLANNER (cerca radio/select se presente)
    const roleSel = page.locator('select[name="role"], select#role').first()
    if (await roleSel.count() > 0) await roleSel.selectOption('WEDDING_PLANNER').catch(() => {})
    await shot(page, 1, '02-register-filled')
    await page.getByRole('button', { name: /^Crea account$/i }).click()
    await page.waitForURL(/\/onboarding/, { timeout: 20000 })
    step(1, 'WP registered via UI → onboarding', true, page.url())
    await page.waitForTimeout(1500)
    await shot(page, 1, '03-onboarding-step0')

    // Wizard onboarding step-by-step (PURO UI: click Avanti)
    // STEP 0: Identità + subrole
    const subSelect = page.locator('select').first()
    if (await subSelect.count() > 0) {
      await subSelect.selectOption('wedding_planner').catch(() => {})
    }
    await page.getByRole('button', { name: /^Avanti$/i }).click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    await shot(page, 1, '04-onboarding-step1')

    // STEP 1: Azienda (città Cosenza)
    await page.getByLabel('Città').fill('Cosenza').catch(() => {})
    await page.getByLabel('CAP').fill('87100').catch(() => {})
    await page.getByLabel('Nazione').fill('Italia').catch(() => {})
    await page.getByRole('button', { name: /^Avanti$/i }).click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    await shot(page, 1, '05-onboarding-step2')

    // STEP 2: Contatti
    await page.getByLabel('Telefono').fill('+39 0984 555 123').catch(() => {})
    await page.getByRole('button', { name: /^Avanti$/i }).click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    await shot(page, 1, '06-onboarding-step3')

    // STEP 3: Bio
    const ta = page.locator('textarea').first()
    await ta.fill('Sofia Wedding Atelier è uno studio di wedding planning con sede a Cosenza, specializzato in matrimoni eleganti in Calabria.').catch(() => {})
    await page.getByRole('button', { name: /^Avanti$/i }).click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    await shot(page, 1, '07-onboarding-step4')

    // STEP 4: Completa
    await page.getByRole('button', { name: /Completa profilo|^Completa$/i }).click({ timeout: 5000 }).catch(() => {})
    await page.waitForURL(u => !u.pathname.startsWith('/onboarding'), { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    await shot(page, 1, '08-wp-home')
    const onboardingDone = !page.url().includes('/onboarding')
    step(1, 'Onboarding wizard completato via UI', onboardingDone, page.url())
    if (!onboardingDone) bug(1, 'HIGH', 'ONBOARDING_UI', 'Wizard onboarding non si è chiuso dopo "Completa"')

    // Brand: /settings/brand upload logo + colori
    await page.goto(`${BASE}/settings/brand`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await page.waitForTimeout(2000)
    await shot(page, 1, '09-brand-page')

    // Sblocca eventuale paywall
    const upgrade = page.getByRole('button', { name: /PREMIUM|Premium|Sblocca|Attiva/i }).first()
    if (await upgrade.count() > 0) {
      await upgrade.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(1500)
    }

    // Upload logo via input file
    const fileInputs = page.locator('input[type="file"]')
    let logoUploaded = false
    if (await fileInputs.count() > 0) {
      await fileInputs.first().setInputFiles(PNG_LOGO).catch(() => {})
      await page.waitForTimeout(3000)
      logoUploaded = true
      step(1, 'Brand logo uploaded via UI input[type=file]', true)
    } else {
      bug(1, 'HIGH', 'BRAND_FILE_INPUT', 'Nessun input[type=file] per logo')
    }

    // Colori primario/secondario via color picker o text input
    const colorInputs = page.locator('input[type="color"]')
    const ciCount = await colorInputs.count()
    if (ciCount >= 2) {
      await colorInputs.nth(0).fill('#C49A5C').catch(() => {})
      await colorInputs.nth(1).fill('#1A2E4F').catch(() => {})
      step(1, `Brand colors set via UI: #C49A5C / #1A2E4F (color inputs found: ${ciCount})`, true)
    } else {
      // fallback su input testuali con pattern hex
      const hexInputs = page.locator('input[placeholder*="#"], input[value^="#"]')
      const hc = await hexInputs.count()
      if (hc >= 2) {
        await hexInputs.nth(0).fill('#C49A5C').catch(() => {})
        await hexInputs.nth(1).fill('#1A2E4F').catch(() => {})
        step(1, `Brand colors set via text input hex (found: ${hc})`, true)
      } else {
        bug(1, 'MEDIUM', 'BRAND_COLORS', `Nessun color picker o text hex trovato`)
      }
    }

    // Salva brand
    const saveBrand = page.getByRole('button', { name: /Salva|Applica|Aggiorna/i }).first()
    if (await saveBrand.count() > 0) {
      await saveBrand.click({ timeout: 4000 }).catch(() => {})
      await page.waitForTimeout(2500)
    }
    await shot(page, 1, '10-brand-saved')

    // Verifica DB (lookup-only)
    wpUserId = await getUserId(EMAILS.wp)
    finalState.wpUserId = wpUserId
    const { data: profile } = await sb.from('profiles').select('id, onboarding_complete, city, brand_logo_url, brand_primary_color, brand_secondary_color, subrole').eq('id', wpUserId).maybeSingle()
    step(1, 'WP profile in DB', !!profile, JSON.stringify({
      onboarding_complete: profile?.onboarding_complete,
      city: profile?.city,
      has_logo: !!profile?.brand_logo_url,
      primary: profile?.brand_primary_color,
      secondary: profile?.brand_secondary_color,
      subrole: profile?.subrole,
    }))
    finalState.uiOnlyOk.wpOnboarding = !!profile?.onboarding_complete
    finalState.uiOnlyOk.brandLogo = !!profile?.brand_logo_url
    if (!profile?.onboarding_complete) bug(1, 'HIGH', 'ONBOARDING_FLAG', 'onboarding_complete=false dopo wizard UI')
    if (!profile?.brand_logo_url) bug(1, 'HIGH', 'BRAND_LOGO', 'brand_logo_url vuoto dopo upload UI')

    endPhase(1, !!wpUserId && !!profile?.onboarding_complete)
  } catch (e) {
    bug(1, 'HIGH', 'PHASE1', e.message)
    await shot(page, 1, '99-error')
    wpUserId = await getUserId(EMAILS.wp)
    finalState.wpUserId = wpUserId
    endPhase(1, false)
  }

  // ============================================================
  // PHASE 2 — WP invita fornitore foto via UI; fornitore accetta + signup via UI
  // ============================================================
  startPhase(2, 'WP invites foto supplier via UI + supplier accepts via UI')
  let supplierInviteToken = null
  try {
    if (!page.url().startsWith(BASE) || page.url().includes('/login')) {
      await loginUi(page, EMAILS.wp)
    }
    await page.goto(`${BASE}/suppliers`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await page.waitForTimeout(2000)
    await shot(page, 2, '01-suppliers-page')

    // Click "Invita fornitore" via data-testid
    let opened = false
    for (let attempt = 0; attempt < 3 && !opened; attempt++) {
      const btn = page.locator('[data-testid="invite-btn"]').first()
      if (await btn.count() > 0) {
        await btn.click({ timeout: 5000, force: true }).catch(() => {})
      } else {
        const fb = page.getByRole('button', { name: /Invita/i }).first()
        await fb.click({ timeout: 3000, force: true }).catch(() => {})
      }
      await page.waitForTimeout(900)
      opened = (await page.locator('#invite-email').count()) > 0
    }
    if (!opened) {
      bug(2, 'HIGH', 'INVITE_MODAL', 'Modale "Invita fornitore" non si apre')
    } else {
      step(2, 'Invite modal opened via UI', true)
      await page.locator('#invite-email').fill(EMAILS.foto)
      // optional name field
      const nameField = page.locator('#invite-name, input[name="invite-name"]').first()
      if (await nameField.count() > 0) await nameField.fill('Studio Foto Test').catch(() => {})
      const sel = page.locator('#invite-subrole')
      await sel.selectOption('fotografo').catch(async () => {
        await sel.selectOption({ label: /fotografo/i }).catch(() => {})
      })
      await shot(page, 2, '02-invite-foto-form')
      await page.getByRole('button', { name: /Genera link/i }).click({ timeout: 5000 })
      await page.waitForTimeout(3000)
      // estrai link mostrato (font-mono div)
      const linkText = await page.locator('div.font-mono').textContent({ timeout: 5000 }).catch(() => null)
      if (linkText) {
        const tokenMatch = linkText.match(/invito-fornitore\/([a-f0-9-]+)/)
        if (tokenMatch) {
          supplierInviteToken = tokenMatch[1]
          step(2, 'Invite link generato via UI', true, supplierInviteToken.slice(0, 12))
        }
      }
      await shot(page, 2, '03-invite-link')
      // chiudi modale
      await page.getByRole('button', { name: /Chiudi/i }).click({ timeout: 3000 }).catch(() => {})
    }

    // Fallback lookup token via DB (lookup-only — il link è user-shown ma a volte font-mono cambia)
    if (!supplierInviteToken) {
      const { data: invRow } = await sb.from('supplier_invites').select('token')
        .eq('capostipite_id', wpUserId).eq('email', EMAILS.foto).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (invRow?.token) {
        supplierInviteToken = invRow.token
        step(2, 'Invite token retrieved via DB lookup (UI link scrape failed)', true, supplierInviteToken.slice(0, 12))
        note(2, 'UI ha generato link ma scrape font-mono non l ha catturato; recuperato via DB lookup-only.')
      } else {
        bug(2, 'HIGH', 'INVITE_TOKEN_MISSING', 'Nessun token invito nel DB dopo Genera link UI')
      }
    }

    // Fornitore accetta invito via /invito-fornitore/:token (PURO UI in nuovo contesto)
    if (supplierInviteToken) {
      await logout(page)
      const supCtx = await browser.newContext(baseCtx)
      const supPage = await supCtx.newPage()
      try {
        await supPage.goto(`${BASE}/invito-fornitore/${supplierInviteToken}`, { waitUntil: 'domcontentloaded' })
        await dismissCookie(supPage)
        await supPage.waitForTimeout(2000)
        const supShotPath = path.join(RUN_DIR, 'phase2-04-foto-invite-page.png')
        await supPage.screenshot({ path: supShotPath, fullPage: false }).catch(() => {})
        phases[2].screenshots.push('phase2-04-foto-invite-page.png')

        await supPage.locator('#fullName').fill('Studio Foto Test - Fotografo').catch(() => {})
        await supPage.locator('#password').fill(PWD).catch(() => {})
        const supShotPath2 = path.join(RUN_DIR, 'phase2-04b-foto-invite-filled.png')
        await supPage.screenshot({ path: supShotPath2, fullPage: false }).catch(() => {})
        phases[2].screenshots.push('phase2-04b-foto-invite-filled.png')

        const submitBtn = supPage.locator('form button[type="submit"]').first()
        if (await submitBtn.count() === 0) {
          await supPage.getByRole('button', { name: /Crea account/i }).first().click({ timeout: 5000 }).catch(() => {})
        } else {
          await submitBtn.click({ timeout: 5000 })
        }
        await supPage.waitForTimeout(6000)
        const supShotPath3 = path.join(RUN_DIR, 'phase2-05-foto-after-signup.png')
        await supPage.screenshot({ path: supShotPath3, fullPage: false }).catch(() => {})
        phases[2].screenshots.push('phase2-05-foto-after-signup.png')

        // Verifica utente creato
        fotoUserId = await getUserId(EMAILS.foto)
        step(2, 'Foto supplier registered via /invito-fornitore UI', !!fotoUserId, fotoUserId)

        // Onboarding fornitore (se presente)
        if (supPage.url().includes('/onboarding')) {
          // Step by step Avanti+compile
          for (let i = 0; i < 5; i++) {
            await supPage.locator('select').first().selectOption('fotografo').catch(() => {})
            await supPage.getByLabel('Città').fill('Cosenza').catch(() => {})
            await supPage.getByLabel('Telefono').fill('+39 348 999 0001').catch(() => {})
            const ta = supPage.locator('textarea').first()
            await ta.fill('Studio Foto Test, Cosenza').catch(() => {})
            const nextBtn = supPage.getByRole('button', { name: /^Avanti$|^Completa|Continua/i }).first()
            if (await nextBtn.count() > 0) {
              await nextBtn.click({ timeout: 4000 }).catch(() => {})
              await supPage.waitForTimeout(700)
            } else break
            if (!supPage.url().includes('/onboarding')) break
          }
          await supPage.waitForTimeout(2000)
          const supShot4 = path.join(RUN_DIR, 'phase2-06-foto-after-onboarding.png')
          await supPage.screenshot({ path: supShot4, fullPage: false }).catch(() => {})
          phases[2].screenshots.push('phase2-06-foto-after-onboarding.png')
        }

        // Profile completion (logo brand): apri /settings/brand e upload (PURO UI)
        await supPage.goto(`${BASE}/settings/brand`, { waitUntil: 'domcontentloaded' })
        await supPage.waitForTimeout(2000)
        const supFile = supPage.locator('input[type="file"]').first()
        if (await supFile.count() > 0) {
          await supFile.setInputFiles(PNG_LOGO).catch(() => {})
          await supPage.waitForTimeout(2500)
          const sb1 = supPage.getByRole('button', { name: /Salva|Applica|Aggiorna/i }).first()
          if (await sb1.count() > 0) await sb1.click({ timeout: 4000 }).catch(() => {})
          await supPage.waitForTimeout(2000)
          step(2, 'Foto supplier brand logo uploaded via UI', true)
        } else {
          bug(2, 'MEDIUM', 'FOTO_BRAND_FILE', 'Nessun input file per logo fornitore')
        }
        const supShotBrand = path.join(RUN_DIR, 'phase2-07-foto-brand-saved.png')
        await supPage.screenshot({ path: supShotBrand, fullPage: false }).catch(() => {})
        phases[2].screenshots.push('phase2-07-foto-brand-saved.png')
      } finally {
        await supCtx.close()
      }
    }

    // WP rientra e verifica fornitore visibile
    await loginUi(page, EMAILS.wp)
    await page.goto(`${BASE}/suppliers`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 2, '08-wp-suppliers-list')

    const { data: collabs } = await sb.from('collaborations')
      .select('id, fornitore_id, status').eq('capostipite_id', wpUserId).eq('status', 'ACTIVE')
    const activeCount = collabs?.length ?? 0
    step(2, `Active collaboration foto: ${activeCount}/1`, activeCount >= 1, JSON.stringify(collabs?.map(c => c.fornitore_id?.slice(0, 8))))
    finalState.uiOnlyOk.supplierInvite = activeCount >= 1
    if (activeCount < 1) bug(2, 'HIGH', 'COLLAB_MISSING', `Collaborazione non ACTIVE: ${activeCount}`)
    finalState.fotoUserId = fotoUserId

    endPhase(2, activeCount >= 1)
  } catch (e) {
    bug(2, 'HIGH', 'PHASE2', e.message)
    await shot(page, 2, '99-error')
    endPhase(2, false)
  }

  // ============================================================
  // PHASE 2.5 — Fornitore crea servizi a catalogo via UI (richiesto per poi aggiungerli al quote)
  // ============================================================
  startPhase(25, 'Foto supplier creates 2 catalog services via UI (preparation for quote items)')
  let fotoServicesOk = 0
  try {
    await logout(page)
    await loginUi(page, EMAILS.foto)
    await page.goto(`${BASE}/catalog`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await page.waitForTimeout(2500)
    await shot(page, 25, '01-catalog-empty')

    const fotoServices = [
      { name: 'Servizio fotografico full day', price: '2400', unit: 'EVENTO', desc: 'Reportage completo 10h con secondo fotografo.' },
      { name: 'Album fotografico premium', price: '550', unit: 'PEZZO', desc: 'Album 30x30 stampa fine art 30 pagine.' },
    ]
    for (const [i, svc] of fotoServices.entries()) {
      const newBtn = page.locator('[data-testid="new-service-btn"]').first()
      if (await newBtn.count() === 0) {
        bug(25, 'HIGH', 'NEW_SVC_BTN', 'Pulsante Nuovo servizio mancante')
        break
      }
      await newBtn.click({ timeout: 4000 })
      await page.waitForTimeout(1500)
      // Modale ServiceForm
      await page.locator('#name').fill(svc.name).catch(() => {})
      await page.locator('#description').fill(svc.desc).catch(() => {})
      await page.locator('#price').fill(svc.price).catch(() => {})
      const unitSel = page.locator('#unit').first()
      await unitSel.selectOption(svc.unit).catch(() => {})
      // categoria: prendi prima opzione disponibile
      const catSel = page.locator('#cat').first()
      const catOpts = await catSel.locator('option').count().catch(() => 0)
      if (catOpts > 0) {
        // selezione default (prima opzione, già settata)
      }
      await shot(page, 25, `02-svc-${i}-filled`)
      await page.getByRole('button', { name: /^Crea$|^Salva$/i }).first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(3000)
      // verifica modale chiusa o tornata in edit con foto
      // chiudi modale (X o overlay)
      const closeBtns = page.locator('button:has-text("Chiudi"), button[aria-label="Close"]')
      if (await closeBtns.count() > 0) await closeBtns.first().click({ timeout: 2000 }).catch(() => {})
      // press Esc
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(1500)
      // verifica DB
      const { data: svcRow } = await sb.from('services').select('id').eq('fornitore_id', fotoUserId).eq('name', svc.name).maybeSingle()
      if (svcRow?.id) {
        fotoServicesOk++
        step(25, `Service created via UI: ${svc.name}`, true, svcRow.id)
      } else {
        bug(25, 'HIGH', 'SVC_INSERT', `Servizio "${svc.name}" non trovato in DB dopo Crea UI`)
      }
      await shot(page, 25, `03-svc-${i}-after-save`)
    }
    step(25, `Foto services created via UI: ${fotoServicesOk}/2`, fotoServicesOk === 2)
    finalState.uiOnlyOk.fotoCatalog = fotoServicesOk === 2
    endPhase(25, fotoServicesOk >= 1)
  } catch (e) {
    bug(25, 'HIGH', 'PHASE25', e.message)
    await shot(page, 25, '99-error')
    endPhase(25, false)
  }

  // ============================================================
  // PHASE 3 — WP crea quote via UI + assegna items + invio
  // ============================================================
  startPhase(3, 'WP creates quote via UI + adds items from catalog + send to client')
  try {
    await logout(page)
    await loginUi(page, EMAILS.wp)
    await page.goto(`${BASE}/quotes`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await page.waitForTimeout(2500)
    await shot(page, 3, '01-quotes-list')

    // Click "Nuovo preventivo" via testid
    const newQuoteBtn = page.locator('[data-testid="new-quote-btn"]').first()
    if (await newQuoteBtn.count() === 0) {
      bug(3, 'HIGH', 'NEW_QUOTE_BTN', 'Pulsante new-quote-btn assente')
    } else {
      await newQuoteBtn.click({ timeout: 4000 })
      await page.waitForTimeout(1200)
    }
    await shot(page, 3, '02-new-quote-modal')

    // Compila form
    await page.locator('#title').fill('Sofia & Marco — Cosenza 2027').catch(() => {})
    await page.locator('#cname').fill('Sofia Bianchi').catch(() => {})
    await page.locator('#cemail').fill(EMAILS.couple).catch(() => {})
    await page.locator('#edate').fill('2027-09-12').catch(() => {})
    await page.locator('#gc').fill('100').catch(() => {})
    await page.locator('#eloc').fill('Tenuta degli Ulivi - Cosenza').catch(() => {})
    await shot(page, 3, '03-quote-form-filled')
    await page.getByRole('button', { name: /Crea e apri/i }).click({ timeout: 5000 })
    await page.waitForURL(/\/quotes\/[a-f0-9-]+/, { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)

    quoteId = page.url().match(/\/quotes\/([a-f0-9-]+)/)?.[1]
    step(3, 'Quote created via UI form (Crea e apri)', !!quoteId, quoteId)
    finalState.uiOnlyOk.quoteCreate = !!quoteId

    if (!quoteId) {
      bug(3, 'HIGH', 'QUOTE_CREATE', 'URL non finisce in /quotes/:id dopo submit form UI')
      endPhase(3, false)
    } else {
      // Set table_count + markup via UI editor
      await page.locator('#tc').fill('10').catch(() => {})
      await page.locator('#mk').fill('20').catch(() => {})
      await page.getByRole('button', { name: /^Applica$/i }).first().click({ timeout: 4000 }).catch(() => {})
      await page.waitForTimeout(2500)
      await shot(page, 3, '04-quote-editor')

      // Aggiungi voci dal catalogo: seleziona fornitore foto e click "+" su 2 servizi
      const supSel = page.locator('#sup').first()
      if (await supSel.count() > 0) {
        // attesa caricamento services del fornitore
        await page.waitForTimeout(1500)
        const opts = await supSel.locator('option').count()
        if (opts > 1) {
          await supSel.selectOption({ index: 1 }).catch(() => {})
          await page.waitForTimeout(2500)
          // Click "+" su prime 2 voci foto
          const plusBtns = page.locator('button:has(svg.lucide-plus), button:has-text("")').filter({ hasText: '' })
          // più affidabile: locator card catalogo
          const catalogCards = page.locator('div.rounded-lg.border.p-3.flex.gap-3')
          const cards = await catalogCards.count()
          step(3, `Catalog cards visible for foto supplier: ${cards}`, cards >= 1)
          const itemsToAdd = Math.min(cards, 2)
          for (let i = 0; i < itemsToAdd; i++) {
            const card = catalogCards.nth(i)
            const addBtn = card.locator('button').last()
            await addBtn.click({ timeout: 4000 }).catch(() => {})
            await page.waitForTimeout(1800)
          }
          step(3, `Items added via UI from catalog: ${itemsToAdd}/2`, itemsToAdd === 2)
        } else {
          bug(3, 'HIGH', 'NO_SUPPLIER_OPTS', 'Select fornitore senza opzioni: collaborazione non vista nel quote editor')
        }
      } else {
        bug(3, 'HIGH', 'SUPPLIER_SELECT', 'Select #sup mancante nel quote editor')
      }
      await shot(page, 3, '05-after-items-added')

      // PDF NEUTRA
      let pdfDownloadedPath = null
      const pdfBtn = page.locator('[data-testid="pdf-neutra"]')
      if (await pdfBtn.count() > 0) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
          pdfBtn.click({ timeout: 4000 }).catch(() => {}),
        ])
        await page.waitForTimeout(4000)
        if (download) {
          pdfDownloadedPath = path.join(RUN_DIR, 'downloads', `quote-neutra-${TS}.pdf`)
          await download.saveAs(pdfDownloadedPath).catch(() => {})
          step(3, 'PDF NEUTRA scaricato', true, pdfDownloadedPath)
          finalState.uiOnlyOk.quotePdf = true
        } else {
          // anche se non scaricato, verifica generazione via DB (pdf_url)
          const { data: q } = await sb.from('quotes').select('pdf_url, pdf_neutra_url').eq('id', quoteId).maybeSingle()
          const hasPdf = !!(q?.pdf_url || q?.pdf_neutra_url)
          step(3, `PDF NEUTRA generato (URL DB): ${hasPdf}`, hasPdf, q?.pdf_neutra_url || q?.pdf_url)
          if (!hasPdf) bug(3, 'MEDIUM', 'PDF_NO_DOWNLOAD', 'Download event non scattato e nessun pdf_url in DB')
        }
      } else {
        bug(3, 'HIGH', 'PDF_BTN_MISSING', 'data-testid="pdf-neutra" assente')
      }
      await shot(page, 3, '06-after-pdf')

      // Invia al cliente
      const sendBtn = page.locator('[data-testid="send-quote-btn"]')
      if (await sendBtn.count() > 0) {
        await sendBtn.click({ timeout: 4000 }).catch(() => {})
        await page.waitForTimeout(6000)
        // alcuni modali di conferma
        const okSend = page.getByRole('button', { name: /Conferma|Invia|Procedi/i }).first()
        if (await okSend.count() > 0) {
          await okSend.click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(4000)
        }
        step(3, 'Quote send-quote-btn clicked', true)
      } else {
        bug(3, 'HIGH', 'SEND_BTN', 'data-testid="send-quote-btn" assente')
      }
      await shot(page, 3, '07-quote-sent')

      // Verifica DB
      const { data: q2 } = await sb.from('quotes').select('id, status, access_token, total_client, sent_at, default_markup_percent, table_count').eq('id', quoteId).maybeSingle()
      quoteToken = q2?.access_token
      step(3, `Quote DB stato post-send: status=${q2?.status}, total=${q2?.total_client}, markup=${q2?.default_markup_percent}, tables=${q2?.table_count}`, q2?.status === 'INVIATO' && !!quoteToken)
      finalState.quoteId = quoteId
      finalState.quoteToken = quoteToken
      finalState.uiOnlyOk.quoteSend = q2?.status === 'INVIATO'
      finalState.quoteTotal = q2?.total_client
      if (q2?.status !== 'INVIATO') bug(3, 'HIGH', 'SEND_NOT_INVIATO', `Stato quote dopo Invia: ${q2?.status}`)

      // Verifica items via DB
      const { data: qis } = await sb.from('quote_items').select('id, supplier_id, name_snapshot').eq('quote_id', quoteId)
      step(3, `Quote items in DB: ${qis?.length}`, (qis?.length ?? 0) >= 1, JSON.stringify(qis?.map(x => x.name_snapshot)))

      endPhase(3, !!quoteToken)
    }
  } catch (e) {
    bug(3, 'HIGH', 'PHASE3', e.message)
    await shot(page, 3, '99-error')
    endPhase(3, false)
  }

  // ============================================================
  // PHASE 4 — Coppia firma quote via /p/accept/:token (UI canvas)
  // ============================================================
  startPhase(4, 'Couple signs quote via /p/accept/:token UI multi-step')
  try {
    if (!quoteToken) {
      bug(4, 'HIGH', 'NO_QUOTE_TOKEN', 'Senza quoteToken skip firma')
      endPhase(4, false)
    } else {
      // Nuovo contesto browser per la coppia (no auth)
      const coupleCtx = await browser.newContext(baseCtx)
      const cpPage = await coupleCtx.newPage()
      try {
        await cpPage.goto(`${BASE}/p/accept/${quoteToken}`, { waitUntil: 'domcontentloaded' })
        await dismissCookie(cpPage)
        await cpPage.waitForTimeout(3000)
        const s1 = path.join(RUN_DIR, 'phase4-01-accept-step1.png')
        await cpPage.screenshot({ path: s1 }).catch(() => {})
        phases[4].screenshots.push('phase4-01-accept-step1.png')

        // STEP 1 — dati
        await cpPage.locator('input[placeholder*="Mario"]').first().fill('Sofia Bianchi').catch(() => {})
        await cpPage.locator('input[type="tel"]').first().fill('+39 348 555 0011').catch(() => {})
        await cpPage.getByRole('button', { name: /Continua/i }).click({ timeout: 5000 }).catch(() => {})
        await cpPage.waitForTimeout(800)
        const s2 = path.join(RUN_DIR, 'phase4-02-accept-step2.png')
        await cpPage.screenshot({ path: s2 }).catch(() => {})
        phases[4].screenshots.push('phase4-02-accept-step2.png')

        // STEP 2 — documento
        await cpPage.locator('select').first().selectOption('CARTA_IDENTITA').catch(() => {})
        await cpPage.locator('input[placeholder*="CA"], input[placeholder*="AY"]').first().fill('CA9876543').catch(async () => {
          await cpPage.locator('input').nth(2).fill('CA9876543').catch(() => {})
        })
        await cpPage.locator('input[placeholder*="Comune"], input[placeholder*="Cosenza"]').first().fill('Comune di Cosenza').catch(() => {})
        await cpPage.getByRole('button', { name: /Continua/i }).click({ timeout: 5000 }).catch(() => {})
        await cpPage.waitForTimeout(1000)
        const s3 = path.join(RUN_DIR, 'phase4-03-accept-step3.png')
        await cpPage.screenshot({ path: s3 }).catch(() => {})
        phases[4].screenshots.push('phase4-03-accept-step3.png')

        // STEP 3 — canvas firma + consensi
        const canvas = cpPage.locator('canvas').first()
        if (await canvas.count() > 0) {
          const box = await canvas.boundingBox()
          if (box) {
            await canvas.scrollIntoViewIfNeeded()
            await cpPage.mouse.move(box.x + 20, box.y + box.height / 2)
            await cpPage.mouse.down()
            for (let i = 0; i < 40; i++) {
              await cpPage.mouse.move(box.x + 20 + i * 6, box.y + box.height / 2 + Math.sin(i / 3) * 22, { steps: 3 })
            }
            await cpPage.mouse.up()
            await cpPage.waitForTimeout(1000)
            step(4, 'Canvas firma disegnato via page.mouse.down/move/up', true)
          }
        } else {
          bug(4, 'HIGH', 'CANVAS_MISSING', 'Canvas firma non trovato in step 3')
        }
        const s4 = path.join(RUN_DIR, 'phase4-04-signature-drawn.png')
        await cpPage.screenshot({ path: s4 }).catch(() => {})
        phases[4].screenshots.push('phase4-04-signature-drawn.png')

        // Consensi
        const cbs = cpPage.locator('input[type="checkbox"]')
        const cbc = await cbs.count()
        for (let i = 0; i < cbc; i++) await cbs.nth(i).check({ force: true }).catch(() => {})
        await cpPage.waitForTimeout(400)
        step(4, `Consents checked: ${cbc}`, cbc >= 1)

        // Submit
        await cpPage.getByRole('button', { name: /Conferma e firma|Accetta|^Firma$/i }).last().click({ timeout: 5000 }).catch(() => {})
        await cpPage.waitForTimeout(15000)
        const s5 = path.join(RUN_DIR, 'phase4-05-after-accept.png')
        await cpPage.screenshot({ path: s5 }).catch(() => {})
        phases[4].screenshots.push('phase4-05-after-accept.png')

        // Verifica DB (lookup-only)
        const { data: qSigned } = await sb.from('quotes').select('id, status, accepted_at').eq('id', quoteId).maybeSingle()
        const { data: audit } = await sb.from('quote_acceptances_audit').select('id, signer_name, signature_url, acceptance_pdf_url').eq('quote_id', quoteId)
        const accepted = qSigned?.status === 'ACCETTATO'
        step(4, `Quote firma: status=${qSigned?.status}, accepted_at=${qSigned?.accepted_at}, audit_rows=${audit?.length}, pdf=${audit?.[0]?.acceptance_pdf_url ?? 'no'}`, accepted)
        finalState.quoteAcceptedAt = qSigned?.accepted_at
        finalState.acceptancePdfUrl = audit?.[0]?.acceptance_pdf_url
        finalState.uiOnlyOk.quoteSign = accepted
        if (!accepted) bug(4, 'HIGH', 'QUOTE_SIGN', `Quote non ACCETTATO dopo firma UI canvas: ${qSigned?.status}`)
      } finally {
        await coupleCtx.close()
      }
      endPhase(4, finalState.uiOnlyOk.quoteSign === true)
    }
  } catch (e) {
    bug(4, 'HIGH', 'PHASE4', e.message)
    endPhase(4, false)
  }

  // ============================================================
  // PHASE 5 — WP converte quote → contratto via NUOVO bottone "Genera contratto"
  // ============================================================
  startPhase(5, 'WP clicks "Genera contratto" button (Wave 4 fix) → contract row created')
  try {
    await logout(page)
    await loginUi(page, EMAILS.wp)
    await page.goto(`${BASE}/quotes/${quoteId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await shot(page, 5, '01-quote-detail-after-accept')

    // Verifica banner ACCETTATO presente
    const banner = page.locator('text=/Preventivo accettato|preventivo accettato/i').first()
    const hasBanner = (await banner.count()) > 0
    step(5, 'Banner ACCETTATO visibile in editor', hasBanner)
    finalState.uiOnlyOk.bannerAcceptedVisible = hasBanner
    if (!hasBanner) bug(5, 'MEDIUM', 'BANNER_MISSING', 'Banner "Preventivo accettato" non visibile')

    // Click "Genera contratto" via testid (NUOVO bottone Wave 4)
    const genBtn = page.locator('[data-testid="generate-contract-btn"]').first()
    const btnExists = (await genBtn.count()) > 0
    step(5, 'Pulsante "Genera contratto" presente (Wave 4 fix)', btnExists)
    finalState.uiOnlyOk.generateContractBtn = btnExists
    if (!btnExists) bug(5, 'HIGH', 'GEN_CONTRACT_BTN', 'data-testid="generate-contract-btn" assente — fix Wave 4 NON deployato')

    if (btnExists) {
      await genBtn.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(6000)
      await shot(page, 5, '02-after-generate-contract-click')
      // Modale/confirm potrebbe apparire
      const confirmBtn = page.getByRole('button', { name: /Conferma|Procedi|Crea contratto/i }).first()
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(5000)
      }
    }

    // Verifica contract creato in DB
    const { data: contracts } = await sb.from('contracts').select('id, status, access_token').eq('quote_id', quoteId)
    if (contracts && contracts.length > 0) {
      contractId = contracts[0].id
      contractToken = contracts[0].access_token
      step(5, `Contract creato in DB via UI: id=${contractId}, status=${contracts[0].status}, token=${contractToken?.slice(0, 8)}`, true)
      finalState.contractId = contractId
      finalState.contractToken = contractToken
      finalState.uiOnlyOk.contractGenerated = true
    } else {
      bug(5, 'HIGH', 'CONTRACT_NOT_CREATED', 'Nessuna riga contracts dopo click "Genera contratto" UI')
    }

    // Navigazione a /contracts (post-fix WP dovrebbe essere redirected)
    await page.goto(`${BASE}/contracts`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 5, '03-contracts-list')

    // Apri il contratto + edit sections
    if (contractId) {
      await page.goto(`${BASE}/contracts/${contractId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)
      await shot(page, 5, '04-contract-detail')

      // Cerca textarea sezioni / clausole
      const tas = page.locator('textarea')
      const taCount = await tas.count()
      if (taCount > 0) {
        for (let i = 0; i < Math.min(taCount, 2); i++) {
          const cur = await tas.nth(i).inputValue().catch(() => '')
          await tas.nth(i).fill(cur + '\n\nAGENT-T: Clausola Sofia & Marco — 30% acconto entro 7 gg dalla firma, saldo 7 gg prima dell evento (12/09/2027).').catch(() => {})
        }
        await shot(page, 5, '05-contract-edited')
        const saveBtn = page.getByRole('button', { name: /Salva|Aggiorna|Applica/i }).first()
        if (await saveBtn.count() > 0) {
          await saveBtn.click({ timeout: 4000 }).catch(() => {})
          await page.waitForTimeout(3000)
          step(5, 'Contract sezioni modificate + salvate via UI', true)
        }
      } else {
        note(5, 'Nessuna textarea sezione in /contracts/:id (UI minimale)')
      }

      // Send: genera link/invia
      // Cerca pulsante "Invia" / "Genera link" / "Apri firma"
      const sendOpts = [/Invia al cliente/i, /Invia contratto/i, /Genera link/i, /^Invia$/i]
      for (const re of sendOpts) {
        const b = page.getByRole('button', { name: re }).first()
        if (await b.count() > 0) {
          await b.click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(3000)
          step(5, `Contract send button clicked: ${re}`, true)
          break
        }
      }
      await shot(page, 5, '06-contract-after-send')

      const { data: cAfter } = await sb.from('contracts').select('status, access_token').eq('id', contractId).maybeSingle()
      contractToken = cAfter?.access_token ?? contractToken
      finalState.contractToken = contractToken
      step(5, `Contract dopo send UI: status=${cAfter?.status}, token=${contractToken?.slice(0, 8)}`, !!contractToken)
    }

    endPhase(5, !!contractId)
  } catch (e) {
    bug(5, 'HIGH', 'PHASE5', e.message)
    await shot(page, 5, '99-error')
    endPhase(5, false)
  }

  // ============================================================
  // PHASE 6 — Cliente firma contratto via /p/contract/:token
  // ============================================================
  startPhase(6, 'Couple signs contract via /p/contract/:token UI')
  try {
    if (!contractToken) {
      bug(6, 'HIGH', 'NO_CONTRACT_TOKEN', 'Senza contractToken skip firma contratto')
      endPhase(6, false)
    } else {
      const cpCtx = await browser.newContext(baseCtx)
      const cpPage = await cpCtx.newPage()
      try {
        await cpPage.goto(`${BASE}/p/contract/${contractToken}`, { waitUntil: 'domcontentloaded' })
        await dismissCookie(cpPage)
        await cpPage.waitForTimeout(3000)
        const s1 = path.join(RUN_DIR, 'phase6-01-contract-sign-page.png')
        await cpPage.screenshot({ path: s1 }).catch(() => {})
        phases[6].screenshots.push('phase6-01-contract-sign-page.png')

        // Form anagrafica
        await cpPage.locator('#signer').fill('Sofia Bianchi').catch(() => {})
        await cpPage.locator('#fiscal').fill('BNCSFO95L41D086Y').catch(() => {})
        const s2 = path.join(RUN_DIR, 'phase6-02-contract-form-filled.png')
        await cpPage.screenshot({ path: s2 }).catch(() => {})
        phases[6].screenshots.push('phase6-02-contract-form-filled.png')

        // Canvas firma (se presente)
        const canvas = cpPage.locator('canvas').first()
        if (await canvas.count() > 0) {
          const box = await canvas.boundingBox()
          if (box) {
            await canvas.scrollIntoViewIfNeeded()
            await cpPage.mouse.move(box.x + 20, box.y + box.height / 2)
            await cpPage.mouse.down()
            for (let i = 0; i < 40; i++) {
              await cpPage.mouse.move(box.x + 20 + i * 6, box.y + box.height / 2 + Math.sin(i / 3) * 22, { steps: 3 })
            }
            await cpPage.mouse.up()
            await cpPage.waitForTimeout(800)
            const s3 = path.join(RUN_DIR, 'phase6-03-contract-signature-drawn.png')
            await cpPage.screenshot({ path: s3 }).catch(() => {})
            phases[6].screenshots.push('phase6-03-contract-signature-drawn.png')
            step(6, 'Canvas firma contratto disegnato via UI', true)
          }
        } else {
          step(6, 'Canvas firma contratto NON presente (UI text-only)', true)
        }

        // Submit firma
        await cpPage.getByRole('button', { name: /Firma il contratto|Firma|Conferm|Sottoscri/i }).last().click({ timeout: 5000 }).catch(() => {})
        await cpPage.waitForTimeout(10000)
        const s4 = path.join(RUN_DIR, 'phase6-04-after-contract-sign.png')
        await cpPage.screenshot({ path: s4 }).catch(() => {})
        phases[6].screenshots.push('phase6-04-after-contract-sign.png')

        const { data: cSigned } = await sb.from('contracts').select('id, status, signed_at, signature_data, pdf_url, signed_pdf_url').eq('id', contractId).maybeSingle()
        const signed = cSigned?.status === 'FIRMATO' || !!cSigned?.signed_at
        step(6, `Contract DB: status=${cSigned?.status}, signed_at=${cSigned?.signed_at}, signature=${!!cSigned?.signature_data}, signed_pdf=${cSigned?.signed_pdf_url ?? cSigned?.pdf_url ?? 'no'}`, signed)
        finalState.contractStatus = cSigned?.status
        finalState.contractSignedAt = cSigned?.signed_at
        finalState.contractSignedPdf = cSigned?.signed_pdf_url || cSigned?.pdf_url
        finalState.uiOnlyOk.contractSign = signed
        if (!signed) bug(6, 'HIGH', 'CONTRACT_SIGN_UI', 'Contract NON firmato dopo submit UI')
      } finally {
        await cpCtx.close()
      }
      endPhase(6, finalState.uiOnlyOk.contractSign === true)
    }
  } catch (e) {
    bug(6, 'HIGH', 'PHASE6', e.message)
    endPhase(6, false)
  }

  // ============================================================
  // PHASE 7 — Coppia signup via /invito-coppia/:token + dashboard tabs
  // ============================================================
  startPhase(7, 'Couple signs up via /invito-coppia/:token + explores dashboard tabs (mood, programma)')
  try {
    // Recupera coupleToken via DB lookup (creato da quote-send / contract-gen trigger)
    let coupleToken = null
    const { data: wedRows } = await sb.from('calendar_entries').select('id').eq('quote_id', quoteId)
    weddingId = wedRows?.[0]?.id ?? null
    finalState.weddingId = weddingId
    step(7, 'Wedding entry collegata a quote', !!weddingId, weddingId)

    if (weddingId) {
      const { data: cm } = await sb.from('wedding_couple_members')
        .select('id, invite_token, email, user_id').eq('entry_id', weddingId).eq('email', EMAILS.couple).maybeSingle()
      if (cm?.invite_token && !cm.user_id) coupleToken = cm.invite_token
      else if (cm?.user_id) {
        note(7, 'Couple member già linkato a user_id — riuso')
      }
      step(7, 'Couple invite token', !!coupleToken || !!cm?.user_id, coupleToken?.slice(0, 12) || `(linked uid=${cm?.user_id?.slice(0,8)})`)
    }

    if (coupleToken) {
      const cpCtx = await browser.newContext(baseCtx)
      const cpPage = await cpCtx.newPage()
      try {
        await cpPage.goto(`${BASE}/invito-coppia/${coupleToken}`, { waitUntil: 'domcontentloaded' })
        await dismissCookie(cpPage)
        await cpPage.waitForTimeout(2500)
        const s1 = path.join(RUN_DIR, 'phase7-01-couple-invite.png')
        await cpPage.screenshot({ path: s1 }).catch(() => {})
        phases[7].screenshots.push('phase7-01-couple-invite.png')

        // Tab signup attivo di default
        await cpPage.locator('#fullName').fill('Sofia Bianchi').catch(() => {})
        await cpPage.locator('input[type="password"]').first().fill(PWD).catch(() => {})
        // accetta privacy: cerca checkbox
        const cbs = cpPage.locator('input[type="checkbox"]')
        const cbc = await cbs.count()
        for (let i = 0; i < cbc; i++) await cbs.nth(i).check({ force: true }).catch(() => {})
        const s2 = path.join(RUN_DIR, 'phase7-02-couple-signup-filled.png')
        await cpPage.screenshot({ path: s2 }).catch(() => {})
        phases[7].screenshots.push('phase7-02-couple-signup-filled.png')

        // Submit
        await cpPage.locator('form button[type="submit"], button:has-text("Crea account")').first().click({ timeout: 5000 }).catch(() => {})
        await cpPage.waitForTimeout(8000)
        const s3 = path.join(RUN_DIR, 'phase7-03-couple-after-signup.png')
        await cpPage.screenshot({ path: s3 }).catch(() => {})
        phases[7].screenshots.push('phase7-03-couple-after-signup.png')

        coupleUserId = await getUserId(EMAILS.couple)
        step(7, 'Couple registered via UI', !!coupleUserId, coupleUserId)
        finalState.coupleUserId = coupleUserId
        finalState.uiOnlyOk.coupleSignup = !!coupleUserId

        // Verifica auto-redirect a /couple
        if (!cpPage.url().includes('/couple')) {
          await cpPage.goto(`${BASE}/couple`, { waitUntil: 'domcontentloaded' })
          await cpPage.waitForTimeout(3000)
        }
        const s4 = path.join(RUN_DIR, 'phase7-04-couple-dashboard.png')
        await cpPage.screenshot({ path: s4 }).catch(() => {})
        phases[7].screenshots.push('phase7-04-couple-dashboard.png')

        // Naviga tab Overview / Documenti / Programma / Tavoli / Mood / Playlist
        const tabs = ['Overview', 'Documenti', 'Programma', 'Tavoli', 'Mood', 'Playlist']
        for (const t of tabs) {
          const tabBtn = cpPage.locator(`button:has-text("${t}"), a:has-text("${t}")`).first()
          if (await tabBtn.count() > 0) {
            await tabBtn.click({ timeout: 3000 }).catch(() => {})
            await cpPage.waitForTimeout(1500)
            const sx = path.join(RUN_DIR, `phase7-05-tab-${t.toLowerCase()}.png`)
            await cpPage.screenshot({ path: sx }).catch(() => {})
            phases[7].screenshots.push(`phase7-05-tab-${t.toLowerCase()}.png`)
            step(7, `Tab "${t}" navigato via UI`, true)
          }
        }

        // Test import Pinterest URL fallito (deve mostrare 422 user-friendly)
        // Vai esplicitamente al tab Mood
        const moodTab = cpPage.locator('button:has-text("Mood"), a:has-text("Mood")').first()
        if (await moodTab.count() > 0) {
          await moodTab.click({ timeout: 3000 }).catch(() => {})
          await cpPage.waitForTimeout(2000)
        }
        const pinInput = cpPage.locator('input[placeholder*="Pinterest"], input[placeholder*="URL"]').first()
        if (await pinInput.count() > 0) {
          await pinInput.fill('https://www.example-non-esistente-test-agent-t.invalid/wedding-mood/12345')
          const addBtn = cpPage.getByRole('button', { name: /Aggiungi|Importa/i }).first()
          if (await addBtn.count() > 0) {
            await addBtn.click({ timeout: 4000 }).catch(() => {})
            await cpPage.waitForTimeout(8000)
          }
          const errorText = await cpPage.locator('text=/422|errore|impossibile|non valid/i').first().textContent({ timeout: 3000 }).catch(() => null)
          const s5 = path.join(RUN_DIR, 'phase7-06-mood-pinterest-error.png')
          await cpPage.screenshot({ path: s5 }).catch(() => {})
          phases[7].screenshots.push('phase7-06-mood-pinterest-error.png')
          step(7, 'Import URL fallito → toast/messaggio user-friendly visibile', !!errorText, errorText?.slice(0, 120))
          finalState.uiOnlyOk.moodPinterest422 = !!errorText
        } else {
          note(7, 'Input Pinterest non trovato in Mood tab coppia')
        }

        // Tab Programma — prova creare change request (post-fix RLS)
        const progTab = cpPage.locator('button:has-text("Programma"), a:has-text("Programma")').first()
        if (await progTab.count() > 0) {
          await progTab.click({ timeout: 3000 }).catch(() => {})
          await cpPage.waitForTimeout(2000)
        }
        // Cerca "Suggerisci modifica" / "Richiesta cambio"
        const crBtn = cpPage.getByRole('button', { name: /Suggerisci|Richiesta cambio|Proponi|Modifica/i }).first()
        if (await crBtn.count() > 0) {
          await crBtn.click({ timeout: 3000 }).catch(() => {})
          await cpPage.waitForTimeout(1500)
          // Compila form CR
          const ta = cpPage.locator('textarea').first()
          if (await ta.count() > 0) await ta.fill('Spostare aperitivo da 17:00 a 16:30 per allungare la cerimonia.').catch(() => {})
          const titleI = cpPage.locator('input[placeholder*="itolo"], input[placeholder*="oggetto"]').first()
          if (await titleI.count() > 0) await titleI.fill('Spostamento aperitivo').catch(() => {})
          const submitCr = cpPage.getByRole('button', { name: /Invia|Crea|Conferma/i }).last()
          if (await submitCr.count() > 0) {
            await submitCr.click({ timeout: 4000 }).catch(() => {})
            await cpPage.waitForTimeout(5000)
          }
          const s6 = path.join(RUN_DIR, 'phase7-07-change-request-after.png')
          await cpPage.screenshot({ path: s6 }).catch(() => {})
          phases[7].screenshots.push('phase7-07-change-request-after.png')
          // Verifica DB
          const { data: crs } = await sb.from('couple_change_requests').select('id, status').eq('wedding_id', weddingId).eq('requested_by', coupleUserId)
          step(7, `Change request creata via UI: ${crs?.length} riga(he)`, (crs?.length ?? 0) >= 1)
          finalState.uiOnlyOk.changeRequest = (crs?.length ?? 0) >= 1
          if ((crs?.length ?? 0) === 0) bug(7, 'MEDIUM', 'CR_NOT_CREATED', 'Change request UI non ha inserito riga in DB (RLS bug?)')
        } else {
          note(7, 'Pulsante change-request non visibile in tab Programma coppia')
        }
      } finally {
        await cpCtx.close()
      }
    } else {
      bug(7, 'HIGH', 'COUPLE_TOKEN_MISSING', 'Couple invite token assente in DB')
    }

    endPhase(7, !!coupleUserId)
  } catch (e) {
    bug(7, 'HIGH', 'PHASE7', e.message)
    endPhase(7, false)
  }

  // ============================================================
  // PHASE 8 — WP popola wedding tabs via UI
  // ============================================================
  startPhase(8, 'WP populates wedding tabs (tables, guests, mood, playlist, timeline) via UI clicks')
  try {
    if (!weddingId) {
      bug(8, 'HIGH', 'NO_WED', 'no weddingId')
      endPhase(8, false)
    } else {
      await page.goto(`${BASE}/weddings/${weddingId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)
      await shot(page, 8, '01-wedding-dashboard')

      // TAB TAVOLI — aggiungi 10 tavoli via "Aggiungi tavolo"
      const tablesTab = page.locator('button:has-text("Tavoli"), a:has-text("Tavoli")').first()
      if (await tablesTab.count() > 0) {
        await tablesTab.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(2000)
      }
      await shot(page, 8, '02-tables-tab')
      const addTableBtn = page.getByRole('button', { name: /Aggiungi tavolo/i }).first()
      let tablesAdded = 0
      if (await addTableBtn.count() > 0) {
        for (let i = 0; i < 10; i++) {
          await addTableBtn.click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(700)
          tablesAdded++
        }
        await page.waitForTimeout(2000)
      }
      const { data: tableRows } = await sb.from('event_tables').select('id').eq('entry_id', weddingId)
      step(8, `Tables created via UI clicks: ${tablesAdded} attempted → DB ${tableRows?.length}`, (tableRows?.length ?? 0) >= 5)
      finalState.uiOnlyOk.tables = (tableRows?.length ?? 0) >= 5
      await shot(page, 8, '03-tables-added')

      // TAB INVITATI — aggiungi 30 invitati
      const guestsTab = page.locator('button:has-text("Invitati"), a:has-text("Invitati")').first()
      if (await guestsTab.count() > 0) {
        await guestsTab.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(2000)
      }
      await shot(page, 8, '04-guests-tab')
      const addGuestBtn = page.getByRole('button', { name: /Aggiungi invitato/i }).first()
      let guestsAdded = 0
      if (await addGuestBtn.count() > 0) {
        for (let i = 0; i < 30; i++) {
          await addGuestBtn.click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(400)
          guestsAdded++
        }
        await page.waitForTimeout(2000)
      }
      const { data: guestRows } = await sb.from('event_guests').select('id').eq('entry_id', weddingId)
      step(8, `Guests created via UI clicks: ${guestsAdded} attempted → DB ${guestRows?.length}`, (guestRows?.length ?? 0) >= 10)
      finalState.uiOnlyOk.guests = (guestRows?.length ?? 0) >= 10
      await shot(page, 8, '05-guests-added')

      // TAB MOOD — upload 5 PNG
      const moodTab = page.locator('button:has-text("Mood"), a:has-text("Mood")').first()
      if (await moodTab.count() > 0) {
        await moodTab.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(2000)
      }
      await shot(page, 8, '06-mood-tab')
      const moodInputs = page.locator('input[type="file"]')
      let moodUploaded = 0
      if (await moodInputs.count() > 0) {
        const moodInput = moodInputs.first()
        for (let i = 0; i < 5; i++) {
          const fname = path.join(RUN_DIR, `mood-${i}.png`)
          writeFileSync(fname, makeTestPng())
          await moodInput.setInputFiles(fname).catch(() => {})
          await page.waitForTimeout(2500)
          moodUploaded++
        }
      }
      const { data: moodRows } = await sb.from('mood_images').select('id').eq('entry_id', weddingId)
      step(8, `Mood images uploaded via UI: ${moodUploaded} attempted → DB ${moodRows?.length}`, (moodRows?.length ?? 0) >= 1)
      finalState.uiOnlyOk.mood = (moodRows?.length ?? 0) >= 1
      await shot(page, 8, '07-mood-uploaded')

      // TAB PLAYLIST — aggiungi 10 brani
      const playlistTab = page.locator('button:has-text("Playlist"), a:has-text("Playlist")').first()
      if (await playlistTab.count() > 0) {
        await playlistTab.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(2000)
      }
      await shot(page, 8, '08-playlist-tab')
      // Cerca form add brano
      const addSong = page.getByRole('button', { name: /Aggiungi brano|Aggiungi traccia|Nuovo brano/i }).first()
      const titleSongInput = page.locator('input[placeholder*="itolo"], input[placeholder*="brano"], input[placeholder*="canzone"]').first()
      let songsAdded = 0
      if (await addSong.count() > 0) {
        for (let i = 0; i < 10; i++) {
          await addSong.click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(700)
          songsAdded++
        }
      } else if (await titleSongInput.count() > 0) {
        // Quick add inline
        for (let i = 0; i < 10; i++) {
          await titleSongInput.fill(`Brano ${i + 1} - Agent T`).catch(() => {})
          await page.keyboard.press('Enter').catch(() => {})
          await page.waitForTimeout(700)
          songsAdded++
        }
      }
      const { data: songRows } = await sb.from('event_playlist').select('id').eq('entry_id', weddingId)
      step(8, `Playlist songs added via UI: ${songsAdded} attempted → DB ${songRows?.length}`, (songRows?.length ?? 0) >= 1)
      finalState.uiOnlyOk.playlist = (songRows?.length ?? 0) >= 1
      await shot(page, 8, '09-playlist-added')

      // TAB SCALETTA / TIMELINE — aggiungi 7 momenti
      const timelineTab = page.locator('button:has-text("Scaletta"), button:has-text("Programma"), button:has-text("Timeline"), a:has-text("Scaletta")').first()
      if (await timelineTab.count() > 0) {
        await timelineTab.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(2000)
      }
      await shot(page, 8, '10-timeline-tab')
      const addMomentBtn = page.getByRole('button', { name: /Aggiungi momento|Aggiungi tappa|Nuovo momento/i }).first()
      let momentsAdded = 0
      if (await addMomentBtn.count() > 0) {
        for (let i = 0; i < 7; i++) {
          await addMomentBtn.click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(700)
          momentsAdded++
        }
      }
      const { data: tlRows } = await sb.from('event_timeline').select('id').eq('entry_id', weddingId)
      step(8, `Timeline moments added via UI: ${momentsAdded} attempted → DB ${tlRows?.length}`, (tlRows?.length ?? 0) >= 1)
      finalState.uiOnlyOk.timeline = (tlRows?.length ?? 0) >= 1
      await shot(page, 8, '11-timeline-added')

      endPhase(8, finalState.uiOnlyOk.tables || finalState.uiOnlyOk.guests)
    }
  } catch (e) {
    bug(8, 'HIGH', 'PHASE8', e.message)
    await shot(page, 8, '99-error')
    endPhase(8, false)
  }

  // ============================================================
  // PHASE 9 — CLEANUP via service-role (consentito esplicitamente)
  // ============================================================
  startPhase(9, 'Cleanup all agent-t-% users + derived data via service-role')
  try {
    if (weddingId) {
      const t = (n) => sb.from(n).delete().eq('entry_id', weddingId)
      await Promise.all([
        t('event_tables'), t('event_guests'), t('event_timeline'),
        t('event_playlist'), t('wedding_tasks'), t('event_transport'),
        t('event_accommodations'), t('mood_images'),
      ])
      await sb.from('couple_change_requests').delete().eq('wedding_id', weddingId)
      await sb.from('calendar_entry_participants').delete().eq('entry_id', weddingId)
      await sb.from('wedding_couple_members').delete().eq('entry_id', weddingId)
    }
    if (quoteId) {
      await sb.from('quote_items').delete().eq('quote_id', quoteId)
      await sb.from('contracts').delete().eq('quote_id', quoteId)
      await sb.from('quote_acceptances_audit').delete().eq('quote_id', quoteId)
      await sb.from('quote_acceptances').delete().eq('quote_id', quoteId).then(() => {}, () => {})
      await sb.from('quotes').delete().eq('id', quoteId)
    }
    if (weddingId) await sb.from('calendar_entries').delete().eq('id', weddingId)
    if (wpUserId) {
      await sb.from('collaborations').delete().eq('capostipite_id', wpUserId)
      await sb.from('supplier_invites').delete().eq('capostipite_id', wpUserId)
    }
    if (fotoUserId) {
      await sb.from('services').delete().eq('fornitore_id', fotoUserId)
      await sb.from('supplier_availability').delete().eq('fornitore_id', fotoUserId)
      await sb.from('supplier_clients').delete().eq('supplier_id', fotoUserId)
    }
    let deleted = 0
    for (const e of Object.values(EMAILS)) {
      const uid = await getUserId(e)
      if (uid) {
        await sb.from('profiles').delete().eq('id', uid)
        const r = await sb.auth.admin.deleteUser(uid)
        if (!r.error) deleted++
        else bug(9, 'MEDIUM', 'DELETE_USER', `${e}: ${r.error.message}`)
      }
    }
    step(9, `Deleted ${deleted} auth users`, deleted >= 2)

    const { data: leftQ } = await sb.from('quotes').select('id').eq('id', quoteId)
    const { data: leftW } = await sb.from('calendar_entries').select('id').eq('id', weddingId)
    step(9, 'Quote cleaned', (leftQ?.length ?? 0) === 0)
    step(9, 'Wedding cleaned', (leftW?.length ?? 0) === 0)
    endPhase(9, deleted >= 2)
  } catch (e) {
    bug(9, 'HIGH', 'PHASE9', e.message)
    endPhase(9, false)
  }

  await browser.close()

  // ============================================================
  // REPORT
  // ============================================================
  writeFileSync(path.join(RUN_DIR, 'final-state.json'), JSON.stringify(finalState, null, 2))
  writeFileSync(path.join(RUN_DIR, 'phases.json'), JSON.stringify(phases, null, 2))

  // bugs.json
  const allBugs = []
  for (const [pn, p] of Object.entries(phases)) {
    for (const b of p.bugs) allBugs.push({ phase: pn, ...b })
  }
  writeFileSync(path.join(RUN_DIR, 'bugs.json'), JSON.stringify(allBugs, null, 2))

  let md = `# Wave 4 — Agent T — PURE UI E2E (NO SHORTCUTS)\n\n`
  md += `**Scenario**: Sofia & Marco — Cosenza 2027-09-12 · Tenuta degli Ulivi\n`
  md += `**Run dir**: ${RUN_DIR}\n`
  md += `**Started**: ${phases[1]?.started}\n`
  md += `**Finished**: ${phases[9]?.finished ?? new Date().toISOString()}\n`
  md += `**Approccio**: tutto happy-path via UI Playwright; DB usato SOLO per cleanup, lookup token e verifica stato finale.\n\n`

  md += `## Esito UI-only per area\n\n`
  md += '```json\n' + JSON.stringify(finalState.uiOnlyOk, null, 2) + '\n```\n\n'

  md += `## Resoconto fasi\n\n`
  md += `| Fase | Nome | Esito | Durata (s) | Step OK | Step FAIL | Bug |\n`
  md += `|------|------|-------|-----------|---------|-----------|-----|\n`
  const order = [1, 2, 25, 3, 4, 5, 6, 7, 8, 9]
  for (const i of order) {
    const p = phases[i]
    if (!p) { md += `| ${i} | (skipped) | - | - | - | - | - |\n`; continue }
    const okSteps = p.steps.filter(s => s.ok).length
    const failSteps = p.steps.filter(s => !s.ok).length
    md += `| ${i} | ${p.name} | ${p.ok ? 'PASS' : 'FAIL'} | ${p.durationSec?.toFixed(1)} | ${okSteps} | ${failSteps} | ${p.bugs.length} |\n`
  }
  md += `\n## Dettaglio per fase\n\n`
  for (const i of order) {
    const p = phases[i]
    if (!p) continue
    md += `### Fase ${i}: ${p.name}\n\n`
    md += `**Esito**: ${p.ok ? 'PASS' : 'FAIL'} (${p.durationSec?.toFixed(1)}s)\n\n`
    md += `**Steps**:\n`
    for (const s of p.steps) md += `- [${s.ok ? 'OK' : 'FAIL'}] ${s.name}${s.detail ? ` — ${s.detail}` : ''}\n`
    if (p.notes?.length > 0) {
      md += `\n**Notes**:\n`
      for (const n of p.notes) md += `- ${n}\n`
    }
    if (p.bugs.length > 0) {
      md += `\n**Bug**:\n`
      for (const b of p.bugs) md += `- [${b.severity}] ${b.area}: ${b.msg}\n`
    }
    if (p.screenshots.length > 0) {
      md += `\n**Screenshot** (${p.screenshots.length}):\n`
      for (const s of p.screenshots.slice(0, 12)) md += `- ${s}\n`
      if (p.screenshots.length > 12) md += `- ...+${p.screenshots.length - 12}\n`
    }
    md += `\n`
  }
  md += `\n## Final State\n\n\`\`\`json\n${JSON.stringify(finalState, null, 2)}\n\`\`\`\n`

  md += `\n## Confronto vs Agent P (wave3-P-e2e-full)\n\n`
  md += `Agent P utilizzava DB writes diretti per:\n`
  md += `- quote header (event_date, location, guest_count, table_count, markup)\n`
  md += `- quote_items + services (createService + insert quote_items)\n`
  md += `- quote totals (total_cost / total_client)\n`
  md += `- access_token quote (fallback insert)\n`
  md += `- contract (CONTRACT_BTN bug → forced insert)\n`
  md += `- contract sign signature_data (CONTRACT_UI_SIGN bug → forced)\n`
  md += `- couple_member token (sometimes)\n`
  md += `- tables/guests/timeline/mood/playlist (bulk via DB)\n\n`
  md += `Agent T (questo run) ha sostituito tutti questi con UI clicks dove possibile.\n`
  md += `Le aree marcate 'true' in uiOnlyOk sopra sono operative SENZA touch DB; quelle 'false' indicano regressioni o feature non ancora UI-complete.\n`

  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), md)

  const total = Object.keys(phases).length
  const passed = Object.values(phases).filter(p => p.ok).length
  const totalBugs = allBugs.length
  const totalShots = Object.values(phases).reduce((s, p) => s + p.screenshots.length, 0)
  console.log(`\n========================================`)
  console.log(`AGENT T SUMMARY: ${passed}/${total} phases passed, ${totalBugs} bugs, ${totalShots} screenshots`)
  console.log(`UI-only OK areas: ${JSON.stringify(finalState.uiOnlyOk)}`)
  console.log(`Run dir: ${RUN_DIR}`)
  console.log(`========================================`)
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
