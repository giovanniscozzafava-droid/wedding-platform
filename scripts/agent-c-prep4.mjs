import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV',
  { auth: { persistSession: false } })

const { data, error } = await sb.from('calendar_entries').select('*').eq('id', '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea').maybeSingle()
console.log('CE err:', error, JSON.stringify(data, null, 2))
