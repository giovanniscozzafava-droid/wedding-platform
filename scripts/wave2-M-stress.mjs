#!/usr/bin/env node
/**
 * WAVE 2 - AGENT M - CONCURRENCY / STRESS / RACE CONDITIONS
 * Scenarios A..H
 * Output: audit-runs/wave2-M-stress-<ts>/
 *
 * Entity prefix: AGENT-M-
 * All entities created get cleaned up at the end.
 */
import { createClient } from '@supabase/supabase-js'
import { performance } from 'node:perf_hooks'
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUN_DIR = process.env.RUN_DIR
  || path.resolve(__dirname, `../audit-runs/wave2-M-stress-20260525-225911`)
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })

const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SUPA_SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const PWD = 'Beta2026!'
const WP_EMAIL = 'wp-mini@planfully-demo.it'
const FORN_EMAIL = 'forn-mini-foto@planfully-demo.it'
const PREFIX = 'AGENT-M-'

const admin = createClient(SUPA_URL, SUPA_SK, { auth: { persistSession: false } })

const stats = {}
const errorsFile = path.join(RUN_DIR, 'errors.jsonl')
const created = { quotes: [], quote_items: [], avails: [], ccrs: [], weddings: [] }

function pct(arr, p) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const i = Math.min(s.length - 1, Math.floor((p / 100) * s.length))
  return Math.round(s[i] * 100) / 100
}
function pushErr(scenario, err) {
  const e = {
    scenario,
    ts: Date.now(),
    msg: err?.message || String(err),
    code: err?.code,
    status: err?.status,
    details: err?.details,
    hint: err?.hint,
  }
  appendFileSync(errorsFile, JSON.stringify(e) + '\n')
}
function record(scenario, summary, latencies = [], extra = {}) {
  stats[scenario] = {
    ...summary,
    n: latencies.length,
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
    p99: pct(latencies, 99),
    max: latencies.length ? Math.round(Math.max(...latencies) * 100) / 100 : 0,
    ...extra,
  }
  console.log(`  [${scenario}] ${summary.verdict} — p99=${stats[scenario].p99}ms n=${stats[scenario].n}${extra.throughput ? ` rps=${extra.throughput}` : ''}`)
}

const scenarioMd = {}
function md(scenario, lines) {
  scenarioMd[scenario] = (scenarioMd[scenario] || []).concat(lines)
}

const BUGS = []
function bug(scenario, severity, msg, detail) {
  BUGS.push({ scenario, severity, msg, detail })
  console.log(`  BUG [${severity}] ${scenario}: ${msg}${detail ? ' — ' + String(detail).slice(0, 150) : ''}`)
}

// ============================================================
// Resolve required users + a test wedding owned by sposi
// ============================================================
async function bootstrap() {
  const { data: u } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const idx = {}
  for (const x of u.users) idx[x.email] = x.id
  if (!idx[WP_EMAIL]) throw new Error('WP_EMAIL non trovato')
  if (!idx[FORN_EMAIL]) throw new Error('FORN_EMAIL non trovato')

  // Wedding di prova del WP esistente (qualunque)
  const { data: weds } = await admin
    .from('calendar_entries')
    .select('id, owner_id, title, event_date')
    .eq('owner_id', idx[WP_EMAIL])
    .limit(5)
  const wedding = weds?.[0]
  if (!wedding) throw new Error('Nessun wedding del WP trovato')

  console.log('  Bootstrap OK', {
    wp: idx[WP_EMAIL].slice(0, 8),
    forn: idx[FORN_EMAIL].slice(0, 8),
    wedding: wedding.id.slice(0, 8),
  })
  return { wpId: idx[WP_EMAIL], fornId: idx[FORN_EMAIL], wedding }
}

