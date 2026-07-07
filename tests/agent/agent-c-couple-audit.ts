/* eslint-disable @typescript-eslint/no-explicit-any */
// AGENT C - audit completo lato COPPIA SPOSI in PROD planfully.it
import { chromium, type Page, type BrowserContext } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROD = 'https://planfully.it'
const SB_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SB_SERVICE = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } })

const COUPLE_EMAIL = 'giovanni.scozzafava+sposo@gmail.com'
const COUPLE_PASS  = 'Beta2026!'
const WID          = '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea'
const SLUG         = 'giovanni-e-pingu'
const QUOTE_TOKEN  = '808106f5-5442-471b-9f12-82a814169339' // Andrea e Sofia ACCETTATO
const CONTRACT_TOKEN = '0a46ca52-f5e5-4339-9fc9-b58e93ce2fad' // FIRMATO
const PREFIX = 'AGENT-C-'

const TS = process.env.AUDIT_TS ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = `/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-C-couple-${TS}`

type Bug = { sev: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; area: string; title: string; details?: string; screenshot?: string }
const bugs: Bug[] = []
const lines: string[] = []
const log = (s: string) => { console.log(s); lines.push(s) }
const addBug = (b: Bug) => { bugs.push(b); log(`  [BUG ${b.sev}] ${b.area} :: ${b.title}${b.details ? ' — ' + b.details : ''}`) }

let shotN = 0
async function shot(page: Page, label: string) {
  shotN++
  const fn = `couple-${String(shotN).padStart(2, '0')}-${label}.png`
  await page.screenshot({ path: path.join(OUT, fn), fullPage: true }).catch(() => null)
  return fn
}

async function dumpConsole(page: Page, label: string) {
  const errs = (page as any).__errs ?? []
  if (errs.length) log(`  console-errors [${label}]: ${JSON.stringify(errs.slice(-10))}`)
}

