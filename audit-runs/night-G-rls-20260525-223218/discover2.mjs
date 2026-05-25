import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } })

// Auth users (need admin)
const usersResp = await sb.auth.admin.listUsers({ perPage: 500 })
const users = usersResp.data?.users || []
console.log('Total users:', users.length)

// Filter test domains
const candidates = users
  .filter(u => u.email && (u.email.includes('planfully-demo') || u.email.includes('giovanni.scozzafava')))
  .map(u => ({ id: u.id, email: u.email, role: u.user_metadata?.role || u.app_metadata?.role }))

console.log('Candidates:')
for (const c of candidates) console.log(JSON.stringify(c))

// Map to profiles
const ids = candidates.map(c => c.id)
const prof = await sb.from('profiles').select('id,role,first_name,last_name,business_name').in('id', ids)
console.log('Profiles:')
for (const p of prof.data || []) console.log(JSON.stringify(p))

// Sample tables
const q = await sb.from('quotes').select('id,wp_id,couple_id,wedding_date,status,calendar_entry_id').limit(20)
console.log('Quotes sample:', JSON.stringify(q.data?.slice(0,5), null, 2))

const calE = await sb.from('calendar_entries').select('id,wp_id,couple_id,event_date,status,location_city').limit(20)
console.log('Calendar entries:', JSON.stringify(calE.data?.slice(0,5), null, 2))

const contr = await sb.from('contracts').select('id,wp_id,supplier_id,couple_id,quote_id,status').limit(10)
console.log('Contracts:', JSON.stringify(contr.data?.slice(0,5), null, 2))

const supCli = await sb.from('supplier_clients').select('*').limit(5)
console.log('supplier_clients sample:', JSON.stringify(supCli.data, null, 2))

const supAv = await sb.from('supplier_availability').select('id,supplier_id,date,status').limit(5)
console.log('supplier_availability sample:', JSON.stringify(supAv.data, null, 2))

const wcm = await sb.from('wedding_couple_members').select('*').limit(20)
console.log('wedding_couple_members:', JSON.stringify(wcm.data, null, 2))

const collab = await sb.from('collaborations').select('id,wp_id,supplier_id,status').limit(20)
console.log('collaborations:', JSON.stringify(collab.data, null, 2))
