#!/usr/bin/env node
// Test diretto edge function invite-supplier.
import { createClient } from '@supabase/supabase-js'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'

const sb = createClient(URL, SERVICE, { auth: { persistSession: false } })

// Sign in as wp-mini
const wpEmail = 'wp-mini@planfully-demo.it'
const { data: ses, error } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: wpEmail,
})
if (error) { console.error('genLink:', error); process.exit(1) }

// Get user session via signInWithPassword
const sbAnon = createClient(URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64',
  { auth: { persistSession: false } })
const { data: sess, error: sErr } = await sbAnon.auth.signInWithPassword({ email: wpEmail, password: 'Beta2026!' })
if (sErr) { console.error('signin:', sErr); process.exit(1) }

const token = sess.session.access_token
const targetEmail = process.argv[2] ?? `test+${Date.now()}@mailinator.com`

console.log(`\n→ Invio invito a: ${targetEmail}`)

const r = await fetch(`${URL}/functions/v1/invite-supplier`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64',
  },
  body: JSON.stringify({ email: targetEmail, subrole: 'fotografo' }),
})
const text = await r.text()
console.log(`\nStatus: ${r.status}`)
console.log(`Body: ${text}`)
