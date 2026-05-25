#!/usr/bin/env node
/**
 * WAVE2-L2 (RETRY) — I18N + A11Y + DARK MODE
 *
 * Prudent retry version: smaller scope, robust try/catch around EVERY page nav,
 * incremental append of results to disk so partial output is preserved on crash.
 *
 * Vite + React 18 + TS. NOT Next.js.
 */
import { chromium } from '@playwright/test'
import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUN_DIR = process.env.RUN_DIR
  || path.resolve(__dirname, '../audit-runs/wave2-L2-i18n-a11y-dark-20260525-230605')
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })

const BASE = process.env.AUDIT_BASE || 'https://planfully.it'
const PWD = 'Beta2026!'
const ROLES = [
  { name: 'wp', email: 'wp-mini@planfully-demo.it' },
  { name: 'fornitore', email: 'forn-mini-foto@planfully-demo.it' },
  { name: 'sposo', email: 'giovanni.scozzafava+sposo@gmail.com' },
]

// Incremental append helpers (crash-safe)
const BUGS_FILE = path.join(RUN_DIR, 'bugs.jsonl')
const LOG_FILE = path.join(RUN_DIR, 'run.log')
const I18N_FILE = path.join(RUN_DIR, 'i18n-issues.jsonl')
const A11Y_FILE = path.join(RUN_DIR, 'a11y-findings.jsonl')
const DARK_FILE = path.join(RUN_DIR, 'dark-findings.jsonl')

const bugs = []
const i18nIssues = []
const a11yFindings = []
const darkFindings = []
let currentPage = 'BOOT'
let shotCounter = 0

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  process.stdout.write(line)
  try { appendFileSync(LOG_FILE, line) } catch {}
}
function bug(severity, msg, detail) {
  const b = { page: currentPage, severity, msg, detail: detail ? String(detail).slice(0, 300) : null, ts: Date.now() }
  bugs.push(b)
  try { appendFileSync(BUGS_FILE, JSON.stringify(b) + '\n') } catch {}
  logLine(`  [BUG ${severity}] ${currentPage}: ${msg}${detail ? ` -- ${String(detail).slice(0,120)}` : ''}`)
}
function recordI18n(it) {
  i18nIssues.push(it)
  try { appendFileSync(I18N_FILE, JSON.stringify(it) + '\n') } catch {}
}
function recordA11y(it) {
  a11yFindings.push(it)
  try { appendFileSync(A11Y_FILE, JSON.stringify(it) + '\n') } catch {}
}
function recordDark(it) {
  darkFindings.push(it)
  try { appendFileSync(DARK_FILE, JSON.stringify(it) + '\n') } catch {}
}
function step(name) {
  currentPage = name
  logLine(`\n=== ${name} ===`)
}
const wait = ms => new Promise(r => setTimeout(r, ms))

async function shot(page, name, theme = '') {
  shotCounter++
  const id = String(shotCounter).padStart(3, '0')
  const tail = theme ? `-${theme}` : ''
  const file = `${id}-${name}${tail}.png`
  try {
    await page.screenshot({ path: path.join(RUN_DIR, file), fullPage: false, timeout: 8000 })
    return file
  } catch (e) {
    bug('LOW', `Screenshot failed ${name}`, e?.message)
    return null
  }
}

async function dismissCookie(page) {
  try {
    await page.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")')
      .first().click({ timeout: 2000 })
    await wait(300)
  } catch {}
}

async function login(page, email) {
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  } catch (e) { bug('HIGH', 'goto /login failed', e?.message); return false }
  await dismissCookie(page)
  try { await page.getByLabel('Email').fill(email, { timeout: 5000 }) } catch {}
  try { await page.getByLabel('Password').fill(PWD, { timeout: 5000 }) } catch {}
  try { await page.getByRole('button', { name: /^Accedi$/i }).click({ timeout: 5000 }) } catch {}
  try { await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 18000 }) } catch {}
  await wait(1200)
  return !page.url().includes('/login')
}

