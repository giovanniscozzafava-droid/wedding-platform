import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M',
  { auth: { persistSession: false } })

const emails = [
  'wp-mini@planfully-demo.it',
  'forn-mini-foto@planfully-demo.it',
  'forn-mini-fiori@planfully-demo.it',
  'forn-mini-cater@planfully-demo.it',
]

const { data: users } = await sb.auth.admin.listUsers({ page:1, perPage:200 })
const idx = {}
for (const u of users.users) if (emails.includes(u.email)) idx[u.email] = u.id
console.log('USERS:', idx)

const ids = Object.values(idx)
const { data: profs } = await sb.from('profiles').select('id,role,full_name,business_name,brand_logo_url,brand_primary_color').in('id', ids)
console.log('PROFILES:', JSON.stringify(profs, null, 2))
