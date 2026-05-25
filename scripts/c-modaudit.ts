import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M',
  { auth: { persistSession: false } })

// list cols
const { data } = await sb.from('couple_change_requests').select('*').limit(1)
console.log('CR sample cols:', data && data[0] ? Object.keys(data[0]) : 'empty')

// list mood images for our wedding
const { data: m } = await sb.from('mood_images').select('id,caption,url,source_url,source,created_at').eq('entry_id', '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea').order('created_at', { ascending: false }).limit(5)
console.log('mood:', JSON.stringify(m, null, 2))

// list playlists
const { data: p } = await sb.from('event_playlist').select('*').eq('entry_id', '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea').order('created_at', { ascending: false }).limit(5)
console.log('playlist:', JSON.stringify(p, null, 2))
