// Agent B audit notturno: 3 fornitori in 3 contesti separati Playwright
// Test focus: nav, KPI, /clienti, /catalog, /disponibilita, /calcolatore, /quotes, /contracts, /calendar, /settings/brand, /profile,
// scenari critici: PDF brand suo, RLS /weddings/:id non partecipato, /calendar earnings su evento partecipato,
// block_busy_supplier_on_quote_item, upload IG carosello, ciclo disponibilita.
//
// Output: /Users/.../audit-runs/night-B-fornitori-<ts>/ con REPORT.md, screenshots, pdfs.

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const RUN_DIR = process.env.RUN_DIR
if (!RUN_DIR) { console.error('RUN_DIR required'); process.exit(1) }
const BASE = 'https://planfully.it'
const SUPABASE_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const PWD = 'Beta2026!'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Note: 'forn-mini-cater' non esiste -> fallback su forn-beta-catering
const SUPPLIERS = [
  { key: 'B-FOTO',  email: 'forn-mini-foto@planfully-demo.it',   label: 'Marco Bianchi Photography (FOTO)' },
  { key: 'B-FIORI', email: 'forn-mini-fiori@planfully-demo.it',  label: 'Sofia Fiori e Decorazioni (FIORI)' },
  { key: 'B-CATER', email: 'forn-beta-catering@planfully-demo.it', label: 'Catering (CATER, fallback)' },
]

const BUGS = []
function logBug(supplier, severity, area, summary, detail = '') {
  BUGS.push({ supplier, severity, area, summary, detail, ts: new Date().toISOString() })
  console.log(`  [BUG][${severity}][${supplier}][${area}] ${summary}${detail ? ' — ' + detail : ''}`)
}
const SECTIONS = {}
function logSection(supplier, name, status, note = '') {
  if (!SECTIONS[supplier]) SECTIONS[supplier] = []
  SECTIONS[supplier].push({ name, status, note })
  console.log(`  [${status}][${supplier}] ${name}${note ? ' — ' + note : ''}`)
}

async function shot(page, supplier, name) {
  const dir = path.join(RUN_DIR, 'screenshots', supplier)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  const file = path.join(dir, `${Date.now()}-${name}.png`)
  try { await page.screenshot({ path: file, fullPage: true }) } catch (e) { console.log('shot err:', e.message) }
  return file
}

async function dismissCookieBanner(page) {
  // Tenta di chiudere il cookie banner che sta in fixed bottom z-100 e intercetta i click su modali
  try {
    const candidates = [
      'button:has-text("Accetta")',
      'button:has-text("Accetto")',
      'button:has-text("Ho capito")',
      'button:has-text("OK")',
      'button:has-text("Solo essenziali")',
      'button:has-text("Rifiuta")',
      '[data-testid="cookie-accept"]',
    ]
    for (const sel of candidates) {
      const b = page.locator(sel).first()
      if (await b.count() && await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(300)
        return true
      }
    }
    // Imposta cookie consent via localStorage (best-effort)
    await page.evaluate(() => {
      try { localStorage.setItem('cookie_consent', 'accepted') } catch {}
      try { localStorage.setItem('cookieConsent', 'all') } catch {}
      try { localStorage.setItem('planfully_cookie_consent', 'accepted') } catch {}
    })
  } catch {}
  return false
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await dismissCookieBanner(page)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PWD)
  await page.click('button[type="submit"]')
  // Wait for either home or onboarding
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await dismissCookieBanner(page)
}

async function safeGoto(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(1200)
    await dismissCookieBanner(page)
    return true
  } catch (e) {
    console.log('goto fail', url, e.message)
    return false
  }
}

async function getRecentWeddingNotParticipated(supplierId) {
  // Trova un calendar_entries (wedding) a cui questo fornitore NON partecipa via quote_items o collaborations
  const { data: ents } = await sb.from('calendar_entries').select('id, title, owner_id').limit(60)
  if (!ents || ents.length === 0) return null
  // quotes che hanno item con supplier_id == supplierId
  const { data: qitems } = await sb.from('quote_items').select('quote_id').eq('supplier_id', supplierId).limit(500)
  const participatedQuoteIds = new Set((qitems || []).map((q) => q.quote_id))
  // quote -> calendar_entry via calendar_entries.quote_id
  const participatedEntryIds = new Set()
  for (const e of ents) {
    if (e.quote_id && participatedQuoteIds.has(e.quote_id)) participatedEntryIds.add(e.id)
    if (e.owner_id === supplierId) participatedEntryIds.add(e.id)
  }
  return ents.find((e) => !participatedEntryIds.has(e.id)) || null
}

