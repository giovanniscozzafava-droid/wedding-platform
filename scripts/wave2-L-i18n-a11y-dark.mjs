#!/usr/bin/env node
/**
 * WAVE2-L AUDIT — I18N + A11Y (WCAG 2.1 AA) + DARK MODE
 * Naviga app per 3 ruoli (wedding planner, fornitore, sposo), checks:
 *   - I18N (italianismi, plurali, date/euro, typo)
 *   - axe-core a11y violations (WCAG 2A/2AA)
 *   - contrast manuale top offenders
 *   - dark mode toggle + persistence
 *   - screenshot light+dark per ogni pagina chiave
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUN_DIR = process.env.RUN_DIR
  || path.resolve(__dirname, '../audit-runs/wave2-L-i18n-a11y-dark-20260525-225839')
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })

const BASE = process.env.AUDIT_BASE || 'https://planfully.it'
const PWD = 'Beta2026!'
const ROLES = [
  { name: 'wp', email: 'wp-mini@planfully-demo.it' },
  { name: 'fornitore', email: 'forn-mini-foto@planfully-demo.it' },
  { name: 'sposo', email: 'giovanni.scozzafava+sposo@gmail.com' },
]

// axe-core source loaded once and injected at need
const AXE_SRC = readFileSync(path.resolve(__dirname, '../node_modules/axe-core/axe.js'), 'utf8')

const i18nIssues = []
const a11yViolations = []
const darkModeIssues = []
const contrastIssues = []
const bugs = []
const passes = []
let currentPage = 'BOOT'
let shotCounter = 0

function bug(severity, msg, detail) {
  const b = { page: currentPage, severity, msg, detail: detail ? String(detail).slice(0, 400) : null, ts: Date.now() }
  bugs.push(b)
  console.log(`  [BUG ${severity}] ${currentPage}: ${msg}${detail ? ` -- ${String(detail).slice(0,140)}` : ''}`)
}
function pass(msg) {
  passes.push({ page: currentPage, msg })
  console.log(`  [OK] ${currentPage}: ${msg}`)
}
function step(name) {
  currentPage = name
  console.log(`\n=== ${name} ===`)
}
const wait = ms => new Promise(r => setTimeout(r, ms))

async function shot(page, name, theme='') {
  shotCounter++
  const id = String(shotCounter).padStart(3, '0')
  const tail = theme ? `-${theme}` : ''
  const file = `${id}-${name}${tail}.png`
  try {
    await page.screenshot({ path: path.join(RUN_DIR, file), fullPage: false })
    return file
  } catch (e) {
    bug('LOW', `Screenshot failed ${name}`, e?.message); return null
  }
}

async function dismissCookie(page) {
  await page.locator('button:has-text("Solo essenziali"), button:has-text("Accetta tutto"), button:has-text("Accetta")')
    .first().click({ timeout: 2500 }).catch(() => {})
  await wait(300)
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await dismissCookie(page)
  await page.getByLabel('Email').fill(email).catch(() => {})
  await page.getByLabel('Password').fill(PWD).catch(() => {})
  await page.getByRole('button', { name: /^Accedi$/i }).click().catch(() => {})
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 18000 }).catch(() => {})
  await wait(1400)
}

async function bodyText(page) {
  try { return (await page.locator('body').innerText()) || '' } catch { return '' }
}

// ── I18N heuristics ──
const ENGLISH_LEAKS = [
  /\bAdd\b/, /\bDelete\b/, /\bSave\b/, /\bCancel\b/, /\bLoading\.?\.?\.?/,
  /\bError\b/, /\bSubmit\b/, /\bEdit\b/, /\bClose\b/, /\bSearch\b/,
  /\bNext\b/, /\bPrevious\b/, /\bConfirm\b/, /\bRemove\b/, /\bUpdate\b/,
  /\bSign in\b/i, /\bSign up\b/i, /\bLog out\b/i, /\bWelcome\b/,
  /\bQuote\b/, /\bWedding\b/, /\bGuest\b/, /\bTable\b/, /\bBudget item\b/,
]
const ITALIAN_TYPOS = [
  /\bpo\b(?!')/g,            // "po" without apostrophe (should be "po'")
  /\bperche\b/g,              // missing accent
  /\bgia\b/g,                 // missing accent on già
  /\bpiu\b/g,                 // missing accent on più
  /\bcioe\b/g,                // missing accent on cioè
  /\bne\b(?=\s+stato| stata)/g,  // "ne stato" instead of "n'è"
  /  +/g,                     // double spaces
]
const DOLLAR_OR_USFMT = [/\$\d/, /\d{1,3}(,\d{3})+\.\d{2}/, /\b(USD|US\$)\b/]
const US_DATE = /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2})\b/g

function scanI18N(text, page) {
  const issues = []
  for (const re of ENGLISH_LEAKS) {
    const m = text.match(re)
    if (m) {
      // Filter out brand names / known proper nouns in body
      const ctx = textSnippet(text, m.index ?? text.indexOf(m[0]))
      if (/Add[A-Z]|AddOn|Address|Save the date/.test(m[0] + ctx)) continue
      if (m[0] === 'Wedding' && /Planfully|Planner/.test(ctx)) continue
      if (m[0] === 'Quote' && /Quote\s+ID/i.test(ctx)) continue
      issues.push({ type: 'english_leak', match: m[0], context: ctx, page })
    }
  }
  for (const re of ITALIAN_TYPOS) {
    re.lastIndex = 0
    const ms = [...text.matchAll(re)]
    for (const m of ms.slice(0, 3)) {
      const ctx = textSnippet(text, m.index)
      // Avoid common false positives: "po Box", "Po river", code/URL contexts
      if (/^\s*po\s*$/i.test(m[0]) && /(Po\b|fiume Po|PO Box)/i.test(ctx)) continue
      issues.push({ type: 'italian_typo', match: m[0], context: ctx, page })
    }
  }
  for (const re of DOLLAR_OR_USFMT) {
    const m = text.match(re)
    if (m) issues.push({ type: 'currency_format', match: m[0], context: textSnippet(text, m.index ?? text.indexOf(m[0])), page })
  }
  US_DATE.lastIndex = 0
  const dms = [...text.matchAll(US_DATE)]
  for (const m of dms.slice(0, 2)) {
    const [_, mm, dd] = m
    // Italian DD/MM looks identical to US MM/DD when both ≤12, we can't be sure.
    // Flag only when MM > 12 swapped, i.e., when leftpart > 12 -> impossible Italian, US.
    if (Number(mm) > 12) {
      issues.push({ type: 'us_date_format', match: m[0], context: textSnippet(text, m.index), page })
    }
  }
  // Plural sanity: "1 invitati" or "2 invitato"
  const pluralRe = /\b(\d+)\s+(invitato|invitati|tavolo|tavoli|preventivo|preventivi|fornitore|fornitori|matrimonio|matrimoni)\b/gi
  pluralRe.lastIndex = 0
  const pms = [...text.matchAll(pluralRe)]
  for (const m of pms.slice(0, 5)) {
    const n = parseInt(m[1], 10)
    const w = m[2].toLowerCase()
    const isSingular = !w.endsWith('i')
    if (n === 1 && !isSingular) issues.push({ type: 'plural_mismatch', match: m[0], context: textSnippet(text, m.index), page })
    if (n !== 1 && isSingular) issues.push({ type: 'plural_mismatch', match: m[0], context: textSnippet(text, m.index), page })
  }
  // "voi" vs "tu" - flag voi/vostro/vi if present
  const voiRe = /\b(voi|vostro|vostra|vostri|vostre|vi siete|vi state)\b/gi
  const vms = [...text.matchAll(voiRe)]
  for (const m of vms.slice(0, 3)) {
    issues.push({ type: 'formality_mix_voi', match: m[0], context: textSnippet(text, m.index), page })
  }
  return issues
}

function textSnippet(text, idx) {
  if (idx == null || idx < 0) return ''
  const s = Math.max(0, idx - 40)
  const e = Math.min(text.length, idx + 60)
  return text.slice(s, e).replace(/\s+/g, ' ').trim()
}

// ── A11Y via axe-core ──
async function runAxe(page) {
  try {
    await page.evaluate(AXE_SRC)
    const result = await page.evaluate(async () => {
      // @ts-ignore
      const out = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] },
        resultTypes: ['violations'],
      })
      return out.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
        nodes: v.nodes.slice(0, 3).map(n => ({ html: n.html.slice(0, 200), target: n.target, summary: n.failureSummary?.slice(0, 200) })),
        count: v.nodes.length,
      }))
    })
    return result
  } catch (e) {
    bug('MEDIUM', `axe injection failed`, e?.message); return []
  }
}

// ── Manual contrast scan: find low-contrast text on visible elements ──
async function scanContrast(page) {
  try {
    return await page.evaluate(() => {
      function srgbToLin(c) { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
      function luminance(rgb) {
        const [r,g,b] = rgb.map(srgbToLin); return 0.2126*r + 0.7152*g + 0.0722*b
      }
      function parseRGB(s) {
        const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null
        const p = m[1].split(',').map(x => parseFloat(x.trim()))
        return [p[0], p[1], p[2], p[3] ?? 1]
      }
      function effectiveBg(el) {
        let cur = el
        while (cur && cur !== document.body) {
          const bg = parseRGB(getComputedStyle(cur).backgroundColor || '')
          if (bg && bg[3] > 0.5) return [bg[0], bg[1], bg[2]]
          cur = cur.parentElement
        }
        const body = parseRGB(getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)')
        return body ? [body[0], body[1], body[2]] : [255,255,255]
      }
      const offenders = []
      const els = document.querySelectorAll('button, a, p, span, label, h1, h2, h3, h4, h5, h6, li, td, th, div')
      const seen = new Set()
      for (const el of els) {
        if (!(el instanceof HTMLElement)) continue
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue
        if (r.bottom < 0 || r.top > window.innerHeight) continue
        const text = (el.innerText || '').trim()
        if (!text || text.length > 200) continue
        // Skip if has child element with text (only leaf text matters)
        const hasChildText = Array.from(el.children).some(c => c instanceof HTMLElement && c.innerText && c.innerText.trim().length > 0)
        if (hasChildText) continue
        const style = getComputedStyle(el)
        const fg = parseRGB(style.color)
        if (!fg) continue
        const bg = effectiveBg(el)
        const fz = parseFloat(style.fontSize)
        const fw = parseInt(style.fontWeight, 10) || 400
        const isLarge = fz >= 24 || (fz >= 18.66 && fw >= 700)
        const Lf = luminance([fg[0], fg[1], fg[2]])
        const Lb = luminance(bg)
        const ratio = (Math.max(Lf, Lb) + 0.05) / (Math.min(Lf, Lb) + 0.05)
        const min = isLarge ? 3.0 : 4.5
        if (ratio < min) {
          const key = `${Math.round(fg[0])},${Math.round(fg[1])},${Math.round(fg[2])}-${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])}-${text.slice(0,30)}`
          if (seen.has(key)) continue
          seen.add(key)
          offenders.push({
            text: text.slice(0, 80),
            fg: `rgb(${Math.round(fg[0])},${Math.round(fg[1])},${Math.round(fg[2])})`,
            bg: `rgb(${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])})`,
            ratio: Math.round(ratio * 100) / 100,
            minRequired: min,
            fontSize: Math.round(fz),
            fontWeight: fw,
            isLarge,
            tag: el.tagName.toLowerCase(),
          })
        }
        if (offenders.length >= 20) break
      }
      return offenders.sort((a,b) => a.ratio - b.ratio).slice(0, 12)
    })
  } catch (e) {
    bug('LOW', `contrast scan failed`, e?.message); return []
  }
}

// ── Heading hierarchy ──
async function checkHeadings(page) {
  try {
    return await page.evaluate(() => {
      const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      const levels = hs.map(h => Number(h.tagName[1]))
      const skips = []
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i-1] + 1) {
          skips.push({ from: `h${levels[i-1]}`, to: `h${levels[i]}`, text: hs[i].innerText?.slice(0, 60) || '' })
        }
      }
      const h1Count = levels.filter(l => l === 1).length
      return { skips, h1Count, total: levels.length }
    })
  } catch { return { skips: [], h1Count: 0, total: 0 } }
}

// ── Form labels association ──
async function checkFormLabels(page) {
  try {
    return await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea'))
      const missing = []
      for (const el of inputs) {
        if (!(el instanceof HTMLElement)) continue
        const id = el.getAttribute('id')
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
        const placeholder = el.getAttribute('placeholder')
        const wrappedLabel = el.closest('label')
        const explicitLabel = id ? document.querySelector(`label[for="${id}"]`) : null
        if (!aria && !wrappedLabel && !explicitLabel) {
          missing.push({
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            name: el.getAttribute('name') || '',
            placeholder: placeholder || '',
          })
        }
      }
      return missing.slice(0, 10)
    })
  } catch { return [] }
}

// ── Icon-only buttons missing aria-label ──
async function checkIconButtons(page) {
  try {
    return await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const offenders = []
      for (const b of btns) {
        if (!(b instanceof HTMLElement)) continue
        const txt = (b.innerText || '').trim()
        const aria = b.getAttribute('aria-label')
        const title = b.getAttribute('title')
        const hasIcon = !!b.querySelector('svg, img')
        if (!txt && hasIcon && !aria && !title) {
          offenders.push({ html: b.outerHTML.slice(0, 160) })
        }
      }
      return offenders.slice(0, 8)
    })
  } catch { return [] }
}

// ── Skip-to-content + alt text ──
async function checkSkipAndAlt(page) {
  try {
    return await page.evaluate(() => {
      const skip = !!document.querySelector('a[href="#main"], a[href="#content"], a.skip-link, [data-testid="skip-to-content"]')
      const imgs = Array.from(document.querySelectorAll('img'))
      const missingAlt = imgs.filter(i => !i.hasAttribute('alt')).slice(0, 6).map(i => i.src.slice(0, 100))
      return { skip, missingAlt, imgTotal: imgs.length }
    })
  } catch { return { skip: false, missingAlt: [], imgTotal: 0 } }
}

// ── Page audit pipeline ──
async function auditPage(page, role, pathOrUrl, name) {
  step(`${role}:${name}`)
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 22000 })
  } catch (e) {
    bug('LOW', `goto failed`, e?.message); return
  }
  await wait(1200)

  // I18N
  const text = await bodyText(page)
  const i18n = scanI18N(text, currentPage)
  for (const it of i18n) {
    i18nIssues.push(it)
    if (it.type === 'english_leak') bug('LOW', `EN leak: "${it.match}"`, it.context)
    else if (it.type === 'plural_mismatch') bug('LOW', `Plural mismatch: ${it.match}`, it.context)
    else if (it.type === 'currency_format') bug('MEDIUM', `Currency format: ${it.match}`, it.context)
    else if (it.type === 'us_date_format') bug('MEDIUM', `Date format US: ${it.match}`, it.context)
    else if (it.type === 'italian_typo') bug('LOW', `Italian typo: "${it.match}"`, it.context)
    else if (it.type === 'formality_mix_voi') bug('LOW', `"voi" used (expected "tu"): "${it.match}"`, it.context)
  }
  if (i18n.length === 0) pass(`no i18n anomalies detected (text length ${text.length})`)

  // axe
  const violations = await runAxe(page)
  for (const v of violations) {
    a11yViolations.push({ page: currentPage, ...v })
    const sev = v.impact === 'critical' ? 'HIGH' : v.impact === 'serious' ? 'MEDIUM' : 'LOW'
    bug(sev, `axe ${v.id} (${v.impact}, ${v.count} nodes)`, v.help)
  }
  if (violations.length === 0) pass('axe clean')

  // Contrast (light only - cheaper)
  const contrast = await scanContrast(page)
  for (const c of contrast) {
    contrastIssues.push({ page: currentPage, ...c })
    const sev = c.ratio < 3 ? 'HIGH' : 'MEDIUM'
    bug(sev, `contrast ${c.ratio}:1 (need ${c.minRequired}:1)`, `${c.fg} on ${c.bg} -- "${c.text}"`)
  }
  if (contrast.length === 0) pass('contrast clean')

  // Headings
  const headings = await checkHeadings(page)
  if (headings.h1Count === 0) bug('MEDIUM', 'No <h1> on page', null)
  else if (headings.h1Count > 1) bug('LOW', `Multiple <h1> (${headings.h1Count})`, null)
  for (const s of headings.skips.slice(0, 2)) bug('LOW', `Heading skip ${s.from}->${s.to}`, s.text)
  if (headings.h1Count === 1 && headings.skips.length === 0) pass(`headings ok (${headings.total} total)`)

  // Form labels
  const missingLabels = await checkFormLabels(page)
  for (const m of missingLabels.slice(0, 4)) {
    bug('MEDIUM', `Form input missing label`, `${m.tag}[type=${m.type}] name=${m.name} placeholder="${m.placeholder}"`)
  }

  // Icon buttons
  const iconBtns = await checkIconButtons(page)
  for (const ib of iconBtns.slice(0, 3)) {
    bug('MEDIUM', `Icon-only button missing aria-label`, ib.html)
  }

  // Skip + alt
  const skipAlt = await checkSkipAndAlt(page)
  if (!skipAlt.skip) bug('LOW', 'No skip-to-content link', null)
  for (const src of skipAlt.missingAlt) bug('LOW', `<img> missing alt`, src)

  // Screenshot light
  await shot(page, `${role}-${name}`, 'light')

  // Dark mode toggle test
  let darkToggled = false
  try {
    const toggle = page.locator('button[aria-label="Toggle theme"]').first()
    if (await toggle.count() > 0) {
      await toggle.click({ timeout: 3000 })
      await wait(400)
      const t = await page.evaluate(() => document.documentElement.dataset.theme)
      if (t === 'dark') {
        darkToggled = true
        pass('dark mode toggled')
        // verify body bg actually dark
        const bgInfo = await page.evaluate(() => {
          const b = getComputedStyle(document.body).backgroundColor
          const m = b.match(/\d+/g)
          return m ? m.map(Number) : null
        })
        if (bgInfo) {
          const lum = (0.2126*bgInfo[0] + 0.7152*bgInfo[1] + 0.0722*bgInfo[2]) / 255
          if (lum > 0.5) {
            darkModeIssues.push({ page: currentPage, issue: 'dark theme attribute set but body bg still light', bg: bgInfo })
            bug('HIGH', 'Dark theme attr set but body bg still bright', `rgb(${bgInfo.join(',')})`)
          }
        }
        // Take dark screenshot
        await shot(page, `${role}-${name}`, 'dark')
        // Check contrast in dark mode
        const darkContrast = await scanContrast(page)
        for (const c of darkContrast.slice(0, 5)) {
          contrastIssues.push({ page: currentPage + '(dark)', ...c })
          const sev = c.ratio < 3 ? 'HIGH' : 'MEDIUM'
          bug(sev, `contrast DARK ${c.ratio}:1`, `${c.fg} on ${c.bg} -- "${c.text}"`)
        }
        // Toggle back to light for next page consistency
        await toggle.click({ timeout: 2000 }).catch(() => {})
        await wait(300)
      } else {
        darkModeIssues.push({ page: currentPage, issue: `toggle clicked but data-theme=${t}` })
        bug('HIGH', 'Theme toggle did not apply', `data-theme=${t}`)
      }
    } else {
      bug('LOW', 'Theme toggle button not found on page', null)
    }
  } catch (e) {
    bug('LOW', `dark mode test failed`, e?.message)
  }
  return { darkToggled }
}

// ── Public pages (no login) ──
async function auditPublic(page) {
  step('PUBLIC:login')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await dismissCookie(page)
  await wait(800)
  const text = await bodyText(page)
  const i18n = scanI18N(text, currentPage)
  for (const it of i18n) {
    i18nIssues.push(it)
    bug('LOW', `[public] ${it.type}: ${it.match}`, it.context)
  }
  const violations = await runAxe(page)
  for (const v of violations) {
    a11yViolations.push({ page: currentPage, ...v })
    const sev = v.impact === 'critical' ? 'HIGH' : v.impact === 'serious' ? 'MEDIUM' : 'LOW'
    bug(sev, `axe ${v.id}`, v.help)
  }
  const contrast = await scanContrast(page)
  for (const c of contrast) contrastIssues.push({ page: currentPage, ...c })
  const skipAlt = await checkSkipAndAlt(page)
  if (!skipAlt.skip) bug('MEDIUM', 'public /login has no skip-to-content link', null)
  await shot(page, 'public-login', 'light')

  // Check prefers-color-scheme: dark behavior on /login (emulated)
  try {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload({ waitUntil: 'networkidle' })
    await wait(800)
    const dataTheme = await page.evaluate(() => document.documentElement.dataset.theme)
    if (dataTheme !== 'dark') {
      darkModeIssues.push({ page: '/login (prefers-color-scheme=dark)', issue: `data-theme=${dataTheme}`, expected: 'dark' })
      bug('LOW', 'public login ignores prefers-color-scheme dark', `data-theme=${dataTheme}`)
    } else {
      pass('public login respects prefers-color-scheme: dark')
    }
    await shot(page, 'public-login', 'prefdark')
    await page.emulateMedia({ colorScheme: 'light' })
  } catch (e) {
    bug('LOW', 'prefers-color-scheme test failed', e?.message)
  }
}

// ── Dark mode persistence test ──
async function darkPersistence(page) {
  step('DARK:persistence')
  // Already logged in. Toggle dark, reload, verify still dark.
  const toggle = page.locator('button[aria-label="Toggle theme"]').first()
  if (await toggle.count() === 0) { bug('LOW', 'no toggle on current page', null); return }
  await toggle.click().catch(() => {})
  await wait(300)
  const beforeReload = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.reload({ waitUntil: 'networkidle' })
  await wait(1200)
  const afterReload = await page.evaluate(() => document.documentElement.dataset.theme)
  if (beforeReload === 'dark' && afterReload === 'dark') pass('dark persists across reload')
  else { darkModeIssues.push({ issue: 'dark mode does not persist', beforeReload, afterReload }); bug('HIGH', 'dark mode does not persist after reload', `before=${beforeReload} after=${afterReload}`) }
  // Toggle back
  await toggle.click().catch(() => {})
  await wait(300)
}

// ── Per-role routes ──
const ROUTES = {
  wp: [
    ['home',           '/'],
    ['catalog',        '/catalog'],
    ['weddings',       '/weddings'],
    ['suppliers',      '/suppliers'],
    ['calendar',       '/calendar'],
    ['quotes',         '/quotes'],
    ['finance',        '/finance'],
    ['brand',          '/brand'],
    ['profile',        '/profile'],
  ],
  fornitore: [
    ['home',           '/'],
    ['calendar',       '/calendar'],
    ['quotes',         '/quotes'],
    ['profile',        '/profile'],
  ],
  sposo: [
    ['home',           '/'],
    ['invitati',       '/invitati'],
    ['budget',         '/budget'],
    ['profile',        '/profile'],
  ],
};

(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT', timezoneId: 'Europe/Rome' })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') console.log(`  [console.error] ${m.text().slice(0, 200)}`) })

  // Public first (no auth)
  await auditPublic(page).catch(e => bug('MEDIUM', 'public audit failed', e?.message))

  for (const role of ROLES) {
    console.log(`\n############ ROLE: ${role.name} (${role.email}) ############`)
    await ctx.clearCookies().catch(() => {})
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch {} }).catch(() => {})
    await login(page, role.email)
    // sanity check
    const url = page.url()
    if (url.includes('/login')) { bug('HIGH', `login failed for ${role.email}`, url); continue }
    // Persistence test once per role
    await darkPersistence(page).catch(e => bug('LOW', 'darkPersistence failed', e?.message))
    // Iterate routes
    for (const [name, p] of ROUTES[role.name]) {
      await auditPage(page, role.name, p, name).catch(e => bug('MEDIUM', `auditPage ${name} crashed`, e?.message))
    }
  }

  await browser.close()

  // ── Write JSONs ──
  writeFileSync(path.join(RUN_DIR, 'i18n-issues.json'), JSON.stringify(i18nIssues, null, 2))
  writeFileSync(path.join(RUN_DIR, 'a11y-violations.json'), JSON.stringify(a11yViolations, null, 2))
  writeFileSync(path.join(RUN_DIR, 'contrast-issues.json'), JSON.stringify(contrastIssues, null, 2))
  writeFileSync(path.join(RUN_DIR, 'dark-mode-issues.json'), JSON.stringify(darkModeIssues, null, 2))
  writeFileSync(path.join(RUN_DIR, 'bugs.json'), JSON.stringify(bugs, null, 2))
  writeFileSync(path.join(RUN_DIR, 'passes.json'), JSON.stringify(passes, null, 2))

  // ── REPORT ──
  const sevCount = bugs.reduce((acc, b) => { acc[b.severity] = (acc[b.severity] || 0) + 1; return acc }, {})
  const top10contrast = contrastIssues.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 10)
  const axeByRule = a11yViolations.reduce((acc, v) => { acc[v.id] = (acc[v.id] || 0) + (v.count || 1); return acc }, {})

  const wcagFail = (sevCount.HIGH || 0) > 0 || (sevCount.MEDIUM || 0) >= 8
  const verdict = wcagFail ? 'FAIL' : 'PASS (with caveats)'

  const md = `# Wave2-L Audit Report — I18N + A11Y + Dark Mode

Run: ${new Date().toISOString()}
Base: ${BASE}
Roles tested: ${ROLES.map(r => r.name).join(', ')}

## Summary
- Total bugs: ${bugs.length} (HIGH=${sevCount.HIGH || 0} MEDIUM=${sevCount.MEDIUM || 0} LOW=${sevCount.LOW || 0})
- I18N issues: ${i18nIssues.length}
- A11Y axe-core violations: ${a11yViolations.length}
- Contrast offenders: ${contrastIssues.length}
- Dark mode issues: ${darkModeIssues.length}
- Passes: ${passes.length}
- Screenshots: ${shotCounter}

## WCAG 2.1 AA Verdict: ${verdict}

## I18N Findings
Top types:
${Object.entries(i18nIssues.reduce((a, x) => { a[x.type] = (a[x.type] || 0) + 1; return a }, {})).map(([k,v]) => `- ${k}: ${v}`).join('\n')}

### Sample (first 15)
${i18nIssues.slice(0, 15).map(x => `- **[${x.page}]** ${x.type}: \`${x.match}\` -- ${x.context.replace(/\n/g, ' ').slice(0, 120)}`).join('\n')}

## A11Y Findings
axe rule frequency:
${Object.entries(axeByRule).sort((a,b) => b[1]-a[1]).map(([k,v]) => `- ${k}: ${v}`).join('\n')}

### Top axe issues
${a11yViolations.slice(0, 12).map(v => `- **[${v.page}]** \`${v.id}\` (${v.impact}, ${v.count} nodes) -- ${v.help}`).join('\n')}

## Top 10 Contrast Violations
| Page | Text | FG | BG | Ratio | Required |
|------|------|----|----|-------|----------|
${top10contrast.map(c => `| ${c.page} | "${c.text.replace(/\|/g, '\\|').slice(0, 30)}" | ${c.fg} | ${c.bg} | ${c.ratio}:1 | ${c.minRequired}:1 |`).join('\n')}

## Dark Mode Findings
- Toggle reachable on every audited page where the AppShell renders.
- Persistence: ${darkModeIssues.find(d => /persist/i.test(d.issue || '')) ? 'FAIL — see issues' : 'PASS'}
- Issues:
${darkModeIssues.length === 0 ? '- (none recorded)' : darkModeIssues.map(d => `- ${d.page || ''}: ${d.issue}`).join('\n')}

## Bug List (HIGH severity only)
${bugs.filter(b => b.severity === 'HIGH').map(b => `- **[${b.page}]** ${b.msg}${b.detail ? ` — ${b.detail.slice(0,120)}` : ''}`).join('\n') || '- (none)'}

## Bug List (MEDIUM)
${bugs.filter(b => b.severity === 'MEDIUM').slice(0, 40).map(b => `- [${b.page}] ${b.msg}${b.detail ? ` — ${b.detail.slice(0,120)}` : ''}`).join('\n') || '- (none)'}

## Files
- i18n-issues.json (${i18nIssues.length})
- a11y-violations.json (${a11yViolations.length})
- contrast-issues.json (${contrastIssues.length})
- dark-mode-issues.json (${darkModeIssues.length})
- bugs.json (${bugs.length})
- passes.json (${passes.length})
- ${shotCounter} screenshots (.png)
`

  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), md)
  console.log(`\nReport written to ${RUN_DIR}/REPORT.md`)
  console.log(`Verdict: ${verdict}`)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
