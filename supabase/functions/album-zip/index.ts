// Scarica in UN unico ZIP le foto/video selezionati per l'album (album_choice='KEPT').
// Lo possono fare il fotografo (owner) E gli sposi: il server usa il token Drive
// dell'owner per scaricare i file Drive (gli sposi non hanno il token).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'
import JSZip from 'https://esm.sh/jszip@3.10.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const body = (await req.json().catch(() => ({}))) as { entry_id?: string; size?: string; scope?: string; folder_id?: string }
  const entry_id = body.entry_id
  // "dimensione" dell'export: 'web' (leggera, ~1600px) o 'original' (piena risoluzione).
  const size: 'web' | 'original' = body.size === 'web' ? 'web' : 'original'
  // scope: 'selection' (solo album_choice=KEPT, default, retrocompatibile) o 'all' (tutta la galleria).
  const scope: 'selection' | 'all' = body.scope === 'all' ? 'all' : 'selection'
  const folderId = body.folder_id
  if (!entry_id) return json({ error: 'no_entry' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', entry_id).maybeSingle()
  if (!gal) return json({ error: 'no_gallery' }, 404)

  // autorizzazione: owner della galleria, membro coppia, admin, o stamperia (FotoLab service)
  const isOwner = gal.owner_id === user.id
  const { data: cm } = await admin.from('wedding_couple_members').select('id').eq('entry_id', entry_id).eq('user_id', user.id).maybeSingle()
  const { data: prof } = await admin.from('profiles').select('role, is_album_lab').eq('id', user.id).maybeSingle()
  const isLab = !!prof?.is_album_lab || prof?.role === 'FOTOLAB'
  if (!isOwner && !cm && prof?.role !== 'ADMIN' && !isLab) return json({ error: 'forbidden' }, 403)

  // Una stamperia può scaricare gli originali SOLO se per quell'evento esiste un
  // ordine album (commessa). Senza, un lab globale potrebbe esfiltrare gli
  // originali a piena risoluzione di eventi mai inviati in stampa.
  if (isLab && !isOwner && !cm && prof?.role !== 'ADMIN') {
    const { data: ord } = await admin.from('album_orders').select('id').eq('entry_id', entry_id).limit(1).maybeSingle()
    if (!ord) return json({ error: 'no_order' }, 403)
  }

  let mq = admin.from('gallery_media')
    .select('drive_file_id, thumbnail_link, media_type, guest_tag_name, edited_url, folder_id')
    .eq('entry_id', entry_id)
  if (scope === 'selection') mq = mq.eq('album_choice', 'KEPT')
  if (folderId) mq = mq.eq('folder_id', folderId)
  let { data: media } = await mq.limit(500)
  if (!media || media.length === 0) return json({ error: scope === 'all' ? 'empty' : 'no_selection', detail: 'nessuna foto da scaricare' }, 400)

  // Enforcement per-cartella: il fotografo (owner) scarica sempre tutto; sposi/ospiti
  // solo dalle cartelle in cui il fotografo ha abilitato quel formato.
  if (!isOwner) {
    const { data: folders } = await admin.from('gallery_folders')
      .select('id, allow_dl_web, allow_dl_full').eq('entry_id', entry_id)
    const allowed = new Set((folders ?? [])
      .filter((f: { allow_dl_web?: boolean; allow_dl_full?: boolean }) => (size === 'web' ? f.allow_dl_web !== false : f.allow_dl_full !== false))
      .map((f: { id: string }) => f.id))
    media = media.filter((m: { folder_id?: string | null }) => !!m.folder_id && allowed.has(m.folder_id))
    if (media.length === 0) return json({ error: 'download_disabled', detail: 'Il fotografo non ha abilitato questo download per le cartelle selezionate.' }, 403)
  }

  // token Drive dell'owner (per i file su Drive)
  let token: string | null = null
  if (media.some((m) => isDrive(m.drive_file_id))) {
    const { data: conn } = await admin.from('drive_connections').select('refresh_token_enc').eq('professional_id', gal.owner_id).maybeSingle()
    if (conn?.refresh_token_enc) {
      try {
        const refresh = await decryptToken(Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)))
        const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
        const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
        const td = await tr.json()
        token = td.access_token ?? null
      } catch { token = null }
    }
  }

  // Gli ORIGINALI di una galleria enorme non stanno in memoria: meglio un errore
  // chiaro che un crash opaco. (Il formato web resta disponibile.)
  if (size === 'original' && media.length > 150) {
    return json({ error: 'too_many_originals', detail: `Sono ${media.length} file a piena risoluzione: troppi per un unico zip. Usa il formato web, oppure scarica per cartella.` }, 413)
  }

  // Memoria: una galleria molto grande a w1600 non ci sta nella edge. Sopra i 250 file
  // scendo a w1200 (peso ~ -40%) così anche le gallerie da centinaia di foto passano.
  const webPx = media.length > 250 ? 1200 : 1600
  const zip = new JSZip()
  // Scarico in PARALLELO a concorrenza limitata: in sequenza 400+ file da Drive
  // superavano il tempo massimo della edge (galleria da 449 foto non scaricabile).
  const CONC = 12
  let ok = 0
  const grab = async (m: any, i: number) => {
    try {
      let bytes: ArrayBuffer
      // I video si esportano sempre a piena risoluzione (il "web" vale per le foto).
      const wantWeb = size === 'web' && m.media_type !== 'VIDEO'
      const edited = m.edited_url as string | null | undefined
      if (edited) {
        // Versione MODIFICATA (crop/ruota): è quella canonica → prevale su Drive/originale.
        const r = await fetch(edited); if (!r.ok) return; bytes = await r.arrayBuffer()
      } else if (isDrive(m.drive_file_id)) {
        if (wantWeb) {
          const r = await fetch(`https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w${webPx}`)
          if (!r.ok) return; bytes = await r.arrayBuffer()
        } else {
          if (!token) return
          const r = await fetch(`https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
          if (!r.ok) return; bytes = await r.arrayBuffer()
        }
      } else {
        if (!m.thumbnail_link) return
        const r = await fetch(m.thumbnail_link); if (!r.ok) return; bytes = await r.arrayBuffer()
      }
      const ext = m.media_type === 'VIDEO' ? 'mp4' : 'jpg'
      const base = (m.guest_tag_name || 'foto').replace(/[^\w\- ]+/g, '') || 'foto'
      zip.file(`${String(i + 1).padStart(3, '0')}-${base}.${ext}`, bytes)
      ok++
    } catch { /* salto il file */ }
  }
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(CONC, media.length) }, async () => {
    for (;;) {
      const idx = cursor++
      if (idx >= media.length) break
      await grab(media[idx], idx)
    }
  }))

  if (ok === 0) return json({ error: 'empty', detail: 'nessun file scaricabile (Drive non collegato?)' }, 502)

  const out = await zip.generateAsync({ type: 'uint8array' })
  const stem = scope === 'all' ? 'galleria' : 'album-selezione'
  const fname = size === 'web' ? `${stem}-web.zip` : `${stem}-originali.zip`
  return new Response(out, { headers: { ...cors, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fname}"` } })
})
