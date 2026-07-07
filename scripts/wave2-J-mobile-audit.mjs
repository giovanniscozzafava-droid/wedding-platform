#!/usr/bin/env node
/**
 * WAVE2-J MOBILE AUDIT — Test responsive su 3 viewport (iPhone 13, iPad Mini, Desktop)
 * Per ogni viewport: WP / Fornitore / Sposi su pagine critiche.
 * Output: audit-runs/wave2-J-mobile-<ts>/{REPORT.md, bug-list.json, *.png}
 */
import { chromium, devices } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = process.env.RUN_DIR
  || path.resolve(__dirname, `../audit-runs/wave2-J-mobile-${TS}`)
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })

const BASE = process.env.AUDIT_BASE || 'https://planfully.it'
const PWD = 'Beta2026!'
const WP_EMAIL = 'wp-mini@planfully-demo.it'
const FORN_EMAIL = 'forn-mini-foto@planfully-demo.it'
const SPOSI_EMAIL = 'giovanni.scozzafava+sposo@gmail.com'

const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SUPA_SK = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const sb = createClient(SUPA_URL, SUPA_SK, { auth: { persistSession: false } })

const VIEWPORTS = [
  {
    key: 'mobile',
    label: 'iPhone 13 (375x812)',
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  },
  {
    key: 'tablet',
    label: 'iPad Mini (768x1024)',
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  },
  {
    key: 'desktop',
    label: 'Desktop 1280x720',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
]

const bugs = []
const passes = []
let currentViewport = 'BOOT'
let currentRole = 'BOOT'
let currentPage = 'BOOT'
const shotCounters = { mobile: 0, tablet: 0, desktop: 0 }

function bug(severity, msg, detail) {
  const b = {
    viewport: currentViewport,
    role: currentRole,
    page: currentPage,
    severity,
    msg,
    detail: detail ? String(detail).slice(0, 400) : null,
    ts: Date.now(),
  }
  bugs.push(b)
  console.log(`  BUG [${severity}] ${currentViewport}/${currentRole}/${currentPage}: ${msg}${detail ? ' — ' + b.detail.slice(0, 120) : ''}`)
}
function pass(msg) {
  passes.push({ viewport: currentViewport, role: currentRole, page: currentPage, msg })
  console.log(`  OK ${currentViewport}/${currentRole}/${currentPage}: ${msg}`)
}
function step(vp, role, page) {
  currentViewport = vp
  currentRole = role
  currentPage = page
  console.log(`\n--- ${vp} / ${role} / ${page} ---`)
}
async function shot(page, name) {
  shotCounters[currentViewport] = (shotCounters[currentViewport] || 0) + 1
  const id = String(shotCounters[currentViewport]).padStart(2, '0')
  const file = `${currentViewport}-${id}-${currentRole}-${name}.png`
  try {
    await page.screenshot({ path: path.join(RUN_DIR, file), fullPage: false })
  } catch (e) {
    bug('LOW', `Screenshot failed for ${name}`, e?.message)
  }
}
const wait = ms => new Promise(r => setTimeout(r, ms))

async function dismissCookie(page) {
  await page.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")').first().click({ timeout: 2000 }).catch(() => {})
  await wait(300)
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {})
  await dismissCookie(page)
  await page.getByLabel('Email').fill(email).catch(() => {})
  await page.getByLabel('Password').fill(PWD).catch(() => {})
  await page.getByRole('button', { name: /^Accedi$/i }).click().catch(() => {})
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await wait(1500)
}

async function bodyText(page) {
  try { return (await page.locator('body').innerText()) || '' } catch { return '' }
}

// Detect horizontal scroll/overflow
async function checkOverflow(page) {
  try {
    return await page.evaluate(() => {
      const html = document.documentElement
      const body = document.body
      const hasHScroll = html.scrollWidth > html.clientWidth + 4 || body.scrollWidth > body.clientWidth + 4
      return {
        hasHScroll,
        htmlScrollW: html.scrollWidth,
        htmlClientW: html.clientWidth,
        winInnerW: window.innerWidth,
      }
    })
  } catch {
    return { hasHScroll: false }
  }
}