// ============================================================
// SCENARIO A — Connection pool / RPC contention
// 50 parallel SELECT su quotes via N client diversi
// ============================================================
async function scenA() {
  console.log('\n--- SCENARIO A: Connection pool / RPC contention ---')
  const N = 50
  const clients = Array.from({ length: N }, () =>
    createClient(SUPA_URL, SUPA_SK, { auth: { persistSession: false } }),
  )
  const lat = []
  const errs = []
  const start = performance.now()
  const results = await Promise.allSettled(
    clients.map(async (c, i) => {
      const t0 = performance.now()
      const { error, data } = await c.from('quotes').select('id, status, total_client').limit(20)
      const dt = performance.now() - t0
      lat.push(dt)
      if (error) {
        errs.push({ i, msg: error.message, code: error.code, status: error.status })
        pushErr('A', error)
      }
      return { i, dt, rows: data?.length || 0 }
    }),
  )
  const tot = performance.now() - start
  const okCount = results.filter(r => r.status === 'fulfilled').length
  const errCount = errs.length
  const verdict = errCount > 0 ? 'FAIL' : okCount === N ? 'PASS' : 'PARTIAL'
  record('A', { verdict, ok: okCount, errors: errCount, total_ms: Math.round(tot) },
    lat, { throughput: Math.round((N / tot) * 1000) })
  md('A', [
    `## A. Connection pool / RPC contention`,
    `- **Verdict**: ${verdict}`,
    `- 50 client paralleli (service_role) SELECT quotes`,
    `- OK ${okCount}/${N}, errors ${errCount}, total ${Math.round(tot)}ms`,
    `- p50 ${pct(lat, 50)}ms · p95 ${pct(lat, 95)}ms · p99 ${pct(lat, 99)}ms`,
    `- throughput ${Math.round((N / tot) * 1000)} req/s`,
    errCount ? `- Sample error: ${errs[0].msg}` : '',
  ])
  if (errCount > 0) {
    bug('A', errCount > 10 ? 'HIGH' : 'MEDIUM', `Connection pool: ${errCount}/${N} richieste fallite`, errs[0]?.msg)
  } else if (pct(lat, 99) > 3000) {
    bug('A', 'MEDIUM', `Latenza p99 elevata sotto carico: ${pct(lat, 99)}ms`)
  }
}

