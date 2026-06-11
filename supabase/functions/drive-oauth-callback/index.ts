// Callback OAuth Google Drive: scambia il code → token, li CIFRA (AES-GCM) e salva
// la connessione del professionista. I file restano sul suo Drive; Planfully tiene
// solo il token cifrato + i riferimenti.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encryptToken, hasKey } from '../_shared/drive-crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/drive-oauth-callback`

function back(q: string) {
  return new Response(null, { status: 302, headers: { Location: `${APP_BASE}/profile?drive=${q}` } })
}

Deno.serve(async (req) => {
  const u = new URL(req.url)
  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  if (u.searchParams.get('error')) return back('denied')
  if (!code || !state || !CLIENT_ID || !CLIENT_SECRET) return back('error')
  if (!hasKey()) return back('nokey')   // fail-closed: senza chiave NON salviamo token

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: st } = await admin.from('drive_oauth_states').select('professional_id').eq('state', state).maybeSingle()
  if (!st?.professional_id) return back('badstate')

  try {
    const form = new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code,
      grant_type: 'authorization_code', redirect_uri: REDIRECT_URI,
    })
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form,
    })
    const d = await r.json()
    if (!r.ok || !d.access_token) return back('token')

    const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
    const acc = b64(await encryptToken(d.access_token))
    const ref = d.refresh_token ? b64(await encryptToken(d.refresh_token)) : null

    await admin.from('drive_connections').upsert({
      professional_id: st.professional_id,
      provider: 'google_drive',
      access_token_enc: acc,                 // base64(AES-GCM)
      refresh_token_enc: ref,
      scope: 'drive.file',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'professional_id,provider' })

    await admin.from('drive_oauth_states').delete().eq('state', state)
    return back('connected')
  } catch {
    return back('error')
  }
})
