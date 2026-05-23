#!/usr/bin/env tsx
/**
 * Agente persona-driven: simula utenti reali sull'app Planfully.
 *
 * Esegui:
 *   tsx tests/agent/runner.ts --role=wp --count=2
 *   tsx tests/agent/runner.ts --role=forn --count=3 --headed
 *   tsx tests/agent/runner.ts --role=couple --count=1 --headed
 *   tsx tests/agent/runner.ts --all   # 1 di ogni
 *
 * Flags:
 *   --role=wp|loc|forn|couple
 *   --count=N           default 1
 *   --headed            mostra il browser
 *   --base=<url>        default http://localhost:5173
 *   --slowmo=<ms>       ritardo tra azioni (default 0)
 */
import { chromium, type Browser } from '@playwright/test'
import { makePersona, type Role } from './personas'
import { runProviderScenario } from './scenarios/provider'
import { runCoupleScenario } from './scenarios/couple'
import { ensureRunDir, logStep } from './utils'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

type Args = {
  role?: 'wp' | 'loc' | 'forn' | 'couple'
  count: number
  headed: boolean
  slowmo: number
  base: string
  all: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { count: 1, headed: false, slowmo: 0, base: 'http://localhost:5173', all: false }
  for (const a of argv.slice(2)) {
    if (a === '--headed') args.headed = true
    else if (a === '--all') args.all = true
    else if (a.startsWith('--role=')) args.role = a.split('=')[1] as Args['role']
    else if (a.startsWith('--count=')) args.count = parseInt(a.split('=')[1] ?? '1', 10)
    else if (a.startsWith('--slowmo=')) args.slowmo = parseInt(a.split('=')[1] ?? '0', 10)
    else if (a.startsWith('--base=')) args.base = a.split('=')[1] ?? args.base
  }
  return args
}

const ROLE_MAP: Record<NonNullable<Args['role']>, Role> = {
  wp: 'WP', loc: 'LOC', forn: 'FORN', couple: 'COUPLE',
}

async function runOne(browser: Browser, role: Role, base: string) {
  const persona = makePersona(role)
  const runDir = ensureRunDir(`${role.toLowerCase()}-${persona.firstName.toLowerCase()}`)
  writeFileSync(path.join(runDir, 'persona.json'), JSON.stringify(persona, null, 2))
  const ctx = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const t0 = Date.now()
  let ok = true
  let err: string | undefined
  try {
    if (role === 'COUPLE') await runCoupleScenario(ctx, page, persona, runDir)
    else await runProviderScenario(page, persona, runDir)
  } catch (e) {
    ok = false
    err = e instanceof Error ? e.message : String(e)
    logStep(runDir, `\n❌ FAIL: ${err}`)
    try { await page.screenshot({ path: path.join(runDir, 'fatal.png'), fullPage: true }) } catch { /* */ }
  } finally {
    const elapsed = Date.now() - t0
    logStep(runDir, `\n--- end ${ok ? '✅' : '❌'} ${elapsed}ms`)
    await ctx.close()
  }
  return { runDir, ok, err, persona, elapsed: Date.now() - t0 }
}

async function main() {
  const args = parseArgs(process.argv)
  const roles: Role[] = args.all
    ? ['WP', 'LOC', 'FORN', 'FORN', 'COUPLE']
    : args.role
    ? Array.from({ length: args.count }, () => ROLE_MAP[args.role!])
    : (() => { console.error('Usage: --role=wp|loc|forn|couple [--count=N] [--headed] [--all]'); process.exit(1) })()

  console.log(`\n▶ Avvio ${roles.length} agenti (headed=${args.headed}) su ${args.base}\n`)

  const browser = await chromium.launch({ headless: !args.headed, slowMo: args.slowmo })
  const results: Array<{ runDir: string; ok: boolean; err?: string; persona: any; elapsed: number }> = []

  for (const role of roles) {
    const r = await runOne(browser, role, args.base)
    results.push(r)
  }

  await browser.close()

  // Summary
  console.log('\n\n═══════════ SUMMARY ═══════════')
  const ok = results.filter((r) => r.ok).length
  console.log(`OK:   ${ok}/${results.length}`)
  console.log(`FAIL: ${results.length - ok}/${results.length}`)
  for (const r of results) {
    const status = r.ok ? '✅' : '❌'
    console.log(`  ${status} ${r.persona.role} ${r.persona.fullName.padEnd(28)} ${r.elapsed}ms  →  ${r.runDir}`)
    if (!r.ok) console.log(`      ${r.err}`)
  }

  process.exit(results.length - ok > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
