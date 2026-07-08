// Edge function: album-exif
// Legge da Google Drive l'ORARIO DI SCATTO (EXIF imageMediaMetadata.time) + dimensioni reali delle
// foto di un evento, così l'impaginatore AI può ORDINARLE cronologicamente (sequenza vera del giorno).
//
// Chiamata dal fotografo (verify_jwt=true). Autorizza: chi chiama deve essere l'OWNER dell'evento.
// Riusa la connessione Drive dell'owner (refresh token cifrato) come album-image.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } }) }
const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:') && !id.startsWith('album:')

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length); let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]) } })
  await Promise.all(workers); return res
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { entryId?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const entryId = body.entryId
  if (!entryId) return json({ error: 'no_entry' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  // AUTORIZZAZIONE: chi chiama deve essere l'owner dell'evento.
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const { data: ures } = await userClient.auth.getUser()
  const uid = ures?.user?.id
  if (!uid) return json({ error: 'auth_required' }, 401)
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', entryId).maybeSingle()
  if (!gal) return json({ error: 'no_gallery' }, 404)
  if (gal.owner_id !== uid) return json({ error: 'forbidden' }, 403)

  // media Drive dell'evento
  const { data: media } = await admin.from('gallery_media').select('id, drive_file_id').eq('entry_id', entryId)
  const driveMedia = (media ?? []).filter((m) => isDrive(m.drive_file_id as string))
  if (!driveMedia.length) return json({ meta: {}, note: 'nessuna foto Drive' })

  // access token dell'owner
  const { data: conn } = await admin.from('drive_connections').select('refresh_token_enc').eq('professional_id', gal.owner_id).maybeSingle()
  if (!conn?.refresh_token_enc) return json({ error: 'no_drive' }, 409)
  let access: string | null = null
  try {
    const refresh = await decryptToken(Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)))
    const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
    const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
    access = (await tr.json()).access_token ?? null
  } catch { access = null }
  if (!access) return json({ error: 'drive_auth_failed' }, 502)

  // EXIF per file: time di scatto + createdTime (fallback) + dimensioni reali + NOME FILE originale
  // (il nome serve al fotografo per ritrovare le foto in Lightroom filtrando per nome file).
  const meta: Record<string, { takenAt: number | null; w: number | null; h: number | null; name: string | null }> = {}
  await pool(driveMedia, 8, async (m) => {
    const id = m.drive_file_id as string
    try {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,createdTime,imageMediaMetadata(time,width,height)&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${access}` } })
      if (!r.ok) { meta[m.id as string] = { takenAt: null, w: null, h: null, name: null }; return }
      const f = await r.json()
      const imm = f?.imageMediaMetadata ?? {}
      // imageMediaMetadata.time è "YYYY:MM:DD HH:MM:SS" → normalizzo a ISO
      let ts: number | null = null
      if (typeof imm.time === 'string') {
        const iso = imm.time.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T')
        const d = Date.parse(iso); if (!Number.isNaN(d)) ts = d
      }
      if (ts === null && typeof f?.createdTime === 'string') { const d = Date.parse(f.createdTime); if (!Number.isNaN(d)) ts = d }
      meta[m.id as string] = { takenAt: ts, w: imm.width ?? null, h: imm.height ?? null, name: (typeof f?.name === 'string' ? f.name : null) }
    } catch { meta[m.id as string] = { takenAt: null, w: null, h: null, name: null } }
  })

  const withTime = Object.values(meta).filter((x) => x.takenAt !== null).length
  return json({ meta, withTime, total: driveMedia.length })
})
