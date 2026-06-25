// Callback OAuth Google Calendar: scambia il code → token, CIFRA il refresh token e salva
// la connessione. Poi fa un primo sync degli impegni. Sola lettura (calendar.readonly).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encryptToken, hasKey } from '../_shared/drive-crypto.ts'
import { syncBusy } from '../_shared/gcal.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/gcal-oauth-callback`

function back(q: string) {
  return new Response(null, { status: 302, headers: { Location: `${APP_BASE}/profile?gcal=${q}` } })
}

Deno.serve(async (req) => {
  const u = new URL(req.url)
  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  if (u.searchParams.get('error')) return back('denied')
  if (!code || !state || !CLIENT_ID || !CLIENT_SECRET) return back('error')
  if (!hasKey()) return back('nokey')

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
    if (!d.refresh_token) return back('norefresh') // serve per i sync futuri (prompt=consent lo garantisce)

    const b64 = (x: Uint8Array) => btoa(String.fromCharCode(...x))
    const ref = b64(await encryptToken(d.refresh_token))

    await admin.from('google_calendar_connections').upsert({
      professional_id: st.professional_id,
      refresh_token_enc: ref,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'professional_id' })

    await admin.from('drive_oauth_states').delete().eq('state', state)
    try { await syncBusy(admin, st.professional_id) } catch { /* il primo sync può fallire, non blocca */ }
    return back('connected')
  } catch {
    return back('error')
  }
})
