import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV',
  { auth: { persistSession: false } })

// Wedding for sposo
const wid = '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea'
const { data: w, error: we } = await sb.from('entries').select('*').eq('id', wid).maybeSingle()
console.log('WEDDING ERR:', we, 'DATA:', JSON.stringify(w, null, 2))

// Find any entries (avoiding column filter)
const { data: list, error: le } = await sb.from('entries').select('id, title, kind, wedding_website_slug, wedding_website_published').limit(20)
console.log('ALL ENTRIES (20):', le, JSON.stringify(list, null, 2))

// Couple change requests table check
const { data: ccr, error: ce } = await sb.from('couple_change_requests').select('id, entry_id, status, kind, created_at').limit(5)
console.log('CCR err:', ce, 'sample:', JSON.stringify(ccr, null, 2))
