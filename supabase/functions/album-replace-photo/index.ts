// Sostituisce UNA foto impaginata caricando la versione ricolorata SU GOOGLE DRIVE
// (nuovo file nella stessa cartella dell'originale), ripunta il media all'id Drive nuovo e
// manda il vecchio nel cestino di Drive (o elimina l'oggetto storage se era una vecchia
// sostituzione). Così la foto sostituita resta una foto Drive → miniatura leggera (sz=w800)
// e orientamento corretto, esattamente come tutte le altre. La stampa/export non cambia.
//
// Ordine SICURO: crea il nuovo file + verifica + ripunta il media PRIMA di toccare il vecchio.
// Se qualcosa fallisce prima del ripuntamento, nulla viene perso.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const BUCKET = 'event-guest-uploads'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })

async function driveAccessToken(admin: ReturnType<typeof createClient>, ownerId: string): Promise<string | null> {
  const { data: conn } = await admin.from('drive_connections').select('refresh_token_enc').eq('professional_id', ownerId).maybeSingle()
  if (!conn?.refresh_token_enc) return null
  try {
    const refresh = await decryptToken(Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)))
    const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
    const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
    return (await tr.json()).access_token ?? null
  } catch { return null }
}

const isDriveId = (id: string) => !!id && !id.startsWith('album:') && !id.startsWith('guest:') && !id.startsWith('demo-')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  // Auth: l'utente deve essere il proprietario della galleria (di cui è il Drive) o staff.
  const authHeader = req.headers.get('authorization') ?? ''
  const { data: ud } = authHeader.startsWith('Bearer ') ? await admin.auth.getUser(authHeader.slice(7)) : { data: null }
  const uid = ud?.user?.id
  if (!uid) return json({ error: 'unauthorized' }, 401)

  // Due modalità: (A) multipart con `file` = ri-sostituzione con la ricolorata caricata dal browser;
  // (B) JSON {media_id} = migrazione su Drive di una foto già su storage (album:), senza re-upload.
  let mediaId = ''
  let file: File | null = null
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    if (!form) return json({ error: 'bad_form' }, 400)
    const f = form.get('file'); if (f instanceof File) file = f
    mediaId = String(form.get('media_id') ?? '')
  } else {
    const body = await req.json().catch(() => ({})) as { media_id?: string }
    mediaId = String(body.media_id ?? '')
  }
  if (!mediaId) return json({ error: 'missing_media_id' }, 400)

  const { data: media } = await admin.from('gallery_media').select('id, gallery_id, drive_file_id, media_type, source_name').eq('id', mediaId).maybeSingle()
  if (!media) return json({ error: 'media_not_found' }, 404)
  const { data: gal } = await admin.from('event_galleries').select('owner_id, drive_folder_id').eq('id', media.gallery_id).maybeSingle()
  if (!gal) return json({ error: 'gallery_not_found' }, 404)
  if (gal.owner_id !== uid) {
    const { data: prof } = await admin.from('profiles').select('is_support_staff').eq('id', uid).maybeSingle()
    if (!prof?.is_support_staff) return json({ error: 'forbidden' }, 403)
  }

  const access = await driveAccessToken(admin, gal.owner_id as string)
  if (!access) return json({ error: 'no_drive' }, 409)

  const oldId = String(media.drive_file_id ?? '')
  const oldIsDrive = isDriveId(oldId)

  // Cartella target: il parent reale del vecchio file Drive; altrimenti la cartella della galleria.
  let parent: string | null = (gal.drive_folder_id as string | null) ?? null
  if (oldIsDrive) {
    try {
      const g = await fetch(`https://www.googleapis.com/drive/v3/files/${oldId}?fields=parents&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${access}` } })
      const gj = await g.json()
      if (Array.isArray(gj?.parents) && gj.parents[0]) parent = gj.parents[0]
    } catch { /* uso il fallback */ }
  }

  // Sorgente dei byte: dal file caricato (ri-sostituzione) oppure dall'oggetto storage (migrazione).
  let bytes: Uint8Array, name: string, ctype: string
  if (file) {
    bytes = new Uint8Array(await file.arrayBuffer()); name = file.name || 'ricolorata.jpg'; ctype = file.type || 'image/jpeg'
  } else if (oldId.startsWith('album:')) {
    const dl = await admin.storage.from(BUCKET).download(oldId.slice('album:'.length))
    if (dl.error || !dl.data) return json({ error: 'storage_download_failed', detail: dl.error?.message }, 502)
    bytes = new Uint8Array(await dl.data.arrayBuffer())
    name = (media.source_name as string | null) || (oldId.split('/').pop() || 'foto.jpg')
    ctype = dl.data.type || 'image/jpeg'
  } else {
    return json({ error: 'nothing_to_upload' }, 400) // già su Drive: niente da migrare/sostituire
  }

  // 1) CREA il nuovo file su Drive (resumable) — supporta anche file > 5 MB.
  const meta: Record<string, unknown> = { name, ...(parent ? { parents: [parent] } : {}) }
  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': ctype },
    body: JSON.stringify(meta),
  })
  if (!initRes.ok) return json({ error: 'drive_init_failed', status: initRes.status, detail: (await initRes.text()).slice(0, 300) }, 502)
  const session = initRes.headers.get('location')
  if (!session) return json({ error: 'no_upload_session' }, 502)

  const put = await fetch(session, { method: 'PUT', headers: { 'Content-Type': ctype }, body: bytes })
  if (!put.ok) return json({ error: 'drive_upload_failed', status: put.status, detail: (await put.text()).slice(0, 300) }, 502)
  const created = await put.json().catch(() => null)
  const newId = created?.id as string | undefined
  if (!newId) return json({ error: 'no_new_file_id' }, 502)

  // Permesso pubblico "chiunque con il link" sul nuovo file (best-effort): così la thumbnail
  // drive.google.com/thumbnail?id=… è visibile in editor come per le altre foto. In genere il
  // file eredita già la condivisione della cartella; questo è cintura+bretelle.
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${newId}/permissions?supportsAllDrives=true`, {
      method: 'POST', headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    })
  } catch { /* best-effort */ }

  // 2) RIPUNTA il media al nuovo file Drive (miniatura leggera). Stesso media id → ritaglio/posizione invariati.
  const thumb = `https://drive.google.com/thumbnail?id=${newId}&sz=w800`
  const { error: upErr } = await admin.from('gallery_media').update({ drive_file_id: newId, thumbnail_link: thumb }).eq('id', mediaId)
  if (upErr) return json({ error: 'db_update_failed', detail: upErr.message }, 500)

  // 3) PULISCI il vecchio (best-effort, DOPO il ripuntamento): Drive → cestino; storage → elimina oggetto.
  try {
    if (oldIsDrive) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${oldId}?supportsAllDrives=true`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }),
      })
    } else if (oldId.startsWith('album:')) {
      await admin.storage.from(BUCKET).remove([oldId.slice('album:'.length)])
    }
  } catch { /* best-effort: se fallisce, il vecchio resta ma l'album è già a posto */ }

  return json({ ok: true, media_id: mediaId, drive_file_id: newId, thumbnail_link: thumb })
})
