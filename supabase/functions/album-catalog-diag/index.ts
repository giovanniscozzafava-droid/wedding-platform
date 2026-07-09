// TEMP DIAGNOSTICA: prova l'interpretazione del catalogo su un URL PDF con provider diversi
// (anthropic | qwen | openai) e ritorna il risultato GREZZO. Per betatestare prima di pubblicare.
// Deploy con --no-verify-jwt. Solo URL del bucket album-catalogs. DA RIMUOVERE dopo il test.
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const DASHSCOPE_KEY = Deno.env.get('DASHSCOPE_API_KEY') ?? ''
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

const PROMPT = `Questo PDF è il CATALOGO ALBUM di uno studio fotografico. Leggi TUTTA l'offerta e restituiscila STRUTTURATA.
Per OGNI MODELLO estrai: "label", "price"(num o null), "pages"(num o null), "page"(pagina 1-based), "x","y","w","h"(riquadro 0..1), "materials":[{"label","surcharge"}], "colors":[{"label"}], "logos":[{"label","surcharge"}], "coverPhoto"(bool). Rispetta le INTERSEZIONI del catalogo. Rispondi SOLO con JSON: {"models":[...]}. Niente testo fuori.`

async function tryAnthropic(url: string) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 16000, messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'url', url } }, { type: 'text', text: PROMPT }] }] }),
  })
  if (!r.ok) return { ok: false, http: r.status, detail: (await r.text()).slice(0, 500) }
  const d = await r.json()
  return { ok: true, stop: d?.stop_reason, usage: d?.usage, text: d?.content?.[0]?.text ?? '' }
}

// Qwen via DashScope (endpoint OpenAI-compatibile). qwen-vl-max legge immagini/URL.
async function tryQwen(url: string, model = 'qwen-vl-max') {
  const r = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${DASHSCOPE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url } }, { type: 'text', text: PROMPT }] }] }),
  })
  if (!r.ok) return { ok: false, http: r.status, detail: (await r.text()).slice(0, 500) }
  const d = await r.json()
  return { ok: true, text: d?.choices?.[0]?.message?.content ?? '', usage: d?.usage }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  let body: { url?: string; provider?: string }
  try { body = await req.json() } catch { return json({ ok: false, error: 'bad_json' }) }
  const url = body.url || ''
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/album-catalogs\//.test(url)) return json({ ok: false, error: 'bad_url' })
  const provider = body.provider || 'anthropic'

  const t0 = Date.now()
  try {
    const res = provider === 'qwen' ? await tryQwen(url) : await tryAnthropic(url)
    const ms = Date.now() - t0
    if (!res.ok) return json({ provider, ok: false, http: res.http, ms, detail: res.detail })
    const text: string = res.text ?? ''
    let parsedCount = -1, parseErr = ''
    const m = text.match(/\{[\s\S]*\}/)
    if (m) { try { parsedCount = (JSON.parse(m[0]).models ?? []).length } catch (e) { parseErr = String((e as Error).message).slice(0, 120) } }
    return json({ provider, ok: true, ms, stop: (res as { stop?: unknown }).stop, usage: res.usage, parsedCount, parseErr, textLen: text.length, textHead: text.slice(0, 350), textTail: text.slice(-250) })
  } catch (e) { return json({ provider, ok: false, stage: 'exception', detail: String(e).slice(0, 400) }) }
})
