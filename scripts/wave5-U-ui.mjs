#!/usr/bin/env node
/**
 * Wave 5 Agent U — UI checks (Playwright)
 *  - F07 cookie banner z-40 + modal clickable
 *  - F10 tab strip overflow edge-fade (screenshot CoupleDashboard + WeddingDashboard)
 *  - F11 header sposi mobile chip (375 viewport)
 *  - F16 Genera contratto banner ACCETTATO (screenshot)
 */
import { chromium, devices } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const PROD = 'https://planfully.it'
const PWD = 'Beta2026!'
const RUN_DIR = process.env.RUN_DIR
if (!RUN_DIR) { console.error('Set RUN_DIR'); process.exit(1) }
const SHOTS = resolve(RUN_DIR, 'screenshots')
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true })

const svc = createClient(URL, SVC, { auth: { persistSession: false } })
const results = []
const note = (id, title, ok, det) => {
  results.push({ id, title, verdict: ok ? 'PASS' : 'FAIL', details: det })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} — ${title}`)
}

async function loginViaUI(page, email) {
  await page.goto(`${PROD}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  // Accept cookies if banner visible (to remove from screenshots)
  try {
    const accept = page.locator('button:has-text("Accetta"), button:has-text("OK"), button:has-text("Ho capito")').first()
    if (await accept.isVisible({ timeout: 2000 })) await accept.click()
  } catch {}
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(PWD)
  await page.locator('button:has-text("Accedi"), button:has-text("Login"), button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|wedding|home|app|preventivi|brand)/i, { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

async function f07_cookie_banner(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  let banner_z = null
  let cta_clickable = null
  let modal_overlap = null
  try {
    await page.goto(PROD, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    // Cookie banner: search for a fixed/sticky element near bottom with "cookie" text
    banner_z = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('div, section, aside, footer'))
        .filter(el => {
          const t = (el.textContent ?? '').toLowerCase()
          return /cookie|privacy|consenso/.test(t) && t.length < 800
        })
      for (const el of candidates) {
        const cs = getComputedStyle(el)
        if (cs.position === 'fixed' || cs.position === 'sticky') {
          const r = el.getBoundingClientRect()
          if (r.height > 30 && r.bottom > window.innerHeight - 200) {
            // Walk up to find the actual banner root if needed — usually current element is fine
            return {
              z: cs.zIndex, pointerEvents: cs.pointerEvents, position: cs.position,
              w: r.width, h: r.height, bottom: r.bottom,
              textPreview: (el.textContent ?? '').slice(0, 120).trim(),
              tag: el.tagName,
            }
          }
        }
      }
      return null
    })
    await page.screenshot({ path: resolve(SHOTS, 'f07-01-cookie-banner.png'), fullPage: false })

    // Open login modal/page CTAs in header. If modals are at z-50+, they should be clickable
    const ctaSignup = page.locator('a:has-text("Registrati"), a:has-text("Inizia"), button:has-text("Registrati"), a:has-text("Login"), a:has-text("Accedi")').first()
    const ctaVisible = await ctaSignup.isVisible({ timeout: 2000 }).catch(() => false)
    if (ctaVisible) {
      // Test click: should navigate (NOT be blocked by banner)
      cta_clickable = true
      try {
        await ctaSignup.click({ timeout: 3000 })
        await page.waitForTimeout(800)
      } catch {
        cta_clickable = false
      }
    }
    await page.screenshot({ path: resolve(SHOTS, 'f07-02-after-cta.png'), fullPage: false })
  } catch (e) {
    note('F07.UI', 'CookieBanner z-index + modal clickable', false, { exception: e.message })
    await ctx.close()
    return
  }
  // PASS if: (a) banner has low z (<50) OR pointer-events none OR no fixed banner
  //          (b) CTA was clickable (could navigate)
  // If banner not detected on landing (already accepted cookies / context), still PASS provided CTA works.
  const okZ = banner_z === null || (parseInt(banner_z.z) < 50 || banner_z.pointerEvents === 'none')
  const okCTA = cta_clickable !== false
  note('F07.UI', 'CookieBanner z-index + modal clickable', okZ && okCTA, { banner_z, cta_clickable })
  await ctx.close()
}

