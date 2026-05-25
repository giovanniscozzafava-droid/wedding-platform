import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } })

const FORN_A = '747707fe-03be-4bb8-95b8-17b43b465526'

// Make sure FORN_A has at least 1 quote_item to test legit access
const qi = await sb.from('quote_items').select('id,quote_id,supplier_id,name_snapshot').eq('supplier_id', FORN_A).limit(10)
console.log('FORN_A quote_items:', JSON.stringify(qi.data, null, 2))

// If none, FORN_A isn't involved in any quote — that's fine.

// Find a couple to use as "another couple C2 wedding"
const others = await sb.from('calendar_entries').select('id,owner_id,wedding_website_slug').not('wedding_website_slug','is',null).limit(10)
console.log('Entries with slug:', JSON.stringify(others.data, null, 2))

// Find contracts wp-mini / wp-other
const c1 = await sb.from('contracts').select('id,owner_id,title').limit(20)
console.log('Contracts owners:', c1.data?.map(c => c.owner_id))

// Check supplier_clients (for FORN_A/B own private clients)
const sc = await sb.from('supplier_clients').select('*')
console.log('All supplier_clients:', sc.data)

// Check storage objects
const stg = await sb.storage.listBuckets()
console.log('Buckets:', stg.data)

// Check quote owned by WP_B that has any items — useful target
const wpB = 'ebae0f18-4cc8-40fe-ae40-f6a5757f1726'
const qWpB = await sb.from('quotes').select('id,owner_id').eq('owner_id', wpB).limit(3)
for (const q of qWpB.data || []) {
  const items = await sb.from('quote_items').select('id,supplier_id,name_snapshot').eq('quote_id', q.id).limit(3)
  console.log(`WP_B quote ${q.id} items:`, items.data)
}

// Look at policies for "couples"
// Check if wedding_couple_members has a row for COUPLE_C linked to entry not WP_A
const couple_other = await sb.from('wedding_couple_members').select('*').not('user_id','is', null).limit(5)
console.log('Couple members with user_id:', couple_other.data)

// RLS introspection
const policies = await sb.rpc('pg_query', { sql: "select tablename, policyname, cmd, qual from pg_policies where schemaname='public' limit 200" })
console.log('Policies via rpc:', policies.error?.message)
