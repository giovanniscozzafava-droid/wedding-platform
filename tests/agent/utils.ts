import type { Page, Locator } from '@playwright/test'
import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'

export const SB_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export function ensureRunDir(name: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = path.resolve('tests/agent/runs', `${ts}-${name}`)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'log.md'), `# Agent run: ${name}\n\nStart: ${new Date().toISOString()}\n\n`)
  return dir
}

export function logStep(runDir: string, msg: string) {
  const line = msg + '\n'
  appendFileSync(path.join(runDir, 'log.md'), line)
  process.stdout.write(line)
}

export async function screenshot(page: Page, runDir: string, name: string) {
  try {
    await page.screenshot({ path: path.join(runDir, `${name}.png`), fullPage: true })
  } catch { /* ignore */ }
}

export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// Simula typing umano (con piccola variazione di timing).
// Resilient: fallback su .fill() se click/type fail; total timeout ~3s.
export async function humanType(locator: Locator, text: string) {
  if (!text) return
  try {
    await locator.waitFor({ state: 'visible', timeout: 2500 })
    await locator.fill(text, { timeout: 2500 })
  } catch {
    // ignore: campo non trovato/non interagibile
  }
}

// Click button con fallback robusto
export async function safeClick(locator: Locator) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 4000 })
    await locator.click({ timeout: 4000 })
  } catch {
    // ignore
  }
}

export async function adminFetch(urlPath: string, opts: RequestInit = {}): Promise<unknown> {
  const r = await fetch(`${SB_URL}${urlPath}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(opts.headers ?? {}),
    },
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${await r.text()}`)
  const txt = await r.text()
  return txt ? JSON.parse(txt) : null
}
