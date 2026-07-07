// Inspect calendar_entry_participants and verify the leak surface
import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } })

const FORN_A = '747707fe-03be-4bb8-95b8-17b43b465526'
const FORN_B = 'a0262dd1-f07c-4359-a9c0-1186e98971a3'

const p = await sb.from('calendar_entry_participants').select('*')
console.log(`Total participants: ${p.data?.length}`)
const fornA = p.data?.filter(x => x.user_id === FORN_A)
const fornB = p.data?.filter(x => x.user_id === FORN_B)
console.log('FORN_A participants:', fornA)
console.log('FORN_B participants:', fornB)

// Inspect schema
const all = await sb.from('calendar_entry_participants').select('*').limit(20)
console.log('Sample participants:', all.data)

// Cross-reference: which entries does FORN_A see (via Forensic showed 4)? Are participants only those 4?
const wpA_entries = ['c1b8b3bc-d3a0-4398-8f95-32aa81aa5c60', '242e454f-c3cd-4d77-aa2c-d86bd4bc34a5', '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea', '1c55dd47-e31f-4caa-a0d1-bc94d6c9a3bf']
for (const e of wpA_entries) {
  const parts = p.data?.filter(x => x.entry_id === e)
  console.log(`Entry ${e}: ${parts?.length} participants:`, parts?.map(x => `${x.user_id}(${x.role||x.kind||''})`).join(','))
}
