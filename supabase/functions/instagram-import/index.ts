// Importa dai post Instagram del professionista collegato.
//  action 'list' → ultimi post (id, caption, permalink, type, anteprima)
//  action 'pull' (media_id) → scarica TUTTE le foto del post su blog-media e
//    ritorna { caption, images:[publicUrl...] } per generare l'articolo.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: conn } = await admin.from('instagram_connections').select('access_token, ig_user_id').eq('profile_id', user.id).maybeSingle()
  if (!conn?.access_token) return json({ error: 'not_connected' }, 400)
  const token = conn.access_token

  let body: { action?: string; media_id?: string } = {}
  try { body = await req.json() } catch { /* default list */ }
  const action = body.action ?? 'list'

  try {
    if (action === 'list') {
      const r = await fetch(`https://graph.instagram.com/me/media?fields=id,caption,media_type,permalink,media_url,thumbnail_url,timestamp&limit=24&access_token=${token}`)
      const d = await r.json()
      if (!r.ok) return json({ error: 'ig_error', detail: d }, 502)
      const posts = (d.data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id, caption: p.caption ?? '', media_type: p.media_type, permalink: p.permalink,
        thumb: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url, timestamp: p.timestamp,
      }))
      return json({ ok: true, posts })
    }

    if (action === 'pull') {
      if (!body.media_id) return json({ error: 'no_media_id' }, 400)
      const r = await fetch(`https://graph.instagram.com/${body.media_id}?fields=caption,media_type,media_url,children{media_url,media_type}&access_token=${token}`)
      const d = await r.json()
      if (!r.ok) return json({ error: 'ig_error', detail: d }, 502)
      const urls: string[] = []
      if (d.children?.data?.length) {
        for (const c of d.children.data) if (c.media_type === 'IMAGE' && c.media_url) urls.push(c.media_url)
      } else if (d.media_type === 'IMAGE' && d.media_url) {
        urls.push(d.media_url)
      }
      // scarica e ricarica su blog-media (URL stabili)
      const pub: string[] = []
      let i = 0
      for (const u of urls) {
        i++
        try {
          const img = await fetch(u)
          if (!img.ok) continue
          const buf = new Uint8Array(await img.arrayBuffer())
          const path = `${user.id}/ig/${body.media_id}/${String(i).padStart(2, '0')}.jpg`
          const { error } = await admin.storage.from('blog-media').upload(path, buf, { contentType: 'image/jpeg', upsert: true })
          if (!error) pub.push(`${SUPABASE_URL}/storage/v1/object/public/blog-media/${path}`)
        } catch { /* salta singola immagine */ }
      }
      return json({ ok: true, caption: d.caption ?? '', images: pub })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: 'fetch_failed', detail: (e as Error).message }, 502)
  }
})