// ============================================================
// SCENARIO B — Quote double-firm (idempotency)
// 5 POST paralleli a quote-accept-sign con stesso token
// ============================================================
async function scenB({ wpId }) {
  console.log('\n--- SCENARIO B: Quote double-firm idempotency ---')

  // Crea una quote BOZZA con access_token
  const access_token = crypto.randomUUID()
  const { data: q, error } = await admin.from('quotes').insert({
    owner_id: wpId,
    title: PREFIX + 'sign-race-' + Date.now(),
    client_name: PREFIX + 'cliente',
    client_email: 'agent-m@example.test',
    status: 'INVIATO',
    access_token,
    sent_at: new Date().toISOString(),
  }).select().single()

  if (error) {
    pushErr('B', error)
    record('B', { verdict: 'SKIP', reason: 'cannot create quote: ' + error.message }, [])
    md('B', [`## B. Quote double-firm`, `- **Verdict**: SKIP (cannot create quote: ${error.message})`])
    return
  }
  created.quotes.push(q.id)

  const url = `${SUPA_URL}/functions/v1/quote-accept-sign`
  // signature PNG minima: 1x1 transparent
  const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  const payload = {
    token: access_token,
    signer_name: PREFIX + 'Mario Rossi',
    signer_phone: '+39 333 1234567',
    doc_type: 'CARTA_IDENTITA',
    doc_number: 'AB1234567',
    doc_issued_by: 'Comune di Roma',
    signature_data_url: SIG,
    consent_terms: true,
    consent_privacy: true,
  }

  const N = 5
  const lat = []
  const start = performance.now()
  const results = await Promise.allSettled(
    Array.from({ length: N }, async (_, i) => {
      const t0 = performance.now()
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${SUPA_SK}`,
          apikey: SUPA_SK,
        },
        body: JSON.stringify(payload),
      })
      const txt = await r.text().catch(() => '')
      const dt = performance.now() - t0
      lat.push(dt)
      let parsed = null
      try { parsed = JSON.parse(txt) } catch {}
      return { i, status: r.status, body: parsed, txt: txt.slice(0, 200) }
    }),
  )
  const totMs = performance.now() - start

  const ok = []
  const reject = []
  for (const r of results) {
    if (r.status !== 'fulfilled') { reject.push(r.reason?.message || String(r.reason)); continue }
    if (r.value.status === 200) ok.push(r.value)
    else reject.push(`HTTP ${r.value.status}: ${r.value.txt}`)
  }

  // Verifica DB: numero di quote_acceptances per quote
  const { data: acc } = await admin
    .from('quote_acceptances')
    .select('id, signed_at, status')
    .eq('quote_id', q.id)
  const accCount = acc?.length || 0

  const { data: qNow } = await admin.from('quotes').select('status').eq('id', q.id).single()
  const finalStatus = qNow?.status

  // Idempotency check: idealmente al massimo 1 accettazione registrata
  const verdict = accCount <= 1
    ? (accCount === 1 ? 'PASS' : 'PARTIAL')
    : 'FAIL'

  record('B', {
    verdict,
    ok: ok.length,
    rejected: reject.length,
    acceptances_in_db: accCount,
    final_quote_status: finalStatus,
    total_ms: Math.round(totMs),
  }, lat)

  md('B', [
    `## B. Quote double-firm idempotency`,
    `- **Verdict**: ${verdict}`,
    `- 5 POST paralleli stesso token`,
    `- HTTP 200: ${ok.length}, errors: ${reject.length}`,
    `- quote_acceptances rows: ${accCount} (atteso <= 1)`,
    `- final quote status: ${finalStatus}`,
    `- p99: ${pct(lat, 99)}ms`,
    reject.length ? `- Sample reject: ${reject[0]}` : '',
  ])

  if (accCount > 1) {
    bug('B', 'CRITICAL', `Double-firm: ${accCount} quote_acceptances per stessa quote — idempotency broken`)
  } else if (ok.length > 1) {
    bug('B', 'HIGH', `${ok.length} chiamate HTTP 200 ma solo ${accCount} riga DB — fn restituisce success ma idempotent`)
  }
}

// ============================================================
// SCENARIO C — Supplier availability race
// 3 client paralleli che marcano stessa data BUSY
// ============================================================
async function scenC({ fornId }) {
  console.log('\n--- SCENARIO C: Supplier availability race ---')
  const targetDate = '2028-12-12'
  // pulizia preliminare
  await admin.from('supplier_availability').delete().eq('fornitore_id', fornId).eq('date', targetDate)

  const N = 5
  const clients = Array.from({ length: N }, () =>
    createClient(SUPA_URL, SUPA_SK, { auth: { persistSession: false } }),
  )
  const lat = []
  const results = await Promise.allSettled(
    clients.map(async (c, i) => {
      const t0 = performance.now()
      const r = await c.from('supplier_availability').upsert({
        fornitore_id: fornId,
        date: targetDate,
        status: 'BUSY',
        notes: PREFIX + 'race-' + i,
      }, { onConflict: 'fornitore_id,date' }).select()
      const dt = performance.now() - t0
      lat.push(dt)
      if (r.error) pushErr('C', r.error)
      return { i, error: r.error?.message, rows: r.data?.length || 0 }
    }),
  )

  const ok = results.filter(r => r.status === 'fulfilled' && !r.value.error).length
  const errs = results.filter(r => r.status !== 'fulfilled' || r.value.error)

  const { data: avRows } = await admin
    .from('supplier_availability')
    .select('id, status, notes, updated_at')
    .eq('fornitore_id', fornId)
    .eq('date', targetDate)
  const rowsCount = avRows?.length || 0
  created.avails.push({ fornitore_id: fornId, date: targetDate })

  const verdict = rowsCount === 1 && ok >= 1 ? 'PASS' : 'FAIL'
  record('C', {
    verdict,
    upsert_ok: ok,
    upsert_err: errs.length,
    rows_in_db: rowsCount,
    final_status: avRows?.[0]?.status,
  }, lat)

  md('C', [
    `## C. Supplier availability race`,
    `- **Verdict**: ${verdict}`,
    `- 5 upsert paralleli su (fornitore, ${targetDate})`,
    `- upsert OK ${ok}/5, errors ${errs.length}`,
    `- rows_in_db: ${rowsCount} (atteso 1, unique constraint)`,
    `- final status: ${avRows?.[0]?.status}`,
    `- p99 ${pct(lat, 99)}ms`,
  ])

  if (rowsCount !== 1) {
    bug('C', 'CRITICAL', `Race: ${rowsCount} righe per stesso (fornitore,date) — unique violato`)
  } else if (errs.length === N) {
    bug('C', 'HIGH', `Tutti upsert falliti, race non gestita`)
  }
}

// ============================================================
// SCENARIO D — 100 quote in 60s da stesso WP
// ============================================================
async function scenD({ wpId }) {
  console.log('\n--- SCENARIO D: Quote spam (100 in 60s) ---')
  const N = 100
  const lat = []
  const errs = []
  const ids = []
  const start = performance.now()

  // Crea in batch da 10 paralleli
  const BATCH = 10
  for (let b = 0; b < N / BATCH; b++) {
    const batch = await Promise.allSettled(
      Array.from({ length: BATCH }, async (_, k) => {
        const t0 = performance.now()
        const { data, error } = await admin.from('quotes').insert({
          owner_id: wpId,
          title: `${PREFIX}spam-${b * BATCH + k}-${Date.now()}`,
          client_name: 'spam',
          status: 'BOZZA',
        }).select('id').single()
        const dt = performance.now() - t0
        lat.push(dt)
        if (error) { errs.push(error.message); pushErr('D', error) }
        if (data?.id) { ids.push(data.id); created.quotes.push(data.id) }
        return { error: error?.message }
      }),
    )
    void batch
  }
  const totMs = performance.now() - start

  // Sanity: pesca campione e verifica colonne calcolate
  let badRows = 0
  if (ids.length) {
    const sample = ids.slice(0, 20)
    const { data: qs } = await admin
      .from('quotes')
      .select('id, total_cost, total_client, margin_amount, margin_percent')
      .in('id', sample)
    for (const q of qs ?? []) {
      if (q.total_cost == null || q.total_client == null || q.margin_amount == null || q.margin_percent == null) {
        badRows++
      }
    }
  }

  const okCount = ids.length
  const verdict = okCount === N && badRows === 0 ? 'PASS' : okCount >= N * 0.9 ? 'PARTIAL' : 'FAIL'
  record('D', {
    verdict,
    ok: okCount,
    errors: errs.length,
    bad_rows: badRows,
    total_ms: Math.round(totMs),
    inserted_within_60s: totMs < 60000,
  }, lat, { throughput: Math.round((N / totMs) * 1000) })

  md('D', [
    `## D. Quote spam (100 in 60s)`,
    `- **Verdict**: ${verdict}`,
    `- inseriti: ${okCount}/${N} in ${Math.round(totMs)}ms`,
    `- errors: ${errs.length}`,
    `- rows campione con valori calcolati NULL: ${badRows}`,
    `- throughput ${Math.round((N / totMs) * 1000)} req/s`,
    `- p99 ${pct(lat, 99)}ms`,
    errs.length ? `- Sample error: ${errs[0]}` : '',
  ])

  if (badRows > 0) {
    bug('D', 'HIGH', `${badRows} quote create con campi calcolati NULL`)
  }
  if (errs.length > 10) {
    bug('D', 'MEDIUM', `${errs.length}/${N} insert falliti sotto burst`)
  }
}

// ============================================================
// SCENARIO E — 50 change requests da sposi su stesso wedding
// ============================================================
async function scenE({ wedding, wpId }) {
  console.log('\n--- SCENARIO E: Couple change-request flood ---')
  const N = 50
  const lat = []
  const errs = []
  const ids = []
  const start = performance.now()

  // RLS: tabella richiede is_entry_participant.
  // service_role bypassa RLS — testiamo capacità di scrittura + trigger ok.
  const r = await Promise.allSettled(
    Array.from({ length: N }, async (_, i) => {
      const t0 = performance.now()
      const { data, error } = await admin.from('couple_change_requests').insert({
        wedding_id: wedding.id,
        created_by: wedding.owner_id,
        title: `${PREFIX}ccr-${i}-${Date.now()}`,
        kind: 'GENERIC',
        description: `change ${i}`,
      }).select('id').single()
      const dt = performance.now() - t0
      lat.push(dt)
      if (error) { errs.push(error.message); pushErr('E', error) }
      if (data?.id) { ids.push(data.id); created.ccrs.push(data.id) }
    }),
  )
  void r
  const totMs = performance.now() - start

  const { data: ccrs } = await admin.from('couple_change_requests').select('id').eq('wedding_id', wedding.id).in('id', ids)
  const inDb = ccrs?.length || 0

  const verdict = ids.length === N && inDb === N ? 'PASS' : ids.length >= N * 0.9 ? 'PARTIAL' : 'FAIL'
  record('E', {
    verdict, ok: ids.length, errors: errs.length, in_db: inDb, total_ms: Math.round(totMs),
  }, lat, { throughput: Math.round((N / totMs) * 1000) })

  md('E', [
    `## E. Couple change request flood`,
    `- **Verdict**: ${verdict}`,
    `- 50 CCR su stesso wedding in ${Math.round(totMs)}ms`,
    `- inseriti ${ids.length}/${N}, db ${inDb}`,
    `- errors: ${errs.length}`,
    `- throughput ${Math.round((N / totMs) * 1000)} req/s`,
    `- p99 ${pct(lat, 99)}ms`,
    errs.length ? `- Sample: ${errs[0]}` : '',
  ])

  if (errs.length > 0) {
    bug('E', 'HIGH', `${errs.length}/${N} CCR rifiutati (RLS o trigger?)`, errs[0])
  }
}

// ============================================================
// SCENARIO F — Edge function timeout (import-pin-url)
// ============================================================
async function scenF() {
  console.log('\n--- SCENARIO F: Edge function timeout (import-pin-url) ---')
  const url = `${SUPA_URL}/functions/v1/import-pin-url`
  // httpstat.us sleep 15s — fn deve avere AbortController a 8s e ritornare 502/422
  const t0 = performance.now()
  let result = { status: 0, body: '', err: null }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${SUPA_SK}`,
        apikey: SUPA_SK,
      },
      body: JSON.stringify({ url: 'https://httpstat.us/200?sleep=15000' }),
    })
    result.status = r.status
    result.body = await r.text().catch(() => '')
  } catch (e) {
    result.err = e?.message
  }
  const dt = performance.now() - t0

  // Atteso: fn ritorna in <12s (timeout 8s + overhead) con status 502 o 422
  const verdict = dt < 13000 && (result.status === 502 || result.status === 422 || result.status === 504)
    ? 'PASS' : dt < 30000 ? 'PARTIAL' : 'FAIL'

  record('F', {
    verdict,
    elapsed_ms: Math.round(dt),
    http_status: result.status,
    body_preview: result.body.slice(0, 200),
    error: result.err,
  }, [dt])

  md('F', [
    `## F. Edge function timeout`,
    `- **Verdict**: ${verdict}`,
    `- POST import-pin-url con URL slow (15s)`,
    `- elapsed: ${Math.round(dt)}ms`,
    `- HTTP status: ${result.status}`,
    `- body: \`${result.body.slice(0, 200)}\``,
    result.err ? `- error: ${result.err}` : '',
  ])

  if (dt > 13000 && result.status === 200) {
    bug('F', 'HIGH', `Fn import-pin-url NON timeoutta: ${Math.round(dt)}ms con URL slow 15s`)
  } else if (dt > 13000) {
    bug('F', 'MEDIUM', `Fn lenta a timeoutare: ${Math.round(dt)}ms (atteso <10s)`)
  }
}

