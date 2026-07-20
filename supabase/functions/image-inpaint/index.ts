// Edge function: image-inpaint — CANCELLA oggetti dalle foto.
// MOTORE PREFERITO: Qwen-Image-Edit (Alibaba DashScope, chiave già impostata). L'utente pennella l'oggetto:
// il frontend manda `marked` (foto con una macchia magenta traslucida sull'oggetto) → istruisco Qwen a
// togliere l'oggetto e ricostruire lo sfondo. Il ritaglio pulito viene poi ricomposto sul full-res dal
// frontend (solo la zona pennellata, tono allineato, bordo sfumato). Fallback: BFL/Replicate/OpenAI a
// maschera. NB: l'inpainting a maschera vero (wanx2.1-imageedit) è solo regione Beijing → non usabile con
// chiave internazionale ("Model not exist"). verify_jwt=true.

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const IMG_MODEL = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'dall-e-2'
const REPLICATE_TOKEN = Deno.env.get('REPLICATE_API_TOKEN') ?? ''
const REPLICATE_MODEL = Deno.env.get('REPLICATE_MODEL') ?? 'black-forest-labs/flux-fill-dev'
// FLUX ufficiale (Black Forest Labs): abbonamento diretto su bfl.ai. Prioritario se presente.
const BFL_API_KEY = Deno.env.get('BFL_API_KEY') ?? ''
const BFL_BASE = Deno.env.get('BFL_BASE') ?? 'https://api.bfl.ai'
const BFL_MODEL = Deno.env.get('BFL_MODEL') ?? 'flux-pro-1.0-fill'
// MOTORE PREFERITO: Qwen-Image-Edit (Alibaba DashScope) — chiave già impostata, nessun costo extra.
// A istruzione: usa `marked` (foto con l'area da togliere tinta di magenta) e istruisce a rimuovere/riempire.
const DS_KEY = Deno.env.get('DASHSCOPE_API_KEY') ?? ''
const QWEN_URL = Deno.env.get('QWEN_IMAGE_URL') ?? 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const QWEN_MODEL = Deno.env.get('QWEN_IMAGE_MODEL') ?? 'qwen-image-edit'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rawB64 = (d: string) => { const i = d.indexOf(','); return i >= 0 ? d.slice(i + 1) : d }

async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url); if (!r.ok) throw new Error(`fetch output ${r.status}`)
  const bytes = new Uint8Array(await r.arrayBuffer())
  let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  const type = r.headers.get('content-type') ?? 'image/png'
  return `data:${type};base64,${btoa(bin)}`
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

