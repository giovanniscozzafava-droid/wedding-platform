import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M',
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
