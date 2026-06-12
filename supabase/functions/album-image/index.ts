// Proxy immagine per l'export album in ALTA RISOLUZIONE.
// Riceve una richiesta <img> (?t=grant&m=media_id), verifica il grant a tempo, e
// restituisce l'ORIGINALE da Google Drive (col token dell'owner) — oppure il file
// pubblico per i media non-Drive (demo/ospiti). CORS aperto → niente canvas tainted.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const u = new URL(req.url)
  const token = u.searchParams.get('t') ?? ''
  const mediaId = u.searchParams.get('m') ?? ''
  if (!token || !mediaId) return new Response('bad_request', { status: 400, headers: cors })

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  // 1) grant valido?
  const { data: grant } = await admin.from('album_export_grants').select('entry_id, expires_at').eq('token', token).maybeSingle()
  if (!grant) return new Response('forbidden', { status: 403, headers: cors })
  if (new Date(grant.expires_at as string).getTime() < Date.now()) return new Response('expired', { status: 403, headers: cors })

  // 2) il media appartiene davvero all'evento del grant?
  const { data: m } = await admin.from('gallery_media').select('entry_id, drive_file_id, thumbnail_link, media_type').eq('id', mediaId).maybeSingle()
  if (!m || m.entry_id !== grant.entry_id) return new Response('forbidden', { status: 403, headers: cors })

  const imgHeaders = (ct: string) => ({ ...cors, 'Content-Type': ct, 'Cache-Control': 'private, max-age=600' })

  // 3a) non-Drive (demo/ospiti) → file pubblico
  if (!isDrive(m.drive_file_id as string)) {
    const link = m.thumbnail_link as string | null
    if (!link) return new Response('no_source', { status: 404, headers: cors })
    const r = await fetch(link)
    if (!r.ok) return new Response('fetch_failed', { status: 502, headers: cors })
    return new Response(r.body, { headers: imgHeaders(r.headers.get('content-type') ?? 'image/jpeg') })
  }

  // 3b) Drive → ORIGINALE col token dell'owner della galleria
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', grant.entry_id).maybeSingle()
  if (!gal) return new Response('no_gallery', { status: 404, headers: cors })
  const { data: conn } = await admin.from('drive_connections').select('refresh_token_enc').eq('professional_id', gal.owner_id).maybeSingle()
  if (!conn?.refresh_token_enc) return new Response('no_drive', { status: 409, headers: cors })
  let access: string | null = null
  try {
    const refresh = await decryptToken(Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)))
    const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
    const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
    access = (await tr.json()).access_token ?? null
  } catch { access = null }
  if (!access) return new Response('drive_auth_failed', { status: 502, headers: cors })

  const dr = await fetch(`https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?alt=media`, { headers: { Authorization: `Bearer ${access}` } })
  if (!dr.ok) {
    // fallback al thumbnail grande, meglio di niente
    const fb = await fetch(`https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w2400`)
    if (fb.ok) return new Response(fb.body, { headers: imgHeaders('image/jpeg') })
    return new Response('drive_fetch_failed', { status: 502, headers: cors })
  }
  return new Response(dr.body, { headers: imgHeaders(dr.headers.get('content-type') ?? 'image/jpeg') })
})
