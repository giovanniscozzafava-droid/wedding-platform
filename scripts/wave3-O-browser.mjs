#!/usr/bin/env node
// Wave 3 Agent O — browser regression:
// R2: tab strip overflow indicator (couple + WP, mobile + desktop)
// R3: header sposi mobile (logo simbolo only, no name text, chip iniziali, aria-label, no overflow)
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'

const RUN_DIR = process.env.RUN_DIR || path.resolve('/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs', `wave3-O-regression-${new Date().toISOString().replace(/[:.]/g, '-')}`)
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })

const BASE = 'https://planfully.it'
const PWD = 'Beta2026!'
const SPOSI_EMAIL = 'giovanni.scozzafava+sposo@gmail.com'
const WP_EMAIL = 'wp-mini@planfully-demo.it'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SVC = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const svc = createClient(URL, SVC, { auth: { persistSession: false } })

const tests = []
function record(t) { tests.push(t); console.log(`[${t.verdict}] ${t.id} — ${t.title}${t.note ? ' :: ' + t.note : ''}`) }

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.getByLabel('Email').fill(email).catch(() => {})
  await page.getByLabel('Password').fill(PWD).catch(() => {})
  await page.getByRole('button', { name: /accedi|login|entra/i }).click().catch(() => {})
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
}

// Find Andrea wedding id for WP route
async function findWeddingIdForWP() {
  // WP-mini's wedding (any wedding owned by wp-mini)
  const { data: pages } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  const all = pages?.users ?? []
  const more = await svc.auth.admin.listUsers({ page: 2, perPage: 200 })
  all.push(...(more.data?.users ?? []))
  const wp = all.find(u => u.email?.toLowerCase() === WP_EMAIL.toLowerCase())
  if (!wp) return null
  const { data } = await svc.from('calendar_entries').select('id, title').eq('owner_id', wp.id).order('date_from', { ascending: false }).limit(1)
  return data?.[0]?.id ?? null
}

