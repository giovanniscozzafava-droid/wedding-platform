// Operazione una-tantum: precarica asset-stile nel profilo di un fornitore (da link immagine
// già risolti). Protetta da un SECRET (OPS_SECRET) per consentire il preload server-side.
// Service-role → bypassa RLS, inserisce per il supplier giusto. Idempotente per image_url.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPS_SECRET = Deno.env.get('OPS_SECRET') ?? ''
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-ops-secret, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

type Item = { image_url: string; tags?: string[]; caption?: string; event_kind?: string | null }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!OPS_SECRET || req.headers.get('x-ops-secret') !== OPS_SECRET) return json({ error: 'forbidden' }, 403)

  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; items?: Item[] }
  const items = (body.items ?? []).filter((i) => i && typeof i.image_url === 'string')
  if (items.length === 0) return json({ error: 'no_items' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // risolvi il supplier: per email (auth) o per nome (profiles.full_name)
  let supplierId: string | null = null
  if (body.email) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    supplierId = (list?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === body.email!.toLowerCase())?.id ?? null
  }
  if (!supplierId && body.name) {
    const { data: p } = await admin.from('profiles').select('id').ilike('full_name', `%${body.name}%`).limit(1).maybeSingle()
    supplierId = (p as { id?: string } | null)?.id ?? null
  }
  if (!supplierId) return json({ error: 'supplier_not_found' }, 404)

  // esistenti (idempotenza per image_url)
  const { data: existing } = await admin.from('supplier_assets').select('image_url').eq('supplier_id', supplierId)
  const have = new Set((existing ?? []).map((r: { image_url: string | null }) => r.image_url))

  const rows = items
    .filter((i) => !have.has(i.image_url))
    .map((i, idx) => ({ supplier_id: supplierId, image_url: i.image_url, source_url: i.image_url, tags: i.tags ?? [], caption: i.caption ?? null, event_kind: i.event_kind ?? 'matrimonio', kind: 'style', is_public: true, sort_order: idx }))

  if (rows.length === 0) return json({ ok: true, inserted: 0, note: 'già presenti' })
  const { error } = await admin.from('supplier_assets').insert(rows)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, supplier_id: supplierId, inserted: rows.length })
})
