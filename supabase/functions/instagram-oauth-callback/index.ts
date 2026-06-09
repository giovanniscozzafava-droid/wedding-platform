// Callback OAuth Instagram: scambia il code → token long-lived, salva la
// connessione del professionista, poi reindirizza in app.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IG_APP_ID = Deno.env.get('INSTAGRAM_APP_ID') ?? ''
const IG_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') ?? ''
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/instagram-oauth-callback`

function back(q: string) {
  return new Response(null, { status: 302, headers: { Location: `${APP_BASE}/blog/admin?ig=${q}` } })
}

Deno.serve(async (req) => {
  const u = new URL(req.url)
  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  if (u.searchParams.get('error')) return back('denied')
  if (!code || !state || !IG_APP_ID || !IG_APP_SECRET) return back('error')

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: st } = await admin.from('instagram_oauth_states').select('profile_id').eq('state', state).maybeSingle()
  if (!st?.profile_id) return back('badstate')

  try {
    // 1) code → short-lived token
    const form = new URLSearchParams({ client_id: IG_APP_ID, client_secret: IG_APP_SECRET, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI, code })
    const r1 = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
    const d1 = await r1.json()
    if (!r1.ok || !d1.access_token) return back('token1')

    // 2) short → long-lived (60gg)
    const r2 = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${d1.access_token}`)
    const d2 = await r2.json()
    const token = d2.access_token ?? d1.access_token
    const expiresAt = d2.expires_in ? new Date(Date.now() + d2.expires_in * 1000).toISOString() : null

    // 3) profilo (username)
    const r3 = await fetch(`https://graph.instagram.com/me?fields=user_id,username&access_token=${token}`)
    const d3 = await r3.json()

    await admin.from('instagram_connections').upsert({
      profile_id: st.profile_id, ig_user_id: String(d3.user_id ?? d1.user_id ?? ''), username: d3.username ?? null,
      access_token: token, token_expires_at: expiresAt, updated_at: new Date().toISOString(),
    })
    await admin.from('instagram_oauth_states').delete().eq('state', state)
    return back('connected')
  } catch {
    return back('error')
  }
})
