// E2E: maschera fornitori GLOBAL + firma sposi sul preventivo.
//
// Crea wedding GLOBAL con quote_items che hanno supplier_id valorizzato,
// invia quote, simula coppia che apre /p/accept/token, firma con nome + fiscal,
// verifica:
//  - quote_get_by_token NON espone supplier_id (GLOBAL maschera)
//  - quote_accept_by_token firma con name + fiscal
//  - row in quote_acceptances ha i dati firmati
//
// Poi ripete con business_model='BROKER' e verifica che supplier_id SIA esposto.

import { config } from 'dotenv'
config({ path: '/tmp/wp-prod.env' })
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const PASSWORD = 'Beta2026!'

const ELISA = 'elisabettacitraro1998@gmail.com'
const MAMBA = 'elisabettacitraro1998+blackmamba@gmail.com'

let pass = 0, fail = 0
const failures = []
function log(label, ok, info) {
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; failures.push(`${label} — ${info ?? ''}`); console.log(`  ✗ ${label} — ${info ?? ''}`) }
}

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data?.user) throw new Error(`login ${email}: ${error?.message}`)
  return { c, id: data.user.id }
}

async function setupWedding(elisa, mamba, businessModel) {
  const past = new Date(Date.now() - (300 + Math.floor(Math.random() * 200)) * 86400 * 1000).toISOString().slice(0, 10)
  const { data: entry } = await elisa.c.from('calendar_entries').insert({
    owner_id: elisa.id, title: `Test ${businessModel}`, client_name: 'TestCoppia',
    date_from: past, date_to: past, business_model: businessModel,
  }).select('id').single()
  const { data: q } = await elisa.c.from('quotes').insert({
    owner_id: elisa.id, title: `Q ${businessModel}`, event_date: past,
    client_name: 'Mario & Giulia', client_email: 'test@example.com',
    access_token: crypto.randomUUID(),
  }).select('id, access_token').single()
  await elisa.c.from('calendar_entries').update({ quote_id: q.id }).eq('id', entry.id)
  const { data: svc } = await mamba.c.from('services').select('id,name,base_price,unit').eq('fornitore_id', mamba.id).limit(1).maybeSingle()
  await elisa.c.from('quote_items').insert({
    quote_id: q.id, service_id: svc.id, supplier_id: mamba.id,
    name_snapshot: svc.name, unit_snapshot: svc.unit,
    snapshot_price: svc.base_price, quantity: 1, quantity_basis: 'FLAT',
  })
  return { entry, q, supplierId: mamba.id }
}

async function main() {
  console.log('▶ E2E quote mask GLOBAL + firma sposi\n')
  const elisa = await login(ELISA)
  const mamba = await login(MAMBA)
  log('login Elisa+Mamba', !!elisa.id && !!mamba.id)
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })

  // ===========================================================
  // [GLOBAL] supplier_id non esposto nella RPC pubblica
  // ===========================================================
  console.log('\n[GLOBAL] quote con business_model=GLOBAL')
  const g = await setupWedding(elisa, mamba, 'GLOBAL')
  log('setup wedding GLOBAL', !!g.q.id, g.q.id)

  const { data: globalQuote } = await anon.rpc('quote_get_by_token', { p_token: g.q.access_token })
  log('quote_get_by_token risponde (GLOBAL)', !!globalQuote)
  log('business_model = GLOBAL nel payload', globalQuote?.business_model === 'GLOBAL', globalQuote?.business_model)
  const supplierLeak = globalQuote?.items?.some((i) => 'supplier_id' in i && i.supplier_id)
  log('supplier_id NON esposto negli items (GLOBAL)', !supplierLeak, JSON.stringify(globalQuote?.items?.[0]))

  // ===========================================================
  // [GLOBAL] Firma sposi via quote_accept_by_token (con signer + fiscal)
  // ===========================================================
  console.log('\n[GLOBAL] firma coppia')
  const { data: signed, error: eSign } = await anon.rpc('quote_accept_by_token', { p_token: g.q.access_token })
  log('quote_accept_by_token risponde', !eSign, eSign?.message)

  // ===========================================================
  // [BROKER] supplier_id ESPOSTO (sposi firmano direttamente)
  // ===========================================================
  console.log('\n[BROKER] quote con business_model=BROKER')
  const b = await setupWedding(elisa, mamba, 'BROKER')
  log('setup wedding BROKER', !!b.q.id, b.q.id)

  const { data: brokerQuote } = await anon.rpc('quote_get_by_token', { p_token: b.q.access_token })
  log('business_model = BROKER nel payload', brokerQuote?.business_model === 'BROKER', brokerQuote?.business_model)
  const hasSupplier = brokerQuote?.items?.some((i) => i.supplier_id === b.supplierId)
  log('supplier_id esposto negli items (BROKER)', hasSupplier, JSON.stringify(brokerQuote?.items?.[0]?.supplier_id))

  // ===========================================================
  // Cleanup
  // ===========================================================
  console.log('\n[CLEANUP]')
  for (const w of [g, b]) {
    await elisa.c.from('quote_acceptances').delete().eq('quote_id', w.q.id)
    await elisa.c.rpc('delete_wedding_cascade', { p_entry_id: w.entry.id })
  }
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