async function testR2(browser) {
  const t = { id: 'R2', title: 'tab strip overflow indicator', verdict: 'SKIP', details: {} }
  try {
    const wpWedId = await findWeddingIdForWP()
    t.details.wp_wedding_id = wpWedId

    // -- A) COUPLE mobile 375x812 --
    const ctxMobile = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    })
    const pageM = await ctxMobile.newPage()
    await login(pageM, SPOSI_EMAIL)
    await pageM.goto(`${BASE}/couple`, { waitUntil: 'networkidle' }).catch(() => {})
    await pageM.waitForTimeout(800)
    await pageM.screenshot({ path: path.join(RUN_DIR, 'r2-couple-mobile.png'), fullPage: false })

    // Locate tab nav and read scroll properties
    const couplePropsMobile = await pageM.evaluate(() => {
      // Look for nav -> div.overflow-x-auto (couple uses <nav>)
      const nav = document.querySelector('nav .overflow-x-auto') || document.querySelector('.overflow-x-auto')
      if (!nav) return null
      const buttons = nav.querySelectorAll('button')
      const hasFades = !!nav.parentElement?.querySelector('.pointer-events-none')
      return {
        scrollWidth: nav.scrollWidth,
        clientWidth: nav.clientWidth,
        scrollable: nav.scrollWidth > nav.clientWidth,
        tabCount: buttons.length,
        hasFades,
      }
    })
    t.details.couple_mobile = couplePropsMobile

    // Simulate scroll drag (touch)
    if (couplePropsMobile?.scrollable) {
      await pageM.evaluate(() => {
        const nav = document.querySelector('nav .overflow-x-auto') || document.querySelector('.overflow-x-auto')
        if (nav) nav.scrollLeft = 200
      })
      await pageM.waitForTimeout(300)
      const afterScroll = await pageM.evaluate(() => {
        const nav = document.querySelector('nav .overflow-x-auto') || document.querySelector('.overflow-x-auto')
        return { scrollLeft: nav?.scrollLeft ?? 0 }
      })
      t.details.couple_mobile_scrolled = afterScroll
      await pageM.screenshot({ path: path.join(RUN_DIR, 'r2-couple-mobile-scrolled.png'), fullPage: false })
    }

    // Click a tab and verify scrollIntoView auto-scroll: click the last tab
    const clickScrollResult = await pageM.evaluate(async () => {
      const nav = document.querySelector('nav .overflow-x-auto') || document.querySelector('.overflow-x-auto')
      if (!nav) return null
      const btns = nav.querySelectorAll('button')
      if (btns.length < 3) return null
      const before = nav.scrollLeft
      const target = btns[btns.length - 1]
      target.click()
      await new Promise(r => setTimeout(r, 800))
      const after = nav.scrollLeft
      const rect = target.getBoundingClientRect()
      const navRect = nav.getBoundingClientRect()
      const visible = rect.left >= navRect.left - 1 && rect.right <= navRect.right + 1
      return { before, after, visible, last_tab_text: target.textContent?.trim().slice(0, 40) }
    })
    t.details.couple_mobile_click_scroll = clickScrollResult
    await pageM.screenshot({ path: path.join(RUN_DIR, 'r2-couple-mobile-after-tabclick.png'), fullPage: false })
    await ctxMobile.close()

    // -- B) COUPLE desktop 1280x720 --
    const ctxDesk = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const pageD = await ctxDesk.newPage()
    await login(pageD, SPOSI_EMAIL)
    await pageD.goto(`${BASE}/couple`, { waitUntil: 'networkidle' }).catch(() => {})
    await pageD.waitForTimeout(600)
    await pageD.screenshot({ path: path.join(RUN_DIR, 'r2-couple-desktop.png'), fullPage: false })
    const coupleDeskProps = await pageD.evaluate(() => {
      const nav = document.querySelector('nav .overflow-x-auto') || document.querySelector('.overflow-x-auto')
      if (!nav) return null
      return {
        scrollWidth: nav.scrollWidth,
        clientWidth: nav.clientWidth,
        scrollable: nav.scrollWidth > nav.clientWidth,
        tabCount: nav.querySelectorAll('button').length,
        hasFades: !!nav.parentElement?.querySelector('.pointer-events-none'),
      }
    })
    t.details.couple_desktop = coupleDeskProps
    await ctxDesk.close()

    // -- C) WP wedding mobile + desktop --
    if (wpWedId) {
      const ctxWpM = await browser.newContext({
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 3, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      })
      const pageWpM = await ctxWpM.newPage()
      await login(pageWpM, WP_EMAIL)
      await pageWpM.goto(`${BASE}/weddings/${wpWedId}`, { waitUntil: 'networkidle' }).catch(() => {})
      await pageWpM.waitForTimeout(800)
      await pageWpM.screenshot({ path: path.join(RUN_DIR, 'r2-wp-wedding-mobile.png'), fullPage: false })
      const wpMobileProps = await pageWpM.evaluate(() => {
        // WP wedding uses different DOM — find first .overflow-x-auto with buttons
        const candidates = document.querySelectorAll('.overflow-x-auto')
        let best = null
        for (const c of candidates) {
          if (c.querySelectorAll('button').length >= 3) { best = c; break }
        }
        if (!best) return null
        return {
          scrollWidth: best.scrollWidth,
          clientWidth: best.clientWidth,
          scrollable: best.scrollWidth > best.clientWidth,
          tabCount: best.querySelectorAll('button').length,
          hasFades: !!best.parentElement?.querySelector('.pointer-events-none'),
        }
      })
      t.details.wp_mobile = wpMobileProps
      await ctxWpM.close()

      const ctxWpD = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      const pageWpD = await ctxWpD.newPage()
      await login(pageWpD, WP_EMAIL)
      await pageWpD.goto(`${BASE}/weddings/${wpWedId}`, { waitUntil: 'networkidle' }).catch(() => {})
      await pageWpD.waitForTimeout(600)
      await pageWpD.screenshot({ path: path.join(RUN_DIR, 'r2-wp-wedding-desktop.png'), fullPage: false })
      const wpDeskProps = await pageWpD.evaluate(() => {
        const candidates = document.querySelectorAll('.overflow-x-auto')
        let best = null
        for (const c of candidates) {
          if (c.querySelectorAll('button').length >= 3) { best = c; break }
        }
        if (!best) return null
        return {
          scrollWidth: best.scrollWidth,
          clientWidth: best.clientWidth,
          scrollable: best.scrollWidth > best.clientWidth,
          tabCount: best.querySelectorAll('button').length,
          hasFades: !!best.parentElement?.querySelector('.pointer-events-none'),
        }
      })
      t.details.wp_desktop = wpDeskProps
      await ctxWpD.close()
    }

    // Verdict
    const checks = {
      couple_mobile_scrollable: !!t.details.couple_mobile?.scrollable,
      couple_mobile_fades: !!t.details.couple_mobile?.hasFades,
      couple_mobile_drag_works: (t.details.couple_mobile_scrolled?.scrollLeft ?? 0) > 0,
      couple_mobile_clickscroll_visible: !!t.details.couple_mobile_click_scroll?.visible,
      couple_desktop_fades_present: !!t.details.couple_desktop?.hasFades,
      wp_mobile_scrollable_or_fades: !!t.details.wp_mobile && (t.details.wp_mobile.scrollable || t.details.wp_mobile.hasFades),
    }
    t.details.checks = checks
    const pass = Object.values(checks).filter(Boolean).length
    const total = Object.keys(checks).length
    t.details.pass_ratio = `${pass}/${total}`
    t.verdict = pass === total ? 'PASS' : (pass >= total - 1 ? 'PARTIAL' : 'FAIL')
    if (t.verdict !== 'PASS') t.note = `passed ${pass}/${total} checks`
  } catch (e) {
    t.verdict = 'FAIL'
    t.details.exception = e.message
    t.details.stack = e.stack?.split('\n').slice(0, 4)
  }
  record(t)
}