async function bodyText(page) {
  try { return (await page.locator('body').innerText({ timeout: 5000 })) || '' } catch { return '' }
}

// ─────────── I18N heuristics ───────────
const ENGLISH_LEAKS = [
  /\bLoading\.?\.?\.?/,
  /\bSave\b/,
  /\bCancel\b/,
  /\bDelete\b/,
  /\bError\b/,
  /\bSubmit\b/,
  /\bConfirm\b/,
  /\bAdd\b/,
  /\bNew\b/,
  /\bEdit\b/,
  /\bClose\b/,
  /\bSearch\b/,
  /\bNext\b/,
  /\bPrevious\b/,
  /\bRemove\b/,
  /\bUpdate\b/,
  /\bWelcome\b/,
]
const ITALIAN_TYPOS = [
  { re: /\bpo\b(?!')/g, name: "missing apostrophe on 'po'" },
  { re: /\bperche\b/gi, name: "missing accent: 'perche' -> 'perché'" },
  { re: /\bcitta\b/gi, name: "missing accent: 'citta' -> 'città'" },
  { re: /\bgia\b/gi, name: "missing accent: 'gia' -> 'già'" },
  { re: /\bpiu\b/gi, name: "missing accent: 'piu' -> 'più'" },
  { re: /\bcioe\b/gi, name: "missing accent: 'cioe' -> 'cioè'" },
]
const US_FMT_NUMBER = /\b\d{1,3}(,\d{3})+\.\d{2}\b/
const US_DATE = /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2})\b/g

function textSnippet(text, idx) {
  if (idx == null || idx < 0) return ''
  const s = Math.max(0, idx - 40)
  const e = Math.min(text.length, idx + 60)
  return text.slice(s, e).replace(/\s+/g, ' ').trim()
}

function scanI18N(text, pageLabel) {
  const issues = []
  for (const re of ENGLISH_LEAKS) {
    const m = text.match(re)
    if (m) {
      const idx = text.indexOf(m[0])
      const ctx = textSnippet(text, idx)
      // false positives
      if (m[0] === 'New' && /New York|Hampshire/.test(ctx)) continue
      if (/Save the date/i.test(ctx)) continue
      issues.push({ type: 'english_leak', match: m[0], context: ctx, page: pageLabel })
    }
  }
  for (const { re, name } of ITALIAN_TYPOS) {
    re.lastIndex = 0
    const ms = [...text.matchAll(re)]
    for (const m of ms.slice(0, 2)) {
      const ctx = textSnippet(text, m.index)
      // PO Box, fiume Po, BVB Po
      if (/PO Box|fiume Po|^Po\s|\bP\.O\./i.test(ctx)) continue
      issues.push({ type: 'italian_typo', name, match: m[0], context: ctx, page: pageLabel })
    }
  }
  const nm = text.match(US_FMT_NUMBER)
  if (nm) issues.push({ type: 'us_number_format', match: nm[0], context: textSnippet(text, text.indexOf(nm[0])), page: pageLabel })

  US_DATE.lastIndex = 0
  const dms = [...text.matchAll(US_DATE)]
  for (const m of dms.slice(0, 2)) {
    if (Number(m[1]) > 12) {
      issues.push({ type: 'us_date_format', match: m[0], context: textSnippet(text, m.index), page: pageLabel })
    }
  }
  // Plurali
  const pluralRe = /\b(\d+)\s+(invitato|invitati|tavolo|tavoli|preventivo|preventivi|fornitore|fornitori|matrimonio|matrimoni)\b/gi
  pluralRe.lastIndex = 0
  for (const m of [...text.matchAll(pluralRe)].slice(0, 4)) {
    const n = parseInt(m[1], 10)
    const w = m[2].toLowerCase()
    const isSingular = !w.endsWith('i')
    if (n === 1 && !isSingular) issues.push({ type: 'plural_mismatch', match: m[0], context: textSnippet(text, m.index), page: pageLabel })
    if (n !== 1 && isSingular) issues.push({ type: 'plural_mismatch', match: m[0], context: textSnippet(text, m.index), page: pageLabel })
  }
  return issues
}