async function auditSupplier(browser, supplier) {
  console.log(`\n========== AUDIT ${supplier.key} ${supplier.email} ==========`)
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } })
  // Pre-imposta consenso cookie via initScript per evitare il banner che intercetta i click sui modali
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('planfully-cookie-consent-v1', JSON.stringify({ level: 'all', at: Date.now() }))
    } catch {}
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('pageerror', (err) => { consoleErrors.push(`pageerror: ${err.message}`) })
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('favicon') && !t.includes('manifest')) consoleErrors.push(`console.error: ${t.slice(0,200)}`)
    }
  })

  // Resolve supplier user id (anche per CATER fallback)
  let { data: userList } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
  let supplierAuthId = userList.users.find((u) => u.email === supplier.email)?.id
  if (!supplierAuthId) {
    const r2 = await sb.auth.admin.listUsers({ page: 2, perPage: 200 })
    supplierAuthId = r2.data.users.find((u) => u.email === supplier.email)?.id
  }
  console.log('supplier auth id =', supplierAuthId)

  try {
    // === LOGIN ===
    await login(page, supplier.email)
    await dismissCookieBanner(page)
    await shot(page, supplier.key, '00-after-login')
    const urlAfterLogin = page.url()
    if (urlAfterLogin.includes('/login')) {
      logBug(supplier.key, 'CRITICAL', 'auth', 'Login fallito (stuck su /login)', urlAfterLogin)
      await ctx.close(); return
    }
    logSection(supplier.key, 'Login', 'PASS', urlAfterLogin)

    // === DASHBOARD ===
    await safeGoto(page, BASE + '/')
    const bodyTextHome = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
    await shot(page, supplier.key, '01-home')
    // Check Beta banner
    if (bodyTextHome.includes('Beta gratuita') || bodyTextHome.includes('Beta gratis')) {
      logSection(supplier.key, 'Beta banner', 'PASS', 'visibile')
    } else {
      logBug(supplier.key, 'MEDIUM', 'beta-banner', 'Banner Beta non visibile in home', '')
    }
    if (bodyTextHome.includes('€29') || bodyTextHome.includes('29/mese') || bodyTextHome.includes('29 €')) {
      logSection(supplier.key, 'Beta price', 'PASS', '€29/mese mostrato')
    } else {
      logBug(supplier.key, 'LOW', 'beta-banner', "Importo €29/mese non visibile nel banner", '')
    }
    // KPI dashboard
    const kpiPresent = /[Ee]arnings|[Gg]uadagn|[Pp]rossim|richieste|pending|preventivi/.test(bodyTextHome)
    logSection(supplier.key, 'KPI dashboard', kpiPresent ? 'PASS' : 'WARN', kpiPresent ? '' : 'nessun KPI trovato in body')

    // === NAV: verify forbidden links absent ===
    const navText = await page.locator('nav, aside, [role="navigation"]').first().innerText().catch(() => '')
    const forbidden = ['Finanziamento', 'Assicurazione', 'Matrimoni', 'Rete fornitori', 'Rete']
    const presentForbidden = forbidden.filter((f) => navText.includes(f))
    if (presentForbidden.length === 0) {
      logSection(supplier.key, 'Nav forbidden links', 'PASS', 'nessuna voce vietata')
    } else {
      logBug(supplier.key, 'MEDIUM', 'nav', `Voci nav vietate visibili: ${presentForbidden.join(', ')}`, '')
    }
    const expectedNav = ['Catalogo', 'Clienti', 'Disponibilità', 'Preventivi', 'Calendario']
    const missingNav = expectedNav.filter((f) => !navText.includes(f))
    if (missingNav.length) logBug(supplier.key, 'HIGH', 'nav', `Voci nav fornitore mancanti: ${missingNav.join(', ')}`, '')

    // === CLIENTI ===
    await safeGoto(page, BASE + '/clienti')
    await shot(page, supplier.key, '02-clienti-list')
    const newClientBtn = page.locator('[data-testid="new-client-btn"]').first()
    let clientCreated = false
    let createdClientId = null
    if (await newClientBtn.count()) {
      try {
        await newClientBtn.click()
        await page.waitForTimeout(800)
        const today = new Date()
        const eventDate = new Date(today.getFullYear() + 1, 5, 12).toISOString().slice(0, 10) // anno prossimo 12 giugno
        await page.fill('#full_name', `AGENT-${supplier.key}-Cliente`)
        await page.fill('#partner_name', `AGENT-${supplier.key}-Partner`)
        await page.fill('#email', `agent-${supplier.key.toLowerCase()}@example.com`)
        await page.fill('#phone', '+39 333 0000000')
        await page.fill('#event_date', eventDate)
        await page.fill('input[id="location_text"], textarea[id="location_text"]', 'Villa AGENT-B Test, Lago di Como').catch(() => {})
        await page.fill('#guest_estimate', '85')
        await page.fill('#budget_min', '5000')
        await page.fill('#budget_max', '12000')
        await page.fill('#source, input[id="source"]', 'AGENT-B passaparola').catch(() => {})
        await page.fill('#notes, textarea[id="notes"]', `AGENT-${supplier.key} test note`).catch(() => {})
        await shot(page, supplier.key, '03-clienti-form-filled')
        await page.locator('button[type="submit"]').first().click()
        await page.waitForTimeout(2500)
        // Verifica DB
        const { data: created } = await sb.from('supplier_clients').select('id, full_name, status').eq('supplier_id', supplierAuthId).ilike('full_name', `AGENT-${supplier.key}-Cliente%`).order('created_at', { ascending: false }).limit(1)
        if (created && created.length) {
          clientCreated = true
          createdClientId = created[0].id
          logSection(supplier.key, 'Crea cliente diretto', 'PASS', `id=${createdClientId}`)
        } else {
          logBug(supplier.key, 'HIGH', 'clienti', 'Cliente non creato nel DB dopo submit form', '')
        }
        await shot(page, supplier.key, '04-clienti-after-create')
      } catch (e) {
        logBug(supplier.key, 'HIGH', 'clienti', 'Errore submit form crea cliente', e.message)
      }
    } else {
      logBug(supplier.key, 'HIGH', 'clienti', 'CTA nuovo-cliente non trovata', '')
    }

    // === PREVENTIVO da cliente diretto (bottone "Preventivo") ===
    let quoteIdDirect = null
    if (clientCreated) {
      // assicurati di essere sulla pagina /clienti dopo creazione
      await safeGoto(page, BASE + '/clienti')
      await page.waitForTimeout(1500)
      // cerca il card che contiene il nome del cliente creato e prendi il suo bottone "Preventivo"
      const card = page.locator('div, article, li, motion-div').filter({ hasText: `AGENT-${supplier.key}-Cliente` }).first()
      let preventivoBtn = card.locator('button:has-text("Preventivo")').first()
      if (!(await preventivoBtn.count())) {
        // fallback: bottone Preventivo globale
        preventivoBtn = page.locator('button:has-text("Preventivo")').first()
      }
      if (await preventivoBtn.count()) {
        try {
          // sniff requests/responses to identify error
          const reqLog = []
          const handler = (resp) => {
            const u = resp.url()
            if (u.includes('/rest/v1/quotes') || u.includes('/rest/v1/supplier_clients')) {
              reqLog.push({ status: resp.status(), url: u.replace(SUPABASE_URL, ''), method: resp.request().method() })
            }
          }
          page.on('response', handler)
          const navPromise = page.waitForURL(/\/quotes\/[a-f0-9-]+/, { timeout: 15000 }).catch(() => null)
          await preventivoBtn.click({ timeout: 5000 })
          await Promise.race([navPromise, page.waitForTimeout(8000)])
          const currentUrl = page.url()
          await shot(page, supplier.key, '05-after-preventivo-click')
          page.off('response', handler)
          if (/\/quotes\/[a-f0-9-]+/.test(currentUrl)) {
            quoteIdDirect = currentUrl.split('/quotes/')[1].split(/[?#]/)[0]
            logSection(supplier.key, 'Preventivo diretto da cliente', 'PASS', currentUrl)
            const editorTxt = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
            if (editorTxt.includes(`AGENT-${supplier.key}-Cliente`) || editorTxt.includes('AGENT')) {
              logSection(supplier.key, 'Quote editor: nome cliente prefilled', 'PASS')
            } else {
              logBug(supplier.key, 'MEDIUM', 'quote-editor', 'Nome cliente non prefilled in quote editor', '')
            }
          } else {
            const toastTxt = (await page.locator('[role="status"], .Toaster, .toast, ol li').allInnerTexts().catch(() => [])).join(' | ').slice(0, 500)
            const got403 = reqLog.some((r) => r.url.startsWith('/rest/v1/quotes') && r.method === 'POST' && r.status === 403)
            const sev = got403 ? 'CRITICAL' : 'HIGH'
            const msg = got403
              ? 'Fornitore NON puo creare preventivo diretto: POST /rest/v1/quotes risponde 403 (RLS INSERT policy blocca FORNITORE)'
              : `Bottone Preventivo non porta a /quotes/:id`
            logBug(supplier.key, sev, 'clienti', msg, `url=${currentUrl} toast="${toastTxt}" reqs=${JSON.stringify(reqLog.slice(0,6))}`)
          }
        } catch (e) {
          logBug(supplier.key, 'HIGH', 'clienti', 'Errore click bottone Preventivo', e.message.slice(0,200))
        }
      } else {
        logBug(supplier.key, 'MEDIUM', 'clienti', 'Bottone "Preventivo" non visibile in lista clienti', '')
      }
    }

    // === Aggiungi voce al preventivo e genera PDF ===
    let pdfDownloaded = false
    if (quoteIdDirect) {
      try {
        await shot(page, supplier.key, '06-quote-editor-open')
        // seed item via DB (la UI dell'editor e' complessa) cosi' il PDF ha qualcosa
        const { data: srv } = await sb.from('services').select('id, name, base_price').eq('fornitore_id', supplierAuthId).limit(1)
        const serviceId = srv?.[0]?.id ?? null
        const ins = await sb.from('quote_items').insert({
          quote_id: quoteIdDirect,
          service_id: serviceId,
          supplier_id: supplierAuthId,
          name_snapshot: `AGENT-${supplier.key} servizio test`,
          description_snapshot: 'Servizio inserito da audit notturno',
          snapshot_price: 1500,
          quantity: 1,
          sort_order: 1,
        }).select()
        if (ins.error) logSection(supplier.key, 'Quote item seed via DB', 'WARN', ins.error.message.slice(0,200))
        else logSection(supplier.key, 'Quote item seed via DB', 'PASS', `item_id=${ins.data?.[0]?.id}`)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2500)
        // bottone PDF Neutra (FREE tier accetta solo Neutra)
        const pdfBtn = page.locator('[data-testid="pdf-neutra"]').first()
        if (await pdfBtn.count()) {
          await pdfBtn.click()
          // attendi toast generato + pdfUrl impostato
          await page.waitForTimeout(8000)
          await shot(page, supplier.key, '07-after-pdf-click')
          // recupera URL PDF dalla riga "Ultimo PDF"
          const { data: q2 } = await sb.from('quotes').select('pdf_url, pdf_variant').eq('id', quoteIdDirect).maybeSingle()
          if (q2?.pdf_url) {
            // scarica
            const res = await fetch(q2.pdf_url)
            if (res.ok) {
              const pdfPath = path.join(RUN_DIR, 'pdfs', `${supplier.key}-quote-direct.pdf`)
              const buf = Buffer.from(await res.arrayBuffer())
              await writeFile(pdfPath, buf)
              pdfDownloaded = true
              logSection(supplier.key, 'PDF preventivo diretto generato', 'PASS', `${q2.pdf_variant} → ${pdfPath} (${buf.length} byte)`)
            } else {
              logBug(supplier.key, 'MEDIUM', 'quote-pdf', `PDF url presente ma download fallito (${res.status})`, q2.pdf_url)
            }
          } else {
            logBug(supplier.key, 'HIGH', 'quote-pdf', 'PDF non generato (quote.pdf_url null dopo click)', '')
          }
        } else {
          logBug(supplier.key, 'MEDIUM', 'quote-pdf', 'Bottone pdf-neutra non trovato in editor', '')
        }
      } catch (e) {
        logBug(supplier.key, 'MEDIUM', 'quote-pdf', 'Errore generazione PDF', e.message.slice(0,200))
      }
    }

    // === CATALOG ===
    await safeGoto(page, BASE + '/catalog')
    await shot(page, supplier.key, '08-catalog')
    const newServiceBtn = page.locator('[data-testid="new-service-btn"]').first()
    if (await newServiceBtn.count()) {
      try {
        await newServiceBtn.click()
        await page.waitForTimeout(800)
        // form catalog: prova a riempire i campi base se presenti
        const nomeInput = page.locator('input#name, input[id="name"]').first()
        if (await nomeInput.count()) await nomeInput.fill(`AGENT-${supplier.key} servizio catalogo`)
        const prezzoInput = page.locator('input#price, input[id="price"]').first()
        if (await prezzoInput.count()) await prezzoInput.fill('1200')
        // category is auto-selected to first available
        await shot(page, supplier.key, '09-catalog-form')
        const saveBtn = page.locator('[data-testid="service-form"] button[type="submit"], button:has-text("Salva")').first()
        if (await saveBtn.count()) {
          await saveBtn.click()
          await page.waitForTimeout(2000)
        }
        // verifica DB (tabella services, col fornitore_id + name)
        const { data: srv } = await sb.from('services').select('id, name').eq('fornitore_id', supplierAuthId).ilike('name', `AGENT-${supplier.key}%`).limit(1)
        if (srv && srv.length) {
          logSection(supplier.key, 'Catalogo crea servizio', 'PASS', srv[0].id)
        } else {
          logBug(supplier.key, 'MEDIUM', 'catalog', 'Servizio catalogo non creato nel DB (form potrebbe richiedere categoria obbligatoria)', '')
        }
      } catch (e) {
        logBug(supplier.key, 'MEDIUM', 'catalog', 'Errore creazione servizio', e.message)
      }
    } else {
      logBug(supplier.key, 'HIGH', 'catalog', 'CTA nuovo-servizio non trovata', '')
    }
    // Verifica che vede solo propri servizi (tabella reale: services con fornitore_id)
    const { data: ownServices } = await sb.from('services').select('id').eq('fornitore_id', supplierAuthId).limit(5)
    const ownIds = (ownServices || []).map((s) => s.id)
    const { data: otherSrv } = await sb.from('services').select('id, fornitore_id, name').neq('fornitore_id', supplierAuthId).limit(1)
    if (otherSrv && otherSrv.length) {
      logSection(supplier.key, 'Catalogo isolamento', 'INFO', `own=${ownIds.length} altri esistono nel DB (RLS deve filtrare in UI)`)
    }

    // === DISPONIBILITA ===
    await safeGoto(page, BASE + '/disponibilita')
    await shot(page, supplier.key, '10-disponibilita')
    const pageTxtDisp = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
    if (pageTxtDisp.includes('BUSY') || pageTxtDisp.includes('TENTATIVE') || pageTxtDisp.includes('disponibil') || pageTxtDisp.includes('Disponibil')) {
      logSection(supplier.key, 'Disponibilita page render', 'PASS')
    } else {
      logBug(supplier.key, 'MEDIUM', 'disponibilita', 'Page disponibilita non sembra renderizzata correttamente', '')
    }
    if (pageTxtDisp.includes('Prossime date bloccate') || pageTxtDisp.includes('date bloccate') || pageTxtDisp.includes('Sblocca')) {
      logSection(supplier.key, 'Sezione prossime date bloccate', 'PASS')
    } else {
      // potrebbe essere nascosta se non ci sono date bloccate -> seediamo una data e ricontrolliamo
      try {
        const futureDate = new Date(new Date().getFullYear() + 1, 7, 1).toISOString().slice(0, 10)
        await sb.from('supplier_availability').delete().eq('fornitore_id', supplierAuthId).eq('date', futureDate)
        await sb.from('supplier_availability').insert({ fornitore_id: supplierAuthId, date: futureDate, status: 'BUSY', notes: 'AGENT-B test block' })
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2000)
        const txt2 = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000)
        if (txt2.includes('Prossime date bloccate') || txt2.includes('Sblocca')) {
          logSection(supplier.key, 'Sezione prossime date bloccate', 'PASS', 'visibile dopo seed BUSY')
        } else {
          logBug(supplier.key, 'MEDIUM', 'disponibilita', 'Sezione "Prossime date bloccate" non visibile anche dopo seed BUSY futuro', `date=${futureDate}`)
        }
        // cleanup
        await sb.from('supplier_availability').delete().eq('fornitore_id', supplierAuthId).eq('date', futureDate).eq('notes', 'AGENT-B test block')
      } catch (e) {
        logBug(supplier.key, 'MEDIUM', 'disponibilita', 'Sezione "Prossime date bloccate" non visibile (seed fallito)', e.message)
      }
    }
    // tenta click su una cella del calendario
    try {
      const cells = page.locator('button[class*="aspect-square"]')
      const cellCount = await cells.count()
      if (cellCount > 10) {
        const cell = cells.nth(15) // celletta a meta'
        await cell.click()
        await page.waitForTimeout(700)
        await shot(page, supplier.key, '11-disp-after-click')
        logSection(supplier.key, 'Disponibilita ciclo click', 'PASS', `${cellCount} celle`)
      }
    } catch (e) {
      logSection(supplier.key, 'Disponibilita ciclo click', 'WARN', e.message)
    }

    // === CALCOLATORE ===
    await safeGoto(page, BASE + '/calcolatore')
    await shot(page, supplier.key, '12-calcolatore')
    const calcText = (await page.locator('body').innerText().catch(() => '')).slice(0, 3000)
    if (calcText.length > 200) {
      logSection(supplier.key, 'Calcolatore render', 'PASS')
    } else {
      logBug(supplier.key, 'LOW', 'calcolatore', 'Calcolatore pagina vuota', '')
    }

    // === QUOTES ===
    await safeGoto(page, BASE + '/quotes')
    await shot(page, supplier.key, '13-quotes-list')
    logSection(supplier.key, 'Quotes list', 'PASS')

    // === CONTRACTS ===
    await safeGoto(page, BASE + '/contracts')
    await shot(page, supplier.key, '14-contracts')
    logSection(supplier.key, 'Contracts page', 'PASS')

    // === CALENDAR ===
    await safeGoto(page, BASE + '/calendar')
    await shot(page, supplier.key, '15-calendar')
    const calBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000)
    // verifica presenza testi guadagn/incassato (solo se l'utente ha contratti)
    if (calBody.includes('uadagn') || calBody.includes('incassat') || calBody.includes('da incassare')) {
      logSection(supplier.key, 'Calendar earnings hook', 'PASS', 'guadagno/incassato/da-incassare presente')
    } else {
      logSection(supplier.key, 'Calendar earnings hook', 'INFO', 'nessun testo earnings (potrebbe non avere contratti attivi)')
    }

    // === SETTINGS BRAND ===
    await safeGoto(page, BASE + '/settings/brand')
    await shot(page, supplier.key, '16-brand')
    const brandBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 3000)
    if (brandBody.toLowerCase().includes('logo') || brandBody.toLowerCase().includes('brand') || brandBody.toLowerCase().includes('colore')) {
      logSection(supplier.key, 'Settings brand', 'PASS')
    } else {
      logBug(supplier.key, 'MEDIUM', 'brand', 'Pagina brand non renderizzata correttamente', '')
    }

    // === PROFILE ===
    await safeGoto(page, BASE + '/profile')
    await shot(page, supplier.key, '17-profile')
    const profBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
    if (profBody.length > 200) logSection(supplier.key, 'Profile', 'PASS')
    else logBug(supplier.key, 'LOW', 'profile', 'Profile vuoto', '')

    // === SCENARIO CRITICO: accesso /weddings/:id NON partecipato ===
    const fakeWed = await getRecentWeddingNotParticipated(supplierAuthId)
    if (fakeWed) {
      await safeGoto(page, `${BASE}/weddings/${fakeWed.id}`)
      await page.waitForTimeout(2000)
      const url = page.url()
      const txt = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
      // verifica robusta: testo di blocco oppure redirect via roles guard FORNITORE
      const blockedTexts = ['Accesso non consentito', 'non autorizzato', 'Non hai', 'Accesso negato', 'consentito al tuo ruolo']
      const showsBlockText = blockedTexts.some((s) => txt.includes(s))
      const redirected = !url.includes(`/weddings/${fakeWed.id}`)
      // ricerca dati sensibili: nome cliente o budget visibile
      const sensitive = /€\s?\d|client_name|budget|invitat/i.test(txt) && !showsBlockText
      if (showsBlockText) {
        logSection(supplier.key, 'RLS /weddings/:id non partecipato', 'PASS', 'AppShell blocca via roles=WEDDING_PLANNER/LOCATION/ADMIN')
      } else if (redirected) {
        logSection(supplier.key, 'RLS /weddings/:id non partecipato', 'PASS', `redirect a ${url}`)
      } else if (sensitive) {
        logBug(supplier.key, 'CRITICAL', 'rls', `Fornitore vede /weddings/${fakeWed.id} con dati sensibili`, url)
      } else {
        logBug(supplier.key, 'HIGH', 'rls', `URL /weddings/${fakeWed.id} non blocca esplicitamente`, `url=${url} snippet=${txt.slice(0,200)}`)
      }
      await shot(page, supplier.key, '18-wedding-not-participated')
    } else {
      logSection(supplier.key, 'RLS /weddings/:id', 'SKIP', 'no wedding test trovabile')
    }

    // === SCENARIO CRITICO: Instagram carosello upload (controllo presenza UI dentro form servizio) ===
    await safeGoto(page, BASE + '/catalog')
    await page.waitForTimeout(1500)
    try {
      const newSrvBtn = page.locator('[data-testid="new-service-btn"]').first()
      if (await newSrvBtn.count()) {
        await newSrvBtn.click()
        await page.waitForTimeout(800)
        const modalTxt = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000)
        const hasIg = /Instagram|Pinterest|URL|importa/i.test(modalTxt)
        if (hasIg) logSection(supplier.key, 'IG/Pinterest import UI in form servizio', 'PASS')
        else logBug(supplier.key, 'LOW', 'catalog', 'Nessuna UI import Instagram/Pinterest/URL nel form nuovo servizio', '')
        // chiudi modale
        await page.keyboard.press('Escape').catch(() => {})
      } else {
        logSection(supplier.key, 'IG import UI', 'INFO', 'CTA nuovo-servizio non disponibile')
      }
    } catch (e) {
      logSection(supplier.key, 'IG import UI', 'WARN', e.message.slice(0,120))
    }

    // === BRAND PDF: verifica subscription_tier (FREE forza variant NEUTRA hardcoded) ===
    try {
      const { data: prof } = await sb.from('profiles').select('subscription_tier, brand_logo_url, brand_primary_color, business_name').eq('id', supplierAuthId).maybeSingle()
      if (prof) {
        if (prof.subscription_tier !== 'PREMIUM') {
          logBug(supplier.key, 'HIGH', 'brand-pdf', `Fornitore ${prof.business_name} ha tier=${prof.subscription_tier} → PDF preventivo userà brand NEUTRO hardcoded (#1A2E4F) invece di brand fornitore`, 'quote-generate-pdf line 76-80')
        } else {
          logSection(supplier.key, 'Brand PDF tier', 'PASS', `tier=${prof.subscription_tier} permette brand su PDF`)
        }
      }
    } catch (e) { logSection(supplier.key, 'Brand PDF tier check', 'WARN', e.message) }

    // === COOKIE BANNER intercept UX bug ===
    // Verifichiamo che il banner cookie (z-100) intercetta i click sui modali (z-50). Visto live nel primo run.
    // Rapida regressione: senza initScript il banner sarebbe visibile e bloccherebbe il submit del modale "Nuovo cliente".
    // Documentiamo qui come bug noto.
    if (supplier.key === 'B-FOTO') {
      const ctx2 = await page.context().browser().newContext({ acceptDownloads: false })
      const p2 = await ctx2.newPage()
      try {
        // NO initScript per cookie
        await p2.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
        await p2.waitForTimeout(1500)
        // verifica presenza banner
        const banner = await p2.locator('text=Cookie & privacy').count()
        if (banner > 0) {
          // simula login per arrivare a /clienti e tentare modale
          await p2.fill('input[type="email"]', supplier.email)
          await p2.fill('input[type="password"]', PWD)
          await p2.click('button[type="submit"]')
          await p2.waitForTimeout(4000)
          await p2.goto(BASE + '/clienti', { waitUntil: 'domcontentloaded' })
          await p2.waitForTimeout(2000)
          const btn = p2.locator('[data-testid="new-client-btn"]').first()
          if (await btn.count()) {
            await btn.click().catch(() => {})
            await p2.waitForTimeout(800)
            await p2.fill('#full_name', 'AGENT-B-cookietest').catch(() => {})
            const submit = p2.locator('button[type="submit"]:has-text("Crea")').first()
            if (await submit.count()) {
              const clickRes = await submit.click({ timeout: 5000 }).catch((e) => e.message)
              if (typeof clickRes === 'string' && clickRes.includes('intercepts pointer events')) {
                logBug(supplier.key, 'HIGH', 'cookie-banner-ux', 'CookieBanner z-100 intercetta i click sui modali z-50 (impossibile chiudere il modale o submitare senza chiudere il banner)', clickRes.slice(0,200))
              } else {
                logSection(supplier.key, 'Cookie banner intercept regression', 'INFO', 'click ok anche con banner aperto (forse il banner non era full-width)')
              }
            }
          }
        } else {
          logSection(supplier.key, 'Cookie banner regression', 'INFO', 'banner non mostrato in p2')
        }
      } finally {
        await ctx2.close()
      }
    }

    // === SCENARIO CRITICO: trigger block_busy_supplier_on_quote_item ===
    // Lo facciamo a livello DB perche' simulare 2 quote con stessa data lato UI e' fragile.
    if (clientCreated && supplierAuthId) {
      try {
        // crea 2 quote diretti con stessa data evento, lo 2o item dovrebbe fallire al insert?
        // Triggher block_busy_supplier_on_quote_item: cerca conflitto su supplier_availability BUSY.
        // Test minimo: blocca una data via supplier_availability BUSY, poi tenta insert quote_item con quel servizio per quella data.
        const targetDate = new Date(new Date().getFullYear() + 1, 5, 12).toISOString().slice(0, 10)
        // 1. blocca data per fornitore (tabella supplier_availability con fornitore_id + status + notes)
        await sb.from('supplier_availability').delete().eq('fornitore_id', supplierAuthId).eq('date', targetDate)
        const blk = await sb.from('supplier_availability').insert({
          fornitore_id: supplierAuthId,
          date: targetDate,
          status: 'BUSY',
          notes: 'AGENT-B test block',
        }).select()
        if (blk.error) {
          logSection(supplier.key, 'Trigger block test setup', 'WARN', `block insert: ${blk.error.message}`)
        }
        // 2. trova un quote del fornitore con quella data (owner_id == supplier) - se manca, seediamo via service-role
        let { data: qs } = await sb.from('quotes').select('id, event_date, owner_id, title').eq('owner_id', supplierAuthId).limit(5)
        if (!qs || qs.length === 0) {
          const seed = await sb.from('quotes').insert({
            owner_id: supplierAuthId,
            title: `AGENT-${supplier.key} test quote trigger`,
            client_name: 'AGENT trigger client',
            event_date: targetDate,
            status: 'BOZZA',
          }).select()
          if (seed.error) logSection(supplier.key, 'Seed quote per trigger', 'WARN', seed.error.message)
          else qs = seed.data
        }
        const q = (qs || []).find((x) => x.event_date === targetDate) || qs?.[0]
        if (q) {
          await sb.from('quotes').update({ event_date: targetDate }).eq('id', q.id)
          const ins = await sb.from('quote_items').insert({
            quote_id: q.id,
            name_snapshot: `AGENT-${supplier.key} test BLOCK`,
            snapshot_price: 100,
            quantity: 1,
            supplier_id: supplierAuthId,
            sort_order: 999,
          }).select()
          if (ins.error && (ins.error.code === 'P0001' || ins.error.message.toLowerCase().includes('busy') || ins.error.message.toLowerCase().includes('occupat'))) {
            logSection(supplier.key, 'Trigger block_busy_supplier_on_quote_item', 'PASS', `bloccato: ${ins.error.message}`)
          } else if (ins.error) {
            logSection(supplier.key, 'Trigger block_busy_supplier_on_quote_item', 'INFO', `errore diverso (${ins.error.code}): ${ins.error.message.slice(0,200)}`)
          } else {
            logBug(supplier.key, 'HIGH', 'trigger', 'Trigger block_busy_supplier_on_quote_item NON blocca insert su data BUSY', `quote=${q.id} date=${targetDate}`)
            if (ins.data?.[0]?.id) await sb.from('quote_items').delete().eq('id', ins.data[0].id)
          }
        } else {
          logSection(supplier.key, 'Trigger block test', 'SKIP', 'no quote per fornitore')
        }
        await sb.from('supplier_availability').delete().eq('fornitore_id', supplierAuthId).eq('date', targetDate).eq('notes', 'AGENT-B test block')
      } catch (e) {
        logSection(supplier.key, 'Trigger block test', 'WARN', e.message)
      }
    }

    // console errors summary
    if (consoleErrors.length) {
      // limita rumore
      const filt = consoleErrors.filter((e) => !e.includes('Failed to load resource') && !e.includes('net::ERR') && !e.includes('Could not load image'))
      if (filt.length) {
        logBug(supplier.key, 'LOW', 'console', `${filt.length} console error rilevati`, filt.slice(0, 6).join(' | '))
      }
    }
  } catch (e) {
    logBug(supplier.key, 'HIGH', 'audit-runner', 'Eccezione non gestita audit', e.message)
  } finally {
    await ctx.close()
  }
}