// Look for mobile hamburger / sidebar trigger
async function checkMobileNav(page) {
  const triggers = await page.locator(
    'button[aria-label*="enu" i], button[aria-label*="avig" i], button:has(svg[class*="enu" i]), [data-mobile-menu], [aria-label*="apri" i]'
  ).count()
  return triggers
}

async function detectKnownIssues(page) {
  const vp = page.viewportSize()
  const isNarrow = vp && vp.width <= 500

  // 1. horizontal overflow
  const ov = await checkOverflow(page)
  if (ov.hasHScroll) {
    bug('HIGH', `Horizontal overflow su ${currentPage} (scrollW=${ov.htmlScrollW} > clientW=${ov.htmlClientW})`)
  }

  // 2. footer/banner coverage
  if (isNarrow) {
    const cookieBanner = await page.locator('[role="dialog"]:has-text("ookie"), [class*="cookie" i]').count()
    if (cookieBanner > 0) {
      const bb = await page.locator('[role="dialog"]:has-text("ookie"), [class*="cookie" i]').first().boundingBox().catch(() => null)
      if (bb && bb.width > vp.width) bug('MEDIUM', `Cookie banner più largo del viewport (${bb.width}>${vp.width})`)
    }
  }

  // 3. mobile nav presence on narrow
  if (isNarrow) {
    const triggers = await checkMobileNav(page)
    if (triggers === 0) {
      // Could be intentional on guest pages; just info-level
      const isPublic = /\/login|\/register|\/w\/|\/p\//.test(page.url())
      if (!isPublic) bug('MEDIUM', `Nessun trigger menu mobile visibile su ${currentPage}`)
    }
  }
}

// ─── Page flows per role ─────────────────────────────────────────────────────
async function flowWP(page, vp) {
  const role = 'wp'
  currentRole = role
  currentViewport = vp

  step(vp, role, 'login')
  await login(page, WP_EMAIL)
  if (page.url().includes('/login')) {
    bug('CRITICAL', 'Login WP fallito')
    await shot(page, 'login-failed')
    return
  }
  await shot(page, 'after-login')

  step(vp, role, 'home')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'home')
  await detectKnownIssues(page)
  // try hamburger on narrow
  if (vp === 'mobile') {
    const trig = page.locator('button[aria-label*="enu" i], button:has(svg[class*="enu" i])').first()
    if (await trig.count() > 0) {
      await trig.click().catch(() => {})
      await wait(600)
      await shot(page, 'home-drawer-open')
      // try close
      const closeBtn = page.locator('button[aria-label*="hiud" i], button[aria-label*="lose" i], button:has(svg[class*="x" i])').first()
      if (await closeBtn.count() > 0) {
        await closeBtn.click().catch(() => {})
        await wait(400)
        pass('Drawer aperto e chiuso')
      } else {
        bug('MEDIUM', 'Drawer aperto ma close X non trovato')
      }
    } else {
      bug('HIGH', 'Hamburger trigger non trovato su /')
    }
  }

  step(vp, role, 'weddings')
  await page.goto(`${BASE}/weddings`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'weddings-list')
  await detectKnownIssues(page)
  const wCnt = await page.locator('a[href^="/weddings/"]').count()
  if (wCnt === 0) bug('HIGH', 'Lista matrimoni vuota')

  if (wCnt > 0) {
    step(vp, role, 'wedding-detail')
    await page.locator('a[href^="/weddings/"]').first().click().catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await wait(1800)
    await shot(page, 'wedding-detail')
    await detectKnownIssues(page)
    // tab strip overflow check
    const tabStrip = page.locator('[role="tablist"], nav[class*="tab" i], div[class*="tab" i]').first()
    if (await tabStrip.count() > 0) {
      const tabsBox = await tabStrip.boundingBox().catch(() => null)
      const viewportW = page.viewportSize()?.width || 0
      if (tabsBox && tabsBox.width > viewportW + 8 && vp === 'mobile') {
        bug('MEDIUM', `Tab strip overflow: width=${Math.round(tabsBox.width)} > viewport=${viewportW}`)
      }
    }
    // open invitati tab to see table
    const invTab = page.locator('button:has-text("Invitati")').first()
    if (await invTab.count() > 0) {
      await invTab.click().catch(() => {})
      await wait(1200)
      await shot(page, 'wed-tab-invitati')
      await detectKnownIssues(page)
    }
    const tavTab = page.locator('button:has-text("Tavoli")').first()
    if (await tavTab.count() > 0) {
      await tavTab.click().catch(() => {})
      await wait(1200)
      await shot(page, 'wed-tab-tavoli')
      await detectKnownIssues(page)
    }
  }

  step(vp, role, 'quotes')
  await page.goto(`${BASE}/quotes`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'quotes-list')
  await detectKnownIssues(page)
  const qCnt = await page.locator('a[href^="/quotes/"]').count()
  if (qCnt > 0) {
    step(vp, role, 'quote-editor')
    await page.locator('a[href^="/quotes/"]').first().click().catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await wait(1600)
    await shot(page, 'quote-editor')
    await detectKnownIssues(page)
  }

  step(vp, role, 'contracts')
  await page.goto(`${BASE}/contracts`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'contracts')
  await detectKnownIssues(page)

  step(vp, role, 'brand')
  await page.goto(`${BASE}/settings/brand`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'brand')
  await detectKnownIssues(page)
}