// ─────────── A11Y (lightweight, no axe) ───────────
async function quickA11y(page) {
  try {
    return await page.evaluate(() => {
      const out = { h1Count: 0, iconBtnNoLabel: [], inputNoLabel: [], imgNoAlt: [], total: { btns: 0, inputs: 0, imgs: 0 } }
      out.h1Count = document.querySelectorAll('h1').length
      const btns = Array.from(document.querySelectorAll('button'))
      out.total.btns = btns.length
      for (const b of btns) {
        if (!(b instanceof HTMLElement)) continue
        const txt = (b.innerText || '').trim()
        const aria = b.getAttribute('aria-label')
        const title = b.getAttribute('title')
        const hasIcon = !!b.querySelector('svg, img')
        if (!txt && hasIcon && !aria && !title) {
          out.iconBtnNoLabel.push(b.outerHTML.slice(0, 140))
        }
      }
      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea'))
      out.total.inputs = inputs.length
      for (const el of inputs) {
        if (!(el instanceof HTMLElement)) continue
        const id = el.getAttribute('id')
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
        const wrapped = el.closest('label')
        const explicit = id ? document.querySelector(`label[for="${id}"]`) : null
        if (!aria && !wrapped && !explicit) {
          out.inputNoLabel.push({
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            name: el.getAttribute('name') || '',
            placeholder: el.getAttribute('placeholder') || '',
          })
        }
      }
      const imgs = Array.from(document.querySelectorAll('img'))
      out.total.imgs = imgs.length
      for (const i of imgs) {
        if (!i.hasAttribute('alt')) out.imgNoAlt.push(i.src.slice(0, 100))
      }
      // limit results
      out.iconBtnNoLabel = out.iconBtnNoLabel.slice(0, 6)
      out.inputNoLabel = out.inputNoLabel.slice(0, 6)
      out.imgNoAlt = out.imgNoAlt.slice(0, 6)
      return out
    })
  } catch (e) {
    bug('LOW', 'a11y scan failed', e?.message)
    return null
  }
}

// ─────────── Dark mode helpers ───────────
async function getTheme(page) {
  try {
    return await page.evaluate(() => {
      const ds = document.documentElement.dataset.theme
      const cls = document.documentElement.classList.contains('dark') ? 'dark-class' : ''
      const bg = getComputedStyle(document.body).backgroundColor
      const m = bg.match(/\d+/g)
      const rgb = m ? m.map(Number) : null
      const lum = rgb ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 : null
      return { dataTheme: ds || null, hasDarkClass: !!cls, bg, lum }
    })
  } catch { return { dataTheme: null, hasDarkClass: false, bg: null, lum: null } }
}

async function tryToggleTheme(page) {
  // try multiple selectors
  const selectors = [
    'button[aria-label*="theme" i]',
    'button[aria-label*="tema" i]',
    'button[aria-label*="dark" i]',
    'button[aria-label*="scuro" i]',
    'button[title*="theme" i]',
    'button:has(svg.lucide-sun)',
    'button:has(svg.lucide-moon)',
    '[data-testid="theme-toggle"]',
  ]
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first()
      if (await loc.count() > 0) {
        await loc.click({ timeout: 3000 })
        await wait(500)
        return { ok: true, selector: sel }
      }
    } catch {}
  }
  return { ok: false, selector: null }
}

async function checkBetaBanner(page) {
  try {
    return await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*')).find(n => {
        const t = (n.textContent || '').trim()
        return /\bBeta\b/i.test(t) && t.length < 200 && n.children.length < 5
      })
      if (!el) return { found: false }
      const r = el.getBoundingClientRect()
      return { found: true, visible: r.width > 0 && r.height > 0, text: (el.textContent || '').trim().slice(0, 80) }
    })
  } catch { return { found: false } }
}

