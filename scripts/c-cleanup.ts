import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M',
  { auth: { persistSession: false } })

const PREFIX = 'AGENT-C-'

// mood_images
const { data: m1, error: e1 } = await sb.from('mood_images').delete().like('caption', `${PREFIX}%`).select()
console.log('mood_images by caption:', e1?.message, 'rows:', m1?.length)
const { data: m1b, error: e1b } = await sb.from('mood_images').delete().like('source_url', `%${PREFIX}%`).select()
console.log('mood_images by source_url:', e1b?.message, 'rows:', m1b?.length)
const { data: m1c, error: e1c } = await sb.from('mood_images').delete().like('url', `%${PREFIX}%`).select()
console.log('mood_images by url:', e1c?.message, 'rows:', m1c?.length)

// event_playlist
const { data: p1, error: pe1 } = await sb.from('event_playlist').delete().like('song_title', `${PREFIX}%`).select()
console.log('event_playlist by song_title:', pe1?.message, 'rows:', p1?.length)

// wedding_couple_members
const { data: cm, error: cme } = await sb.from('wedding_couple_members').delete().like('full_name', `${PREFIX}%`).select()
console.log('wedding_couple_members by full_name:', cme?.message, 'rows:', cm?.length)
const { data: cm2, error: cme2 } = await sb.from('wedding_couple_members').delete().like('email', `${PREFIX}%`).select()
console.log('wedding_couple_members by email:', cme2?.message, 'rows:', cm2?.length)

// couple_change_requests, prefix con title
const { data: cr, error: cre } = await sb.from('couple_change_requests').delete().like('prefill_title', `${PREFIX}%`).select()
console.log('couple_change_requests by prefill_title:', cre?.message, 'rows:', cr?.length)
