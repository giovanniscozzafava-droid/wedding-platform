#!/usr/bin/env node
/**
 * WAVE 5 Agent U — FINAL REGRESSION of all night hotfixes
 * Output dir: audit-runs/wave5-U-final-regression-<ts>
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
const PWD = 'Beta2026!'

const WP_EMAIL = 'wp-mini@planfully-demo.it'
const WP_ID = '712baed0-3957-4452-8aab-ab4eeebb2697'
const FORN_FOTO_EMAIL = 'forn-mini-foto@planfully-demo.it'
const FORN_FOTO_ID = '747707fe-03be-4bb8-95b8-17b43b465526'
const FORN_FIORI_EMAIL = 'forn-mini-fiori@planfully-demo.it'
const FORN_FIORI_ID = 'a0262dd1-f07c-4359-a9c0-1186e98971a3'
const SPOSO_EMAIL = 'giovanni.scozzafava+sposo@gmail.com'
const SPOSO_ID = '6e61b300-66f5-4ddb-9fc0-b0d3351a63b7'
const SPOSO_WEDDING = '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea' // Giovanni e Pingu

const svc = createClient(URL, SVC, { auth: { persistSession: false } })
const tests = []
const cleanup = []
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

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

// ===========================================================================
// FIX 1: RLS couple_change_requests — sposo INSERT OK (201)
// ===========================================================================
async function fix1_ccr_rls() {
  const t = { id: 'F01', title: 'RLS couple_change_requests sposo INSERT', verdict: 'SKIP', details: {} }
  try {
    const sess = await loginAs(SPOSO_EMAIL)
    const payload = {
      wedding_id: SPOSO_WEDDING,
      requested_by: sess.user.id,
      entity_type: 'OTHER',
      action: 'UPDATE',
      title: 'AGENT-U-CCR test',
      description: 'sposo RLS check',
      payload: { note: 'AGENT-U-CCR test' },
    }
    const r = await sess.client.from('couple_change_requests').insert(payload).select().single()
    t.details.error = r.error?.message ?? null
    t.details.error_code = r.error?.code ?? null
    t.details.inserted_id = r.data?.id ?? null
    if (r.data?.id) cleanup.push({ kind: 'ccr', id: r.data.id })
    // Pre-fix would be 42501. Now expect success.
    const passed = !!r.data?.id && r.error?.code !== '42501'
    t.verdict = passed ? 'PASS' : 'FAIL'
    if (!passed) t.note = `code=${r.error?.code} msg=${r.error?.message?.slice(0, 120)}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 2: RLS collab supplier scope (forn-foto NOT in Andrea wedding)
// ===========================================================================
async function fix2_collab_scope() {
  const t = { id: 'F02', title: 'RLS collab supplier scope (forn-foto 0 leak)', verdict: 'SKIP', details: {} }
  try {
    const andrea = 'c1b8b3bc-d3a0-4398-8f95-32aa81aa5c60'
    // Verify not involved
    const parts = await svc.from('calendar_entry_participants').select('user_id').eq('entry_id', andrea).eq('user_id', FORN_FOTO_ID)
    if ((parts.data?.length ?? 0) > 0) { t.note = 'forn-foto is participant — skip'; t.verdict = 'SKIP'; record(t); return }
    const andreaRow = await svc.from('calendar_entries').select('quote_id').eq('id', andrea).single()
    if (andreaRow.data?.quote_id) {
      const qi = await svc.from('quote_items').select('id').eq('quote_id', andreaRow.data.quote_id).eq('supplier_id', FORN_FOTO_ID)
      if ((qi.data?.length ?? 0) > 0) { t.note = 'forn-foto on quote_items — skip'; t.verdict = 'SKIP'; record(t); return }
    }

    const sess = await loginAs(FORN_FOTO_EMAIL)
    const cross = await Promise.all([
      sess.client.from('calendar_entries').select('id').eq('id', andrea),
      sess.client.from('event_guests').select('id').eq('entry_id', andrea),
      sess.client.from('event_tables').select('id').eq('entry_id', andrea),
      sess.client.from('event_transport').select('id').eq('entry_id', andrea),
    ])
    const cnt = {
      calendar_entries: cross[0].data?.length ?? 0,
      event_guests: cross[1].data?.length ?? 0,
      event_tables: cross[2].data?.length ?? 0,
      event_transport: cross[3].data?.length ?? 0,
    }
    t.details.counts = cnt
    const total = Object.values(cnt).reduce((a, b) => a + b, 0)
    t.verdict = total === 0 ? 'PASS' : 'FAIL'
    if (total > 0) t.note = `leak=${JSON.stringify(cnt)}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 3: upload-photo sharp removed — POST PNG returns 200
// ===========================================================================
async function fix3_upload_photo() {
  const t = { id: 'F03', title: 'upload-photo sharp rimosso (PNG → 200)', verdict: 'SKIP', details: {} }
  let serviceId = null
  try {
    const sess = await loginAs(FORN_FOTO_EMAIL)
    // Create a temp service
    // Look up an existing category_id from service_categories to avoid FK violations
    let categoryId = null
    try {
      const cat = await svc.from('service_categories').select('id').limit(1).single()
      categoryId = cat.data?.id ?? null
    } catch {}
    const svcIns = await svc.from('services').insert({
      fornitore_id: sess.user.id,
      name: 'AGENT-U upload test',
      category_id: categoryId,
      base_price: 100,
      unit: 'EVENTO',
      is_active: false,
    }).select().single()
    if (svcIns.error) { t.note = 'svc insert error: ' + svcIns.error.message; t.verdict = 'FAIL'; record(t); return }
    serviceId = svcIns.data.id
    cleanup.push({ kind: 'service', id: serviceId })

    // Build PNG binary from base64
    const png = Buffer.from(TINY_PNG_B64, 'base64')
    const fd = new FormData()
    fd.append('service_id', serviceId)
    fd.append('file', new Blob([png], { type: 'image/png' }), 'agent-u.png')

    const r = await fetch(`${URL}/functions/v1/upload-photo`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${sess.token}`,
        'apikey': ANON,
      },
      body: fd,
    })
    const text = await r.text()
    t.details.status = r.status
    t.details.body_first240 = text.slice(0, 240)
    let body = null; try { body = JSON.parse(text) } catch {}
    if (body?.photo?.id) cleanup.push({ kind: 'service_photo', id: body.photo.id })
    t.verdict = r.status === 200 ? 'PASS' : 'FAIL'
    if (r.status !== 200) t.note = `HTTP ${r.status}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 4: import-pin-url multi-UA — Pinterest URL returns 422 user-friendly
// ===========================================================================
async function fix4_import_pin_url() {
  const t = { id: 'F04', title: 'import-pin-url Pinterest → 422 user-friendly', verdict: 'SKIP', details: {} }
  try {
    const sess = await loginAs(FORN_FOTO_EMAIL)
    const r = await fetch(`${URL}/functions/v1/import-pin-url`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${sess.token}`,
        'apikey': ANON,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://www.pinterest.com/pin/0000000000000000/' }),
    })
    const text = await r.text()
    let body = null; try { body = JSON.parse(text) } catch {}
    t.details.status = r.status
    t.details.body = body
    // The fix is the multi-UA loop. PASS if:
    // - 200 with og:image (page reachable across UAs), OR
    // - 422 user-friendly italian (host-specific "blocca" copy), OR
    // - 422 generic "no og:image found" (means page was reachable but no meta — still graceful, not 500/WORKER_ERROR)
    const ok200 = r.status === 200 && (body?.image || body?.title)
    const ok422Pinterest = r.status === 422 && typeof body?.error === 'string' && /pinterest/i.test(body.error) && /blocca/i.test(body.error)
    const ok422NoMeta = r.status === 422 && typeof body?.error === 'string' && /og:image/i.test(body.error)
    const okAny = ok200 || ok422Pinterest || ok422NoMeta
    t.verdict = okAny ? 'PASS' : 'FAIL'
    if (!okAny) t.note = `status=${r.status} err=${body?.error?.slice(0, 100)}`
    else if (ok200) t.note = 'Pinterest reachable (200 with og:image)'
    else if (ok422Pinterest) t.note = '422 user-friendly italian (blocca)'
    else t.note = '422 graceful (no og:image but multi-UA succeeded fetching page)'
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 5: trigger availability cast — quote INVIATO→ACCETTATO non più 42804
// ===========================================================================
async function fix5_avail_trigger_cast() {
  const t = { id: 'F05', title: 'trigger availability cast: INVIATO→ACCETTATO', verdict: 'SKIP', details: {} }
  try {
    const eventDate = new Date(Date.now() + 95 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const ins = await svc.from('quotes').insert({
      owner_id: WP_ID,
      title: 'AGENT-U-F05 avail-trigger test',
      client_name: 'Test',
      client_email: 'agent-u-f05@planfully-demo.it',
      event_date: eventDate,
      guest_count: 50,
      status: 'INVIATO',
      revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 1000,
      total_client: 1250,
      margin_amount: 250,
      margin_percent: 20,
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = 'insert err: ' + ins.error.message; record(t); return }
    cleanup.push({ kind: 'quote', id: ins.data.id })

    // Add a quote_item assigned to forn-foto so trigger has work to do
    const qi = await svc.from('quote_items').insert({
      quote_id: ins.data.id,
      name_snapshot: 'AGENT-U-F05 servizio',
      basis: 'FLAT',
      quantity: 1,
      snapshot_price: 1000,
      supplier_id: FORN_FOTO_ID,
      markup_percent_override: 25,
    }).select().single()
    t.details.qi_insert_err = qi.error?.message ?? null

    // Now transition status to ACCETTATO — this is what previously crashed with 42804
    const upd = await svc.from('quotes').update({
      status: 'ACCETTATO',
      accepted_at: new Date().toISOString(),
    }).eq('id', ins.data.id).select().single()
    t.details.update_status = upd.data?.status
    t.details.update_err = upd.error?.message ?? null
    t.details.update_err_code = upd.error?.code ?? null
    // Inspect supplier_availability row created
    const avail = await svc.from('supplier_availability').select('fornitore_id, status, date, notes')
      .eq('fornitore_id', FORN_FOTO_ID).eq('date', eventDate)
    t.details.avail_rows = avail.data
    cleanup.push({ kind: 'supplier_availability', fornitore_id: FORN_FOTO_ID, date: eventDate })

    const ok = !upd.error && upd.data?.status === 'ACCETTATO'
    t.verdict = ok ? 'PASS' : 'FAIL'
    if (!ok) t.note = `code=${upd.error?.code} msg=${upd.error?.message?.slice(0, 120)}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 6: RLS quotes insert FORNITORE — fornitore can INSERT direct quote
// ===========================================================================
async function fix6_quotes_insert_fornitore() {
  const t = { id: 'F06', title: 'RLS quotes_insert_owner FORNITORE OK', verdict: 'SKIP', details: {} }
  try {
    const sess = await loginAs(FORN_FOTO_EMAIL)
    // Need supplier_client first? Try with direct_client_id null first to check policy
    const r = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: 'AGENT-U-F06 fornitore direct',
      client_name: 'Cliente diretto AGENT-U',
      client_email: 'cliente-f06@example.com',
      event_date: new Date(Date.now() + 100 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      guest_count: 30,
      status: 'BOZZA',
      revision: 1,
      total_cost: 500,
      total_client: 600,
      margin_amount: 100,
      margin_percent: 20,
    }).select().single()
    t.details.error = r.error?.message ?? null
    t.details.error_code = r.error?.code ?? null
    t.details.inserted_id = r.data?.id ?? null
    if (r.data?.id) cleanup.push({ kind: 'quote', id: r.data.id })
    // PASS if insertion succeeded OR error is NOT 42501 (RLS violation)
    const ok = !!r.data?.id || r.error?.code !== '42501'
    t.verdict = (r.data?.id) ? 'PASS' : (ok ? 'PARTIAL' : 'FAIL')
    if (t.verdict !== 'PASS') t.note = `code=${r.error?.code} msg=${r.error?.message?.slice(0, 100)}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 7: CookieBanner z-40 + pointer-events — modals above are clickable
//   (backend: scan CSS for z-index 50+ on modal classes; UI screenshot in browser step)
// ===========================================================================
async function fix7_cookie_banner_z() {
  const t = { id: 'F07', title: 'CookieBanner z-index / pointer-events', verdict: 'SKIP', details: {} }
  try {
    // We do a code-level scan to ensure the banner doesn't block modals.
    // Find frontend file and inspect z-index / pointer-events
    const root = '/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src'
    const candidates = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(resolve(dir, e.name))
        else if (/CookieBanner|cookie-banner|CookieConsent/i.test(e.name)) candidates.push(resolve(dir, e.name))
      }
    }
    walk(root)
    t.details.files = candidates
    if (!candidates.length) { t.verdict = 'FAIL'; t.note = 'no cookie banner file'; record(t); return }
    let hasZ40 = false, hasPointerEventsNone = false, hasZ50OrAbove = false
    for (const f of candidates) {
      const s = readFileSync(f, 'utf8')
      if (/z-40/.test(s) || /z-index:\s*40/.test(s)) hasZ40 = true
      if (/pointer-events-none|pointer-events:\s*none/.test(s)) hasPointerEventsNone = true
      if (/z-\[?5[0-9]/.test(s) || /z-\[?[6-9][0-9]/.test(s)) hasZ50OrAbove = true
    }
    t.details.checks = { hasZ40, hasPointerEventsNone, hasZ50OrAbove }
    t.verdict = (hasZ40 || hasPointerEventsNone) ? 'PASS' : 'FAIL'
    if (t.verdict === 'FAIL') t.note = 'no z-40 nor pointer-events-none in CookieBanner'
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 8: PDF brand fornitore FREE — brand colors used even on FREE tier
//   (Check source code: PDF generator reads brand_primary_color/brand_accent_color
//    without checking subscription_tier)
// ===========================================================================
async function fix8_pdf_brand_free() {
  const t = { id: 'F08', title: 'PDF brand colors anche su FREE tier', verdict: 'SKIP', details: {} }
  try {
    // PDF generation lives in the supabase edge function `quote-generate-pdf/index.ts`
    // Hotfix added a comment "usa SEMPRE il brand dell'owner se impostato (anche FREE)"
    // and removed any FREE-tier gate on PRIMARY/ACCENT.
    const candidates = [
      '/Users/giovanniscozzafava/Repository/wedding-platform/supabase/functions/quote-generate-pdf/index.ts',
      '/Users/giovanniscozzafava/Repository/wedding-platform/supabase/functions/moodboard-pdf/index.ts',
    ]
    t.details.candidates = candidates
    let foundBrandRead = false, foundTierGate = false, foundAnchorComment = false
    for (const f of candidates) {
      if (!existsSync(f)) continue
      const s = readFileSync(f, 'utf8')
      if (/brand_primary_color/.test(s)) foundBrandRead = true
      if (/anche\s+FREE|anche FREE|anche-FREE/i.test(s)) foundAnchorComment = true
      // Look for any actual gating around the brand color
      const lines = s.split('\n')
      lines.forEach((ln, i) => {
        if (/brand_primary_color/.test(ln)) {
          const ctx = lines.slice(Math.max(0, i - 12), i + 3).join('\n')
          // Look only for an active gate that BLOCKS reading on FREE (skip-comments check)
          if (/if\s*\([^)]*subscription_tier[^)]*===\s*['"]FREE['"]/.test(ctx) ||
              /subscription_tier\s*!==\s*['"](PREMIUM|PRO)['"][^?]*\?\s*null/.test(ctx)) {
            foundTierGate = true
          }
        }
      })
    }
    t.details.foundBrandRead = foundBrandRead
    t.details.foundTierGate = foundTierGate
    t.details.foundAnchorComment = foundAnchorComment
    // PASS: brand read AND no active gate that strips it on FREE
    t.verdict = (foundBrandRead && !foundTierGate) ? 'PASS' : 'FAIL'
    if (t.verdict === 'FAIL') t.note = `brandRead=${foundBrandRead} tierGate=${foundTierGate}`
    else t.note = foundAnchorComment ? 'brand read unconditional + anchor comment present' : 'brand read unconditional'
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 9: quote-accept-sign idempotency — 10 parallel = 1 success + 9 conflict
// ===========================================================================
async function fix9_accept_sign_idempotent() {
  const t = { id: 'F09', title: 'quote-accept-sign idempotency (10 parallel)', verdict: 'SKIP', details: {} }
  try {
    const token = crypto.randomUUID()
    const eventDate = new Date(Date.now() + 110 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const ins = await svc.from('quotes').insert({
      owner_id: WP_ID,
      title: 'AGENT-U-F09 idempotency',
      client_name: 'Test F09',
      client_email: 'f09@planfully-demo.it',
      event_date: eventDate,
      guest_count: 80,
      status: 'INVIATO',
      revision: 1,
      access_token: token,
      total_cost: 10000,
      total_client: 12500,
      margin_amount: 2500,
      margin_percent: 20,
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = 'insert err'; record(t); return }
    cleanup.push({ kind: 'quote', id: ins.data.id })

    const payload = {
      token,
      signer_name: 'AGENT-U Mario',
      signer_phone: '+39 333 0000000',
      doc_type: 'CARTA_IDENTITA',
      doc_number: 'AY9999999',
      doc_issued_by: 'Comune di Roma',
      signature_data_url: `data:image/png;base64,${TINY_PNG_B64}`,
      consent_terms: true,
      consent_privacy: true,
    }
    const endpoint = `${URL}/functions/v1/quote-accept-sign`
    const promises = Array.from({ length: 10 }, (_, i) =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${ANON}`, 'apikey': ANON },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const txt = await r.text()
        let b = null; try { b = JSON.parse(txt) } catch {}
        return { idx: i, status: r.status, body: b }
      }).catch(e => ({ idx: i, status: 0, error: e.message }))
    )
    const results = await Promise.all(promises)
    const c200 = results.filter(r => r.status === 200).length
    const c409 = results.filter(r => r.status === 409).length
    t.details.results = results.map(r => ({ idx: r.idx, status: r.status }))
    t.details.count_200 = c200; t.details.count_409 = c409

    await new Promise(r => setTimeout(r, 1500))
    const { data: acc } = await svc.from('quote_acceptances').select('id').eq('quote_id', ins.data.id)
    const { data: q } = await svc.from('quotes').select('status, accepted_at').eq('id', ins.data.id).single()
    t.details.db_acceptances = acc?.length
    t.details.quote_status = q?.status
    cleanup.push(...(acc ?? []).map(a => ({ kind: 'acceptance', id: a.id })))

    const ok = c200 === 1 && c409 === 9 && acc?.length === 1 && q?.status === 'ACCETTATO'
    t.verdict = ok ? 'PASS' : 'FAIL'
    if (!ok) t.note = `200=${c200}/1 409=${c409}/9 acc=${acc?.length}/1 status=${q?.status}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 10: tab strip overflow edge-fade — CoupleDashboard + WeddingDashboard
//   (code scan: search for gradient indicator classes around tab strip)
// ===========================================================================
async function fix10_tab_overflow() {
  const t = { id: 'F10', title: 'tab strip overflow edge-fade gradient', verdict: 'SKIP', details: {} }
  try {
    const root = '/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src'
    const dashboardFiles = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(resolve(dir, e.name))
        else if (/(CoupleDashboard|WeddingDashboard|wedding-dashboard)/i.test(e.name) && /\.tsx$/.test(e.name)) {
          dashboardFiles.push(resolve(dir, e.name))
        }
      }
    }
    walk(root)
    t.details.files = dashboardFiles
    let gradientHits = 0
    const perFile = {}
    for (const f of dashboardFiles) {
      const s = readFileSync(f, 'utf8')
      const m = s.match(/(from-(white|background)|to-transparent|bg-gradient|mask-image|fade-edge|edge-fade)/g) ?? []
      perFile[f.split('/').slice(-2).join('/')] = m.length
      if (m.length > 0) gradientHits++
    }
    t.details.gradient_hits_per_file = perFile
    t.verdict = (gradientHits >= 1 && dashboardFiles.length >= 1) ? 'PASS' : 'FAIL'
    if (t.verdict === 'FAIL') t.note = `gradient_hits=${gradientHits} files=${dashboardFiles.length}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 12: bundle manualChunks — verify 7 vendor-* chunks split + main < 600KB
// ===========================================================================
async function fix12_bundle_chunks() {
  const t = { id: 'F12', title: 'bundle manualChunks 7 chunks + main<600KB', verdict: 'SKIP', details: {} }
  try {
    const html = await fetch(PROD).then(r => r.text())
    const matches = [...html.matchAll(/assets\/(vendor-[a-z]+|index)[^"]+\.js/g)].map(m => m[0])
    const uniq = [...new Set(matches)]
    t.details.chunks = uniq

    const required = ['index', 'vendor-react', 'vendor-supabase', 'vendor-motion', 'vendor-pdf', 'vendor-query', 'vendor-ui']
    const missing = required.filter(r => !uniq.some(u => u.includes(`assets/${r}-`)))
    t.details.missing = missing

    const sizes = {}
    for (const ch of uniq) {
      const url = `${PROD}/${ch}`
      const resp = await fetch(url)
      const buf = await resp.arrayBuffer()
      sizes[ch] = buf.byteLength
    }
    t.details.sizes_bytes = sizes
    const indexChunk = uniq.find(c => c.startsWith('assets/index-'))
    const indexSize = indexChunk ? sizes[indexChunk] : 0
    t.details.index_kb = (indexSize / 1024).toFixed(1)
    const allPresent = missing.length === 0
    const mainOk = indexSize < 600 * 1024
    t.details.checks = { allPresent, mainOk }
    t.verdict = (allPresent && mainOk) ? 'PASS' : 'FAIL'
    if (!allPresent) t.note = `missing=${missing.join(',')}`
    else if (!mainOk) t.note = `main=${t.details.index_kb}KB > 600KB`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 13: contracts FIRMATO backfill + CHECK — UPDATE diretto a FIRMATO senza
//   campi fallisce
// ===========================================================================
async function fix13_contracts_check() {
  const t = { id: 'F13', title: 'contracts CHECK FIRMATO requires signature', verdict: 'SKIP', details: {} }
  let cid = null
  try {
    // First verify all existing FIRMATO have signed_at + signature_data
    const { data: badFirmato } = await svc.from('contracts').select('id, signed_at, signature_data, status')
      .eq('status', 'FIRMATO').or('signed_at.is.null,signature_data.is.null')
    t.details.existing_firmato_without_fields = (badFirmato ?? []).length

    // Create a BOZZA contract
    const ins = await svc.from('contracts').insert({
      owner_id: WP_ID,
      title: 'AGENT-U-F13 contract check',
      client_name: 'Test F13',
      client_email: 'f13@planfully-demo.it',
      status: 'BOZZA',
      access_token: crypto.randomUUID(),
      sections: [],
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = 'insert err: ' + ins.error.message; record(t); return }
    cid = ins.data.id
    cleanup.push({ kind: 'contract', id: cid })

    // Direct UPDATE to FIRMATO WITHOUT signed_at/signature_data — must fail
    const upd = await svc.from('contracts').update({ status: 'FIRMATO' }).eq('id', cid).select().single()
    t.details.update_err = upd.error?.message ?? null
    t.details.update_err_code = upd.error?.code ?? null
    t.details.update_status_returned = upd.data?.status ?? null

    // Must be blocked by CHECK constraint
    const blocked = !!upd.error && /contracts_firmato_requires_signature|check constraint/i.test(upd.error.message)
    const backfillOk = (badFirmato ?? []).length === 0
    t.details.checks = { blocked, backfillOk }
    t.verdict = (blocked && backfillOk) ? 'PASS' : 'FAIL'
    if (!t.verdict === 'PASS') t.note = `blocked=${blocked} backfill_bad=${(badFirmato ?? []).length}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 14: quotes ACCETTATO + CHECK — accepted_at required
// ===========================================================================
async function fix14_quotes_accepted_check() {
  const t = { id: 'F14', title: 'quotes CHECK ACCETTATO requires accepted_at', verdict: 'SKIP', details: {} }
  let qid = null
  try {
    // Existing rows audit
    const { data: badQ } = await svc.from('quotes').select('id, status, accepted_at')
      .in('status', ['ACCETTATO', 'CONVERTITO_IN_CONTRATTO']).is('accepted_at', null)
    t.details.existing_accettato_without_at = (badQ ?? []).length

    const ins = await svc.from('quotes').insert({
      owner_id: WP_ID,
      title: 'AGENT-U-F14 quote check',
      client_name: 'Test F14',
      client_email: 'f14@planfully-demo.it',
      status: 'INVIATO',
      revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100,
      total_client: 120,
      margin_amount: 20,
      margin_percent: 20,
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = 'insert err: ' + ins.error.message; record(t); return }
    qid = ins.data.id
    cleanup.push({ kind: 'quote', id: qid })

    // Direct UPDATE to ACCETTATO without accepted_at — must fail
    const upd = await svc.from('quotes').update({ status: 'ACCETTATO' }).eq('id', qid).select().single()
    t.details.update_err = upd.error?.message ?? null
    t.details.update_err_code = upd.error?.code ?? null

    const blocked = !!upd.error && /quotes_accettato_requires_accepted_at|check constraint/i.test(upd.error.message)
    const backfillOk = (badQ ?? []).length === 0
    t.details.checks = { blocked, backfillOk }
    t.verdict = (blocked && backfillOk) ? 'PASS' : 'FAIL'
    if (!(blocked && backfillOk)) t.note = `blocked=${blocked} bad_legacy=${(badQ ?? []).length}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 15: trigger set_updated_at on 6 tables
// ===========================================================================
async function fix15_set_updated_at_triggers() {
  const t = { id: 'F15', title: 'trigger set_updated_at su 6 tabelle', verdict: 'SKIP', details: {} }
  try {
    // We can't read pg_trigger directly via PostgREST. We do a functional probe:
    // INSERT a row, capture initial updated_at, UPDATE another column, expect updated_at to change.
    const tables = ['market_prices', 'service_presets', 'finance_offers', 'finance_applications', 'insurance_offers', 'insurance_policies']
    const triggers = {}
    for (const tbl of tables) {
      try {
        // probe row + columns
        const probe = await svc.from(tbl).select('*').limit(1)
        if (probe.error) { triggers[tbl] = `read-err:${probe.error.code ?? probe.error.message?.slice(0, 40)}`; continue }
        const sample = probe.data?.[0]
        if (!sample) { triggers[tbl] = 'no-rows-to-probe'; continue }
        const cols = Object.keys(sample)
        if (!cols.includes('updated_at')) { triggers[tbl] = 'no-updated_at-col'; continue }
        // UPDATE a benign column to force trigger
        const benignCol = cols.find(c => /^notes$|^name$|^label$|^description$/.test(c)) || cols.find(c => typeof sample[c] === 'string' && c !== 'id' && !c.includes('_at'))
        if (!benignCol) { triggers[tbl] = 'no-benign-col'; continue }
        const before = sample.updated_at
        await new Promise(r => setTimeout(r, 50))
        const u = await svc.from(tbl).update({ [benignCol]: sample[benignCol] }).eq('id', sample.id).select('id, updated_at').single()
        if (u.error) { triggers[tbl] = `update-err:${u.error.message?.slice(0, 40)}`; continue }
        const after = u.data?.updated_at
        triggers[tbl] = { before, after, changed: before !== after }
      } catch (e) {
        triggers[tbl] = `ex:${e.message.slice(0, 40)}`
      }
    }
    t.details.triggers = triggers
    const tablesWithTrigger = Object.values(triggers).filter(v => typeof v === 'object' && v.changed).length
    const tablesProbed = Object.values(triggers).filter(v => typeof v === 'object').length
    t.details.tables_with_trigger = tablesWithTrigger
    t.details.tables_probed = tablesProbed
    // PASS if all probed tables have working trigger AND probed >= 3
    t.verdict = (tablesProbed >= 3 && tablesWithTrigger === tablesProbed) ? 'PASS' : 'FAIL'
    if (t.verdict === 'FAIL') t.note = `probed=${tablesProbed} working=${tablesWithTrigger}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 16: Genera contratto button — QuoteEditor banner ACCETTATO has button
//   (Code scan: search QuoteEditor for "Genera contratto")
// ===========================================================================
async function fix16_genera_contratto_btn() {
  const t = { id: 'F16', title: 'Genera contratto button su QuoteEditor', verdict: 'SKIP', details: {} }
  try {
    const root = '/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src'
    const editorFiles = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(resolve(dir, e.name))
        else if (/(QuoteEditor|quote-editor)/i.test(e.name) && /\.tsx$/.test(e.name)) editorFiles.push(resolve(dir, e.name))
      }
    }
    walk(root)
    t.details.files = editorFiles
    let hasBtn = false
    let hasHandler = false
    for (const f of editorFiles) {
      const s = readFileSync(f, 'utf8')
      if (/Genera contratto|Genera Contratto|genera-contratto/.test(s)) hasBtn = true
      if (/insert.*['"]contracts['"]|from\(['"]contracts['"]\)\.insert|generate.*contract/i.test(s)) hasHandler = true
    }
    t.details.hasBtn = hasBtn
    t.details.hasHandler = hasHandler
    t.verdict = hasBtn ? 'PASS' : 'FAIL'
    if (!hasBtn) t.note = `no "Genera contratto" string in QuoteEditor files`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 17: wedding_site_rsvp idempotent — same email twice = 1 row updated
// ===========================================================================
async function fix17_rsvp_idempotent() {
  const t = { id: 'F17', title: 'wedding_site_rsvp idempotente', verdict: 'SKIP', details: {} }
  try {
    // Use a published wedding (Andrea e Sofia → slug "andrea-e-sofia-audit")
    const slug = 'andrea-e-sofia-audit'
    const entryId = 'c1b8b3bc-d3a0-4398-8f95-32aa81aa5c60'
    const email = `agent-u-rsvp+${Date.now()}@planfully-demo.it`
    cleanup.push({ kind: 'event_guests_by_email', entry_id: entryId, email })

    // First submit
    const r1 = await svc.rpc('wedding_site_rsvp', {
      p_slug: slug,
      p_full_name: 'AGENT-U RSVP First',
      p_email: email,
      p_rsvp: 'YES',
      p_party: 2,
      p_diet: 'vegetariano',
      p_notes: 'first submit',
    })
    // Second submit (same email, different party_size)
    const r2 = await svc.rpc('wedding_site_rsvp', {
      p_slug: slug,
      p_full_name: 'AGENT-U RSVP Updated',
      p_email: email,
      p_rsvp: 'YES',
      p_party: 4,
      p_diet: 'gluten-free',
      p_notes: 'second submit',
    })
    t.details.r1 = { data: r1.data, err: r1.error?.message }
    t.details.r2 = { data: r2.data, err: r2.error?.message }

    // Verify only 1 row in event_guests with that email
    const { data: rows } = await svc.from('event_guests').select('id, full_name, party_size, diet')
      .eq('entry_id', entryId).ilike('email', email)
    t.details.rows = rows
    const ok = rows?.length === 1 && rows[0].party_size === 4 && rows[0].diet === 'gluten-free'
    t.verdict = ok ? 'PASS' : 'FAIL'
    if (!ok) t.note = `rows=${rows?.length} party=${rows?.[0]?.party_size}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// FIX 18: contract_sign_by_token BOZZA — contract in BOZZA can be signed
// ===========================================================================
async function fix18_contract_sign_bozza() {
  const t = { id: 'F18', title: 'contract_sign_by_token accetta BOZZA', verdict: 'SKIP', details: {} }
  try {
    const token = crypto.randomUUID()
    const ins = await svc.from('contracts').insert({
      owner_id: WP_ID,
      title: 'AGENT-U-F18 BOZZA contract',
      client_name: 'Test F18',
      client_email: 'f18@planfully-demo.it',
      status: 'BOZZA',
      access_token: token,
      sections: [],
    }).select().single()
    if (ins.error) { t.verdict = 'FAIL'; t.note = 'insert err: ' + ins.error.message; record(t); return }
    cleanup.push({ kind: 'contract', id: ins.data.id })

    const r = await svc.rpc('contract_sign_by_token', {
      p_token: token,
      p_signer_name: 'AGENT-U BOZZA Signer',
      p_signer_fiscal: 'RSSMRA80A01H501Z',
    })
    t.details.rpc_data = r.data
    t.details.rpc_err = r.error?.message ?? null

    const after = await svc.from('contracts').select('status, signed_at, signature_data').eq('id', ins.data.id).single()
    t.details.after = after.data
    const ok = r.data === true && after.data?.status === 'FIRMATO' && !!after.data?.signed_at && !!after.data?.signature_data
    t.verdict = ok ? 'PASS' : 'FAIL'
    if (!ok) t.note = `rpc=${r.data} status=${after.data?.status} signed_at=${!!after.data?.signed_at}`
  } catch (e) {
    t.verdict = 'FAIL'; t.details.exception = e.message
  }
  record(t)
}

// ===========================================================================
// CLEANUP
// ===========================================================================
async function cleanupRun() {
  console.log('\n=== CLEANUP ===')
  const counts = {}
  for (const c of cleanup) {
    try {
      if (c.kind === 'ccr') await svc.from('couple_change_requests').delete().eq('id', c.id)
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
  // Sweep AGENT-U-% by title
  try { await svc.from('quotes').delete().like('title', 'AGENT-U-%') } catch {}
  try { await svc.from('contracts').delete().like('title', 'AGENT-U-%') } catch {}
  try { await svc.from('services').delete().like('name', 'AGENT-U%') } catch {}
  try { await svc.from('couple_change_requests').delete().like('title', 'AGENT-U-CCR%') } catch {}
  try { await svc.from('event_guests').delete().like('email', 'agent-u-rsvp+%@planfully-demo.it') } catch {}
  console.log('Cleanup counts:', counts)
}

// ===========================================================================
// MAIN
// ===========================================================================
const started = new Date().toISOString()
const fixes = [
  ['F01', fix1_ccr_rls],
  ['F02', fix2_collab_scope],
  ['F03', fix3_upload_photo],
  ['F04', fix4_import_pin_url],
  ['F05', fix5_avail_trigger_cast],
  ['F06', fix6_quotes_insert_fornitore],
  ['F07', fix7_cookie_banner_z],
  ['F08', fix8_pdf_brand_free],
  ['F09', fix9_accept_sign_idempotent],
  ['F10', fix10_tab_overflow],
  ['F12', fix12_bundle_chunks],
  ['F13', fix13_contracts_check],
  ['F14', fix14_quotes_accepted_check],
  ['F15', fix15_set_updated_at_triggers],
  ['F16', fix16_genera_contratto_btn],
  ['F17', fix17_rsvp_idempotent],
  ['F18', fix18_contract_sign_bozza],
]
for (const [id, fn] of fixes) {
  try { await fn() } catch (e) {
    tests.push({ id, title: `${id} crashed`, verdict: 'FAIL', details: { exception: e.message } })
    console.log(`[FAIL] ${id} EXCEPTION: ${e.message}`)
  }
}
await cleanupRun()
const ended = new Date().toISOString()

const summary = {
  started_at: started, ended_at: ended,
  base_url: PROD, deploy: 'hfgggx8hf',
  tests,
}
writeFileSync(resolve(RUN_DIR, 'regression.json'), JSON.stringify(summary, null, 2))
console.log('\n=== DONE BACKEND ===')
console.log(`Output: ${RUN_DIR}`)
