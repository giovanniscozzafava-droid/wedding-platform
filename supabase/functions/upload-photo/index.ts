// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'

// NOTE: sharp non e' supportato in Deno runtime delle Edge Functions di Supabase
// (libvips native bindings). Sostituito con Supabase Storage image
// transformations on-the-fly: l'immagine originale viene caricata una sola volta
// e il thumbnail viene servito via URL transform (?width=400&height=400&resize=cover).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024  // 5MB: senza resize lato server diamo piu' margine
const MAX_PHOTOS = 10

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'missing bearer token' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(auth.slice(7))
  if (userErr || !userData.user) return json({ error: 'invalid token' }, 401)
  const caller = userData.user

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'multipart parse error' }, 400)
  }
  const file = form.get('file')
  const serviceId = String(form.get('service_id') ?? '')
  if (!(file instanceof File)) return json({ error: 'file required' }, 400)
  if (!serviceId) return json({ error: 'service_id required' }, 400)
  if (!ALLOWED.has(file.type)) return json({ error: 'unsupported mime', detail: file.type }, 400)
  if (file.size > MAX_BYTES) return json({ error: 'file too large (max 5MB)' }, 400)

  const { data: svc, error: svcErr } = await admin
    .from('services')
    .select('id, fornitore_id')
    .eq('id', serviceId)
    .maybeSingle()
  if (svcErr) return json({ error: 'db error', detail: svcErr.message }, 500)
  if (!svc) return json({ error: 'service not found' }, 404)
  if (svc.fornitore_id !== caller.id) return json({ error: 'forbidden' }, 403)

  const { count, error: cntErr } = await admin
    .from('service_photos')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', serviceId)
  if (cntErr) return json({ error: 'count error', detail: cntErr.message }, 500)
  if ((count ?? 0) >= MAX_PHOTOS) {
    return json({ error: 'limit reached (max 10 photos per service)' }, 409)
  }

  const photoId = crypto.randomUUID()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const originalKey = `${serviceId}/${photoId}.${ext}`

  const arrayBuf = await file.arrayBuffer()
  const original = new Uint8Array(arrayBuf)

  const up = await admin.storage.from('service-photos').upload(originalKey, original, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (up.error) return json({ error: 'upload failed', detail: up.error.message }, 500)

  const { data: pubOriginal } = admin.storage.from('service-photos').getPublicUrl(originalKey)
  // Thumbnail via Supabase Storage on-the-fly transform (no extra file uploaded).
  const { data: pubThumb } = admin.storage.from('service-photos').getPublicUrl(originalKey, {
    transform: { width: 400, height: 400, resize: 'cover', quality: 78 },
  })

  const ins = await admin
    .from('service_photos')
    .insert({
      id: photoId,
      service_id: serviceId,
      original_url: pubOriginal.publicUrl,
      thumbnail_url: pubThumb.publicUrl,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (ins.error) {
    await admin.storage.from('service-photos').remove([originalKey])
    return json({ error: 'insert row failed', detail: ins.error.message }, 500)
  }

  return json({ photo: ins.data })
})