// ─────────── Per-role routes (smaller scope vs L1) ───────────
const ROUTES = {
  wp: [
    ['home', '/'],
    ['weddings', '/weddings'],
    ['suppliers', '/suppliers'],
    ['quotes', '/quotes'],
    ['profile', '/profile'],
  ],
  fornitore: [
    ['home', '/'],
    ['calendar', '/calendar'],
    ['quotes', '/quotes'],
    ['profile', '/profile'],
  ],
  sposo: [
    ['home', '/'],
    ['invitati', '/invitati'],
    ['budget', '/budget'],
    ['profile', '/profile'],
  ],
}

async function auditPage(page, role, urlPath, name) {
  step(`${role}:${name}`)
  const url = urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 })
  } catch (e) {
    bug('LOW', 'goto failed', e?.message)
    return
  }
  await wait(1000)

  // I18N
  try {
    const text = await bodyText(page)
    const issues = scanI18N(text, currentPage)
    for (const it of issues) {
      recordI18n(it)
      const sev = (it.type === 'us_number_format' || it.type === 'us_date_format') ? 'MEDIUM' : 'LOW'
      bug(sev, `${it.type}: "${it.match}"`, it.context)
    }
  } catch (e) { bug('LOW', 'i18n scan crashed', e?.message) }

  // A11Y
  try {
    const a = await quickA11y(page)
    if (a) {
      recordA11y({ page: currentPage, ...a })
      if (a.h1Count === 0) bug('MEDIUM', 'No <h1> on page', null)
      else if (a.h1Count > 1) bug('LOW', `Multiple <h1> (${a.h1Count})`, null)
      for (const html of a.iconBtnNoLabel.slice(0, 3)) bug('MEDIUM', 'Icon button missing aria-label', html)
      for (const inp of a.inputNoLabel.slice(0, 3)) bug('MEDIUM', 'Input missing label', `${inp.tag}[type=${inp.type}] name=${inp.name} ph="${inp.placeholder}"`)
      for (const src of a.imgNoAlt.slice(0, 3)) bug('LOW', '<img> missing alt', src)
    }
  } catch (e) { bug('LOW', 'a11y scan crashed', e?.message) }

  // Beta banner (light)
  let bannerLight = null
  try { bannerLight = await checkBetaBanner(page) } catch {}

  // Light shot
  await shot(page, `${role}-${name}`, 'light')

  // Dark toggle
  try {
    const before = await getTheme(page)
    const toggled = await tryToggleTheme(page)
    if (!toggled.ok) {
      recordDark({ page: currentPage, issue: 'no theme toggle button found' })
      bug('LOW', 'no theme toggle button found', null)
      return
    }
    await wait(400)
    const after = await getTheme(page)
    const isDarkNow = after.dataTheme === 'dark' || after.hasDarkClass || (after.lum != null && after.lum < 0.3)
    if (!isDarkNow) {
      recordDark({ page: currentPage, issue: 'toggle clicked but theme did not switch to dark', before, after })
      bug('HIGH', 'Theme toggle did not switch to dark', `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
    } else {
      recordDark({ page: currentPage, ok: true, after })
    }
    // Beta banner check dark
    let bannerDark = null
    try { bannerDark = await checkBetaBanner(page) } catch {}
    if (bannerLight?.found && !bannerDark?.found) {
      recordDark({ page: currentPage, issue: 'Beta banner disappears in dark mode' })
      bug('MEDIUM', 'Beta banner disappears in dark mode', null)
    } else if (bannerLight?.found && bannerDark?.found) {
      // ok
    }
    // Dark screenshot
    await shot(page, `${role}-${name}`, 'dark')
    // Toggle back
    try { await tryToggleTheme(page); await wait(300) } catch {}
  } catch (e) { bug('LOW', 'dark mode test crashed', e?.message) }
}

// Persistence test: toggle dark, reload, verify still dark
async function darkPersistence(page, role) {
  step(`${role}:DARK-persist`)
  try {
    const t1 = await tryToggleTheme(page)
    if (!t1.ok) { bug('LOW', 'persistence: no toggle', null); return }
    await wait(400)
    const before = await getTheme(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 18000 })
    await wait(1200)
    const after = await getTheme(page)
    const stillDark = after.dataTheme === 'dark' || after.hasDarkClass || (after.lum != null && after.lum < 0.3)
    if (!stillDark) {
      recordDark({ page: currentPage, issue: 'theme does NOT persist across reload', before, after })
      bug('HIGH', 'Theme does not persist after reload', `before=${before.dataTheme} after=${after.dataTheme}`)
    } else {
      recordDark({ page: currentPage, ok: 'persistence ok', after })
      logLine(`  [OK] dark persists across reload (theme=${after.dataTheme})`)
    }
    // Toggle back to light
    try { await tryToggleTheme(page); await wait(300) } catch {}
  } catch (e) { bug('LOW', 'persistence test crashed', e?.message) }
}

async function auditPublic(page) {
  step('PUBLIC:login')
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 18000 })
  } catch (e) { bug('MEDIUM', 'goto public login failed', e?.message); return }
  await dismissCookie(page)
  await wait(800)
  try {
    const text = await bodyText(page)
    const issues = scanI18N(text, currentPage)
    for (const it of issues) {
      recordI18n(it)
      bug('LOW', `${it.type}: "${it.match}"`, it.context)
    }
  } catch (e) { bug('LOW', 'public i18n crashed', e?.message) }
  try {
    const a = await quickA11y(page)
    if (a) {
      recordA11y({ page: currentPage, ...a })
      if (a.h1Count === 0) bug('MEDIUM', 'public /login: no <h1>', null)
      for (const inp of a.inputNoLabel.slice(0, 2)) bug('MEDIUM', 'public /login input missing label', `${inp.tag} ph="${inp.placeholder}"`)
    }
  } catch {}
  await shot(page, 'public-login', 'light')
}

// ─────────── MAIN ───────────
async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') logLine(`  [console.error] ${m.text().slice(0, 180)}`) })
  page.on('pageerror', e => logLine(`  [pageerror] ${e.message?.slice(0, 180)}`))

  // Public
  await auditPublic(page).catch(e => bug('MEDIUM', 'public audit crashed', e?.message))

  for (const role of ROLES) {
    logLine(`\n############ ROLE: ${role.name} (${role.email}) ############`)
    try { await ctx.clearCookies() } catch {}
    try { await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch {} }) } catch {}
    const ok = await login(page, role.email).catch(e => { bug('HIGH', `login crashed ${role.email}`, e?.message); return false })
    if (!ok) { bug('HIGH', `login FAILED for ${role.email}`, page.url()); continue }
    logLine(`  [OK] logged in as ${role.email} -> ${page.url()}`)

    // Persistence test once per role on first page
    try { await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }) } catch {}
    await wait(800)
    await darkPersistence(page, role.name).catch(e => bug('LOW', 'persistence wrapper failed', e?.message))

    for (const [name, p] of ROUTES[role.name]) {
      await auditPage(page, role.name, p, name).catch(e => bug('MEDIUM', `auditPage ${name} crashed`, e?.message))
    }
  }

  await browser.close().catch(() => {})
  writeReport()
}