// ============================================================
// SCENARIO G — JWT expiry / refresh
// ============================================================
async function scenG() {
  console.log('\n--- SCENARIO G: JWT expiry / refresh ---')
  // signIn WP, verifica access_token expires_in
  const anonClient = createClient(SUPA_URL, SUPA_SK, { auth: { persistSession: false } })
  const t0 = performance.now()
  let info = {}
  try {
    const { data, error } = await anonClient.auth.signInWithPassword({ email: WP_EMAIL, password: PWD })
    if (error) {
      pushErr('G', error)
      record('G', { verdict: 'SKIP', reason: 'signin failed: ' + error.message }, [])
      md('G', [`## G. JWT expiry`, `- **Verdict**: SKIP (signin failed: ${error.message})`])
      return
    }
    info.has_access = !!data.session?.access_token
    info.has_refresh = !!data.session?.refresh_token
    info.expires_in = data.session?.expires_in
    info.expires_at = data.session?.expires_at

    // Test refresh flow
    const refreshClient = createClient(SUPA_URL, SUPA_SK, { auth: { persistSession: false } })
    const refreshT0 = performance.now()
    const refRes = await refreshClient.auth.refreshSession({ refresh_token: data.session.refresh_token })
    const refreshMs = performance.now() - refreshT0
    info.refresh_ok = !refRes.error
    info.refresh_ms = Math.round(refreshMs)
    info.new_access = refRes.data?.session?.access_token?.slice(0, 30) + '...'

    // Test invalid token
    const invalidClient = createClient(SUPA_URL,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aW52YWxpZA.invalid',
      { auth: { persistSession: false } })
    const invR = await invalidClient.from('quotes').select('id').limit(1)
    info.invalid_jwt_error_code = invR.error?.code
    info.invalid_jwt_msg = invR.error?.message
  } catch (e) {
    info.error = e?.message
  }
  const dt = performance.now() - t0

  const verdict = info.has_access && info.has_refresh && info.refresh_ok ? 'PASS' : 'FAIL'
  record('G', { verdict, ...info }, [dt])

  md('G', [
    `## G. JWT expiry / auto-refresh`,
    `- **Verdict**: ${verdict}`,
    `- signin ok, has_access=${info.has_access}, has_refresh=${info.has_refresh}`,
    `- expires_in: ${info.expires_in}s`,
    `- refresh_ok: ${info.refresh_ok} (${info.refresh_ms}ms)`,
    `- invalid jwt -> code=${info.invalid_jwt_error_code} msg=${info.invalid_jwt_msg}`,
  ])

  if (!info.refresh_ok) {
    bug('G', 'HIGH', `Refresh token non funziona`, info.refresh_error)
  }
  if (!info.invalid_jwt_msg) {
    bug('G', 'MEDIUM', `JWT invalido non rifiutato chiaramente`)
  }
}

