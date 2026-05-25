// Confirm FORN_A reads event_guests of weddings where it has ZERO involvement
import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'
const PWD = 'Beta2026!'
const FORN_A = '747707fe-03be-4bb8-95b8-17b43b465526'

const fa = createClient(URL, ANON, { auth: { persistSession: false } })
await fa.auth.signInWithPassword({ email: 'forn-mini-foto@planfully-demo.it', password: PWD })

const guests = await fa.from('event_guests').select('id,entry_id,full_name,email,phone,party_size,rsvp,diet,notes,table_id').limit(50)
console.log(`FORN_A total event_guests visible: ${guests.data?.length}`)
// Group by entry
const byEntry = {}
for (const g of guests.data || []) {
  byEntry[g.entry_id] = (byEntry[g.entry_id]||0) + 1
}
console.log('By entry:', byEntry)
console.log('Sample row (PII check):', JSON.stringify(guests.data?.[0], null, 2))

// Check if FORN_A has any quote_item in those entries' quotes
const sb2 = createClient(URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M', { auth: { persistSession: false } })
const items = await sb2.from('quote_items').select('id,quote_id,supplier_id').eq('supplier_id', FORN_A)
console.log(`FORN_A total quote_items across ALL quotes: ${items.data?.length}`)

const tables = await fa.from('event_tables').select('id,entry_id,label,table_no,seats').limit(50)
console.log(`FORN_A total event_tables visible: ${tables.data?.length}`)
console.log('Sample table:', JSON.stringify(tables.data?.[0], null, 2))

const transport = await fa.from('event_transport').select('id,entry_id,kind,label,provider,depart_at,depart_from').limit(20)
console.log(`FORN_A total event_transport visible: ${transport.data?.length}`)
for (const t of transport.data || []) console.log(`  - ${t.kind} ${t.label} entry=${t.entry_id} provider=${t.provider}`)