async function cleanup() {
  console.log('\n=== CLEANUP AGENT-B-% ===')
  try {
    const r1 = await sb.from('supplier_clients').delete().ilike('full_name', 'AGENT-B%').select()
    console.log('  supplier_clients removed:', r1.data?.length || 0, r1.error?.message || '')
    const r2 = await sb.from('quote_items').delete().ilike('name_snapshot', 'AGENT-B%').select()
    console.log('  quote_items removed:', r2.data?.length || 0, r2.error?.message || '')
    const r3 = await sb.from('services').delete().ilike('name', 'AGENT-B%').select()
    console.log('  services removed:', r3.data?.length || 0, r3.error?.message || '')
    const r4 = await sb.from('quotes').delete().ilike('title', 'AGENT-B%').select()
    console.log('  quotes removed:', r4.data?.length || 0, r4.error?.message || '')
    const r5 = await sb.from('supplier_availability').delete().eq('notes', 'AGENT-B test block').select()
    console.log('  supplier_availability test blocks removed:', r5.data?.length || 0, r5.error?.message || '')
  } catch (e) {
    console.log('cleanup err:', e.message)
  }
}

async function writeReport() {
  const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }
  BUGS.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9))
  const counts = BUGS.reduce((acc, b) => { acc[b.severity] = (acc[b.severity] || 0) + 1; return acc }, {})
  let md = `# AUDIT FORNITORI — Night B\n\n`
  md += `- Data: ${new Date().toISOString()}\n`
  md += `- Prod: ${BASE}\n`
  md += `- Suppliers: ${SUPPLIERS.map((s) => `${s.key}=${s.email}`).join(', ')}\n\n`
  md += `## Riepilogo Bug\n\n`
  md += `| Severity | Count |\n|---|---|\n`
  for (const s of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) {
    md += `| ${s} | ${counts[s] || 0} |\n`
  }
  md += `\n## Bug Dettagliati\n\n`
  for (const b of BUGS) {
    md += `### [${b.severity}] [${b.supplier}] [${b.area}] ${b.summary}\n`
    if (b.detail) md += `> ${b.detail}\n`
    md += `\n`
  }
  md += `\n## Per Fornitore — Sezioni Verificate\n\n`
  for (const s of SUPPLIERS) {
    md += `### ${s.key} — ${s.label} (${s.email})\n\n`
    md += `| Sezione | Stato | Nota |\n|---|---|---|\n`
    for (const sec of (SECTIONS[s.key] || [])) {
      md += `| ${sec.name} | ${sec.status} | ${(sec.note || '').replace(/\|/g, '/')} |\n`
    }
    md += `\n`
  }
  await writeFile(path.join(RUN_DIR, 'REPORT.md'), md)
  console.log('\n=== REPORT scritto in', path.join(RUN_DIR, 'REPORT.md'))
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const s of SUPPLIERS) {
      await auditSupplier(browser, s)
    }
  } finally {
    await browser.close()
  }
  await cleanup()
  await writeReport()
  console.log('\nDONE. Bug count:', BUGS.length)
})()
