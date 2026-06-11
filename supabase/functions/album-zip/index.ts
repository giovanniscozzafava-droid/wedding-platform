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

  const body = (await req.json().catch(() => ({}))) as { entry_id?: string; size?: string }
  const entry_id = body.entry_id
  // "dimensione" dell'export: 'web' (leggera, ~1600px) o 'original' (piena risoluzione).
  const size: 'web' | 'original' = body.size === 'web' ? 'web' : 'original'
  if (!entry_id) return json({ error: 'no_entry' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', entry_id).maybeSingle()
  if (!gal) return json({ error: 'no_gallery' }, 404)

  // autorizzazione: owner della galleria, membro coppia, o admin
  const isOwner = gal.owner_id === user.id
  const { data: cm } = await admin.from('wedding_couple_members').select('id').eq('entry_id', entry_id).eq('user_id', user.id).maybeSingle()
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isOwner && !cm && prof?.role !== 'ADMIN') return json({ error: 'forbidden' }, 403)

  const { data: media } = await admin.from('gallery_media')
    .select('drive_file_id, thumbnail_link, media_type, guest_tag_name')
    .eq('entry_id', entry_id).eq('album_choice', 'KEPT').limit(300)
  if (!media || media.length === 0) return json({ error: 'no_selection' }, 400)

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

  const zip = new JSZip()
  let i = 0, ok = 0
  for (const m of media) {
    i++
    try {
      let bytes: ArrayBuffer
      // I video si esportano sempre a piena risoluzione (il "web" vale per le foto).
      const wantWeb = size === 'web' && m.media_type !== 'VIDEO'
      if (isDrive(m.drive_file_id)) {
        if (wantWeb) {
          // versione leggera ~1600px: l'endpoint thumbnail di Drive (no auth per file condivisi)
          const r = await fetch(`https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600`)
          if (!r.ok) continue
          bytes = await r.arrayBuffer()
        } else {
          if (!token) continue
          const r = await fetch(`https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
          if (!r.ok) continue
          bytes = await r.arrayBuffer()
        }
      } else {
        if (!m.thumbnail_link) continue
        const r = await fetch(m.thumbnail_link)
        if (!r.ok) continue
        bytes = await r.arrayBuffer()
      }
      const ext = m.media_type === 'VIDEO' ? 'mp4' : 'jpg'
      const base = (m.guest_tag_name || 'foto').replace(/[^\w\- ]+/g, '') || 'foto'
      zip.file(`${String(i).padStart(3, '0')}-${base}.${ext}`, bytes)
      ok++
    } catch { /* salto il file */ }
  }
  if (ok === 0) return json({ error: 'empty', detail: 'nessun file scaricabile (Drive non collegato?)' }, 502)

  const out = await zip.generateAsync({ type: 'uint8array' })
  const fname = size === 'web' ? 'album-selezione-web.zip' : 'album-selezione-originale.zip'
  return new Response(out, { headers: { ...cors, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fname}"` } })
})
