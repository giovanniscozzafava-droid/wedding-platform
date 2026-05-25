// Final confirmation: FORN_A leakage on Giovanni e Pingu (no items, no participant) — pure cross-tenant via collab to WP
import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'
const PWD = 'Beta2026!'

const fa = createClient(URL, ANON, { auth: { persistSession: false } })
await fa.auth.signInWithPassword({ email: 'forn-mini-foto@planfully-demo.it', password: PWD })

const PINGU = '7a19a8a2-75a8-4ffe-8eb5-f155785e9dea'  // Giovanni e Pingu (zero participants)
const r = await fa.from('calendar_entries').select('*').eq('id', PINGU)
console.log('FORN_A reads Giovanni e Pingu:', r.data?.length, r.data?.[0]?.client_email, r.data?.[0]?.value_amount)

// Read all of wp-mini's weddings
const all = await fa.from('calendar_entries').select('id,title,owner_id,client_name,client_email,value_amount').eq('owner_id', '712baed0-3957-4452-8aab-ab4eeebb2697')
console.log(`FORN_A reads ${all.data?.length} wp-mini weddings`)
for (const w of all.data || []) console.log(`  - ${w.title} | ${w.client_email} | value=${w.value_amount}`)

// Test event_guests of Giovanni e Pingu
const g = await fa.from('event_guests').select('*').eq('entry_id', PINGU).limit(5)
console.log(`FORN_A reads event_guests of Giovanni e Pingu: ${g.data?.length}`)
for (const x of g.data || []) console.log(`  - ${x.full_name} (${x.email}) rsvp=${x.rsvp}`)

// Test event_tables of Giovanni e Pingu
const t = await fa.from('event_tables').select('*').eq('entry_id', PINGU)
console.log(`FORN_A reads event_tables of Giovanni e Pingu: ${t.data?.length}`)

// event_transport & accommodation
const tr = await fa.from('event_transport').select('*').eq('entry_id', PINGU)
console.log(`FORN_A reads event_transport of Giovanni e Pingu: ${tr.data?.length}`)
const ac = await fa.from('event_accommodations').select('*').eq('entry_id', PINGU)
console.log(`FORN_A reads event_accommodations of Giovanni e Pingu: ${ac.data?.length}`)

// couple_preferences — separate policy?
const cp = await fa.from('couple_preferences').select('*').eq('entry_id', PINGU)
console.log(`FORN_A reads couple_preferences of Giovanni e Pingu: ${cp.data?.length}, err: ${cp.error?.message}`)

// mood_images
const mi = await fa.from('mood_images').select('*').eq('entry_id', PINGU)
console.log(`FORN_A reads mood_images of Giovanni e Pingu: ${mi.data?.length}`)

// wedding_tasks
const wt = await fa.from('wedding_tasks').select('*').eq('entry_id', PINGU)
console.log(`FORN_A reads wedding_tasks of Giovanni e Pingu: ${wt.data?.length}`)

// contracts of Giovanni e Pingu (not WP_A's "Paolo")
const co = await fa.from('contracts').select('*').eq('entry_id', PINGU)
console.log(`FORN_A reads contracts of Giovanni e Pingu: ${co.data?.length}, err: ${co.error?.message}`)
