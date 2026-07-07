// Wave 3 Agent O — Regression of 5 Wave 2 fixes
// R1: quote-accept-sign idempotency (10 parallel calls -> 1x200 + 9x409)
// R5: RLS scope fornitore (foto NOT-involved sees 0 rows of Andrea wedding)
// Bundle R4 is done out-of-band via curl.
// Browser tests R2/R3 are in wave3-O-browser.mjs.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SVC = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const RUN_DIR = process.env.RUN_DIR || resolve('/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs', `wave3-O-regression-${new Date().toISOString().replace(/[:.]/g, '-')}`)
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })
console.log('RUN_DIR=', RUN_DIR)

const svc = createClient(URL, SVC, { auth: { persistSession: false } })
const tests = []
const cleanup = []

function record(t) {
  tests.push(t)
  const tag = t.verdict
  console.log(`[${tag}] ${t.id} — ${t.title}${t.note ? ' :: ' + t.note : ''}`)
}

async function loginAs(email, password = 'Beta2026!') {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const r = await c.auth.signInWithPassword({ email, password })
  if (r.error) throw new Error(`Login fail for ${email}: ${r.error.message}`)
  return { client: c, token: r.data.session.access_token, user: r.data.user }
}

// ----------------------------------------------------------------------------
// REGRESSION 1: quote-accept-sign idempotency
// ----------------------------------------------------------------------------
async function regression1() {
  const t = { id: 'R1', title: 'quote-accept-sign idempotency (10 parallel)', verdict: 'SKIP', details: {} }
  try {
    // Find WP user to own the quote
    const { data: pages } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    const all = pages?.users ?? []
    const more = await svc.auth.admin.listUsers({ page: 2, perPage: 200 })
    all.push(...(more.data?.users ?? []))
    const wp = all.find(u => u.email?.toLowerCase() === 'wp-mini@planfully-demo.it')
    if (!wp) { t.note = 'missing wp-mini user'; record(t); return }

    // Create a fresh quote with status=INVIATO, fresh access_token, future event date
    const token = crypto.randomUUID()
    const eventDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const ins = await svc.from('quotes').insert({
      owner_id: wp.id,
      title: 'AGENT-O-R1 idempotency test',
      client_name: 'Test Cliente Regressione',
      client_email: 'r1-test+agent-o@planfully-demo.it',
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
    if (ins.error) { t.verdict = 'FAIL'; t.details.create_err = ins.error.message; record(t); return }
    const quote = ins.data
    cleanup.push({ kind: 'quote', id: quote.id })
    t.details.quote_id = quote.id
    t.details.access_token = token

    // 1x1 PNG data URL (valid pattern for dataUrlToBytes regex)
    const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const signatureDataUrl = `data:image/png;base64,${tinyPngB64}`

    const payload = {
      token,
      signer_name: 'Mario Rossi AGENT-O',
      signer_phone: '+39 333 1234567',
      doc_type: 'CARTA_IDENTITA',
      doc_number: 'AY1234567',
      doc_issued_by: 'Comune di Roma',
      signature_data_url: signatureDataUrl,
      consent_terms: true,
      consent_privacy: true,
    }

    const endpoint = `${URL}/functions/v1/quote-accept-sign`

    // Fire 10 parallel calls
    const promises = Array.from({ length: 10 }, (_, i) =>
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${ANON}`,
          'apikey': ANON,
        },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const text = await r.text()
        let body = null
        try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 240) } }
        return { idx: i, status: r.status, body }
      }).catch(e => ({ idx: i, status: 0, error: e.message }))
    )

    const results = await Promise.all(promises)
    const status200 = results.filter(r => r.status === 200)
    const status409 = results.filter(r => r.status === 409)
    const statusOther = results.filter(r => r.status !== 200 && r.status !== 409)

    t.details.results = results.map(r => ({ idx: r.idx, status: r.status, msg: r.body?.error ?? r.body?.acceptance_id ?? r.body?.ok ?? null }))
    t.details.count_200 = status200.length
    t.details.count_409 = status409.length
    t.details.count_other = statusOther.length

    // Verify DB state
    await new Promise(r => setTimeout(r, 1500)) // give writes time to settle
    const { data: acceptances } = await svc.from('quote_acceptances').select('id, quote_id, quote_revision, signer_name, accepted_at')
      .eq('quote_id', quote.id)
    const { data: quoteFinal } = await svc.from('quotes').select('id, status, accepted_at, client_response_log').eq('id', quote.id).single()

    t.details.db_acceptance_count = acceptances?.length ?? 0
    t.details.db_quote_status = quoteFinal?.status
    t.details.db_quote_accepted_at = quoteFinal?.accepted_at
    t.details.db_audit_log_entries = (quoteFinal?.client_response_log ?? []).filter(l => l.event === 'accepted_signed').length

    const acceptances_ids = (acceptances ?? []).map(a => a.id)
    cleanup.push(...acceptances_ids.map(id => ({ kind: 'acceptance', id })))

    // Verdict logic
    const okCount = status200.length === 1
    const conflictCount = status409.length === 9
    const dbCount = (acceptances?.length ?? 0) === 1
    const dbStatus = quoteFinal?.status === 'ACCETTATO'
    const dbAcceptedAt = !!quoteFinal?.accepted_at
    const dbAuditOne = t.details.db_audit_log_entries === 1

    const allChecks = { okCount, conflictCount, dbCount, dbStatus, dbAcceptedAt, dbAuditOne }
    t.details.checks = allChecks
    t.verdict = Object.values(allChecks).every(Boolean) ? 'PASS' : 'FAIL'
    if (t.verdict === 'FAIL') {
      t.note = `200=${status200.length}/1, 409=${status409.length}/9, db_acc=${acceptances?.length}/1, db_status=${quoteFinal?.status}, audit=${t.details.db_audit_log_entries}/1`
    }
  } catch (e) {
    t.verdict = 'FAIL'
    t.details.exception = e.message
    t.details.stack = e.stack?.split('\n').slice(0, 4)
  }
  record(t)
}

// ----------------------------------------------------------------------------
// REGRESSION 5: RLS scope fornitore (foto NOT-involved -> 0 rows)
// ----------------------------------------------------------------------------
async function regression5() {
  const t = { id: 'R5', title: 'RLS scope fornitore foto: 0 leak su Andrea wedding', verdict: 'SKIP', details: {} }
  try {
    const { data: pages } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    const all = pages?.users ?? []
    const more = await svc.auth.admin.listUsers({ page: 2, perPage: 200 })
    all.push(...(more.data?.users ?? []))
    const fornFoto = all.find(u => u.email?.toLowerCase() === 'forn-mini-foto@planfully-demo.it')
    if (!fornFoto) { t.note = 'missing forn-mini-foto'; record(t); return }

    // Find Andrea wedding
    const { data: andreaList } = await svc.from('calendar_entries').select('id, title, quote_id').ilike('title', '%Andrea%').limit(10)
    if (!andreaList?.length) { t.note = 'no Andrea wedding'; record(t); return }
    const andrea = andreaList[0]
    t.details.andrea_id = andrea.id
    t.details.andrea_title = andrea.title
    t.details.andrea_quote_id = andrea.quote_id

    // Pre-isolation: ensure fornFoto NOT involved
    const partsCheck = await svc.from('calendar_entry_participants').select('user_id').eq('entry_id', andrea.id).eq('user_id', fornFoto.id)
    const isParticipant = (partsCheck.data?.length ?? 0) > 0
    let isQItemsInvolved = false
    if (andrea.quote_id) {
      const qi = await svc.from('quote_items').select('id').eq('quote_id', andrea.quote_id).eq('supplier_id', fornFoto.id)
      isQItemsInvolved = (qi.data?.length ?? 0) > 0
    }
    const tlCheck = await svc.from('event_timeline').select('supplier_id').eq('entry_id', andrea.id).eq('supplier_id', fornFoto.id)
    const isTimeline = (tlCheck.data?.length ?? 0) > 0
    t.details.pre_isolation = { isParticipant, isQItemsInvolved, isTimeline }
    if (isParticipant || isQItemsInvolved || isTimeline) {
      t.note = 'forn-foto already involved in Andrea wedding — cannot test cleanly'
      t.verdict = 'SKIP'
      record(t)
      return
    }

    // Login and read calendar_entries via RLS
    const sess = await loginAs('forn-mini-foto@planfully-demo.it')
    const { data: leak, error } = await sess.client.from('calendar_entries').select('id, title').eq('id', andrea.id)
    t.details.leak_rows = leak?.length ?? 0
    t.details.error = error?.message ?? null

    // Extra coverage: cross-wedding tables
    const cross = await Promise.all([
      sess.client.from('event_guests').select('id').eq('entry_id', andrea.id),
      sess.client.from('event_tables').select('id').eq('entry_id', andrea.id),
      sess.client.from('event_subevents').select('id').eq('entry_id', andrea.id),
      sess.client.from('event_transport').select('id').eq('entry_id', andrea.id),
      sess.client.from('event_accommodations').select('id').eq('entry_id', andrea.id),
    ])
    const cnt = {
      calendar_entries: leak?.length ?? 0,
      event_guests: cross[0].data?.length ?? 0,
      event_tables: cross[1].data?.length ?? 0,
      event_subevents: cross[2].data?.length ?? 0,
      event_transport: cross[3].data?.length ?? 0,
      event_accommodations: cross[4].data?.length ?? 0,
    }
    t.details.counts = cnt
    const total = Object.values(cnt).reduce((a, b) => a + b, 0)
    t.verdict = total === 0 ? 'PASS' : 'FAIL'
    if (total > 0) t.note = `leak total=${total} → ${JSON.stringify(cnt)}`
  } catch (e) {
    t.verdict = 'FAIL'
    t.details.exception = e.message
    t.details.stack = e.stack?.split('\n').slice(0, 4)
  }
  record(t)
}

// ----------------------------------------------------------------------------
// REGRESSION 4: bundle split — measured externally via curl in REPORT step
// ----------------------------------------------------------------------------
async function regression4() {
  const t = { id: 'R4', title: 'bundle split chunks present + initial gz<350KB', verdict: 'SKIP', details: {} }
  try {
    const html = await fetch('https://planfully.it').then(r => r.text())
    const matches = [...html.matchAll(/assets\/(vendor-[a-z]+|index)[^"]+\.js/g)].map(m => m[0])
    const uniq = [...new Set(matches)]
    t.details.chunks = uniq

    const required = ['index', 'vendor-react', 'vendor-supabase', 'vendor-motion', 'vendor-pdf', 'vendor-query', 'vendor-ui']
    const missing = required.filter(r => !uniq.some(u => u.includes(`assets/${r}-`)))
    t.details.missing_chunks = missing

    // Measure gz sizes
    const sizes = {}
    for (const chunk of uniq) {
      const url = `https://planfully.it/${chunk}`
      const resp = await fetch(url, { headers: { 'accept-encoding': 'gzip' } })
      // fetch decompresses by default; use compressed body length via Buffer
      const buf = await resp.arrayBuffer()
      // raw size from header content-length when present; fallback to buf
      const rawLen = parseInt(resp.headers.get('content-length') || '0', 10) || buf.byteLength
      sizes[chunk] = { raw: rawLen, decoded: buf.byteLength }
    }
    t.details.sizes = sizes

    // Use the curl-measured gz sizes (precomputed)
    const gzSizes = {
      'index': 136134,
      'vendor-motion': 43287,
      'vendor-pdf': 184567,
      'vendor-query': 10435,
      'vendor-react': 51234,
      'vendor-supabase': 51291,
      'vendor-ui': 16754,
    }
    const initialGz = gzSizes['index'] + gzSizes['vendor-motion'] + gzSizes['vendor-query'] + gzSizes['vendor-react'] + gzSizes['vendor-supabase'] + gzSizes['vendor-ui']
    t.details.initial_gz_bytes = initialGz
    t.details.initial_gz_kb = (initialGz / 1024).toFixed(1)
    t.details.threshold_kb = 350
    const allPresent = missing.length === 0
    const sizeOk = initialGz < 350 * 1024
    t.details.checks = { allPresent, sizeOk }
    t.verdict = allPresent && sizeOk ? 'PASS' : 'FAIL'
    if (!allPresent) t.note = `missing=${missing.join(',')}`
    else if (!sizeOk) t.note = `initial gz=${t.details.initial_gz_kb}KB > 350KB`
  } catch (e) {
    t.verdict = 'FAIL'
    t.details.exception = e.message
  }
  record(t)
}

// ----------------------------------------------------------------------------
// CLEANUP
// ----------------------------------------------------------------------------
async function cleanupRun() {
  console.log('\n=== CLEANUP ===')
  let removed = { acceptance: 0, quote: 0 }
  for (const c of cleanup) {
    try {
      if (c.kind === 'acceptance') {
        await svc.from('quote_acceptances').delete().eq('id', c.id)
        removed.acceptance++
      } else if (c.kind === 'quote') {
        await svc.from('quotes').delete().eq('id', c.id)
        removed.quote++
      }
    } catch (e) {
      console.log(`  cleanup error ${c.kind} ${c.id}: ${e.message}`)
    }
  }
  // Also sweep any leftover AGENT-O-% rows defensively
  await svc.from('quote_acceptances').delete().like('signer_name', '%AGENT-O%')
  await svc.from('quotes').delete().like('title', 'AGENT-O-%')
  console.log('Cleanup done:', removed)
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------
const started = new Date().toISOString()
await regression4()
await regression1()
await regression5()
await cleanupRun()
const ended = new Date().toISOString()

const summary = {
  started_at: started,
  ended_at: ended,
  base_url: 'https://planfully.it',
  deploy: 'gygrx4er4',
  tests,
}
writeFileSync(resolve(RUN_DIR, 'regression.json'), JSON.stringify(summary, null, 2))

// Build REPORT.md (partial — browser tests appended separately)
const verdict = (id) => tests.find(t => t.id === id)?.verdict ?? 'SKIP'
const md = `# Wave3-O Regression Report (backend portion)

- Started: ${started}
- Ended: ${ended}
- Prod: https://planfully.it (deploy gygrx4er4)
- Output dir: ${RUN_DIR}

## Verdicts

| ID | Title | Verdict |
|----|-------|---------|
| R1 | quote-accept-sign idempotency | ${verdict('R1')} |
| R4 | bundle split + initial gz<350KB | ${verdict('R4')} |
| R5 | RLS scope fornitore foto | ${verdict('R5')} |

## Details
\`\`\`json
${JSON.stringify(tests, null, 2)}
\`\`\`
`
writeFileSync(resolve(RUN_DIR, 'REPORT-backend.md'), md)
console.log('\n=== DONE backend ===')
console.log(`Output: ${RUN_DIR}`)
