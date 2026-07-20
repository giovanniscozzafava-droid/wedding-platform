// PROVA LOOK — motore di generazione (Beta).
// Applica un'acconciatura o un trucco sulla foto della cliente preservando il volto, via
// Qwen-Image-Edit (Alibaba DashScope — modello cinese open-source, image-to-image, SINCRONO).
// Riusa la chiave DASHSCOPE_API_KEY già usata da food-cost/contratti (nessuna nuova credenziale).
// Persiste il risultato su storage e ADDEBITA il wallet AI (fb_ai_charge). Pattern di fb-read-bolla.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const DS_KEY = Deno.env.get('DASHSCOPE_API_KEY') ?? ''
// endpoint multimodal-generation (nativo), regione internazionale; sovrascrivibile via secret.
const QWEN_URL = Deno.env.get('QWEN_IMAGE_URL') ?? 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const QWEN_MODEL = Deno.env.get('QWEN_IMAGE_MODEL') ?? 'qwen-image-edit'
const COST_EUR = Number(Deno.env.get('LOOK_COST_EUR') ?? '0.06') // prezzo interno per immagine (addebito wallet)
const BUCKET = 'event-guest-uploads'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })

// ── Qwen-Image-Edit (DashScope, sincrono): input = URL immagine + istruzione, output = URL immagine. ──
async function callQwenEdit(imageUrl: string, prompt: string): Promise<string> {
  const r = await fetch(QWEN_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DS_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: QWEN_MODEL,
      input: { messages: [{ role: 'user', content: [{ image: imageUrl }, { text: prompt }] }] },
      parameters: { n: 1, prompt_extend: false, watermark: false },
    }),
  })
  if (!r.ok) throw new Error(`qwen_${r.status}`)
  const d = await r.json().catch(() => ({}))
  const url = d?.output?.choices?.[0]?.message?.content?.find((c: any) => c?.image)?.image
    || d?.output?.results?.[0]?.url
  if (!url) throw new Error(`qwen_no_image:${d?.code ?? d?.output?.choices?.[0]?.finish_reason ?? '?'}`)
  return url as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!DS_KEY) return json({ ok: false, error: 'no_ai_key' })
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // auth del chiamante (fornitore)
    const auth = req.headers.get('Authorization') ?? ''
    const { data: caller } = await admin.auth.getUser(auth.slice(7))
    const uid = caller?.user?.id
    if (!uid) return json({ ok: false, error: 'auth' })
    const { data: prof } = await admin.from('profiles').select('role').eq('id', uid).maybeSingle()
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

    // credito (grant automatico €1 di prova alla prima chiamata)
    const { data: bal } = await admin.rpc('fb_ai_precheck', { p_location: uid })
    if ((bal ?? 0) <= 0) return json({ ok: false, error: 'no_credit', balance: bal ?? 0 })

    // GUARDRAIL VOLTO REALE (trucco/parrucco): l'output deve restare la stessa identica persona.
    const REAL = 'CRITICAL identity lock: this is a REAL photo of a real person. The output MUST be unmistakably the SAME individual — keep identical facial features, face shape and bone structure, eye shape and color, nose, mouth, skin tone and any freckles or marks. Do NOT beautify, slim, smooth, re-age or alter the face in any way. '
    const view = String(body.view ?? 'front')
    let guard: string
    if (sess.kind === 'makeup') {
      guard = REAL + 'Change ONLY the makeup. Keep the exact same hairstyle. Keep everything else identical: hair, face, lighting, background. Photorealistic, same person.'
    } else if (sess.kind === 'hair' && view === 'back') {
      // vista posteriore: si vede il retro del raccolto, il viso NON è visibile (quindi niente lock volto)
      guard = 'Show the SAME person from BEHIND — a rear/back view of the head. Apply the new hairstyle and render the BACK of it in detail. Keep the same hair color, length and texture. The face is not visible from behind (that is expected). Same lighting and background. Photorealistic.'
    } else if (sess.kind === 'hair') {
      guard = REAL + 'Change ONLY the hairstyle (front view). Keep the exact same face and makeup unchanged. Do not add makeup. Keep everything else identical: face, skin, lighting, background. Photorealistic, same person.'
    } else if (sess.kind === 'flowers') {
      guard = 'This is a wedding venue (church or reception location). ADD a floral decoration/installation to it. Keep the venue architecture, space, perspective and lighting exactly identical: only ADD the flowers and decor described, integrated realistically. Photorealistic.'
    } else {
      guard = 'This is a wedding venue at the event. ADD a fireworks / pyrotechnic display to the scene (in the night sky above and around the venue). Keep the venue, foreground and composition exactly identical: only ADD the fireworks described, as a photorealistic night scene.'
    }
    const fullPrompt = `${guard} Apply: ${prompt}.`

    // genera (Qwen-Image-Edit, sincrono)
    const outUrl = await callQwenEdit(sess.selfie_url, fullPrompt)

    // persiste su storage (l'URL DashScope scade in 24h) via service role
    let publicUrl = outUrl
    try {
      const img = await fetch(outUrl)
      const bytes = new Uint8Array(await img.arrayBuffer())
      const path = `${uid}/look/${crypto.randomUUID()}.png`
      const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: false })
      if (!up.error) publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    } catch { /* fallback: url DashScope (24h) */ }

    // registra la proposta
    const { data: prop, error: insErr } = await admin.from('look_proposals')
      .insert({ session_id: sessionId, owner_id: uid, title: title || null, prompt: fullPrompt, spec, image_url: publicUrl, status: 'DRAFT' })
      .select('id, title, image_url, status').single()
    if (insErr) return json({ ok: false, error: 'save_failed' })

    // addebito wallet
    const { data: newBal } = await admin.rpc('fb_ai_charge', { p_location: uid, p_cost: COST_EUR, p_in: 0, p_out: 0, p_fn: 'look-generate' })

    return json({ ok: true, proposal: prop, cost: COST_EUR, balance: newBal })
  } catch (e) {
    return json({ ok: false, error: 'server', detail: String((e as Error).message ?? e) }, 200)
  }
})