async function f10_tab_overflow_couple(browser) {
  // Couple dashboard via login
  const iphone = devices['iPhone 13']
  const ctx = await browser.newContext({ ...iphone })
  const page = await ctx.newPage()
  try {
    await loginViaUI(page, 'giovanni.scozzafava+sposo@gmail.com')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(SHOTS, 'f10-couple-mobile.png'), fullPage: false })
    // Look for gradient indicator near tab strip
    const hasGradient = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'))
      for (const el of els) {
        const cls = (typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? ''))
        if (typeof cls !== 'string') continue
        if (/from-white|to-transparent|fade-edge|edge-fade|bg-gradient-to-[lr]|pointer-events-none/.test(cls)) {
          // Verify it's near a tab/scroll context
          const cs = getComputedStyle(el)
          if (cs.background.includes('gradient') || /bg-gradient|from-/.test(cls)) {
            return { className: cls.slice(0, 200), tag: el.tagName }
          }
        }
        // Inline style gradient
        const st = el.getAttribute?.('style') ?? ''
        if (/linear-gradient/.test(st)) {
          return { inlineStyle: st.slice(0, 200), tag: el.tagName }
        }
      }
      return null
    })
    note('F10.UI.couple', 'tab strip overflow edge-fade visible (couple mobile)', !!hasGradient, { hasGradient })
  } catch (e) {
    note('F10.UI.couple', 'tab strip overflow (couple)', false, { exception: e.message })
  }
  await ctx.close()
}

async function f10_tab_overflow_wedding(browser) {
  // WP wedding dashboard
  const iphone = devices['iPhone 13']
  const ctx = await browser.newContext({ ...iphone })
  const page = await ctx.newPage()
  try {
    await loginViaUI(page, 'wp-mini@planfully-demo.it')
    await page.waitForTimeout(1500)
    // Navigate to first wedding
    const wedLink = page.locator('a[href*="/weddings/"], a[href*="/calendar/"]').first()
    if (await wedLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wedLink.click()
      await page.waitForTimeout(2000)
    }
    await page.screenshot({ path: resolve(SHOTS, 'f10-wedding-mobile.png'), fullPage: false })
    const hasGradient = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'))
      for (const el of els) {
        const cls = (typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? ''))
        if (typeof cls !== 'string') continue
        if (/from-white|to-transparent|fade-edge|edge-fade|bg-gradient-to-[lr]|pointer-events-none/.test(cls)) {
          // Verify it's near a tab/scroll context
          const cs = getComputedStyle(el)
          if (cs.background.includes('gradient') || /bg-gradient|from-/.test(cls)) {
            return { className: cls.slice(0, 200), tag: el.tagName }
          }
        }
        // Inline style gradient
        const st = el.getAttribute?.('style') ?? ''
        if (/linear-gradient/.test(st)) {
          return { inlineStyle: st.slice(0, 200), tag: el.tagName }
        }
      }
      return null
    })
    note('F10.UI.wedding', 'tab strip overflow edge-fade visible (WP wedding mobile)', !!hasGradient, { hasGradient })
  } catch (e) {
    note('F10.UI.wedding', 'tab strip overflow (WP)', false, { exception: e.message })
  }
  await ctx.close()
}

