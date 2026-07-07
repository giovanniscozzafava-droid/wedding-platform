import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV',
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
