import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV',
  { auth: { persistSession: false } })

// Try common table names
for (const t of ['weddings','calendar_entries','events','budget_entries','wedding_entries']) {
  const { data, error } = await sb.from(t).select('id, title').limit(1)
  console.log(`[${t}]`, error ? error.message : `OK count=${data?.length}`)
}

// Check the membership table for the FK target
const { data: m } = await sb.from('wedding_couple_members').select('*').eq('entry_id', '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea').maybeSingle()
console.log('M:', JSON.stringify(m, null, 2))

// Try budget_entries with that id
const { data: be, error: bee } = await sb.from('budget_entries').select('*').eq('id', '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea').maybeSingle()
console.log('BE err:', bee, JSON.stringify(be, null, 2))
