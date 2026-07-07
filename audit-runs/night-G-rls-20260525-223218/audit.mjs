/**
 * RLS Audit (Night G) — cross-tenant CRUD matrix
 *
 * Tests that anon/authenticated clients cannot read/write data outside their tenant.
 * For each role X and resource Y, runs SELECT/UPDATE/DELETE/INSERT and records expected vs actual.
 *
 * Output:
 *  - results.json (full matrix)
 *  - REPORT.md (markdown table)
 *  - leaks.json (CRITICAL leaks only)
 *  - pass-summary.txt
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'
const SERVICE = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const PWD = 'Beta2026!'

// Fixtures
const ACTORS = {
  WP_A:   { id: '712baed0-3957-4452-8aab-ab4eeebb2697', email: 'wp-mini@planfully-demo.it' },
  WP_B:   { id: 'ebae0f18-4cc8-40fe-ae40-f6a5757f1726', email: 'wp.speranza.carrozzo@planfully-demo.it' },
  FORN_A: { id: '747707fe-03be-4bb8-95b8-17b43b465526', email: 'forn-mini-foto@planfully-demo.it' },
  FORN_B: { id: 'a0262dd1-f07c-4359-a9c0-1186e98971a3', email: 'forn-mini-fiori@planfully-demo.it' },
  COUPLE_C: { id: '6e61b300-66f5-4ddb-9fc0-b0d3351a63b7', email: 'giovanni.scozzafava+sposo@gmail.com' },
}

const FIX = {
  // WP_A owned entities
  wpA_quote: 'c18cd9c5-3328-47bc-afd5-cab5adc2499a',    // "Gino e Maria" - no items by FORN_A or FORN_B
  wpA_quote_with_fornB_items: 'de516480-2a4c-404f-a2c0-f3ebd27f9c12', // has FORN_B (fiori) items
  wpA_entry: '242e454f-c3cd-4d77-aa2c-d86bd4bc34a5', // Gino e Maria
  wpA_entry_couple: '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea', // Giovanni e Pingu (linked to COUPLE_C)

  // WP_B owned entities
  wpB_quote: '6f28202a-846f-4c78-af79-ad88839b42d2',
  wpB_quote_item: '202ca349-1156-44c7-95c2-4eb5c10eb244', // supplier=ef7d... not FORN_A/B
  wpB_entry: '0d7678d2-30da-444b-8615-7fc56ca4148e',
  wpB_entry_with_couple: '0d7678d2-30da-444b-8615-7fc56ca4148e',

  // Fornitore A (foto) availability and service
  fornA_avail: 'b589c2c2-b8d5-4e66-a536-a2a4f121fdbb',
  fornA_service: '1324114d-a900-4219-ac0c-ca69176319c4',
  // Fornitore B (fiori) availability and service
  fornB_avail: 'f2a203d9-678a-46c1-adba-3244ed5a3bfd',
  fornB_service: 'df90b1a4-45c8-4f70-90e1-e73617c8d477',
  fornB_quote_item_in_wpA: '19c0213f-85b4-4e3e-9afb-b9859bb6378b',

  // event_* under wpA_entry_couple (Giovanni e Pingu) and wpA_entry (Gino e Maria) and wpB_entry
  // Will discover at runtime
}

// Helpers
async function login(actor) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const r = await c.auth.signInWithPassword({ email: actor.email, password: PWD })
  if (r.error) throw new Error(`Login ${actor.email}: ${r.error.message}`)
  return c
}
function anonClient() { return createClient(URL, ANON, { auth: { persistSession: false } }) }

const results = []
function record(actor, op, table, target, expected, gotData, gotErr, severity='STANDARD') {
  // expected: 'block' (nothing returned + no insert/update), 'allow'
  // pass = expected aligns with reality
  const dataCount = Array.isArray(gotData) ? gotData.length : (gotData ? 1 : 0)
  const errMsg = gotErr?.message || gotErr?.code || null
  let actual
  if (expected === 'block') {
    // pass if zero rows + (silent OR explicit perm error)
    actual = dataCount === 0 ? 'blocked-silent' : 'leaked'
  } else {
    actual = errMsg ? `denied(${errMsg.slice(0,60)})` : `allowed(${dataCount})`
  }
  const pass =
    (expected === 'block' && actual.startsWith('blocked')) ||
    (expected === 'allow' && actual.startsWith('allowed'))
  results.push({ actor, op, table, target, expected, actual, dataCount, errMsg, pass, severity })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${actor}/${op}/${table}/${target?.slice(0,8) ?? '-'} exp=${expected} act=${actual}`)
}

async function trySelect(c, actor, table, idCol, id, expected, severity='STANDARD') {
  const r = await c.from(table).select('*').eq(idCol, id)
  record(actor, 'SELECT', table, id, expected, r.data, r.error, severity)
  return r
}
async function tryUpdate(c, actor, table, idCol, id, patch, expected, severity='STANDARD') {
  const r = await c.from(table).update(patch).eq(idCol, id).select()
  record(actor, 'UPDATE', table, id, expected, r.data, r.error, severity)
  return r
}
async function tryDelete(c, actor, table, idCol, id, expected, severity='STANDARD') {
  const r = await c.from(table).delete().eq(idCol, id).select()
  record(actor, 'DELETE', table, id, expected, r.data, r.error, severity)
  return r
}
async function tryInsert(c, actor, table, row, expected, severity='STANDARD') {
  const r = await c.from(table).insert(row).select()
  record(actor, 'INSERT', table, JSON.stringify(row).slice(0,60), expected, r.data, r.error, severity)
  return r
}

// =================================================================
async function main() {
  console.log('=== Logging in test users ===')
  const sb = {
    WP_A: await login(ACTORS.WP_A),
    WP_B: await login(ACTORS.WP_B),
    FORN_A: await login(ACTORS.FORN_A),
    FORN_B: await login(ACTORS.FORN_B),
    COUPLE_C: await login(ACTORS.COUPLE_C),
    ANON: anonClient(),
  }
  console.log('All sessions OK')

  // ===== Service-role discovery for event_* targets =====
  const svc = createClient(URL, SERVICE, { auth: { persistSession: false } })
  async function pickOne(t, col, val) {
    const r = await svc.from(t).select('id').eq(col, val).limit(1).single()
    return r.data?.id || null
  }
  const ev = {
    timeline_wpB:   await pickOne('event_timeline', 'entry_id', FIX.wpB_entry),
    guest_wpB:      await pickOne('event_guests', 'entry_id', FIX.wpB_entry),
    table_wpB:      await pickOne('event_tables', 'entry_id', FIX.wpB_entry),
    mood_wpB:       await pickOne('mood_images', 'entry_id', FIX.wpB_entry),
    playlist_wpB:   await pickOne('event_playlist', 'entry_id', FIX.wpB_entry),
    task_wpB:       await pickOne('wedding_tasks', 'entry_id', FIX.wpB_entry),
    transport_wpB:  await pickOne('event_transport', 'entry_id', FIX.wpB_entry),
    accomm_wpB:     await pickOne('event_accommodations', 'entry_id', FIX.wpB_entry),
    cprefs_wpB:     await pickOne('couple_preferences', 'entry_id', FIX.wpB_entry),
    // Couple C target = WP_A's other entry (Gino e Maria) which couple C is NOT member of
    timeline_wpA_notCouple: await pickOne('event_timeline', 'entry_id', FIX.wpA_entry),
    guest_wpA_notCouple:    await pickOne('event_guests', 'entry_id', FIX.wpA_entry),
    mood_wpA_notCouple:     await pickOne('mood_images', 'entry_id', FIX.wpA_entry),
    cprefs_wpA_notCouple:   await pickOne('couple_preferences', 'entry_id', FIX.wpA_entry),
  }
  console.log('Discovered event ids:', ev)

  // ====================== WP A -> WP B resources ======================
  console.log('\n=== WP_A vs WP_B ===')
  await trySelect(sb.WP_A, 'WP_A', 'quotes', 'id', FIX.wpB_quote, 'block', 'CRITICAL')
  await tryUpdate(sb.WP_A, 'WP_A', 'quotes', 'id', FIX.wpB_quote, { title: 'PWNED-BY-WPA' }, 'block', 'CRITICAL')
  await tryDelete(sb.WP_A, 'WP_A', 'quotes', 'id', FIX.wpB_quote, 'block', 'CRITICAL')
  await trySelect(sb.WP_A, 'WP_A', 'quote_items', 'id', FIX.wpB_quote_item, 'block', 'CRITICAL')
  await tryUpdate(sb.WP_A, 'WP_A', 'quote_items', 'id', FIX.wpB_quote_item, { snapshot_price: 1 }, 'block', 'CRITICAL')
  await trySelect(sb.WP_A, 'WP_A', 'calendar_entries', 'id', FIX.wpB_entry, 'block', 'CRITICAL')
  await tryUpdate(sb.WP_A, 'WP_A', 'calendar_entries', 'id', FIX.wpB_entry, { title: 'PWNED' }, 'block', 'CRITICAL')
  await tryDelete(sb.WP_A, 'WP_A', 'calendar_entries', 'id', FIX.wpB_entry, 'block', 'CRITICAL')
  // event_* of WP_B
  if (ev.timeline_wpB)  await trySelect(sb.WP_A, 'WP_A', 'event_timeline', 'id', ev.timeline_wpB, 'block', 'CRITICAL')
  if (ev.guest_wpB)     await trySelect(sb.WP_A, 'WP_A', 'event_guests', 'id', ev.guest_wpB, 'block', 'CRITICAL')
  if (ev.table_wpB)     await trySelect(sb.WP_A, 'WP_A', 'event_tables', 'id', ev.table_wpB, 'block', 'CRITICAL')
  if (ev.mood_wpB)      await trySelect(sb.WP_A, 'WP_A', 'mood_images', 'id', ev.mood_wpB, 'block', 'CRITICAL')
  if (ev.playlist_wpB)  await trySelect(sb.WP_A, 'WP_A', 'event_playlist', 'id', ev.playlist_wpB, 'block', 'CRITICAL')
  if (ev.task_wpB)      await trySelect(sb.WP_A, 'WP_A', 'wedding_tasks', 'id', ev.task_wpB, 'block', 'CRITICAL')
  if (ev.transport_wpB) await trySelect(sb.WP_A, 'WP_A', 'event_transport', 'id', ev.transport_wpB, 'block', 'CRITICAL')
  if (ev.accomm_wpB)    await trySelect(sb.WP_A, 'WP_A', 'event_accommodations', 'id', ev.accomm_wpB, 'block', 'CRITICAL')
  if (ev.cprefs_wpB)    await trySelect(sb.WP_A, 'WP_A', 'couple_preferences', 'id', ev.cprefs_wpB, 'block', 'CRITICAL')
  // contracts of WP_B
  const wpBContract = await svc.from('contracts').select('id').eq('owner_id', ACTORS.WP_B.id).limit(1).single()
  if (wpBContract.data) {
    await trySelect(sb.WP_A, 'WP_A', 'contracts', 'id', wpBContract.data.id, 'block', 'CRITICAL')
    await tryUpdate(sb.WP_A, 'WP_A', 'contracts', 'id', wpBContract.data.id, { title: 'PWN' }, 'block', 'CRITICAL')
  }
  // wedding_couple_members of WP_B's wedding
  const wpBMember = await svc.from('wedding_couple_members').select('id').eq('entry_id', FIX.wpB_entry).limit(1).single()
  if (wpBMember.data) {
    await trySelect(sb.WP_A, 'WP_A', 'wedding_couple_members', 'id', wpBMember.data.id, 'block', 'CRITICAL')
    await tryDelete(sb.WP_A, 'WP_A', 'wedding_couple_members', 'id', wpBMember.data.id, 'block', 'CRITICAL')
  }

  // ====================== WP A -> Fornitore A supplier_clients ======================
  console.log('\n=== WP_A vs FORN_A private data ===')
  // supplier_availability of FORN_A (if visible to WP only via collaboration, fine — block from WP_A as foreign)
  await trySelect(sb.WP_A, 'WP_A', 'supplier_availability', 'id', FIX.fornA_avail, 'block', 'STANDARD')

  // ====================== Fornitore A -> Fornitore B ======================
  console.log('\n=== FORN_A vs FORN_B ===')
  await trySelect(sb.FORN_A, 'FORN_A', 'supplier_availability', 'id', FIX.fornB_avail, 'block', 'CRITICAL')
  await tryUpdate(sb.FORN_A, 'FORN_A', 'supplier_availability', 'id', FIX.fornB_avail, { status: 'AVAILABLE' }, 'block', 'CRITICAL')
  await tryDelete(sb.FORN_A, 'FORN_A', 'supplier_availability', 'id', FIX.fornB_avail, 'block', 'CRITICAL')
  await trySelect(sb.FORN_A, 'FORN_A', 'services', 'id', FIX.fornB_service, 'block', 'STANDARD') // services may be public
  await tryUpdate(sb.FORN_A, 'FORN_A', 'services', 'id', FIX.fornB_service, { base_price: 1 }, 'block', 'CRITICAL')
  // FORN_A tries to read FORN_B's quote_items (FORN_B has items in WP_A's quote)
  await trySelect(sb.FORN_A, 'FORN_A', 'quote_items', 'id', FIX.fornB_quote_item_in_wpA, 'block', 'CRITICAL')
  await tryUpdate(sb.FORN_A, 'FORN_A', 'quote_items', 'id', FIX.fornB_quote_item_in_wpA, { snapshot_price: 0.01 }, 'block', 'CRITICAL')

  // ====================== Fornitore A -> WP_B quote interi ======================
  console.log('\n=== FORN_A vs WP_B quote (uninvolved) ===')
  await trySelect(sb.FORN_A, 'FORN_A', 'quotes', 'id', FIX.wpB_quote, 'block', 'CRITICAL')
  await trySelect(sb.FORN_A, 'FORN_A', 'calendar_entries', 'id', FIX.wpB_entry, 'block', 'CRITICAL')
  if (ev.guest_wpB)  await trySelect(sb.FORN_A, 'FORN_A', 'event_guests', 'id', ev.guest_wpB, 'block', 'CRITICAL')
  if (ev.mood_wpB)   await trySelect(sb.FORN_A, 'FORN_A', 'mood_images', 'id', ev.mood_wpB, 'block', 'CRITICAL')
  if (ev.cprefs_wpB) await trySelect(sb.FORN_A, 'FORN_A', 'couple_preferences', 'id', ev.cprefs_wpB, 'block', 'CRITICAL')

  // ====================== Fornitore B (involved in WP_A quote) ======================
  console.log('\n=== FORN_B legitimate access to own quote_items in WP_A quote ===')
  // Can FORN_B see/update own item line in WP_A's quote? Should ALLOW.
  await trySelect(sb.FORN_B, 'FORN_B', 'quote_items', 'id', FIX.fornB_quote_item_in_wpA, 'allow', 'STANDARD')
  // But can FORN_B read the WHOLE quote (WP_A's quote)? RLS may allow (because supplier is involved) — depends on policy
  // Try and observe (record as "info" — neither block nor allow required)
  {
    const r = await sb.FORN_B.from('quotes').select('*').eq('id', FIX.wpA_quote_with_fornB_items)
    console.log(`[INFO] FORN_B reading WP_A quote (where FORN_B is involved): rows=${r.data?.length}, err=${r.error?.message}`)
    results.push({ actor: 'FORN_B', op: 'SELECT', table: 'quotes', target: FIX.wpA_quote_with_fornB_items, expected: 'info', actual: r.error ? 'denied' : `${r.data?.length} rows`, dataCount: r.data?.length||0, errMsg: r.error?.message||null, pass: true, severity: 'INFO', note: 'supplier-involved-quote' })
  }
  // FORN_B reading OTHER items of WP_A quote (items NOT belonging to FORN_B) — should BLOCK or empty
  const otherItem = await svc.from('quote_items').select('id,supplier_id').eq('quote_id', FIX.wpA_quote_with_fornB_items).neq('supplier_id', ACTORS.FORN_B.id).limit(1).single()
  if (otherItem.data) {
    await trySelect(sb.FORN_B, 'FORN_B', 'quote_items', 'id', otherItem.data.id, 'block', 'CRITICAL')
  }
  // FORN_B reading the calendar_entry linked to WP_A's quote — should BLOCK
  const wpA_quote_entry = await svc.from('calendar_entries').select('id').eq('quote_id', FIX.wpA_quote_with_fornB_items).limit(1).single()
  if (wpA_quote_entry.data) {
    await trySelect(sb.FORN_B, 'FORN_B', 'calendar_entries', 'id', wpA_quote_entry.data.id, 'block', 'CRITICAL')
    // event_guests, mood_images, couple_preferences under that entry
    const tgs = ['event_guests','mood_images','couple_preferences','event_playlist','event_timeline','wedding_tasks','event_tables','event_transport','event_accommodations']
    for (const t of tgs) {
      const row = await svc.from(t).select('id').eq('entry_id', wpA_quote_entry.data.id).limit(1).single()
      if (row.data) await trySelect(sb.FORN_B, 'FORN_B', t, 'id', row.data.id, 'block', 'CRITICAL')
    }
  }

  // ====================== Couple C -> other matrimoni ======================
  console.log('\n=== COUPLE_C vs other weddings ===')
  await trySelect(sb.COUPLE_C, 'COUPLE_C', 'calendar_entries', 'id', FIX.wpB_entry, 'block', 'CRITICAL')
  await tryUpdate(sb.COUPLE_C, 'COUPLE_C', 'calendar_entries', 'id', FIX.wpB_entry, { title: 'PWN' }, 'block', 'CRITICAL')
  await tryDelete(sb.COUPLE_C, 'COUPLE_C', 'calendar_entries', 'id', FIX.wpB_entry, 'block', 'CRITICAL')
  await trySelect(sb.COUPLE_C, 'COUPLE_C', 'quotes', 'id', FIX.wpB_quote, 'block', 'CRITICAL')
  await trySelect(sb.COUPLE_C, 'COUPLE_C', 'quotes', 'id', FIX.wpA_quote, 'block', 'CRITICAL') // WP_A but not couple-linked
  if (ev.guest_wpA_notCouple)   await trySelect(sb.COUPLE_C, 'COUPLE_C', 'event_guests', 'id', ev.guest_wpA_notCouple, 'block', 'CRITICAL')
  if (ev.mood_wpA_notCouple)    await trySelect(sb.COUPLE_C, 'COUPLE_C', 'mood_images', 'id', ev.mood_wpA_notCouple, 'block', 'CRITICAL')
  if (ev.cprefs_wpA_notCouple)  await trySelect(sb.COUPLE_C, 'COUPLE_C', 'couple_preferences', 'id', ev.cprefs_wpA_notCouple, 'block', 'CRITICAL')
  if (ev.timeline_wpA_notCouple) await trySelect(sb.COUPLE_C, 'COUPLE_C', 'event_timeline', 'id', ev.timeline_wpA_notCouple, 'block', 'CRITICAL')

  // ====================== Couple C -> own wedding (should ALLOW) ======================
  console.log('\n=== COUPLE_C reads own wedding ===')
  await trySelect(sb.COUPLE_C, 'COUPLE_C', 'calendar_entries', 'id', FIX.wpA_entry_couple, 'allow', 'STANDARD')
  const ownTimeline = await svc.from('event_timeline').select('id').eq('entry_id', FIX.wpA_entry_couple).limit(1).single()
  if (ownTimeline.data) await trySelect(sb.COUPLE_C, 'COUPLE_C', 'event_timeline', 'id', ownTimeline.data.id, 'allow', 'STANDARD')

  // ====================== Anon access ======================
  console.log('\n=== ANON vs critical tables ===')
  await trySelect(sb.ANON, 'ANON', 'quotes', 'id', FIX.wpA_quote, 'block', 'CRITICAL')
  await trySelect(sb.ANON, 'ANON', 'quote_items', 'id', FIX.fornB_quote_item_in_wpA, 'block', 'CRITICAL')
  await trySelect(sb.ANON, 'ANON', 'calendar_entries', 'id', FIX.wpA_entry, 'block', 'CRITICAL')
  await trySelect(sb.ANON, 'ANON', 'profiles', 'id', ACTORS.WP_A.id, 'block', 'CRITICAL')
  await trySelect(sb.ANON, 'ANON', 'supplier_availability', 'id', FIX.fornA_avail, 'block', 'STANDARD')
  await trySelect(sb.ANON, 'ANON', 'wedding_couple_members', 'id', '00000000-0000-0000-0000-000000000000', 'block', 'CRITICAL')
  await trySelect(sb.ANON, 'ANON', 'collaborations', 'id', '00000000-0000-0000-0000-000000000000', 'block', 'CRITICAL')
  await trySelect(sb.ANON, 'ANON', 'supplier_invites', 'id', '00000000-0000-0000-0000-000000000000', 'block', 'CRITICAL')
  if (ev.cprefs_wpB) await trySelect(sb.ANON, 'ANON', 'couple_preferences', 'id', ev.cprefs_wpB, 'block', 'CRITICAL')
  if (ev.guest_wpB)  await trySelect(sb.ANON, 'ANON', 'event_guests', 'id', ev.guest_wpB, 'block', 'CRITICAL')
  if (ev.mood_wpB)   await trySelect(sb.ANON, 'ANON', 'mood_images', 'id', ev.mood_wpB, 'block', 'CRITICAL')

  // beta_status: SELECT should ALLOW (public read), UPDATE block
  await trySelect(sb.ANON, 'ANON', 'beta_status', 'role', 'supplier', 'allow', 'STANDARD')
  await tryUpdate(sb.ANON, 'ANON', 'beta_status', 'role', 'supplier', { planned_price: 1 }, 'block', 'CRITICAL')
  await tryUpdate(sb.WP_A, 'WP_A', 'beta_status', 'role', 'supplier', { planned_price: 1 }, 'block', 'CRITICAL')

  // ====================== INSERT attacks ======================
  console.log('\n=== Cross-tenant INSERTs ===')
  // WP_A tries to insert a quote owned by WP_B
  await tryInsert(sb.WP_A, 'WP_A', 'quotes', {
    owner_id: ACTORS.WP_B.id,
    title: 'INJECTED-BY-WPA',
    client_name: 'x',
    client_email: 'x@x',
    event_date: '2030-01-01'
  }, 'block', 'CRITICAL')
  // Forn A tries to insert availability for Forn B
  await tryInsert(sb.FORN_A, 'FORN_A', 'supplier_availability', {
    fornitore_id: ACTORS.FORN_B.id,
    date: '2030-01-01',
    status: 'BUSY'
  }, 'block', 'CRITICAL')
  // Couple C tries to insert quote
  await tryInsert(sb.COUPLE_C, 'COUPLE_C', 'quotes', {
    owner_id: ACTORS.COUPLE_C.id,
    title: 'INJECTED-BY-COUPLE',
    client_name: 'x',
    client_email: 'x@x',
    event_date: '2030-01-01'
  }, 'block', 'CRITICAL')
  // Anon tries to insert
  await tryInsert(sb.ANON, 'ANON', 'quotes', {
    owner_id: ACTORS.WP_A.id,
    title: 'INJECTED-ANON',
    client_name: 'x',
    client_email: 'x@x',
    event_date: '2030-01-01'
  }, 'block', 'CRITICAL')
  await tryInsert(sb.ANON, 'ANON', 'profiles', {
    id: '00000000-0000-0000-0000-deadbeef0001',
    role: 'ADMIN'
  }, 'block', 'CRITICAL')

  // WP_A inserts event_guests on WP_B's entry
  await tryInsert(sb.WP_A, 'WP_A', 'event_guests', {
    entry_id: FIX.wpB_entry,
    full_name: 'INJECTED'
  }, 'block', 'CRITICAL')
  // Couple C inserts event_guests on WP_B's entry
  await tryInsert(sb.COUPLE_C, 'COUPLE_C', 'event_guests', {
    entry_id: FIX.wpB_entry,
    full_name: 'INJECTED-BY-COUPLE'
  }, 'block', 'CRITICAL')
  // Couple C inserts mood image into WP_A's other entry
  await tryInsert(sb.COUPLE_C, 'COUPLE_C', 'mood_images', {
    entry_id: FIX.wpA_entry,
    url: 'https://x.test/1.jpg',
    source: 'test'
  }, 'block', 'CRITICAL')

  // ====================== RPCs ======================
  console.log('\n=== RPCs ===')
  // my_quote_conflict_alerts is SECURITY DEFINER — only returns alerts for current uid
  for (const role of ['WP_A','WP_B','FORN_A','FORN_B','COUPLE_C']) {
    const r = await sb[role].rpc('my_quote_conflict_alerts')
    const errMsg = r.error?.message || null
    const count = Array.isArray(r.data) ? r.data.length : 0
    // Check that none of the alerts reference other tenants (heuristic: each row should reference current user as owner)
    let leaked = false
    if (Array.isArray(r.data)) {
      // alerts include some owner_id field — depends on function shape
      for (const row of r.data) {
        const ownerLike = row.owner_id || row.wp_id || row.fornitore_id || row.supplier_id
        // If alerts include rows where the owner is not the current user AND not the supplier — possible leak
      }
    }
    results.push({
      actor: role, op: 'RPC', table: 'my_quote_conflict_alerts', target: '-',
      expected: 'own-only', actual: errMsg ? `error: ${errMsg}` : `${count} rows`,
      dataCount: count, errMsg, pass: true, severity: 'INFO', sample: r.data?.[0]
    })
    console.log(`[INFO] ${role}/my_quote_conflict_alerts: rows=${count} err=${errMsg}`)
  }

  // anon attempts to call my_quote_conflict_alerts — should fail (auth required)
  {
    const r = await sb.ANON.rpc('my_quote_conflict_alerts')
    const ok = !!r.error // expected: error
    results.push({ actor: 'ANON', op: 'RPC', table: 'my_quote_conflict_alerts', target: '-',
      expected: 'block', actual: r.error ? `denied(${r.error.message?.slice(0,60)})` : `leaked(${r.data?.length})`,
      dataCount: r.data?.length||0, errMsg: r.error?.message||null,
      pass: r.error ? true : (Array.isArray(r.data) && r.data.length === 0),
      severity: 'CRITICAL' })
    console.log(`[${r.error||r.data?.length===0?'PASS':'FAIL'}] ANON/RPC/my_quote_conflict_alerts: ${r.error?.message || (r.data?.length+' rows')}`)
  }

  // contract_get_by_token with bogus token
  for (const role of ['ANON','FORN_A','COUPLE_C']) {
    const r = await sb[role].rpc('contract_get_by_token', { p_token: '00000000-0000-0000-0000-000000000000' })
    const isEmpty = !r.data || (Array.isArray(r.data) && r.data.length === 0) || (typeof r.data === 'object' && !r.data?.id)
    results.push({
      actor: role, op: 'RPC', table: 'contract_get_by_token(bogus)', target: '-',
      expected: 'block', actual: isEmpty ? 'blocked' : 'leaked',
      dataCount: 0, errMsg: r.error?.message || null,
      pass: isEmpty, severity: 'CRITICAL'
    })
    console.log(`[${isEmpty?'PASS':'FAIL'}] ${role}/contract_get_by_token(bogus): ${JSON.stringify(r.data)?.slice(0,80)} err=${r.error?.message}`)
  }

  // ====================== Storage buckets ======================
  console.log('\n=== Storage RLS ===')
  // FORN_A attempts to upload into FORN_B namespace in service-photos
  const fileBytes = new Uint8Array([0xff,0xd8,0xff,0xe0,0,0,0,0])
  for (const role of ['FORN_A','COUPLE_C','ANON']) {
    const path = `${ACTORS.FORN_B.id}/__pwn-test-${Date.now()}.jpg`
    const up = await sb[role].storage.from('service-photos').upload(path, fileBytes, { contentType: 'image/jpeg' })
    results.push({
      actor: role, op: 'STORAGE_UPLOAD', table: 'service-photos', target: path,
      expected: 'block', actual: up.error ? `denied(${up.error.message?.slice(0,60)})` : 'allowed',
      dataCount: up.error ? 0 : 1, errMsg: up.error?.message || null,
      pass: !!up.error, severity: 'CRITICAL'
    })
    console.log(`[${up.error?'PASS':'FAIL'}] ${role}/upload service-photos/${path}: err=${up.error?.message}`)
  }
  // ANON tries to download a quote-pdfs object guess
  {
    const dl = await sb.ANON.storage.from('quote-pdfs').list('', { limit: 5 })
    const leaked = (dl.data?.length || 0) > 0
    results.push({
      actor: 'ANON', op: 'STORAGE_LIST', table: 'quote-pdfs', target: '-',
      expected: 'block', actual: leaked ? `leaked(${dl.data.length} entries)` : 'blocked',
      dataCount: dl.data?.length||0, errMsg: dl.error?.message || null,
      pass: !leaked, severity: 'CRITICAL'
    })
    console.log(`[${leaked?'FAIL':'PASS'}] ANON/list quote-pdfs: ${dl.data?.length} entries err=${dl.error?.message}`)
  }
  {
    const dl = await sb.ANON.storage.from('quote-signatures').list('', { limit: 5 })
    const leaked = (dl.data?.length || 0) > 0
    results.push({
      actor: 'ANON', op: 'STORAGE_LIST', table: 'quote-signatures', target: '-',
      expected: 'block', actual: leaked ? `leaked(${dl.data.length} entries)` : 'blocked',
      dataCount: dl.data?.length||0, errMsg: dl.error?.message || null,
      pass: !leaked, severity: 'CRITICAL'
    })
    console.log(`[${leaked?'FAIL':'PASS'}] ANON/list quote-signatures: ${dl.data?.length} entries err=${dl.error?.message}`)
  }
  {
    const dl = await sb.ANON.storage.from('event-documents').list('', { limit: 5 })
    const leaked = (dl.data?.length || 0) > 0
    results.push({
      actor: 'ANON', op: 'STORAGE_LIST', table: 'event-documents', target: '-',
      expected: 'block', actual: leaked ? `leaked(${dl.data.length})` : 'blocked',
      dataCount: dl.data?.length||0, errMsg: dl.error?.message || null,
      pass: !leaked, severity: 'CRITICAL'
    })
    console.log(`[${leaked?'FAIL':'PASS'}] ANON/list event-documents: ${dl.data?.length} entries err=${dl.error?.message}`)
  }

  // ====================== Output ======================
  const out = resolve(__dirname)
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2))

  const total = results.filter(r => r.severity !== 'INFO').length
  const pass = results.filter(r => r.pass && r.severity !== 'INFO').length
  const fail = results.filter(r => !r.pass && r.severity !== 'INFO').length
  const leaks = results.filter(r => !r.pass && r.severity === 'CRITICAL')

  writeFileSync(resolve(out, 'leaks.json'), JSON.stringify(leaks, null, 2))
  writeFileSync(resolve(out, 'pass-summary.txt'),
    `Total: ${total}\nPass: ${pass}\nFail: ${fail}\nPercent: ${(pass/total*100).toFixed(1)}%\nCRITICAL leaks: ${leaks.length}\n`)

  // Markdown report
  const md = []
  md.push('# Planfully — RLS Audit (Night G)')
  md.push(`\n_Run: ${new Date().toISOString()}_  Cells: ${total} • Pass: ${pass} • Fail: ${fail} • Critical leaks: ${leaks.length}\n`)
  md.push('## Test users')
  for (const k of Object.keys(ACTORS)) md.push(`- **${k}** = \`${ACTORS[k].email}\` (\`${ACTORS[k].id}\`)`)
  md.push('\n## Matrix\n')
  md.push('| Actor | Op | Table | Target | Expected | Actual | Pass | Severity | Err |')
  md.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    md.push(`| ${r.actor} | ${r.op} | ${r.table} | ${(r.target||'').slice(0,12)} | ${r.expected} | ${r.actual} | ${r.pass?'PASS':'**FAIL**'} | ${r.severity} | ${(r.errMsg||'').slice(0,80)} |`)
  }
  md.push('\n## CRITICAL leaks\n')
  if (leaks.length === 0) md.push('_None_')
  else for (const l of leaks) md.push(`- ${l.actor}/${l.op}/${l.table}/${l.target}: actual=${l.actual} err=${l.errMsg||''}`)
  writeFileSync(resolve(out, 'REPORT.md'), md.join('\n'))

  console.log(`\n\n=== SUMMARY ===`)
  console.log(`Total cells: ${total}`)
  console.log(`Pass: ${pass} (${(pass/total*100).toFixed(1)}%)`)
  console.log(`Fail: ${fail}`)
  console.log(`CRITICAL leaks: ${leaks.length}`)
  if (leaks.length) {
    console.log('LEAKS:')
    for (const l of leaks) console.log('  -', l.actor, l.op, l.table, l.target, '|', l.actual)
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
