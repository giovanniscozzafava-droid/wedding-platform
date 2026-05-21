import { test, expect, type Page } from '@playwright/test'

const SEED = {
  giulia: { email: 'giulia@wp-test.it', password: 'Test123!' },
  mario:  { email: 'mario@foto-test.it', password: 'Test123!' },
}
const MARIO_ID = '00000000-aaaa-0000-0000-000000000005'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 })
}

test.describe('Catalogo', () => {
  test('fornitore vede solo i propri servizi (5 Mario)', async ({ page }) => {
    await login(page, SEED.mario.email, SEED.mario.password)
    await page.goto('/catalog')
    await expect(page.locator('[data-testid^="service-card-"]').first()).toBeVisible({ timeout: 10_000 })
    expect(await page.locator('[data-testid^="service-card-"]').count()).toBe(5)
  })

  test('capostipite Giulia vede 19 servizi dei 3 collab, non Villa Aurora', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/catalog')
    await expect(page.locator('[data-testid^="service-card-"]').first()).toBeVisible({ timeout: 10_000 })
    expect(await page.locator('[data-testid^="service-card-"]').count()).toBe(19)
    await expect(page.getByText('Affitto sala matrimonio', { exact: false })).toHaveCount(0)
  })

  test('CREATE service via API + price_versions auto-create (trigger)', async ({ page }) => {
    await login(page, SEED.mario.email, SEED.mario.password)
    await page.goto('/catalog')

    const name = `E2E API ${Date.now()}`
    const created = await page.evaluate(async (args) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      return sb.from('services').insert({
        name: args.name,
        base_price: 999,
        unit: 'EVENTO',
        category_id: '11111111-0000-0000-0000-000000000010',
        fornitore_id: args.uid,
      }).select().single()
    }, { name, uid: MARIO_ID })
    expect((created as any).error).toBeNull()
    expect((created as any).data.name).toBe(name)
    const newId = (created as any).data.id as string

    const prices = await page.evaluate(async (sid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      return sb.from('price_versions').select('id, price, valid_until').eq('service_id', sid).is('valid_until', null)
    }, newId)
    expect((prices as any).error).toBeNull()
    expect((prices as any).data.length).toBe(1)
    expect(Number((prices as any).data[0].price)).toBe(999)
  })

  test('UPDATE base_price chiude vecchia price_version e ne apre una nuova', async ({ page }) => {
    await login(page, SEED.mario.email, SEED.mario.password)
    await page.goto('/catalog')

    const SERVICE_ID = '22220000-0005-0000-0000-000000000001'

    const before = await page.evaluate(async (sid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      return sb.from('price_versions').select('id, price, valid_until').eq('service_id', sid)
    }, SERVICE_ID)
    expect((before as any).data.length).toBe(1)
    expect(Number((before as any).data[0].price)).toBe(1500)

    const upd = await page.evaluate(async (sid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      return sb.from('services').update({ base_price: 1750 }).eq('id', sid)
    }, SERVICE_ID)
    expect((upd as any).error).toBeNull()

    const after = await page.evaluate(async (sid) => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      return sb.from('price_versions').select('id, price, valid_until, valid_from')
        .eq('service_id', sid).order('valid_from', { ascending: true })
    }, SERVICE_ID)
    const rows = (after as any).data as Array<{ price: number; valid_until: string | null }>
    expect(rows.length).toBe(2)
    expect(rows[0]!.valid_until).not.toBeNull()
    expect(Number(rows[0]!.price)).toBe(1500)
    expect(rows[1]!.valid_until).toBeNull()
    expect(Number(rows[1]!.price)).toBe(1750)
  })

  test('RLS: capostipite NON puo creare service per altro fornitore', async ({ page }) => {
    await login(page, SEED.giulia.email, SEED.giulia.password)
    await page.goto('/catalog')
    const res = await page.evaluate(async () => {
      const mod = await import('/src/lib/supabase.ts')
      const sb = (mod as any).supabase
      return sb.from('services').insert({
        name: 'HACK',
        base_price: 10,
        unit: 'PEZZO',
        category_id: '11111111-0000-0000-0000-000000000010',
        fornitore_id: '00000000-aaaa-0000-0000-000000000005',
      }).select().single()
    })
    expect((res as any).error).not.toBeNull()
  })
})
