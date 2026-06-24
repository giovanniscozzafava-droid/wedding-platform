// Dedup foto galleria PER NOME FILE: la stessa foto caricata più volte diventa più file
// Drive distinti (stesso nome, id diversi). Qui li raggruppiamo per (cartella, nome) e
// togliamo i doppioni INERTI — senza like, senza commento, senza scelta album — cestinando
// il file Drive e cancellando la riga. Si tiene SEMPRE almeno una copia, e ogni copia con
// like/commento/scelta non viene MAI toccata. dry_run=true → solo conteggio, niente modifiche.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:')

type Row = { id: string; folder_id: string; drive_file_id: string; album_choice: string | null; created_at: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const body = (await req.json().catch(() => ({}))) as { entry_id?: string; confirm?: boolean }
  const entry_id = body.entry_id
  const doDelete = body.confirm === true
  if (!entry_id) return json({ error: 'no_entry' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', entry_id).maybeSingle()
  if (!gal) return json({ error: 'no_gallery' }, 404)
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (gal.owner_id !== user.id && prof?.role !== 'ADMIN') return json({ error: 'forbidden' }, 403)

  // 1) cartelle dell'evento
  const { data: folders } = await admin.from('gallery_folders').select('id, drive_folder_id').eq('entry_id', entry_id)
  const driveFolderById = new Map<string, string>()
  for (const f of (folders ?? []) as { id: string; drive_folder_id: string | null }[]) if (f.drive_folder_id) driveFolderById.set(f.id, f.drive_folder_id)

  // 2) tutte le righe media (paginate: PostgREST taglia a 1000)
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data: page } = await admin.from('gallery_media').select('id, folder_id, drive_file_id, album_choice, created_at').eq('entry_id', entry_id).order('id').range(from, from + 999)
    if (!page?.length) break
    rows.push(...(page as Row[]))
    if (page.length < 1000) break
  }
  // engagement: like o commento → set di media_id protetti (chunk dell'IN per non sforare l'URL)
  const protectedIds = new Set<string>()
  const ids = rows.map((r) => r.id)
  for (const t of ['gallery_media_likes', 'gallery_media_comments']) {
    for (let i = 0; i < ids.length; i += 200) {
      const { data: page } = await admin.from(t).select('media_id').in('media_id', ids.slice(i, i + 200))
      for (const r of (page ?? []) as { media_id: string }[]) protectedIds.add(r.media_id)
    }
  }
  const isEngaged = (r: Row) => r.album_choice != null || protectedIds.has(r.id)

  // 3) token Drive dell'owner
  let token: string | null = null
  const { data: conn } = await admin.from('drive_connections').select('refresh_token_enc').eq('professional_id', gal.owner_id).maybeSingle()
  if (conn?.refresh_token_enc) {
    try {
      const refresh = await decryptToken(Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)))
      const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
      const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
      token = (await tr.json()).access_token ?? null
    } catch { token = null }
  }
  if (!token) return json({ error: 'no_drive_token' }, 400)

  // 4) nome file Drive per ogni id (lista delle cartelle Drive coinvolte)
  const nameById = new Map<string, string>()
  for (const driveFolder of new Set(driveFolderById.values())) {
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({ q: `'${driveFolder}' in parents and trashed = false`, fields: 'nextPageToken, files(id, name)', pageSize: '1000' })
      if (pageToken) params.set('pageToken', pageToken)
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) break
      const j = await r.json() as { files?: { id: string; name: string }[]; nextPageToken?: string }
      for (const f of j.files ?? []) nameById.set(f.id, f.name)
      pageToken = j.nextPageToken
    } while (pageToken)
  }

  // 5) raggruppa per (cartella, nome) e scegli i doppioni inerti da togliere
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    if (!isDrive(r.drive_file_id)) continue
    const name = nameById.get(r.drive_file_id)
    if (!name) continue // file non più su Drive: lascio stare
    const k = `${r.folder_id}::${name}`
    const a = groups.get(k) ?? []; a.push(r); groups.set(k, a)
  }
  const toDelete: Row[] = []
  let groupsWithDupes = 0, protectedKept = 0
  for (const g of groups.values()) {
    if (g.length < 2) continue
    groupsWithDupes++
    const engaged = g.filter(isEngaged)
    protectedKept += engaged.length
    const inert = g.filter((r) => !isEngaged(r)).sort((a, b) => a.created_at.localeCompare(b.created_at))
    // se nel gruppo non c'è nulla di "ingaggiato", tengo la copia più vecchia
    const start = engaged.length > 0 ? 0 : 1
    for (let i = start; i < inert.length; i++) toDelete.push(inert[i]!)
  }

  const result: Record<string, unknown> = {
    ok: true, total: rows.length, drive_named: nameById.size,
    groups_with_dupes: groupsWithDupes, protected_by_like_or_choice: protectedKept,
    to_delete: toDelete.length, dry_run: !doDelete,
  }
  if (!doDelete) return json(result)

  // 6) ESEGUI: cestina i file Drive duplicati e cancella le righe
  let trashed = 0
  for (let i = 0; i < toDelete.length; i += 8) {
    const chunk = toDelete.slice(i, i + 8)
    await Promise.all(chunk.map(async (r) => {
      try {
        const tr = await fetch(`https://www.googleapis.com/drive/v3/files/${r.drive_file_id}?supportsAllDrives=true`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }),
        })
        if (tr.ok) trashed++
      } catch { /* il file resta, ma cancello comunque la riga DB */ }
    }))
  }
  for (let i = 0; i < toDelete.length; i += 200) {
    const ids = toDelete.slice(i, i + 200).map((r) => r.id)
    await admin.from('gallery_media').delete().in('id', ids)
  }
  result.deleted_rows = toDelete.length
  result.trashed_drive = trashed
  return json(result)
})
