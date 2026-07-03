// Edge function: image-inpaint — CANCELLA oggetti dalle foto (inpainting) con OpenAI gpt-image-1.
// Riceve: image (dataURL), mask opzionale (dataURL PNG: le aree TRASPARENTI = da rigenerare), prompt.
// Chiama /v1/images/edits e restituisce l'immagine modificata (dataURL PNG). verify_jwt=true.
// Prerequisito: organizzazione OpenAI VERIFICATA per la generazione immagini (gpt-image-1).

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
// dall-e-2 di default: NON richiede la verifica organizzazione (a differenza di gpt-image-1).
// Per passare a gpt-image-1 quando l'org è verificata: secret OPENAI_IMAGE_MODEL=gpt-image-1.
const IMG_MODEL = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'dall-e-2'

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
  if (!OPENAI_API_KEY) return json({ error: 'missing_openai_key', hint: 'Imposta OPENAI_API_KEY' }, 503)

  let body: { image?: string; mask?: string; prompt?: string; size?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  if (!body.image || typeof body.image !== 'string' || !body.image.startsWith('data:')) return json({ error: 'no_image' }, 400)

  const prompt = (typeof body.prompt === 'string' && body.prompt.trim())
    ? body.prompt.trim().slice(0, 400)
    : 'Rimuovi in modo pulito e naturale gli oggetti nell\'area mascherata e ricostruisci lo sfondo in modo coerente con l\'ambiente circostante (texture, luce, colori). Mantieni IDENTICO tutto il resto della foto: persone, volti, corpi, capi, colori e illuminazione. Risultato fotorealistico, nessun artefatto.'

  const isDalle = IMG_MODEL.startsWith('dall-e')
  const fd = new FormData()
  fd.append('model', IMG_MODEL)
  fd.append('image', dataUrlToBlob(body.image), 'image.png')
  if (body.mask && body.mask.startsWith('data:')) fd.append('mask', dataUrlToBlob(body.mask), 'mask.png')
  fd.append('prompt', prompt)
  fd.append('n', '1')
  // dall-e-2: dimensione quadrata concreta + risposta base64; gpt-image-1: 'auto' e b64 nativo.
  fd.append('size', typeof body.size === 'string' ? body.size : (isDalle ? '1024x1024' : 'auto'))
  if (isDalle) fd.append('response_format', 'b64_json')

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
    const b64 = data?.data?.[0]?.b64_json
    if (!b64) return json({ error: 'no_output', detail: JSON.stringify(data).slice(0, 200) }, 502)
    return json({ image: `data:image/png;base64,${b64}` })
  } catch (e) {
    return json({ error: 'exception', detail: String((e as Error)?.message ?? e).slice(0, 200) }, 500)
  }
})