function attach(page: Page) {
  ;(page as any).__errs = []
  page.on('pageerror', (e) => (page as any).__errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') (page as any).__errs.push('console: ' + m.text()) })
}

async function loginCouple(ctx: BrowserContext) {
  const page = await ctx.newPage()
  attach(page)
  log('→ /login (couple)')
  await page.goto(`${PROD}/login`, { waitUntil: 'networkidle', timeout: 30_000 })
  await shot(page, 'login-blank')
  await page.locator('input[type="email"]').fill(COUPLE_EMAIL).catch(() => null)
  await page.locator('input[type="password"]').fill(COUPLE_PASS).catch(() => null)
  await shot(page, 'login-filled')
  await Promise.all([
    page.waitForURL(/\/couple|\/$/, { timeout: 20_000 }).catch(() => null),
    page.locator('button[type="submit"]').click().catch(() => null),
  ])
  await page.waitForTimeout(2500)
  log(`  POST-LOGIN URL: ${page.url()}`)
  await shot(page, 'after-login')
  return page
}

async function clickTab(page: Page, label: string) {
  // tab buttons hold their label text
  const btn = page.locator(`nav button:has-text("${label}")`).first()
  if (await btn.count() === 0) {
    addBug({ sev: 'HIGH', area: 'Tabs', title: `Tab "${label}" non trovato` })
    return false
  }
  await btn.click().catch(() => null)
  await page.waitForTimeout(900)
  return true
}

async function auditCoupleDashboard(page: Page) {
  log('\n## DASHBOARD /couple')
  if (!page.url().includes('/couple')) {
    log('  redirect/forzo a /couple')
    await page.goto(`${PROD}/couple`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
  }
  await shot(page, 'couple-root')
  await dumpConsole(page, 'dashboard-root')

  // logo planfully visibility
  const hasLogo = await page.locator('img[alt="Planfully"], img[src*="planfully"]').count()
  if (!hasLogo) addBug({ sev: 'MEDIUM', area: 'Branding', title: 'Logo Planfully non trovato in top bar' })
  else log('  logo Planfully presente OK')

  // hero countdown
  const hero = await page.locator('h1').first().textContent().catch(() => '')
  log('  hero h1: ' + (hero ?? ''))

  const countdown = await page.locator('text=/Mancano/').count()
  log('  countdown presente: ' + (countdown > 0))
  if (countdown === 0) addBug({ sev: 'LOW', area: 'Overview', title: 'Countdown mancante (forse data passata)' })

  // tabs presence check
  const expectedTabs = ['Overview', 'Documenti', 'Programma', 'Alloggi', 'Trasporti', 'Invitati', 'Tavoli', 'Mood board', 'Playlist', 'Bomboniere', 'Sito ospiti']
  for (const t of expectedTabs) {
    const c = await page.locator(`nav button:has-text("${t}")`).count()
    if (c === 0) addBug({ sev: 'HIGH', area: 'Tabs', title: `Tab "${t}" assente` })
  }

  // OVERVIEW
  await clickTab(page, 'Overview')
  await shot(page, 'tab-overview')
  await dumpConsole(page, 'overview')
  const owner = await page.locator('text=/Wedding planner/').count()
  if (!owner) addBug({ sev: 'MEDIUM', area: 'Overview', title: 'Riga "Wedding planner" assente in Overview' })

  // DOCUMENTI
  await clickTab(page, 'Documenti')
  await shot(page, 'tab-documenti')
  await dumpConsole(page, 'documenti')
  const docTitles = await page.locator('text=/Preventivo|Contratto/').count()
  log('  documenti sezioni: ' + docTitles)

  // PROGRAMMA
  await clickTab(page, 'Programma')
  await shot(page, 'tab-programma')
  await dumpConsole(page, 'programma')

  // ALLOGGI
  await clickTab(page, 'Alloggi')
  await shot(page, 'tab-alloggi')
  await dumpConsole(page, 'alloggi')

  // TRASPORTI
  await clickTab(page, 'Trasporti')
  await shot(page, 'tab-trasporti')
  await dumpConsole(page, 'trasporti')

  // INVITATI
  await clickTab(page, 'Invitati')
  await shot(page, 'tab-invitati')
  await dumpConsole(page, 'invitati')

  // TAVOLI
  await clickTab(page, 'Tavoli')
  await shot(page, 'tab-tavoli')
  await dumpConsole(page, 'tavoli')

  // MOOD - prova ad aggiungere URL invalido + valido
  await clickTab(page, 'Mood board')
  await shot(page, 'tab-mood')
  await dumpConsole(page, 'mood')

  const moodInput = page.locator('input[placeholder*="Pinterest"], input[placeholder*="URL"]').first()
  if (await moodInput.count() > 0) {
    // invalid first
    await moodInput.fill('not-a-url-' + PREFIX)
    await page.locator('button:has-text("Aggiungi")').first().click().catch(() => null)
    await page.waitForTimeout(1500)
    await shot(page, 'mood-invalid')
    // valid pinterest URL
    await moodInput.fill('https://i.pinimg.com/736x/aa/bb/cc/' + PREFIX + 'demo.jpg')
    await page.locator('button:has-text("Aggiungi")').first().click().catch(() => null)
    await page.waitForTimeout(3500)
    await shot(page, 'mood-after-add')
    await dumpConsole(page, 'mood-add')
  } else {
    addBug({ sev: 'HIGH', area: 'Mood', title: 'Input mood (Pinterest URL) non trovato' })
  }

  // PLAYLIST
  await clickTab(page, 'Playlist')
  await shot(page, 'tab-playlist')
  await dumpConsole(page, 'playlist')
  const songInput = page.locator('input[placeholder*="Titolo brano"]')
  if (await songInput.count() > 0) {
    await songInput.fill(PREFIX + 'Cancion test')
    const artistInput = page.locator('input[placeholder*="Artista"]')
    await artistInput.fill(PREFIX + 'Artista test')
    await page.locator('button:has-text("Suggerisci")').first().click().catch(() => null)
    await page.waitForTimeout(2000)
    await shot(page, 'playlist-after-add')
    await dumpConsole(page, 'playlist-add')
  } else {
    addBug({ sev: 'HIGH', area: 'Playlist', title: 'Input "Titolo brano" non trovato' })
  }

  // BOMBONIERE
  await clickTab(page, 'Bomboniere')
  await shot(page, 'tab-bomboniere')
  await dumpConsole(page, 'bomboniere')

  // SITO OSPITI
  await clickTab(page, 'Sito ospiti')
  await shot(page, 'tab-website')
  await dumpConsole(page, 'website')
  const siteLink = await page.locator(`a[href*="/w/${SLUG}"]`).first()
  const slugLink = await siteLink.count() > 0 ? await siteLink.getAttribute('href') : null
  log('  sito ospiti link: ' + slugLink)
  if (!slugLink) addBug({ sev: 'MEDIUM', area: 'Website', title: 'Link sito ospiti assente nel tab Website' })

  // FOOTER presence
  const footer = await page.locator('footer').count()
  if (footer === 0) addBug({ sev: 'LOW', area: 'Layout', title: 'Footer assente in /couple' })

  // CHANGE REQUEST: prova ad aprire modal da Programma
  await clickTab(page, 'Programma')
  await page.waitForTimeout(500)
  // change request modals sono tipicamente button "Suggerisci modifica" o icon
  const crButtons = page.locator('button:has-text("Suggerisci"), button:has-text("Modifica"), button:has-text("Richiedi")')
  const crCount = await crButtons.count()
  log('  Programma: pulsanti change-request count=' + crCount)

  // Prova lato Alloggi (qui esiste CRModal nella view)
  await clickTab(page, 'Alloggi')
  await page.waitForTimeout(700)
  const modalTrigger = page.locator('button:has-text("Suggerisci modifica"), button:has-text("Richiedi modifica"), [aria-label*="modifica"]').first()
  if (await modalTrigger.count() > 0) {
    await modalTrigger.click().catch(() => null)
    await page.waitForTimeout(1200)
    await shot(page, 'changerequest-modal')
    // chiudi
    await page.keyboard.press('Escape').catch(() => null)
  }
}

async function auditCoupleHardBlocks(page: Page) {
  log('\n## ACCESS BLOCKS (coppia non deve vedere WP pages)')
  for (const u of ['/weddings', '/suppliers', '/catalog']) {
    await page.goto(`${PROD}${u}`, { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => null)
    await page.waitForTimeout(1500)
    const url = page.url()
    log(`  ${u} → ${url}`)
    await shot(page, 'block' + u.replace(/\//g, '-'))
    if (url.endsWith(u)) {
      addBug({ sev: 'CRITICAL', area: 'Access control', title: `COUPLE puo accedere a ${u}`, details: `URL finale: ${url}` })
    }
  }
}

async function auditLogout(page: Page) {
  log('\n## LOGOUT')
  await page.goto(`${PROD}/couple`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // logout button is the LogOut icon in topbar — last button.ghost
  const logoutBtn = page.locator('header button').last()
  await logoutBtn.click().catch(() => null)
  await page.waitForTimeout(2500)
  log('  POST-LOGOUT URL: ' + page.url())
  await shot(page, 'after-logout')
  if (!page.url().includes('/login')) addBug({ sev: 'HIGH', area: 'Auth', title: 'Logout non redirige a /login', details: 'URL: ' + page.url() })
}

async function auditPublicPages(ctx: BrowserContext) {
  log('\n## PUBLIC PAGES (no auth)')
  const page = await ctx.newPage()
  attach(page)

  // /w/:slug
  log('→ /w/' + SLUG)
  await page.goto(`${PROD}/w/${SLUG}`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(2500)
  await shot(page, 'public-weddingsite')
  await dumpConsole(page, 'wedsite')
  const sposiTitle = await page.locator('h1').first().textContent().catch(() => '')
  log('  hero h1: ' + sposiTitle)
  if (!sposiTitle?.toLowerCase().includes('giovanni') && !sposiTitle?.toLowerCase().includes('pingu')) {
    addBug({ sev: 'HIGH', area: 'WeddingSite', title: 'H1 hero non mostra sposi', details: 'h1=' + sposiTitle })
  }
  // RSVP form
  const rsvpForm = await page.locator('form, [data-rsvp], button:has-text("RSVP"), button:has-text("Conferma")').count()
  log('  RSVP form-ish elements: ' + rsvpForm)
  if (rsvpForm === 0) addBug({ sev: 'MEDIUM', area: 'WeddingSite', title: 'Form RSVP assente' })

  // /privacy
  log('→ /privacy')
  await page.goto(`${PROD}/privacy`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await shot(page, 'public-privacy')
  await dumpConsole(page, 'privacy')

  // /cookie
  log('→ /cookie')
  await page.goto(`${PROD}/cookie`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await shot(page, 'public-cookie')

  // /p/preview/:token
  log('→ /p/preview/' + QUOTE_TOKEN)
  await page.goto(`${PROD}/p/preview/${QUOTE_TOKEN}`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(2500)
  await shot(page, 'public-quote-preview')
  await dumpConsole(page, 'quote-preview')
  const len = (await page.locator('body').innerText().catch(() => '')).length
  log('  quote preview body len: ' + len)
  if (len < 100) addBug({ sev: 'HIGH', area: 'PublicQuote', title: 'Preview preventivo pubblico sembra vuoto', details: 'len=' + len })

  // /p/accept/:token (su quote ACCETTATO si aspetta stato "già accettato")
  log('→ /p/accept/' + QUOTE_TOKEN)
  await page.goto(`${PROD}/p/accept/${QUOTE_TOKEN}`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(2500)
  await shot(page, 'public-quote-accept')
  await dumpConsole(page, 'quote-accept')

  // /p/reject/:token
  log('→ /p/reject/' + QUOTE_TOKEN)
  await page.goto(`${PROD}/p/reject/${QUOTE_TOKEN}`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(2500)
  await shot(page, 'public-quote-reject')
  await dumpConsole(page, 'quote-reject')

  // /p/contract/:token
  log('→ /p/contract/' + CONTRACT_TOKEN)
  await page.goto(`${PROD}/p/contract/${CONTRACT_TOKEN}`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(2500)
  await shot(page, 'public-contract')
  await dumpConsole(page, 'contract')
  await page.close()
}

async function auditInviteFlow(ctx: BrowserContext) {
  log('\n## INVITO COPPIA flow')
  // Crea un membro pending temporaneo
  const inviteEmail = `${PREFIX}invite-${Date.now()}@example.com`.toLowerCase()
  const inviteToken = crypto.randomUUID()
  const { data: ins, error: insErr } = await sb.from('wedding_couple_members').insert({
    entry_id: WID,
    email: inviteEmail,
    invited_email: inviteEmail,
    full_name: `${PREFIX}Demo`,
    role: 'TESTIMONE',
    invite_token: inviteToken,
    invited_at: new Date().toISOString(),
  }).select().maybeSingle()
  if (insErr) {
    log('  seed invite ERR: ' + JSON.stringify(insErr))
    // se la colonna invited_email non esiste, try senza
    const { data: ins2, error: insErr2 } = await sb.from('wedding_couple_members').insert({
      entry_id: WID,
      email: inviteEmail,
      full_name: `${PREFIX}Demo`,
      role: 'TESTIMONE',
      invite_token: inviteToken,
      invited_at: new Date().toISOString(),
    }).select().maybeSingle()
    if (insErr2) {
      log('  seed invite ERR2: ' + JSON.stringify(insErr2))
      addBug({ sev: 'MEDIUM', area: 'Invite', title: 'Impossibile seed-are un invito di test', details: insErr2.message })
      return
    }
  }
  log('  invite token: ' + inviteToken)

  const page = await ctx.newPage()
  attach(page)
  await page.goto(`${PROD}/invito-coppia/${inviteToken}`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(2500)
  await shot(page, 'invite-accept-form')
  await dumpConsole(page, 'invite-accept')
  const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 400)
  log('  body excerpt: ' + body.replace(/\s+/g, ' '))

  // Cleanup
  await sb.from('wedding_couple_members').delete().eq('invite_token', inviteToken)
  log('  invite seed cleanup OK')
  await page.close()
}

async function cleanup() {
  log('\n## CLEANUP AGENT-C-*')
  // mood items aggiunti dall'utente con caption ag-c
  const { data: prof } = await sb.from('profiles').select('id').eq('full_name', 'Giovanni Sposo').maybeSingle()
  // mood_board column name
  const tables = ['mood_items', 'mood_board', 'playlist_items', 'playlists', 'couple_change_requests']
  for (const t of tables) {
    // delete by entry id and caption-ish prefix
    const { error } = await sb.from(t).delete().like('caption' as any, `${PREFIX}%`).select() as any
    if (error) {
      // try song_title
      const { error: e2 } = await sb.from(t).delete().like('song_title' as any, `${PREFIX}%`).select() as any
      log(`  cleanup ${t}: ${e2 ? e2.message : 'song_title OK'}`)
    } else {
      log(`  cleanup ${t}: caption OK`)
    }
  }
  // wedding_couple_members con full_name AGENT-C
  const { data: dM, error: eM } = await sb.from('wedding_couple_members').delete().like('full_name', `${PREFIX}%`).select()
  log(`  cleanup members: ${eM ? eM.message : (dM?.length ?? 0) + ' rimossi'}`)
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  log(`AGENT-C couple audit — out=${OUT}`)

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  // Public first (no auth)
  await auditPublicPages(ctx)

  // Invite flow
  await auditInviteFlow(ctx)

  // Couple login
  const page = await loginCouple(ctx)

  if (!page.url().includes('/couple') && !page.url().endsWith('/')) {
    addBug({ sev: 'CRITICAL', area: 'Login', title: 'Login coppia non riesce o redirect strano', details: 'URL: ' + page.url() })
  }

  await auditCoupleDashboard(page)
  await auditCoupleHardBlocks(page)
  await auditLogout(page)

  await cleanup()

  await browser.close()

  // Write REPORT.md
  const sevs = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>
  bugs.forEach(b => sevs[b.sev]++)

  const report = `# AGENT C — Audit Coppia Sposi (PROD planfully.it)
Timestamp: ${TS}
User: ${COUPLE_EMAIL}
Wedding: ${WID} (slug: ${SLUG})

## Bugs summary
- CRITICAL: ${sevs.CRITICAL}
- HIGH: ${sevs.HIGH}
- MEDIUM: ${sevs.MEDIUM}
- LOW: ${sevs.LOW}
- Tot: ${bugs.length}

## Bugs

${bugs.map((b, i) => `### ${i + 1}. [${b.sev}] ${b.area} — ${b.title}\n${b.details ? '_' + b.details + '_\n' : ''}`).join('\n')}

## Log
\`\`\`
${lines.join('\n')}
\`\`\`
`
  await fs.writeFile(path.join(OUT, 'REPORT.md'), report)
  log('\nDONE. Bugs: ' + bugs.length)
  log('Report: ' + path.join(OUT, 'REPORT.md'))
}

main().catch(async (e) => {
  log('FATAL: ' + (e?.stack ?? String(e)))
  await fs.mkdir(OUT, { recursive: true }).catch(() => null)
  await fs.writeFile(path.join(OUT, 'REPORT.md'), `FATAL\n${e?.stack ?? e}\n\n${lines.join('\n')}`).catch(() => null)
  process.exit(1)
})
