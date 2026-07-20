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
const HF_URL = Deno.env.get('HIGGSFIELD_API_URL') ?? 'https://platform.higgsfield.ai'
const HF_KEY = Deno.env.get('HIGGSFIELD_API_KEY') ?? ''
const HF_SECRET = Deno.env.get('HIGGSFIELD_API_SECRET') ?? ''
const HF_MODEL = Deno.env.get('HIGGSFIELD_MODEL') ?? 'nano_banana'
const COST_EUR = Number(Deno.env.get('LOOK_COST_EUR') ?? '0.10') // prezzo interno per immagine (addebito wallet)
const BUCKET = 'event-guest-uploads'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Client Higgsfield (image-to-image, async job + poll). Da verificare col proprio account. ──
async function callHiggsfield(imageUrl: string, prompt: string): Promise<string> {
  const headers = { Authorization: `Key ${HF_KEY}:${HF_SECRET}`, 'content-type': 'application/json' }
  // submit
  const sub = await fetch(`${HF_URL}/v1/${HF_MODEL}`, {
    method: 'POST', headers,
    body: JSON.stringify({ prompt, image_url: imageUrl, aspect_ratio: '3:4', resolution: '1k' }),
  })
  if (!sub.ok) throw new Error(`hf_submit_${sub.status}`)
  const subJson = await sub.json().catch(() => ({}))
  // risultato immediato?
  const direct = subJson?.result_url || subJson?.image_url || subJson?.results?.[0]?.url
  if (direct) return direct as string
  const jobId = subJson?.id || subJson?.job_id
  if (!jobId) throw new Error('hf_no_job')
  // poll
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    const st = await fetch(`${HF_URL}/v1/jobs/${jobId}`, { headers })
    if (!st.ok) continue
    const d = await st.json().catch(() => ({}))
    const status = d?.status
    const url = d?.result_url || d?.image_url || d?.results?.[0]?.url
    if ((status === 'completed' || status === 'succeeded') && url) return url as string
    if (status === 'failed' || status === 'error') throw new Error('hf_failed')
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
