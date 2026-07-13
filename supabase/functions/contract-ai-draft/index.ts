// contract-ai-draft — genera una BOZZA DI CONTRATTO dal preventivo, "ribaltando" offerta + dati, con
// Qwen (Alibaba DashScope, text). Ritorna sezioni {heading, body, type} pronte per l'editor contratto.
// Provider-agnostico: QWEN_BASE_URL + QWEN_TEXT_MODEL sono override. Pronto per l'internazionalizzazione:
// accetta language + jurisdiction, così lo stesso contratto esce nella lingua e nel quadro legale giusti.
// Auth: solo il proprietario del preventivo. Dormiente finché non è settato DASHSCOPE_API_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const QWEN_KEY = Deno.env.get('DASHSCOPE_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const BASE_URL = Deno.env.get('QWEN_BASE_URL') ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const MODEL = Deno.env.get('QWEN_TEXT_MODEL') ?? 'qwen-max'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' })
  if (!QWEN_KEY) return json({ ok: false, error: 'no_ai_key' })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const { data: u } = await userClient.auth.getUser()
  const user = u.user
  if (!user) return json({ ok: false, error: 'auth' })

  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const quoteId = String(b.quote_id ?? '')
  if (!quoteId) return json({ ok: false, error: 'no_quote' })
  const language = String(b.language ?? 'it')        // ISO breve; default italiano
  const jurisdiction = String(b.jurisdiction ?? 'Italia')

  // preventivo + proprietà (solo l'owner puo' generare il contratto)
  const { data: q } = await admin.from('quotes')
    .select('id, owner_id, title, client_name, client_email, event_date, event_location, event_kind, guest_count, total_client')
    .eq('id', quoteId).maybeSingle()
  if (!q) return json({ ok: false, error: 'quote_not_found' })
  if (q.owner_id !== user.id) return json({ ok: false, error: 'forbidden' }, 403)

  const { data: items } = await admin.from('quote_items')
    .select('name_snapshot, description_snapshot, quantity, unit_snapshot, line_client')
    .eq('quote_id', quoteId).order('sort_order')
  const { data: owner } = await admin.from('profiles')
    .select('full_name, business_name, business_legal_name, vat_number, fiscal_code, address, city, zip, province, country, pec_email, role, subrole')
    .eq('id', q.owner_id).maybeSingle()

  const offer = (items ?? []).map((it: any) =>
    `- ${it.name_snapshot}${it.quantity > 1 ? ` ×${it.quantity} ${String(it.unit_snapshot || '').toLowerCase()}` : ''}: € ${Number(it.line_client || 0).toFixed(2)}${it.description_snapshot ? ` (${it.description_snapshot})` : ''}`
  ).join('\n')

  const dossier = {
    professionista: owner,
    cliente: { nome: q.client_name, email: q.client_email },
    evento: { tipo: q.event_kind, data: q.event_date, luogo: q.event_location, invitati: q.guest_count },
    offerta: offer,
    totale_eur: q.total_client,
  }

  const PROMPT = `Sei un giurista che redige CONTRATTI per professionisti di eventi/matrimoni.
Redigi un contratto COMPLETO e professionale a partire dai dati qui sotto, adattandolo al sistema
giuridico di "${jurisdiction}" e scritto interamente in lingua "${language}".
Includi almeno: parti contraenti (con i dati forniti), oggetto/prestazioni (ribaltando l'offerta),
corrispettivo e modalità di pagamento (con acconto/saldo coerenti col totale), tempistiche/consegne,
recesso e cancellazione, forza maggiore, trattamento dati personali (usa la normativa privacy corretta
per "${jurisdiction}", non citare leggi italiane se la giurisdizione è diversa), foro competente.
NON inventare importi diversi dal totale. Se un dato manca, usa un segnaposto tra parentesi quadre.
Rispondi ESCLUSIVAMENTE con JSON valido, senza testo intorno:
{"sections":[{"heading":"<titolo sezione>","body":"<testo completo>","type":"CLAUSULE|PRICE|TERMS"}]}

DATI:
${JSON.stringify(dossier, null, 2)}`

  try {
    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${QWEN_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 4000, messages: [{ role: 'user', content: PROMPT }] }),
    })
    if (!r.ok) return json({ ok: false, error: 'ai_error', detail: (await r.text()).slice(0, 300) })
    const d = await r.json()
    const text: string = d?.choices?.[0]?.message?.content ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return json({ ok: false, error: 'parse', raw: text.slice(0, 300) })
    const parsed = JSON.parse(m[0])
    const sections = Array.isArray(parsed.sections) ? parsed.sections
      .filter((s: any) => s && s.heading && s.body)
      .map((s: any) => ({ heading: String(s.heading), body: String(s.body), type: ['CLAUSULE', 'PRICE', 'TERMS'].includes(s.type) ? s.type : 'CLAUSULE' }))
      : []
    if (!sections.length) return json({ ok: false, error: 'empty' })
    return json({ ok: true, sections })
  } catch (e) {
    return json({ ok: false, error: 'exception', detail: String(e).slice(0, 300) }, 500)
  }
})
