import { chromium } from '@playwright/test'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const errors: string[] = []
  const consoleMsgs: string[] = []
  page.on('pageerror', (e) => errors.push('PAGE ERROR: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') consoleMsgs.push(m.text()) })
  page.on('requestfailed', (r) => errors.push('REQ FAILED: ' + r.url() + ' - ' + (r.failure()?.errorText ?? '')))
  await page.goto('https://planfully.it/', { waitUntil: 'networkidle', timeout: 15000 }).catch((e) => errors.push('NAV: ' + e.message))
  await new Promise((r) => setTimeout(r, 2000))
  const rootHTML = await page.locator('#root').innerHTML().catch(() => '')
  console.log('URL:', page.url())
  console.log('ROOT-LEN:', rootHTML.length)
  console.log('ROOT-PREVIEW:', rootHTML.slice(0, 300))
  console.log('PAGE-ERRORS:', JSON.stringify(errors, null, 2))
  console.log('CONSOLE-ERRORS:', JSON.stringify(consoleMsgs, null, 2))
  await browser.close()
}
main().catch(console.error)
