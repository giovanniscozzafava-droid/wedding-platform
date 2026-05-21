/**
 * Stress test E2E "30 giorni di vita reale" — Wedding Planner.
 *
 * Scenario sintetizzato dal briefing (vedi PROGRESS.md / docs).
 * Logga ogni step in console e in tests/e2e/realistic_scenario_log.md.
 *
 * Dati seed precaricati:
 * - Admin, Giulia (WP), Villa Aurora (LOC), Fioreria Bianchi, Mario Foto, Catering Sole.
 * - Collaborations attive Giulia <-> 3 fornitori e Villa Aurora <-> Fioreria.
 * - 23 servizi catalogo, modificatori, foto seed.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LOG_FILE = path.resolve(__dirname, 'realistic_scenario_log.md')
const SHOTS_DIR = path.resolve(__dirname, 'screenshots')
const SEED = {
  admin:  { id: '00000000-aaaa-0000-0000-000000000001', email: 'admin@wp-test.it', password: 'Test123!' },
  giulia: { id: '00000000-aaaa-0000-0000-000000000002', email: 'giulia@wp-test.it', password: 'Test123!' },
  villa:  { id: '00000000-aaaa-0000-0000-000000000003', email: 'manager@villaaurora-test.it', password: 'Test123!' },
  fioreria: { id: '00000000-aaaa-0000-0000-000000000004', email: 'info@fioreriabianchi-test.it', password: 'Test123!' },
  mario:  { id: '00000000-aaaa-0000-0000-000000000005', email: 'mario@foto-test.it', password: 'Test123!' },
  catering: { id: '00000000-aaaa-0000-0000-000000000006', email: 'info@cateringsole-test.it', password: 'Test123!' },
}
const DATE_DELUCA = '2026-09-15'
const DATE_MARINI = '2026-09-22'

const SERVICES = {
  villaSala:   '22220000-0003-0000-0000-000000000001', // 8000 EVENTO
  bouquetSposa:'22220000-0004-0000-0000-000000000001', // 180 PEZZO
  chiesa:      '22220000-0004-0000-0000-000000000003', // 850 EVENTO
  centroPrinc: '22220000-0004-0000-0000-000000000006', // 180 PEZZO
  centroStd:   '22220000-0004-0000-0000-000000000005', // 45 PEZZO
  menuBase:    '22220000-0006-0000-0000-000000000001', // 95 PERSONA
  fotoPremium: '22220000-0005-0000-0000-000000000002', // 2400 EVENTO
  album:       '22220000-0005-0000-0000-000000000003', // 650 PEZZO
  droneExtra:  '22220000-0005-0000-0000-000000000005', // 450 EVENTO
}
const ID_FIORERIA = SEED.fioreria.id
const ID_MARIO = SEED.mario.id
const ID_CATERING = SEED.catering.id
const ID_VILLA = SEED.villa.id

let stepCount = 0
let dayCurrent = 0

function logStart() {
  if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true })
  writeFileSync(LOG_FILE, `# Wedding Platform - Stress Test 30 giorni\n\nAvvio: ${new Date().toISOString()}\n\n`)
}
function logLine(s: string) {
  appendFileSync(LOG_FILE, s + '\n')
  console.log(s)
}
async function step(day: number, desc: string, fn: () => Promise<void>) {
  if (day !== dayCurrent) {
    dayCurrent = day
    logLine(`\n## Giorno ${day}\n`)
  }
  stepCount++
  const t0 = Date.now()
  try {
    await fn()
    logLine(`- ✅ Step ${stepCount}: ${desc} (${Date.now() - t0}ms)`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logLine(`- ❌ Step ${stepCount}: ${desc} FAIL — ${msg}`)
    throw e
  }
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 })
}

type Ctx = { browser: Browser; page: Page; ctx: BrowserContext }

async function asUser(browser: Browser, email: string, password: string): Promise<Ctx> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, email, password)
  await page.goto('/')
  return { browser, page, ctx }
}

async function sbCall<T>(page: Page, fn: string, args: unknown = {}): Promise<T> {
  return page.evaluate(async ({ src, a }) => {
    const mod = await import('/src/lib/supabase.ts')
    const sb = (mod as any).supabase
    // eslint-disable-next-line no-new-func
    const f = new Function('sb', 'a', `return (${src})(sb, a)`)
    return f(sb, a)
  }, { src: fn, a: args })
}

test.describe.serial('Stress test 30 giorni', () => {
  test.setTimeout(300_000)

  test('Scenario completo', async ({ browser }) => {
    logStart()
    let deLucaQuoteId = ''
    let deLucaToken = ''
    let mariniQuoteId = ''
    let mariniToken = ''

    // --- GIORNO 1-2: setup (gia` in seed) -------------------------------------
    await step(1, 'Verifica seed (login admin): 6 utenti + 4 collab + 23 servizi', async () => {
      const tmpCtx = await browser.newContext()
      const tmpPage = await tmpCtx.newPage()
      await login(tmpPage, SEED.admin.email, SEED.admin.password)
      const res = await sbCall<any>(tmpPage, `async (sb) => {
        const u = await sb.from('profiles').select('id', { count: 'exact', head: true })
        const c = await sb.from('collaborations').select('id', { count: 'exact', head: true }).eq('status','ACTIVE')
        const s = await sb.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true)
        return { users: u.count, collabs: c.count, services: s.count }
      }`)
      expect(res.users).toBe(6)
      expect(res.collabs).toBe(4)
      expect(res.services).toBe(23)
      await tmpCtx.close()
    })

    // Giulia online per tutto il flusso
    const giulia = await asUser(browser, SEED.giulia.email, SEED.giulia.password)

    // --- GIORNO 3: contatto + verifica disponibilita` -------------------------
    await step(3, 'Verifica disponibilita` Villa Aurora il 15/09/2026', async () => {
      const villa = await asUser(browser, SEED.villa.email, SEED.villa.password)
      const busy = await sbCall<any>(villa.page, `async (sb, a) => {
        const r = await sb.from('calendar_entries')
          .select('id, status')
          .lte('date_from', a.date)
          .gte('date_to', a.date)
        return r.data
      }`, { date: DATE_DELUCA })
      expect((busy as any[]).length).toBe(0)
      await villa.ctx.close()
    })

    // --- GIORNO 4: crea preventivo De Luca con voci + markup -----------------
    await step(4, 'Giulia crea preventivo De Luca con 6 voci e markup 15%', async () => {
      const built = await sbCall<any>(giulia.page, `async (sb, a) => {
        const q = await sb.from('quotes').insert({
          owner_id: a.uid,
          title: 'Matrimonio De Luca',
          client_name: 'Famiglia De Luca',
          client_email: 'deluca@cliente-test.it',
          event_date: a.date,
          guest_count: 120,
          default_markup_percent: 15,
        }).select().single()
        if (q.error) throw q.error
        const items = [
          // Villa Aurora
          { quote_id: q.data.id, service_id: a.svc.villaSala,    supplier_id: a.fornVilla,    name_snapshot: 'Affitto sala matrimonio', snapshot_price: 8000, unit_snapshot: 'EVENTO', quantity: 1, sort_order: 0 },
          // Fioreria Bianchi
          { quote_id: q.data.id, service_id: a.svc.bouquetSposa, supplier_id: a.fornFior,     name_snapshot: 'Bouquet sposa classico',  snapshot_price: 180,  unit_snapshot: 'PEZZO',  quantity: 1, sort_order: 1 },
          { quote_id: q.data.id, service_id: a.svc.chiesa,       supplier_id: a.fornFior,     name_snapshot: 'Addobbi cerimonia chiesa', snapshot_price: 850, unit_snapshot: 'EVENTO', quantity: 1, sort_order: 2 },
          { quote_id: q.data.id, service_id: a.svc.centroPrinc,  supplier_id: a.fornFior,     name_snapshot: 'Centrotavola tavolo principale', snapshot_price: 180, unit_snapshot: 'PEZZO', quantity: 3, sort_order: 3 },
          { quote_id: q.data.id, service_id: a.svc.centroStd,    supplier_id: a.fornFior,     name_snapshot: 'Centrotavola standard',   snapshot_price: 45,   unit_snapshot: 'PEZZO',  quantity: 12, sort_order: 4 },
          // Catering Sole (con markup override 10%)
          { quote_id: q.data.id, service_id: a.svc.menuBase,     supplier_id: a.fornCater,    name_snapshot: 'Menu base',               snapshot_price: 95,   unit_snapshot: 'PERSONA', quantity: 120, sort_order: 5 },
          // Mario Foto
          { quote_id: q.data.id, service_id: a.svc.fotoPremium,  supplier_id: a.fornMario,    name_snapshot: 'Servizio fotografico premium', snapshot_price: 2400, unit_snapshot: 'EVENTO', quantity: 1, sort_order: 6 },
          { quote_id: q.data.id, service_id: a.svc.album,        supplier_id: a.fornMario,    name_snapshot: 'Album fotografico 30x30', snapshot_price: 650,  unit_snapshot: 'PEZZO',  quantity: 1, sort_order: 7 },
        ]
        const ins = await sb.from('quote_items').insert(items)
        if (ins.error) throw ins.error
        // Override markup catering: 10% invece di 15%
        await sb.from('quote_supplier_markups').upsert({ quote_id: q.data.id, supplier_id: a.fornCater, markup_percent: 10 }, { onConflict: 'quote_id,supplier_id' })
        const refresh = await sb.from('quotes').select('id, total_cost, total_client, margin_amount, margin_percent').eq('id', q.data.id).single()
        return refresh.data
      }`, {
        uid: SEED.giulia.id, date: DATE_DELUCA, svc: SERVICES,
        fornVilla: ID_VILLA, fornFior: ID_FIORERIA, fornCater: ID_CATERING, fornMario: ID_MARIO,
      })
      deLucaQuoteId = built.id
      // costi base: 8000 + 180 + 850 + 540 + 540 + 11400 + 2400 + 650 = 24560
      expect(Number(built.total_cost)).toBeCloseTo(24560, 0)
      // markup 15% su tutto tranne catering (10%):
      // (8000+180+850+540+540+2400+650)*1.15 + 11400*1.10 = 13160*1.15 + 12540 = 15134 + 12540 = 27674
      expect(Number(built.total_client)).toBeCloseTo(27674, 0)
      logLine(`  · totale cliente € ${built.total_client}, margine € ${built.margin_amount} (${built.margin_percent}%)`)
    })

    // --- GIORNO 5: send -------------------------------------------------------
    await step(5, 'Genera PDF NEUTRA e invia al cliente', async () => {
      const sent = await sbCall<any>(giulia.page, `async (sb, a) => {
        const { data, error } = await sb.functions.invoke('quote-send', { body: { quote_id: a.qid } })
        if (error) throw error
        return data
      }`, { qid: deLucaQuoteId })
      deLucaToken = sent.access_token
      expect(deLucaToken).toBeTruthy()
      expect(sent.pdf_url).toContain('quote-pdfs/')

      const status = await sbCall<any>(giulia.page, `async (sb, a) => {
        const q = await sb.from('quotes').select('status, access_token, sent_at, pdf_url').eq('id', a.qid).single()
        const ce = await sb.from('calendar_entries').select('status, date_from, value_amount').eq('quote_id', a.qid).single()
        return { q: q.data, ce: ce.data }
      }`, { qid: deLucaQuoteId })
      expect(status.q.status).toBe('INVIATO')
      expect(status.ce.status).toBe('IN_TRATTATIVA')
      expect(status.ce.date_from).toBe(DATE_DELUCA)
      logLine(`  · access_token ${deLucaToken.slice(0,8)}…, calendar entry IN_TRATTATIVA il ${status.ce.date_from}`)
    })

    // --- GIORNO 6: cliente apre /p/preview ------------------------------------
    await step(6, 'Cliente De Luca apre /p/preview/:token (anon)', async () => {
      const anon = await browser.newContext()
      const ap = await anon.newPage()
      await ap.goto(`/p/preview/${deLucaToken}`)
      await expect(ap.getByTestId('public-items')).toBeVisible({ timeout: 10_000 })
      await ap.screenshot({ path: path.join(SHOTS_DIR, 'g06-preview-public.png'), fullPage: true })
      const html = await ap.content()
      // niente fornitori esposti
      expect(html).not.toContain(ID_FIORERIA)
      expect(html).not.toContain(ID_MARIO)
      await anon.close()
    })

    // --- GIORNO 7: cliente chiede modifica → aggiungi drone + regen PDF ------
    await step(7, 'Giulia aggiunge "Riprese drone" e rigenera PDF', async () => {
      const totalsBefore = await sbCall<any>(giulia.page, `async (sb, a) => {
        const r = await sb.from('quotes').select('total_client').eq('id', a.qid).single()
        return r.data.total_client
      }`, { qid: deLucaQuoteId })

      const added = await sbCall<any>(giulia.page, `async (sb, a) => {
        const i = await sb.from('quote_items').insert({
          quote_id: a.qid, service_id: a.svc, supplier_id: a.mario,
          name_snapshot: 'Riprese drone', snapshot_price: 450, unit_snapshot: 'EVENTO', quantity: 1, sort_order: 8,
        }).select().single()
        if (i.error) throw i.error
        const r = await sb.from('quotes').select('total_client').eq('id', a.qid).single()
        const pdf = await sb.functions.invoke('quote-generate-pdf', { body: { quote_id: a.qid, variant: 'NEUTRA' } })
        return { total: r.data.total_client, pdf: pdf.data?.url }
      }`, { qid: deLucaQuoteId, svc: SERVICES.droneExtra, mario: ID_MARIO })
      expect(Number(added.total)).toBeCloseTo(Number(totalsBefore) + 450 * 1.15, 1)
      expect(added.pdf).toContain('quote-pdfs/')
      logLine(`  · nuovo totale € ${added.total} (drone +450 cost +517,50 cliente)`)
    })

    // --- GIORNO 8: Fioreria aggiorna prezzo bouquet 180→220 ------------------
    await step(8, 'Fioreria aggiorna prezzo Bouquet 180→220; snapshot quote invariato', async () => {
      const fior = await asUser(browser, SEED.fioreria.email, SEED.fioreria.password)
      const upd = await sbCall<any>(fior.page, `async (sb, a) => {
        const r = await sb.from('services').update({ base_price: 220 }).eq('id', a.svcId).select().single()
        if (r.error) throw r.error
        const versions = await sb.from('price_versions').select('id, price, valid_until').eq('service_id', a.svcId).order('valid_from', { ascending: true })
        return versions.data
      }`, { svcId: SERVICES.bouquetSposa })
      expect((upd as any[]).length).toBe(2)
      expect((upd as any[])[0].valid_until).not.toBeNull()
      expect(Number((upd as any[])[1].price)).toBe(220)

      // Snapshot nel quote De Luca = ancora 180
      const snap = await sbCall<any>(giulia.page, `async (sb, a) => {
        const r = await sb.from('quote_items').select('snapshot_price').eq('quote_id', a.qid).eq('service_id', a.svcId).single()
        return r.data.snapshot_price
      }`, { qid: deLucaQuoteId, svcId: SERVICES.bouquetSposa })
      expect(Number(snap)).toBe(180)
      await fior.ctx.close()
      logLine('  · price_versions: vecchia chiusa, nuova €220; snapshot preventivo invariato €180')
    })

    // --- GIORNO 10: cliente accetta -------------------------------------------
    await step(10, 'Cliente De Luca accetta → status ACCETTATO + calendar OPZIONATA', async () => {
      const anon = await browser.newContext()
      const ap = await anon.newPage()
      await ap.goto(`/p/preview/${deLucaToken}`)
      await ap.getByTestId('accept-btn').click()
      await expect(ap.getByTestId('accept-ok')).toBeVisible({ timeout: 10_000 })
      await ap.screenshot({ path: path.join(SHOTS_DIR, 'g10-accept.png'), fullPage: true })
      await anon.close()

      const check = await sbCall<any>(giulia.page, `async (sb, a) => {
        const q = await sb.from('quotes').select('status, accepted_at').eq('id', a.qid).single()
        const ce = await sb.from('calendar_entries').select('status').eq('quote_id', a.qid).single()
        return { q: q.data, ce: ce.data }
      }`, { qid: deLucaQuoteId })
      expect(check.q.status).toBe('ACCETTATO')
      expect(check.q.accepted_at).toBeTruthy()
      expect(check.ce.status).toBe('OPZIONATA')
    })

    // --- GIORNO 12: doppia data — Marini il 15/09 stesso giorno --------------
    await step(12, 'Verifica conflitto data 15/09 (entry OPZIONATA presente)', async () => {
      const busy = await sbCall<any>(giulia.page, `async (sb, a) => {
        const r = await sb.from('calendar_entries').select('id, status').lte('date_from', a.date).gte('date_to', a.date).neq('status','CANCELLATA')
        return r.data
      }`, { date: DATE_DELUCA })
      expect((busy as any[]).length).toBeGreaterThanOrEqual(1)
      expect((busy as any[])[0].status).toBe('OPZIONATA')
      logLine('  · 15/09 occupato → Giulia sposta Marini al 22/09')
    })

    await step(12, 'Crea preventivo Marini al 22/09 (data libera)', async () => {
      const built = await sbCall<any>(giulia.page, `async (sb, a) => {
        const q = await sb.from('quotes').insert({
          owner_id: a.uid,
          title: 'Matrimonio Marini',
          client_name: 'Famiglia Marini',
          client_email: 'marini@cliente-test.it',
          event_date: a.date,
          guest_count: 80,
          default_markup_percent: 15,
        }).select().single()
        if (q.error) throw q.error
        await sb.from('quote_items').insert([
          { quote_id: q.data.id, service_id: a.svc.villaSala, supplier_id: a.fornVilla, name_snapshot: 'Affitto sala', snapshot_price: 8000, unit_snapshot: 'EVENTO', quantity: 1 },
          { quote_id: q.data.id, service_id: a.svc.menuBase, supplier_id: a.fornCater, name_snapshot: 'Menu base', snapshot_price: 95, unit_snapshot: 'PERSONA', quantity: 80 },
        ])
        const send = await sb.functions.invoke('quote-send', { body: { quote_id: q.data.id } })
        return { id: q.data.id, token: send.data?.access_token }
      }`, {
        uid: SEED.giulia.id, date: DATE_MARINI, svc: SERVICES,
        fornVilla: ID_VILLA, fornCater: ID_CATERING,
      })
      mariniQuoteId = built.id
      mariniToken = built.token
      expect(mariniToken).toBeTruthy()
    })

    // --- GIORNO 15: reminder (skip pg_cron, invoco notify manuale) -----------
    await step(15, 'Reminder 7 giorni: invoke calendar-notify per ognuno', async () => {
      const r = await sbCall<any>(giulia.page, `async (sb, a) => {
        const entries = await sb.from('calendar_entries').select('id').eq('owner_id', a.uid)
        const sent = []
        for (const e of entries.data ?? []) {
          const res = await sb.functions.invoke('calendar-notify', { body: { entry_id: e.id, event: 'reminder' } })
          sent.push({ id: e.id, ok: res.error == null })
        }
        return sent
      }`, { uid: SEED.giulia.id })
      expect((r as any[]).length).toBeGreaterThan(0)
      logLine(`  · ${(r as any[]).length} notify invoked`)
    })

    // --- GIORNO 18: limite FREE 10 -------------------------------------------
    await step(18, 'Giulia FREE: 11esimo preventivo attivo viene rifiutato', async () => {
      const cur = await sbCall<any>(giulia.page, `async (sb, a) => {
        const r = await sb.from('quotes').select('id, status').eq('owner_id', a.uid).in('status', ['BOZZA','INVIATO','ACCETTATO'])
        return r.data.length
      }`, { uid: SEED.giulia.id })
      // attualmente 2 attivi (deLuca ACCETTATO, marini INVIATO). Riempire fino a 10 bozze in piu.
      const toAdd = 10 - cur
      const fillResult = await sbCall<any>(giulia.page, `async (sb, a) => {
        const out = []
        for (let i = 0; i < a.n; i++) {
          const r = await sb.from('quotes').insert({ owner_id: a.uid, title: \`Q-fill-\${i}\`, status: 'BOZZA' }).select().single()
          out.push({ ok: !r.error, err: r.error?.message ?? null })
        }
        const eleventh = await sb.from('quotes').insert({ owner_id: a.uid, title: 'Q-11', status: 'BOZZA' }).select().single()
        return { fills: out, eleventh: eleventh.error?.message ?? null }
      }`, { uid: SEED.giulia.id, n: toAdd })
      expect((fillResult as any).eleventh).toContain('limite di 10 preventivi')
      logLine('  · 11esimo bloccato dal trigger enforce_free_quote_limit')
    })

    // --- GIORNO 20: upgrade PREMIUM + brand + PDF brand ---------------------
    await step(20, 'Upgrade PREMIUM + brand colori, PDF rigenerato variant=PREMIUM', async () => {
      const ret = await sbCall<any>(giulia.page, `async (sb, a) => {
        const up = await sb.from('profiles').update({
          subscription_tier: 'PREMIUM',
          brand_primary_color: '#1A2E4F',
          brand_secondary_color: '#D4AF37',
        }).eq('id', a.uid)
        if (up.error) throw up.error
        const pdf = await sb.functions.invoke('quote-generate-pdf', { body: { quote_id: a.qid, variant: 'PREMIUM' } })
        if (pdf.error) throw pdf.error
        return pdf.data
      }`, { uid: SEED.giulia.id, qid: mariniQuoteId })
      expect(ret.variant).toBe('PREMIUM')
      expect(ret.premium_applied).toBe(true)
      logLine(`  · PDF PREMIUM url ${ret.url.slice(-40)}…`)
    })

    // --- GIORNO 25: Marini rifiuta --------------------------------------------
    await step(25, 'Cliente Marini rifiuta → status RIFIUTATO + entry CANCELLATA', async () => {
      const anon = await browser.newContext()
      const ap = await anon.newPage()
      await ap.goto(`/p/reject/${mariniToken}`)
      await ap.locator('#reason').fill('Troppo caro')
      await ap.getByRole('button', { name: 'Conferma rifiuto' }).click()
      await expect(ap.getByTestId('reject-ok')).toBeVisible({ timeout: 10_000 })
      await ap.screenshot({ path: path.join(SHOTS_DIR, 'g25-reject.png'), fullPage: true })
      await anon.close()

      const check = await sbCall<any>(giulia.page, `async (sb, a) => {
        const q = await sb.from('quotes').select('status, rejection_reason').eq('id', a.qid).single()
        const ce = await sb.from('calendar_entries').select('status').eq('quote_id', a.qid).maybeSingle()
        return { q: q.data, ce: ce.data }
      }`, { qid: mariniQuoteId })
      expect(check.q.status).toBe('RIFIUTATO')
      expect(check.q.rejection_reason).toBe('Troppo caro')
      if (check.ce) expect(check.ce.status).toBe('CANCELLATA')
    })

    // --- GIORNO 28: export iCal Mario ----------------------------------------
    await step(28, 'Mario esporta iCal: file contiene VEVENT del 15/09', async () => {
      const mario = await asUser(browser, SEED.mario.email, SEED.mario.password)
      const tok = await sbCall<any>(mario.page, `async (sb, a) => {
        const me = await sb.auth.getUser()
        const ins = await sb.from('calendar_export_tokens').insert({ user_id: me.data.user.id }).select('token').single()
        return ins.data?.token
      }`)
      const url = `http://127.0.0.1:54321/functions/v1/calendar-export-ics?token=${tok}`
      const req = await mario.ctx.request.get(url)
      expect(req.ok()).toBeTruthy()
      const ics = await req.text()
      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('DTSTART;VALUE=DATE:20260915')
      await mario.ctx.close()
      logLine(`  · iCal lunghezza ${ics.length} bytes`)
    })

    // --- GIORNO 30: audit finale ---------------------------------------------
    await step(30, 'Audit finale (admin): counts utenti/servizi/preventivi/entries', async () => {
      const adminCtx = await asUser(browser, SEED.admin.email, SEED.admin.password)
      const audit = await sbCall<any>(adminCtx.page, `async (sb) => {
        const users = await sb.from('profiles').select('id', { count: 'exact', head: true })
        const services = await sb.from('services').select('id', { count: 'exact', head: true })
        const quotesAll = await sb.from('quotes').select('id, status')
        const entries = await sb.from('calendar_entries').select('id, status')
        const notif = await sb.from('notification_queue').select('id', { count: 'exact', head: true })
        return { users: users.count, services: services.count, quotes: quotesAll.data, entries: entries.data, notif: notif.count }
      }`)
      logLine(`  · users=${audit.users}, services=${audit.services}, quotes=${audit.quotes.length}, entries=${audit.entries.length}, notif=${audit.notif}`)
      expect(audit.users).toBe(6)
      expect(audit.services).toBe(23)
      expect(audit.quotes.length).toBeGreaterThanOrEqual(2)
      // De Luca ACCETTATO, Marini RIFIUTATO
      const byStatus = (audit.quotes as any[]).reduce((m, q) => ((m[q.status] = (m[q.status] ?? 0) + 1), m), {} as Record<string, number>)
      expect(byStatus['ACCETTATO']).toBeGreaterThanOrEqual(1)
      expect(byStatus['RIFIUTATO']).toBeGreaterThanOrEqual(1)
      // calendar entries: De Luca OPZIONATA + Marini CANCELLATA
      const ceByStatus = (audit.entries as any[]).reduce((m, e) => ((m[e.status] = (m[e.status] ?? 0) + 1), m), {} as Record<string, number>)
      expect(ceByStatus['OPZIONATA']).toBeGreaterThanOrEqual(1)
      await adminCtx.ctx.close()
    })

    logLine(`\n## Risultato finale\n\n✅ Tutti i ${stepCount} step completati con successo.`)
    await giulia.ctx.close()
  })
})
