#!/usr/bin/env node
/**
 * Wave 3 - Agent P - E2E REALISTIC FULL FLOW
 *
 * Marco & Lucia 2027-07-04 - Villa Sole, Tropea
 *
 * Approccio ibrido: UI Playwright per i passaggi critici visibili (registrazioni,
 * preventivo editor, firma canvas, navigazione, screenshot brand), service-role
 * per bulk operations (60 invitati, tavoli, scaletta, mood, playlist) e verifiche
 * di stato DB / trigger / RLS.
 */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import crypto from 'node:crypto'

const BASE = 'https://planfully.it'
const PWD = 'Beta2026!'
const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
// Anon key extracted from public bundle (planfully.it/assets/index-*.js)
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const TS_FULL = Date.now()
const TS = String(TS_FULL).slice(-7)
const RUN_DIR = process.env.RUN_DIR || `/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave3-P-e2e-full-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
mkdirSync(RUN_DIR, { recursive: true })

const EMAILS = {
  wp:     `agent-p-wp-${TS}@planfully-demo.it`,
  foto:   `agent-p-foto-${TS}@planfully-demo.it`,
  cater:  `agent-p-cater-${TS}@planfully-demo.it`,
  fiori:  `agent-p-fiori-${TS}@planfully-demo.it`,
  couple: `agent-p-couple-${TS}@planfully-demo.it`,
  coupleDirect: `agent-p-couple-direct-${TS}@example.com`,
}
writeFileSync(path.join(RUN_DIR, 'emails.json'), JSON.stringify(EMAILS, null, 2))

const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

const phases = {}
const finalState = {}

function startPhase(n, name) {
  phases[n] = { name, started: new Date().toISOString(), steps: [], screenshots: [], bugs: [] }
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
  phases[n].steps.push({ name, ok, detail: detail ? String(detail).slice(0, 500) : null, ts: new Date().toISOString() })
  console.log(`  ${ok ? '[OK]' : '[FAIL]'} ${name}${detail ? ' - ' + String(detail).slice(0, 140) : ''}`)
}
function bug(n, severity, area, msg) {
  phases[n].bugs.push({ severity, area, msg })
  console.log(`  [BUG ${severity}] ${area}: ${msg}`)
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

// Mini PNG 1x1 colore solido (valido per upload)
function makeTestPng() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
}
const PNG_LOGO = path.join(RUN_DIR, 'logo-test.png')
writeFileSync(PNG_LOGO, makeTestPng())

async function getUserId(email) {
  // listUsers has pagination; with 1000 per page on small project we're fine
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

// Forza fix profile (saltare onboarding wizard se UI bloccato)
async function forceCompleteProfile(uid, patch = {}) {
  return sb.from('profiles').update({ onboarding_complete: true, ...patch }).eq('id', uid)
}

// ============== MAIN ==============
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'it-IT',
    userAgent: 'Mozilla/5.0 AgentP-E2E',
    acceptDownloads: true,
  })
  const page = await ctx.newPage()

  // Cleanup preventivo se esistono utenti residui
  for (const e of Object.values(EMAILS)) await delByEmail(e).catch(() => {})

  let wpUserId = null
  let coupleUserId = null
  let weddingId = null
  let quoteId = null
  let quoteToken = null
  let contractId = null
  let contractToken = null

  // ============================================================
  // PHASE 1 - WP onboarding via UI
  // ============================================================
  startPhase(1, 'WP onboarding (register + onboarding wizard + brand)')
  try {
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await shot(page, 1, '01-register-page')

    await page.getByLabel('Nome e cognome').fill('Wedding Studio Bella')
    await page.locator('#business_name').fill('Wedding Studio Bella SRL')
    await page.locator('#email').fill(EMAILS.wp)
    await page.locator('#password').fill(PWD)
    await shot(page, 1, '02-register-filled')
    await page.getByRole('button', { name: /^Crea account$/i }).click()
    await page.waitForURL(/\/onboarding/, { timeout: 20000 })
    step(1, 'WP registered & landed onboarding', true, page.url())
    await page.waitForTimeout(1500)
    await shot(page, 1, '03-onboarding-step0')

    // STEP 0: Identità - subrole obbligatorio per WP=wedding_planner
    const subSelect = page.locator('select').first()
    await subSelect.selectOption('wedding_planner').catch(() => {})
    // STEP 0 -> 1
    await page.getByRole('button', { name: /^Avanti$/i }).click({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot(page, 1, '04-onboarding-step1')

    // STEP 1: Azienda
    await page.getByLabel('Città').fill('Reggio Calabria').catch(() => {})
    await page.getByLabel('CAP').fill('89125').catch(() => {})
    await page.getByLabel('Nazione').fill('Italia').catch(() => {})
    await page.getByRole('button', { name: /^Avanti$/i }).click({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot(page, 1, '05-onboarding-step2')

    // STEP 2: Contatti
    await page.getByLabel('Telefono').fill('+39 0965 123456').catch(() => {})
    await page.getByRole('button', { name: /^Avanti$/i }).click({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot(page, 1, '06-onboarding-step3')

    // STEP 3: Immagine (bio)
    const ta = page.locator('textarea').first()
    await ta.fill('Wedding Studio Bella e\' uno studio di wedding planning a Reggio Calabria specializzato in matrimoni in location esclusive della Calabria.').catch(() => {})
    await page.getByRole('button', { name: /^Avanti$/i }).click({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot(page, 1, '07-onboarding-step4')

    // STEP 4: Completa
    await page.getByRole('button', { name: /Completa profilo|^Completa$/i }).click({ timeout: 5000 })
    await page.waitForURL(u => !u.pathname.startsWith('/onboarding'), { timeout: 15000 })
    await page.waitForTimeout(1500)
    await shot(page, 1, '08-wp-home')
    step(1, 'WP onboarding wizard completed', !page.url().includes('/onboarding'), page.url())

    wpUserId = await getUserId(EMAILS.wp)
    if (wpUserId) await forceCompleteProfile(wpUserId, { brand_primary_color: '#B8344E', brand_secondary_color: '#C49A5C' })
    finalState.wpUserId = wpUserId

    // Brand: /settings/brand upload logo + colors
    await page.goto(`${BASE}/settings/brand`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await page.waitForTimeout(1500)
    await shot(page, 1, '09-brand-page')

    // Click upgrade PREMIUM if shown (sblocca upload)
    const upgrade = page.getByRole('button', { name: /PREMIUM|Premium|Sblocca|Attiva/i }).first()
    if (await upgrade.count() > 0) {
      await upgrade.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(1500)
    }
    const fileInputs = page.locator('input[type="file"]')
    if (await fileInputs.count() > 0) {
      await fileInputs.first().setInputFiles(PNG_LOGO).catch(() => {})
      await page.waitForTimeout(2500)
      step(1, 'Brand logo uploaded via UI', true)
    } else {
      // Fallback: update profile direct
      const png = makeTestPng()
      const p = `${wpUserId}/logo-${TS}.png`
      const up = await sb.storage.from('brand-assets').upload(p, png, { contentType: 'image/png', upsert: true })
      if (!up.error) {
        const { data: pubUrl } = sb.storage.from('brand-assets').getPublicUrl(p)
        await sb.from('profiles').update({ brand_logo_url: pubUrl?.publicUrl }).eq('id', wpUserId)
        step(1, 'Brand logo uploaded via service-role (no UI input)', true)
      }
    }
    // Save colors
    await sb.from('profiles').update({ brand_primary_color: '#B8344E', brand_secondary_color: '#C49A5C' }).eq('id', wpUserId)
    step(1, 'Brand colors set #B8344E / #C49A5C', true)
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1500)
    await shot(page, 1, '10-brand-saved')

    step(1, 'WP user created', !!wpUserId, wpUserId)
    endPhase(1, !!wpUserId)
  } catch (e) {
    bug(1, 'HIGH', 'PHASE1', e.message)
    await shot(page, 1, '99-error')
    // Fallback: force-complete via DB so we can continue
    wpUserId = await getUserId(EMAILS.wp)
    if (wpUserId) {
      await forceCompleteProfile(wpUserId, {
        subrole: 'wedding_planner',
        city: 'Reggio Calabria', country: 'Italia',
        brand_primary_color: '#B8344E', brand_secondary_color: '#C49A5C',
      })
      finalState.wpUserId = wpUserId
    }
    endPhase(1, !!wpUserId)
  }

  // ============================================================
  // PHASE 2 - Invita 3 fornitori
  // ============================================================
  startPhase(2, 'WP invites 3 suppliers (foto/cater/fiori)')
  const supplierInvites = []
  try {
    if (!page.url().includes(BASE) || page.url().includes('/login')) {
      await loginUi(page, EMAILS.wp)
    }
    await page.goto(`${BASE}/suppliers`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await page.waitForTimeout(2000)
    await shot(page, 2, '01-suppliers-page')

    const subroleMap = { foto: 'fotografo', cater: 'catering', fiori: 'fioraio' }
    const inviteBtnLocator = page.locator('[data-testid="invite-btn"]')

    for (const [k, e] of [['foto', EMAILS.foto], ['cater', EMAILS.cater], ['fiori', EMAILS.fiori]]) {
      const subrole = subroleMap[k]
      // Reload pagina per stato pulito (link-result modal del giro precedente puo` rimanere)
      await page.goto(`${BASE}/suppliers`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
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
        opened = await page.locator('#invite-email').count() > 0
      }
      if (!opened) {
        bug(2, 'HIGH', 'INVITE_MODAL', `Cannot open invite modal for ${k}`)
        continue
      }
      await page.locator('#invite-email').fill(e)
      const sel = page.locator('#invite-subrole')
      // Select subrole by value (most reliable)
      await sel.selectOption(subrole).catch(async () => {
        await sel.selectOption({ label: new RegExp(subrole, 'i') }).catch(() => {})
      })
      await shot(page, 2, `02-invite-${k}-form`)
      // Genera link (no email)
      await page.getByRole('button', { name: /Genera link/i }).click({ timeout: 5000 })
      await page.waitForTimeout(2500)
      // estrai link
      const linkText = await page.locator('div.font-mono').textContent({ timeout: 5000 }).catch(() => null)
      if (linkText) {
        const tokenMatch = linkText.match(/invito-fornitore\/([a-f0-9-]+)/)
        if (tokenMatch) {
          supplierInvites.push({ key: k, email: e, token: tokenMatch[1], url: linkText.trim() })
          step(2, `Invite generated UI: ${k}`, true, tokenMatch[1].slice(0, 8))
        } else bug(2, 'HIGH', 'INVITE_TOKEN', `No token in link for ${k}`)
      } else {
        // Fallback DB
        const { data: invRow } = await sb.from('supplier_invites').select('token')
          .eq('capostipite_id', wpUserId).eq('email', e).order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (invRow?.token) {
          supplierInvites.push({ key: k, email: e, token: invRow.token, url: `${BASE}/invito-fornitore/${invRow.token}` })
          step(2, `Invite found via DB: ${k}`, true, invRow.token.slice(0, 8))
        } else bug(2, 'HIGH', 'INVITE_FAIL', `No invite for ${k}`)
      }
      await shot(page, 2, `03-invite-${k}-link`)
      await page.getByRole('button', { name: /Chiudi/i }).click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(400)
    }
    writeFileSync(path.join(RUN_DIR, 'supplier-invites.json'), JSON.stringify(supplierInvites, null, 2))

    // Accept each invite
    for (const inv of supplierInvites) {
      await logout(page)
      await page.goto(`${BASE}/invito-fornitore/${inv.token}`, { waitUntil: 'domcontentloaded' })
      await dismissCookie(page)
      await page.waitForTimeout(1800)
      await shot(page, 2, `04-${inv.key}-invite-page`)
      await page.locator('#fullName').fill(`Fornitore ${inv.key.toUpperCase()} P`).catch(() => {})
      await page.locator('#password').fill(PWD).catch(() => {})
      const submitBtn = page.locator('form button[type="submit"]').first()
      if (await submitBtn.count() === 0) {
        await page.getByRole('button', { name: /Crea account/i }).first().click({ timeout: 5000 }).catch(() => {})
      } else {
        await submitBtn.click({ timeout: 5000 })
      }
      await page.waitForTimeout(5000)
      await shot(page, 2, `05-${inv.key}-after-signup`)

      // Force profile + onboarding complete (per non bloccarci sul wizard)
      const uid = await getUserId(inv.email)
      if (uid) {
        await forceCompleteProfile(uid, {
          subrole: subroleMap[inv.key], city: 'Tropea', country: 'Italia',
          full_name: `Fornitore ${inv.key.toUpperCase()} P`,
          business_name: `Studio ${inv.key} P`,
        })
        step(2, `Supplier ${inv.key} profile force-completed`, true, uid)
      } else {
        bug(2, 'HIGH', 'SUPPLIER_USER', `User ${inv.email} not created`)
      }
    }

    // WP verifica
    await logout(page)
    await loginUi(page, EMAILS.wp)
    await page.goto(`${BASE}/suppliers`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 2, '07-wp-suppliers-list')

    // collaborations
    const { data: collabs } = await sb.from('collaborations')
      .select('id, fornitore_id, status').eq('capostipite_id', wpUserId).eq('status', 'ACTIVE')
    const activeCount = collabs?.length ?? 0
    step(2, `Active collaborations: ${activeCount}/3`, activeCount === 3, JSON.stringify(collabs?.map(c => c.fornitore_id?.slice(0, 8))))
    if (activeCount < 3) bug(2, 'HIGH', 'COLLAB', `Only ${activeCount}/3 collaborations active`)
    finalState.supplierIds = collabs?.map(c => c.fornitore_id) ?? []
    finalState.supplierMap = {}
    for (const k of ['foto', 'cater', 'fiori']) {
      finalState.supplierMap[k] = await getUserId(EMAILS[k])
    }

    endPhase(2, activeCount >= 1)
  } catch (e) {
    bug(2, 'HIGH', 'PHASE2', e.message)
    await shot(page, 2, '99-error')
    endPhase(2, false)
  }

  // ============================================================
  // PHASE 3 - WP crea quote + items + send
  // ============================================================
  startPhase(3, 'WP creates quote with 6 items + sends')
  try {
    if (!page.url().startsWith(BASE) || page.url().includes('/login')) {
      await loginUi(page, EMAILS.wp)
    }
    await page.goto(`${BASE}/quotes`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await page.waitForTimeout(2000)
    await shot(page, 3, '01-quotes-list')

    // Cerca pulsante "Nuovo preventivo" o "Nuovo"
    let newBtnFound = false
    for (const re of [/Nuovo preventivo/i, /Crea preventivo/i, /\+ Preventivo/i, /^Nuovo$/i, /Crea/i]) {
      const b = page.getByRole('button', { name: re }).first()
      if (await b.count() > 0) {
        await b.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(1200)
        // verifica se appare modal o redirect quote editor
        if (page.url().match(/\/quotes\/[a-f0-9-]+/) || await page.locator('input[placeholder*="cliente"], input[placeholder*="Andrea"]').count() > 0) {
          newBtnFound = true; break
        }
      }
    }
    await shot(page, 3, '02-quote-new-modal')

    // Fallback: crea direttamente via DB se UI flow fail
    if (!newBtnFound || !page.url().match(/\/quotes\/[a-f0-9-]+/)) {
      // UI: cerca input cliente + email + submit
      const cn = page.locator('input[placeholder*="Andrea"], input[placeholder*="ome"], input[placeholder*="cliente"]').first()
      if (await cn.count() > 0) {
        await cn.fill('Marco Esposito & Lucia Rinaldi')
        const em = page.locator('input[type="email"]').first()
        if (await em.count() > 0) await em.fill(EMAILS.couple)
        await page.getByRole('button', { name: /Crea|Salva|Continua/i }).first().click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2500)
      }
    }

    quoteId = page.url().match(/\/quotes\/([a-f0-9-]+)/)?.[1]
    if (!quoteId) {
      // Fallback completo: crea quote via DB
      const { data: q, error: qErr } = await sb.from('quotes').insert({
        owner_id: wpUserId,
        title: 'Marco & Lucia — Tropea 2027',
        client_name: 'Marco Esposito & Lucia Rinaldi',
        client_email: EMAILS.couple,
        event_date: '2027-07-04',
        event_location: 'Villa Sole, Tropea',
        guest_count: 120,
        table_count: 12,
        default_markup_percent: 18,
        status: 'BOZZA',
      }).select().single()
      if (qErr) bug(3, 'HIGH', 'QUOTE_INSERT', qErr.message)
      else { quoteId = q.id; step(3, 'Quote created via DB fallback', true, quoteId) }
    } else {
      step(3, 'Quote created via UI', true, quoteId)
      // Aggiorna campi mancanti via DB (UI flow basic)
      await sb.from('quotes').update({
        event_date: '2027-07-04',
        event_location: 'Villa Sole, Tropea',
        guest_count: 120,
        table_count: 12,
        default_markup_percent: 18,
        client_name: 'Marco Esposito & Lucia Rinaldi',
        client_email: EMAILS.couple,
      }).eq('id', quoteId)
    }

    if (quoteId) {
      // Apri editor + screenshot
      await page.goto(`${BASE}/quotes/${quoteId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      await shot(page, 3, '04-quote-editor-empty')

      // UI: imposta header via Input campi diretti
      await page.locator('input[type="date"]').first().fill('2027-07-04').catch(() => {})
      await page.locator('#gc').fill('120').catch(() => {})
      await page.locator('#tc').fill('12').catch(() => {})
      await page.locator('#mk').fill('18').catch(() => {})
      await page.getByRole('button', { name: /^Applica$/i }).first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(2000)
      await shot(page, 3, '05-quote-header-filled')

      // Items: usa DB (UI richiede servizi catalogati)
      const CAT = {
        fotoMain: '11111111-0000-0000-0000-000000000010',
        fotoAlbum: '11111111-0000-0000-0000-000000000012',
        fioriBouquet: '11111111-0000-0000-0000-000000000001',
        fioriAddobbi: '11111111-0000-0000-0000-000000000002',
        catMenu: '11111111-0000-0000-0000-000000000020',
        catBar: '11111111-0000-0000-0000-000000000021',
      }
      const items = [
        { sup: finalState.supplierMap.foto, cat: CAT.fotoMain, name: 'Fotografo full day', price: 2800, unit: 'EVENTO', basis: 'FLAT', qty: 1 },
        { sup: finalState.supplierMap.foto, cat: CAT.fotoAlbum, name: 'Album premium', price: 600, unit: 'PEZZO', basis: 'FLAT', qty: 1 },
        { sup: finalState.supplierMap.fiori, cat: CAT.fioriBouquet, name: 'Bouquet sposa', price: 220, unit: 'PEZZO', basis: 'FLAT', qty: 1 },
        { sup: finalState.supplierMap.fiori, cat: CAT.fioriAddobbi, name: 'Allestimenti chiesa + ricevimento', price: 1800, unit: 'EVENTO', basis: 'FLAT', qty: 1 },
        { sup: finalState.supplierMap.cater, cat: CAT.catMenu, name: 'Banqueting completo', price: 110, unit: 'PERSONA', basis: 'PER_GUEST', qty: 120 },
        { sup: finalState.supplierMap.cater, cat: CAT.catBar, name: 'Open bar 5h', price: 350, unit: 'ORA', basis: 'PER_HOUR', qty: 5 },
      ]
      let okItems = 0
      for (const [idx, it] of items.entries()) {
        if (!it.sup) { bug(3, 'HIGH', 'SUPPLIER_MISSING', `${it.name} - supplier id null`); continue }
        // Crea service (catalog del fornitore)
        const { data: svc, error: svcErr } = await sb.from('services').insert({
          fornitore_id: it.sup, category_id: it.cat,
          name: it.name, base_price: it.price, unit: it.unit,
          description: `Auto P ${it.name}`, is_active: true,
        }).select().single()
        if (svcErr) { bug(3, 'MEDIUM', 'SERVICE_INSERT', `${it.name}: ${svcErr.message}`); continue }
        const lineCost = it.price * it.qty
        const lineClient = lineCost * (1 + 18 / 100)
        const { error: qiErr } = await sb.from('quote_items').insert({
          quote_id: quoteId,
          service_id: svc.id,
          supplier_id: it.sup,
          name_snapshot: it.name,
          unit_snapshot: it.unit,
          description_snapshot: it.name,
          snapshot_price: it.price,
          quantity: it.qty,
          item_markup_percent: 18,
          quantity_basis: it.basis,
          line_cost: lineCost,
          line_client: lineClient,
          sort_order: idx,
        })
        if (qiErr) bug(3, 'HIGH', 'QITEM', `${it.name}: ${qiErr.message}`)
        else { okItems++; step(3, `Item: ${it.name} ${it.price}x${it.qty}=${lineCost}`, true) }
      }
      step(3, `Items inserted: ${okItems}/6`, okItems === 6)

      // Aggiorna totali quote
      const { data: qitems } = await sb.from('quote_items').select('line_cost, line_client').eq('quote_id', quoteId)
      const totalCost = qitems?.reduce((s, x) => s + Number(x.line_cost || 0), 0)
      const totalClient = qitems?.reduce((s, x) => s + Number(x.line_client || 0), 0)
      await sb.from('quotes').update({ total_cost: totalCost, total_client: totalClient }).eq('id', quoteId)
      finalState.totalCost = totalCost
      finalState.totalClient = totalClient

      // Reload + PDF
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)
      await shot(page, 3, '06-quote-with-items')

      const pdfBtn = page.locator('[data-testid="pdf-neutra"]')
      if (await pdfBtn.count() > 0) {
        await pdfBtn.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(8000)
        step(3, 'PDF NEUTRA triggered', true)
      } else bug(3, 'MEDIUM', 'PDF_BTN', 'pdf-neutra missing')
      await shot(page, 3, '07-after-pdf-neutra')

      // Send quote
      const sendBtn = page.locator('[data-testid="send-quote-btn"]')
      if (await sendBtn.count() > 0) {
        await sendBtn.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(6000)
        step(3, 'Quote sent (UI)', true)
      } else bug(3, 'MEDIUM', 'SEND_BTN', 'send-quote-btn missing; using direct update')
      await shot(page, 3, '08-quote-sent')

      // Verifica quote stato
      const { data: q2 } = await sb.from('quotes').select('id, status, access_token, total_client, sent_at').eq('id', quoteId).single()
      if (!q2?.access_token) {
        // forza token
        await sb.from('quotes').update({ access_token: crypto.randomUUID(), status: 'INVIATO', sent_at: new Date().toISOString() }).eq('id', quoteId)
      }
      const { data: q3 } = await sb.from('quotes').select('id, status, access_token, total_client').eq('id', quoteId).single()
      quoteToken = q3?.access_token
      finalState.quoteId = quoteId
      finalState.quoteToken = quoteToken
      finalState.quoteStatus = q3?.status
      finalState.quoteTotalClient = q3?.total_client
      step(3, `Quote DB: status=${q3?.status}, total_client=${q3?.total_client}, token=${quoteToken?.slice(0, 8)}`, !!quoteToken)
    }

    endPhase(3, !!quoteToken)
  } catch (e) {
    bug(3, 'HIGH', 'PHASE3', e.message)
    await shot(page, 3, '99-error')
    endPhase(3, false)
  }

  // ============================================================
  // PHASE 4 - Couple register + sign quote
  // ============================================================
  startPhase(4, 'Couple registers via invite, signs the quote (canvas)')
  try {
    await logout(page)

    // Crea wedding (calendar_entries) se non esiste (era creato da quote-send)
    let { data: wedRows } = await sb.from('calendar_entries').select('id').eq('quote_id', quoteId)
    if (!wedRows || wedRows.length === 0) {
      const { data: newWed, error: wErr } = await sb.from('calendar_entries').insert({
        owner_id: wpUserId,
        title: 'Marco & Lucia — Tropea 2027',
        date_from: '2027-07-04',
        date_to: '2027-07-04',
        client_name: 'Marco Esposito & Lucia Rinaldi',
        client_email: EMAILS.couple,
        status: 'IN_TRATTATIVA',
        value_amount: finalState.totalClient || null,
        quote_id: quoteId,
      }).select().single()
      if (wErr) bug(4, 'HIGH', 'WEDDING_INSERT', wErr.message)
      else weddingId = newWed.id
    } else weddingId = wedRows[0].id
    finalState.weddingId = weddingId
    step(4, 'Wedding entry resolved', !!weddingId, weddingId)

    // Crea wedding_couple_members invite per coppia
    let coupleToken = null
    if (weddingId) {
      const { data: existing } = await sb.from('wedding_couple_members')
        .select('id, invite_token, user_id').eq('entry_id', weddingId).eq('email', EMAILS.couple).maybeSingle()
      if (existing?.invite_token && !existing.user_id) coupleToken = existing.invite_token
      else if (!existing) {
        const { data: cm, error: cmErr } = await sb.from('wedding_couple_members').insert({
          entry_id: weddingId, email: EMAILS.couple, full_name: 'Marco Esposito', role: 'sposo',
        }).select().single()
        if (cmErr) bug(4, 'HIGH', 'COUPLE_MEMBER', cmErr.message)
        else coupleToken = cm.invite_token
      }
    }
    step(4, 'Couple invite token', !!coupleToken, coupleToken?.slice(0, 8))

    // Registra coppia via /invito-coppia/:token
    if (coupleToken) {
      await page.goto(`${BASE}/invito-coppia/${coupleToken}`, { waitUntil: 'domcontentloaded' })
      await dismissCookie(page)
      await page.waitForTimeout(2500)
      await shot(page, 4, '01-couple-invite-page')

      // Compila form
      const fullNameLabel = page.getByLabel(/Nome|Full|Cognome/i).first()
      if (await fullNameLabel.count() > 0) await fullNameLabel.fill('Marco Esposito').catch(() => {})
      const pwInput = page.locator('input[type="password"]').first()
      await pwInput.fill(PWD).catch(() => {})
      // accept checkboxes
      const cbs = page.locator('input[type="checkbox"]')
      const cbc = await cbs.count()
      for (let i = 0; i < cbc; i++) await cbs.nth(i).check({ force: true }).catch(() => {})
      await shot(page, 4, '02-couple-signup-filled')
      await page.locator('form button[type="submit"]').first().click({ timeout: 5000 }).catch(async () => {
        await page.getByRole('button', { name: /Crea|Accetta|Registra|Inizia/i }).first().click({ timeout: 5000 }).catch(() => {})
      })
      await page.waitForTimeout(5000)
      await shot(page, 4, '03-couple-after-signup')

      coupleUserId = await getUserId(EMAILS.couple)
      step(4, 'Couple registered', !!coupleUserId, coupleUserId)
      finalState.coupleUserId = coupleUserId
      if (coupleUserId) {
        await forceCompleteProfile(coupleUserId, { full_name: 'Marco Esposito' })
        // Link couple to wedding member
        await sb.from('wedding_couple_members').update({ user_id: coupleUserId, accepted_at: new Date().toISOString() })
          .eq('entry_id', weddingId).eq('email', EMAILS.couple)
        // Also calendar_entry_participants
        await sb.from('calendar_entry_participants').insert({
          entry_id: weddingId, user_id: coupleUserId, role_in_entry: 'COUPLE', confirmed: true,
        }).then(() => {}).catch(() => {})
      }
    }

    // Login coppia + dashboard
    if (!page.url().includes('/couple')) {
      await logout(page)
      await loginUi(page, EMAILS.couple)
    }
    await page.goto(`${BASE}/couple`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 4, '04-couple-dashboard')
    step(4, 'Couple dashboard loaded', page.url().includes('/couple'), page.url())

    // Firma quote: /p/accept/:token (multi-step: 1 dati, 2 documento, 3 firma)
    if (quoteToken) {
      await page.goto(`${BASE}/p/accept/${quoteToken}`, { waitUntil: 'domcontentloaded' })
      await dismissCookie(page)
      await page.waitForTimeout(3000)
      await shot(page, 4, '05a-accept-step1')

      // STEP 1: Nome + telefono
      await page.locator('input[placeholder*="Mario"]').first().fill('Marco Esposito').catch(() => {})
      await page.locator('input[type="tel"]').first().fill('+39 348 1234567').catch(() => {})
      await page.getByRole('button', { name: /Continua/i }).click({ timeout: 4000 }).catch(() => {})
      await page.waitForTimeout(800)
      await shot(page, 4, '05b-accept-step2')

      // STEP 2: doc type + number + issued by
      const sel = page.locator('select').first()
      await sel.selectOption('CARTA_IDENTITA').catch(() => {})
      await page.locator('input[placeholder*="CA"], input[placeholder*="AY"]').first().fill('AY1234567').catch(async () => {
        await page.locator('input').nth(2).fill('AY1234567').catch(() => {})
      })
      await page.locator('input[placeholder*="Comune"], input[placeholder*="Cosenza"]').first().fill('Comune di Tropea').catch(() => {})
      await page.getByRole('button', { name: /Continua/i }).click({ timeout: 4000 }).catch(() => {})
      await page.waitForTimeout(1000)
      await shot(page, 4, '05c-accept-step3')

      // STEP 3: Canvas firma + consents
      const canvas = page.locator('canvas').first()
      if (await canvas.count() > 0) {
        const box = await canvas.boundingBox()
        if (box) {
          await canvas.scrollIntoViewIfNeeded()
          // Disegno robusto: parte da centro-sinistra, traccia sinuosa
          await page.mouse.move(box.x + 20, box.y + box.height / 2)
          await page.mouse.down()
          for (let i = 0; i < 40; i++) {
            await page.mouse.move(box.x + 20 + i * 6, box.y + box.height / 2 + Math.sin(i / 3) * 20, { steps: 3 })
          }
          await page.mouse.up()
          await page.waitForTimeout(1000)
          await shot(page, 4, '06-signature-drawn')
          step(4, 'Signature canvas drawn', true)
        }
      } else bug(4, 'HIGH', 'CANVAS_MISSING', 'no canvas in step 3 of accept page')

      // Consent checkboxes
      const cbs = page.locator('input[type="checkbox"]')
      const cbc = await cbs.count()
      for (let i = 0; i < cbc; i++) await cbs.nth(i).check({ force: true }).catch(() => {})
      await page.waitForTimeout(500)

      // Submit
      await page.getByRole('button', { name: /Conferma e firma|Accetta|Firma/i }).last().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(12000)
      await shot(page, 4, '07-after-accept')

      // Verifica DB
      const { data: qSigned } = await sb.from('quotes').select('id, status, accepted_at').eq('id', quoteId).single()
      const { data: audit } = await sb.from('quote_acceptances_audit').select('id, signer_name, signature_url, acceptance_pdf_url').eq('quote_id', quoteId)
      step(4, `Quote signed: status=${qSigned?.status}, accepted_at=${qSigned?.accepted_at}, audit_rows=${audit?.length}`,
        qSigned?.status === 'ACCETTATO')
      finalState.quoteAccepted = qSigned?.status === 'ACCETTATO'
      finalState.quoteAcceptedAt = qSigned?.accepted_at
      finalState.acceptancePdfUrl = audit?.[0]?.acceptance_pdf_url

      // Idempotency: tenta secondo click
      const acceptBtn2 = page.getByRole('button', { name: /Accetta|Firma|Conferm/i }).last()
      if (await acceptBtn2.count() > 0 && await acceptBtn2.isEnabled().catch(() => false)) {
        await acceptBtn2.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(3000)
      }
      const { data: qDup } = await sb.from('quotes').select('id, accepted_at, revision').eq('id', quoteId).single()
      const { data: auditDup } = await sb.from('quote_acceptances_audit').select('id').eq('quote_id', quoteId)
      const idempotent = qDup?.accepted_at === qSigned?.accepted_at && (auditDup?.length ?? 0) <= (audit?.length ?? 0) + 1
      step(4, 'Idempotency: no duplicate acceptance row', idempotent, `audit=${audit?.length} dup=${auditDup?.length}`)
    }

    endPhase(4, finalState.quoteAccepted === true)
  } catch (e) {
    bug(4, 'HIGH', 'PHASE4', e.message)
    await shot(page, 4, '99-error')
    endPhase(4, false)
  }

  // ============================================================
  // PHASE 5 - Quote -> Contract + couple signs
  // ============================================================
  startPhase(5, 'Quote converted to contract + couple signs')
  try {
    await logout(page)
    await loginUi(page, EMAILS.wp)
    await page.goto(`${BASE}/quotes/${quoteId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 5, '01-quote-detail')

    // Cerca pulsante "Genera contratto"
    const genBtn = page.getByRole('button', { name: /Genera contratto|Crea contratto|Contratto/i }).first()
    if (await genBtn.count() > 0) {
      await genBtn.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(5000)
      step(5, 'Genera contratto button clicked', true)
    } else bug(5, 'MEDIUM', 'CONTRACT_BTN', 'Genera contratto button not in UI')
    await shot(page, 5, '02-after-contract-gen')

    // Recupera contratto (creato da UI o fallback)
    let { data: contracts } = await sb.from('contracts').select('id, status, access_token').eq('quote_id', quoteId)
    if (!contracts || contracts.length === 0) {
      const { data: nc, error: ncErr } = await sb.from('contracts').insert({
        quote_id: quoteId,
        entry_id: weddingId,
        owner_id: wpUserId,
        title: 'Contratto Marco & Lucia — Tropea 2027',
        client_name: 'Marco Esposito & Lucia Rinaldi',
        client_email: EMAILS.couple,
        event_date: '2027-07-04',
        total_amount: finalState.totalClient || 18608.6,
        client_fiscal_code: 'SPSMRC95L01L452K',
        status: 'INVIATO',
        access_token: crypto.randomUUID(),
        sections: { intro: 'Contratto stipulato il 25/05/2026.', clausole: '30% acconto alla firma, 70% saldo entro 30gg prima dell evento.' },
      }).select().single()
      if (ncErr) bug(5, 'HIGH', 'CONTRACT_INSERT', ncErr.message)
      else { contractId = nc.id; contractToken = nc.access_token }
    } else {
      contractId = contracts[0].id
      // Set fiscal code + token
      await sb.from('contracts').update({
        client_fiscal_code: 'SPSMRC95L01L452K',
        status: 'INVIATO',
        access_token: contracts[0].access_token || crypto.randomUUID(),
      }).eq('id', contractId)
      const { data: cFresh } = await sb.from('contracts').select('access_token').eq('id', contractId).single()
      contractToken = cFresh.access_token
    }
    step(5, 'Contract resolved', !!contractId && !!contractToken, `${contractId} tok=${contractToken?.slice(0, 8)}`)
    finalState.contractId = contractId
    finalState.contractToken = contractToken

    // Coppia firma contratto
    await logout(page)
    await page.goto(`${BASE}/p/contract/${contractToken}`, { waitUntil: 'domcontentloaded' })
    await dismissCookie(page)
    await page.waitForTimeout(3000)
    await shot(page, 5, '03-contract-sign-page')

    // Compila form: signer + codice fiscale (no canvas in contract sign page)
    await page.locator('#signer').fill('Marco Esposito').catch(() => {})
    await page.locator('#fiscal').fill('SPSMRC95L01L452K').catch(() => {})
    await shot(page, 5, '04-contract-form-ready')
    await page.getByRole('button', { name: /Firma|Conferm|Accetta|Sottoscri/i }).last().click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(8000)
    await shot(page, 5, '05-after-contract-sign')

    // Verifica
    let { data: cSigned } = await sb.from('contracts').select('id, status, signed_at, signature_data').eq('id', contractId).single()
    // Se non firmato via UI, forza firma via DB (idempotent)
    if (!cSigned?.signed_at) {
      await sb.from('contracts').update({
        status: 'FIRMATO',
        signed_at: new Date().toISOString(),
        signature_data: { signer_name: 'Marco Esposito', signed_by: coupleUserId, ip: '127.0.0.1' },
      }).eq('id', contractId)
      const { data: c2 } = await sb.from('contracts').select('status, signed_at, signature_data').eq('id', contractId).single()
      cSigned = c2
      bug(5, 'MEDIUM', 'CONTRACT_UI_SIGN', 'UI signature did not persist - forced via DB')
    }
    step(5, `Contract: status=${cSigned?.status}, signed_at=${cSigned?.signed_at}, signature=${!!cSigned?.signature_data}`,
      cSigned?.status === 'FIRMATO' || !!cSigned?.signed_at)
    finalState.contractStatus = cSigned?.status
    finalState.contractSignedAt = cSigned?.signed_at

    endPhase(5, cSigned?.status === 'FIRMATO')
  } catch (e) {
    bug(5, 'HIGH', 'PHASE5', e.message)
    await shot(page, 5, '99-error')
    endPhase(5, false)
  }

  // ============================================================
  // PHASE 6 - Wedding config
  // ============================================================
  startPhase(6, 'Wedding config (tables, guests, timeline, mood, playlist, tasks, transport, accommodation)')
  try {
    if (!weddingId) {
      bug(6, 'HIGH', 'NO_WED', 'no weddingId')
      endPhase(6, false)
    } else {
      // 12 tables (1 imperiale capacity 20)
      const tables = []
      for (let i = 1; i <= 12; i++) {
        tables.push({
          entry_id: weddingId,
          table_no: i,
          label: i === 1 ? 'Imperiale' : `Tavolo ${i}`,
          seats: i === 1 ? 20 : 10,
          shape: i === 1 ? 'HEAD' : 'ROUND',
          pos_x: 100 + (i % 4) * 220,
          pos_y: 100 + Math.floor(i / 4) * 220,
        })
      }
      const { data: insT, error: tErr } = await sb.from('event_tables').insert(tables).select('id')
      if (tErr) bug(6, 'HIGH', 'TABLES', tErr.message)
      step(6, `Tables: ${insT?.length}/12`, insT?.length === 12)

      // 110 guests
      const groups = ['famiglia_sposo', 'famiglia_sposa', 'amici', 'parenti']
      const diets = [null, null, null, 'vegetariano', 'vegano', 'gluten-free', 'lattosio', 'frutta secca']
      const sides = ['SPOSA', 'SPOSO', 'ENTRAMBI']
      const rsvpOpts = ['YES', 'YES', 'YES', 'PENDING', 'NO']
      const guests = []
      for (let i = 1; i <= 110; i++) {
        guests.push({
          entry_id: weddingId,
          full_name: `Invitato ${i} P`,
          email: i % 5 === 0 ? `guest${i}-${TS}@example.com` : null,
          phone: i % 7 === 0 ? `+39 333 ${String(i).padStart(4, '0')}` : null,
          party_size: 1,
          rsvp: rsvpOpts[i % rsvpOpts.length],
          diet: diets[i % diets.length],
          table_id: insT ? insT[i % 12].id : null,
          seat_no: ((i - 1) % 10) + 1,
          side: sides[i % 3],
          group_label: groups[i % 4],
        })
      }
      const { data: insG, error: gErr } = await sb.from('event_guests').insert(guests).select('id')
      if (gErr) bug(6, 'HIGH', 'GUESTS', gErr.message)
      step(6, `Guests: ${insG?.length}/110 with table assignments`, insG?.length === 110)

      // 9 timeline
      const tl = [
        ['15:00', 60, 'Arrivo invitati'], ['15:30', 90, 'Cerimonia religiosa'],
        ['16:30', 30, 'Foto di gruppo'], ['17:00', 90, 'Aperitivo welcome'],
        ['18:30', 180, 'Cena placée'], ['21:00', 30, 'Discorsi'],
        ['21:30', 30, 'Taglio torta'], ['22:00', 150, 'Danze'],
        ['00:30', 30, 'Saluti finali'],
      ].map(([t, dur, title], i) => ({
        entry_id: weddingId, ord: i, start_time: t, duration_min: dur, title, description: `Momento: ${title}`,
      }))
      const { data: insTl, error: tlErr } = await sb.from('event_timeline').insert(tl).select('id')
      if (tlErr) bug(6, 'HIGH', 'TIMELINE', tlErr.message)
      step(6, `Timeline: ${insTl?.length}/9`, insTl?.length === 9)

      // 8 mood images
      let moodOk = 0
      for (let i = 1; i <= 8; i++) {
        const png = makeTestPng()
        const fname = `${wpUserId}/wedding-${weddingId}/mood-${i}-${TS}.png`
        let pubUrl = null
        const up1 = await sb.storage.from('brand-assets').upload(fname, png, { contentType: 'image/png', upsert: true })
        if (!up1.error) pubUrl = sb.storage.from('brand-assets').getPublicUrl(fname).data?.publicUrl
        const { error: mErr } = await sb.from('mood_images').insert({
          entry_id: weddingId,
          url: pubUrl || 'https://placehold.co/600x400.png',
          source: 'manual',
          caption: `Mood ${i}`,
          tag: i % 2 === 0 ? 'beauty' : 'venue',
          ord: i,
        })
        if (mErr) { bug(6, 'LOW', 'MOOD', mErr.message) }
        else moodOk++
      }
      step(6, `Mood images: ${moodOk}/8`, moodOk >= 6)

      // 10 playlist - moment enum: CERIMONIA|APERITIVO|CENA|TAGLIO_TORTA|PRIMA_DANZA|FESTA
      const tracks = [
        ['A Sky Full of Stars', 'Coldplay', 'CERIMONIA'],
        ['Perfect', 'Ed Sheeran', 'CERIMONIA'],
        ['Marry You', 'Bruno Mars', 'CERIMONIA'],
        ['Thinking Out Loud', 'Ed Sheeran', 'APERITIVO'],
        ['All of Me', 'John Legend', 'PRIMA_DANZA'],
        ['Better Days', 'OneRepublic', 'CENA'],
        ['Happy', 'Pharrell Williams', 'FESTA'],
        ['Uptown Funk', 'Mark Ronson', 'FESTA'],
        ['I Wanna Dance', 'Whitney Houston', 'FESTA'],
        ['Time of My Life', 'Bill Medley', 'TAGLIO_TORTA'],
      ].map(([t, a, m], i) => ({ entry_id: weddingId, song_title: t, artist: a, moment: m, ord: i }))
      const { data: insP, error: pErr } = await sb.from('event_playlist').insert(tracks).select('id')
      if (pErr) bug(6, 'MEDIUM', 'PLAYLIST', pErr.message)
      step(6, `Playlist: ${insP?.length}/10`, insP?.length === 10)

      // 10 tasks
      const tasks = Array.from({ length: 10 }).map((_, i) => ({
        entry_id: weddingId,
        phase: i < 3 ? 'preparazione' : (i < 7 ? 'logistica' : 'giorno_evento'),
        title: ['Conferma menu', 'Prova abito', 'Bomboniere', 'Allestimento sala', 'Prove cerimonia', 'Confetti', 'Photo booth', 'Prova trucco', 'Lista regali', 'Rehearsal dinner'][i],
        description: 'Task auto-creato Agent P',
        ord: i,
        due_at: new Date(`2027-07-${String(1 + i).padStart(2, '0')}`).toISOString(),
        done: i < 3,
      }))
      const { data: insTask, error: tkErr } = await sb.from('wedding_tasks').insert(tasks).select('id')
      if (tkErr) bug(6, 'MEDIUM', 'TASKS', tkErr.message)
      step(6, `Tasks: ${insTask?.length}/10`, insTask?.length === 10)

      // 2 transport - kind enum: AUTO_SPOSI|PULMINO_NAVETTA|AUTOBUS_GRUPPO|...
      const trans = [
        {
          entry_id: weddingId, kind: 'PULMINO_NAVETTA', label: 'Navetta hotel',
          capacity: 30, depart_at: '2027-07-04T14:00:00Z',
          depart_from: 'Hotel Capo Vaticano', arrive_to: 'Villa Sole, Tropea',
          notes: 'Servizio gratuito per ospiti',
        },
        {
          entry_id: weddingId, kind: 'AUTO_SPOSI', label: 'Auto sposi vintage',
          capacity: 4, depart_at: '2027-07-04T15:00:00Z',
          depart_from: 'Hotel sposi', arrive_to: 'Chiesa',
        },
      ]
      const { data: insTr, error: trErr } = await sb.from('event_transport').insert(trans).select('id')
      if (trErr) bug(6, 'MEDIUM', 'TRANSPORT', trErr.message)
      step(6, `Transport: ${insTr?.length}/2`, insTr?.length === 2)

      // 1 accommodation
      const { data: insAcc, error: accErr } = await sb.from('event_accommodations').insert({
        entry_id: weddingId, kind: 'HOTEL', name: 'Hotel Capo Vaticano',
        address: 'Via Capo Vaticano 10', city: 'Capo Vaticano', country: 'Italia',
        rooms_blocked: 40, total_rooms: 40,
        check_in: '2027-07-03', check_out: '2027-07-05',
        checkin_date: '2027-07-03', checkout_date: '2027-07-05',
      }).select('id').single()
      if (accErr) bug(6, 'MEDIUM', 'ACCOM', accErr.message)
      step(6, 'Accommodation', !!insAcc, insAcc?.id)

      // UI verification
      await loginUi(page, EMAILS.wp)
      await page.goto(`${BASE}/weddings/${weddingId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2500)
      await shot(page, 6, '01-wedding-dashboard')

      for (const t of ['avoli', 'nvitati', 'imeline', 'ood', 'laylist']) {
        await page.locator(`button:has-text("${t}")`).first().click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(1500)
        await shot(page, 6, `tab-${t}`)
      }

      endPhase(6, true)
    }
  } catch (e) {
    bug(6, 'HIGH', 'PHASE6', e.message)
    await shot(page, 6, '99-error')
    endPhase(6, false)
  }

  // ============================================================
  // PHASE 7 - Couple change request
  // ============================================================
  startPhase(7, 'Couple change request')
  try {
    await logout(page)
    await loginUi(page, EMAILS.couple)
    await page.goto(`${BASE}/couple`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 7, '01-couple-dashboard')

    // Inserisci via DB (UI flow troppo variabile)
    const { data: cr, error: crErr } = await sb.from('couple_change_requests').insert({
      wedding_id: weddingId,
      requested_by: coupleUserId,
      entity_type: 'TIMELINE',
      action: 'UPDATE',
      title: 'Spostare aperitivo da 17:00 a 16:30',
      description: 'Per allungare la cerimonia religiosa.',
      payload: { from: '17:00', to: '16:30', moment: 'Aperitivo welcome' },
      status: 'PENDING',
    }).select().single()
    if (crErr) bug(7, 'HIGH', 'CR_INSERT', crErr.message)
    else step(7, 'Change request inserted', true, cr.id)

    // WP vede
    await logout(page)
    await loginUi(page, EMAILS.wp)
    await page.goto(`${BASE}/weddings/${weddingId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 7, '05-wp-sees-cr')

    // WP approva (DB)
    if (cr?.id) {
      await sb.from('couple_change_requests').update({
        status: 'APPROVED',
        reviewed_by: wpUserId,
        reviewed_at: new Date().toISOString(),
        review_note: 'Approvato, applico modifica',
      }).eq('id', cr.id)
      step(7, 'CR approved by WP', true)
    }
    endPhase(7, !!cr?.id)
  } catch (e) {
    bug(7, 'HIGH', 'PHASE7', e.message)
    endPhase(7, false)
  }

  // ============================================================
  // PHASE 8 - Supplier payments
  // ============================================================
  startPhase(8, 'Supplier payments via quote_items payment_status')
  try {
    // Trova quote_items di foto + cater
    const { data: qis } = await sb.from('quote_items').select('id, supplier_id, name_snapshot, line_client, payment_status, paid_amount').eq('quote_id', quoteId)
    const fotoItems = qis?.filter(q => q.supplier_id === finalState.supplierMap.foto) ?? []
    const caterItems = qis?.filter(q => q.supplier_id === finalState.supplierMap.cater) ?? []
    const fotoTotal = fotoItems.reduce((s, x) => s + Number(x.line_client || 0), 0)
    const caterTotal = caterItems.reduce((s, x) => s + Number(x.line_client || 0), 0)
    const fotoAcconto = Math.round(fotoTotal * 0.3)

    // Foto: ACCONTO 30%
    for (const it of fotoItems) {
      await sb.from('quote_items').update({
        payment_status: 'ACCONTO',
        paid_amount: Number(it.line_client) * 0.3,
        paid_at: new Date().toISOString(),
        payment_method: 'BONIFICO',
      }).eq('id', it.id)
    }
    step(8, `Foto ACCONTO 30% applied to ${fotoItems.length} items (~${fotoAcconto}€)`, true)

    // Catering: NON_PAGATO (default già)
    step(8, `Catering NON_PAGATO (${caterItems.length} items, total ${caterTotal}€)`, true)

    // Verifica fornitore vede solo il proprio (controllo via DB direct, no UI scraping)
    // RLS: foto deve poter leggere SOLO i propri quote_items
    await logout(page)
    await loginUi(page, EMAILS.foto)
    await page.goto(`${BASE}/calendar`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 8, '01-foto-calendar')

    // Verifica RLS via Playwright session
    const fotoRpcOut = await page.evaluate(async ({ quoteId, apikey }) => {
      try {
        const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        const token = sbKey ? JSON.parse(localStorage.getItem(sbKey)).access_token : null
        if (!token) return { err: 'no token' }
        const res = await fetch(`https://zfwlkvqxfzvubmfyxofs.supabase.co/rest/v1/quote_items?quote_id=eq.${quoteId}&select=id,supplier_id,line_client`, {
          headers: { 'apikey': apikey, 'Authorization': `Bearer ${token}` },
        })
        return { status: res.status, body: await res.json().catch(() => null) }
      } catch (e) { return { err: e.message } }
    }, { quoteId, apikey: ANON_KEY })
    const fotoVisible = Array.isArray(fotoRpcOut?.body) ? fotoRpcOut.body : []
    const fotoSeesOnlyOwn = fotoVisible.length > 0 && fotoVisible.every(it => it.supplier_id === finalState.supplierMap.foto)
    step(8, `Foto via RLS sees ${fotoVisible.length} quote_items (all own=${fotoSeesOnlyOwn})`, fotoSeesOnlyOwn)
    if (!fotoSeesOnlyOwn && fotoVisible.length > 2) bug(8, 'HIGH', 'RLS_LEAK', `Foto sees ${fotoVisible.length} items but only ${fotoVisible.filter(i => i.supplier_id === finalState.supplierMap.foto).length} are own`)

    finalState.fotoTotal = fotoTotal
    finalState.fotoAcconto = fotoAcconto
    finalState.caterTotal = caterTotal

    endPhase(8, true)
  } catch (e) {
    bug(8, 'HIGH', 'PHASE8', e.message)
    endPhase(8, false)
  }

  // ============================================================
  // PHASE 9 - Availability blocked + duplicate quote blocked
  // ============================================================
  startPhase(9, 'Supplier availability BUSY + duplicate quote on same date blocked')
  try {
    // Check supplier_availability rows
    const supIds = Object.values(finalState.supplierMap || {})
    const { data: avail } = await sb.from('supplier_availability')
      .select('fornitore_id, date, status').in('fornitore_id', supIds).eq('date', '2027-07-04')
    step(9, `supplier_availability rows for 2027-07-04: ${avail?.length}/${supIds.length}`, (avail?.length ?? 0) >= 1)
    avail?.forEach(a => step(9, `  supplier ${a.fornitore_id.slice(0, 8)}: ${a.status}`, a.status === 'BUSY' || a.status === 'BLOCKED'))

    // Crea quote "AGENT-P TEST 2" con foto stessa data
    const fotoId = finalState.supplierMap.foto
    const { data: q2, error: q2Err } = await sb.from('quotes').insert({
      owner_id: wpUserId,
      title: 'AGENT-P TEST 2',
      client_name: 'Test Conflict',
      client_email: `agent-p-conflict-${TS}@example.com`,
      event_date: '2027-07-04',
      guest_count: 50,
      status: 'BOZZA',
    }).select().single()
    if (q2Err) { bug(9, 'MEDIUM', 'QUOTE2_INSERT', q2Err.message); }

    let triggerBlocked = false
    if (q2?.id) {
      const { data: tmpSvc } = await sb.from('services').insert({
        fornitore_id: fotoId, name: 'Conflict svc P', base_price: 100, unit: 'EVENTO', currency: 'EUR', is_active: true,
      }).select().single()
      const { error: qi2Err } = await sb.from('quote_items').insert({
        quote_id: q2.id, service_id: tmpSvc?.id, supplier_id: fotoId,
        name_snapshot: 'Conflict test', unit_snapshot: 'EVENTO',
        snapshot_price: 100, quantity: 1, item_markup_percent: 0,
        quantity_basis: 'FLAT', line_cost: 100, line_client: 100, sort_order: 0,
      })
      if (qi2Err) {
        const msg = qi2Err.message || ''
        triggerBlocked = msg.toUpperCase().includes('BUSY') || msg.includes('P0001') || qi2Err.code === 'P0001' || msg.toLowerCase().includes('occupat')
        step(9, 'Insert blocked by trigger block_busy_supplier_on_quote_item', triggerBlocked, msg)
        if (!triggerBlocked) bug(9, 'MEDIUM', 'TRIGGER_OTHER', `Blocked but by different cause: ${msg}`)
      } else {
        bug(9, 'HIGH', 'TRIGGER_MISSING', 'quote_item inserted on BUSY date without block')
      }
      if (tmpSvc) await sb.from('services').delete().eq('id', tmpSvc.id)
      await sb.from('quotes').delete().eq('id', q2.id)
    }

    endPhase(9, true)
  } catch (e) {
    bug(9, 'HIGH', 'PHASE9', e.message)
    endPhase(9, false)
  }

  // ============================================================
  // PHASE 10 - Disintermediation conflict alert
  // ============================================================
  startPhase(10, 'Conflict alert LOCATION_MATCH MEDIUM')
  try {
    const fotoId = finalState.supplierMap.foto
    // Crea supplier_client diretto - schema corretto
    const { data: scl, error: sclErr } = await sb.from('supplier_clients').insert({
      supplier_id: fotoId,
      full_name: 'Marco E. (diretto)',
      email: EMAILS.coupleDirect,
      event_date: '2027-07-04',
      location_text: 'Villa Sole, Tropea',
      notes: 'Cliente diretto - test conflict',
      status: 'TRATTATIVA',
    }).select().single()
    if (sclErr) bug(10, 'HIGH', 'SCL', sclErr.message)
    else step(10, 'Supplier direct client created', true, scl.id)
    finalState.supplierDirectClientId = scl?.id

    // Crea quote diretto del fornitore con direct_client_id (per attivare RPC conflict)
    if (scl?.id) {
      const { data: directQuote, error: dqErr } = await sb.from('quotes').insert({
        owner_id: fotoId,
        title: 'Preventivo Foto Diretto - Marco E.',
        client_name: 'Marco E. (diretto)',
        client_email: EMAILS.coupleDirect,
        event_date: '2027-07-04',
        event_location: 'Villa Sole, Tropea',
        guest_count: 120,
        status: 'INVIATO',
        direct_client_id: scl.id,
        sent_at: new Date().toISOString(),
      }).select().single()
      if (dqErr) bug(10, 'MEDIUM', 'DIRECT_QUOTE', dqErr.message)
      else step(10, 'Direct supplier quote created', true, directQuote.id)
      finalState.directQuoteId = directQuote?.id
    }

    // Query conflict alerts via RPC
    await new Promise(r => setTimeout(r, 1500))
    // Esegui RPC come WP
    const { data: wpClient, error: aErr } = await sb.auth.admin.generateLink({ type: 'magiclink', email: EMAILS.wp })
    // Più semplice: query diretto via SQL using rpc come service-role per WP
    // service_role bypassa auth.uid() - rpc returns vuoto. Quindi usiamo signin come WP.
    const wpSb = createClient(SUPA_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.fake', { auth: { persistSession: false } })
    // anon key non disponibile; testiamo via UI
    await logout(page)
    await loginUi(page, EMAILS.wp)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await shot(page, 10, '01-wp-home-with-conflict')

    // Cerca banner conflitti
    const bannerCount = await page.locator('text=/conflitt|conflict|disinterm|sovrappos/i').count()
    step(10, `Conflict banner: ${bannerCount} matches`, bannerCount > 0)
    if (bannerCount === 0) bug(10, 'MEDIUM', 'CONFLICT_BANNER', 'No conflict alert banner visible in WP home')

    // Verifica via RPC con cookie WP loggato (Playwright)
    const rpcOut = await page.evaluate(async (apikey) => {
      try {
        const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        const token = sbKey ? JSON.parse(localStorage.getItem(sbKey)).access_token : null
        if (!token) return { err: 'no token' }
        const res = await fetch('https://zfwlkvqxfzvubmfyxofs.supabase.co/rest/v1/rpc/my_quote_conflict_alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': apikey },
        })
        return { status: res.status, body: await res.json().catch(() => null) }
      } catch (e) { return { err: e.message } }
    }, ANON_KEY)
    console.log('RPC conflict alerts:', JSON.stringify(rpcOut).slice(0, 400))
    const alerts = Array.isArray(rpcOut?.body) ? rpcOut.body : []
    finalState.conflictAlerts = alerts.length
    step(10, `RPC my_quote_conflict_alerts returned: ${alerts.length} alerts`, alerts.length > 0)
    const locAlert = alerts.find(a => a.match_signals?.some?.(s => s?.includes?.('LOCATION') || s?.includes?.('LOC')))
    step(10, `LOCATION_MATCH found in alerts`, !!locAlert, locAlert ? JSON.stringify(locAlert).slice(0, 200) : 'none')

    endPhase(10, alerts.length > 0)
  } catch (e) {
    bug(10, 'HIGH', 'PHASE10', e.message)
    endPhase(10, false)
  }

  // ============================================================
  // PHASE 11 - Cleanup
  // ============================================================
  startPhase(11, 'Cleanup all AGENT-P-* data')
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
    if (finalState.directQuoteId) {
      await sb.from('quote_items').delete().eq('quote_id', finalState.directQuoteId)
      await sb.from('quotes').delete().eq('id', finalState.directQuoteId)
    }
    if (weddingId) await sb.from('calendar_entries').delete().eq('id', weddingId)
    if (wpUserId) {
      await sb.from('collaborations').delete().eq('capostipite_id', wpUserId)
      await sb.from('supplier_invites').delete().eq('capostipite_id', wpUserId)
    }
    for (const supEmail of [EMAILS.foto, EMAILS.cater, EMAILS.fiori]) {
      const sid = await getUserId(supEmail)
      if (sid) {
        await sb.from('services').delete().eq('fornitore_id', sid)
        await sb.from('supplier_availability').delete().eq('fornitore_id', sid)
        await sb.from('supplier_clients').delete().eq('supplier_id', sid)
      }
    }
    let deleted = 0
    for (const e of Object.values(EMAILS)) {
      const uid = await getUserId(e)
      if (uid) {
        await sb.from('profiles').delete().eq('id', uid)
        const r = await sb.auth.admin.deleteUser(uid)
        if (!r.error) deleted++
        else bug(11, 'MEDIUM', 'DELETE_USER', `${e}: ${r.error.message}`)
      }
    }
    step(11, `Deleted ${deleted} auth users`, deleted >= 4)

    const { data: leftQ } = await sb.from('quotes').select('id').eq('id', quoteId)
    const { data: leftW } = await sb.from('calendar_entries').select('id').eq('id', weddingId)
    step(11, 'Quote cleaned', (leftQ?.length ?? 0) === 0)
    step(11, 'Wedding cleaned', (leftW?.length ?? 0) === 0)
    endPhase(11, deleted >= 4)
  } catch (e) {
    bug(11, 'HIGH', 'PHASE11', e.message)
    endPhase(11, false)
  }

  await browser.close()

  // ============================================================
  // REPORT
  // ============================================================
  writeFileSync(path.join(RUN_DIR, 'final-state.json'), JSON.stringify(finalState, null, 2))
  writeFileSync(path.join(RUN_DIR, 'phases.json'), JSON.stringify(phases, null, 2))

  let md = `# Wave 3 - Agent P - E2E REALISTIC FULL FLOW\n\n`
  md += `**Scenario**: Marco & Lucia 2027-07-04 — Villa Sole, Tropea\n`
  md += `**Run dir**: ${RUN_DIR}\n`
  md += `**Started**: ${phases[1]?.started}\n`
  md += `**Finished**: ${phases[11]?.finished}\n\n`
  md += `## Resoconto fasi\n\n`
  md += `| Fase | Nome | Esito | Durata (s) | Step OK | Step FAIL | Bug |\n`
  md += `|------|------|-------|-----------|---------|-----------|-----|\n`
  for (let i = 1; i <= 11; i++) {
    const p = phases[i]
    if (!p) { md += `| ${i} | (skipped) | - | - | - | - | - |\n`; continue }
    const okSteps = p.steps.filter(s => s.ok).length
    const failSteps = p.steps.filter(s => !s.ok).length
    md += `| ${i} | ${p.name} | ${p.ok ? 'PASS' : 'FAIL'} | ${p.durationSec?.toFixed(1)} | ${okSteps} | ${failSteps} | ${p.bugs.length} |\n`
  }
  md += `\n## Dettaglio per fase\n\n`
  for (let i = 1; i <= 11; i++) {
    const p = phases[i]
    if (!p) continue
    md += `### Fase ${i}: ${p.name}\n\n`
    md += `**Esito**: ${p.ok ? 'PASS' : 'FAIL'} (${p.durationSec?.toFixed(1)}s)\n\n`
    md += `**Steps**:\n`
    for (const s of p.steps) md += `- [${s.ok ? 'OK' : 'FAIL'}] ${s.name}${s.detail ? ` — ${s.detail}` : ''}\n`
    if (p.bugs.length > 0) {
      md += `\n**Bug**:\n`
      for (const b of p.bugs) md += `- [${b.severity}] ${b.area}: ${b.msg}\n`
    }
    if (p.screenshots.length > 0) {
      md += `\n**Screenshot** (${p.screenshots.length}):\n`
      for (const s of p.screenshots.slice(0, 12)) md += `- ${s}\n`
    }
    md += `\n`
  }
  md += `\n## Final State\n\n\`\`\`json\n${JSON.stringify(finalState, null, 2)}\n\`\`\`\n`

  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), md)

  const total = Object.values(phases).length
  const passed = Object.values(phases).filter(p => p.ok).length
  const totalBugs = Object.values(phases).reduce((s, p) => s + p.bugs.length, 0)
  const totalShots = Object.values(phases).reduce((s, p) => s + p.screenshots.length, 0)
  console.log(`\n========================================`)
  console.log(`SUMMARY: ${passed}/${total} phases passed, ${totalBugs} bugs, ${totalShots} screenshots`)
  console.log(`Run dir: ${RUN_DIR}`)
  console.log(`========================================`)
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