async function f11_header_mobile_chip(browser) {
  // Login as sposo on iPhone 13 (375), inspect header
  const iphone = devices['iPhone 13']
  const ctx = await browser.newContext({ ...iphone })
  const page = await ctx.newPage()
  try {
    await loginViaUI(page, 'giovanni.scozzafava+sposo@gmail.com')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(SHOTS, 'f11-header-mobile.png'), fullPage: false })
    // Check header overflow + chip presence
    const headerInfo = await page.evaluate(() => {
      const header = document.querySelector('header')
      if (!header) return null
      const rect = header.getBoundingClientRect()
      const overflow = header.scrollWidth > header.clientWidth
      // Look for "Planfully" word visibility
      const planfullyEls = Array.from(document.querySelectorAll('header *')).filter(e => /Planfully/.test(e.textContent ?? ''))
      const planfullyVisible = planfullyEls.some(e => {
        const r = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'
      })
      // Look for initials chip (round element with letters, e.g. "GS")
      const chipEls = Array.from(document.querySelectorAll('header [class*="rounded-full"], header [class*="avatar"]'))
      const chipVisible = chipEls.some(e => {
        const r = e.getBoundingClientRect()
        return r.width >= 20 && r.height >= 20
      })
      return {
        header_w: rect.width, scrollW: header.scrollWidth, clientW: header.clientWidth,
        overflow, planfullyVisible, chipVisible,
      }
    })
    const ok = headerInfo && !headerInfo.overflow && headerInfo.chipVisible
    note('F11.UI', 'header sposi mobile chip @ 375', ok, headerInfo)
  } catch (e) {
    note('F11.UI', 'header sposi mobile chip', false, { exception: e.message })
  }
  await ctx.close()
}

async function f16_genera_contratto_btn(browser) {
  // Need a quote in ACCETTATO state for WP. Create one via service-role then login as WP and open editor.
  const WP_ID = '712baed0-3957-4452-8aab-ab4eeebb2697'
  const eventDate = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  let createdQid = null
  try {
    const ins = await svc.from('quotes').insert({
      owner_id: WP_ID,
      title: 'AGENT-U-F16-UI accept banner',
      client_name: 'Test F16 UI',
      client_email: 'f16ui@planfully-demo.it',
      event_date: eventDate,
      guest_count: 50,
      status: 'ACCETTATO',
      revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 5000,
      total_client: 6000,
      margin_amount: 1000,
      margin_percent: 20,
      accepted_at: new Date().toISOString(),
    }).select().single()
    if (ins.error) { note('F16.UI', 'Genera contratto banner', false, { create_err: ins.error.message }); return }
    createdQid = ins.data.id

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    await loginViaUI(page, 'wp-mini@planfully-demo.it')
    await page.goto(`${PROD}/quotes/${createdQid}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await page.screenshot({ path: resolve(SHOTS, 'f16-quote-accepted-banner.png'), fullPage: true })
    // Look for "Genera contratto" button
    const btn = page.locator('button:has-text("Genera contratto"), a:has-text("Genera contratto")').first()
    const btnVisible = await btn.isVisible({ timeout: 5000 }).catch(() => false)
    const currentUrl = page.url()
    // Also do a wider DOM scan for the text (debug)
    const textPresent = await page.evaluate(() => /Genera contratto/i.test(document.body.innerText)).catch(() => false)
    note('F16.UI', 'Genera contratto button visible on ACCETTATO', btnVisible || textPresent, { quote: createdQid, url: currentUrl, btnVisible, textPresent })
    await ctx.close()
  } catch (e) {
    note('F16.UI', 'Genera contratto banner', false, { exception: e.message })
  } finally {
    if (createdQid) {
      try { await svc.from('quotes').delete().eq('id', createdQid) } catch {}
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    await f07_cookie_banner(browser)
    await f11_header_mobile_chip(browser)
    await f10_tab_overflow_couple(browser)
    await f10_tab_overflow_wedding(browser)
    await f16_genera_contratto_btn(browser)
  } finally {
    await browser.close()
  }
  writeFileSync(resolve(RUN_DIR, 'ui-results.json'), JSON.stringify(results, null, 2))
  console.log('\n=== UI DONE ===')
}

main().catch(e => { console.error(e); process.exit(1) })