// ============================================================
// SCENARIO H — Transaction integrity (trigger BUSY rollback)
// ============================================================
async function scenH({ wpId, fornId }) {
  console.log('\n--- SCENARIO H: Transaction integrity (trigger BUSY) ---')

  // Setup: forn BUSY su data X
  const eventDate = '2027-07-21'
  await admin.from('supplier_availability').delete()
    .eq('fornitore_id', fornId).eq('date', eventDate)
  const { error: avErr } = await admin.from('supplier_availability').insert({
    fornitore_id: fornId, date: eventDate, status: 'BUSY', notes: PREFIX + 'integrity',
  })
  if (avErr) {
    record('H', { verdict: 'SKIP', reason: 'setup avail failed: ' + avErr.message }, [])
    md('H', [`## H. Transaction integrity`, `- **Verdict**: SKIP (${avErr.message})`])
    return
  }
  created.avails.push({ fornitore_id: fornId, date: eventDate })

  // Crea quote con event_date = data busy
  const { data: q, error: qErr } = await admin.from('quotes').insert({
    owner_id: wpId,
    title: PREFIX + 'integrity-' + Date.now(),
    event_date: eventDate,
    status: 'BOZZA',
  }).select().single()
  if (qErr) {
    record('H', { verdict: 'SKIP', reason: qErr.message }, [])
    md('H', [`## H. Transaction integrity`, `- **Verdict**: SKIP (cannot create quote: ${qErr.message})`])
    return
  }
  created.quotes.push(q.id)

  const { data: qBefore } = await admin.from('quotes').select('total_cost, total_client').eq('id', q.id).single()

  // Tenta INSERT quote_item col fornitore BUSY -> deve fallire e rollback
  const t0 = performance.now()
  const { error: itemErr, data: itemData } = await admin.from('quote_items').insert({
    quote_id: q.id,
    supplier_id: fornId,
    name_snapshot: PREFIX + 'voce busy',
    snapshot_price: 1500,
    quantity: 1,
  }).select()
  const dt = performance.now() - t0

  // Verifica DB: nessun orphan item, quote totals invariati
  const { data: items } = await admin.from('quote_items').select('id').eq('quote_id', q.id)
  const { data: qAfter } = await admin.from('quotes').select('total_cost, total_client').eq('id', q.id).single()

  const wasRejected = !!itemErr
  const noOrphan = (items?.length || 0) === 0
  const totalsUnchanged = qBefore.total_cost === qAfter.total_cost && qBefore.total_client === qAfter.total_client

  const verdict = wasRejected && noOrphan && totalsUnchanged ? 'PASS' :
    (!wasRejected ? 'FAIL' : 'PARTIAL')

  record('H', {
    verdict,
    insert_rejected: wasRejected,
    error: itemErr?.message,
    code: itemErr?.code,
    orphan_items: items?.length || 0,
    totals_unchanged: totalsUnchanged,
    latency_ms: Math.round(dt),
  }, [dt])

  md('H', [
    `## H. Transaction integrity (BUSY trigger rollback)`,
    `- **Verdict**: ${verdict}`,
    `- insert quote_item con supplier BUSY su ${eventDate}`,
    `- insert rejected: ${wasRejected}`,
    `- trigger error: ${itemErr?.message?.slice(0, 200)}`,
    `- orphan items in DB: ${items?.length || 0} (atteso 0)`,
    `- totals invariati: ${totalsUnchanged}`,
    `- latency: ${Math.round(dt)}ms`,
  ])

  if (!wasRejected) {
    bug('H', 'CRITICAL', `Insert quote_item con supplier BUSY NON rifiutato — trigger non blocca`)
  } else if (!noOrphan) {
    bug('H', 'CRITICAL', `Orphan quote_items dopo rollback: ${items?.length}`)
  } else if (!totalsUnchanged) {
    bug('H', 'HIGH', `Quote totals modificati nonostante rollback`)
  }
}