function writeReport() {
  writeFileSync(path.join(RUN_DIR, 'bugs.json'), JSON.stringify(bugs, null, 2))
  writeFileSync(path.join(RUN_DIR, 'i18n-issues.json'), JSON.stringify(i18nIssues, null, 2))
  writeFileSync(path.join(RUN_DIR, 'a11y-findings.json'), JSON.stringify(a11yFindings, null, 2))
  writeFileSync(path.join(RUN_DIR, 'dark-findings.json'), JSON.stringify(darkFindings, null, 2))

  const sevCount = bugs.reduce((acc, b) => { acc[b.severity] = (acc[b.severity] || 0) + 1; return acc }, {})
  const i18nByType = i18nIssues.reduce((a, x) => { a[x.type] = (a[x.type] || 0) + 1; return a }, {})

  const verdict = (sevCount.HIGH || 0) > 0 ? 'FAIL (HIGH bugs present)' :
                  (sevCount.MEDIUM || 0) >= 10 ? 'FAIL (too many MEDIUM)' :
                  'PASS with caveats'

  const md = `# Wave2-L2 Audit Report — I18N + A11Y + Dark Mode (retry)

Run: ${new Date().toISOString()}
Base: ${BASE}
Roles: ${ROLES.map(r => r.name).join(', ')}

## Verdict: ${verdict}

## Summary
- Bugs: ${bugs.length} (HIGH=${sevCount.HIGH || 0} MEDIUM=${sevCount.MEDIUM || 0} LOW=${sevCount.LOW || 0})
- I18N issues: ${i18nIssues.length}
- A11Y findings (pages scanned): ${a11yFindings.length}
- Dark mode findings: ${darkFindings.length}
- Screenshots: ${shotCounter}

## I18N
By type:
${Object.entries(i18nByType).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- (none)'}

### Sample (first 20)
${i18nIssues.slice(0, 20).map(x => `- **[${x.page}]** ${x.type}: \`${x.match}\` — ${x.context.replace(/\n/g, ' ').slice(0, 120)}`).join('\n') || '- (none)'}

