#!/usr/bin/env node
/**
 * Wave 4 - Agent S - PUBLIC PAGES DEEP AUDIT
 *
 * Test esaustivo pagine PUBLIC (senza auth) e flussi via token:
 *  /login /register /forgot-password /reset-password /privacy /cookie
 *  /w/:slug (giovanni-e-pingu)
 *  /p/preview/:token /p/accept/:token /p/reject/:token /p/contract/:token
 *  /invito-coppia/:token /invito-fornitore/:token
 *
 * Screenshot desktop + mobile per ogni pagina. Bug tracking per severità.
 */
import { chromium, devices } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const BASE = 'https://planfully.it'
const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'

const RUN_DIR = process.env.RUN_DIR || '/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave4-S-public-pages-20260526-002332'
mkdirSync(RUN_DIR, { recursive: true })

const TS = String(Date.now()).slice(-7)
const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

const TEST_EMAIL_PREFIX = `agent-s-${TS}`
const TEST_PWD = 'Beta2026!'

// Tokens noti (verificati a 00:24)
const SLUG_OK = 'giovanni-e-pingu'
const SLUG_FAKE = `agent-s-fake-${TS}`
const QUOTE_INVIATO_TOKEN = 'a20d139a-6507-4511-8c94-3af9843272bb' // c18cd9c5 Gino e Maria
const QUOTE_ACCEPTED_TOKEN = '6bd5a692-35d3-4b13-8f16-231d992c3c9d' // 189bb466 AGENT-Q
const CONTRACT_SIGNED_TOKEN = '0a46ca52-f5e5-4339-9fc9-b58e93ce2fad'
const FAKE_TOKEN = '00000000-0000-0000-0000-000000000000'

const bugs = []
const report = {}

function bug(severity, page, area, msg) {
  bugs.push({ severity, page, area, msg, ts: new Date().toISOString() })
  console.log(`  [BUG ${severity}] ${page} > ${area}: ${msg}`)
}
function ok(page, msg) {
  console.log(`  [OK] ${page}: ${msg}`)
}
function info(page, msg) {
  console.log(`  [INFO] ${page}: ${msg}`)
}

async function shot(page, name) {
  const fn = `${name}.png`
  try {
    await page.screenshot({ path: path.join(RUN_DIR, fn), fullPage: false, timeout: 6000 })
    return fn
  } catch (e) {
    console.log(`  [shot fail] ${fn}: ${e.message}`)
    return null
  }
}

async function dismissCookie(page) {
  for (const txt of ['Solo essenziali', 'Accetta tutto', 'Accetta', 'Capito']) {
    await page.locator(`button:has-text("${txt}")`).first().click({ timeout: 800 }).catch(() => {})
  }
  await page.waitForTimeout(200)
}

