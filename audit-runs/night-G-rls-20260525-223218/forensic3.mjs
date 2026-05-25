// Extra checks: anon couple+contract token bypass attempts, public wedding site visibility, beta_status admin update
import { createClient } from '@supabase/supabase-js'
const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const PWD = 'Beta2026!'

const anon = createClient(URL, ANON, { auth: { persistSession: false } })

// Test wedding_site_rsvp RPC with bogus slug
{
  const r = await anon.rpc('wedding_site_rsvp', { p_slug: 'nonexistent', p_full_name: 'pwn', p_party_size: 1, p_rsvp: 'YES' })
  console.log('wedding_site_rsvp bogus:', r.data, '| err:', r.error?.message)
}
// Test with real published slug giovanni-e-pingu
{
  const r = await anon.rpc('wedding_site_rsvp', { p_slug: 'giovanni-e-pingu', p_full_name: 'anon-rsvp', p_party_size: 1, p_rsvp: 'YES' })
  console.log('wedding_site_rsvp giovanni-e-pingu:', r.data, '| err:', r.error?.message)
}

// Inspect supplier_invites visibility for non-target user
const fornAClient = createClient(URL, ANON, { auth: { persistSession: false } })
await fornAClient.auth.signInWithPassword({ email: 'forn-mini-foto@planfully-demo.it', password: PWD })
const allInvites = await fornAClient.from('supplier_invites').select('*').limit(10)
console.log(`FORN_A sees ${allInvites.data?.length} supplier_invites:`)
console.log(JSON.stringify(allInvites.data?.slice(0,3), null, 2))

// Can WP_A see profiles of un-collaborated fornitori? (should be only PUBLIC + own collaborators)
const wpA = createClient(URL, ANON, { auth: { persistSession: false } })
await wpA.auth.signInWithPassword({ email: 'wp-mini@planfully-demo.it', password: PWD })
const profs = await wpA.from('profiles').select('id,role,full_name,profile_visibility').limit(50)
console.log(`WP_A sees ${profs.data?.length} profiles, of which:`)
const byVis = {}
for (const p of profs.data || []) { byVis[p.profile_visibility] = (byVis[p.profile_visibility]||0)+1 }
console.log('  by visibility:', byVis)

// Couple C: list profiles
const couple = createClient(URL, ANON, { auth: { persistSession: false } })
await couple.auth.signInWithPassword({ email: 'giovanni.scozzafava+sposo@gmail.com', password: PWD })
const cP = await couple.from('profiles').select('id,role,full_name,profile_visibility').limit(50)
console.log(`COUPLE_C sees ${cP.data?.length} profiles`)

// supplier_invites: anon should NOT see
const anonInv = await anon.from('supplier_invites').select('*').limit(5)
console.log(`ANON sees ${anonInv.data?.length} supplier_invites: ${anonInv.error?.message}`)

// quote_views (public via token?)
const qV = await anon.from('quote_views').select('*').limit(5)
console.log(`ANON quote_views: ${qV.data?.length}, err: ${qV.error?.message}`)

// services list visibility for anon (catalog public?)
const svcs = await anon.from('services').select('*').limit(5)
console.log(`ANON services: ${svcs.data?.length}, err: ${svcs.error?.message}`)

// FORN_A reading wedding_couple_members of WP_A's wedding? Earlier 0 — let's confirm
const wcm = await fornAClient.from('wedding_couple_members').select('*').limit(20)
console.log(`FORN_A wedding_couple_members: ${wcm.data?.length}`)

// FORN_A reading event_documents bucket?
const stg = await fornAClient.storage.from('event-documents').list('', { limit: 5 })
console.log(`FORN_A event-documents list: ${stg.data?.length}, err: ${stg.error?.message}`)

// SVC: list event-documents to see if any exist
const svc = createClient(URL, SERVICE, { auth: { persistSession: false } })
const listSvc = await svc.storage.from('event-documents').list('', { limit: 10 })
console.log(`SVC event-documents top entries: ${listSvc.data?.length}`)
const listPdfs = await svc.storage.from('quote-pdfs').list('', { limit: 10 })
console.log(`SVC quote-pdfs top entries: ${listPdfs.data?.length}`)
const listSigs = await svc.storage.from('quote-signatures').list('', { limit: 10 })
console.log(`SVC quote-signatures top entries: ${listSigs.data?.length}`)

// Public bucket "service-photos" — anon list shouldn't be blocked but let's check
const sphAnon = await anon.storage.from('service-photos').list('', { limit: 5 })
console.log(`ANON service-photos list: ${sphAnon.data?.length}, err: ${sphAnon.error?.message}`)

// brand-assets public
const baAnon = await anon.storage.from('brand-assets').list('', { limit: 5 })
console.log(`ANON brand-assets list: ${baAnon.data?.length}, err: ${baAnon.error?.message}`)
