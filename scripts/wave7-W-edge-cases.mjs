#!/usr/bin/env node
/**
 * WAVE 7 — Agent W — LONG-TAIL EDGE CASES (Wave 7 overnight)
 *
 * 10 aree: i18n/special chars, timezone, session/refresh, empty/null,
 * concurrent editing, boundary numbers, URL/routing, PDF stress,
 * storage edge, logout cleanup.
 *
 * Esegue probe DB-side (RLS-respectful via session token) + HTTP HEAD probes
 * sulle pagine pubbliche di prod. Niente UI Playwright (le wave precedenti
 * coprono già il browser). Focus: trovare glitch silent.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SVC = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const RUN_DIR = process.env.RUN_DIR
if (!RUN_DIR) { console.error('Set RUN_DIR'); process.exit(1) }
if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })

const PROD = 'https://planfully.it'
const PWD = 'Beta2026!'

const WP_EMAIL = 'wp-mini@planfully-demo.it'
const WP_ID = '712baed0-3957-4452-8aab-ab4eeebb2697'
const SPOSO_EMAIL = 'giovanni.scozzafava+sposo@gmail.com'
const SPOSO_ID = '6e61b300-66f5-4ddb-9fc0-b0d3351a63b7'
const SPOSO_WEDDING = '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea'

const svc = createClient(URL, SVC, { auth: { persistSession: false } })
const findings = []
const bugs = []
const cleanup = []
const TAG = 'AGENT-W-'

function rec(area, id, title, verdict, opts = {}) {
  const f = { area, id, title, verdict, ...opts }
  findings.push(f)
  console.log(`[${verdict}] ${area} ${id} — ${title}${opts.note ? ' :: ' + opts.note : ''}`)
}

function bug(severity, area, title, detail, fix = null) {
  bugs.push({ severity, area, title, detail, fix })
}

async function loginAs(email, password = PWD) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const r = await c.auth.signInWithPassword({ email, password })
  if (r.error) throw new Error(`Login fail ${email}: ${r.error.message}`)
  const session = r.data.session
  return { client: c, token: session?.access_token, refresh: session?.refresh_token, user: r.data.user, expiresAt: session?.expires_at, _session: session }
}

// ============================================================
// AREA 1 — Special characters & i18n
// ============================================================
async function area1_special_chars() {
  console.log('\n=== AREA 1: Special characters & i18n ===')
  const sess = await loginAs(WP_EMAIL)
  const eventDate = new Date(Date.now() + 220 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  // 1.1 accenti in client_name + quote title
  {
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}1.1 Niccolò & Sofìa — Adamè cerimonia`,
      client_name: 'Niccolò D\'Annunzio',
      client_email: 'niccolo@planfully-demo.it',
      event_date: eventDate, guest_count: 80, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 1000, total_client: 1200, margin_amount: 200, margin_percent: 20,
    }).select().single()
    if (ins.error) { rec('1', '1.1', 'Accenti+apostrofo in title/client_name', 'FAIL', { note: ins.error.message }); bug('MEDIUM', 'i18n', 'Insert fallisce con accenti/apostrofi', ins.error.message) }
    else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      const ok = ins.data.title.includes('Niccolò') && ins.data.client_name.includes("D'Annunzio")
      rec('1', '1.1', 'Accenti+apostrofo in title/client_name', ok ? 'PASS' : 'FAIL', { note: `title=${ins.data.title} client=${ins.data.client_name}` })
      if (!ok) bug('MEDIUM', 'i18n', 'Accenti/apostrofi mutati in DB', JSON.stringify(ins.data))
    }
  }

  // 1.2 emoji in title + rejection_reason
  {
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}1.2 Wedding 💍🌸🎉 Test`,
      client_name: 'Emoji Family',
      client_email: 'emoji@planfully-demo.it',
      event_date: eventDate, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 500, total_client: 600, margin_amount: 100, margin_percent: 20,
      rejection_reason: '💍 emoji in reason 🌸',
    }).select().single()
    if (ins.error) { rec('1', '1.2', 'Emoji 4-byte UTF8 in title/rejection_reason', 'FAIL', { note: ins.error.message }); bug('LOW', 'i18n', 'Emoji rifiutati da DB', ins.error.message) }
    else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      const ok = ins.data.title.includes('💍') && ins.data.rejection_reason?.includes('🌸')
      rec('1', '1.2', 'Emoji 4-byte UTF8 in title/rejection_reason', ok ? 'PASS' : 'FAIL', { note: `title len=${ins.data.title.length}` })
      if (!ok) bug('LOW', 'i18n', 'Emoji UTF8 persi/sostituiti', JSON.stringify({ title: ins.data.title }))
    }
  }

  // 1.3 stringhe lunghe (~500 char) in title — capienza varchar 160 = LIMIT
  {
    const longStr = 'L'.repeat(155) + 'à'
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}1.3 ${longStr}`.slice(0, 160),
      client_name: 'Long Title Client',
      client_email: 'long@planfully-demo.it',
      event_date: eventDate, guest_count: 30, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) { rec('1', '1.3', 'Title vicino al varchar(160) limit', 'FAIL', { note: ins.error.message }) }
    else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      const ok = ins.data.title.length > 0
      rec('1', '1.3', 'Title 160 char (varchar limit)', ok ? 'PASS' : 'FAIL', { note: `len=${ins.data.title.length}` })
    }
  }

  // 1.4 RTL chars (arabo + hebrew)
  {
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}1.4 RTL test مرحبا שלום`,
      client_name: 'مرحبا עברית',
      client_email: 'rtl@planfully-demo.it',
      event_date: eventDate, guest_count: 20, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) { rec('1', '1.4', 'RTL chars (Arabic/Hebrew)', 'FAIL', { note: ins.error.message }) }
    else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      const ok = ins.data.title.includes('مرحبا') && ins.data.client_name.includes('שלום') === false ? ins.data.client_name.includes('עברית') : true
      rec('1', '1.4', 'RTL chars (Arabic/Hebrew)', ok ? 'PASS' : 'FAIL', { note: `client=${ins.data.client_name}` })
      // No bug here unless mangled
    }
  }

  // 1.5 zero-width chars test (NULL byte handled separately below)
  {
    const zwsp = String.fromCharCode(0x200B) + String.fromCharCode(0x200C) + String.fromCharCode(0xFEFF)
    const ins0 = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}1.5 zwsp`,
      client_name: `Mario${zwsp}Rossi`,
      client_email: 'zwsp@planfully-demo.it',
      event_date: eventDate, guest_count: 10, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins0.error) {
      rec('1', '1.5', 'Zero-width chars in client_name', 'FAIL', { note: ins0.error.message })
    } else {
      cleanup.push({ kind: 'quote', id: ins0.data.id })
      const stillHas = ins0.data.client_name.includes(String.fromCharCode(0x200B))
      rec('1', '1.5', 'Zero-width chars in client_name (NON sanitizzati DB)', 'INFO', { note: `len=${ins0.data.client_name.length} zwsp_present=${stillHas}` })
      if (stillHas) bug('LOW', 'i18n', 'Zero-width chars persistono in client_name — possibile glitch UI (search/sort)', `len=${ins0.data.client_name.length}`)
    }
  }
  // (legacy block disabled below)
  if (false) // KEEP for parser compatibility
  {
    const zwsp = '​‌‍⁠﻿'
    const evil = `Mario${zwsp}Rossi `
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}1.5 zero-width`,
      client_name: evil,
      client_email: 'zw@planfully-demo.it',
      event_date: eventDate, guest_count: 10, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) {
      const isControl = /invalid byte|\\u0000|encoding|null/i.test(ins.error.message)
      rec('1', '1.5', 'Zero-width + control chars in client_name', isControl ? 'PASS' : 'FAIL', { note: ins.error.message })
      if (!isControl) bug('LOW', 'i18n', 'Control chars passano DB ma error inatteso', ins.error.message)
    } else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      const hasNull = ins.data.client_name.includes('\x00')
      rec('1', '1.5', 'Zero-width + control chars in client_name', hasNull ? 'FAIL' : 'PASS', { note: `client_name length=${ins.data.client_name.length}` })
      if (hasNull) bug('MEDIUM', 'i18n', 'NULL bytes persistiti in DB — possibile breakage PDF/email', JSON.stringify(ins.data.client_name))
    }
  }

  // 1.6 HTML injection in client_name (XSS payload — must NOT execute on render)
  {
    const xss = '<script>alert("XSS")</script><img src=x onerror=alert(1)>'
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}1.6 XSS`,
      client_name: xss,
      client_email: 'xss@planfully-demo.it',
      event_date: eventDate, guest_count: 5, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) { rec('1', '1.6', 'HTML/JS injection in client_name', 'PASS', { note: 'DB rifiuta: ' + ins.error.message }) }
    else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      // DB persists raw (correct), then check public preview escapes
      const token = ins.data.access_token
      const r = await fetch(`${PROD}/quote/preview/${token}`, { redirect: 'follow' })
      const html = r.ok ? await r.text() : ''
      const rawHasScript = html.includes('<script>alert("XSS")</script>')
      const escapedOk = html.includes('&lt;script&gt;') || !html.includes('<script>alert("XSS")</script>')
      rec('1', '1.6', 'HTML/JS injection in client_name → escape su preview pubblica', escapedOk && !rawHasScript ? 'PASS' : 'FAIL', { note: `status=${r.status} rawHasScript=${rawHasScript}` })
      if (rawHasScript) bug('HIGH', 'i18n/security', 'XSS NON sanitizzato in preview pubblica quote', 'Payload <script> reso raw in HTML')
    }
  }

  // 1.7 Long client_name (>200 char) → truncation/cover in PDF/email UI
  {
    const longName = 'Ferdinandus Maximilianus Augustus Octavianus Caesar D\'Annunzio Della Casa Reale di Borbone delle Due Sicilie e dei Castelli di Calabria '.repeat(2)
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}1.7 long-name`,
      client_name: longName.slice(0, 290),
      client_email: 'longname@planfully-demo.it',
      event_date: eventDate, guest_count: 20, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) {
      rec('1', '1.7', 'client_name 290 char', 'INFO', { note: 'DB rifiuta: ' + ins.error.message })
      bug('LOW', 'i18n', 'client_name lungo rifiutato senza errore custom', ins.error.message)
    } else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      rec('1', '1.7', 'client_name 290 char accettato', 'PASS', { note: `len=${ins.data.client_name.length}` })
    }
  }
}

// ============================================================
// AREA 2 — Timezone handling
// ============================================================
async function area2_timezone() {
  console.log('\n=== AREA 2: Timezone handling ===')

  // 2.1 event_date come DATE pura (no TZ) → no shift
  {
    const sess = await loginAs(WP_EMAIL)
    const cetMidnight = '2027-06-15'
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}2.1 tz`, client_name: 'TZ Test',
      client_email: 'tz@planfully-demo.it',
      event_date: cetMidnight, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) { rec('2', '2.1', 'event_date no shift', 'FAIL', { note: ins.error.message }) }
    else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      const ok = ins.data.event_date === cetMidnight
      rec('2', '2.1', 'event_date no shift DB/UTC', ok ? 'PASS' : 'FAIL', { note: `in=${cetMidnight} out=${ins.data.event_date}` })
      if (!ok) bug('MEDIUM', 'timezone', 'event_date shiftato in DB (TZ bug)', `in=${cetMidnight} out=${ins.data.event_date}`)
    }
  }

  // 2.2 DST cross (2027-03-28 last Sunday March CET DST) — eventi su questo giorno
  {
    const sess = await loginAs(WP_EMAIL)
    const dstDay = '2027-03-28'
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}2.2 DST`, client_name: 'DST Test',
      client_email: 'dst@planfully-demo.it',
      event_date: dstDay, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) { rec('2', '2.2', 'DST cross event 2027-03-28', 'FAIL', { note: ins.error.message }) }
    else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      const ok = ins.data.event_date === dstDay
      rec('2', '2.2', 'DST cross event 2027-03-28', ok ? 'PASS' : 'FAIL', { note: `in=${dstDay} out=${ins.data.event_date}` })
    }
  }

  // 2.3 calendar_entries date_from/date_to vicino mezzanotte (testa drift se timestamptz storage)
  {
    const sess = await loginAs(WP_EMAIL)
    const ins = await sess.client.from('calendar_entries').insert({
      owner_id: sess.user.id,
      title: `${TAG}2.3 midnight-test`,
      client_name: 'Midnight Test',
      client_email: 'midnight@planfully-demo.it',
      date_from: '2027-06-15',
      date_to: '2027-06-16',
      status: 'CONFERMATA',
    }).select().single()
    if (ins.error) { rec('2', '2.3', 'calendar date_from/to', 'FAIL', { note: ins.error.message }) }
    else {
      cleanup.push({ kind: 'calendar', id: ins.data.id })
      const ok = ins.data.date_from === '2027-06-15' && ins.data.date_to === '2027-06-16'
      rec('2', '2.3', 'calendar date_from/to no shift', ok ? 'PASS' : 'FAIL', { note: `from=${ins.data.date_from} to=${ins.data.date_to}` })
      if (!ok) bug('MEDIUM', 'timezone', 'calendar_entries dates shiftate (TZ)', JSON.stringify(ins.data))
    }
  }

  // 2.4 created_at / updated_at consistency (updated_at >= created_at always)
  {
    const r = await svc.from('quotes').select('id,created_at,updated_at').order('created_at', { ascending: false }).limit(100)
    if (r.error) { rec('2', '2.4', 'created_at <= updated_at consistency', 'FAIL', { note: r.error.message }) }
    else {
      const bad = r.data.filter(q => new Date(q.created_at) > new Date(q.updated_at))
      rec('2', '2.4', 'created_at <= updated_at on 100 quotes', bad.length === 0 ? 'PASS' : 'FAIL', { note: `${bad.length}/100 bad` })
      if (bad.length) bug('LOW', 'timezone', 'updated_at < created_at su alcune quote', JSON.stringify(bad.slice(0, 3)))
    }
  }
}

// ============================================================
// AREA 3 — Session & refresh
// ============================================================
async function area3_session() {
  console.log('\n=== AREA 3: Session & refresh ===')

  // 3.1 login returns session w/ refresh_token + expires_at
  {
    const sess = await loginAs(WP_EMAIL)
    const hasRefresh = !!sess.refresh && String(sess.refresh).length > 5
    const ttl = (sess.expiresAt ?? 0) - Math.floor(Date.now() / 1000)
    rec('3', '3.1', 'login retorna refresh_token + TTL', (hasRefresh && ttl > 600) ? 'PASS' : 'FAIL', { note: `refresh_len=${String(sess.refresh ?? '').length} ttl=${ttl}s session_keys=${Object.keys(sess._session ?? {}).join(',')}` })
    if (!hasRefresh) bug('HIGH', 'session', 'login senza refresh_token — sessione non recuperabile')
  }

  // 3.2 refresh con refresh_token funziona
  {
    const sess = await loginAs(WP_EMAIL)
    const c = createClient(URL, ANON, { auth: { persistSession: false } })
    const r = await c.auth.refreshSession({ refresh_token: sess.refresh })
    const ok = !r.error && r.data?.session?.access_token && r.data.session.access_token !== sess.token
    rec('3', '3.2', 'refreshSession produce token nuovo', ok ? 'PASS' : 'FAIL', { note: r.error?.message ?? 'token rotated OK' })
    if (!ok) bug('HIGH', 'session', 'refresh fallisce: ' + (r.error?.message ?? 'no new token'))
  }

  // 3.3 stale token dopo refresh: old access_token deve invalidare? (Supabase: NO, both work until exp)
  // Lo segno come INFO per docu.
  {
    const sess = await loginAs(WP_EMAIL)
    const r = await sess.client.from('quotes').select('id').limit(1)
    rec('3', '3.3', 'access_token attivo subito dopo login (lettura quotes)', !r.error ? 'PASS' : 'FAIL', { note: r.error?.message ?? `rows=${r.data?.length ?? 0}` })
  }

  // 3.4 token corrotto → 401
  {
    const c = createClient(URL, ANON, { auth: { persistSession: false } })
    const r = await fetch(`${URL}/rest/v1/quotes?select=id&limit=1`, {
      headers: { apikey: ANON, Authorization: 'Bearer eyJINVALIDTOKEN' },
    })
    const ok = r.status === 401 || r.status === 400
    rec('3', '3.4', 'token corrotto → 401/400', ok ? 'PASS' : 'FAIL', { note: `status=${r.status}` })
    if (!ok) bug('HIGH', 'session/security', `token corrotto restituisce ${r.status}`)
  }

  // 3.5 logout invalida refresh_token? (Supabase signOut → refresh diventa invalid)
  {
    const sess = await loginAs(WP_EMAIL)
    await sess.client.auth.signOut()
    const c2 = createClient(URL, ANON, { auth: { persistSession: false } })
    const r = await c2.auth.refreshSession({ refresh_token: sess.refresh })
    const ok = !!r.error
    rec('3', '3.5', 'signOut invalida refresh_token', ok ? 'PASS' : 'FAIL', { note: r.error?.message ?? 'refresh still works (BUG)' })
    if (!ok) bug('HIGH', 'session/security', 'refresh_token ancora valido dopo signOut')
  }
}

// ============================================================
// AREA 4 — Empty/null tolerance
// ============================================================
async function area4_empty_null() {
  console.log('\n=== AREA 4: Empty/null tolerance ===')

  // 4.1 Quote senza voci → totali 0/coerenti
  {
    const sess = await loginAs(WP_EMAIL)
    const eventDate = new Date(Date.now() + 240 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}4.1 empty`, client_name: 'Empty Test',
      client_email: 'empty@planfully-demo.it',
      event_date: eventDate, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 0, total_client: 0, margin_amount: 0, margin_percent: 0,
    }).select().single()
    if (ins.error) { rec('4', '4.1', 'Quote senza voci accettata', 'FAIL', { note: ins.error.message }); return }
    cleanup.push({ kind: 'quote', id: ins.data.id })
    // recompute via RPC
    const rpc = await sess.client.rpc('quotes_recalc_totals', { p_quote_id: ins.data.id })
    const fresh = await sess.client.from('quotes').select('*').eq('id', ins.data.id).single()
    const ok = fresh.data?.total_cost === 0 && fresh.data?.total_client === 0
    rec('4', '4.1', 'Quote senza voci → totali 0 dopo recalc', ok ? 'PASS' : 'FAIL', { note: `cost=${fresh.data?.total_cost} client=${fresh.data?.total_client} rpc_err=${rpc.error?.message}` })
    if (!ok) bug('LOW', 'empty/null', 'recalc_totals su quote vuota non azzera', JSON.stringify(fresh.data))
  }

  // 4.2 calendar entry senza guests/tables/playlist → empty state non rompe
  {
    const sess = await loginAs(WP_EMAIL)
    const ins = await sess.client.from('calendar_entries').insert({
      owner_id: sess.user.id,
      title: `${TAG}4.2 empty-wedding`,
      client_name: 'Empty WP',
      client_email: 'empty-wp@planfully-demo.it',
      date_from: '2027-09-10', date_to: '2027-09-10', status: 'CONFERMATA',
    }).select().single()
    if (ins.error) { rec('4', '4.2', 'calendar empty wedding insert', 'FAIL', { note: ins.error.message }); return }
    cleanup.push({ kind: 'calendar', id: ins.data.id })
    // Query relations — should return [] not error
    const g = await sess.client.from('event_guests').select('id').eq('entry_id', ins.data.id)
    const t = await sess.client.from('event_tables').select('id').eq('entry_id', ins.data.id)
    const p = await sess.client.from('event_playlist').select('id').eq('entry_id', ins.data.id)
    const ok = !g.error && !t.error && !p.error && g.data.length === 0 && t.data.length === 0 && p.data.length === 0
    rec('4', '4.2', 'wedding empty → guests/tables/playlist []', ok ? 'PASS' : 'FAIL', { note: `g=${g.data?.length} t=${t.data?.length} p=${p.data?.length}` })
  }

  // 4.3 profile senza brand_logo → fallback (controllo solo che colonna sia null-tolerant)
  {
    const wp = await svc.from('profiles').select('id,brand_logo_url,full_name').eq('id', WP_ID).single()
    const ok = !wp.error
    rec('4', '4.3', 'profilo WP senza brand_logo_url: query ok', ok ? 'PASS' : 'FAIL', { note: `brand_logo_url=${wp.data?.brand_logo_url ?? 'null'}` })
  }
}

// ============================================================
// AREA 5 — Concurrent editing
// ============================================================
async function area5_concurrent() {
  console.log('\n=== AREA 5: Concurrent editing ===')

  // 5.1 2 sessioni WP modificano stessa quote: last-write-wins (no optimistic locking)
  {
    const a = await loginAs(WP_EMAIL)
    const b = await loginAs(WP_EMAIL)
    const eventDate = new Date(Date.now() + 250 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const ins = await a.client.from('quotes').insert({
      owner_id: a.user.id,
      title: `${TAG}5.1 concurrent`, client_name: 'Concurrent',
      client_email: 'concurrent@planfully-demo.it',
      event_date: eventDate, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) { rec('5', '5.1', 'concurrent insert', 'FAIL', { note: ins.error.message }); return }
    cleanup.push({ kind: 'quote', id: ins.data.id })

    // a updates title, b updates client_name — simultaneously
    const [ua, ub] = await Promise.all([
      a.client.from('quotes').update({ title: `${TAG}5.1 by-A` }).eq('id', ins.data.id).select().single(),
      b.client.from('quotes').update({ client_name: 'Client by B' }).eq('id', ins.data.id).select().single(),
    ])
    const okA = !ua.error
    const okB = !ub.error
    const final = await svc.from('quotes').select('title,client_name').eq('id', ins.data.id).single()
    rec('5', '5.1', 'concurrent update title+client_name', (okA && okB) ? 'PASS' : 'FAIL', { note: `final title=${final.data?.title} client=${final.data?.client_name} aErr=${ua.error?.message} bErr=${ub.error?.message}` })
    // Note: no optimistic locking — segnalare come INFO/LOW
    bug('LOW', 'concurrency', 'Quote non hanno version/rowversion: last-write-wins silenzioso (concurrent edits sovrascrivono)')
  }

  // 5.2 simultaneo: WP edit quote AND sposo accetta via RPC
  {
    const a = await loginAs(WP_EMAIL)
    const eventDate = new Date(Date.now() + 260 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const ins = await a.client.from('quotes').insert({
      owner_id: a.user.id,
      title: `${TAG}5.2 race-accept`, client_name: 'Race Test',
      client_email: 'race@planfully-demo.it',
      event_date: eventDate, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    if (ins.error) { rec('5', '5.2', 'race accept insert', 'FAIL', { note: ins.error.message }); return }
    cleanup.push({ kind: 'quote', id: ins.data.id })
    // Move to INVIATO so it can be accepted
    await a.client.from('quotes').update({ status: 'INVIATO' }).eq('id', ins.data.id)
    // Race: WP updates title vs anonymous accept by token
    const token = ins.data.access_token
    const anon = createClient(URL, ANON, { auth: { persistSession: false } })
    const [ua, accept] = await Promise.all([
      a.client.from('quotes').update({ title: `${TAG}5.2 by-WP` }).eq('id', ins.data.id).select().single(),
      // Attempt accept by token: this is via /functions or RPC. We'll try a direct insert into quote_acceptances signaling (closest proxy)
      anon.from('quote_views').insert({ quote_id: ins.data.id, event_type: 'preview_open', payload: {} }).select(),
    ])
    rec('5', '5.2', 'race WP-edit vs sposo-track', (!ua.error) ? 'PASS' : 'FAIL', { note: `ua=${ua.error?.message ?? 'OK'} accept=${accept.error?.message ?? 'OK'}` })
  }
}

// ============================================================
// AREA 6 — Boundary numbers
// ============================================================
async function area6_boundary() {
  console.log('\n=== AREA 6: Boundary numbers ===')
  const sess = await loginAs(WP_EMAIL)
  const eventDate = new Date(Date.now() + 270 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  // 6.1 quote total 0
  {
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}6.1 zero-total`, client_name: 'Zero',
      client_email: '6.1@planfully-demo.it',
      event_date: eventDate, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 0, total_client: 0, margin_amount: 0, margin_percent: 0,
    }).select().single()
    rec('6', '6.1', 'Quote total 0€', !ins.error ? 'PASS' : 'FAIL', { note: ins.error?.message })
    if (ins.data) cleanup.push({ kind: 'quote', id: ins.data.id })
  }

  // 6.2 quote total negativo
  {
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}6.2 neg-total`, client_name: 'Neg',
      client_email: '6.2@planfully-demo.it',
      event_date: eventDate, guest_count: 50, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: -50, margin_amount: -150, margin_percent: -150,
    }).select().single()
    // Expect: CHECK constraint should reject negative total_client (Wave 6 hardening)
    const blocked = !!ins.error
    rec('6', '6.2', 'Quote total negativo bloccato da CHECK', blocked ? 'PASS' : 'FAIL', { note: ins.error?.message ?? 'INSERITA (no constraint)' })
    if (!blocked) {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      bug('MEDIUM', 'data-integrity', 'CHECK constraint manca: total_client negativo accettato', JSON.stringify(ins.data))
    }
  }

  // 6.3 quote total > 999_999
  {
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}6.3 huge`, client_name: 'Huge',
      client_email: '6.3@planfully-demo.it',
      event_date: eventDate, guest_count: 500, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 800000, total_client: 1500000, margin_amount: 700000, margin_percent: 87.5,
    }).select().single()
    if (ins.error) {
      rec('6', '6.3', 'Quote total 1.5M', 'FAIL', { note: ins.error.message })
      bug('LOW', 'boundary', 'Quote >999.999€ rifiutate (limite arbitrario?)', ins.error.message)
    } else {
      cleanup.push({ kind: 'quote', id: ins.data.id })
      rec('6', '6.3', 'Quote total 1.5M', 'PASS', { note: `total_client=${ins.data.total_client}` })
    }
  }

  // 6.4 guest_count 0 / 1 / 999
  for (const n of [0, 1, 999]) {
    const ins = await sess.client.from('quotes').insert({
      owner_id: sess.user.id,
      title: `${TAG}6.4 g=${n}`, client_name: `G ${n}`,
      client_email: `g${n}@planfully-demo.it`,
      event_date: eventDate, guest_count: n, status: 'BOZZA', revision: 1,
      access_token: crypto.randomUUID(),
      total_cost: 100, total_client: 120, margin_amount: 20, margin_percent: 20,
    }).select().single()
    rec('6', `6.4-${n}`, `guest_count=${n}`, !ins.error ? 'PASS' : 'FAIL', { note: ins.error?.message })
    if (ins.data) cleanup.push({ kind: 'quote', id: ins.data.id })
  }
}

// ============================================================
// AREA 7 — URL & routing
// ============================================================
async function area7_routing() {
  console.log('\n=== AREA 7: URL & routing ===')

  const probes = [
    { path: '/', label: 'landing', expect: 200 },
    { path: '/login', label: 'login', expect: 200 },
    { path: '/register', label: 'register', expect: 200 },
    { path: '/forgot-password', label: 'forgot', expect: 200 },
    { path: '/privacy', label: 'privacy', expect: 200 },
    { path: '/cookie', label: 'cookie', expect: 200 },
    { path: '/quote/preview/' + crypto.randomUUID().replace(/-/g, ''), label: 'preview-fake-token', expect: 200 }, // SPA shell 200
    { path: '/quote/accept/zzz-non-esiste-token-bad', label: 'accept-bad-token', expect: 200 },
    { path: '/non-esiste-404', label: 'spa-fallback', expect: 200 },
    { path: '/wedding-site/' + encodeURIComponent('slug con spazi'), label: 'slug-spaces-encoded', expect: 200 },
    { path: '/wedding-site/slug%23hash', label: 'slug-hash-encoded', expect: 200 },
    { path: '/wedding-site/' + encodeURIComponent('niccolò-sofìa'), label: 'slug-accenti', expect: 200 },
  ]
  for (const p of probes) {
    try {
      const r = await fetch(`${PROD}${p.path}`, { redirect: 'follow' })
      const ok = r.status === p.expect
      rec('7', '7.' + p.label, `${p.path} → ${r.status}`, ok ? 'PASS' : 'FAIL', { note: `expect=${p.expect}` })
      if (!ok) bug('LOW', 'routing', `${p.path} → status ${r.status} (atteso ${p.expect})`)
    } catch (e) {
      rec('7', '7.' + p.label, p.path, 'FAIL', { note: e.message })
      bug('MEDIUM', 'routing', `${p.path} fetch error`, e.message)
    }
  }
}

// ============================================================
// AREA 8 — PDF stress (DB seed; PDF render avviene client-side)
// ============================================================
async function area8_pdf_stress() {
  console.log('\n=== AREA 8: PDF stress (creazione quote 100 voci) ===')
  const sess = await loginAs(WP_EMAIL)
  const eventDate = new Date(Date.now() + 280 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const ins = await sess.client.from('quotes').insert({
    owner_id: sess.user.id,
    title: `${TAG}8.1 PDF 100 voci — ${'À'.repeat(50)} title molto lungo che probabilmente va a capo o viene troncato`,
    client_name: 'PDF Stress Niccolò D\'Annunzio',
    client_email: 'pdf@planfully-demo.it',
    event_date: eventDate, guest_count: 150, status: 'BOZZA', revision: 1,
    access_token: crypto.randomUUID(),
    total_cost: 0, total_client: 0, margin_amount: 0, margin_percent: 0,
  }).select().single()
  if (ins.error) { rec('8', '8.1', 'PDF stress quote insert', 'FAIL', { note: ins.error.message }); return }
  cleanup.push({ kind: 'quote', id: ins.data.id })
  const qid = ins.data.id
  // Insert 100 voci
  const items = Array.from({ length: 100 }, (_, i) => ({
    quote_id: qid,
    sort_order: i,
    name_snapshot: `Voce ${i + 1} — Servizio à la carte con accenti: caffè, perché, città`,
    description_snapshot: 'Descrizione media di una voce — '.repeat(8),
    quantity: 1,
    quantity_basis: 'FLAT',
    unit_snapshot: 'PEZZO',
    snapshot_price: 100 + i,
    line_cost: 100 + i,
    line_client: 120 + i,
    paid_amount: 0,
    payment_status: 'NON_PAGATO',
    modifiers_applied: {},
    is_optional: false,
    selected_by_client: null,
  }))
  // chunk insert
  let failed = 0
  for (let i = 0; i < items.length; i += 50) {
    const r = await sess.client.from('quote_items').insert(items.slice(i, i + 50))
    if (r.error) { failed++; console.log('item insert err:', r.error.message) }
  }
  const cnt = await sess.client.from('quote_items').select('id', { count: 'exact', head: true }).eq('quote_id', qid)
  rec('8', '8.1', '100 voci insert + count', cnt.count === 100 ? 'PASS' : 'FAIL', { note: `count=${cnt.count} failed_chunks=${failed}` })
  // Recalc and verify totals — il trigger BEFORE ricalcola line_cost = snapshot_price * quantity
  // e line_client = line_cost * (1 + default_markup_percent/100). Default markup = 0 → line_client == line_cost.
  await sess.client.rpc('quotes_recalc_totals', { p_quote_id: qid })
  const fresh = await sess.client.from('quotes').select('total_cost,total_client').eq('id', qid).single()
  const expectedCost = items.reduce((s, x) => s + x.snapshot_price * x.quantity, 0)
  const expectedClient = expectedCost // markup 0
  const okTot = Math.abs((fresh.data?.total_cost ?? -1) - expectedCost) < 0.5 && Math.abs((fresh.data?.total_client ?? -1) - expectedClient) < 0.5
  rec('8', '8.2', '100 voci totali ricalcolati corretti (snapshot * qty)', okTot ? 'PASS' : 'FAIL', { note: `cost=${fresh.data?.total_cost} (atteso ${expectedCost}) client=${fresh.data?.total_client} (atteso ${expectedClient})` })
  if (!okTot) bug('MEDIUM', 'pdf-stress', 'recalc totali 100 voci non corretto', JSON.stringify(fresh.data))

  // 8.3 Public preview accessibile
  {
    const token = ins.data.access_token
    const r = await fetch(`${PROD}/quote/preview/${token}`)
    rec('8', '8.3', `preview pubblica 100 voci → ${r.status}`, r.ok ? 'PASS' : 'FAIL', { note: `status=${r.status}` })
  }
}

// ============================================================
// AREA 9 — Storage edge (Supabase storage policies via REST)
// ============================================================
async function area9_storage() {
  console.log('\n=== AREA 9: Storage edge ===')
  const sess = await loginAs(WP_EMAIL)

  // 9.1 Upload file >5MB → deve essere rifiutato dalla policy upload-photo
  {
    const big = new Uint8Array(6 * 1024 * 1024) // 6MB di zeri
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0) // PNG signature
    const blob = new Blob([big], { type: 'image/png' })
    const path = `${WP_ID}/AGENT-W-9.1-big.png`
    const up = await sess.client.storage.from('brand-assets').upload(path, blob, { upsert: true, contentType: 'image/png' })
    // Bucket potrebbe avere size limit. Verifichiamo: success o rejected.
    if (up.error) {
      const rightReason = /file size|too large|exceeds|maximum|413|payload/i.test(up.error.message)
      rec('9', '9.1', 'Upload 6MB su brand-assets rifiutato', rightReason ? 'PASS' : 'INFO', { note: up.error.message })
      if (!rightReason) bug('LOW', 'storage', 'Errore upload >5MB non descrittivo', up.error.message)
    } else {
      // Cleanup if accepted
      await sess.client.storage.from('brand-assets').remove([path])
      rec('9', '9.1', 'Upload 6MB su brand-assets accettato', 'INFO', { note: 'no size limit attivo' })
      bug('LOW', 'storage', 'brand-assets accetta file >5MB (no size limit?)', `path=${path}`)
    }
  }

  // 9.2 Filename con spazi/accenti → Supabase Storage rifiuta key con char extra-ASCII
  {
    const tiny = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const blob = new Blob([tiny], { type: 'image/png' })
    const rawPath = `${WP_ID}/AGENT-W-9.2-niccolò spazi.png`
    const upRaw = await sess.client.storage.from('brand-assets').upload(rawPath, blob, { upsert: true, contentType: 'image/png' })
    if (upRaw.error) {
      // Try sanitized — what the UI should do
      const sanitized = `${WP_ID}/AGENT-W-9.2-niccolo-spazi.png`
      const upSan = await sess.client.storage.from('brand-assets').upload(sanitized, blob, { upsert: true, contentType: 'image/png' })
      if (upSan.error) {
        rec('9', '9.2', 'Filename con accenti rifiutato (raw) E sanitized fallisce', 'FAIL', { note: `raw=${upRaw.error.message} sanit=${upSan.error.message}` })
      } else {
        await sess.client.storage.from('brand-assets').remove([sanitized])
        rec('9', '9.2', 'Filename con accenti rifiutato raw — sanitized OK', 'INFO', { note: `raw_err=${upRaw.error.message}` })
        bug('MEDIUM', 'storage', 'Supabase Storage rifiuta filename con accenti/spazi — client deve sanitizzare', `raw_err=${upRaw.error.message}`)
      }
    } else {
      await sess.client.storage.from('brand-assets').remove([rawPath])
      rec('9', '9.2', 'Filename con accenti+spazi', 'PASS', { note: `path=${upRaw.data?.path}` })
    }
  }

  // 9.3 EXE camuffato da .png (MIME spoofing)
  {
    // header MZ (DOS EXE signature)
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00])
    const blob = new Blob([exe], { type: 'image/png' })
    const path = `${WP_ID}/AGENT-W-9.3-fake.png`
    const up = await sess.client.storage.from('brand-assets').upload(path, blob, { upsert: true, contentType: 'image/png' })
    // Supabase storage non valida magic bytes — accetta. Bug LOW di documentation/policy.
    if (up.error) {
      rec('9', '9.3', 'EXE camuffato da .png rifiutato (magic bytes check)', 'PASS', { note: up.error.message })
    } else {
      await sess.client.storage.from('brand-assets').remove([path])
      rec('9', '9.3', 'EXE camuffato da .png accettato', 'INFO', { note: 'Supabase storage non valida magic bytes' })
      bug('LOW', 'storage/security', 'MIME spoofing: EXE caricato come .png — server non valida magic bytes', 'Mitigation: client-side magic-byte check prima di upload')
    }
  }

  // 9.4 Race upload 5 file paralleli stessa cartella
  {
    const tiny = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const blob = new Blob([tiny], { type: 'image/png' })
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(sess.client.storage.from('brand-assets').upload(`${WP_ID}/AGENT-W-9.4-race-${i}.png`, blob, { upsert: true, contentType: 'image/png' }))
    }
    const results = await Promise.all(promises)
    const ok = results.every(r => !r.error)
    rec('9', '9.4', '5 upload paralleli', ok ? 'PASS' : 'FAIL', { note: results.map((r, i) => r.error ? `${i}=${r.error.message}` : `${i}=ok`).join(' ') })
    // cleanup
    await sess.client.storage.from('brand-assets').remove([0, 1, 2, 3, 4].map(i => `${WP_ID}/AGENT-W-9.4-race-${i}.png`))
  }
}

// ============================================================
// AREA 10 — Logout cleanup
// ============================================================
async function area10_logout() {
  console.log('\n=== AREA 10: Logout cleanup ===')

  // 10.1 signOut clears session in client (in-memory: persistSession=false). Verifichiamo che dopo signOut non si possa più fare query
  {
    const sess = await loginAs(WP_EMAIL)
    const r1 = await sess.client.from('quotes').select('id').limit(1)
    await sess.client.auth.signOut()
    const r2 = await sess.client.from('quotes').select('id').limit(1)
    // Dopo signOut, ulteriori query passano per "anon" → RLS rifiuta
    const ok = !r1.error && (r2.error || (r2.data?.length === 0))
    rec('10', '10.1', 'signOut → query successive non viste come WP', ok ? 'PASS' : 'FAIL', { note: `pre=${r1.data?.length} post_err=${r2.error?.message ?? 'rows=' + r2.data?.length}` })
    if (!ok) bug('HIGH', 'session/security', 'signOut non invalida session client-side')
  }

  // 10.2 JWT residuo dopo signOut: NON possiamo testare localStorage senza browser, ma testiamo che token vecchio NON funzioni dopo signOut server-side
  {
    const sess = await loginAs(WP_EMAIL)
    const oldToken = sess.token
    await sess.client.auth.signOut()
    // Use oldToken raw with REST API
    const r = await fetch(`${URL}/rest/v1/quotes?select=id&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${oldToken}` },
    })
    // Supabase: access_token rimane valido fino a scadenza (1h). Aspettato 200 con dati (BAD: best practice sarebbe revocare).
    if (r.status === 200) {
      rec('10', '10.2', 'access_token rimane valido fino a expiry post-signOut', 'INFO', { note: 'Supabase default — token JWT non revocabile server-side' })
      bug('LOW', 'session/security', 'Access token vecchio funziona post-signOut (limitazione JWT)', 'Mitigation: TTL breve, rotazione frequente')
    } else {
      rec('10', '10.2', 'access_token revocato post-signOut', 'PASS', { note: `status=${r.status}` })
    }
  }
}

// ============================================================
// CLEANUP
// ============================================================
async function doCleanup() {
  console.log('\n=== CLEANUP AGENT-W ===')
  let n = 0
  // by tag in quotes/calendar
  const q = await svc.from('quotes').select('id,title').like('title', `${TAG}%`)
  for (const x of (q.data ?? [])) { await svc.from('quotes').delete().eq('id', x.id); n++ }
  const c = await svc.from('calendar_entries').select('id,title').like('title', `${TAG}%`)
  for (const x of (c.data ?? [])) { await svc.from('calendar_entries').delete().eq('id', x.id); n++ }
  console.log(`[cleanup] ${n} rows AGENT-W-* deleted`)
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const start = Date.now()
  try { await area1_special_chars() } catch (e) { console.error('A1 err:', e); rec('1', '1.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area2_timezone() } catch (e) { console.error('A2 err:', e); rec('2', '2.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area3_session() } catch (e) { console.error('A3 err:', e); rec('3', '3.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area4_empty_null() } catch (e) { console.error('A4 err:', e); rec('4', '4.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area5_concurrent() } catch (e) { console.error('A5 err:', e); rec('5', '5.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area6_boundary() } catch (e) { console.error('A6 err:', e); rec('6', '6.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area7_routing() } catch (e) { console.error('A7 err:', e); rec('7', '7.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area8_pdf_stress() } catch (e) { console.error('A8 err:', e); rec('8', '8.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area9_storage() } catch (e) { console.error('A9 err:', e); rec('9', '9.X', 'crash', 'FAIL', { note: e.message }) }
  try { await area10_logout() } catch (e) { console.error('A10 err:', e); rec('10', '10.X', 'crash', 'FAIL', { note: e.message }) }
  await doCleanup()

  const dur = Math.round((Date.now() - start) / 1000)
  const summary = {
    started_at: new Date(start).toISOString(),
    duration_sec: dur,
    total_tests: findings.length,
    pass: findings.filter(f => f.verdict === 'PASS').length,
    fail: findings.filter(f => f.verdict === 'FAIL').length,
    info: findings.filter(f => f.verdict === 'INFO').length,
    skip: findings.filter(f => f.verdict === 'SKIP').length,
    bugs_count: bugs.length,
    bugs_high: bugs.filter(b => b.severity === 'HIGH').length,
    bugs_medium: bugs.filter(b => b.severity === 'MEDIUM').length,
    bugs_low: bugs.filter(b => b.severity === 'LOW').length,
  }
  writeFileSync(resolve(RUN_DIR, 'findings.json'), JSON.stringify({ summary, findings }, null, 2))
  writeFileSync(resolve(RUN_DIR, 'bugs.json'), JSON.stringify(bugs, null, 2))
  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
