// TEMP DIAGNOSTICA: prova l'interpretazione del catalogo su un URL PDF e ritorna il risultato GREZZO
// (stato Anthropic, stop_reason, anteprima testo, n. modelli). Serve a betatestare prima di pubblicare.
// Deploy con --no-verify-jwt. Accetta solo URL del bucket album-catalogs. DA RIMUOVERE dopo il test.
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

const PROMPT = `Questo PDF è il CATALOGO ALBUM di uno studio fotografico. Leggi TUTTA l'offerta e restituiscila STRUTTURATA.
Per OGNI MODELLO estrai: "label", "price"(num o null), "pages"(num o null), "page"(pagina 1-based), "x","y","w","h"(riquadro 0..1), "materials":[{"label","surcharge"}], "colors":[{"label"}], "logos":[{"label","surcharge"}], "coverPhoto"(bool). Rispetta le INTERSEZIONI del catalogo. Rispondi SOLO con JSON: {"models":[...]}. Niente testo fuori.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!ANTHROPIC_KEY) return json({ ok: false, error: 'no_ai_key' })
  let body: { url?: string; model?: string; max_tokens?: number }
  try { body = await req.json() } catch { return json({ ok: false, error: 'bad_json' }) }
  const url = body.url || ''
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/album-catalogs\//.test(url)) return json({ ok: false, error: 'bad_url' })
  const model = body.model || 'claude-sonnet-4-6'
  const max_tokens = body.max_tokens || 16000

  const t0 = Date.now()
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens,
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'url', url } },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    })
    const ms = Date.now() - t0
    if (!r.ok) return json({ ok: false, stage: 'anthropic', http: r.status, ms, detail: (await r.text()).slice(0, 800) })
    const d = await r.json()
    const text: string = d?.content?.[0]?.text ?? ''
    const stop = d?.stop_reason
    const usage = d?.usage
    let parsedCount = -1, parseErr = ''
    const m = text.match(/\{[\s\S]*\}/)
    if (m) { try { parsedCount = (JSON.parse(m[0]).models ?? []).length } catch (e) { parseErr = String((e as Error).message).slice(0, 120) } }
    return json({ ok: true, model, ms, stop_reason: stop, usage, parsedCount, parseErr, textLen: text.length, textHead: text.slice(0, 400), textTail: text.slice(-300) })
  } catch (e) { return json({ ok: false, stage: 'exception', detail: String(e).slice(0, 400) }) }
})
