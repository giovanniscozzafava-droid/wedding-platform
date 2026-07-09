// Edge function: album-catalog-extract
// Legge il PDF del catalogo album del fotografo con Claude (vision su PDF) ed estrae i MODELLI
// con i relativi PREZZI di listino. Il fotografo poi CONFERMA/corregge nel manager.
// Richiede ANTHROPIC_API_KEY. Autenticato (il chiamante dev'essere un utente loggato).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MODEL = 'claude-sonnet-4-6'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

const PROMPT = `Questo PDF è il CATALOGO ALBUM di uno studio fotografico: elenca modelli di album con i relativi PREZZI di listino.
Estrai OGNI modello con il suo prezzo. Rispondi SOLO con JSON valido, nessun testo fuori:
{"models":[{"label":"<nome del modello come stampato>","price":<prezzo in euro, solo numero, oppure null se assente>}]}
Regole: se un modello ha più prezzi (per misura/pagine) prendi quello base/più rappresentativo; ignora testi che non sono modelli; niente duplicati.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' })
  if (!ANTHROPIC_KEY) return json({ ok: false, error: 'no_ai_key' })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authH = req.headers.get('Authorization') ?? ''
  const { data: cu } = await admin.auth.getUser(authH.slice(7))
  if (!cu?.user) return json({ ok: false, error: 'auth' })

  let body: { url?: string; base64?: string }
  try { body = await req.json() } catch { return json({ ok: false, error: 'bad_json' }) }
  const url = body.url || ''
  const base64 = (body.base64 || '').replace(/^data:[^,]+,/, '')
  if (!url && !base64) return json({ ok: false, error: 'no_file' })
  const docSource = url ? { type: 'url', url } : { type: 'base64', media_type: 'application/pdf', data: base64 }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 8000,
        messages: [{ role: 'user', content: [
          { type: 'document', source: docSource },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    })
    if (!r.ok) return json({ ok: false, error: 'ai_error', detail: (await r.text()).slice(0, 300) })
    const d = await r.json()
    const text: string = d?.content?.[0]?.text ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return json({ ok: false, error: 'parse', raw: text.slice(0, 300) })
    const parsed = JSON.parse(m[0])
    const models = Array.isArray(parsed.models)
      ? parsed.models
          .map((x: { label?: unknown; price?: unknown }) => ({
            label: String(x.label ?? '').trim(),
            price: x.price == null || x.price === '' ? null : Number(x.price),
          }))
          .filter((x: { label: string; price: number | null }) => x.label && (x.price == null || Number.isFinite(x.price)))
      : []
    return json({ ok: true, models })
  } catch (e) { return json({ ok: false, error: 'exception', detail: String(e).slice(0, 300) }, 500) }
})
