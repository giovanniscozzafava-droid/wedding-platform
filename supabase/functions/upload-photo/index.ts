// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'
import sharp from 'npm:sharp@0.33.5'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 2 * 1024 * 1024
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

  // Authenticate caller via JWT (anon key + Authorization header)
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'missing bearer token' }, 401)

  // Service client (bypass RLS)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  // Verify caller identity
  const { data: userData, error: userErr } = await admin.auth.getUser(auth.slice(7))
  if (userErr || !userData.user) return json({ error: 'invalid token' }, 401)
  const caller = userData.user

  // Parse form
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
  if (file.size > MAX_BYTES) return json({ error: 'file too large (max 2MB)' }, 400)

  // Verify service ownership
  const { data: svc, error: svcErr } = await admin
    .from('services')
    .select('id, fornitore_id')
    .eq('id', serviceId)
    .maybeSingle()
  if (svcErr) return json({ error: 'db error', detail: svcErr.message }, 500)
  if (!svc) return json({ error: 'service not found' }, 404)
  if (svc.fornitore_id !== caller.id) return json({ error: 'forbidden' }, 403)

  // Verify photo count limit
  const { count, error: cntErr } = await admin
    .from('service_photos')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', serviceId)
  if (cntErr) return json({ error: 'count error', detail: cntErr.message }, 500)
  if ((count ?? 0) >= MAX_PHOTOS) {
    return json({ error: 'limit reached (max 10 photos per service)' }, 409)
  }

  // Convert + thumbnail (sharp)
  const photoId = crypto.randomUUID()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const originalKey = `${serviceId}/${photoId}.${ext}`
  const thumbKey = `${serviceId}/thumb/${photoId}.jpg`

  const arrayBuf = await file.arrayBuffer()
  const original = new Uint8Array(arrayBuf)
  let thumbnail: Uint8Array
  try {
    const out = await sharp(original)
      .rotate()
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 78 })
      .toBuffer()
    thumbnail = new Uint8Array(out)
  } catch (e: any) {
    return json({ error: 'image processing failed', detail: e?.message ?? String(e) }, 500)
  }

  // Upload to storage (service_role bypass)
  const up1 = await admin.storage.from('service-photos').upload(originalKey, original, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (up1.error) return json({ error: 'upload original failed', detail: up1.error.message }, 500)

  const up2 = await admin.storage.from('service-photos').upload(thumbKey, thumbnail, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: false,
  })
  if (up2.error) {
    await admin.storage.from('service-photos').remove([originalKey])
    return json({ error: 'upload thumbnail failed', detail: up2.error.message }, 500)
  }

  const { data: pub1 } = admin.storage.from('service-photos').getPublicUrl(originalKey)
  const { data: pub2 } = admin.storage.from('service-photos').getPublicUrl(thumbKey)

  // Insert row
  const ins = await admin
    .from('service_photos')
    .insert({
      id: photoId,
      service_id: serviceId,
      original_url: pub1.publicUrl,
      thumbnail_url: pub2.publicUrl,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (ins.error) {
    await admin.storage.from('service-photos').remove([originalKey, thumbKey])
    return json({ error: 'insert row failed', detail: ins.error.message }, 500)
  }

  return json({ photo: ins.data })
})
