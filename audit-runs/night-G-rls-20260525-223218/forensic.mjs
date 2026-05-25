// Forensic dive into the failed cells
import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'
const PWD = 'Beta2026!'

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const r = await c.auth.signInWithPassword({ email, password: PWD })
  if (r.error) throw r.error
  return c
}

const wpA = await login('wp-mini@planfully-demo.it')
const fornA = await login('forn-mini-foto@planfully-demo.it')
const fornB = await login('forn-mini-fiori@planfully-demo.it')
const couple = await login('giovanni.scozzafava+sposo@gmail.com')

console.log('\n--- Leak 1: WP_A reads FORN_A supplier_availability ---')
{
  const r = await wpA.from('supplier_availability').select('*').eq('id', 'b589c2c2-b8d5-4e66-a536-a2a4f121fdbb')
  console.log('Rows:', r.data?.length, 'Err:', r.error?.message)
  console.log(JSON.stringify(r.data, null, 2))
  // can WP_A read ALL forn-A availability?
  const all = await wpA.from('supplier_availability').select('id,fornitore_id,date,status').eq('fornitore_id', '747707fe-03be-4bb8-95b8-17b43b465526').limit(5)
  console.log('All FORN_A availability via WP_A:', all.data?.length, all.error?.message)
  // and a random non-collaborator? WP_A and FORN_A — check if collaboration exists
  // also test a totally unrelated supplier
  const rand = await wpA.from('supplier_availability').select('id,fornitore_id,date').eq('fornitore_id', 'a0e1b3a9-0fee-4bc4-8548-db8fe289ac07').limit(3)
  console.log('Random forn-beta-fotografo availability via WP_A:', rand.data?.length)
}

console.log('\n--- Leak 2: FORN_B reads WP_A calendar_entries ---')
{
  // FORN_B has items in quote de516480 which is WP_A's "Paolo e Francesca". cal entry 1c55dd47 is linked to that quote.
  const r = await fornB.from('calendar_entries').select('*').eq('id', '1c55dd47-e31f-4caa-a0d1-bc94d6c9a3bf')
  console.log('Rows:', r.data?.length, 'Err:', r.error?.message)
  console.log(JSON.stringify(r.data, null, 2))
  // Can FORN_B list ALL calendar_entries?
  const all = await fornB.from('calendar_entries').select('id,owner_id,title,client_email,client_name').limit(20)
  console.log(`FORN_B sees ${all.data?.length} calendar_entries:`)
  for (const e of all.data || []) console.log('  -', e.id, e.title, '| owner:', e.owner_id, '| client:', e.client_email)
}

console.log('\n--- Leak 3: FORN_B reads event_playlist of WP_A entry ---')
{
  const r = await fornB.from('event_playlist').select('*').eq('id', 'eb2f216d-ced9-4406-884d-2056a5cbd901')
  console.log('Rows:', r.data?.length, 'Err:', r.error?.message)
  console.log(JSON.stringify(r.data, null, 2))
  // Can FORN_B list ALL event_playlist?
  const all = await fornB.from('event_playlist').select('id,entry_id,song_title').limit(20)
  console.log(`FORN_B sees ${all.data?.length} event_playlist rows`)
}

console.log('\n--- Probe other event_* tables for FORN_B leak ---')
{
  for (const t of ['event_guests','event_tables','mood_images','wedding_tasks','event_transport','event_accommodations','event_timeline','couple_preferences','contracts','wedding_couple_members']) {
    const r = await fornB.from(t).select('*').limit(20)
    console.log(`  ${t}: ${r.data?.length ?? 0} rows, err=${r.error?.message}`)
  }
}

console.log('\n--- Same probe for FORN_A (uninvolved supplier) ---')
{
  for (const t of ['calendar_entries','event_guests','event_tables','mood_images','event_playlist','wedding_tasks','event_transport','event_accommodations','event_timeline','couple_preferences','contracts','wedding_couple_members']) {
    const r = await fornA.from(t).select('*').limit(20)
    console.log(`  ${t}: ${r.data?.length ?? 0} rows, err=${r.error?.message}`)
  }
}

console.log('\n--- Same probe for COUPLE_C (only own wedding allowed) ---')
{
  for (const t of ['calendar_entries','event_guests','event_tables','mood_images','event_playlist','wedding_tasks','event_transport','event_accommodations','event_timeline','couple_preferences','contracts','wedding_couple_members','quotes','quote_items']) {
    const r = await couple.from(t).select('*').limit(20)
    console.log(`  ${t}: ${r.data?.length ?? 0} rows`)
  }
}

console.log('\n--- FORN_B write attempts on the leaked tables ---')
{
  // Can FORN_B UPDATE the calendar entry it leaked?
  const u1 = await fornB.from('calendar_entries').update({ notes: 'PWN-attempt-fornB' }).eq('id', '1c55dd47-e31f-4caa-a0d1-bc94d6c9a3bf').select()
  console.log('UPDATE cal entry:', u1.data?.length, 'rows |', 'err=', u1.error?.message)
  // INSERT a playlist row on WP_A entry
  const i1 = await fornB.from('event_playlist').insert({ entry_id: '1c55dd47-e31f-4caa-a0d1-bc94d6c9a3bf', moment: 'CERIMONIA', song_title: 'INJECTED-BY-FORNB' }).select()
  console.log('INSERT playlist:', i1.data?.length, 'err=', i1.error?.message)
  // DELETE leaked playlist
  const d1 = await fornB.from('event_playlist').delete().eq('id', 'eb2f216d-ced9-4406-884d-2056a5cbd901').select()
  console.log('DELETE playlist:', d1.data?.length, 'err=', d1.error?.message)
}