function dataUrlToBlob(d: string): Blob {
  const comma = d.indexOf(',')
  const head = d.slice(0, comma), b64 = d.slice(comma + 1)
  const type = head.match(/data:([^;]+)/)?.[1] ?? 'image/png'
  const bin = atob(b64); const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!DS_KEY && !BFL_API_KEY && !REPLICATE_TOKEN && !OPENAI_API_KEY) return json({ error: 'no_engine', hint: 'Imposta DASHSCOPE_API_KEY (Qwen) / BFL_API_KEY / REPLICATE_API_TOKEN / OPENAI_API_KEY' }, 503)

  let body: { image?: string; mask?: string; marked?: string; prompt?: string; size?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  if (!body.image || typeof body.image !== 'string' || !body.image.startsWith('data:')) return json({ error: 'no_image' }, 400)

  // ── MOTORE PREFERITO (DashScope · Qwen-Image-Edit). Con pennellata → uso `marked` (macchia magenta)
  //    per indicare COSA togliere; senza → edit globale a parole. Il ritaglio pulito lo ricompone il
  //    frontend sul full-res (solo la zona pennellata). Niente wanx: è Beijing-only con chiave intl. ──
  if (DS_KEY) {
    const userText = (typeof body.prompt === 'string' && body.prompt.trim()) ? body.prompt.trim().slice(0, 600) : ''
    const KEEP = ' Preserve the exact original colors and tonality; if the photo is black-and-white or sepia, keep it exactly that way and do not add any color.'
    const marked = (body.marked && body.marked.startsWith('data:')) ? body.marked : ''
    const srcImg = marked || body.image
    const instr = marked
      ? `You are a master professional photo retoucher. This photo has a translucent bright pink / magenta (#FF00FF) marker painted over one unwanted object. Remove that object completely and erase the pink marker, then photorealistically rebuild the background that belongs behind it. Also remove any cast shadow, reflection or contact shadow that belonged to that object.

THE MOST IMPORTANT REQUIREMENT: the retouched area must blend TOTALLY and INVISIBLY into the rest of the photograph. The result must be absolutely seamless — a professional viewer must NOT be able to tell that anything was ever removed or edited. There must be NO visible patch, NO boundary, NO seam, NO halo, NO change of sharpness, NO smooth "plastic" zone. Reconstruct floors, tiles, grass, walls, wood, fabric or any repeating pattern so it continues PERFECTLY through the cleared area: match the exact same tile size and alignment, joints, perspective, texture, film grain/noise, lighting, colors and the same focus/depth-of-field as the immediate surroundings. Work the area meticulously and keep refining it until it is flawless and completely indistinguishable from an untouched original photograph — do not leave it half-done or approximate.

No pink, magenta or colored haze may remain anywhere. Keep every other part of the photo exactly identical, same framing and same resolution.${KEEP}`
      : `${userText || 'Enhance this photo naturally'}. Keep everything else exactly identical.${KEEP} Photorealistic.`
    try {
      const r = await fetch(QWEN_URL, {
        method: 'POST', headers: { Authorization: `Bearer ${DS_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: QWEN_MODEL, input: { messages: [{ role: 'user', content: [{ image: srcImg }, { text: instr }] }] }, parameters: { n: 1, prompt_extend: false, watermark: false } }),
      })
      const d = await r.json().catch(() => ({}))
      const url = d?.output?.choices?.[0]?.message?.content?.find((c: any) => c?.image)?.image
      if (r.ok && url) return json({ image: await urlToDataUrl(url), engine: 'qwen' })
      return json({ error: 'qwen_failed', detail: String(d?.message ?? d?.code ?? r.status) }, 200)
    } catch (e) { return json({ error: 'qwen_error', detail: String((e as Error).message ?? e) }, 200) }
  }

  const prompt = (typeof body.prompt === 'string' && body.prompt.trim())
    ? body.prompt.trim().slice(0, 400)
    : 'Rimuovi in modo pulito e naturale gli oggetti nell\'area mascherata e ricostruisci lo sfondo in modo coerente con l\'ambiente circostante (texture, luce, colori). Mantieni IDENTICO tutto il resto della foto: persone, volti, corpi, capi, colori e illuminazione. Risultato fotorealistico, nessun artefatto.'

  // ── MOTORE FLUX UFFICIALE (Black Forest Labs): maschera BIANCO = area da rigenerare ──
  if (BFL_API_KEY) {
    try {
      const input: Record<string, unknown> = { image: rawB64(body.image), prompt, output_format: 'png', safety_tolerance: 6, steps: 50 }
      if (body.mask && body.mask.startsWith('data:')) input.mask = rawB64(body.mask)
      const create = await fetch(`${BFL_BASE}/v1/${BFL_MODEL}`, {
        method: 'POST', headers: { 'x-key': BFL_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      const started = await create.json()
      if (!create.ok || !started?.polling_url) return json({ error: 'bfl_error', status: create.status, detail: JSON.stringify(started).slice(0, 300) }, 502)
      let res = started, tries = 0
      while (tries < 80) {
        await sleep(1500)
        const p = await fetch(started.polling_url, { headers: { 'x-key': BFL_API_KEY, accept: 'application/json' } })
        res = await p.json()
        if (res?.status && res.status !== 'Pending') break
        tries++
      }
      if (res?.status !== 'Ready' || !res?.result?.sample) return json({ error: 'bfl_failed', detail: String(res?.status ?? 'timeout').slice(0, 200) }, 502)
      return json({ image: await urlToDataUrl(res.result.sample) })
    } catch (e) {
      return json({ error: 'bfl_exception', detail: String((e as Error)?.message ?? e).slice(0, 200) }, 500)
    }
  }

  // ── MOTORE REPLICATE (FLUX Fill): maschera BIANCO = area da rigenerare ──
  if (REPLICATE_TOKEN) {
    try {
      const input: Record<string, unknown> = { image: body.image, prompt, output_format: 'png', num_inference_steps: 30 }
      if (body.mask && body.mask.startsWith('data:')) input.mask = body.mask
      const create = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${REPLICATE_TOKEN}`, 'content-type': 'application/json', prefer: 'wait' },
        body: JSON.stringify({ input }),
      })
      let pred = await create.json()
      if (!create.ok) return json({ error: 'replicate_error', status: create.status, detail: JSON.stringify(pred?.detail ?? pred).slice(0, 300) }, 502)
      // con Prefer:wait spesso è già terminale; altrimenti poll
      let tries = 0
      while (pred?.status && !['succeeded', 'failed', 'canceled'].includes(pred.status) && tries < 60) {
        await sleep(1500)
        const g = await fetch(pred.urls.get, { headers: { authorization: `Bearer ${REPLICATE_TOKEN}` } })
        pred = await g.json(); tries++
      }
      if (pred?.status !== 'succeeded') return json({ error: 'replicate_failed', detail: String(pred?.error ?? pred?.status ?? 'timeout').slice(0, 200) }, 502)
      const out = Array.isArray(pred.output) ? pred.output[0] : pred.output
      if (!out || typeof out !== 'string') return json({ error: 'no_output' }, 502)
      return json({ image: await urlToDataUrl(out) })
    } catch (e) {
      return json({ error: 'replicate_exception', detail: String((e as Error)?.message ?? e).slice(0, 200) }, 500)
    }
  }

  // ── MOTORE OPENAI (fallback) ──
  if (!OPENAI_API_KEY) return json({ error: 'missing_openai_key' }, 503)
  const isDalle = IMG_MODEL.startsWith('dall-e')
  const fd = new FormData()
  fd.append('model', IMG_MODEL)
  fd.append('image', dataUrlToBlob(body.image), 'image.png')
  if (body.mask && body.mask.startsWith('data:')) fd.append('mask', dataUrlToBlob(body.mask), 'mask.png')
  fd.append('prompt', prompt)
  fd.append('n', '1')
  // dall-e-2: dimensione quadrata concreta; gpt-image-1: 'auto'. NIENTE response_format (rifiutato).
  fd.append('size', typeof body.size === 'string' ? body.size : (isDalle ? '1024x1024' : 'auto'))

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 120000)
    let r: Response
    try {
      r = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', signal: ctrl.signal,
        headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
        body: fd,
      })
    } finally { clearTimeout(t) }
    if (!r.ok) {
      const txt = await r.text()
      // messaggio chiaro se l'organizzazione non è verificata per la generazione immagini
      const notVerified = /verif|must be verified|organization must|not (allowed|permitted)|gpt-image/i.test(txt) && r.status === 403
      return json({ error: notVerified ? 'org_not_verified' : 'openai_error', status: r.status, detail: txt.slice(0, 300) }, r.status === 403 ? 403 : 502)
    }
    const data = await r.json()
    const item = data?.data?.[0]
    if (item?.b64_json) return json({ image: `data:image/png;base64,${item.b64_json}` })
    // dall-e-2 di default restituisce un URL: lo scarico e lo converto in base64 (l'URL scade in fretta)
    if (item?.url) {
      const ir = await fetch(item.url)
      if (!ir.ok) return json({ error: 'fetch_result_failed', status: ir.status }, 502)
      const bytes = new Uint8Array(await ir.arrayBuffer())
      let bin = ''
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
      return json({ image: `data:image/png;base64,${btoa(bin)}` })
    }
    return json({ error: 'no_output', detail: JSON.stringify(data).slice(0, 200) }, 502)
  } catch (e) {
    return json({ error: 'exception', detail: String((e as Error)?.message ?? e).slice(0, 200) }, 500)
  }
})
