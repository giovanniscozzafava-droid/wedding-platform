// Download PUBBLICO dei file dell'album per la STAMPA (come un WeTransfer, ma poggia sul Drive
// del fotografo). Autorizza col TOKEN della commissione (album_orders.share_token): nessun login.
// Scarica i file selezionati (album_choice='KEPT') dal Drive dell'owner e li restituisce in UN ZIP.
// Deploy con --no-verify-jwt (endpoint pubblico, protetto dal token).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'
import JSZip from 'https://esm.sh/jszip@3.10.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // token dalla query (?token=) o dal body
  const url = new URL(req.url)
  let token = url.searchParams.get('token') ?? ''
  let size: 'web' | 'original' = url.searchParams.get('size') === 'web' ? 'web' : 'original'
  if (!token) {
    const body = (await req.json().catch(() => ({}))) as { token?: string; size?: string }
    token = body.token ?? ''
    if (body.size === 'web') size = 'web'
  }
  if (!token) return json({ error: 'no_token' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  // il token risolve la commissione → evento + fotografo
  const { data: order } = await admin.from('album_orders').select('entry_id, photographer_id, couple_label').eq('share_token', token).maybeSingle()
  if (!order) return json({ error: 'not_found' }, 404)

  const { data: media } = await admin.from('gallery_media')
    .select('drive_file_id, thumbnail_link, media_type, guest_tag_name')
    .eq('entry_id', order.entry_id).eq('album_choice', 'KEPT').limit(300)
  if (!media || media.length === 0) return json({ error: 'no_selection' }, 400)

  // token Drive dell'owner (per i file Drive alla piena risoluzione)
  let gtoken: string | null = null
  if (media.some((m) => isDrive(m.drive_file_id as string))) {
    const { data: conn } = await admin.from('drive_connections').select('refresh_token_enc').eq('professional_id', order.photographer_id).maybeSingle()
    if (conn?.refresh_token_enc) {
      try {
        const refresh = await decryptToken(Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)))
        const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
        const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
        gtoken = (await tr.json()).access_token ?? null
      } catch { gtoken = null }
    }
  }

  const zip = new JSZip()
  let i = 0, ok = 0
  for (const m of media) {
    i++
    try {
      let bytes: ArrayBuffer
      const wantWeb = size === 'web' && m.media_type !== 'VIDEO'
      if (isDrive(m.drive_file_id as string)) {
        if (wantWeb) {
          const r = await fetch(`https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600`)
          if (!r.ok) continue
          bytes = await r.arrayBuffer()
        } else {
          if (!gtoken) continue
          const r = await fetch(`https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?alt=media`, { headers: { Authorization: `Bearer ${gtoken}` } })
          if (!r.ok) continue
          bytes = await r.arrayBuffer()
        }
      } else {
        if (!m.thumbnail_link) continue
        const r = await fetch(m.thumbnail_link as string)
        if (!r.ok) continue
        bytes = await r.arrayBuffer()
      }
      const ext = m.media_type === 'VIDEO' ? 'mp4' : 'jpg'
      const base = ((m.guest_tag_name as string) || 'foto').replace(/[^\w\- ]+/g, '') || 'foto'
      zip.file(`${String(i).padStart(3, '0')}-${base}.${ext}`, bytes)
      ok++
    } catch { /* salto */ }
  }
  if (ok === 0) return json({ error: 'empty', detail: 'nessun file scaricabile (Drive non collegato?)' }, 502)

  const out = await zip.generateAsync({ type: 'uint8array' })
  const label = ((order.couple_label as string) || 'album').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'album'
  const fname = `${label}-file${size === 'web' ? '-web' : ''}.zip`
  return new Response(out, { headers: { ...cors, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fname}"` } })
})
