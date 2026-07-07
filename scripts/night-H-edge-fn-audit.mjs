// Agent H — Edge Functions audit (deployed remote).
// Tests all 10 edge functions on production-like Supabase.
//
// Run: RUN_DIR=audit-runs/night-H-edge-fn-<ts> node scripts/night-H-edge-fn-audit.mjs

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'
const PWD = 'Beta2026!'

const RUN_DIR = process.env.RUN_DIR || `audit-runs/night-H-edge-fn-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
const ABS_RUN = path.isAbsolute(RUN_DIR) ? RUN_DIR : path.join(process.cwd(), RUN_DIR)
fs.mkdirSync(ABS_RUN, { recursive: true })
fs.mkdirSync(path.join(ABS_RUN, 'logs'), { recursive: true })
fs.mkdirSync(path.join(ABS_RUN, 'pdfs'), { recursive: true })
fs.mkdirSync(path.join(ABS_RUN, 'emails'), { recursive: true })

const sb = createClient(URL, SERVICE, { auth: { persistSession: false } })
const sbAnon = createClient(URL, ANON, { auth: { persistSession: false } })

const results = {} // fn -> [{ test, pass, status, detail, request, response }]
const bugs = []
const cleanup = { quote_ids: [], invite_ids: [], couple_member_ids: [], calendar_entry_ids: [] }

function log(...args) { console.log(...args) }

function record(fn, test, pass, status, detail, extra = {}) {
  results[fn] = results[fn] || []
  results[fn].push({ test, pass, status, detail, ...extra })
  log(`[${fn}] ${pass ? 'PASS' : 'FAIL'} - ${test} :: ${status} ${detail ?? ''}`)
  if (!pass) bugs.push({ fn, test, status, detail })
}

async function callFn(name, body, opts = {}) {
  const headers = {
    'content-type': 'application/json',
    apikey: ANON,
    Authorization: opts.token ? `Bearer ${opts.token}` : `Bearer ${ANON}`,
  }
  if (opts.method && opts.method !== 'POST' && opts.queryString) {
    const r = await fetch(`${URL}/functions/v1/${name}?${opts.queryString}`, {
      method: opts.method, headers,
    })
    const text = await r.text()
    let json = null; try { json = JSON.parse(text) } catch {}
    return { status: r.status, text, json, headers: Object.fromEntries(r.headers.entries()) }
  }
  const r = await fetch(`${URL}/functions/v1/${name}`, {
    method: opts.method ?? 'POST', headers,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  })
  const ct = r.headers.get('content-type') ?? ''
  if (ct.includes('application/pdf')) {
    const buf = Buffer.from(await r.arrayBuffer())
    return { status: r.status, buf, headers: Object.fromEntries(r.headers.entries()) }
  }
  if (ct.includes('text/calendar') || ct.includes('text/plain')) {
    const text = await r.text()
    return { status: r.status, text, headers: Object.fromEntries(r.headers.entries()) }
  }
  const text = await r.text()
  let json = null; try { json = JSON.parse(text) } catch {}
  return { status: r.status, text, json, headers: Object.fromEntries(r.headers.entries()) }
}

// ============== SETUP ==============
log('=== Login WP ===')
const wpEmail = 'wp-beta@planfully-demo.it'
const { data: wpSess, error: wpErr } = await sbAnon.auth.signInWithPassword({ email: wpEmail, password: PWD })
if (wpErr || !wpSess?.session) {
  log('Login fallito, provo wp-mini', wpErr?.message)
  const r2 = await sbAnon.auth.signInWithPassword({ email: 'wp-mini@planfully-demo.it', password: PWD })
  if (r2.error) {
    log('FATAL: nessun WP login. Abort.')
    process.exit(1)
  }
  wpSess.session = r2.data.session
}
const wpToken = wpSess.session.access_token
const wpId = wpSess.session.user.id
log('WP id:', wpId)

// Trova un fornitore beta
const { data: forn } = await sb.from('profiles').select('id, full_name').eq('subrole', 'fotografo').limit(1).maybeSingle()
const fornId = forn?.id
log('Forn fotografo:', fornId)

// Trova una coppia + wedding entry esistente
const { data: wed } = await sb.from('calendar_entries').select('id, title, owner_id, date_from, date_to').eq('owner_id', wpId).limit(1).maybeSingle()
log('Wedding entry:', wed?.id)

// Trova/crea una quote per i test
let testQuoteId = null
const { data: existingQuote } = await sb.from('quotes').select('id').eq('owner_id', wpId).eq('status', 'DRAFT').limit(1).maybeSingle()
if (existingQuote) {
  testQuoteId = existingQuote.id
  log('Using existing draft quote:', testQuoteId)
} else {
  const { data: anyQuote } = await sb.from('quotes').select('id, status').eq('owner_id', wpId).limit(1).maybeSingle()
  testQuoteId = anyQuote?.id
  log('Using existing quote (any status):', testQuoteId, anyQuote?.status)
}

// ============== 1. import-pin-url ==============
log('\n=== TEST: import-pin-url ===')

const PIN_TESTS = [
  { name: 'happy_https_unsplash', body: { url: 'https://unsplash.com/photos/wedding-bouquet-of-flowers-l-_xKZ7Wfng' }, expect: 'image_ok' },
  { name: 'no_body', body: {}, expect: 400 },
  { name: 'invalid_url', body: { url: 'not-a-url' }, expect: 400 },
  { name: 'protocol_http', body: { url: 'javascript:alert(1)' }, expect: 400 },
  { name: 'protocol_ftp', body: { url: 'ftp://example.com/file.txt' }, expect: 400 },
  { name: 'url_too_long', body: { url: 'https://example.com/' + 'x'.repeat(2500) }, expect: 502 },
  { name: 'no_og_image', body: { url: 'https://example.com/' }, expect: 422 },
  { name: 'pinterest_pin', body: { url: 'https://www.pinterest.com/pin/736338510250712378/' }, expect: 'image_ok' },
  { name: 'instagram_post', body: { url: 'https://www.instagram.com/p/CzKvfeYIuqK/' }, expect: 'try' },
  { name: 'fetch_image_true', body: { url: 'https://unsplash.com/photos/wedding-bouquet-of-flowers-l-_xKZ7Wfng', fetch_image: true }, expect: 'base64_ok' },
  { name: 'method_get_not_allowed', body: undefined, expect: 405, opts: { method: 'GET' } },
]

for (const t of PIN_TESTS) {
  try {
    const r = await callFn('import-pin-url', t.body, t.opts ?? {})
    let pass = false
    let detail = ''
    if (t.expect === 'image_ok') {
      pass = r.status === 200 && r.json?.image
      detail = pass ? `image=${(r.json?.image || '').slice(0, 50)}` : `status=${r.status} ${(r.json?.error || r.text || '').slice(0, 100)}`
    } else if (t.expect === 'base64_ok') {
      pass = r.status === 200 && (r.json?.image_base64 || r.json?.image_fetch_error)
      detail = pass ? `b64_len=${(r.json?.image_base64 || '').length} err=${r.json?.image_fetch_error}` : `status=${r.status}`
    } else if (t.expect === 'try') {
      pass = r.status === 200 || r.status === 422 || r.status === 502
      detail = `status=${r.status} ${r.json?.image ? 'has_image' : r.json?.error}`
    } else {
      pass = r.status === t.expect
      detail = `status=${r.status} ${r.json?.error ?? r.text?.slice(0, 80) ?? ''}`
    }
    record('import-pin-url', t.name, pass, r.status, detail)
  } catch (e) {
    record('import-pin-url', t.name, false, 'ERR', String(e).slice(0, 100))
  }
}

// ============== 2. quote-generate-pdf ==============
log('\n=== TEST: quote-generate-pdf ===')

// 2a. happy path con quote esistente
if (testQuoteId) {
  const r = await callFn('quote-generate-pdf', { quote_id: testQuoteId }, { token: wpToken })
  if (r.status === 200 && r.json?.url) {
    // download PDF
    const pdfRes = await fetch(r.json.url)
    if (pdfRes.ok) {
      const buf = Buffer.from(await pdfRes.arrayBuffer())
      const pdfPath = path.join(ABS_RUN, 'pdfs', `quote-neutra-${testQuoteId}.pdf`)
      fs.writeFileSync(pdfPath, buf)
      record('quote-generate-pdf', 'happy_neutra', true, 200, `pdf_size=${buf.length}b path=${pdfPath}`)
    } else {
      record('quote-generate-pdf', 'happy_neutra', false, r.status, `url returned but fetch failed: ${pdfRes.status}`)
    }
  } else {
    record('quote-generate-pdf', 'happy_neutra', false, r.status, JSON.stringify(r.json ?? r.text).slice(0, 150))
  }

  // 2b. variant PREMIUM
  const rP = await callFn('quote-generate-pdf', { quote_id: testQuoteId, variant: 'PREMIUM' }, { token: wpToken })
  if (rP.status === 200 && rP.json?.url) {
    const pdfRes = await fetch(rP.json.url)
    if (pdfRes.ok) {
      const buf = Buffer.from(await pdfRes.arrayBuffer())
      fs.writeFileSync(path.join(ABS_RUN, 'pdfs', `quote-premium-${testQuoteId}.pdf`), buf)
      record('quote-generate-pdf', 'happy_premium', true, 200, `pdf_size=${buf.length}b`)
    } else {
      record('quote-generate-pdf', 'happy_premium', false, rP.status, `pdf fetch failed`)
    }
  } else {
    record('quote-generate-pdf', 'happy_premium', false, rP.status, JSON.stringify(rP.json).slice(0, 150))
  }
} else {
  record('quote-generate-pdf', 'happy_neutra', false, 'SKIP', 'no quote available')
}

// 2c. missing quote_id
{
  const r = await callFn('quote-generate-pdf', {}, { token: wpToken })
  record('quote-generate-pdf', 'no_quote_id', r.status === 400, r.status, r.json?.error ?? '')
}
// 2d. invalid quote_id
{
  const r = await callFn('quote-generate-pdf', { quote_id: '00000000-0000-0000-0000-000000000000' }, { token: wpToken })
  record('quote-generate-pdf', 'invalid_quote_id', r.status === 404, r.status, r.json?.error ?? '')
}
// 2e. method not allowed
{
  const r = await callFn('quote-generate-pdf', undefined, { method: 'GET', token: wpToken })
  record('quote-generate-pdf', 'method_get', r.status === 405, r.status, r.json?.error ?? r.text?.slice(0, 50))
}

// ============== 3. quote-send ==============
log('\n=== TEST: quote-send ===')

// 3a. no auth → should fail/anon since uses SERVICE_KEY internally
if (testQuoteId) {
  // Set client_email on quote first if missing
  await sb.from('quotes').update({ client_email: 'test+night-h@mailinator.com', client_name: 'Test Night H' }).eq('id', testQuoteId)

  const r = await callFn('quote-send', { quote_id: testQuoteId }, { token: wpToken })
  const pass = r.status === 200
  record('quote-send', 'happy_send', pass, r.status, JSON.stringify(r.json ?? r.text).slice(0, 200))

  // capture quote token
  const { data: q } = await sb.from('quotes').select('access_token, status, client_email, sent_at').eq('id', testQuoteId).maybeSingle()
  fs.writeFileSync(path.join(ABS_RUN, 'emails', 'quote-send-result.json'), JSON.stringify({ quote: q, response: r.json }, null, 2))
  record('quote-send', 'access_token_generated', !!q?.access_token, 'meta', `token=${q?.access_token?.slice(0,10)}... status=${q?.status}`)
}

// 3b. missing quote_id
{
  const r = await callFn('quote-send', {}, { token: wpToken })
  record('quote-send', 'no_quote_id', r.status === 400, r.status, r.json?.error ?? '')
}

// 3c. invalid id
{
  const r = await callFn('quote-send', { quote_id: '00000000-0000-0000-0000-000000000000' }, { token: wpToken })
  record('quote-send', 'invalid_quote_id', r.status === 404 || r.status === 500, r.status, r.json?.error ?? '')
}

// 3d. method not allowed
{
  const r = await callFn('quote-send', undefined, { method: 'GET', token: wpToken })
  record('quote-send', 'method_get', r.status === 405, r.status, r.json?.error ?? r.text?.slice(0, 60))
}

// ============== 4. quote-accept-sign ==============
log('\n=== TEST: quote-accept-sign ===')

// get token from quote that was sent
let signToken = null
if (testQuoteId) {
  const { data: q } = await sb.from('quotes').select('access_token').eq('id', testQuoteId).maybeSingle()
  signToken = q?.access_token
}

// 4a. missing token
{
  const r = await callFn('quote-accept-sign', {})
  record('quote-accept-sign', 'no_token', r.status === 400, r.status, r.json?.error ?? '')
}

// 4b. missing fields
{
  const r = await callFn('quote-accept-sign', { token: signToken ?? 'x' })
  record('quote-accept-sign', 'no_signer_name', r.status === 400, r.status, r.json?.error ?? '')
}

// 4c. bad token
{
  const r = await callFn('quote-accept-sign', {
    token: 'invalid-token-' + Date.now(),
    signer_name: 'Mario Rossi',
    doc_type: 'CARTA_IDENTITA',
    doc_number: 'AB1234567',
    signature_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    consent_terms: true,
    consent_privacy: true,
  })
  record('quote-accept-sign', 'invalid_token', r.status === 404, r.status, r.json?.error ?? '')
}

// 4d. bad signature_data_url format
if (signToken) {
  const r = await callFn('quote-accept-sign', {
    token: signToken,
    signer_name: 'Mario Rossi',
    doc_type: 'CARTA_IDENTITA',
    doc_number: 'AB1234567',
    signature_data_url: 'not a data url',
    consent_terms: true,
    consent_privacy: true,
  })
  record('quote-accept-sign', 'bad_signature_format', r.status === 400 || r.status === 500, r.status, r.json?.error ?? '')
}

// 4e. happy path - sign quote
if (signToken) {
  const minimalPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const r = await callFn('quote-accept-sign', {
    token: signToken,
    signer_name: 'Mario Rossi',
    signer_phone: '+393331234567',
    doc_type: 'CARTA_IDENTITA',
    doc_number: 'AB1234567',
    doc_issued_by: 'Comune di Roma',
    signature_data_url: minimalPng,
    consent_terms: true,
    consent_privacy: true,
  })
  const pass = r.status === 200 && r.json?.ok
  record('quote-accept-sign', 'happy_sign', pass, r.status, JSON.stringify(r.json).slice(0, 200))

  // 4f. idempotenza: chiamata seconda volta → quote is now ACCETTATO, should 409 or update
  if (pass) {
    const r2 = await callFn('quote-accept-sign', {
      token: signToken,
      signer_name: 'Mario Rossi',
      doc_type: 'CARTA_IDENTITA',
      doc_number: 'AB1234567',
      signature_data_url: minimalPng,
      consent_terms: true,
      consent_privacy: true,
    })
    const pass2 = r2.status === 409 || r2.status === 200
    record('quote-accept-sign', 'idempotency', pass2, r2.status, JSON.stringify(r2.json).slice(0, 150))
  }
}

// ============== 5. moodboard-pdf ==============
log('\n=== TEST: moodboard-pdf ===')

if (wed?.id) {
  // verify schema first
  const { data: assets } = await sb.from('wedding_assets').select('id, tag').eq('entry_id', wed.id).limit(5)
  log(`Wedding ${wed.id} has ${assets?.length ?? 0} assets`)

  const r = await callFn('moodboard-pdf', { entry_id: wed.id }, { token: wpToken })
  if (r.status === 200 && r.buf) {
    fs.writeFileSync(path.join(ABS_RUN, 'pdfs', `moodboard-${wed.id}.pdf`), r.buf)
    record('moodboard-pdf', 'happy', true, 200, `pdf_size=${r.buf.length}b`)
  } else if (r.status === 200 && r.json?.url) {
    const pdfRes = await fetch(r.json.url)
    if (pdfRes.ok) {
      const buf = Buffer.from(await pdfRes.arrayBuffer())
      fs.writeFileSync(path.join(ABS_RUN, 'pdfs', `moodboard-${wed.id}.pdf`), buf)
      record('moodboard-pdf', 'happy', true, 200, `pdf_size=${buf.length}b`)
    } else {
      record('moodboard-pdf', 'happy', false, r.status, 'url fetch failed')
    }
  } else {
    record('moodboard-pdf', 'happy', false, r.status, JSON.stringify(r.json ?? r.text).slice(0, 200))
  }

  // missing entry_id
  const r2 = await callFn('moodboard-pdf', {}, { token: wpToken })
  record('moodboard-pdf', 'no_entry_id', r2.status === 400, r2.status, r2.json?.error ?? r2.text?.slice(0, 80))

  // invalid entry_id
  const r3 = await callFn('moodboard-pdf', { entry_id: '00000000-0000-0000-0000-000000000000' }, { token: wpToken })
  record('moodboard-pdf', 'invalid_entry_id', r3.status === 404 || r3.status === 400, r3.status, r3.json?.error ?? r3.text?.slice(0, 80))

  // method not allowed
  const r4 = await callFn('moodboard-pdf', undefined, { method: 'GET' })
  record('moodboard-pdf', 'method_get', r4.status === 405, r4.status, r4.json?.error ?? r4.text?.slice(0, 80))
}

// ============== 6. send-questionnaire ==============
log('\n=== TEST: send-questionnaire ===')

if (wed?.id) {
  // 6a. no auth
  const noAuth = await callFn('send-questionnaire', { entry_id: wed.id, couple_email: 'test+nq@mailinator.com' })
  record('send-questionnaire', 'no_auth', noAuth.status === 401, noAuth.status, noAuth.json?.error ?? '')

  // 6b. happy
  const testEmail = `test+nh-questionnaire-${Date.now()}@mailinator.com`
  const r = await callFn('send-questionnaire', {
    entry_id: wed.id,
    couple_email: testEmail,
    couple_name: 'Sposa Test & Sposo Test',
    message: 'Test notturno night-H'
  }, { token: wpToken })
  const pass = r.status === 200 && r.json?.ok
  record('send-questionnaire', 'happy', pass, r.status, JSON.stringify(r.json).slice(0, 200))
  if (pass) {
    fs.writeFileSync(path.join(ABS_RUN, 'emails', 'send-questionnaire.json'), JSON.stringify({ request: { entry_id: wed.id, couple_email: testEmail }, response: r.json }, null, 2))
    // cleanup: track invite_token
    const { data: cm } = await sb.from('wedding_couple_members').select('id, invite_token').eq('entry_id', wed.id).eq('email', testEmail).maybeSingle()
    if (cm) cleanup.couple_member_ids.push(cm.id)
  }

  // 6c. missing fields
  const r2 = await callFn('send-questionnaire', { entry_id: wed.id }, { token: wpToken })
  record('send-questionnaire', 'no_email', r2.status === 400, r2.status, r2.json?.error ?? '')

  // 6d. wedding not yours - try with random ID
  const r3 = await callFn('send-questionnaire', {
    entry_id: '11111111-1111-1111-1111-111111111111',
    couple_email: 'test@x.com',
  }, { token: wpToken })
  record('send-questionnaire', 'invalid_entry', r3.status === 404 || r3.status === 403, r3.status, r3.json?.error ?? '')
}

// ============== 7. invite-supplier ==============
log('\n=== TEST: invite-supplier ===')

// 7a. no auth
const inv0 = await callFn('invite-supplier', { email: 'x@y.com' })
record('invite-supplier', 'no_auth', inv0.status === 401 || inv0.status === 403, inv0.status, inv0.json?.error ?? '')

// 7b. happy path
const targetEmail = `test+nh-invite-${Date.now()}@mailinator.com`
const inv1 = await callFn('invite-supplier', { email: targetEmail, subrole: 'fotografo', message: 'Test notturno H' }, { token: wpToken })
const inv1Pass = inv1.status === 200 && inv1.json?.ok
record('invite-supplier', 'happy_new', inv1Pass, inv1.status, JSON.stringify(inv1.json).slice(0, 200))
if (inv1Pass && inv1.json?.invite_id) cleanup.invite_ids.push(inv1.json.invite_id)
fs.writeFileSync(path.join(ABS_RUN, 'emails', 'invite-supplier.json'), JSON.stringify({ request: { email: targetEmail }, response: inv1.json }, null, 2))

// 7c. invalid email
const inv2 = await callFn('invite-supplier', { email: 'not an email' }, { token: wpToken })
record('invite-supplier', 'invalid_email', inv2.status === 400, inv2.status, inv2.json?.error ?? '')

// 7d. invite existing supplier (forn-beta-fotografo)
const inv3 = await callFn('invite-supplier', { email: 'forn-beta-fotografo@planfully-demo.it', subrole: 'fotografo' }, { token: wpToken })
record('invite-supplier', 'existing_supplier', inv3.status === 200 || inv3.status === 409, inv3.status, JSON.stringify(inv3.json).slice(0, 150))

// 7e. missing email
const inv4 = await callFn('invite-supplier', { subrole: 'fotografo' }, { token: wpToken })
record('invite-supplier', 'no_email', inv4.status === 400, inv4.status, inv4.json?.error ?? '')

// ============== 8. upload-photo ==============
log('\n=== TEST: upload-photo ===')

// 8a. no auth
const up0 = await callFn('upload-photo', {})
record('upload-photo', 'no_auth', up0.status === 401, up0.status, up0.json?.error ?? '')

// 8b. wrong content-type (JSON instead of multipart)
const up1 = await callFn('upload-photo', { foo: 'bar' }, { token: wpToken })
record('upload-photo', 'wrong_content_type', up1.status === 400, up1.status, up1.json?.error ?? '')

// 8c. multipart but no file/no service - login as fornitore
const sbAnon2 = createClient(URL, ANON, { auth: { persistSession: false } })
const { data: fornSess } = await sbAnon2.auth.signInWithPassword({ email: 'forn-beta-fotografo@planfully-demo.it', password: PWD })
const fornToken = fornSess?.session?.access_token
if (fornToken) {
  // find a service of this fornitore
  const { data: svc } = await sb.from('services').select('id').eq('fornitore_id', fornSess.session.user.id).limit(1).maybeSingle()
  log('Forn service id:', svc?.id)

  // build a tiny PNG (1x1 transparent) as File
  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const form = new FormData()
  form.append('file', new Blob([pngBytes], { type: 'image/png' }), 'tiny.png')
  if (svc?.id) form.append('service_id', svc.id)
  const r = await fetch(`${URL}/functions/v1/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fornToken}`, apikey: ANON },
    body: form,
  })
  const text = await r.text()
  let json = null; try { json = JSON.parse(text) } catch {}
  const passUp = r.status === 200 && json?.ok
  record('upload-photo', 'happy_png_1x1', passUp, r.status, JSON.stringify(json ?? text).slice(0, 200))

  // 8d. unsupported mime: HEIC -> not allowed
  const heicForm = new FormData()
  heicForm.append('file', new Blob([Buffer.from('heic')], { type: 'image/heic' }), 'photo.heic')
  if (svc?.id) heicForm.append('service_id', svc.id)
  const rH = await fetch(`${URL}/functions/v1/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fornToken}`, apikey: ANON },
    body: heicForm,
  })
  const tH = await rH.text()
  let jH = null; try { jH = JSON.parse(tH) } catch {}
  record('upload-photo', 'unsupported_heic', rH.status === 400, rH.status, jH?.error ?? tH.slice(0, 100))

  // 8e. no service_id
  const noSvcForm = new FormData()
  noSvcForm.append('file', new Blob([pngBytes], { type: 'image/png' }), 'tiny.png')
  const rNS = await fetch(`${URL}/functions/v1/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fornToken}`, apikey: ANON },
    body: noSvcForm,
  })
  const jNS = await rNS.json().catch(() => null)
  record('upload-photo', 'no_service_id', rNS.status === 400, rNS.status, jNS?.error ?? '')

  // 8f. oversized (2MB+1) - simulate
  const bigForm = new FormData()
  const bigBytes = Buffer.alloc(2 * 1024 * 1024 + 100, 0xff) // > 2MB
  // valid jpg header bytes (start)
  bigBytes[0] = 0xff; bigBytes[1] = 0xd8; bigBytes[2] = 0xff
  bigForm.append('file', new Blob([bigBytes], { type: 'image/jpeg' }), 'big.jpg')
  if (svc?.id) bigForm.append('service_id', svc.id)
  const rB = await fetch(`${URL}/functions/v1/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fornToken}`, apikey: ANON },
    body: bigForm,
  })
  const jB = await rB.json().catch(() => null)
  record('upload-photo', 'oversized_2mb', rB.status === 400, rB.status, jB?.error ?? '')
} else {
  record('upload-photo', 'happy_png_1x1', false, 'SKIP', 'fornitore login failed')
}

// ============== 9. calendar-export-ics ==============
log('\n=== TEST: calendar-export-ics ===')

// 9a. no token
const ics0 = await callFn('calendar-export-ics', undefined, { method: 'GET', queryString: '' })
record('calendar-export-ics', 'no_token', ics0.status === 400, ics0.status, ics0.text?.slice(0, 60))

// 9b. invalid token
const ics1 = await callFn('calendar-export-ics', undefined, { method: 'GET', queryString: 'token=notavalidtoken123' })
record('calendar-export-ics', 'invalid_token', ics1.status === 401, ics1.status, ics1.text?.slice(0, 60))

// 9c. happy: crea un token export (UUID column)
const { randomUUID } = await import('node:crypto')
const exp = new Date(Date.now() + 30 * 86400 * 1000).toISOString()
const tokenStr = randomUUID()
await sb.from('calendar_export_tokens').insert({ user_id: wpId, token: tokenStr, expires_at: exp })
const ics2 = await callFn('calendar-export-ics', undefined, { method: 'GET', queryString: `token=${tokenStr}` })
const icsOk = ics2.status === 200 && (ics2.text?.includes('BEGIN:VCALENDAR') ?? false)
record('calendar-export-ics', 'happy', icsOk, ics2.status, `len=${ics2.text?.length} starts_with=${ics2.text?.slice(0, 30)}`)
if (icsOk) fs.writeFileSync(path.join(ABS_RUN, 'logs', 'calendar.ics'), ics2.text)

// cleanup
await sb.from('calendar_export_tokens').delete().eq('token', tokenStr)

// ============== 10. calendar-notify ==============
log('\n=== TEST: calendar-notify ===')

if (wed?.id) {
  // 10a. happy
  const cn = await callFn('calendar-notify', { entry_id: wed.id, event: 'entry_created' }, { token: wpToken })
  record('calendar-notify', 'happy', cn.status === 200, cn.status, JSON.stringify(cn.json).slice(0, 200))
  fs.writeFileSync(path.join(ABS_RUN, 'emails', 'calendar-notify.json'), JSON.stringify(cn.json, null, 2))

  // 10b. no body
  const cn1 = await callFn('calendar-notify', {})
  record('calendar-notify', 'no_entry_id', cn1.status === 400, cn1.status, cn1.json?.error ?? '')

  // 10c. invalid entry
  const cn2 = await callFn('calendar-notify', { entry_id: '00000000-0000-0000-0000-000000000000' })
  record('calendar-notify', 'invalid_entry', cn2.status === 404, cn2.status, cn2.json?.error ?? '')

  // 10d. method not allowed
  const cn3 = await callFn('calendar-notify', undefined, { method: 'GET' })
  record('calendar-notify', 'method_get', cn3.status === 405, cn3.status, cn3.json?.error ?? cn3.text?.slice(0, 60))
}

// ============== Save outputs ==============
fs.writeFileSync(path.join(ABS_RUN, 'fn-results.json'), JSON.stringify(results, null, 2))
fs.writeFileSync(path.join(ABS_RUN, 'bugs.json'), JSON.stringify(bugs, null, 2))

// Build REPORT.md
let report = `# Night-H Edge Functions Audit\n\nRun: ${new Date().toISOString()}\nWP: ${wpEmail} (id: ${wpId})\n\n`
for (const [fn, tests] of Object.entries(results)) {
  const passed = tests.filter(t => t.pass).length
  const failed = tests.filter(t => !t.pass).length
  report += `\n## ${fn}\n\n`
  report += `- Pass: ${passed} / ${tests.length}\n- Fail: ${failed}\n\n`
  report += `| Test | Status | Pass | Detail |\n|---|---|---|---|\n`
  for (const t of tests) {
    const detail = (t.detail ?? '').replace(/\|/g, '\\|').slice(0, 180)
    report += `| ${t.test} | ${t.status} | ${t.pass ? 'OK' : 'KO'} | ${detail} |\n`
  }
}
report += `\n\n## Bugs Found\n\n`
for (const b of bugs) report += `- **${b.fn}** / ${b.test} → ${b.status}: ${(b.detail ?? '').slice(0, 160)}\n`
fs.writeFileSync(path.join(ABS_RUN, 'REPORT.md'), report)

log('\n=== DONE ===')
log(`Report: ${path.join(ABS_RUN, 'REPORT.md')}`)
log(`Bugs: ${bugs.length}`)
log(`Cleanup: quotes=${cleanup.quote_ids.length} invites=${cleanup.invite_ids.length} couple=${cleanup.couple_member_ids.length}`)

// cleanup
if (cleanup.invite_ids.length) {
  await sb.from('supplier_invites').delete().in('id', cleanup.invite_ids)
}
if (cleanup.couple_member_ids.length) {
  await sb.from('wedding_couple_members').delete().in('id', cleanup.couple_member_ids)
}

fs.writeFileSync(path.join(ABS_RUN, 'cleanup.json'), JSON.stringify(cleanup, null, 2))
process.exit(0)
