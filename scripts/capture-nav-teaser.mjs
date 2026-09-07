#!/usr/bin/env node
// Catture di NAVIGAZIONE reale per i video: percorsi continui che aprono il
// menu mobile, cambiano pagina, entrano nei dettagli e DIGITANO davvero nei
// campi. Nessun popup di mezzo: il consenso cookie è già in localStorage e
// l'assistente Filo è nascosto via CSS prima ancora che React monti.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'https://planfully.it'
const OUT_DIR = path.resolve('/Users/giovanniscozzafava/Repository/planfully-video-fotografi/public/captures')
const SESSION_FILE = '/private/tmp/claude-501/-Users-giovanniscozzafava-Repository-skorpio-v3-skorpiov3/9ce25824-45d9-438c-af92-f2eb8cd1cf10/scratchpad/foto_session.json'
const PROJECT_REF = 'zfwlkvqxfzvubmfyxofs'
const COOKIE_KEY = 'planfully-cookie-consent-v1'
const CAPTURE_W = 430
const CAPTURE_H = 932
const ENTRY_ID = 'f7fcb0e7-84ff-42a0-8b4a-50eb3049a935'

const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function newCtx(browser) {
  const context = await browser.newContext({
    viewport: { width: CAPTURE_W, height: CAPTURE_H },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT_DIR, size: { width: CAPTURE_W, height: CAPTURE_H } },
  })
  await context.addInitScript(
    ({ authKey, authValue, cookieKey }) => {
      window.localStorage.setItem(authKey, JSON.stringify(authValue))
      // consenso cookie già dato: il banner non deve mai comparire nelle riprese
      window.localStorage.setItem(cookieKey, JSON.stringify({ level: 'all', at: Date.now() }))
      const style = document.createElement('style')
      // Filo: pulsante flottante, pannelli e backdrop (z-[60..62])
      style.textContent = '[class*="z-\\[60\\]"],[class*="z-\\[61\\]"],[class*="z-\\[62\\]"]{display:none!important}'
      const attach = () => document.head?.appendChild(style)
      if (document.head) attach()
      else document.addEventListener('DOMContentLoaded', attach)
    },
    { authKey: `sb-${PROJECT_REF}-auth-token`, authValue: session, cookieKey: COOKIE_KEY },
  )
  return context
}

