#!/usr/bin/env node
// Sonda rapida: apre il menu mobile e salva uno screenshot + l'elenco delle
// voci di navigazione, per scrivere poi una cattura di NAVIGAZIONE reale
// (non solo scroll dentro una pagina).
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = 'https://planfully.it'
const SESSION_FILE = '/private/tmp/claude-501/-Users-giovanniscozzafava-Repository-skorpio-v3-skorpiov3/9ce25824-45d9-438c-af92-f2eb8cd1cf10/scratchpad/foto_session.json'
const OUT = '/private/tmp/claude-501/-Users-giovanniscozzafava-Repository-skorpio-v3-skorpiov3/9ce25824-45d9-438c-af92-f2eb8cd1cf10/scratchpad'
const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await context.addInitScript(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), {
  key: 'sb-zfwlkvqxfzvubmfyxofs-auth-token', value: session,
})
await context.addInitScript(() => {
  const style = document.createElement('style')
  style.textContent = '[class*="z-\\[60\\]"],[class*="z-\\[61\\]"],[class*="z-\\[62\\]"]{display:none!important}'
  const attach = () => document.head?.appendChild(style)
  if (document.head) attach(); else document.addEventListener('DOMContentLoaded', attach)
})
const page = await context.newPage()
await page.goto(BASE + '/clienti', { waitUntil: 'domcontentloaded' })
await sleep(2500)
try { await page.getByText('Accetta tutto', { exact: true }).first().click({ timeout: 1500 }) } catch {}
await sleep(500)

// apre il menu (hamburger in alto a sinistra)
const burger = page.locator('header button, nav button').first()
await burger.click({ timeout: 5000 }).catch(async () => {
  await page.mouse.click(24, 16)
})
await sleep(1200)
await page.screenshot({ path: `${OUT}/nav_menu.png` })

const links = await page.locator('a').evaluateAll((els) =>
  els.map((e) => ({ text: (e.textContent || '').trim().slice(0, 40), href: e.getAttribute('href') }))
     .filter((l) => l.href && l.text)
)
fs.writeFileSync(`${OUT}/nav_links.json`, JSON.stringify(links, null, 2))
console.log(`✓ ${links.length} link trovati, screenshot in nav_menu.png`)
console.log(links.slice(0, 40).map((l) => `${l.text} → ${l.href}`).join('\n'))

await browser.close()
