// Legge un DOCUMENTO D'ACQUISTO (bolla/DDT, scontrino, fattura, ricevuta) con un modello VISION e ne
// estrae le righe merce in JSON. A monte: controllo CREDITO della location (wallet a token a scalare);
// a valle: addebito del costo reale (token × tariffa) e log dell'uso.
//
// Provider: Alibaba Cloud Model Studio / DashScope (API OpenAI-compatible), modello Qwen-VL (ottimo OCR
// documenti, forte in italiano, economico). Provider-agnostico: QWEN_BASE_URL + QWEN_MODEL sono override.
// Input: una immagine ({base64, media_type}) oppure più pagine ({images:[dataURL,...]} — es. PDF
// rasterizzato lato browser, perché il compatible-mode accetta immagini, non PDF).
// Esiti di business → 200 con {ok:false,error} così il frontend li legge. Richiede DASHSCOPE_API_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const QWEN_KEY = Deno.env.get('DASHSCOPE_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Endpoint OpenAI-compatible di DashScope (default internazionale, Singapore) e modello vision.
const BASE_URL = Deno.env.get('QWEN_BASE_URL') ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const MODEL = Deno.env.get('QWEN_MODEL') ?? 'qwen-vl-max'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

const PROMPT = `Sei un estrattore di DOCUMENTI D'ACQUISTO per una location di ristorazione: bolle/DDT,
scontrini (anche di cassa/supermercato), fatture, ricevute — qualsiasi documento di acquisto merce.
Se ci sono più immagini è lo stesso documento su più pagine. Estrai SOLO le righe della merce
acquistata (ignora intestazioni, sconti, totali, IVA, metodi di pagamento, indirizzi, resto).
Rispondi ESCLUSIVAMENTE con un JSON valido, senza testo intorno, in questa forma:
{"fornitore": "<nome se presente o null>", "righe": [
  {"nome": "<descrizione articolo>", "quantita": <numero>, "unita": "<kg|L|pz>",
   "prezzo_unitario_eur": <numero per unita, o null se non presente>,
   "lotto": "<codice lotto o null>", "scadenza": "<YYYY-MM-DD o null>"}
]}
Normalizza l'unita a kg, L o pz. Se la quantita e' in grammi convertila in kg. Numeri con punto decimale.`

// Normalizza l'input in una lista di data-URL immagine.
function collectImages(body: any): string[] {
  const out: string[] = []
  const push = (b64?: string, mt?: string) => {
    if (!b64) return
    out.push(b64.startsWith('data:') ? b64 : `data:${mt || 'image/jpeg'};base64,${b64.replace(/^data:[^,]+,/, '')}`)
  }
  if (Array.isArray(body?.images)) {
    for (const im of body.images) typeof im === 'string' ? push(im) : push(im?.base64, im?.media_type)
  } else {
    push(body?.base64, body?.media_type)
  }
  return out.slice(0, 10) // cap di sicurezza
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' })
  if (!QWEN_KEY) return json({ ok: false, error: 'no_ai_key' })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const auth = req.headers.get('Authorization') ?? ''
  const { data: caller } = await admin.auth.getUser(auth.slice(7))
  const loc = caller?.user?.id
  if (!loc) return json({ ok: false, error: 'auth' })
  const { data: prof } = await admin.from('profiles').select('role').eq('id', loc).maybeSingle()
  if (!prof || !['LOCATION', 'ADMIN'].includes(prof.role)) return json({ ok: false, error: 'forbidden' })

  // CREDITO: assicura il wallet e leggi il saldo
  const { data: balance } = await admin.rpc('fb_ai_precheck', { p_location: loc })
  if ((balance ?? 0) <= 0) return json({ ok: false, error: 'no_credit', balance: balance ?? 0 })

  let body: any
  try { body = await req.json() } catch { return json({ ok: false, error: 'bad_json' }) }
  const images = collectImages(body)
  if (!images.length) return json({ ok: false, error: 'no_file' })

  try {
    const content: any[] = [{ type: 'text', text: PROMPT }]
    for (const url of images) content.push({ type: 'image_url', image_url: { url } })

    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${QWEN_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 3000,
        messages: [{ role: 'user', content }],
      }),
    })
    if (!r.ok) return json({ ok: false, error: 'ai_error', detail: (await r.text()).slice(0, 300) })
    const d = await r.json()

    // ADDEBITO: costo reale dai token usati (usage OpenAI-compatible)
    const inTok = d?.usage?.prompt_tokens ?? 0
    const outTok = d?.usage?.completion_tokens ?? 0
    const { data: price } = await admin.from('fb_ai_pricing').select('input_eur_per_mtok, output_eur_per_mtok').eq('id', 1).maybeSingle()
    const cost = (inTok * (price?.input_eur_per_mtok ?? 9) + outTok * (price?.output_eur_per_mtok ?? 45)) / 1_000_000
    const { data: newBal } = await admin.rpc('fb_ai_charge', { p_location: loc, p_cost: cost, p_in: inTok, p_out: outTok, p_fn: 'fb-read-bolla' })

    const text: string = d?.choices?.[0]?.message?.content ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return json({ ok: false, error: 'parse', raw: text.slice(0, 300), cost, balance: newBal })
    const parsed = JSON.parse(m[0])
    return json({ ok: true, fornitore: parsed.fornitore ?? null, righe: Array.isArray(parsed.righe) ? parsed.righe : [], cost, balance: newBal })
  } catch (e) {
    return json({ ok: false, error: 'exception', detail: String(e).slice(0, 300) }, 500)
  }
})