async function record(browser, { name, capitolo, descrizione, start }, run) {
  const context = await newCtx(browser)
  const page = await context.newPage()
  const keyframes = []
  const t0 = Date.now()
  const mark = (x, y, label) => keyframes.push({ t: (Date.now() - t0) / 1000, x, y, label })

  const tap = async (locator, label) => {
    await locator.scrollIntoViewIfNeeded({ timeout: 6000 })
    await sleep(250)
    const box = await locator.boundingBox().catch(() => null)
    await locator.click({ timeout: 6000 })
    if (box) mark(box.x + box.width / 2, box.y + box.height / 2, label)
    await sleep(800)
  }
  // digitazione vera, carattere per carattere: si deve vedere che si scrive
  const type = async (locator, testo, label) => {
    await locator.scrollIntoViewIfNeeded({ timeout: 6000 })
    const box = await locator.boundingBox().catch(() => null)
    await locator.click({ timeout: 6000 })
    if (box) mark(box.x + box.width / 2, box.y + box.height / 2, label)
    await locator.type(testo, { delay: 70 })
    await sleep(600)
  }
  const openMenu = async () => {
    const burger = page.locator('header button, nav button').first()
    await tap(burger, 'menu').catch(async () => { await page.mouse.click(24, 16); mark(24, 16, 'menu') })
    await sleep(600)
  }

  let ok = true
  try {
    await page.goto(BASE + start, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(1800)
    await run({ page, tap, type, openMenu, mark })
  } catch (e) {
    ok = false
    console.error(`  ✗ ${name}: ${e.message.split('\n')[0]}`)
  }
  const durata = (Date.now() - t0) / 1000
  await page.close()
  await context.close()

  const raw = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm') && !f.startsWith('cap') && !f.startsWith('nav'))
  const latest = raw.map((f) => ({ f, t: fs.statSync(path.join(OUT_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0]
  if (!latest) { console.error(`  ✗ ${name}: nessun video`); return null }
  fs.renameSync(path.join(OUT_DIR, latest.f), path.join(OUT_DIR, `${name}.webm`))
  const kfFile = keyframes.length ? `${name}.keyframes.json` : null
  if (kfFile) fs.writeFileSync(path.join(OUT_DIR, kfFile), JSON.stringify(keyframes, null, 2))
  console.log(`  ${ok ? '✓' : '⚠'} ${name} → ${durata.toFixed(1)}s, ${keyframes.length} keyframe`)
  return { file: `${name}.webm`, capitolo, descrizione, durata_secondi: Math.round(durata * 10) / 10, keyframes_file: kfFile }
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' })
  const out = []

  // 1) Nuovo cliente con DIGITAZIONE vera, poi si annulla (non sporchiamo i dati)
  out.push(await record(browser, {
    name: 'nav01_pipeline', capitolo: 2,
    descrizione: 'Nuovo cliente digitato + navigazione a preventivi/contratti/fattura',
    start: '/clienti',
  }, async ({ page, tap, type, openMenu }) => {
    await tap(page.getByText('Nuovo cliente', { exact: false }).first(), 'nuovo cliente')
    await sleep(500)
    await type(page.locator('#full_name'), 'Elisa Marino', 'nome cliente')
    await type(page.locator('#partner_name'), 'Davide Fera', 'partner')
    await type(page.locator('#location_text'), 'Tenuta San Marco', 'location')
    await sleep(900)
    await tap(page.getByText('Annulla', { exact: false }).first(), 'annulla').catch(() => {})
    await sleep(700)
    await openMenu()
    await tap(page.getByRole('link', { name: 'Preventivi' }).first(), 'vai a Preventivi')
    await sleep(1100)
    await tap(page.getByText('Femia-Surace', { exact: false }).first(), 'apri preventivo').catch(() => {})
    await sleep(1100)
    await page.mouse.wheel(0, 420); await sleep(900)
    await openMenu()
    await tap(page.getByRole('link', { name: 'Contratti' }).first(), 'vai a Contratti')
    await sleep(1200)
    await tap(page.getByText('Fatture e pagamenti', { exact: false }).first(), 'fatture e pagamenti').catch(() => {})
    await sleep(800)
    await tap(page.getByText('Crea fattura', { exact: false }).first(), 'crea fattura').catch(() => {})
    await sleep(1500)
  }))

  // 2) Eventi → evento → ricordi → galleria foto
  out.push(await record(browser, {
    name: 'nav02_foto', capitolo: 3,
    descrizione: 'Navigazione reale: eventi → evento → ricordi → galleria foto',
    start: '/weddings',
  }, async ({ page, tap }) => {
    await sleep(800)
    await tap(page.getByText('Femia', { exact: false }).first(), 'apri evento').catch(() => {})
    await sleep(1300)
    await tap(page.getByText('Ricordi', { exact: false }).first(), 'tab Ricordi').catch(() => {})
    await sleep(1100)
    await tap(page.getByText('Foto', { exact: true }).first(), 'tab Foto').catch(() => {})
    await sleep(1400)
    await page.mouse.wheel(0, 500); await sleep(1000)
    await page.mouse.wheel(0, 500); await sleep(1300)
  }))

  // 3) Impaginatore album
  out.push(await record(browser, {
    name: 'nav03_album', capitolo: 3,
    descrizione: 'Impaginatore album',
    start: `/album/${ENTRY_ID}`,
  }, async ({ page }) => {
    await sleep(2000)
    await page.mouse.wheel(0, 400); await sleep(1000)
    await page.mouse.wheel(0, 400); await sleep(1300)
  }))

  await browser.close()
  const manifest = out.filter(Boolean)
  fs.writeFileSync(path.join(OUT_DIR, 'nav-manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\n✓ ${manifest.length}/${out.length} percorsi registrati`)
}

main().catch((e) => { console.error(e); process.exit(1) })
