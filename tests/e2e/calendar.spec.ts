import { test, expect, type Page } from '@playwright/test'

// Riscritto (audit calendario 13/07/2026, P0-3): i vecchi test inserivano/leggevano
// client_name/notes/value_amount DIRETTAMENTE su calendar_entries — colonne droppate dal
// 20260610010000 (split PII → calendar_entries_private). Giravano rotti (o su DB stantìo) da
// giugno: è il motivo per cui P0-1 (export) e P0-2 (busy-check) sono passati inosservati un mese.
// Ora: i campi sensibili passano da calendar_entries_private (trigger crea la riga, poi upsert),
// e c'è il test che avrebbe intercettato P0-2 (check_owner_date_busy deve rispondere senza errore).
// Girare su `supabase db reset` FRESCO (non su DB persistente): è l'unica config che intercetta i drift.

const SEED = {
  giulia: { email: 'giulia@wp-test.it', password: 'Test123!' },
  mario:  { email: 'mario@foto-test.it', password: 'Test123!' },
}
const GIULIA_ID = '00000000-aaaa-0000-0000-000000000002'
const MARIO_ID = '00000000-aaaa-0000-0000-000000000005'
const FIORERIA_ID = '00000000-aaaa-0000-0000-000000000004'
const EVENT_DATE = '2026-09-15'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 })
}

test.describe('Calendario', () => {
  test('Giulia crea evento + campi sensibili in calendar_entries_private + 2 fornitori participants', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/calendar')

    const stamp = Date.now()
    const title = `E2E Cal ${stamp}`
    const ret = await page.evaluate(async (args) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      // 1) evento (SENZA campi sensibili: droppati da calendar_entries)
      const { data, error } = await sb.from('calendar_entries').insert({
        owner_id: args.giulia,
        title: args.title,
        date_from: args.date,
        date_to: args.date,
        status: 'IN_TRATTATIVA',
      }).select().single()
      if (error) return { error }
      // 2) il trigger trg_ensure_calentry_private ha creato la riga privata → upsert dei sensibili (flusso useCreateEntry)
      const priv = await sb.from('calendar_entries_private').upsert({
        entry_id: data.id, client_name: 'Famiglia E2E', notes: 'nota segreta', value_amount: 20000,
      })
      if (priv.error) return { error: priv.error }
      const part = await sb.from('calendar_entry_participants').insert([
        { entry_id: data.id, user_id: args.mario, role_in_entry: 'fotografo' },
        { entry_id: data.id, user_id: args.fioreria, role_in_entry: 'fioraio' },
      ])
      if (part.error) return { error: part.error }
      return { data }
    }, { title, mario: MARIO_ID, fioreria: FIORERIA_ID, giulia: GIULIA_ID, date: EVENT_DATE })
    expect((ret as any).error).toBeUndefined()
    expect((ret as any).data.title).toBe(title)
  })

  test('Mario participant: vede la view ridotta ma NON i campi sensibili (RLS su private → 0 righe)', async ({ page }) => {
    await login(page, SEED.mario.email, SEED.mario.password)
    await page.goto('/calendar')

    const res = await page.evaluate(async (date) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const { data: viewRows } = await sb
        .from('calendar_entries_for_participants')
        .select('*')
        .eq('date_from', date)
      // il participant NON ha policy su calendar_entries_private → SELECT ritorna 0 righe (non errore)
      const priv = await sb.from('calendar_entries_private').select('client_name, notes, value_amount')
      return { viewCount: viewRows?.length ?? 0, privCount: priv.data?.length ?? 0 }
    }, EVENT_DATE)

    expect((res as any).viewCount).toBeGreaterThan(0)
    expect((res as any).privCount).toBe(0)
  })

  test('Giulia owner: legge i campi sensibili da calendar_entries_private', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/calendar')
    const res = await page.evaluate(async (args) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const ce = await sb.from('calendar_entries').select('id').eq('owner_id', args.giulia).eq('date_from', args.date).limit(1).single()
      if (ce.error) return { error: ce.error.message }
      const { data } = await sb.from('calendar_entries_private').select('client_name, notes, value_amount').eq('entry_id', ce.data.id).single()
      return data
    }, { giulia: GIULIA_ID, date: EVENT_DATE })
    expect((res as any).notes).toBe('nota segreta')
    expect(Number((res as any).value_amount)).toBe(20000)
    expect((res as any).client_name).toBe('Famiglia E2E')
  })

  test('Busy-check risponde SENZA errore e segnala la data occupata (avrebbe intercettato P0-2)', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/calendar')
    const res = await page.evaluate(async (date) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const { data, error } = await sb.rpc('check_owner_date_busy', { p_date: date })
      return { data, err: error?.message ?? null }
    }, EVENT_DATE)
    // il fix P0-2: la funzione non deve piu' esplodere (ce.event_kind + intervallo)
    expect((res as any).err).toBeNull()
    expect((res as any).data.busy).toBe(true)
    expect((res as any).data.entries.length).toBeGreaterThan(0)
  })

  test('Export iCal: token valido restituisce il feed con l\'evento del participant', async ({ page, request }) => {
    await login(page, SEED.mario.email, SEED.mario.password)
    await page.goto('/calendar')
    const token = await page.evaluate(async () => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const me = await sb.auth.getUser()
      const ins = await sb.from('calendar_export_tokens').insert({ user_id: me.data.user.id }).select('token').single()
      return ins.data?.token as string
    })
    const url = `http://127.0.0.1:54321/functions/v1/calendar-export-ics?token=${token}`
    const res = await request.get(url)
    expect(res.ok()).toBeTruthy()
    const body = await res.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('END:VCALENDAR')
    expect(body).toMatch(/BEGIN:VEVENT[\s\S]+DTSTART;VALUE=DATE:20260915/)
  })
})
