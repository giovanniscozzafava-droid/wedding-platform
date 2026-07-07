#!/usr/bin/env node
// Crea utenti demo direttamente nel cloud Supabase (bypass email confirmation).
// Esegui una volta:  node scripts/seed-cloud-users.mjs
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const USERS = [
  { email: 'demo@planfully.it',  password: 'Demo2026!',  role: 'WEDDING_PLANNER', full_name: 'Demo Planner',    business_name: 'Planfully Studio' },
  { email: 'maria@planfully.it', password: 'Demo2026!',  role: 'WEDDING_PLANNER', full_name: 'Maria Wedding',   business_name: 'Maria Wedding Atelier' },
  { email: 'admin@planfully.it', password: 'Admin2026!', role: 'ADMIN',           full_name: 'Admin Planfully', business_name: null },
]

const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })

for (const u of USERS) {
  const exists = list?.users?.find((x) => x.email === u.email)
  if (exists) { console.log('  skip ' + u.email + ' (esiste)'); continue }
  const { data, error } = await sb.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { role: u.role, full_name: u.full_name, business_name: u.business_name },
  })
  if (error) { console.error('  ERR ' + u.email + ': ' + error.message); continue }
  await sb.from('profiles').update({
    business_name: u.business_name,
    full_name: u.full_name,
  }).eq('id', data.user.id)
  console.log('  OK  ' + u.email)
}

console.log('\nLogin:')
USERS.forEach((u) => console.log('  ' + u.email + '  ' + u.password + '  (' + u.role + ')'))