async function flowForn(page, vp) {
  const role = 'forn'
  currentRole = role
  currentViewport = vp

  step(vp, role, 'login')
  await login(page, FORN_EMAIL)
  if (page.url().includes('/login')) {
    bug('CRITICAL', 'Login Fornitore fallito')
    await shot(page, 'login-failed')
    return
  }
  await shot(page, 'after-login')

  step(vp, role, 'home')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'home')
  await detectKnownIssues(page)

  step(vp, role, 'clienti')
  await page.goto(`${BASE}/clienti`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'clienti')
  await detectKnownIssues(page)

  step(vp, role, 'disponibilita')
  await page.goto(`${BASE}/disponibilita`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1500)
  await shot(page, 'disponibilita')
  await detectKnownIssues(page)
  // calendar specific: cells should fit
  const calCells = await page.locator('[role="gridcell"], td, [class*="day" i]').count()
  if (vp === 'mobile' && calCells > 0) {
    const firstCell = await page.locator('[role="gridcell"], td').first().boundingBox().catch(() => null)
    if (firstCell && firstCell.width < 20) bug('MEDIUM', `Celle calendario troppo strette su mobile (w=${firstCell.width})`)
  }

  step(vp, role, 'calcolatore')
  await page.goto(`${BASE}/calcolatore`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'calcolatore')
  await detectKnownIssues(page)

  step(vp, role, 'catalog')
  await page.goto(`${BASE}/catalog`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1200)
  await shot(page, 'catalog')
  await detectKnownIssues(page)
}

async function flowSposi(page, vp) {
  const role = 'sposi'
  currentRole = role
  currentViewport = vp

  step(vp, role, 'login')
  await login(page, SPOSI_EMAIL)
  if (page.url().includes('/login')) {
    bug('CRITICAL', 'Login Sposi fallito')
    await shot(page, 'login-failed')
    return
  }
  await shot(page, 'after-login')

  step(vp, role, 'couple-overview')
  await page.goto(`${BASE}/couple`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1500)
  await shot(page, 'couple-overview')
  await detectKnownIssues(page)

  // probe couple tabs
  const tabs = [
    { label: 'Documenti', key: 'documenti' },
    { label: 'Programma', key: 'programma' },
    { label: 'Invitati', key: 'invitati' },
    { label: 'Tavoli', key: 'tavoli' },
    { label: 'Mood', key: 'mood' },
    { label: 'Playlist', key: 'playlist' },
    { label: 'Sito', key: 'sito' },
  ]
  for (const t of tabs) {
    step(vp, role, `couple-${t.key}`)
    const btn = page.locator(`button:has-text("${t.label}"), a:has-text("${t.label}")`).first()
    if (await btn.count() > 0) {
      await btn.click().catch(() => {})
      await wait(1200)
      await shot(page, `couple-${t.key}`)
      await detectKnownIssues(page)
    } else {
      bug('LOW', `Tab "${t.label}" non trovata in /couple`)
    }
  }
}

