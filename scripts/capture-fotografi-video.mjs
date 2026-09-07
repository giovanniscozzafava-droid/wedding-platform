#!/usr/bin/env node
// Catture mobile reali per il video verticale "Planfully per i fotografi".
// Sessione iniettata via localStorage (stesso access/refresh token della
// sessione password-grant di Luce d'Autore Fotografia), viewport verticale
// reale (CAPTURE_W x CAPTURE_H del progetto video), un browser context per
// capitolo così ogni video parte pulito e la durata è quella vera registrata.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'https://planfully.it'
const OUT_DIR = path.resolve('/Users/giovanniscozzafava/Repository/planfully-video-fotografi/public/captures')
const SESSION_FILE = '/private/tmp/claude-501/-Users-giovanniscozzafava-Repository-skorpio-v3-skorpiov3/9ce25824-45d9-438c-af92-f2eb8cd1cf10/scratchpad/foto_session.json'
const PROJECT_REF = 'zfwlkvqxfzvubmfyxofs'
// Viewport CSS reale (iPhone 14 Pro): sotto il breakpoint mobile del sito.
// 1080 di larghezza veniva letto come desktop dai media query — niente sidebar
// mobile, niente bottom nav.
// Attenzione: recordVideo di Playwright cattura alla risoluzione del VIEWPORT
// CSS, non moltiplicata per deviceScaleFactor — chiedere un recordVideo.size
// più grande del viewport non lo ingrandisce, lascia solo il resto grigio
// (bordo destro/basso). Quindi recordVideo.size deve combaciare col viewport.
const CAPTURE_W = 430
const CAPTURE_H = 932

fs.mkdirSync(OUT_DIR, { recursive: true })
const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function dismissOverlays(page) {
  // Filo è già nascosto via CSS (hideFilo): qui resta solo il banner cookie.
  try {
    const btn = page.getByText('Accetta tutto', { exact: true }).first()
    await btn.click({ timeout: 1500 })
    await sleep(300)
  } catch { /* banner non presente su questa pagina */ }
}

async function injectSession(context) {
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, { key: `sb-${PROJECT_REF}-auth-token`, value: session })
}

// L'assistente "Filo" (pulsante flottante + pannelli + backdrop) usa classi
// Tailwind fisse z-[60]/z-[61]/z-[62]: il suo backdrop a tutto schermo
// intercetta i click destinati al banner cookie sottostante, quindi cliccarlo
// via selettore è inaffidabile. Lo nascondiamo del tutto via CSS iniettato
// prima ancora che React monti — niente popup da inseguire.
// Insieme a Filo togliamo di mezzo anche il banner cookie: il consenso viene
// scritto in localStorage prima del primo render, così non compare mai nelle
// riprese invece di doverlo cliccare via (e sperare che non torni).
async function hideFilo(context) {
  await context.addInitScript((cookieKey) => {
    window.localStorage.setItem(cookieKey, JSON.stringify({ level: 'all', at: Date.now() }))
    const style = document.createElement('style')
    style.textContent = '[class*="z-\\[60\\]"],[class*="z-\\[61\\]"],[class*="z-\\[62\\]"]{display:none!important}'
    const attach = () => document.head?.appendChild(style)
    if (document.head) attach()
    else document.addEventListener('DOMContentLoaded', attach)
  }, 'planfully-cookie-consent-v1')
}

