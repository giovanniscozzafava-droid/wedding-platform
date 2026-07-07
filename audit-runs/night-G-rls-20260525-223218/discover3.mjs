import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
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
