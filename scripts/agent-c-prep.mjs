import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV',
  { auth: { persistSession: false } })

// 1. Find sposo via auth.admin
const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 500 })
const sposo = users.users.find(u => u.email === 'giovanni.scozzafava+sposo@gmail.com')
console.log('SPOSO AUTH:', sposo ? { id: sposo.id, email: sposo.email, last_sign_in_at: sposo.last_sign_in_at } : 'NOT FOUND')

if (sposo) {
  const { data: prof } = await sb.from('profiles').select('*').eq('id', sposo.id).maybeSingle()
  console.log('SPOSO PROFILE:', JSON.stringify(prof, null, 2))
  const { data: members } = await sb.from('wedding_couple_members').select('*').eq('user_id', sposo.id)
  console.log('SPOSO MEMBERSHIPS:', JSON.stringify(members, null, 2))
  if (members && members.length) {
    for (const m of members) {
      const { data: w } = await sb.from('entries').select('id, title, wedding_website_slug, wedding_website_published, date_from, quote_id').eq('id', m.entry_id).maybeSingle()
      console.log('  WEDDING:', JSON.stringify(w, null, 2))
    }
  }
}

// 3. unclaimed couple invite tokens
const { data: invites } = await sb.from('wedding_couple_members').select('id, entry_id, role, invite_token, claimed_at, invited_email').is('claimed_at', null).not('invite_token', 'is', null).limit(10)
console.log('UNCLAIMED INVITES:', JSON.stringify(invites, null, 2))

// 4. published wedding sites
const { data: sites } = await sb.from('entries').select('id, title, wedding_website_slug, wedding_website_published, date_from').eq('wedding_website_published', true).limit(10)
console.log('PUBLISHED SITES:', JSON.stringify(sites, null, 2))
