/**
 * Stress test E2E v2 — Flussi onboarding + inviti + Pinterest.
 *
 * Copertura:
 * - Provider Onboarding Wizard (DB-side, simula fornitore appena registrato)
 * - Couple Onboarding Wizard
 * - Supplier invite v2 (esistente + nuovo + email mismatch + unique)
 * - Couple invite + accept (email match security check)
 * - Pinterest/og:image import
 * - RequireAuth onboarding gate
 */
import { test, expect, type Page, type Browser } from '@playwright/test'
import { appendFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const LOG_FILE = path.resolve(__dirname, 'stress_v2_log.md')
const SHOTS_DIR = path.resolve(__dirname, 'screenshots')
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const SB_URL = 'http://127.0.0.1:54321'

const GIULIA = { id: '00000000-aaaa-0000-0000-000000000002', email: 'giulia@wp-test.it', password: 'Test123!' }
const MARIO = { id: '00000000-aaaa-0000-0000-000000000005', email: 'mario@foto-test.it', password: 'Test123!' }

let stepCount = 0

function logStart() {
  if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true })
  writeFileSync(LOG_FILE, `# Stress Test v2 — Flussi onboarding + inviti\n\nAvvio: ${new Date().toISOString()}\n\n`)
}
function logLine(s: string) {
  appendFileSync(LOG_FILE, s + '\n')
  console.log(s)
}
async function step(desc: string, fn: () => Promise<void>) {
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

async function adminFetch(url: string, opts: RequestInit = {}): Promise<any> {
  const r = await fetch(`${SB_URL}${url}`, {
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

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  // Aspetta che termini il redirect — può essere / oppure /onboarding
  await page.waitForLoadState('networkidle', { timeout: 10_000 })
}

async function callEdgeFn(fnName: string, body: unknown, userToken?: string) {
  const r = await fetch(`${SB_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${userToken ?? SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(body),
  })
  const txt = await r.text()
  let parsed: any = null
  try { parsed = JSON.parse(txt) } catch { /* */ }
  return { status: r.status, body: parsed, raw: txt }
}

async function userSession(email: string, password: string): Promise<string> {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) throw new Error('login fail ' + await r.text())
  const j = await r.json() as { access_token: string }
  return j.access_token
}

test.describe.serial('Stress v2: onboarding + inviti + Pinterest', () => {
  test.setTimeout(180_000)

  test('Flussi completi v2', async ({ browser }) => {
    logStart()

    // --- Step 1: cleanup test residuals ----------------------------------
    await step('Cleanup supplier_invites + couple_members test', async () => {
      await adminFetch('/rest/v1/supplier_invites?email=like.*v2-test*', { method: 'DELETE' })
      await adminFetch('/rest/v1/wedding_couple_members?email=like.*v2-test*', { method: 'DELETE' })
      await adminFetch('/rest/v1/couple_preferences?vision_note=like.v2-test*', { method: 'DELETE' })
    })

    // --- Step 2: onboarding_complete gate (UI) ---------------------------
    await step('RequireAuth gate: profilo non completato → redirect /onboarding', async () => {
      // Marca Mario come non-completato e tenta accesso a /
      await adminFetch(`/rest/v1/profiles?id=eq.${MARIO.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ onboarding_complete: false }),
        headers: { 'Prefer': 'return=minimal' },
      })
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await login(page, MARIO.email, MARIO.password)
      await page.goto('/')
      await page.waitForURL((u) => u.pathname === '/onboarding', { timeout: 10_000 })
      expect(page.url()).toContain('/onboarding')
      await page.screenshot({ path: path.join(SHOTS_DIR, 'v2-onboarding-redirect.png') })
      await ctx.close()
      // Ripristina
      await adminFetch(`/rest/v1/profiles?id=eq.${MARIO.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ onboarding_complete: true }),
        headers: { 'Prefer': 'return=minimal' },
      })
    })

    // --- Step 3: Provider Wizard validations -----------------------------
    await step('ProviderWizard: validation subrole + full_name', async () => {
      // Crea fornitore test fresh non onboarded
      await adminFetch(`/rest/v1/profiles?id=eq.${MARIO.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ onboarding_complete: false, subrole: null, business_name: null }),
        headers: { 'Prefer': 'return=minimal' },
      })
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await login(page, MARIO.email, MARIO.password)
      await page.goto('/onboarding')
      await page.waitForLoadState('networkidle', { timeout: 10_000 })
      // Step 0 visibile (il wizard renderizza il titolo "Costruiamo il tuo profilo")
      await expect(page.getByText(/Costruiamo il tuo profilo/i).first()).toBeVisible({ timeout: 10_000 })
      // Pulisce full_name + clicca Avanti senza subrole
      await page.locator('input').first().fill('')
      const avantiBtn = page.getByRole('button', { name: /Avanti/i })
      await avantiBtn.click()
      // Aspetta toast "Nome obbligatorio"
      await expect(page.locator('text=Nome obbligatorio').first()).toBeVisible({ timeout: 5_000 })
      // Fill name, leave subrole vuoto, click Avanti → toast "Seleziona il tipo di servizio"
      await page.locator('input').first().fill('Mario Foto Test')
      await avantiBtn.click()
      await expect(page.locator('text=Seleziona il tipo di servizio').first()).toBeVisible({ timeout: 5_000 })
      await ctx.close()
    })

    // --- Step 4: Supplier invite (nuova email) ---------------------------
    await step('Supplier invite: edge function crea record + invio email', async () => {
      const tok = await userSession(GIULIA.email, GIULIA.password)
      const res = await callEdgeFn('invite-supplier', {
        email: 'newforn-v2-test@example.com',
        subrole: 'fioraio',
        message: 'v2-test',
      }, tok)
      logLine(`  · edge response: status=${res.status} body=${JSON.stringify(res.body)} raw=${res.raw.slice(0,200)}`)
      expect(res.status).toBe(200)
      expect(res.body?.ok).toBe(true)
      expect(['email_sent', 'collab_direct']).toContain(res.body?.mode)
      // Verifica supplier_invites
      const found = await adminFetch('/rest/v1/supplier_invites?email=eq.newforn-v2-test@example.com&select=email,status,subrole_hint')
      logLine(`  · invites found: ${JSON.stringify(found)}`)
      expect((found as any[]).length).toBeGreaterThanOrEqual(1)
      const inv = (found as any[])[0]
      expect(inv.status).toBe('PENDING')
      expect(inv.subrole_hint).toBe('fioraio')
      logLine(`  · invite creato, status=${inv.status}, hint=${inv.subrole_hint}`)
    })

    // --- Step 5: Supplier invite duplicate: auth user esiste → collab_direct
    await step('Supplier invite stessa email: auth user esiste -> collab_direct', async () => {
      const tok = await userSession(GIULIA.email, GIULIA.password)
      const res = await callEdgeFn('invite-supplier', {
        email: 'newforn-v2-test@example.com',
        subrole: 'fioraio',
      }, tok)
      // L'auth.users e' stato creato dal primo inviteUserByEmail al passo 4 →
      // ramo "user esistente" → crea collaboration diretta (ok=true, mode=collab_direct).
      expect(res.status).toBe(200)
      expect(res.body?.mode).toBe('collab_direct')
    })

    // --- Step 6: Supplier invite a utente esistente ----------------------
    await step('Supplier invite a Mario (esistente FORNITORE): crea collab direct', async () => {
      // Rimuovi vecchia collab Giulia-Mario per testare creazione fresh
      await adminFetch(`/rest/v1/collaborations?capostipite_id=eq.${GIULIA.id}&fornitore_id=eq.${MARIO.id}`, {
        method: 'DELETE',
      })
      const tok = await userSession(GIULIA.email, GIULIA.password)
      const res = await callEdgeFn('invite-supplier', { email: MARIO.email }, tok)
      expect(res.status).toBe(200)
      expect(res.body?.mode).toBe('collab_direct')
    })

    // --- Step 7: Supplier invite unique dopo cancel ----------------------
    await step('Supplier invite: cancel + re-invite stessa email → success (no unique error)', async () => {
      // Cancella l'invito v2-test PENDING
      await adminFetch('/rest/v1/supplier_invites?email=eq.newforn-v2-test@example.com&status=eq.PENDING', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELED' }),
        headers: { 'Prefer': 'return=minimal' },
      })
      const tok = await userSession(GIULIA.email, GIULIA.password)
      const res = await callEdgeFn('invite-supplier', {
        email: 'newforn-v2-test@example.com',
        subrole: 'fotografo',
      }, tok)
      expect(res.status).toBe(200)
      expect(['email_sent', 'collab_direct']).toContain(res.body?.mode)
    })

    // --- Step 8: Couple invite + accept con email check ------------------
    await step('Couple invite + accept_invite: email mismatch deve fallire (security)', async () => {
      // Crea un wedding di test owned by Giulia
      const wedding = await adminFetch('/rest/v1/calendar_entries', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          owner_id: GIULIA.id,
          title: 'Wedding test v2',
          date_from: '2026-12-31',
          date_to: '2026-12-31',
          status: 'OPZIONATA',
        }),
      })
      const entryId = (wedding as any[])[0].id

      // Invito couple member email='couple-v2-test@example.com'
      const member = await adminFetch('/rest/v1/wedding_couple_members', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          entry_id: entryId,
          email: 'couple-v2-test@example.com',
          full_name: 'Couple V2',
          role: 'SPOSA',
        }),
      })
      const token = (member as any[])[0].invite_token

      // Test 1: accept_invite con utente con email DIVERSA (Mario) → deve ritornare false
      const mTok = await userSession(MARIO.email, MARIO.password)
      const wrongR = await fetch(`${SB_URL}/rest/v1/rpc/couple_accept_invite`, {
        method: 'POST',
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${mTok}`, 'content-type': 'application/json' },
        body: JSON.stringify({ p_token: token }),
      })
      const wrongRes = await wrongR.json()
      expect(wrongRes).toBe(false) // security: email mismatch → false
      logLine(`  · email mismatch correttamente rifiutato (security check ok)`)

      // Cleanup
      await adminFetch(`/rest/v1/calendar_entries?id=eq.${entryId}`, { method: 'DELETE' })
    })

    // --- Step 9: Pinterest/og:image import -------------------------------
    await step('Edge function import-pin-url: og:image da URL pubblico', async () => {
      // Test con URL noto che ha og:image (Wikipedia)
      const tok = await userSession(GIULIA.email, GIULIA.password)
      const res = await callEdgeFn('import-pin-url', {
        url: 'https://en.wikipedia.org/wiki/Wedding',
      }, tok)
      // Accept sia 200 con image che 422 (no og:image) — molti siti
      if (res.status === 200) {
        expect(res.body?.image).toMatch(/^https?:\/\//)
        logLine(`  · og:image trovata: ${res.body.image.slice(0, 60)}...`)
      } else {
        logLine(`  · URL test no og:image: ${res.body?.error}`)
      }
    })

    // --- Step 10: Pinterest invalid URL ----------------------------------
    await step('import-pin-url: URL invalido → 400', async () => {
      const tok = await userSession(GIULIA.email, GIULIA.password)
      const res = await callEdgeFn('import-pin-url', { url: 'not-a-url' }, tok)
      expect(res.status).toBe(400)
      expect(res.body?.error).toBeTruthy()
    })

    // --- Step 11: couple_preferences upsert ------------------------------
    await step('CoupleOnboardingWizard: upsert couple_preferences OK', async () => {
      // Crea wedding + couple member accettato
      const wedding = await adminFetch('/rest/v1/calendar_entries', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          owner_id: GIULIA.id,
          title: 'Wedding pref v2',
          date_from: '2026-11-15',
          date_to: '2026-11-15',
          status: 'OPZIONATA',
        }),
      })
      const entryId = (wedding as any[])[0].id

      // Upsert preferences via service_role
      const pref = await adminFetch('/rest/v1/couple_preferences', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' },
        body: JSON.stringify({
          entry_id: entryId,
          bride_name: 'Giulia',
          groom_name: 'Marco',
          couple_name: 'Giulia & Marco',
          styles: ['CLASSICO', 'GARDEN'],
          preferred_palette: ['beige-sage-gold'],
          preferred_season: 'estate',
          location_kind: 'villa',
          vision_note: 'v2-test test vision',
          budget_min: 30000,
          budget_max: 50000,
          guests_estimate: 100,
          budget_priority: 'foto',
        }),
      })
      expect((pref as any[])[0].styles).toContain('CLASSICO')
      expect(Number((pref as any[])[0].budget_min)).toBe(30000)

      // Cleanup
      await adminFetch(`/rest/v1/calendar_entries?id=eq.${entryId}`, { method: 'DELETE' })
    })

    // --- Step 12: cleanup finale -----------------------------------------
    await step('Cleanup totale dati test v2', async () => {
      await adminFetch('/rest/v1/supplier_invites?email=like.*v2-test*', { method: 'DELETE' })
      await adminFetch('/rest/v1/wedding_couple_members?email=like.*v2-test*', { method: 'DELETE' })
    })

    logLine(`\n## Risultato finale\n\n✅ Tutti i ${stepCount} step v2 completati con successo.`)
  })
})