async function withCapture(browser, { name, capitolo, descrizione, path: urlPath }, run) {
  const context = await browser.newContext({
    viewport: { width: CAPTURE_W, height: CAPTURE_H },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT_DIR, size: { width: CAPTURE_W, height: CAPTURE_H } },
  })
  await injectSession(context)
  await hideFilo(context)
  const page = await context.newPage()
  const keyframes = []
  const t0 = Date.now()
  const mark = (x, y, label) => keyframes.push({ t: (Date.now() - t0) / 1000, x, y, label })
  const realisticClick = async (x, y, label) => {
    await page.mouse.move(x, y, { steps: 22 })
    await sleep(120)
    await page.mouse.down()
    await sleep(90)
    await page.mouse.up()
    mark(x, y, label)
  }

  let ok = true
  try {
    await page.goto(BASE + urlPath, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(1200)
    await dismissOverlays(page)
    await run({ page, mark, realisticClick })
  } catch (e) {
    ok = false
    console.error(`  ✗ ${name}: ${e.message.split('\n')[0]}`)
  }
  const durata = (Date.now() - t0) / 1000
  await page.close()
  await context.close()
  // Playwright scrive il file video solo alla chiusura del context, con nome generato.
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm') && !f.startsWith('cap'))
  const latest = files.map((f) => ({ f, t: fs.statSync(path.join(OUT_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0]
  if (!latest) { console.error(`  ✗ ${name}: nessun video prodotto`); return null }
  const finalName = `${name}.webm`
  fs.renameSync(path.join(OUT_DIR, latest.f), path.join(OUT_DIR, finalName))
  const kfFile = keyframes.length ? `${name}.keyframes.json` : null
  if (kfFile) fs.writeFileSync(path.join(OUT_DIR, kfFile), JSON.stringify(keyframes, null, 2))
  console.log(`  ${ok ? '✓' : '⚠'} ${name} → ${durata.toFixed(1)}s, ${keyframes.length} keyframe`)
  return { file: finalName, capitolo, descrizione, durata_secondi: Math.round(durata * 10) / 10, keyframes_file: kfFile }
}

const QUOTE_ID = 'b10c0000-0000-4000-8000-000000000301'
const ENTRY_ID = 'f7fcb0e7-84ff-42a0-8b4a-50eb3049a935'

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' })
  const manifest = []

  // Digitazione vera nel form "Nuovo cliente" (poi si annulla: la ripresa non
  // deve lasciare dati veri sull'account), così si vede scrivere davvero.
  const digita = async (page, locator, testo, mark) => {
    await locator.scrollIntoViewIfNeeded({ timeout: 6000 })
    const box = await locator.boundingBox().catch(() => null)
    await locator.click({ timeout: 6000 })
    if (box) mark(box.x + box.width / 2, box.y + box.height / 2, 'scrive')
    await locator.type(testo, { delay: 70 })
    await sleep(500)
  }

  manifest.push(await withCapture(browser, { name: 'cap02_funnel', capitolo: 2, descrizione: 'Funnel lead: elenco + nuovo cliente digitato', path: '/clienti' }, async ({ page, mark }) => {
    await page.waitForSelector('text=Martina Le Piane', { timeout: 15000 }).catch(() => {})
    await sleep(700)
    await page.mouse.wheel(0, 260)
    await sleep(800)
    await page.getByText('Nuovo cliente', { exact: false }).first().click({ timeout: 6000 }).catch(() => {})
    await sleep(600)
    await digita(page, page.locator('#full_name'), 'Elisa Marino', mark).catch(() => {})
    await digita(page, page.locator('#location_text'), 'Tenuta San Marco', mark).catch(() => {})
    await sleep(900)
    await page.getByText('Annulla', { exact: false }).first().click({ timeout: 4000 }).catch(() => {})
    await sleep(1200)
  }))

  manifest.push(await withCapture(browser, { name: 'cap03_preventivo', capitolo: 3, descrizione: 'Preventivo Femia-Surace (QuoteEditorPage)', path: `/quotes/${QUOTE_ID}` }, async ({ page }) => {
    await sleep(1200)
    await page.mouse.wheel(0, 400)
    await sleep(900)
    await page.mouse.wheel(0, 400)
    await sleep(1400)
  }))

  // Clic "vero" ma affidabile: scrollIntoView + click nativo di Playwright
  // (gestisce da solo attesa/scroll), poi rileva la posizione per il segno
  // visivo (ClickRing) SENZA fare affidamento sul solo mouse manuale.
  const clickReal = async (page, locator, label, mark) => {
    await locator.scrollIntoViewIfNeeded({ timeout: 8000 })
    await sleep(400)
    const box = await locator.boundingBox().catch(() => null)
    await locator.click({ timeout: 8000 })
    if (box) mark(box.x + box.width / 2, box.y + box.height / 2, label)
  }

  manifest.push(await withCapture(browser, { name: 'cap04_contratto', capitolo: 4, descrizione: 'Contratto firmato (SupplierContractsPage)', path: '/my-contracts' }, async ({ page, mark }) => {
    await page.waitForSelector('text=Femia-Surace', { timeout: 15000 }).catch(() => {})
    await sleep(600)
    const el = page.getByText('Fatture e pagamenti', { exact: false }).first()
    await clickReal(page, el, 'apri fatture e pagamenti', mark).catch((e) => console.error('  (cap04 click)', e.message.split('\n')[0]))
    await sleep(1800)
  }))

  manifest.push(await withCapture(browser, { name: 'cap05_fattura', capitolo: 5, descrizione: 'Crea fattura — hint Fatture in Cloud', path: '/my-contracts' }, async ({ page, mark }) => {
    await page.waitForSelector('text=Femia-Surace', { timeout: 15000 }).catch(() => {})
    await sleep(600)
    const openEl = page.getByText('Fatture e pagamenti', { exact: false }).first()
    await clickReal(page, openEl, 'apri fatture e pagamenti', mark).catch((e) => console.error('  (cap05 open)', e.message.split('\n')[0]))
    await sleep(900)
    const btn = page.getByText('Crea fattura', { exact: false }).first()
    await clickReal(page, btn, 'crea fattura', mark).catch((e) => console.error('  (cap05 crea fattura)', e.message.split('\n')[0]))
    await sleep(500)
    const submit = page.getByText('Emetti fattura', { exact: false }).first()
    await clickReal(page, submit, 'emetti fattura', mark).catch((e) => console.error('  (cap05 emetti)', e.message.split('\n')[0]))
    await sleep(2500)
  }))

  manifest.push(await withCapture(browser, { name: 'cap07_galleria', capitolo: 7, descrizione: 'Galleria evento — selezione sposi e condivisione', path: `/weddings/${ENTRY_ID}?tab=foto` }, async ({ page }) => {
    await sleep(1500)
    await page.mouse.wheel(0, 500)
    await sleep(900)
    await page.mouse.wheel(0, 500)
    await sleep(1400)
  }))

  manifest.push(await withCapture(browser, { name: 'cap09_carosello', capitolo: 9, descrizione: 'Carosello a swipe (CaroselloPage)', path: `/carosello/${ENTRY_ID}` }, async ({ page, realisticClick }) => {
    await sleep(1400)
    await page.mouse.wheel(0, 300)
    await sleep(800)
    const cards = page.locator('img').first()
    const box = await cards.boundingBox().catch(() => null)
    if (box) await realisticClick(box.x + box.width / 2, box.y + box.height / 2, 'foto carosello')
    await sleep(1400)
  }))

  manifest.push(await withCapture(browser, { name: 'cap10_album', capitolo: 10, descrizione: 'Impaginatore album con commento', path: `/album/${ENTRY_ID}` }, async ({ page }) => {
    await sleep(1500)
    await page.mouse.wheel(0, 400)
    await sleep(900)
    await page.mouse.wheel(0, 400)
    await sleep(1400)
  }))

  manifest.push(await withCapture(browser, { name: 'cap11_qr', capitolo: 11, descrizione: 'QR invitati (EventGalleryTab)', path: `/weddings/${ENTRY_ID}?tab=foto` }, async ({ page, realisticClick }) => {
    await sleep(1200)
    const inviteText = page.getByText(/invitat/i).first()
    const box = await inviteText.boundingBox().catch(() => null)
    if (box) { await page.mouse.wheel(0, Math.max(box.y - 400, 0)); await sleep(600) }
    await sleep(1600)
  }))

  await browser.close()

  const finalManifest = manifest.filter(Boolean)
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(finalManifest, null, 2))
  console.log(`\n✓ ${finalManifest.length}/${manifest.length} catture riuscite → ${path.join(OUT_DIR, 'manifest.json')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