async function testLogin(ctx) {
  const P = 'login'
  report[P] = { steps: [], errors: 0 }
  console.log(`\n========== /login ==========`)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await dismissCookie(page)
    await page.waitForTimeout(800)
    await shot(page, 'login-01-initial')

    // Verifica presenza campi
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const pwdInput = page.locator('input[type="password"]').first()
    const submitBtn = page.locator('button[type="submit"], button:has-text("Accedi"), button:has-text("Entra")').first()

    const hasEmail = await emailInput.isVisible().catch(() => false)
    const hasPwd = await pwdInput.isVisible().catch(() => false)
    const hasSubmit = await submitBtn.isVisible().catch(() => false)
    if (!hasEmail) bug('HIGH', P, 'form', 'Campo email non visibile')
    if (!hasPwd) bug('HIGH', P, 'form', 'Campo password non visibile')
    if (!hasSubmit) bug('HIGH', P, 'form', 'Bottone submit non visibile')
    ok(P, `form fields: email=${hasEmail} pwd=${hasPwd} submit=${hasSubmit}`)

    // Bottone Google
    const googleBtn = page.locator('button:has-text("Google"), button:has-text("google")').first()
    const hasGoogle = await googleBtn.isVisible().catch(() => false)
    if (!hasGoogle) bug('MEDIUM', P, 'oauth', 'Bottone Google OAuth non trovato')
    else ok(P, 'Google OAuth bottone presente')

    // Link forgot-password
    const forgotLink = page.locator('a:has-text("Password dimenticata"), a:has-text("password dimenticata"), a:has-text("Recupera")').first()
    const hasForgot = await forgotLink.isVisible().catch(() => false)
    if (!hasForgot) bug('MEDIUM', P, 'links', 'Link Password dimenticata non trovato')
    else ok(P, 'Link forgot-password presente')

    // Link register
    const regLink = page.locator('a:has-text("Registrati"), a:has-text("Crea")').first()
    const hasReg = await regLink.isVisible().catch(() => false)
    if (!hasReg) bug('MEDIUM', P, 'links', 'Link Registrati non trovato')

    // Test 1: password vuota
    if (hasEmail && hasPwd && hasSubmit) {
      await emailInput.fill('agent-s-empty@test.it')
      await pwdInput.fill('')
      await submitBtn.click()
      await page.waitForTimeout(700)
      const errVisible = (await page.locator('.text-red-500, [role="alert"], .text-destructive').count()) > 0 ||
        await pwdInput.evaluate((el) => !el.validity.valid).catch(() => false)
      if (!errVisible) bug('MEDIUM', P, 'validation', 'Password vuota non genera errore evidente')
      else ok(P, 'Password vuota: errore mostrato')
      await shot(page, 'login-02-empty-pwd')
    }

    // Test 2: email invalida (no @)
    if (hasEmail && hasPwd) {
      await emailInput.fill('nonemail')
      await pwdInput.fill('something')
      await submitBtn.click()
      await page.waitForTimeout(600)
      const invalidEmail = await emailInput.evaluate((el) => !el.validity.valid).catch(() => true)
      if (!invalidEmail) bug('LOW', P, 'validation', 'Email senza @ non genera validation HTML5')
      await shot(page, 'login-03-invalid-email')
    }

    // Test 3: credentials sbagliate
    if (hasEmail && hasPwd) {
      await emailInput.fill(`agent-s-noexist-${TS}@example.com`)
      await pwdInput.fill('WrongPass123!')
      await submitBtn.click()
      await page.waitForTimeout(2500)
      const errMsg = await page.locator('text=/credenziali|invalid|email.*password|errato/i').first().textContent({ timeout: 1500 }).catch(() => null)
      if (errMsg) ok(P, `Errore credentials: "${errMsg.slice(0, 80)}"`)
      else bug('HIGH', P, 'validation', 'Credentials sbagliate: nessun messaggio errore visibile')
      await shot(page, 'login-04-wrong-cred')
    }

    // a11y: tab order
    const ariaLabelsCount = await page.locator('[aria-label]').count()
    info(P, `aria-label count=${ariaLabelsCount}`)
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testRegister(ctx) {
  const P = 'register'
  console.log(`\n========== /register ==========`)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await dismissCookie(page)
    await page.waitForTimeout(800)
    await shot(page, 'register-01-initial')

    // Cerca role selector
    const roleSel = page.locator('select, [role="combobox"], input[type="radio"]').first()
    const hasRole = await roleSel.count() > 0
    if (!hasRole) bug('MEDIUM', P, 'form', 'Role selector non trovato')
    else ok(P, 'Role selector presente')

    // Form base
    const emailInput = page.locator('input[type="email"]').first()
    const pwdInput = page.locator('input[type="password"]').first()
    const submitBtn = page.locator('button[type="submit"]').first()
    const hasE = await emailInput.isVisible().catch(() => false)
    const hasP = await pwdInput.isVisible().catch(() => false)
    if (!hasE || !hasP) bug('HIGH', P, 'form', `Form incompleto: email=${hasE} pwd=${hasP}`)

    // Test password troppo corta
    if (hasE && hasP) {
      await emailInput.fill(`${TEST_EMAIL_PREFIX}-shortpwd@example.com`)
      await pwdInput.fill('abc')
      // Riempi altri campi richiesti se ci sono
      const allInputs = page.locator('input:visible')
      const cnt = await allInputs.count()
      for (let i = 0; i < cnt; i++) {
        const inp = allInputs.nth(i)
        const t = await inp.getAttribute('type').catch(() => null)
        const v = await inp.inputValue().catch(() => '')
        if (!v && t && !['email', 'password', 'checkbox', 'radio', 'hidden', 'submit'].includes(t)) {
          await inp.fill('AGENT-S-Test').catch(() => {})
        }
      }
      await submitBtn.click().catch(() => {})
      await page.waitForTimeout(1500)
      const errVisible = await page.locator('text=/8 caratteri|almeno|too short|short/i').count() > 0
      if (!errVisible) bug('MEDIUM', P, 'validation', 'Password corta: nessun messaggio specifico (<8)')
      else ok(P, 'Password corta: errore mostrato')
      await shot(page, 'register-02-short-pwd')
    }
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testForgot(ctx) {
  const P = 'forgot-password'
  console.log(`\n========== /forgot-password ==========`)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await dismissCookie(page)
    await page.waitForTimeout(800)
    await shot(page, 'forgot-01-initial')

    const emailInput = page.locator('input[type="email"]').first()
    const submitBtn = page.locator('button[type="submit"]').first()
    const hasE = await emailInput.isVisible().catch(() => false)
    const hasS = await submitBtn.isVisible().catch(() => false)
    if (!hasE || !hasS) bug('HIGH', P, 'form', `Form incompleto: email=${hasE} submit=${hasS}`)

    if (hasE && hasS) {
      await emailInput.fill(`agent-s-noexist-${TS}@example.com`)
      await submitBtn.click()
      await page.waitForTimeout(2500)
      const toast = await page.locator('text=/inviata|email|controlla|ricevuto/i').first().textContent({ timeout: 2000 }).catch(() => null)
      const errorToast = await page.locator('text=/errore|smtp|550|failed/i').first().textContent({ timeout: 1500 }).catch(() => null)
      if (errorToast) bug('HIGH', P, 'smtp', `Errore SMTP visibile: "${errorToast.slice(0, 80)}"`)
      else if (toast) ok(P, `Toast conferma: "${toast.slice(0, 80)}"`)
      else bug('MEDIUM', P, 'feedback', 'Nessun feedback visibile dopo submit')
      await shot(page, 'forgot-02-submitted')
    }
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testResetPassword(ctx) {
  const P = 'reset-password'
  console.log(`\n========== /reset-password ==========`)
  const page = await ctx.newPage()
  try {
    // No token
    await page.goto(`${BASE}/reset-password`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await dismissCookie(page)
    await page.waitForTimeout(800)
    await shot(page, 'reset-01-no-token')
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 600)
    if (/crash|undefined.*reading|TypeError/i.test(bodyText)) bug('CRITICAL', P, 'page', 'Crash su reset senza token')
    else ok(P, 'Senza token: pagina renderizza grace')

    // Token invalido
    await page.goto(`${BASE}/reset-password#access_token=fake&type=recovery`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    await shot(page, 'reset-02-invalid-token')
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testPrivacyCookie(ctx) {
  for (const route of ['privacy', 'cookie']) {
    console.log(`\n========== /${route} ==========`)
    const page = await ctx.newPage()
    try {
      await page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await dismissCookie(page)
      await page.waitForTimeout(700)
      await shot(page, `${route}-01-initial`)
      const h1Count = await page.locator('h1').count()
      if (h1Count !== 1) bug('LOW', route, 'a11y', `h1 count=${h1Count} (atteso 1)`)
      const textLen = (await page.locator('body').innerText().catch(() => '')).length
      if (textLen < 400) bug('MEDIUM', route, 'content', `Contenuto sottile (${textLen} chars)`)
      else ok(route, `${textLen} chars contenuto`)
    } catch (e) {
      bug('CRITICAL', route, 'page', `Crash: ${e.message.slice(0, 200)}`)
    } finally {
      await page.close()
    }
  }
}

async function testWeddingSite(ctx) {
  const P = 'w-slug'
  console.log(`\n========== /w/${SLUG_OK} ==========`)
  let rsvpResult = null
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/w/${SLUG_OK}`, { waitUntil: 'domcontentloaded', timeout: 40000 })
    await dismissCookie(page)
    await page.waitForTimeout(2000)
    await shot(page, 'w-01-hero')

    const hasHero = await page.locator('h1, [role="heading"]').first().isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasHero) bug('HIGH', P, 'render', 'Hero/H1 non visibile')

    // Cerca countdown / data
    const txt = (await page.locator('body').innerText().catch(() => '')).slice(0, 1500)
    if (txt.length < 500) bug('HIGH', P, 'content', `Contenuto sottile (${txt.length} chars)`)
    else ok(P, `${txt.length}+ chars contenuto`)

    // Scroll per altre sezioni
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1500)
    await shot(page, 'w-02-bottom')

    // Test RSVP submit via RPC (più affidabile)
    info(P, 'Test RSVP via RPC...')
    const { data: rsvp, error } = await sb.rpc('wedding_site_rsvp', {
      p_slug: SLUG_OK,
      p_guest_name: `AGENT-S-Mario Rossi ${TS}`,
      p_email: `agent-s-rsvp-${TS}@example.com`,
      p_phone: '+393331234567',
      p_attending: true,
      p_plus_ones: 2,
      p_notes: 'Allergia celiaco',
    })
    if (error) bug('HIGH', P, 'rsvp', `RPC errore: ${error.message}`)
    else { ok(P, `RSVP RPC ok: ${JSON.stringify(rsvp).slice(0, 100)}`); rsvpResult = rsvp }

    // Resubmit idempotency
    const { data: rsvp2, error: err2 } = await sb.rpc('wedding_site_rsvp', {
      p_slug: SLUG_OK,
      p_guest_name: `AGENT-S-Mario Rossi ${TS}`,
      p_email: `agent-s-rsvp-${TS}@example.com`,
      p_phone: '+393331234567',
      p_attending: true,
      p_plus_ones: 3,
      p_notes: 'Update note',
    })
    if (err2) info(P, `Resubmit blocked: ${err2.message}`)
    else info(P, `Resubmit accepted (upsert?): ${JSON.stringify(rsvp2).slice(0, 80)}`)

    // OG meta
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null)
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content').catch(() => null)
    const ogImg = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => null)
    if (!ogTitle) bug('MEDIUM', P, 'seo', 'meta og:title mancante')
    if (!ogDesc) bug('LOW', P, 'seo', 'meta og:description mancante')
    if (!ogImg) bug('LOW', P, 'seo', 'meta og:image mancante')
    info(P, `OG: title=${!!ogTitle} desc=${!!ogDesc} img=${!!ogImg}`)

    // RLS leak check: anon non vede preventivi/contratti dei sposi
    const sbAnon = createClient(SUPA_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64', { auth: { persistSession: false } })
    const { data: qLeak } = await sbAnon.from('quotes').select('id,title,total_client').limit(5)
    const { data: cLeak } = await sbAnon.from('contracts').select('id,status').limit(5)
    const { data: cpLeak } = await sbAnon.from('couple_preferences').select('id,bride_name,groom_name,budget_min,budget_max').limit(5)
    const qLeakCount = qLeak?.length ?? 0
    const cLeakCount = cLeak?.length ?? 0
    const cpLeakCount = cpLeak?.length ?? 0
    if (qLeakCount > 0) bug('CRITICAL', P, 'rls', `RLS leak: anon vede ${qLeakCount} quotes!`)
    if (cLeakCount > 0) bug('CRITICAL', P, 'rls', `RLS leak: anon vede ${cLeakCount} contracts!`)
    if (cpLeakCount > 0) bug('HIGH', P, 'rls', `RLS leak: anon vede ${cpLeakCount} couple_preferences!`)
    if (qLeakCount === 0 && cLeakCount === 0 && cpLeakCount === 0) ok(P, 'RLS sealed: anon non vede quotes/contracts/preferences')

    // Slug inesistente
    await page.goto(`${BASE}/w/${SLUG_FAKE}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    await shot(page, 'w-03-fake-slug')
    const fakeText = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/404|non trovato|not found|sito non/i.test(fakeText)) ok(P, 'Slug fake: grace 404')
    else if (/crash|undefined.*reading|TypeError/i.test(fakeText)) bug('CRITICAL', P, 'page', 'Crash su slug fake')
    else bug('LOW', P, 'ux', 'Slug fake: nessun messaggio 404 chiaro')
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
  return rsvpResult
}

async function testQuotePreview(ctx) {
  const P = 'p-preview'
  console.log(`\n========== /p/preview/:token ==========`)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/p/preview/${QUOTE_INVIATO_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await shot(page, 'preview-01-valid')
    const txt = await page.locator('body').innerText().catch(() => '')
    if (txt.length < 200) bug('HIGH', P, 'render', `Pagina sottile (${txt.length} chars)`)
    else ok(P, `Preventivo renderizzato (${txt.length} chars)`)
    const hasEditBtn = await page.locator('button:has-text("Modifica"), button:has-text("Edit")').count() > 0
    if (hasEditBtn) bug('MEDIUM', P, 'security', 'Bottone Modifica visibile in preview pubblica!')

    // Token invalido
    await page.goto(`${BASE}/p/preview/${FAKE_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await shot(page, 'preview-02-invalid')
    const errText = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/non disponibile|scaduto|errato|non trovato|404/i.test(errText)) ok(P, 'Token invalido: messaggio grace')
    else if (/crash|TypeError/i.test(errText)) bug('CRITICAL', P, 'page', 'Crash su token invalido')
    else bug('MEDIUM', P, 'ux', 'Token invalido: nessun messaggio chiaro')
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testQuoteAccept(ctx) {
  const P = 'p-accept'
  console.log(`\n========== /p/accept/:token ==========`)
  const page = await ctx.newPage()
  try {
    // Token già accettato
    await page.goto(`${BASE}/p/accept/${QUOTE_ACCEPTED_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await shot(page, 'accept-01-already')
    const txt = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/già accett|already|firmato|completato/i.test(txt)) ok(P, 'Token già accettato: gestito')
    else if (/crash|TypeError/i.test(txt)) bug('CRITICAL', P, 'page', 'Crash su quote ACCETTATO')
    else bug('MEDIUM', P, 'ux', 'Quote ACCETTATO: nessun messaggio chiaro 409')

    // Token invalido
    await page.goto(`${BASE}/p/accept/${FAKE_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    await shot(page, 'accept-02-invalid')
    const txt2 = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/crash|TypeError/i.test(txt2)) bug('CRITICAL', P, 'page', 'Crash su token invalido')

    // Token valido INVIATO
    await page.goto(`${BASE}/p/accept/${QUOTE_INVIATO_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2500)
    await shot(page, 'accept-03-valid-step1')
    // Cerca canvas di firma o multi-step
    const hasCanvas = await page.locator('canvas').count() > 0
    const stepIndicator = await page.locator('text=/step|passo|1.*4|2.*4/i').first().textContent({ timeout: 1500 }).catch(() => null)
    info(P, `canvas=${hasCanvas} stepIndicator="${stepIndicator?.slice(0, 60)}"`)

    // Verifica colori canvas se presente
    if (hasCanvas) {
      const canvasBg = await page.locator('canvas').first().evaluate((el) => {
        const ctx = el.getContext('2d')
        if (!ctx) return null
        const d = ctx.getImageData(5, 5, 1, 1).data
        return `rgba(${d[0]},${d[1]},${d[2]},${d[3]})`
      }).catch(() => null)
      info(P, `canvas bg pixel: ${canvasBg}`)
    }
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testQuoteReject(ctx) {
  const P = 'p-reject'
  console.log(`\n========== /p/reject/:token ==========`)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/p/reject/${FAKE_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await shot(page, 'reject-01-invalid')
    const txt = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/crash|TypeError/i.test(txt)) bug('CRITICAL', P, 'page', 'Crash su token invalido')

    await page.goto(`${BASE}/p/reject/${QUOTE_INVIATO_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await shot(page, 'reject-02-valid')
    const hasTextarea = await page.locator('textarea').count() > 0
    if (!hasTextarea) bug('MEDIUM', P, 'form', 'Textarea motivo rifiuto non trovata')
    else ok(P, 'Textarea motivo presente')
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testContractSign(ctx) {
  const P = 'p-contract'
  console.log(`\n========== /p/contract/:token ==========`)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/p/contract/${CONTRACT_SIGNED_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2500)
    await shot(page, 'contract-01-signed')
    const txt = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/crash|TypeError/i.test(txt)) bug('CRITICAL', P, 'page', 'Crash su contract FIRMATO')
    if (/firmato|signed|completato/i.test(txt)) ok(P, 'Contract FIRMATO: gestito')

    await page.goto(`${BASE}/p/contract/${FAKE_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    await shot(page, 'contract-02-invalid')
    const txt2 = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/crash|TypeError/i.test(txt2)) bug('CRITICAL', P, 'page', 'Crash su token contract invalido')
    else if (/non disponibile|scaduto|errato|404/i.test(txt2)) ok(P, 'Token invalido: grace')
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testInvitoCoppia(ctx) {
  const P = 'invito-coppia'
  console.log(`\n========== /invito-coppia/:token ==========`)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/invito-coppia/${FAKE_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await shot(page, 'invito-coppia-01-fake')
    const txt = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/crash|TypeError/i.test(txt)) bug('CRITICAL', P, 'page', 'Crash su token fake')
    else if (/scaduto|invalido|non valido|non trovato|errato/i.test(txt)) ok(P, 'Token fake: grace message')
    else bug('LOW', P, 'ux', 'Token fake: nessun messaggio specifico')
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testInvitoFornitore(ctx) {
  const P = 'invito-fornitore'
  console.log(`\n========== /invito-fornitore/:token ==========`)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/invito-fornitore/${FAKE_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await shot(page, 'invito-fornitore-01-fake')
    const txt = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    if (/crash|TypeError/i.test(txt)) bug('CRITICAL', P, 'page', 'Crash su token fake')
    else if (/scaduto|invalido|non valido|non trovato|errato/i.test(txt)) ok(P, 'Token fake: grace message')
    else bug('LOW', P, 'ux', 'Token fake: nessun messaggio specifico')
  } catch (e) {
    bug('CRITICAL', P, 'page', `Crash: ${e.message.slice(0, 200)}`)
  } finally {
    await page.close()
  }
}

async function testMobile(browser) {
  console.log(`\n========== MOBILE iPhone ==========`)
  const ctx = await browser.newContext({ ...devices['iPhone 14'] })
  const page = await ctx.newPage()
  try {
    const routes = [
      ['login', '/login'],
      ['register', '/register'],
      ['forgot', '/forgot-password'],
      ['privacy', '/privacy'],
      ['cookie', '/cookie'],
      ['w-slug', `/w/${SLUG_OK}`],
      ['preview', `/p/preview/${QUOTE_INVIATO_TOKEN}`],
      ['accept', `/p/accept/${QUOTE_INVIATO_TOKEN}`],
      ['reject', `/p/reject/${QUOTE_INVIATO_TOKEN}`],
      ['contract', `/p/contract/${CONTRACT_SIGNED_TOKEN}`],
      ['invito-coppia', `/invito-coppia/${FAKE_TOKEN}`],
      ['invito-fornitore', `/invito-fornitore/${FAKE_TOKEN}`],
    ]
    for (const [name, route] of routes) {
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
        await dismissCookie(page)
        await page.waitForTimeout(1500)
        await shot(page, `mobile-${name}`)
        // Check horizontal overflow
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4)
        if (overflow) bug('MEDIUM', `mobile-${name}`, 'responsive', 'Overflow orizzontale rilevato')
      } catch (e) {
        bug('HIGH', `mobile-${name}`, 'render', `Errore: ${e.message.slice(0, 120)}`)
      }
    }
  } finally {
    await page.close()
    await ctx.close()
  }
}

async function cleanup() {
  console.log(`\n========== CLEANUP ==========`)
  try {
    const { data: rsvps, error: e1 } = await sb.from('wedding_site_rsvps').select('id,guest_name').ilike('guest_name', 'AGENT-S-%')
    if (rsvps?.length) {
      const ids = rsvps.map(r => r.id)
      await sb.from('wedding_site_rsvps').delete().in('id', ids)
      console.log(`  Cleaned ${ids.length} AGENT-S RSVPs`)
    }
  } catch (e) {
    console.log(`  Cleanup wedding_site_rsvps: ${e.message}`)
  }
  // Auth users cleanup
  try {
    const { data: { users }, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (users) {
      const targets = users.filter(u => u.email?.startsWith('agent-s-'))
      for (const u of targets) {
        await sb.auth.admin.deleteUser(u.id).catch(() => {})
      }
      console.log(`  Cleaned ${targets.length} agent-s-* auth users`)
    }
  } catch (e) {
    console.log(`  Cleanup users: ${e.message}`)
  }
}

async function main() {
  console.log(`Wave 4 - Agent S - Public pages deep audit`)
  console.log(`Base: ${BASE}`)
  console.log(`Out: ${RUN_DIR}`)

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  await testLogin(ctx)
  await testRegister(ctx)
  await testForgot(ctx)
  await testResetPassword(ctx)
  await testPrivacyCookie(ctx)
  await testWeddingSite(ctx)
  await testQuotePreview(ctx)
  await testQuoteAccept(ctx)
  await testQuoteReject(ctx)
  await testContractSign(ctx)
  await testInvitoCoppia(ctx)
  await testInvitoFornitore(ctx)

  await ctx.close()
  await testMobile(browser)
  await browser.close()

  await cleanup()

  // Report
  writeFileSync(path.join(RUN_DIR, 'bugs.json'), JSON.stringify(bugs, null, 2))
  const sevCount = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const b of bugs) sevCount[b.severity] = (sevCount[b.severity] || 0) + 1

  const md = [
    `# Wave 4 - Agent S - Public Pages Deep Audit`,
    ``,
    `**Run**: ${RUN_DIR}`,
    `**Base**: ${BASE}`,
    `**Date**: ${new Date().toISOString()}`,
    ``,
    `## Sommario bug`,
    ``,
    `- CRITICAL: ${sevCount.CRITICAL}`,
    `- HIGH: ${sevCount.HIGH}`,
    `- MEDIUM: ${sevCount.MEDIUM}`,
    `- LOW: ${sevCount.LOW}`,
    `- **TOT**: ${bugs.length}`,
    ``,
    `## Bug details`,
    ``,
    ...bugs.map((b, i) => `${i + 1}. **[${b.severity}]** \`${b.page}\` > ${b.area}: ${b.msg}`),
    ``,
    `## Pagine testate`,
    ``,
    `- /login`,
    `- /register`,
    `- /forgot-password`,
    `- /reset-password`,
    `- /privacy`,
    `- /cookie`,
    `- /w/${SLUG_OK}`,
    `- /p/preview/:token (valid + invalid)`,
    `- /p/accept/:token (valid + invalid + already-accepted)`,
    `- /p/reject/:token (valid + invalid)`,
    `- /p/contract/:token (signed + invalid)`,
    `- /invito-coppia/:token (fake)`,
    `- /invito-fornitore/:token (fake)`,
    `- + tutte le pagine in viewport iPhone 14`,
    ``,
    `## Token usati`,
    ``,
    `- Quote INVIATO: ${QUOTE_INVIATO_TOKEN}`,
    `- Quote ACCETTATO: ${QUOTE_ACCEPTED_TOKEN}`,
    `- Contract FIRMATO: ${CONTRACT_SIGNED_TOKEN}`,
    `- Slug pubblico: ${SLUG_OK}`,
  ].join('\n')
  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), md)
  console.log(`\n[DONE] Bugs=${bugs.length} (C=${sevCount.CRITICAL} H=${sevCount.HIGH} M=${sevCount.MEDIUM} L=${sevCount.LOW})`)
  console.log(`Report: ${path.join(RUN_DIR, 'REPORT.md')}`)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
