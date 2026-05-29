// E2E Fase A: contratti CLIENT_WP richiedono quote ACCETTATO
import { config } from 'dotenv'
config({ path: '/tmp/wp-prod.env' })
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const PASSWORD = 'Beta2026!'
const ELISA = 'elisabettacitraro1998@gmail.com'

let pass = 0, fail = 0
const failures = []
function log(label, ok, info) {
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; failures.push(`${label} — ${info ?? ''}`); console.log(`  ✗ ${label} — ${info ?? ''}`) }
}

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  return { c, id: data.user.id }
}

async function main() {
  console.log('▶ E2E contratto richiede preventivo ACCETTATO\n')
  const elisa = await login(ELISA)

  const past = new Date(Date.now() - (350 + Math.floor(Math.random() * 100)) * 86400 * 1000).toISOString().slice(0, 10)

  // [1] Setup: wedding + quote BOZZA
  console.log('[1] Setup wedding + quote BOZZA')
  const { data: entry } = await elisa.c.from('calendar_entries').insert({
    owner_id: elisa.id, title: 'Chain Test', client_name: 'X', date_from: past, date_to: past,
  }).select('id').single()
  const { data: q } = await elisa.c.from('quotes').insert({
    owner_id: elisa.id, title: 'Q Chain', event_date: past,
    client_name: 'X', client_email: 'x@y.it', access_token: crypto.randomUUID(),
  }).select('id, status').single()
  await elisa.c.from('calendar_entries').update({ quote_id: q.id }).eq('id', entry.id)
  log('quote in BOZZA', q.status === 'BOZZA')

  // [2] Contratto CLIENT_WP su quote BOZZA → deve fallire
  console.log('\n[2] Tentativo contratto CLIENT_WP su quote BOZZA')
  const { data: c1, error: e1 } = await elisa.c.from('contracts').insert({
    owner_id: elisa.id, quote_id: q.id, entry_id: entry.id,
    title: 'Test contract BOZZA', party_kind: 'CLIENT_WP',
    client_name: 'X', client_email: 'x@y.it',
  }).select('id').maybeSingle()
  log('insert contract su BOZZA respinto', !c1 && !!e1 && /preventivo/i.test(e1.message), e1?.message)

  // [3] Senza quote_id → respinto
  console.log('\n[3] Contratto CLIENT_WP senza quote_id')
  const { data: c2, error: e2 } = await elisa.c.from('contracts').insert({
    owner_id: elisa.id, entry_id: entry.id,
    title: 'No quote', party_kind: 'CLIENT_WP',
    client_name: 'X',
  }).select('id').maybeSingle()
  log('insert senza quote_id respinto', !c2 && !!e2 && /preventivo/i.test(e2.message), e2?.message)

  // [4] SUPPLIER_WP esente
  console.log('\n[4] SUPPLIER_WP esente dal vincolo')
  const { data: c3, error: e3 } = await elisa.c.from('contracts').insert({
    owner_id: elisa.id, entry_id: entry.id,
    title: 'Supplier WP', party_kind: 'SUPPLIER_WP',
    client_name: 'WP↔Fornitore',
  }).select('id').maybeSingle()
  log('SUPPLIER_WP creabile senza quote', !!c3?.id, e3?.message)
  if (c3?.id) await elisa.c.from('contracts').delete().eq('id', c3.id)

  // [5] Quote → ACCETTATO → contratto creabile
  console.log('\n[5] Quote ACCETTATO → contratto OK')
  await elisa.c.from('quotes').update({ status: 'INVIATO' }).eq('id', q.id) // BOZZA→INVIATO
  await elisa.c.from('quotes').update({ status: 'ACCETTATO', accepted_at: new Date().toISOString() }).eq('id', q.id)
  const { data: c4, error: e4 } = await elisa.c.from('contracts').insert({
    owner_id: elisa.id, quote_id: q.id, entry_id: entry.id,
    title: 'OK contract', party_kind: 'CLIENT_WP',
    client_name: 'X', client_email: 'x@y.it',
  }).select('id').maybeSingle()
  log('contract CLIENT_WP creato su quote ACCETTATO', !!c4?.id, e4?.message)

  // Cleanup
  console.log('\n[CLEANUP]')
  await elisa.c.from('contracts').delete().eq('entry_id', entry.id)
  await elisa.c.rpc('delete_wedding_cascade', { p_entry_id: entry.id })
  log('cleanup', true)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`RISULTATO: ${pass} PASS · ${fail} FAIL`)
  if (fail > 0) {
    console.log('FAILURES:')
    failures.forEach((f) => console.log(`  ✗ ${f}`))
    process.exit(1)
  }
  console.log('✅ Tutti i test passano.')
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2) })
