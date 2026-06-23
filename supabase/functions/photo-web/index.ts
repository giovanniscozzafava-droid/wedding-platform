// Download "formato WEB" di una singola foto come FILE VERO: proxya il thumbnail (pubblico) di Drive
// a ~2048px e lo restituisce come allegato JPEG (Content-Disposition: attachment) con CORS aperto.
// Così il browser scarica un .jpg reale invece di aprire l'anteprima inline (no CORS, no token utente).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const u = new URL(req.url)
  const mediaId = u.searchParams.get('m') ?? ''
  if (!mediaId) return new Response('bad_request', { status: 400, headers: cors })

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: m } = await admin.from('gallery_media').select('drive_file_id, thumbnail_link, media_type, guest_tag_name').eq('id', mediaId).maybeSingle()
  if (!m) return new Response('not_found', { status: 404, headers: cors })

  const id = m.drive_file_id as string
  const src = isDrive(id) ? `https://drive.google.com/thumbnail?id=${id}&sz=w2048` : (m.thumbnail_link as string | null)
  if (!src) return new Response('no_source', { status: 404, headers: cors })
  const r = await fetch(src)
  if (!r.ok) return new Response('fetch_failed', { status: 502, headers: cors })

  const base = ((m.guest_tag_name as string | null) || 'planfully-foto').replace(/[^\w\- ]+/g, '').trim() || 'planfully-foto'
  return new Response(r.body, {
    headers: {
      ...cors,
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${base}-web.jpg"`,
      'Cache-Control': 'public, max-age=600',
    },
  })
})
