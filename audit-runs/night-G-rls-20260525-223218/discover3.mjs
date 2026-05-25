import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } })

async function dump(name) {
  const r = await sb.from(name).select('*').limit(2)
  console.log(`\n=== ${name} ===`)
  if (r.error) { console.log('ERR:', r.error.message); return }
  if (!r.data || !r.data.length) { console.log('(empty)'); return }
  console.log('cols:', Object.keys(r.data[0]).join(','))
  console.log(JSON.stringify(r.data[0], null, 2))
}

for (const t of ['profiles','quotes','quote_items','quote_views','contracts','calendar_entries','event_timeline','event_guests','event_tables','mood_images','event_playlist','wedding_tasks','event_transport','event_transport_assignments','event_accommodations','couple_preferences','couple_change_requests','supplier_clients','supplier_availability','services','collaborations','supplier_invites','wedding_couple_members','beta_status','event_subevents','event_gadgets']) {
  await dump(t)
}
