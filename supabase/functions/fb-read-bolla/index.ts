// Legge una BOLLA / DDT fornitore (PDF o immagine) con Claude vision e ne estrae le righe merce
// in JSON. Niente scrittura DB qui: l'utente conferma e poi una RPC crea i lotti in magazzino.
// Richiede il secret ANTHROPIC_API_KEY (lo stesso di blog-generate).
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MODEL = 'claude-sonnet-4-6'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

const PROMPT = `Sei un estrattore di DOCUMENTI D'ACQUISTO per una location di ristorazione: bolle/DDT,
scontrini (anche di cassa/supermercato), fatture, ricevute — qualsiasi documento di acquisto merce.
Dal documento estrai SOLO le righe della merce acquistata (ignora intestazioni, sconti, totali, IVA,
metodi di pagamento, indirizzi, resto).
Rispondi ESCLUSIVAMENTE con un JSON valido, senza testo intorno, in questa forma:
{"fornitore": "<nome se presente o null>", "righe": [
  {"nome": "<descrizione articolo>", "quantita": <numero>, "unita": "<kg|L|pz>",
   "prezzo_unitario_eur": <numero per unita, o null se non presente>,
   "lotto": "<codice lotto o null>", "scadenza": "<YYYY-MM-DD o null>"}
]}
Normalizza l'unita a kg, L o pz. Se la quantita e' in grammi convertila in kg. Numeri con punto decimale.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!ANTHROPIC_KEY) return json({ error: 'no_ai_key', hint: 'Imposta il secret ANTHROPIC_API_KEY su Supabase Functions.' }, 503)
  let body: { base64?: string; media_type?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const base64 = (body.base64 || '').replace(/^data:[^,]+,/, '')
  if (!base64) return json({ error: 'no_file' }, 400)
  const mt = body.media_type || 'image/jpeg'
  const isPdf = mt.includes('pdf')
  const fileBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mt, data: base64 } }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }] }),
    })
    if (!r.ok) return json({ error: 'ai_error', detail: (await r.text()).slice(0, 300) }, 502)
    const d = await r.json()
    const text: string = d?.content?.[0]?.text ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return json({ error: 'parse', raw: text.slice(0, 300) }, 422)
    const parsed = JSON.parse(m[0])
    return json({ ok: true, fornitore: parsed.fornitore ?? null, righe: Array.isArray(parsed.righe) ? parsed.righe : [] })
  } catch (e) {
    return json({ error: 'exception', detail: String(e).slice(0, 300) }, 500)
  }
})
