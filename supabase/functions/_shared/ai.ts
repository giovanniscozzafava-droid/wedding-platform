// ============================================================================
// LAYER AI UNIFICATO — un solo punto per TUTTE le chiamate LLM della piattaforma.
// Ordine FISSO: Qwen (Alibaba DashScope) PRIMA, poi OpenAI, poi Claude (Anthropic).
// Qwen è il primario ovunque; gli altri intervengono SOLO se Qwen manca la chiave,
// non supporta l'input (es. PDF grezzo) o fallisce a runtime. Così l'infrastruttura
// regge: se un provider cade, la richiesta prosegue sul successivo senza rompersi.
//
// Uso:
//   import { aiChat, firstText } from '../_shared/ai.ts'
//   const res = await aiChat({ system, parts: [{ text }], maxTokens: 2000 })
//   if (!res.ok) return json({ error: 'ai_error', attempts: res.attempts })
//   const testo = res.text; const { inTok, outTok } = res.usage
//
// Le "parts" normalizzano testo / immagini / PDF:
//   { text: '...' }                        → testo
//   { image: 'https://…' | 'data:image…' } → visione (foto/scansione)
//   { pdfUrl } | { pdfBase64 }             → documento PDF (solo Claude lo legge nativo)
// ============================================================================

export type AiPart =
  | { text: string }
  | { image: string }                       // https:// oppure data:image/...;base64,...
  | { pdfUrl: string }
  | { pdfBase64: string }

export type Provider = 'qwen' | 'openai' | 'claude'

export type AiRequest = {
  system?: string
  parts: AiPart[]
  maxTokens?: number
  temperature?: number
  order?: Provider[]                        // default: qwen → openai → claude
  // Override modelli (di norma non serve).
  models?: Partial<Record<Provider, { text?: string; vision?: string }>>
}

export type AiUsage = { inTok: number; outTok: number }
export type AiResult =
  | { ok: true; text: string; provider: Provider; usage: AiUsage }
  | { ok: false; error: 'no_provider' | 'all_failed'; attempts: { provider: Provider; detail: string }[] }

const KEY = {
  qwen: Deno.env.get('DASHSCOPE_API_KEY') ?? '',
  openai: Deno.env.get('OPENAI_API_KEY') ?? '',
  claude: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
}
const QWEN_BASE = Deno.env.get('QWEN_BASE_URL') ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

// Modelli di default per provider (testo vs visione).
const DEFAULT_MODELS: Record<Provider, { text: string; vision: string }> = {
  qwen: { text: Deno.env.get('QWEN_TEXT_MODEL') ?? 'qwen-max', vision: Deno.env.get('QWEN_MODEL') ?? 'qwen-vl-max' },
  openai: { text: 'gpt-4o', vision: 'gpt-4o' },
  claude: { text: 'claude-sonnet-4-6', vision: 'claude-sonnet-4-6' },
}

const hasImage = (parts: AiPart[]) => parts.some((p) => 'image' in p)
const hasPdf = (parts: AiPart[]) => parts.some((p) => 'pdfUrl' in p || 'pdfBase64' in p)

// data:image/png;base64,AAA → { media_type, data }
function splitDataUrl(u: string): { media_type: string; data: string } | null {
  const m = u.match(/^data:([^;]+);base64,(.*)$/)
  return m ? { media_type: m[1], data: m[2] } : null
}

