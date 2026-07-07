// Discover test users and resources for RLS audit
import { createClient } from '@supabase/supabase-js'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } })

async function main() {
  const out = {}

  // All WP profiles
  const wps = await sb.from('profiles').select('id,email,role,first_name,last_name').eq('role', 'WEDDING_PLANNER').limit(20)
  console.log('WPs:', wps.data?.length, wps.error)
  out.wps = wps.data || []

  // Fornitori
  const sups = await sb.from('profiles').select('id,email,role,first_name,last_name').in('role', ['FORNITORE','SUPPLIER']).limit(30)
  console.log('Suppliers:', sups.data?.length, sups.error)
  out.suppliers = sups.data || []

  // Couples
  const couples = await sb.from('profiles').select('id,email,role,first_name,last_name').in('role', ['COUPLE','SPOSO','SPOSA']).limit(30)
  console.log('Couples:', couples.data?.length, couples.error)
  out.couples = couples.data || []

  // Find demo users
  const mini = await sb.from('profiles').select('*').ilike('email', '%mini%').limit(20)
  console.log('Mini accounts:', mini.data?.length, mini.error)
  out.mini = mini.data || []

  // Schema sanity
  const tables = ['quotes','quote_items','contracts','weddings','calendar_entries','event_timeline','wedding_guests','wedding_tables','mood_images','playlist_items','checklist_items','wedding_transports','transport_assignments','wedding_accommodations','couple_preferences','couple_change_requests','supplier_clients','supplier_availability','supplier_services','profiles','collaborations','supplier_invites','wedding_couple_members','beta_status']
  const tblCheck = {}
  for (const t of tables) {
    const r = await sb.from(t).select('id', { count: 'exact', head: true }).limit(1)
    tblCheck[t] = { count: r.count, err: r.error?.message }
  }
  out.tableCheck = tblCheck
  console.log('Table check done')

  // Beta status
  const beta = await sb.from('beta_status').select('*').limit(5)
  console.log('beta_status:', beta.data, beta.error)
  out.beta = beta.data

  console.log(JSON.stringify(out, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
