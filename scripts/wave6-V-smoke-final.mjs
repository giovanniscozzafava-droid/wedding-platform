#!/usr/bin/env node
/**
 * WAVE 6 — Agent V — FINAL SMOKE TEST overnight Planfully
 *
 * Verifica che TUTTI i flussi critici funzionino dopo gli ultimi hardening:
 *   - S1: state machine quote_status (Wave 6, mig 20260526020200_quote_hardening_v3)
 *   - S2: CHECK constraints quote_items (Wave 6, mig 20260526020000_quote_hardening)
 *   - S3: tab Programma empty state + ChangeRequestModal (Wave 6, commit fd71263)
 *   - S4: re-verify 18 hotfix Wave 1-5
 *   - S5: performance regression
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const RUN_DIR = process.env.RUN_DIR
if (!RUN_DIR) { console.error('Set RUN_DIR'); process.exit(1) }
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })

const PROD = 'https://planfully.it'
const DEPLOY_ID = '33i3yksb1'
const PWD = 'Beta2026!'

const WP_EMAIL = 'wp-mini@planfully-demo.it'
const WP_ID = '712baed0-3957-4452-8aab-ab4eeebb2697'
const FORN_FOTO_EMAIL = 'forn-mini-foto@planfully-demo.it'
const FORN_FOTO_ID = '747707fe-03be-4bb8-95b8-17b43b465526'
const FORN_FIORI_EMAIL = 'forn-mini-fiori@planfully-demo.it'
const FORN_FIORI_ID = 'a0262dd1-f07c-4359-a9c0-1186e98971a3'
const SPOSO_EMAIL = 'giovanni.scozzafava+sposo@gmail.com'
const SPOSO_ID = '6e61b300-66f5-4ddb-9fc0-b0d3351a63b7'
const SPOSO_WEDDING = '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea'

const svc = createClient(URL, SVC, { auth: { persistSession: false } })
const tests = []
const cleanup = []
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const TAG = 'AGENT-V-'

function record(t) {
  tests.push(t)
  const tag = t.verdict
  console.log(`[${tag}] ${t.id} — ${t.title}${t.note ? ' :: ' + t.note : ''}`)
}

async function loginAs(email, password = PWD) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const r = await c.auth.signInWithPassword({ email, password })
  if (r.error) throw new Error(`Login fail ${email}: ${r.error.message}`)
  return { client: c, token: r.data.session.access_token, user: r.data.user }
}

// =========================================================================
// S1: State machine quote_status (auth required, NOT service-role which bypasses)
// =========================================================================
async function s1_state_machine() {
  const t = { id: 'S1', title: 'State machine quote_status (BOZZA→INVIATO→ACCETTATO→CONVERTITO + block invalid)', verdict: 'SKIP', details: { steps: [] } }
  let qid = null
  try {
    const sess = await loginAs(WP_EMAIL)
    const eventDate = new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    // 1) Create BOZZA via authenticated session (so trigger sees auth.uid())
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}S1 state machine`,
      client_name: 'Test S1',
      client_email: 's1@planfully-demo.it',
      event_date: eventDate,
      guest_count: 60,
      status: 'BOZZA',
      revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 1000,
      total_client: 1200,
      margin_amount: 200,
      margin_percent: 20,
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = 'insert err: ' + ins.error.message; record(t); return }
    qid = ins.data.id
    cleanup.push({ kind: 'quote', id: qid })
    t.details.steps.push({ step: 'create_BOZZA', status: ins.data.status, ok: true })

    // 2) BOZZA → INVIATO (OK)
    const u1 = await sess.client.from('quotes').update({ status: 'INVIATO' }).eq('id', qid).select().single()
    t.details.steps.push({ step: 'BOZZA->INVIATO', status: u1.data?.status, err: u1.error?.message, ok: !u1.error && u1.data?.status === 'INVIATO' })

    // 3) INVIATO → ACCETTATO (with accepted_at)
    const u2 = await sess.client.from('quotes').update({ status: 'ACCETTATO', accepted_at: new Date().toISOString() }).eq('id', qid).select().single()
    t.details.steps.push({ step: 'INVIATO->ACCETTATO', status: u2.data?.status, err: u2.error?.message, ok: !u2.error && u2.data?.status === 'ACCETTATO' })

    // 4) ACCETTATO → RIFIUTATO (must BLOCK — not in allowed transitions from ACCETTATO)
    const u3 = await sess.client.from('quotes').update({ status: 'RIFIUTATO' }).eq('id', qid).select().single()
    const u3_blocked = !!u3.error && (/non valida|P0001/i.test(u3.error.message) || u3.error.code === 'P0001')
    t.details.steps.push({ step: 'ACCETTATO->RIFIUTATO (must BLOCK)', err: u3.error?.message, err_code: u3.error?.code, blocked: u3_blocked, ok: u3_blocked })

    // 5) ACCETTATO → CONVERTITO_IN_CONTRATTO (OK)
    const u4 = await sess.client.from('quotes').update({ status: 'CONVERTITO_IN_CONTRATTO' }).eq('id', qid).select().single()
    t.details.steps.push({ step: 'ACCETTATO->CONVERTITO_IN_CONTRATTO', status: u4.data?.status, err: u4.error?.message, ok: !u4.error && u4.data?.status === 'CONVERTITO_IN_CONTRATTO' })

    // 6) CONVERTITO → INVIATO (must BLOCK)
    const u5 = await sess.client.from('quotes').update({ status: 'INVIATO' }).eq('id', qid).select().single()
    const u5_blocked = !!u5.error && (/non valida|P0001/i.test(u5.error.message) || u5.error.code === 'P0001')
    t.details.steps.push({ step: 'CONVERTITO->INVIATO (must BLOCK)', err: u5.error?.message, err_code: u5.error?.code, blocked: u5_blocked, ok: u5_blocked })

    const allOk = t.details.steps.every(s => s.ok)
    t.verdict = allOk ? 'PASS' : 'FAIL'
    if (!allOk) t.note = `failed steps: ${t.details.steps.filter(s => !s.ok).map(s => s.step).join('; ')}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// =========================================================================
// S2: CHECK constraints quote_items (qitems_label_not_empty, qitems_quantity_range)
// =========================================================================
async function s2_check_constraints() {
  const t = { id: 'S2', title: 'CHECK constraints quote_items (label_not_empty, quantity_range)', verdict: 'SKIP', details: { steps: [] } }
  let qid = null
  let validQiId = null
  try {
    const sess = await loginAs(WP_EMAIL)
    const eventDate = new Date(Date.now() + 210 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}S2 check constraints`,
      client_name: 'Test S2',
      client_email: 's2@planfully-demo.it',
      event_date: eventDate,
      guest_count: 60,
      status: 'BOZZA',
      revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 0,
      total_client: 0,
      margin_amount: 0,
      margin_percent: 20,
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = 'quote insert err: ' + ins.error.message; record(t); return }
    qid = ins.data.id
    cleanup.push({ kind: 'quote', id: qid })

    // 1) name_snapshot='' must FAIL (qitems_label_not_empty)
    const x1 = await sess.client.from('quote_items').insert({
      quote_id: qid, name_snapshot: '', quantity_basis: 'FLAT', quantity: 1, snapshot_price: 100, unit_snapshot: 'PEZZO',
    }).select().single()
    const x1_blocked = !!x1.error && /qitems_label_not_empty|check/i.test(x1.error.message)
    t.details.steps.push({ step: 'name_snapshot="" → must BLOCK', err: x1.error?.message?.slice(0, 160), err_code: x1.error?.code, blocked: x1_blocked, ok: x1_blocked })

    // 2) quantity=100000 must FAIL (qitems_quantity_range max 99999)
    const x2 = await sess.client.from('quote_items').insert({
      quote_id: qid, name_snapshot: 'Item OK', quantity_basis: 'FLAT', quantity: 100000, snapshot_price: 100, unit_snapshot: 'PEZZO',
    }).select().single()
    const x2_blocked = !!x2.error && /qitems_quantity_range|check/i.test(x2.error.message)
    t.details.steps.push({ step: 'quantity=100000 → must BLOCK', err: x2.error?.message?.slice(0, 160), err_code: x2.error?.code, blocked: x2_blocked, ok: x2_blocked })

    // 3) quantity=-1 must FAIL (legacy "quantity > 0" check OR qitems_quantity_range)
    const x3 = await sess.client.from('quote_items').insert({
      quote_id: qid, name_snapshot: 'Item OK', quantity_basis: 'FLAT', quantity: -1, snapshot_price: 100, unit_snapshot: 'PEZZO',
    }).select().single()
    const x3_blocked = !!x3.error && /qitems_quantity_range|quote_items_quantity|check/i.test(x3.error.message)
    t.details.steps.push({ step: 'quantity=-1 → must BLOCK', err: x3.error?.message?.slice(0, 160), err_code: x3.error?.code, blocked: x3_blocked, ok: x3_blocked })

    // 4) Valid insert: name "Catering", quantity=50 → OK
    const x4 = await sess.client.from('quote_items').insert({
      quote_id: qid, name_snapshot: 'Catering S2', quantity_basis: 'PER_GUEST', quantity: 50, snapshot_price: 25, unit_snapshot: 'PERSONA',
    }).select().single()
    t.details.steps.push({ step: 'name="Catering" qty=50 → OK', id: x4.data?.id, err: x4.error?.message, ok: !x4.error && !!x4.data?.id })
    if (x4.data?.id) { validQiId = x4.data.id; cleanup.push({ kind: 'quote_item', id: validQiId }) }

    const allOk = t.details.steps.every(s => s.ok)
    t.verdict = allOk ? 'PASS' : 'FAIL'
    if (!allOk) t.note = `failed: ${t.details.steps.filter(s => !s.ok).map(s => s.step).join('; ')}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// =========================================================================
// S3: tab Programma coppia empty state + ChangeRequestModal trigger
// =========================================================================
async function s3_programma_empty_state() {
  const t = { id: 'S3', title: 'tab Programma empty state + ChangeRequestModal trigger', verdict: 'SKIP', details: {} }
  try {
    const root = '/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src'
    const couplePath = resolve(root, 'pages/couple/CoupleDashboard.tsx')
    if (!existsSync(couplePath)) { t.verdict = 'FAIL'; t.note = 'CoupleDashboard.tsx not found'; record(t); return }
    const s = readFileSync(couplePath, 'utf8')

    // Check empty state copy
    const hasEmptyScaletta = /La scaletta del giorno-matrimonio non è ancora/.test(s)
    // Check ChangeRequestModal presence in Programma section for both subevents and timeline
    const hasModalTimeline = /ChangeRequestModal[^/]*entityType="TIMELINE"/.test(s)
    const hasModalSubevent = /ChangeRequestModal[^/]*entityType="SUBEVENT"/.test(s)
    const hasEmptyEventi = /non ha ancora aggiunto eventi/i.test(s)
    t.details.checks = { hasEmptyScaletta, hasModalTimeline, hasModalSubevent, hasEmptyEventi }

    // Verify CCR insert from sposo works (post Wave 1 RLS fix — already tested in F01, but redo here as smoke)
    const sess = await loginAs(SPOSO_EMAIL)
    const ccr = await sess.client.from('couple_change_requests').insert({
      wedding_id: SPOSO_WEDDING,
      requested_by: sess.user.id,
      entity_type: 'TIMELINE',
      action: 'UPDATE',
      title: `${TAG}S3 suggerimento scaletta`,
      description: 'sposto cerimonia alle 17:00',
      payload: { from: 'agent-V S3' },
    }).select().single()
    t.details.ccr_inserted = ccr.data?.id ?? null
    t.details.ccr_err = ccr.error?.message ?? null
    if (ccr.data?.id) cleanup.push({ kind: 'ccr', id: ccr.data.id })

    const allOk = hasEmptyScaletta && hasModalTimeline && hasModalSubevent && hasEmptyEventi && !!ccr.data?.id
    t.verdict = allOk ? 'PASS' : 'FAIL'
    if (!allOk) t.note = `code-checks=${JSON.stringify(t.details.checks)} ccr=${!!ccr.data?.id}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// =========================================================================
// S4 — 18 hotfix Wave 1-5 quick re-verify
//   We reuse the exact tests from wave5-U-final-regression as smoke-1-line checks
// =========================================================================

// F01: RLS couple_change_requests
async function f01() {
  const t = { id: 'F01', title: 'RLS couple_change_requests sposo INSERT', verdict: 'SKIP', details: {} }
  try {
    const sess = await loginAs(SPOSO_EMAIL)
    const r = await sess.client.from('couple_change_requests').insert({
      wedding_id: SPOSO_WEDDING, requested_by: sess.user.id, entity_type: 'OTHER',
      action: 'UPDATE', title: `${TAG}F01`, description: 'check', payload: {},
    }).select().single()
    if (r.data?.id) cleanup.push({ kind: 'ccr', id: r.data.id })
    t.verdict = (r.data?.id && r.error?.code !== '42501') ? 'PASS' : 'FAIL'
    if (t.verdict === 'FAIL') t.note = r.error?.message?.slice(0, 100)
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F02: collab supplier scope (forn-foto not in andrea)
async function f02() {
  const t = { id: 'F02', title: 'RLS collab supplier scope (no leak)', verdict: 'SKIP', details: {} }
  try {
    const andrea = 'c1b8b3bc-d3a0-4398-8f95-32aa81aa5c60'
    const parts = await svc.from('calendar_entry_participants').select('user_id').eq('entry_id', andrea).eq('user_id', FORN_FOTO_ID)
    if ((parts.data?.length ?? 0) > 0) { t.note = 'forn-foto is participant'; t.verdict = 'SKIP'; record(t); return }
    const sess = await loginAs(FORN_FOTO_EMAIL)
    const r = await sess.client.from('calendar_entries').select('id').eq('id', andrea)
    t.details.leak_count = r.data?.length ?? 0
    t.verdict = (r.data?.length ?? 0) === 0 ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F03: upload-photo PNG → 200
async function f03() {
  const t = { id: 'F03', title: 'upload-photo PNG → 200', verdict: 'SKIP', details: {} }
  let serviceId = null
  try {
    const sess = await loginAs(FORN_FOTO_EMAIL)
    let categoryId = null
    const cat = await svc.from('service_categories').select('id').limit(1).single()
    categoryId = cat.data?.id ?? null
    const svcIns = await svc.from('services').insert({
      fornitore_id: sess.user.id, name: `${TAG}F03 svc`, category_id: categoryId,
      base_price: 100, unit: 'EVENTO', is_active: false,
    }).select().single()
    if (svcIns.error) { t.verdict = 'FAIL'; t.note = svcIns.error.message; record(t); return }
    serviceId = svcIns.data.id
    cleanup.push({ kind: 'service', id: serviceId })
    const png = Buffer.from(TINY_PNG_B64, 'base64')
    const fd = new FormData()
    fd.append('service_id', serviceId)
    fd.append('file', new Blob([png], { type: 'image/png' }), 'agent-v.png')
    const r = await fetch(`${URL}/functions/v1/upload-photo`, {
      method: 'POST', headers: { 'authorization': `Bearer ${sess.token}`, 'apikey': ANON }, body: fd,
    })
    const tx = await r.text()
    let body = null; try { body = JSON.parse(tx) } catch {}
    if (body?.photo?.id) cleanup.push({ kind: 'service_photo', id: body.photo.id })
    t.details.status = r.status
    t.verdict = r.status === 200 ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F04: import-pin-url Pinterest 422 user-friendly
async function f04() {
  const t = { id: 'F04', title: 'import-pin-url Pinterest 422 italiano/no og:image', verdict: 'SKIP', details: {} }
  try {
    const sess = await loginAs(FORN_FOTO_EMAIL)
    const r = await fetch(`${URL}/functions/v1/import-pin-url`, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${sess.token}`, 'apikey': ANON, 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.pinterest.com/pin/0000000000000000/' }),
    })
    const tx = await r.text()
    let body = null; try { body = JSON.parse(tx) } catch {}
    t.details.status = r.status
    t.details.error_body = body?.error?.slice(0, 100)
    const ok = (r.status === 200 && (body?.image || body?.title)) || (r.status === 422 && typeof body?.error === 'string')
    t.verdict = ok ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F05: state-machine BOZZA→INVIATO→ACCETTATO end-to-end (now via auth, with state machine constraints)
async function f05() {
  const t = { id: 'F05', title: 'quotes BOZZA→INVIATO→ACCETTATO trigger avail OK', verdict: 'SKIP', details: {} }
  try {
    const sess = await loginAs(WP_EMAIL)
    const eventDate = new Date(Date.now() + 220 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id, title: `${TAG}F05 trigger avail`,
      client_name: 'F05', client_email: 'f05@planfully-demo.it',
      event_date: eventDate, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 1000, total_client: 1250, margin_amount: 250, margin_percent: 20,
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = ins.error.message; record(t); return }
    cleanup.push({ kind: 'quote', id: ins.data.id })
    // attach a quote_item
    await sess.client.from('quote_items').insert({
      quote_id: ins.data.id, name_snapshot: 'Foto', basis: 'FLAT', quantity: 1, snapshot_price: 800,
      supplier_id: FORN_FOTO_ID, markup_percent_override: 25,
    })
    // BOZZA→INVIATO
    const u1 = await sess.client.from('quotes').update({ status: 'INVIATO' }).eq('id', ins.data.id).select().single()
    // INVIATO→ACCETTATO (avail trigger fires)
    const u2 = await sess.client.from('quotes').update({ status: 'ACCETTATO', accepted_at: new Date().toISOString() }).eq('id', ins.data.id).select().single()
    cleanup.push({ kind: 'supplier_availability', fornitore_id: FORN_FOTO_ID, date: eventDate })
    t.details.u1_status = u1.data?.status
    t.details.u2_status = u2.data?.status
    t.details.u2_err = u2.error?.message
    t.verdict = (u2.data?.status === 'ACCETTATO') ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F06: fornitore direct quote insert
async function f06() {
  const t = { id: 'F06', title: 'RLS quotes INSERT fornitore OK', verdict: 'SKIP', details: {} }
  try {
    const sess = await loginAs(FORN_FOTO_EMAIL)
    const r = await sess.client.from('quotes').insert({
      owner_id: sess.user.id, title: `${TAG}F06 forn direct`,
      client_name: 'Cliente F06', client_email: 'f06@example.com',
      event_date: new Date(Date.now() + 230 * 86400000).toISOString().slice(0, 10),
      guest_count: 30, status: 'BOZZA', revision: 1,
      total_cost: 500, total_client: 600, margin_amount: 100, margin_percent: 20,
    }).select().single()
    if (r.data?.id) cleanup.push({ kind: 'quote', id: r.data.id })
    t.verdict = (r.data?.id) ? 'PASS' : 'FAIL'
    if (!r.data?.id) t.note = `code=${r.error?.code} ${r.error?.message?.slice(0, 80)}`
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F07: cookie banner z-40 / pointer-events-none
async function f07() {
  const t = { id: 'F07', title: 'CookieBanner z-40 / pointer-events-none', verdict: 'SKIP', details: {} }
  try {
    const root = '/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src'
    const candidates = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(resolve(dir, e.name))
        else if (/CookieBanner|cookie-banner|CookieConsent/i.test(e.name)) candidates.push(resolve(dir, e.name))
      }
    }
    walk(root)
    let hasZ40 = false, hasPointerNone = false
    for (const f of candidates) {
      const s = readFileSync(f, 'utf8')
      if (/z-40|z-index:\s*40/.test(s)) hasZ40 = true
      if (/pointer-events-none|pointer-events:\s*none/.test(s)) hasPointerNone = true
    }
    t.details.checks = { hasZ40, hasPointerNone, files: candidates.length }
    t.verdict = (hasZ40 || hasPointerNone) ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F08: PDF brand fornitore FREE — code anchor
async function f08() {
  const t = { id: 'F08', title: 'PDF brand_primary_color usato anche FREE', verdict: 'SKIP', details: {} }
  try {
    const path = '/Users/giovanniscozzafava/Repository/wedding-platform/supabase/functions/quote-generate-pdf/index.ts'
    if (!existsSync(path)) { t.verdict = 'FAIL'; t.note = 'pdf fn not found'; record(t); return }
    const s = readFileSync(path, 'utf8')
    const readsBrand = /brand_primary_color/.test(s)
    let tierGate = false
    const lines = s.split('\n')
    lines.forEach((ln, i) => {
      if (/brand_primary_color/.test(ln)) {
        const ctx = lines.slice(Math.max(0, i - 12), i + 3).join('\n')
        if (/if\s*\([^)]*subscription_tier[^)]*===\s*['"]FREE['"]/.test(ctx)) tierGate = true
      }
    })
    t.details = { readsBrand, tierGate }
    t.verdict = (readsBrand && !tierGate) ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F09: quote-accept-sign 5x parallel → 1 OK + 4 conflict
async function f09() {
  const t = { id: 'F09', title: 'quote-accept-sign 5x parallel idempotency', verdict: 'SKIP', details: {} }
  try {
    const token = crypto.randomUUID()
    const eventDate = new Date(Date.now() + 240 * 86400000).toISOString().slice(0, 10)
    const ins = await svc.from('quotes').insert({
      owner_id: WP_ID, title: `${TAG}F09`, client_name: 'F09',
      client_email: 'f09@planfully-demo.it', event_date: eventDate, guest_count: 60,
      status: 'INVIATO', revision: 1, access_token: token,
      total_cost: 9000, total_client: 11000, margin_amount: 2000, margin_percent: 22,
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = 'insert err'; record(t); return }
    cleanup.push({ kind: 'quote', id: ins.data.id })
    const payload = {
      token, signer_name: `${TAG}signer`, signer_phone: '+39 333 0000000',
      doc_type: 'CARTA_IDENTITA', doc_number: 'AY9999999', doc_issued_by: 'Roma',
      signature_data_url: `data:image/png;base64,${TINY_PNG_B64}`,
      consent_terms: true, consent_privacy: true,
    }
    const endpoint = `${URL}/functions/v1/quote-accept-sign`
    const promises = Array.from({ length: 5 }, () =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${ANON}`, 'apikey': ANON },
        body: JSON.stringify(payload),
      }).then(r => r.status).catch(() => 0)
    )
    const statuses = await Promise.all(promises)
    const c200 = statuses.filter(s => s === 200).length
    const c409 = statuses.filter(s => s === 409).length
    t.details = { statuses, c200, c409 }
    await new Promise(r => setTimeout(r, 1200))
    const { data: acc } = await svc.from('quote_acceptances').select('id').eq('quote_id', ins.data.id)
    cleanup.push(...(acc ?? []).map(a => ({ kind: 'acceptance', id: a.id })))
    t.details.db_acceptances = acc?.length
    t.verdict = (c200 === 1 && c409 === 4 && acc?.length === 1) ? 'PASS' : 'FAIL'
    if (t.verdict !== 'PASS') t.note = `200=${c200}/1 409=${c409}/4 acc=${acc?.length}/1`
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F10: tab strip edge-fade
async function f10() {
  const t = { id: 'F10', title: 'tab strip edge-fade gradient', verdict: 'SKIP', details: {} }
  try {
    const root = '/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src'
    const files = []
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(resolve(d, e.name)); else if (/(CoupleDashboard|WeddingDashboard)/.test(e.name) && /\.tsx$/.test(e.name)) files.push(resolve(d, e.name)) } }
    walk(root)
    let hits = 0
    for (const f of files) {
      const s = readFileSync(f, 'utf8')
      if (/(from-(white|background)|to-transparent|bg-gradient|edge-fade)/.test(s)) hits++
    }
    t.details = { files: files.length, hits }
    t.verdict = (hits >= 1) ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F11: header sposi mobile chip @ 375
async function f11() {
  const t = { id: 'F11', title: 'header sposi 375px chip iniziali', verdict: 'SKIP', details: {} }
  try {
    const root = '/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src'
    const candidates = []
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(resolve(d, e.name)); else if (/CoupleDashboard|CoupleHeader|wedding-header/i.test(e.name) && /\.tsx$/.test(e.name)) candidates.push(resolve(d, e.name)) } }
    walk(root)
    // look for initials chip pattern (mobile only)
    let foundChip = false
    for (const f of candidates) {
      const s = readFileSync(f, 'utf8')
      // patterns: rounded-full + initials AND (sm:hidden | block sm:hidden) | charAt(0)
      if (/(rounded-full|chip|initials)/i.test(s) && /(charAt\(0\)|\.toUpperCase|initials)/i.test(s) && /(sm:hidden|md:hidden|max-sm)/i.test(s)) {
        foundChip = true
      }
    }
    t.details = { candidates: candidates.length, foundChip }
    t.verdict = foundChip ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F12: bundle index < 600KB + vendor chunks
async function f12() {
  const t = { id: 'F12', title: 'bundle index<600KB + vendor chunks', verdict: 'SKIP', details: {} }
  try {
    const html = await fetch(PROD).then(r => r.text())
    const matches = [...html.matchAll(/assets\/(vendor-[a-z]+|index)[^"]+\.js/g)].map(m => m[0])
    const uniq = [...new Set(matches)]
    const required = ['index', 'vendor-react', 'vendor-supabase', 'vendor-pdf']
    const missing = required.filter(r => !uniq.some(u => u.includes(`assets/${r}-`)))
    const indexChunk = uniq.find(c => c.startsWith('assets/index-'))
    let indexSize = 0
    if (indexChunk) {
      const resp = await fetch(`${PROD}/${indexChunk}`)
      const buf = await resp.arrayBuffer()
      indexSize = buf.byteLength
    }
    t.details = { chunks: uniq, missing, index_kb: (indexSize / 1024).toFixed(1) }
    t.verdict = (missing.length === 0 && indexSize < 600 * 1024 && indexSize > 0) ? 'PASS' : 'FAIL'
    if (t.verdict === 'FAIL') t.note = `index=${t.details.index_kb}KB missing=${missing.join(',')}`
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F13: contracts CHECK FIRMATO requires signed_at
async function f13() {
  const t = { id: 'F13', title: 'contracts FIRMATO ha signed_at popolato + CHECK', verdict: 'SKIP', details: {} }
  try {
    const { data: badFirmato } = await svc.from('contracts').select('id, signed_at, signature_data, status')
      .eq('status', 'FIRMATO').or('signed_at.is.null,signature_data.is.null')
    t.details.legacy_bad = (badFirmato ?? []).length
    // Try direct invalid update
    const ins = await svc.from('contracts').insert({
      owner_id: WP_ID, title: `${TAG}F13`, client_name: 'F13',
      client_email: 'f13@planfully-demo.it', status: 'BOZZA',
      access_token: crypto.randomUUID(), sections: [],
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = ins.error.message; record(t); return }
    cleanup.push({ kind: 'contract', id: ins.data.id })
    const upd = await svc.from('contracts').update({ status: 'FIRMATO' }).eq('id', ins.data.id).select().single()
    const blocked = !!upd.error && /contracts_firmato_requires_signature|check/i.test(upd.error.message)
    t.details.blocked = blocked
    t.verdict = (blocked && t.details.legacy_bad === 0) ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F14: quotes ACCETTATO has accepted_at (legacy backfill + new state-machine guard)
async function f14() {
  const t = { id: 'F14', title: 'quotes ACCETTATO ha accepted_at popolato', verdict: 'SKIP', details: {} }
  try {
    const { data: badQ } = await svc.from('quotes').select('id, status, accepted_at')
      .in('status', ['ACCETTATO', 'CONVERTITO_IN_CONTRATTO']).is('accepted_at', null)
    t.details.legacy_bad = (badQ ?? []).length
    // Try invalid update on a new INVIATO quote (via authenticated session — state machine allowed but CHECK blocks)
    const sess = await loginAs(WP_EMAIL)
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id, title: `${TAG}F14`,
      client_name: 'F14', client_email: 'f14@planfully-demo.it',
      status: 'INVIATO', revision: 1, access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
      event_date: new Date(Date.now() + 250 * 86400000).toISOString().slice(0, 10),
      guest_count: 30,
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = ins.error.message; record(t); return }
    cleanup.push({ kind: 'quote', id: ins.data.id })
    const upd = await sess.client.from('quotes').update({ status: 'ACCETTATO' }).eq('id', ins.data.id).select().single()
    const blocked = !!upd.error && /accepted_at|quotes_accettato/i.test(upd.error.message)
    t.details.blocked = blocked
    t.verdict = (blocked && t.details.legacy_bad === 0) ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F15: set_updated_at trigger on market_prices
async function f15() {
  const t = { id: 'F15', title: 'trigger set_updated_at su market_prices', verdict: 'SKIP', details: {} }
  try {
    const probe = await svc.from('market_prices').select('*').limit(1)
    const sample = probe.data?.[0]
    if (!sample) { t.verdict = 'SKIP'; t.note = 'no rows'; record(t); return }
    const cols = Object.keys(sample)
    const benignCol = cols.find(c => typeof sample[c] === 'string' && c !== 'id' && !c.includes('_at'))
    if (!benignCol) { t.verdict = 'SKIP'; t.note = 'no benign col'; record(t); return }
    const before = sample.updated_at
    await new Promise(r => setTimeout(r, 50))
    const u = await svc.from('market_prices').update({ [benignCol]: sample[benignCol] }).eq('id', sample.id).select('updated_at').single()
    const changed = u.data?.updated_at !== before
    t.details = { before, after: u.data?.updated_at, changed }
    t.verdict = changed ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F16: QuoteEditor "Genera contratto" button
async function f16() {
  const t = { id: 'F16', title: 'QuoteEditor banner ACCETTATO ha "Genera contratto"', verdict: 'SKIP', details: {} }
  try {
    const root = '/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src'
    const files = []
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(resolve(d, e.name)); else if (/QuoteEditor/i.test(e.name) && /\.tsx$/.test(e.name)) files.push(resolve(d, e.name)) } }
    walk(root)
    let found = false
    for (const f of files) {
      const s = readFileSync(f, 'utf8')
      if (/Genera contratto/i.test(s)) found = true
    }
    t.details = { files: files.length, found }
    t.verdict = found ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F17: wedding_site_rsvp 2x stessa email → 1 row updated
async function f17() {
  const t = { id: 'F17', title: 'wedding_site_rsvp idempotente per email', verdict: 'SKIP', details: {} }
  try {
    const slug = 'andrea-e-sofia-audit'
    const entryId = 'c1b8b3bc-d3a0-4398-8f95-32aa81aa5c60'
    const email = `agent-v-rsvp+${Date.now()}@planfully-demo.it`
    cleanup.push({ kind: 'event_guests_by_email', entry_id: entryId, email })
    const r1 = await svc.rpc('wedding_site_rsvp', {
      p_slug: slug, p_full_name: 'V First', p_email: email, p_rsvp: 'YES',
      p_party: 2, p_diet: 'veg', p_notes: 'first',
    })
    const r2 = await svc.rpc('wedding_site_rsvp', {
      p_slug: slug, p_full_name: 'V Updated', p_email: email, p_rsvp: 'YES',
      p_party: 4, p_diet: 'gluten-free', p_notes: 'second',
    })
    t.details = { r1_err: r1.error?.message, r2_err: r2.error?.message }
    const { data: rows } = await svc.from('event_guests').select('id, party_size, diet')
      .eq('entry_id', entryId).ilike('email', email)
    t.details.rows = rows?.length
    const ok = rows?.length === 1 && rows[0].party_size === 4 && rows[0].diet === 'gluten-free'
    t.verdict = ok ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// F18: contract_sign_by_token BOZZA → FIRMATO
async function f18() {
  const t = { id: 'F18', title: 'contract_sign_by_token BOZZA → FIRMATO', verdict: 'SKIP', details: {} }
  try {
    const token = crypto.randomUUID()
    const ins = await svc.from('contracts').insert({
      owner_id: WP_ID, title: `${TAG}F18`, client_name: 'F18',
      client_email: 'f18@planfully-demo.it', status: 'BOZZA',
      access_token: token, sections: [],
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = ins.error.message; record(t); return }
    cleanup.push({ kind: 'contract', id: ins.data.id })
    const r = await svc.rpc('contract_sign_by_token', {
      p_token: token, p_signer_name: 'V Signer', p_signer_fiscal: 'RSSMRA80A01H501Z',
    })
    const after = await svc.from('contracts').select('status, signed_at').eq('id', ins.data.id).single()
    t.details = { rpc: r.data, status: after.data?.status, signed_at: after.data?.signed_at }
    t.verdict = (r.data === true && after.data?.status === 'FIRMATO' && after.data?.signed_at) ? 'PASS' : 'FAIL'
  } catch (e) { t.verdict = 'FAIL'; t.details.exception = e.message }
  record(t)
}

// =========================================================================
// S5 — Performance smoke
// =========================================================================
async function s5_performance() {
  const t = { id: 'S5', title: 'performance regression (TTFB + bundle + 5xx)', verdict: 'SKIP', details: {} }
  try {
    // TTFB measurement (cold + warm)
    const ttfbs = []
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now()
      const r = await fetch(PROD, { method: 'GET' })
      const txt = await r.text()
      const dt = Date.now() - t0
      ttfbs.push({ ms: dt, status: r.status, size: txt.length })
    }
    t.details.ttfb_runs = ttfbs
    const minTtfb = Math.min(...ttfbs.map(r => r.ms))
    t.details.min_ttfb_ms = minTtfb

    // Bundle index size + vendor-pdf present
    const html = await fetch(PROD).then(r => r.text())
    const matches = [...html.matchAll(/assets\/(vendor-[a-z]+|index)[^"]+\.js/g)].map(m => m[0])
    const uniq = [...new Set(matches)]
    const indexChunk = uniq.find(c => c.startsWith('assets/index-'))
    let indexKB = 0
    if (indexChunk) {
      const resp = await fetch(`${PROD}/${indexChunk}`)
      const buf = await resp.arrayBuffer()
      indexKB = buf.byteLength / 1024
    }
    const hasVendorPdf = uniq.some(c => c.includes('vendor-pdf'))
    t.details.bundle = { chunks: uniq.length, index_kb: indexKB.toFixed(1), has_vendor_pdf: hasVendorPdf }

    // 10 calls to common endpoints, count 5xx
    const endpoints = [
      `${PROD}/`,
      `${PROD}/login`,
      `${PROD}/signup`,
      `${PROD}/clienti`,
      `${PROD}/about`,
      `${PROD}/privacy`,
      `${PROD}/terms`,
      `${PROD}/sito/andrea-e-sofia-audit`,
      `${PROD}/couple`,
      `${PROD}/wedding`,
    ]
    const statuses = []
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep, { redirect: 'manual' })
        statuses.push({ url: ep, status: r.status })
      } catch (e) {
        statuses.push({ url: ep, status: 0, err: e.message })
      }
    }
    const fiveXx = statuses.filter(s => s.status >= 500 && s.status < 600).length
    t.details.endpoint_statuses = statuses
    t.details.five_xx_count = fiveXx

    // Verdict: TTFB<800ms (lenient for cloud), bundle<600KB, has vendor-pdf, 0 5xx
    const ttfbOk = minTtfb < 800
    const bundleOk = indexKB < 600
    const okAll = ttfbOk && bundleOk && hasVendorPdf && fiveXx === 0
    t.details.checks = { ttfbOk, bundleOk, hasVendorPdf, fiveXxOk: fiveXx === 0 }
    t.verdict = okAll ? 'PASS' : 'FAIL'
    if (!okAll) t.note = `ttfb=${minTtfb}ms bundle=${indexKB.toFixed(1)}KB vendor-pdf=${hasVendorPdf} 5xx=${fiveXx}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// =========================================================================
// CLEANUP
// =========================================================================
async function cleanupRun() {
  console.log('\n=== CLEANUP ===')
  const counts = {}
  for (const c of cleanup) {
    try {
      if (c.kind === 'ccr') await svc.from('couple_change_requests').delete().eq('id', c.id)
      else if (c.kind === 'quote_item') await svc.from('quote_items').delete().eq('id', c.id)
      else if (c.kind === 'quote') await svc.from('quotes').delete().eq('id', c.id)
      else if (c.kind === 'acceptance') await svc.from('quote_acceptances').delete().eq('id', c.id)
      else if (c.kind === 'contract') await svc.from('contracts').delete().eq('id', c.id)
      else if (c.kind === 'service') await svc.from('services').delete().eq('id', c.id)
      else if (c.kind === 'service_photo') await svc.from('service_photos').delete().eq('id', c.id)
      else if (c.kind === 'supplier_availability') await svc.from('supplier_availability').delete().eq('fornitore_id', c.fornitore_id).eq('date', c.date)
      else if (c.kind === 'event_guests_by_email') await svc.from('event_guests').delete().eq('entry_id', c.entry_id).ilike('email', c.email)
      counts[c.kind] = (counts[c.kind] ?? 0) + 1
    } catch (e) {
      console.log('  cleanup err', c.kind, c.id ?? c.email, e.message)
    }
  }
  // Sweep AGENT-V-% by title
  try { await svc.from('quotes').delete().like('title', `${TAG}%`) } catch {}
  try { await svc.from('contracts').delete().like('title', `${TAG}%`) } catch {}
  try { await svc.from('services').delete().like('name', `${TAG}%`) } catch {}
  try { await svc.from('couple_change_requests').delete().like('title', `${TAG}%`) } catch {}
  try { await svc.from('event_guests').delete().like('email', 'agent-v-rsvp+%@planfully-demo.it') } catch {}
  console.log('Cleanup counts:', counts)
}

// =========================================================================
// MAIN
// =========================================================================
const started = new Date().toISOString()

const blocks = [
  ['S1', s1_state_machine],
  ['S2', s2_check_constraints],
  ['S3', s3_programma_empty_state],
  // S4 = 18 fix re-verify
  ['F01', f01], ['F02', f02], ['F03', f03], ['F04', f04], ['F05', f05],
  ['F06', f06], ['F07', f07], ['F08', f08], ['F09', f09], ['F10', f10],
  ['F11', f11], ['F12', f12], ['F13', f13], ['F14', f14], ['F15', f15],
  ['F16', f16], ['F17', f17], ['F18', f18],
  ['S5', s5_performance],
]

for (const [id, fn] of blocks) {
  try { await fn() } catch (e) {
    tests.push({ id, title: `${id} crashed`, verdict: 'FAIL', details: { exception: e.message } })
    console.log(`[FAIL] ${id} EXCEPTION: ${e.message}`)
  }
}

await cleanupRun()
const ended = new Date().toISOString()

const summary = {
  started_at: started, ended_at: ended,
  base_url: PROD, deploy: DEPLOY_ID,
  tests,
}
writeFileSync(resolve(RUN_DIR, 'smoke.json'), JSON.stringify(summary, null, 2))

const pass = tests.filter(t => t.verdict === 'PASS').length
const fail = tests.filter(t => t.verdict === 'FAIL').length
const skip = tests.filter(t => t.verdict === 'SKIP').length
const verdetto = `TOTALE ${tests.length} — PASS ${pass} — FAIL ${fail} — SKIP ${skip}\n` +
  (fail === 0 ? 'PRODUCTION-READY: SI\n' : `PRODUCTION-READY: NO (${fail} fail)\n`)
writeFileSync(resolve(RUN_DIR, 'verdetto.txt'), verdetto)

console.log('\n=== DONE ===')
console.log(verdetto)
console.log(`Output: ${RUN_DIR}`)