async function testR3(browser) {
  const t = { id: 'R3', title: 'header sposi mobile (logo+chip+no overflow)', verdict: 'SKIP', details: {} }
  try {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    })
    const page = await ctx.newPage()
    await login(page, SPOSI_EMAIL)
    await page.goto(`${BASE}/couple`, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(RUN_DIR, 'r3-header-mobile.png'), fullPage: false })

    // Crop header
    const headerInfo = await page.evaluate(() => {
      const header = document.querySelector('header')
      if (!header) return null
      const rect = header.getBoundingClientRect()
      const logo = header.querySelector('img[alt="Planfully"]')
      const logoRect = logo?.getBoundingClientRect()
      // "Planfully" word span: visible at xs+. On 375 → "hidden xs:inline" → visible iff Tailwind xs config maps to <= 375
      // Detect by computed display style
      const textSpan = header.querySelector('span.font-display')
      const textVisible = textSpan ? getComputedStyle(textSpan).display !== 'none' : null
      // User name in middle (hidden sm:block)
      const middle = header.querySelector('div.hidden.sm\\:block, .truncate')
      let middleVisible = false
      if (middle) middleVisible = getComputedStyle(middle).display !== 'none'
      // Initials chip
      const chip = header.querySelector('span.sm\\:hidden')
      const chipVisible = chip ? getComputedStyle(chip).display !== 'none' : false
      const chipText = chip?.textContent?.trim() ?? null
      // Buttons with aria-label
      const themeBtn = header.querySelector('[aria-label*="tema" i], [aria-label*="theme" i]')
      const profileLink = header.querySelector('[aria-label*="profilo" i], [aria-label*="profile" i]')
      const logoutBtn = header.querySelector('[aria-label*="esci" i], [aria-label*="logout" i]')
      return {
        header_rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        logo_present: !!logo, logo_rect: logoRect ? { w: logoRect.width, h: logoRect.height } : null,
        text_planfully_visible: textVisible,
        middle_name_visible: middleVisible,
        chip_visible: chipVisible,
        chip_text: chipText,
        theme_aria: themeBtn?.getAttribute('aria-label') ?? null,
        profile_aria: profileLink?.getAttribute('aria-label') ?? null,
        logout_aria: logoutBtn?.getAttribute('aria-label') ?? null,
        body_scrollwidth: document.body.scrollWidth,
        window_innerwidth: window.innerWidth,
        overflows: document.body.scrollWidth > window.innerWidth + 1,
      }
    })
    t.details.header = headerInfo

    // Test that name area is NOT rendered as plain text on mobile (it has sm:block so on mobile=hidden)
    const checks = {
      logo_present: !!headerInfo?.logo_present,
      planfully_word_hidden_or_logo_only: headerInfo?.text_planfully_visible === false || headerInfo?.text_planfully_visible === null ? true : false,
      middle_name_hidden: headerInfo?.middle_name_visible === false,
      chip_present_or_logo_height_ok: !!headerInfo?.chip_visible || (headerInfo?.logo_rect?.h ?? 0) >= 24,
      theme_aria_label: !!headerInfo?.theme_aria,
      profile_aria_label: !!headerInfo?.profile_aria,
      logout_aria_label: !!headerInfo?.logout_aria,
      no_horizontal_overflow: headerInfo?.overflows === false,
    }
    t.details.checks = checks
    const pass = Object.values(checks).filter(Boolean).length
    const total = Object.keys(checks).length
    t.details.pass_ratio = `${pass}/${total}`
    t.verdict = pass === total ? 'PASS' : (pass >= total - 1 ? 'PARTIAL' : 'FAIL')
    if (t.verdict !== 'PASS') t.note = `passed ${pass}/${total}`

    await ctx.close()
  } catch (e) {
    t.verdict = 'FAIL'
    t.details.exception = e.message
    t.details.stack = e.stack?.split('\n').slice(0, 4)
  }
  record(t)
}

const browser = await chromium.launch({ headless: true })
await testR2(browser)
await testR3(browser)
await browser.close()

writeFileSync(path.join(RUN_DIR, 'browser-tests.json'), JSON.stringify(tests, null, 2))
console.log('\nDONE browser. Output:', RUN_DIR)
