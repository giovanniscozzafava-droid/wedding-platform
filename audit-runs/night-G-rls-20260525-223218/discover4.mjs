// Identify concrete test fixtures for each tenant
import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } })

// Known users
const WP_A = '712baed0-3957-4452-8aab-ab4eeebb2697' // wp-mini@planfully-demo.it
const FORN_A = '747707fe-03be-4bb8-95b8-17b43b465526' // forn-mini-foto@planfully-demo.it
const FORN_B = 'a0262dd1-f07c-4359-a9c0-1186e98971a3' // forn-mini-fiori@planfully-demo.it
const COUPLE_C = '6e61b300-66f5-4ddb-9fc0-b0d3351a63b7' // giovanni.scozzafava+sposo

// Pick a different WP (B). Use wp.speranza or wp.semiramide
const WPs_other = ['ebae0f18-4cc8-40fe-ae40-f6a5757f1726','79ddaae6-a8f0-4578-9c7a-9bc295a0742a','a1057a10-e1fb-4565-ae65-3a17bb2a270d']

async function findEntities() {
  console.log('--- WP_A entities (wp-mini) ---')
  const qA = await sb.from('quotes').select('id,title,owner_id').eq('owner_id', WP_A).limit(5)
  console.log('quotes:', qA.data?.length, qA.error?.message)
  console.log(JSON.stringify(qA.data, null, 2))
  const cA = await sb.from('calendar_entries').select('id,title,owner_id').eq('owner_id', WP_A).limit(5)
  console.log('cal_entries:', cA.data?.length, cA.error?.message)
  console.log(JSON.stringify(cA.data, null, 2))

  for (const wpB of WPs_other) {
    console.log(`\n--- WP_B candidate ${wpB} ---`)
    const qB = await sb.from('quotes').select('id,title,owner_id').eq('owner_id', wpB).limit(3)
    console.log('quotes:', qB.data?.length)
    const cB = await sb.from('calendar_entries').select('id,title,owner_id').eq('owner_id', wpB).limit(3)
    console.log('cal_entries:', cB.data?.length)
    if ((qB.data?.length||0) > 0 && (cB.data?.length||0) > 0) {
      console.log('FOUND WP_B:', wpB)
      console.log('quote samples:', JSON.stringify(qB.data, null, 2))
      console.log('cal samples:', JSON.stringify(cB.data, null, 2))
      break
    }
  }

  // Forn A & B entities
  for (const f of [FORN_A, FORN_B]) {
    console.log(`\n--- Forn ${f} ---`)
    const sv = await sb.from('services').select('id,name,fornitore_id').eq('fornitore_id', f).limit(3)
    console.log('services:', sv.data)
    const av = await sb.from('supplier_availability').select('id,date,status').eq('fornitore_id', f).limit(3)
    console.log('availability:', av.data)
    const qit = await sb.from('quote_items').select('id,quote_id,supplier_id,name_snapshot').eq('supplier_id', f).limit(3)
    console.log('quote_items:', qit.data)
  }

  // Couple C entity
  console.log('\n--- Couple C ---')
  const wcm = await sb.from('wedding_couple_members').select('id,entry_id,user_id,role').eq('user_id', COUPLE_C)
  console.log('member rows:', JSON.stringify(wcm.data, null, 2))
  if (wcm.data?.length) {
    const ce = await sb.from('calendar_entries').select('*').eq('id', wcm.data[0].entry_id).single()
    console.log('couple entry:', ce.data)
  }

  // Sample of "other" entries (any not WP_A/COUPLE_C entry)
  const otherCEs = await sb.from('calendar_entries').select('id,owner_id,quote_id').neq('owner_id', WP_A).limit(5)
  console.log('\nOther calendar entries to use as cross-tenant target:')
  console.log(JSON.stringify(otherCEs.data, null, 2))

  // Quotes that involve FORN_A as quote_items.supplier_id (so they have legit collaboration link via items)
  const involved = await sb.from('quote_items').select('id,quote_id,supplier_id').eq('supplier_id', FORN_A).limit(5)
  console.log('\nFORN_A involved quote_items:', JSON.stringify(involved.data, null, 2))

  // Beta status RPC search
  const rpcs = ['my_quote_conflict_alerts','check_supplier_available','accept_supplier_invite','claim_supplier_invite','contract_get_by_token','wedding_site_rsvp']
  for (const r of rpcs) {
    const test = await sb.rpc(r, {})
    console.log(`rpc ${r}: err=${test.error?.message?.slice(0,140)}`)
  }
}

findEntities().catch(e => { console.error(e); process.exit(1) })