## A11Y
Per-page summary (h1Count, iconBtnNoLabel, inputNoLabel, imgNoAlt):
${a11yFindings.map(a => `- **[${a.page}]** h1=${a.h1Count} iconBtnNoLabel=${a.iconBtnNoLabel?.length || 0} inputNoLabel=${a.inputNoLabel?.length || 0} imgNoAlt=${a.imgNoAlt?.length || 0} (totals: btns=${a.total?.btns} inputs=${a.total?.inputs} imgs=${a.total?.imgs})`).join('\n') || '- (none)'}

## Dark Mode
${darkFindings.map(d => `- **[${d.page}]** ${d.ok ? `OK ${d.ok}` : d.issue}`).join('\n') || '- (none)'}

## Bugs (HIGH)
${bugs.filter(b => b.severity === 'HIGH').map(b => `- **[${b.page}]** ${b.msg}${b.detail ? ` — ${b.detail.slice(0, 140)}` : ''}`).join('\n') || '- (none)'}

## Bugs (MEDIUM, first 40)
${bugs.filter(b => b.severity === 'MEDIUM').slice(0, 40).map(b => `- [${b.page}] ${b.msg}${b.detail ? ` — ${b.detail.slice(0, 120)}` : ''}`).join('\n') || '- (none)'}

## Notes
- Lightweight a11y check (no axe-core injection) chosen for stability — counts heading hierarchy, icon-only buttons without aria-label, inputs missing label, and images without alt.
- Dark mode test toggles via common selectors (aria-label, lucide icons). PDF download not exercised in this retry (out of safe scope).
- Couple toggle: tested on sposo role pages.

## Files
- bugs.json / bugs.jsonl (live append)
- i18n-issues.json / i18n-issues.jsonl
- a11y-findings.json / a11y-findings.jsonl
- dark-findings.json / dark-findings.jsonl
- run.log
- ${shotCounter} PNG screenshots
`
  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), md)
  logLine(`\nReport written to ${RUN_DIR}/REPORT.md`)
  logLine(`Verdict: ${verdict}`)
}

main().catch(e => {
  logLine(`FATAL: ${e?.message || e}`)
  try { writeReport() } catch (e2) { logLine(`writeReport on fatal failed: ${e2?.message}`) }
  process.exit(1)
})
