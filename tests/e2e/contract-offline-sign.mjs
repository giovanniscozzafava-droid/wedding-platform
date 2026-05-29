// E2E Fase C: contratto firmabile di persona
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
  console.log('▶ E2E firma contratto di persona\n')
  const elisa = await login(ELISA)
  const past = new Date(Date.now() - (380 + Math.floor(Math.random() * 100)) * 86400 * 1000).toISOString().slice(0, 10)

  // Setup: quote ACCETTATO + contratto BOZZA
  const { data: entry } = await elisa.c.from('calendar_entries').insert({
    owner_id: elisa.id, title: 'Offline Sign Test', client_name: 'X', date_from: past, date_to: past,
  }).select('id').single()
  const { data: q } = await elisa.c.from('quotes').insert({
    owner_id: elisa.id, title: 'Q', event_date: past, client_email: 'x@y.it', access_token: crypto.randomUUID(),
  }).select('id').single()
  await elisa.c.from('calendar_entries').update({ quote_id: q.id }).eq('id', entry.id)
  await elisa.c.from('quotes').update({ status: 'INVIATO' }).eq('id', q.id)
  await elisa.c.from('quotes').update({ status: 'ACCETTATO', accepted_at: new Date().toISOString() }).eq('id', q.id)
  const { data: c1 } = await elisa.c.from('contracts').insert({
    owner_id: elisa.id, quote_id: q.id, entry_id: entry.id,
    title: 'Offline test contract', party_kind: 'CLIENT_WP',
    client_name: 'Mario Rossi', client_email: 'mario@example.com',
  }).select('id, status').single()
  log('setup contratto BOZZA', c1?.status === 'BOZZA', c1?.id)

  // [1] firma offline OK
  console.log('\n[1] sign_contract_offline')
  const { data: r1, error: e1 } = await elisa.c.rpc('sign_contract_offline', {
    p_contract_id: c1.id,
    p_signer_name: 'Mario Rossi',
    p_signer_fiscal: 'RSSMRA80A01H501Z',
    p_pdf_url: 'https://example.com/scan.pdf',
    p_notes: 'Firma in studio',
  })
  log('rpc risponde', !e1 && r1?.ok === true, e1?.message ?? JSON.stringify(r1))

  // Verifica stato
  const { data: c1Sig } = await elisa.c.from('contracts')
    .select('status, signed_offline, signed_offline_pdf_url, signed_offline_signer_name, signed_at, signature_data')
    .eq('id', c1.id).single()
  log('status = FIRMATO', c1Sig?.status === 'FIRMATO', c1Sig?.status)
  log('signed_offline = true', c1Sig?.signed_offline === true)
  log('signed_offline_pdf_url salvato', !!c1Sig?.signed_offline_pdf_url)
  log('signed_offline_signer_name salvato', c1Sig?.signed_offline_signer_name === 'Mario Rossi')
  log('signature_data.mode = offline', c1Sig?.signature_data?.mode === 'offline')

  // [2] doppia firma vietata
  console.log('\n[2] doppia firma vietata')
  const { data: r2 } = await elisa.c.rpc('sign_contract_offline', {
    p_contract_id: c1.id, p_signer_name: 'Hacker', p_signer_fiscal: null, p_pdf_url: null, p_notes: null,
  })
  log('seconda firma respinta (already_signed)', r2?.error === 'already_signed', JSON.stringify(r2))

  // [3] signer_name vuoto vietato
  console.log('\n[3] signer_name vuoto')
  const { data: c2 } = await elisa.c.from('contracts').insert({
    owner_id: elisa.id, quote_id: q.id, entry_id: entry.id,
    title: 'Contract 2', party_kind: 'CLIENT_WP', client_name: 'X', client_email: 'x@y.it',
  }).select('id').single()
  const { data: r3 } = await elisa.c.rpc('sign_contract_offline', {
    p_contract_id: c2.id, p_signer_name: '  ', p_signer_fiscal: null, p_pdf_url: null, p_notes: null,
  })
  log('signer_name vuoto respinto', r3?.error === 'signer_name_required', JSON.stringify(r3))

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
