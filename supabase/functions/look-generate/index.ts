// PROVA LOOK — motore di generazione (Beta).
// Il fornitore (parrucchiere/truccatore) chiede all'AI di applicare un'acconciatura o un trucco
// sulla foto della cliente. Genera 1 proposta per chiamata, la persiste su storage, la registra
// in look_proposals e ADDEBITA il wallet AI (fb_ai_charge). Mirror del pattern fb-read-bolla.
//
// ⚠️ INTEGRAZIONE HIGGSFIELD: la chiamata REST è isolata in callHiggsfield() ed è CONFIGURABILE via
//    secret (HIGGSFIELD_API_URL / HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET). Va verificata contro il
//    proprio account Higgsfield (endpoint/payload). Finché i secret non sono impostati → errore 'no_ai_key'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
// Contract Higgsfield verificata (memoria project_planfully_higgsfield_api): auth `Key key:secret`,
// image-edit richiede un media_id (NON un URL), submit ritorna status_url, poll → images:[{url}].
const HF_URL = Deno.env.get('HIGGSFIELD_API_URL') ?? 'https://platform.higgsfield.ai'
const HF_KEY = Deno.env.get('HIGGSFIELD_API_KEY') ?? ''
const HF_SECRET = Deno.env.get('HIGGSFIELD_SECRET') ?? Deno.env.get('HIGGSFIELD_API_SECRET') ?? ''
const HF_MODEL = Deno.env.get('HIGGSFIELD_MODEL') ?? 'nano_banana_2'
// path REST incerti (da confermare col proprio account): sovrascrivibili via secret senza toccare codice.
const HF_IMPORT_URL = Deno.env.get('HIGGSFIELD_IMPORT_URL') ?? `${HF_URL}/media/import-url`
const HF_GEN_URL = Deno.env.get('HIGGSFIELD_GEN_URL') ?? `${HF_URL}/${HF_MODEL}`
const COST_EUR = Number(Deno.env.get('LOOK_COST_EUR') ?? '0.10') // prezzo interno per immagine (addebito wallet)
const BUCKET = 'event-guest-uploads'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Client Higgsfield (image-to-image). Contract verificata; i 2 path REST (import/gen) sono
//    sovrascrivibili via secret. Flow: URL→media_id (import) → generate(medias) → poll status_url. ──
async function callHiggsfield(imageUrl: string, prompt: string): Promise<string> {
  const headers = { Authorization: `Key ${HF_KEY}:${HF_SECRET}`, 'content-type': 'application/json' }

  // 1) importa la foto → media_id (Higgsfield ignora gli URL diretti in image-to-image)
  const imp = await fetch(HF_IMPORT_URL, { method: 'POST', headers, body: JSON.stringify({ url: imageUrl }) })
  if (!imp.ok) throw new Error(`hf_import_${imp.status}`)
  const impJson = await imp.json().catch(() => ({}))
  const mediaId = impJson?.id || impJson?.media_id || impJson?.media?.id
  if (!mediaId) throw new Error('hf_no_media_id')

  // 2) genera (model in body + medias con media_id)
  const gen = await fetch(HF_GEN_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ model: HF_MODEL, prompt, count: 1, aspect_ratio: '3:4', resolution: '1k', medias: [{ role: 'image', value: mediaId }] }),
  })
  if (!gen.ok) throw new Error(`hf_submit_${gen.status}`)
  const g = await gen.json().catch(() => ({}))
  const direct = g?.images?.[0]?.url || g?.results?.[0]?.url
  if (direct) return direct as string
  const statusUrl: string | null = g?.status_url || (g?.request_id ? `${HF_URL}/requests/${g.request_id}/status` : null)
  if (!statusUrl) throw new Error('hf_no_status_url')

  // 3) poll (la submit ritorna status_url)
  for (let i = 0; i < 40; i++) {
    await sleep(2000)
    const st = await fetch(statusUrl, { headers })
    if (!st.ok) continue
    const d = await st.json().catch(() => ({}))
    const status = d?.status
    const url = d?.images?.[0]?.url || d?.results?.[0]?.url
    if ((status === 'completed' || status === 'succeeded') && url) return url as string
    if (status === 'failed' || status === 'error' || status === 'nsfw') throw new Error(`hf_${status}`)
  }
  throw new Error('hf_timeout')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!HF_KEY || !HF_SECRET) return json({ ok: false, error: 'no_ai_key' })
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // auth del chiamante (fornitore)
    const auth = req.headers.get('Authorization') ?? ''
    const { data: caller } = await admin.auth.getUser(auth.slice(7))
    const uid = caller?.user?.id
    if (!uid) return json({ ok: false, error: 'auth' })
    const { data: prof } = await admin.from('profiles').select('role, subrole').eq('id', uid).maybeSingle()
    if (!prof || !['FORNITORE', 'ADMIN'].includes(prof.role)) return json({ ok: false, error: 'forbidden' })

    const body = await req.json().catch(() => ({}))
    const sessionId = String(body.session_id ?? '')
    const prompt = String(body.prompt ?? '').trim()
    const title = String(body.title ?? '').slice(0, 120)
    const spec = body.spec ?? null
    if (!sessionId || !prompt) return json({ ok: false, error: 'bad_input' })

    // sessione del fornitore + selfie caricata
    const { data: sess } = await admin.from('look_sessions').select('id, owner_id, kind, selfie_url').eq('id', sessionId).maybeSingle()
    if (!sess || sess.owner_id !== uid) return json({ ok: false, error: 'forbidden' })
    if (!sess.selfie_url) return json({ ok: false, error: 'no_selfie' })

    // credito
    const { data: bal } = await admin.rpc('fb_ai_precheck', { p_location: uid })
    if ((bal ?? 0) <= 0) return json({ ok: false, error: 'no_credit', balance: bal ?? 0 })

    // istruzione di preservazione + solo capelli / solo trucco
    const guard = sess.kind === 'hair'
      ? 'Keep the exact same face, identity and makeup unchanged. Change ONLY the hairstyle. Do NOT add makeup.'
      : 'Keep the exact same face, identity and hairstyle unchanged. Change ONLY the makeup. Do NOT restyle the hair.'
    const fullPrompt = `${guard} ${prompt}. Photorealistic portrait, same lighting and background, same person.`

    // genera
    const hfUrl = await callHiggsfield(sess.selfie_url, fullPrompt)

    // persiste su storage (la CDN Higgsfield può scadere)
    let publicUrl = hfUrl
    try {
      const img = await fetch(hfUrl)
      const bytes = new Uint8Array(await img.arrayBuffer())
      const path = `${uid}/look/${crypto.randomUUID()}.png`
      const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: false })
      if (!up.error) publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    } catch { /* fallback: url Higgsfield */ }

    // registra la proposta
    const { data: prop, error: insErr } = await admin.from('look_proposals')
      .insert({ session_id: sessionId, owner_id: uid, title: title || null, prompt: fullPrompt, spec, image_url: publicUrl, status: 'DRAFT' })
      .select('id, title, image_url, status').single()
    if (insErr) return json({ ok: false, error: 'save_failed' })

    // addebito wallet (prezzo interno fisso per immagine)
    const { data: newBal } = await admin.rpc('fb_ai_charge', { p_location: uid, p_cost: COST_EUR, p_in: 0, p_out: 0, p_fn: 'look-generate' })

    return json({ ok: true, proposal: prop, cost: COST_EUR, balance: newBal })
  } catch (e) {
    return json({ ok: false, error: 'server', detail: String((e as Error).message ?? e) }, 200)
  }
})
