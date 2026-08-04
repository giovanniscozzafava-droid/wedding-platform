// Edge function: gisko-assets
// Ponte PRIVATO fra la selezione del FOTOGRAFO su Planfully (gallery_media.pick_photographer)
// e la libreria asset del suo sito personale (gisko.net).
//
// Due azioni, entrambe riservate all'owner degli eventi (JWT utente, nessun accesso anonimo):
//   POST {action:'list'}       -> elenco delle foto che il fotografo ha messo nella SUA selezione
//   GET  ?m=<media_id>         -> i byte dell'ORIGINALE, letti da Google Drive col token dell'owner
//
// Le foto NON vivono su Planfully: in gallery_media c'e' solo drive_file_id. Il full-res si
// recupera da Drive rinfrescando il refresh_token cifrato in drive_connections, come fa album-image.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:')

type Row = {
  id: string
  entry_id: string
  drive_file_id: string
  thumbnail_link: string | null
  media_type: string
  album_moment: string | null
  guest_tag_name: string | null
  no_minors: boolean | null
  pick_photographer: boolean | null
  carousel_pick: boolean | null
  created_at: string
  calendar_entries: { id: string; title: string; date_from: string; owner_id: string; site_export: boolean } | null
}

/** Access token Drive dell'owner, dal refresh token cifrato. */
async function driveAccessToken(admin: ReturnType<typeof createClient>, ownerId: string): Promise<string | null> {
  const { data: conn } = await admin
    .from('drive_connections')
    .select('refresh_token_enc')
    .eq('professional_id', ownerId)
    .maybeSingle()
  if (!conn?.refresh_token_enc) return null
  try {
    const refresh = await decryptToken(
      Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)),
    )
    const form = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    })
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    return (await tr.json()).access_token ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authH = req.headers.get('Authorization') ?? ''
  if (!authH.startsWith('Bearer ')) return json({ ok: false, error: 'auth' }, 401)
  const { data: cu } = await admin.auth.getUser(authH.slice(7))
  const uid = cu?.user?.id
  if (!uid) return json({ ok: false, error: 'auth' }, 401)

  // ---------- GET ?m=<media_id> : byte dell'originale ----------
  if (req.method === 'GET') {
    const mediaId = new URL(req.url).searchParams.get('m') ?? ''
    if (!mediaId) return json({ ok: false, error: 'no_media' }, 400)

    const { data: m } = await admin
      .from('gallery_media')
      .select('id, entry_id, drive_file_id, thumbnail_link, pick_photographer, carousel_pick')
      .eq('id', mediaId)
      .maybeSingle()
    if (!m) return json({ ok: false, error: 'not_found' }, 404)
    if (!m.pick_photographer && !m.carousel_pick) return json({ ok: false, error: 'not_picked' }, 403)

    // l'evento deve essere suo: nessuno scarica gli originali di un altro professionista
    const { data: entry } = await admin
      .from('calendar_entries')
      .select('owner_id, site_export')
      .eq('id', m.entry_id)
      .maybeSingle()
    if (!entry || entry.owner_id !== uid) return json({ ok: false, error: 'forbidden' }, 403)
    // stesso vincolo dell'elenco: senza flag sull'evento non esce nessun originale
    if (!entry.site_export) return json({ ok: false, error: 'event_not_enabled' }, 403)

    const imgHeaders = (ct: string) => ({ ...CORS, 'Content-Type': ct, 'Cache-Control': 'private, max-age=600' })

    // media non-Drive (caricati da ospiti / demo): il file pubblico e' gia' l'originale
    if (!isDrive(m.drive_file_id as string)) {
      const link = m.thumbnail_link as string | null
      if (!link) return json({ ok: false, error: 'no_source' }, 404)
      const r = await fetch(link)
      if (!r.ok) return json({ ok: false, error: 'fetch_failed' }, 502)
      return new Response(r.body, { headers: imgHeaders(r.headers.get('content-type') ?? 'image/jpeg') })
    }

    const access = await driveAccessToken(admin, uid)
    if (!access) return json({ ok: false, error: 'no_drive' }, 409)
    const dr = await fetch(`https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?alt=media`, {
      headers: { Authorization: `Bearer ${access}` },
    })
    if (!dr.ok) {
      const fb = await fetch(`https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w2400`)
      if (fb.ok) return new Response(fb.body, { headers: imgHeaders('image/jpeg') })
      return json({ ok: false, error: 'drive_fetch_failed' }, 502)
    }
    return new Response(dr.body, { headers: imgHeaders(dr.headers.get('content-type') ?? 'image/jpeg') })
  }

  // ---------- POST {action:'list'} : la mia selezione, tutti i miei eventi ----------
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405)

  // PostgREST tronca a 1000 righe per risposta: senza paginare, una selezione
  // grande sembrerebbe finire tonda a 1000 e il resto sparirebbe in silenzio.
  const PAGE = 1000
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('gallery_media')
      .select(
        'id, entry_id, drive_file_id, thumbnail_link, media_type, album_moment, guest_tag_name, no_minors, pick_photographer, carousel_pick, created_at, calendar_entries!inner(id, title, date_from, owner_id, site_export)',
      )
      // le selezioni del fotografo sono due e sono entrambe sue: il cuore
      // dell'impaginatore e quella del carosello. Vale l'unione.
      .or('pick_photographer.eq.true,carousel_pick.eq.true')
      .eq('media_type', 'PHOTO')
      .eq('calendar_entries.owner_id', uid)
      // due condizioni, non una: l'evento dev'essere abilitato al sito E la foto scelta
      .eq('calendar_entries.site_export', true)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return json({ ok: false, error: 'query', detail: error.message }, 500)
    const batch = (data ?? []) as unknown as Row[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  const photos = rows.map((r) => ({
    id: r.id,
    entry_id: r.entry_id,
    event_title: r.calendar_entries?.title ?? null,
    event_date: r.calendar_entries?.date_from ?? null,
    moment: r.album_moment,
    subject: r.guest_tag_name,
    no_minors: !!r.no_minors,
    // da quale delle tue selezioni arriva: serve a capirlo dal manifest, mesi dopo
    picks: [r.pick_photographer ? 'cuore' : null, r.carousel_pick ? 'carosello' : null].filter(Boolean),
    is_drive: isDrive(r.drive_file_id),
    thumbnail: r.thumbnail_link,
  }))

  return json({ ok: true, count: photos.length, photos })
})