async function flowPublic(context, vp) {
  const role = 'public'
  currentRole = role
  currentViewport = vp
  const page = await context.newPage()

  step(vp, role, 'login-page')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1000)
  await dismissCookie(page)
  await shot(page, 'login')
  await detectKnownIssues(page)
  // email autocomplete attr
  const emailInput = page.locator('input[type="email"], input[name*="email" i]').first()
  if (await emailInput.count() > 0) {
    const ac = await emailInput.getAttribute('autocomplete').catch(() => null)
    if (!ac || (!/email|username/.test(ac))) bug('LOW', `Input email senza autocomplete="email" (got ${ac})`)
  }

  step(vp, role, 'register-page')
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(1000)
  await shot(page, 'register')
  await detectKnownIssues(page)

  step(vp, role, 'wedding-site')
  await page.goto(`${BASE}/w/giovanni-e-pingu`, { waitUntil: 'networkidle' }).catch(() => {})
  await wait(2000)
  await shot(page, 'wedding-site')
  await detectKnownIssues(page)

  // p/accept token — find a real quote token to test
  step(vp, role, 'quote-accept')
  try {
    const { data: q } = await sb.from('quotes').select('id, accept_token').not('accept_token', 'is', null).limit(1).maybeSingle()
    if (q?.accept_token) {
      await page.goto(`${BASE}/p/accept/${q.accept_token}`, { waitUntil: 'networkidle' }).catch(() => {})
      await wait(2000)
      await shot(page, 'quote-accept')
      await detectKnownIssues(page)
      // canvas/signature presence
      const canvas = await page.locator('canvas').count()
      if (canvas === 0) bug('MEDIUM', 'Pagina p/accept senza canvas firma')
      else if (vp === 'mobile') {
        const cbox = await page.locator('canvas').first().boundingBox().catch(() => null)
        if (cbox && cbox.width < 250) bug('MEDIUM', `Canvas firma troppo stretto su mobile (w=${cbox.width})`)
        else pass(`Canvas firma w=${cbox?.width}`)
      }
    } else {
      bug('LOW', 'Nessun quote con accept_token in DB per testare /p/accept')
    }
  } catch (e) {
    bug('LOW', 'Errore fetch quote per /p/accept', e?.message)
  }

  await page.close()
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== WAVE2-J MOBILE AUDIT ===\nBase: ${BASE}\nRUN_DIR: ${RUN_DIR}\n`)

  const browser = await chromium.launch({ headless: true })

  for (const vp of VIEWPORTS) {
    console.log(`\n############### VIEWPORT: ${vp.label} ###############`)
    currentViewport = vp.key

    // Each role in fresh context (so cookies/sessions don't leak)
    const roles = [
      { name: 'wp', fn: flowWP },
      { name: 'forn', fn: flowForn },
      { name: 'sposi', fn: flowSposi },
    ]
    for (const r of roles) {
      const ctx = await browser.newContext({
        viewport: vp.viewport,
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        userAgent: vp.userAgent,
        locale: 'it-IT',
      })
      const page = await ctx.newPage()
      const localErrors = []
      page.on('pageerror', e => localErrors.push({ type: 'pageerror', msg: e.message, page: currentPage, role: currentRole, viewport: currentViewport }))
      page.on('console', m => {
        if (m.type() === 'error') {
          const t = m.text()
          if (/Failed to load resource|net::ERR_|favicon|Manifest|sw\.js/i.test(t)) return
          localErrors.push({ type: 'console.error', msg: t.slice(0, 250), page: currentPage, role: currentRole, viewport: currentViewport })
        }
      })
      try {
        await r.fn(page, vp.key)
      } catch (e) {
        bug('CRITICAL', `Crash flow ${r.name}`, e?.message)
      }
      // capture js errors
      for (const ce of localErrors) {
        bugs.push({
          viewport: ce.viewport,
          role: ce.role,
          page: ce.page,
          severity: ce.type === 'pageerror' ? 'HIGH' : 'MEDIUM',
          msg: `JS ${ce.type}: ${ce.msg}`,
          ts: Date.now(),
        })
      }
      await ctx.close()
    }

    // public flow (own context per viewport)
    const pubCtx = await browser.newContext({
      viewport: vp.viewport,
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      userAgent: vp.userAgent,
      locale: 'it-IT',
    })
    try {
      await flowPublic(pubCtx, vp.key)
    } catch (e) {
      bug('CRITICAL', 'Crash flow public', e?.message)
    }
    await pubCtx.close()
  }

  await browser.close()

  // Cleanup AGENT-J-% if any created (this audit is read-mostly but be safe)
  await cleanupAgentJ()

  finalize()
}

