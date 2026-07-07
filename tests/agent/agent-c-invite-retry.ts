/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import path from 'node:path'

const PROD = 'https://planfully.it'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV',
  { auth: { persistSession: false } })
const WID = '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea'
const OUT = '/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-C-couple-20260525-222923'
const PREFIX = 'AGENT-C-'

const log = (s: string) => console.log(s)

async function main() {
  // Seed invite (PARTNER è enum valido)
  const inviteEmail = `${PREFIX}invite-${Date.now()}@example.com`.toLowerCase()
  const inviteToken = crypto.randomUUID()
  const { error } = await sb.from('wedding_couple_members').insert({
    entry_id: WID,
    email: inviteEmail,
    full_name: `${PREFIX}DemoInvited`,
    role: 'PARTNER',
    invite_token: inviteToken,
    invited_at: new Date().toISOString(),
  })
  log('seed err: ' + (error?.message ?? 'OK'))
  if (error) return

  const b = await chromium.launch({ headless: true })
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log('pageerr: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') log('console: ' + m.text()) })

  await page.goto(`${PROD}/invito-coppia/${inviteToken}`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(OUT, 'couple-31-invite-form.png'), fullPage: true })

  const body = await page.locator('body').innerText()
  log('body excerpt: ' + body.replace(/\s+/g, ' ').slice(0, 600))

  // detect form fields
  const inputs = await page.locator('input').count()
  const buttons = await page.locator('button').count()
  log(`inputs=${inputs} buttons=${buttons}`)

  await b.close()
  await sb.from('wedding_couple_members').delete().eq('invite_token', inviteToken)
  log('cleanup done')
}

main().catch(async (e) => { console.error(e); await fs.writeFile(path.join(OUT, 'invite-retry-error.txt'), String(e?.stack ?? e)) })