// ─────────────────────────── adapter: Qwen / OpenAI (OpenAI-compatible) ───────
async function callOpenAICompatible(
  provider: 'qwen' | 'openai', base: string, key: string, model: string, req: AiRequest,
): Promise<{ text: string; usage: AiUsage }> {
  const content: any[] = []
  for (const p of req.parts) {
    if ('text' in p) content.push({ type: 'text', text: p.text })
    else if ('image' in p) content.push({ type: 'image_url', image_url: { url: p.image } })
    // pdf* non supportato qui: chi chiama fa lo skip prima (canHandle).
  }
  const messages: any[] = []
  if (req.system) messages.push({ role: 'system', content: req.system })
  messages.push({ role: 'user', content: content.length === 1 && 'text' in req.parts[0] ? req.parts[0].text : content })

  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: req.maxTokens ?? 2000, temperature: req.temperature ?? 0.4 }),
  })
  if (!r.ok) throw new Error(`${provider} http ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = await r.json()
  const text = d?.choices?.[0]?.message?.content ?? ''
  return { text, usage: { inTok: d?.usage?.prompt_tokens ?? 0, outTok: d?.usage?.completion_tokens ?? 0 } }
}

// ─────────────────────────── adapter: Claude (Anthropic) ──────────────────────
async function callClaude(key: string, model: string, req: AiRequest): Promise<{ text: string; usage: AiUsage }> {
  const content: any[] = []
  for (const p of req.parts) {
    if ('text' in p) content.push({ type: 'text', text: p.text })
    else if ('image' in p) {
      if (p.image.startsWith('data:')) {
        const s = splitDataUrl(p.image)
        if (s) content.push({ type: 'image', source: { type: 'base64', media_type: s.media_type, data: s.data } })
      } else content.push({ type: 'image', source: { type: 'url', url: p.image } })
    } else if ('pdfUrl' in p) content.push({ type: 'document', source: { type: 'url', url: p.pdfUrl } })
    else if ('pdfBase64' in p) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.pdfBase64.replace(/^data:[^,]+,/, '') } })
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: req.maxTokens ?? 2000, ...(req.system ? { system: req.system } : {}), messages: [{ role: 'user', content }] }),
  })
  if (!r.ok) throw new Error(`claude http ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = await r.json()
  const text = d?.content?.[0]?.text ?? ''
  return { text, usage: { inTok: d?.usage?.input_tokens ?? 0, outTok: d?.usage?.output_tokens ?? 0 } }
}

// Un provider può gestire la richiesta? (chiave presente + input supportato)
function canHandle(provider: Provider, req: AiRequest): boolean {
  if (!KEY[provider]) return false
  // Solo Claude legge PDF grezzi; qwen/openai vanno usati con immagini (PDF rasterizzato).
  if (hasPdf(req.parts) && provider !== 'claude') return false
  return true
}

/**
 * Esegue una richiesta LLM provando i provider in ordine (default: qwen → openai → claude).
 * Ritorna il PRIMO successo, oppure l'elenco dei tentativi falliti.
 */
export async function aiChat(req: AiRequest): Promise<AiResult> {
  const order = req.order ?? ['qwen', 'openai', 'claude']
  const vision = hasImage(req.parts)
  const attempts: { provider: Provider; detail: string }[] = []

  for (const provider of order) {
    if (!canHandle(provider, req)) {
      attempts.push({ provider, detail: !KEY[provider] ? 'no_key' : 'unsupported_input' })
      continue
    }
    const model = req.models?.[provider]?.[vision ? 'vision' : 'text']
      ?? DEFAULT_MODELS[provider][vision ? 'vision' : 'text']
    try {
      const out = provider === 'claude'
        ? await callClaude(KEY.claude, model, req)
        : await callOpenAICompatible(provider, provider === 'qwen' ? QWEN_BASE : 'https://api.openai.com/v1', KEY[provider], model, req)
      if (!out.text || !out.text.trim()) throw new Error('empty_response')
      return { ok: true, text: out.text, provider, usage: out.usage }
    } catch (e) {
      attempts.push({ provider, detail: String((e as Error).message).slice(0, 300) })
    }
  }
  return { ok: false, error: attempts.length ? 'all_failed' : 'no_provider', attempts }
}

// Estrae il primo oggetto JSON da un testo LLM ({...}), o null.
export function firstJson<T = any>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) as T } catch { return null }
}
