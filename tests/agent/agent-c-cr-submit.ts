/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'

const PROD = 'https://planfully.it'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV',
  { auth: { persistSession: false } })
const OUT = '/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-C-couple-20260525-222923'
const PREFIX = 'AGENT-C-'

async function main() {
  const b = await chromium.launch({ headless: true })
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()) })

  await page.goto(`${PROD}/login`, { waitUntil: 'networkidle' })
  await page.locator('input[type="email"]').fill('giovanni.scozzafava+sposo@gmail.com')
  await page.locator('input[type="password"]').fill('Beta2026!')
  await Promise.all([
    page.waitForURL(/\/couple/, { timeout: 20_000 }),
    page.locator('button[type="submit"]').click(),
  ])
  await page.waitForTimeout(2500)

  // Vai su Alloggi (sicuro: ha CR sempre)
  await page.locator('nav button:has-text("Alloggi")').click()
  await page.waitForTimeout(800)
  await page.locator('button:has-text("Suggerisci modifica"), button:has-text("Richiedi modifica")').first().click()
  await page.waitForTimeout(800)
  // riempi
  const titleInput = page.locator('input[placeholder*="Cambiare"], input[placeholder*="tavolo"]').first()
  await titleInput.fill(`${PREFIX}richiesta-test`)
  const detailsTa = page.locator('textarea').first()
  await detailsTa.fill(`${PREFIX} dettagli test richiesta modifica`)
  await page.screenshot({ path: path.join(OUT, 'couple-32-cr-filled.png'), fullPage: true })
  await page.locator('button:has-text("Invia richiesta")').click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(OUT, 'couple-33-cr-sent.png'), fullPage: true })

  // verify DB
  const { data: rows } = await sb.from('couple_change_requests').select('*').order('created_at', { ascending: false }).limit(5)
  console.log('LAST 5 CR:', JSON.stringify(rows, null, 2))
  const ours = rows?.find((r: any) => JSON.stringify(r).includes(PREFIX))
  console.log('OUR ROW:', JSON.stringify(ours, null, 2))

  // cleanup
  if (ours) {
    await sb.from('couple_change_requests').delete().eq('id', ours.id)
    console.log('CR cleanup OK')
  }
  await b.close()
}

main().catch(console.error)