// ============================================================
// EXTRA: concurrent quote-send (10 chiamate parallele)
// ============================================================
async function scenQuoteSendParallel({ wpId }) {
  console.log('\n--- EXTRA: quote-send 10 parallel calls ---')
  // Crea quote BOZZA
  const { data: q, error } = await admin.from('quotes').insert({
    owner_id: wpId,
    title: PREFIX + 'qs-parallel-' + Date.now(),
    client_name: 'parallel',
    client_email: 'agent-m-parallel@example.test',
    status: 'BOZZA',
  }).select().single()
  if (error) {
    record('extra_qsend', { verdict: 'SKIP', reason: error.message }, [])
    md('extra', [`## EXTRA. quote-send 10 parallel`, `- **Verdict**: SKIP (cannot create quote)`])
    return
  }
  created.quotes.push(q.id)

  const url = `${SUPA_URL}/functions/v1/quote-send`
  const N = 10
  const lat = []
  const res = await Promise.allSettled(
    Array.from({ length: N }, async i => {
      const t0 = performance.now()
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${SUPA_SK}`,
          apikey: SUPA_SK,
        },
        body: JSON.stringify({ quote_id: q.id }),
      })
      const txt = await r.text().catch(() => '')
      lat.push(performance.now() - t0)
      return { i, status: r.status, txt: txt.slice(0, 150) }
    }),
  )

  const okCnt = res.filter(r => r.status === 'fulfilled' && r.value.status === 200).length
  const ks = res.filter(r => r.status === 'fulfilled').map(r => r.value.status)
  const { data: qAfter } = await admin.from('quotes').select('status, sent_at, sent_email_log').eq('id', q.id).single()
  const emailLogLen = Array.isArray(qAfter?.sent_email_log) ? qAfter.sent_email_log.length : 'N/A'

  const verdict = (okCnt >= 1 && qAfter?.status === 'INVIATO') ? 'PASS' : 'PARTIAL'
  record('extra_qsend', {
    verdict, ok: okCnt, statuses: ks,
    final_status: qAfter?.status, email_log_entries: emailLogLen,
  }, lat)

  md('extra', [
    `## EXTRA. quote-send 10 parallel`,
    `- **Verdict**: ${verdict}`,
    `- ok ${okCnt}/${N}, status codes: ${ks.join(',')}`,
    `- quote final status: ${qAfter?.status}`,
    `- sent_email_log entries: ${emailLogLen}`,
    `- p99 ${pct(lat, 99)}ms`,
  ])

  if (typeof emailLogLen === 'number' && emailLogLen > 1) {
    bug('extra', 'MEDIUM', `Email log ha ${emailLogLen} entries da 10 chiamate parallele — log duplicato`)
  }
}

// ============================================================
// CLEANUP
// ============================================================
async function cleanup() {
  console.log('\n--- CLEANUP ---')
  // quote_items via cascade dalle quotes
  if (created.quotes.length) {
    const { error } = await admin.from('quotes').delete().in('id', created.quotes)
    if (error) console.log('  Cleanup quotes err:', error.message)
    else console.log('  Cleanup quotes:', created.quotes.length)
  }
  // CCRs
  if (created.ccrs.length) {
    const { error } = await admin.from('couple_change_requests').delete().in('id', created.ccrs)
    if (error) console.log('  Cleanup ccrs err:', error.message)
    else console.log('  Cleanup ccrs:', created.ccrs.length)
  }
  // avails
  for (const a of created.avails) {
    await admin.from('supplier_availability').delete()
      .eq('fornitore_id', a.fornitore_id).eq('date', a.date)
  }
  console.log('  Cleanup avails:', created.avails.length)

  // Cleanup quote_acceptances per AGENT-M
  await admin.from('quote_acceptances')
    .delete().like('signer_name', PREFIX + '%')
  // Cleanup remaining AGENT-M quotes (fallback)
  await admin.from('quotes').delete().like('title', PREFIX + '%')
  // Cleanup remaining CCRs
  await admin.from('couple_change_requests').delete().like('title', PREFIX + '%')
}

// ============================================================
// MAIN
// ============================================================
;(async () => {
  console.log('==================================')
  console.log('  WAVE 2 - AGENT M - STRESS TEST  ')
  console.log('==================================')
  const ctx = await bootstrap()

  // Reset errors file
  writeFileSync(errorsFile, '')

  try { await scenA() } catch (e) { console.error('A FAILED', e); pushErr('A_FATAL', e) }
  try { await scenB(ctx) } catch (e) { console.error('B FAILED', e); pushErr('B_FATAL', e) }
  try { await scenC(ctx) } catch (e) { console.error('C FAILED', e); pushErr('C_FATAL', e) }
  try { await scenD(ctx) } catch (e) { console.error('D FAILED', e); pushErr('D_FATAL', e) }
  try { await scenE(ctx) } catch (e) { console.error('E FAILED', e); pushErr('E_FATAL', e) }
  try { await scenF() } catch (e) { console.error('F FAILED', e); pushErr('F_FATAL', e) }
  try { await scenG() } catch (e) { console.error('G FAILED', e); pushErr('G_FATAL', e) }
  try { await scenH(ctx) } catch (e) { console.error('H FAILED', e); pushErr('H_FATAL', e) }
  try { await scenQuoteSendParallel(ctx) } catch (e) { console.error('extra FAILED', e); pushErr('extra_FATAL', e) }

  await cleanup()

  // Write outputs
  writeFileSync(path.join(RUN_DIR, 'stress-stats.json'), JSON.stringify(stats, null, 2))

  const report = [
    `# WAVE 2 — AGENT M — STRESS & RACE CONDITIONS`,
    ``,
    `**Run**: ${new Date().toISOString()}`,
    `**Output**: ${RUN_DIR}`,
    `**Prefix**: \`${PREFIX}\``,
    ``,
    `## Summary stats`,
    '```json',
    JSON.stringify(stats, null, 2),
    '```',
    ``,
    ...((scenarioMd.A || []).concat(['']) ),
    ...((scenarioMd.B || []).concat(['']) ),
    ...((scenarioMd.C || []).concat(['']) ),
    ...((scenarioMd.D || []).concat(['']) ),
    ...((scenarioMd.E || []).concat(['']) ),
    ...((scenarioMd.F || []).concat(['']) ),
    ...((scenarioMd.G || []).concat(['']) ),
    ...((scenarioMd.H || []).concat(['']) ),
    ...((scenarioMd.extra || []).concat(['']) ),
    `## Bugs`,
    BUGS.length ? '' : '_Nessun bug rilevato_',
    ...BUGS.map(b => `- **[${b.severity}]** [${b.scenario}] ${b.msg}${b.detail ? ` — \`${String(b.detail).slice(0, 200)}\`` : ''}`),
  ].join('\n')

  writeFileSync(path.join(RUN_DIR, 'REPORT.md'), report)
  writeFileSync(path.join(RUN_DIR, 'bugs.json'), JSON.stringify(BUGS, null, 2))

  console.log('\n==================================')
  console.log('  REPORT:', path.join(RUN_DIR, 'REPORT.md'))
  console.log('  Bugs:', BUGS.length)
  console.log('==================================')
  process.exit(0)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
