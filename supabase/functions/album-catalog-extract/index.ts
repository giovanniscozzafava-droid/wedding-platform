// Edge function: album-catalog-extract
// Legge il PDF del catalogo album del fotografo ed estrae i MODELLI con i PREZZI di listino.
// Il fotografo poi CONFERMA/corregge nel manager. AI via layer unificato: per i PDF grezzi
// Qwen/OpenAI non li leggono → il layer ricade su Claude (unico con vision nativa su PDF).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { aiChat, firstJson } from '../_shared/ai.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authH = req.headers.get('Authorization') ?? ''
  const { data: cu } = await admin.auth.getUser(authH.slice(7))
  if (!cu?.user) return json({ ok: false, error: 'auth' })

  let body: { url?: string; base64?: string }
  try { body = await req.json() } catch { return json({ ok: false, error: 'bad_json' }) }
  const url = body.url || ''
  const base64 = (body.base64 || '').replace(/^data:[^,]+,/, '')
  if (!url && !base64) return json({ ok: false, error: 'no_file' })
  try {
    const res = await aiChat({
      parts: [url ? { pdfUrl: url } : { pdfBase64: base64 }, { text: PROMPT }],
      maxTokens: 8000,
    })
    if (!res.ok) return json({ ok: false, error: 'ai_error', attempts: res.attempts })
    const parsed = firstJson<{ models?: unknown }>(res.text)
    if (!parsed) return json({ ok: false, error: 'parse', raw: res.text.slice(0, 300) })
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
