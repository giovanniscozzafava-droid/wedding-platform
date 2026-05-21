import { test, expect, type Page } from '@playwright/test'

const SEED = {
  giulia: { email: 'giulia@wp-test.it', password: 'Test123!' },
  mario:  { email: 'mario@foto-test.it', password: 'Test123!' },
}
const GIULIA_ID = '00000000-aaaa-0000-0000-000000000002'
const MARIO_ID = '00000000-aaaa-0000-0000-000000000005'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 })
}

test.describe('Preventivi', () => {
  test('crea quote + aggiunge 2 voci + trigger calcola totali con markup default', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/quotes')

    const created = await page.evaluate(async (args) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase

      const q = await sb.from('quotes').insert({
        owner_id: args.uid,
        title: `E2E Quote ${args.stamp}`,
        client_name: 'De Luca',
        client_email: 'deluca@cliente-test.it',
        event_date: '2026-09-15',
        guest_count: 120,
        default_markup_percent: 20,
      }).select().single()

      if (q.error) return { step: 'quote', error: q.error }

      const i1 = await sb.from('quote_items').insert({
        quote_id: q.data.id,
        service_id: '22220000-0005-0000-0000-000000000001', // foto base 1500
        supplier_id: '00000000-aaaa-0000-0000-000000000005',
        name_snapshot: 'Servizio fotografico base',
        snapshot_price: 1500,
        unit_snapshot: 'EVENTO',
        quantity: 1,
      }).select().single()
      if (i1.error) return { step: 'item1', error: i1.error }

      const i2 = await sb.from('quote_items').insert({
        quote_id: q.data.id,
        service_id: '22220000-0006-0000-0000-000000000001', // menu base 95/persona
        supplier_id: '00000000-aaaa-0000-0000-000000000006',
        name_snapshot: 'Menu base',
        snapshot_price: 95,
        unit_snapshot: 'PERSONA',
        quantity: 120,
      }).select().single()
      if (i2.error) return { step: 'item2', error: i2.error }

      // Re-fetch quote per leggere i totali ricalcolati dal trigger
      const refresh = await sb.from('quotes').select('total_cost, total_client, margin_amount, margin_percent').eq('id', q.data.id).single()
      return { quote: q.data, totals: refresh.data }
    }, { uid: GIULIA_ID, stamp: Date.now() })

    expect((created as any).error).toBeUndefined()
    const totals = (created as any).totals
    // costi: 1500 + 95*120 = 1500 + 11400 = 12900
    // clienti con markup 20%: 12900 * 1.2 = 15480
    expect(Number(totals.total_cost)).toBeCloseTo(12900, 1)
    expect(Number(totals.total_client)).toBeCloseTo(15480, 1)
    expect(Number(totals.margin_amount)).toBeCloseTo(2580, 1)
    expect(Number(totals.margin_percent)).toBeCloseTo(20, 1)
  })

  test('RLS: Mario fornitore NON vede preventivi di Giulia', async ({ page }) => {
    await login(page, SEED.mario.email, SEED.mario.password)
    await page.goto('/quotes')
    const res = await page.evaluate(async () => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const { data, error } = await sb.from('quotes').select('id')
      return { count: data?.length ?? 0, error }
    })
    expect((res as any).count).toBe(0)
  })

  test('trigger limite FREE: 11esimo preventivo attivo fallisce', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/quotes')

    const ret = await page.evaluate(async (uid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      // cleanup
      await sb.from('quotes').delete().eq('owner_id', uid)
      // crea 10 quote
      for (let i = 0; i < 10; i++) {
        const r = await sb.from('quotes').insert({
          owner_id: uid,
          title: `Q${i + 1}`,
          status: 'BOZZA',
        }).select().single()
        if (r.error) return { step: i, error: r.error }
      }
      // 11th deve fallire
      const r = await sb.from('quotes').insert({
        owner_id: uid,
        title: 'Q11',
        status: 'BOZZA',
      }).select().single()
      return { eleventh_error: r.error?.message ?? null }
    }, GIULIA_ID)
    expect((ret as any).eleventh_error).toContain('limite di 10 preventivi')
  })

  test('quote-send: status INVIATO + access_token + calendar entry IN_TRATTATIVA', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/quotes')

    const setup = await page.evaluate(async (uid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      await sb.from('quotes').delete().eq('owner_id', uid)
      const q = await sb.from('quotes').insert({
        owner_id: uid,
        title: `E2E Send ${Date.now()}`,
        client_email: 'deluca@cliente-test.it',
        event_date: '2026-10-10',
        status: 'BOZZA',
      }).select().single()
      await sb.from('quote_items').insert({
        quote_id: q.data.id,
        snapshot_price: 100,
        quantity: 2,
        name_snapshot: 'Voce test',
        supplier_id: '00000000-aaaa-0000-0000-000000000005',
      })
      return q.data.id
    }, GIULIA_ID)

    const sent = await page.evaluate(async (qid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const { data, error } = await sb.functions.invoke('quote-send', { body: { quote_id: qid } })
      return { data, error: error?.message ?? null }
    }, setup)
    expect((sent as any).error).toBeNull()
    expect((sent as any).data.access_token).toBeTruthy()

    const check = await page.evaluate(async (qid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const q = await sb.from('quotes').select('status, access_token, sent_at, pdf_url').eq('id', qid).single()
      const ce = await sb.from('calendar_entries').select('status, date_from').eq('quote_id', qid)
      return { quote: q.data, entries: ce.data }
    }, setup)
    expect((check as any).quote.status).toBe('INVIATO')
    expect((check as any).quote.access_token).toBeTruthy()
    expect((check as any).quote.sent_at).toBeTruthy()
    expect((check as any).quote.pdf_url).toContain('quote-pdfs/')
    expect((check as any).entries.length).toBe(1)
    expect((check as any).entries[0].status).toBe('IN_TRATTATIVA')
    expect((check as any).entries[0].date_from).toBe('2026-10-10')
  })

  test('anon: /p/preview/:token mostra dati, NON espone fornitori; /p/accept aggiorna', async ({ browser }) => {
    // sessione separata per simulare cliente anon
    const anonCtx = await browser.newContext()
    const anonPage = await anonCtx.newPage()

    // crea quote + send come Giulia (in nuova page)
    const giuliaCtx = await browser.newContext()
    const giuliaPage = await giuliaCtx.newPage()
    await login(giuliaPage, SEED.giulia.email, SEED.giulia.password)
    await giuliaPage.goto('/quotes')
    const sent = await giuliaPage.evaluate(async (uid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      await sb.from('quotes').delete().eq('owner_id', uid)
      const q = await sb.from('quotes').insert({
        owner_id: uid,
        title: `Public Quote ${Date.now()}`,
        client_email: 'deluca@cliente-test.it',
        event_date: '2026-11-22',
        status: 'BOZZA',
      }).select().single()
      await sb.from('quote_items').insert({
        quote_id: q.data.id,
        snapshot_price: 50,
        quantity: 10,
        name_snapshot: 'Voce pubblica',
        supplier_id: '00000000-aaaa-0000-0000-000000000005',
      })
      const res = await sb.functions.invoke('quote-send', { body: { quote_id: q.data.id } })
      return res.data
    }, GIULIA_ID)

    const token = (sent as any).access_token

    await anonPage.goto(`/p/preview/${token}`)
    await expect(anonPage.getByTestId('public-items')).toBeVisible({ timeout: 10_000 })
    // niente nomi fornitori esposti (supplier_id non disponibile via RPC)
    const html = await anonPage.content()
    expect(html).not.toContain(MARIO_ID)
    // accept
    await anonPage.getByTestId('accept-btn').click()
    await expect(anonPage.getByTestId('accept-ok')).toBeVisible({ timeout: 10_000 })

    // verifica DB via giulia
    const after = await giuliaPage.evaluate(async (t) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const { data } = await sb.from('quotes').select('status, accepted_at').eq('access_token', t).single()
      return data
    }, token)
    expect((after as any).status).toBe('ACCETTATO')
    expect((after as any).accepted_at).toBeTruthy()

    await anonCtx.close()
    await giuliaCtx.close()
  })
})
