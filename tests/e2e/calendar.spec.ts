import { test, expect, type Page } from '@playwright/test'

const SEED = {
  giulia: { email: 'giulia@wp-test.it', password: 'Test123!' },
  mario:  { email: 'mario@foto-test.it', password: 'Test123!' },
}
const GIULIA_ID = '00000000-aaaa-0000-0000-000000000002'
const MARIO_ID = '00000000-aaaa-0000-0000-000000000005'
const FIORERIA_ID = '00000000-aaaa-0000-0000-000000000004'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 })
}

test.describe('Calendario', () => {
  test('Giulia crea evento via API con 2 fornitori participants', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/calendar')

    const stamp = Date.now()
    const title = `E2E Cal ${stamp}`
    const ret = await page.evaluate(async (args) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const { data, error } = await sb.from('calendar_entries').insert({
        owner_id: args.giulia,
        title: args.title,
        date_from: '2026-09-15',
        date_to: '2026-09-15',
        status: 'IN_TRATTATIVA',
        client_name: 'Famiglia E2E',
        value_amount: 20000,
        notes: 'nota segreta',
      }).select().single()
      if (error) return { error }
      await sb.from('calendar_entry_participants').insert([
        { entry_id: data.id, user_id: args.mario, role_in_entry: 'fotografo' },
        { entry_id: data.id, user_id: args.fioreria, role_in_entry: 'fioraio' },
      ])
      return { data }
    }, { title, mario: MARIO_ID, fioreria: FIORERIA_ID, giulia: GIULIA_ID })
    expect((ret as any).error).toBeUndefined()
    expect((ret as any).data.title).toBe(title)
  })

  test('Mario participant vede evento via view ridotta SENZA client_name/notes', async ({ page }) => {
    await login(page, SEED.mario.email, SEED.mario.password)
    await page.goto('/calendar')

    const res = await page.evaluate(async () => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const { data: viewRows } = await sb
        .from('calendar_entries_for_participants')
        .select('*')
        .eq('date_from', '2026-09-15')
      const colsCheck = await sb
        .from('calendar_entries_for_participants')
        .select('client_name, notes, value_amount')
        .limit(1)
      return { viewRows, colsErr: colsCheck.error?.message ?? null }
    })

    expect((res as any).viewRows.length).toBeGreaterThan(0)
    // tentativo SELECT campi sensibili sulla view: errore (colonna inesistente)
    expect((res as any).colsErr).toMatch(/does not exist|column/i)
  })

  test('Giulia owner vede notes e value_amount (full table access)', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/calendar')
    const res = await page.evaluate(async () => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      const { data } = await sb.from('calendar_entries').select('notes, value_amount, client_name').eq('date_from', '2026-09-15').limit(1).single()
      return data
    })
    expect((res as any).notes).toBe('nota segreta')
    expect(Number((res as any).value_amount)).toBe(20000)
    expect((res as any).client_name).toBe('Famiglia E2E')
  })

  test('Export iCal: token valido restituisce calendar feed', async ({ page, request }) => {
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