async function cleanupAgentJ() {
  console.log('\n--- CLEANUP AGENT-J-% ---')
  try {
    const { data: wedds } = await sb.from('calendar_entries').select('id').ilike('title', 'AGENT-J%')
    if (wedds?.length) {
      const ids = wedds.map(w => w.id)
      await sb.from('event_timeline').delete().in('entry_id', ids).catch(() => {})
      await sb.from('guests').delete().in('entry_id', ids).catch(() => {})
      await sb.from('tables').delete().in('entry_id', ids).catch(() => {})
      await sb.from('calendar_entries').delete().in('id', ids)
      console.log(`  Cleaned ${ids.length} AGENT-J weddings`)
    }
    const { data: svcs } = await sb.from('services').select('id').ilike('name', 'AGENT-J%')
    if (svcs?.length) {
      await sb.from('services').delete().in('id', svcs.map(s => s.id))
      console.log(`  Cleaned ${svcs.length} AGENT-J services`)
    }
  } catch (e) {
    console.log(`  Cleanup error: ${e?.message ?? e}`)
  }
}

function finalize() {
  const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  bugs.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9))

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  const byViewport = { mobile: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }, tablet: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }, desktop: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } }
  for (const b of bugs) {
    counts[b.severity] = (counts[b.severity] || 0) + 1
    if (byViewport[b.viewport]) byViewport[b.viewport][b.severity] = (byViewport[b.viewport][b.severity] || 0) + 1
  }

  const results = {
    runId: path.basename(RUN_DIR),
    base: BASE,
    timestamp: new Date().toISOString(),
    totals: { pass: passes.length, bug: bugs.length, ...counts },
    byViewport,
    bugs,
  }
  writeFileSync(path.join(RUN_DIR, 'bug-list.json'), JSON.stringify(results, null, 2))

  // REPORT.md
  const lines = []
  lines.push(`# Wave2-J Mobile Audit — ${results.timestamp}`)
  lines.push('')
  lines.push(`**Base**: ${BASE}`)
  lines.push('')
  lines.push(`**Pass**: ${passes.length}  ·  **Bug**: ${bugs.length}`)
  lines.push(`- CRITICAL: ${counts.CRITICAL}`)
  lines.push(`- HIGH: ${counts.HIGH}`)
  lines.push(`- MEDIUM: ${counts.MEDIUM}`)
  lines.push(`- LOW: ${counts.LOW}`)
  lines.push('')
  lines.push('## Per viewport')
  for (const [v, c] of Object.entries(byViewport)) {
    lines.push(`- **${v}**: CRIT=${c.CRITICAL} HIGH=${c.HIGH} MEDIUM=${c.MEDIUM} LOW=${c.LOW}`)
  }
  lines.push('')
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const list = bugs.filter(b => b.severity === sev)
    if (!list.length) continue
    lines.push(`## ${sev} (${list.length})`)
    for (const b of list) {
      lines.push(`- **[${b.viewport}/${b.role}/${b.page}]** ${b.msg}${b.detail ? ` — ${b.detail}` : ''}`)
    }
    lines.push('')
  }
  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), lines.join('\n'))

  console.log(`\n=== DONE ===`)
  console.log(`Run dir: ${RUN_DIR}`)
  console.log(`Pass: ${passes.length}  Bug: ${bugs.length}  (C=${counts.CRITICAL} H=${counts.HIGH} M=${counts.MEDIUM} L=${counts.LOW})`)
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
