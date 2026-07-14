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
// qwen-plus: molto più veloce di qwen-max a parità di qualità sui contratti (qwen-max ci metteva troppo);
// override con QWEN_TEXT_MODEL se serve (es. qwen-turbo ancora più rapido, qwen-max più "ricco").
const MODEL = Deno.env.get('QWEN_TEXT_MODEL') ?? 'qwen-plus'

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
  // Sezioni correnti (quelle che il fornitore ha davanti nell'editor): se presenti, l'AI le RIFINISCE
  // (riempie i dati reali + lettura/interpretazione più professionale) invece di rigenerare da zero.
  const current = Array.isArray(b.sections)
    ? (b.sections as any[]).filter((s) => s && s.heading != null && s.body != null)
        .map((s) => ({ heading: String(s.heading), body: String(s.body), type: String(s.type ?? 'CLAUSULE') }))
    : []
  const refine = current.length > 0

  // preventivo + proprietà (solo l'owner puo' generare il contratto)
  const { data: q, error: qErr } = await admin.from('quotes')
    .select('id, owner_id, title, client_name, client_email, event_date, event_location, event_kind, guest_count, total_client, client_country, direct_client_id')
    .eq('id', quoteId).maybeSingle()
  if (qErr) return json({ ok: false, error: 'quote_query', detail: qErr.message.slice(0, 200) })
  if (!q) return json({ ok: false, error: 'quote_not_found' })
  if (q.owner_id !== user.id) return json({ ok: false, error: 'forbidden' }, 403)

  // Dati fiscali del CLIENTE: li scrive lui accettando/firmando il preventivo → snapshot in quote_acceptances.
  // Per i clienti diretti (senza ancora una firma) fallback sull'anagrafica supplier_clients.
  const { data: acc } = await admin.from('quote_acceptances')
    .select('signer_name, doc_type, doc_number, client_fiscal_code, client_vat_number, client_business_name, client_address, client_city, client_zip, client_province, client_country, client_sdi_code, client_pec_email, created_at')
    .eq('quote_id', quoteId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  let dc: any = null
  if (!acc && q.direct_client_id) {
    const { data } = await admin.from('supplier_clients')
      .select('full_name, fiscal_code, vat_number, business_name, address, city, zip, province, country, sdi_code, pec_email')
      .eq('id', q.direct_client_id).maybeSingle()
    dc = data
  }
  const cliente = {
    nome: acc?.signer_name ?? q.client_name ?? dc?.full_name ?? null,
    email: q.client_email ?? null,
    codice_fiscale: acc?.client_fiscal_code ?? dc?.fiscal_code ?? null,
    partita_iva: acc?.client_vat_number ?? dc?.vat_number ?? null,
    ragione_sociale: acc?.client_business_name ?? dc?.business_name ?? null,
    indirizzo: acc?.client_address ?? dc?.address ?? null,
    citta: acc?.client_city ?? dc?.city ?? null,
    cap: acc?.client_zip ?? dc?.zip ?? null,
    provincia: acc?.client_province ?? dc?.province ?? null,
    paese: acc?.client_country ?? dc?.country ?? q.client_country ?? null,
    codice_sdi: acc?.client_sdi_code ?? dc?.sdi_code ?? null,
    pec: acc?.client_pec_email ?? dc?.pec_email ?? null,
    documento: acc?.doc_type ? `${acc.doc_type} n. ${acc.doc_number ?? ''}`.trim() : null,
  }

  // Lingua + giurisdizione: derivate dal Paese del cliente (da firma/anagrafica), con override dal body.
  const COUNTRY: Record<string, { lang: string; juris: string }> = {
    italia: { lang: 'it', juris: 'Italia' }, germania: { lang: 'de', juris: 'Germania' },
    francia: { lang: 'fr', juris: 'Francia' }, 'regno unito': { lang: 'en', juris: 'Regno Unito' },
    spagna: { lang: 'es', juris: 'Spagna' }, svizzera: { lang: 'de', juris: 'Svizzera' },
    austria: { lang: 'de', juris: 'Austria' }, 'paesi bassi': { lang: 'nl', juris: 'Paesi Bassi' },
    belgio: { lang: 'fr', juris: 'Belgio' }, 'stati uniti': { lang: 'en', juris: 'Stati Uniti' },
  }
  const map = COUNTRY[String(cliente.paese ?? '').trim().toLowerCase()] ?? null
  const language = String(b.language ?? map?.lang ?? 'it')
  const jurisdiction = String(b.jurisdiction ?? map?.juris ?? cliente.paese ?? 'Italia')

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
    cliente,
    evento: { tipo: q.event_kind, data: q.event_date, luogo: q.event_location, invitati: q.guest_count },
    offerta: offer,
    totale_eur: q.total_client,
  }

  const GEN_PROMPT = `Sei un giurista che redige CONTRATTI per professionisti di eventi/matrimoni.
Redigi un contratto COMPLETO e professionale a partire dai dati qui sotto, RIBALTANDO integralmente il
preventivo nel contratto, adattato al sistema giuridico di "${jurisdiction}" e scritto interamente in lingua "${language}".
Includi almeno:
- PARTI CONTRAENTI: inserisci per il professionista TUTTI i suoi dati fiscali disponibili (ragione sociale/
  business_legal_name, P.IVA/vat_number, codice fiscale/fiscal_code, indirizzo completo, PEC); per il CLIENTE
  inserisci TUTTI i suoi dati fiscali disponibili nel dossier (nome, codice fiscale, e se azienda P.IVA e
  ragione sociale, indirizzo/città/CAP/provincia/paese, PEC, codice SDI, estremi del documento d'identità).
  Usa SOLO i dati presenti nel dossier: se un campo del cliente è null/mancante, mettilo tra parentesi quadre
  come segnaposto e NON inventarlo.
- OGGETTO/PRESTAZIONI: contrattualizza OGNI voce dell'offerta (nome, quantità, descrizione) trasformandola in
  obbligazione contrattuale; non ometterne nessuna.
- CORRISPETTIVO E PAGAMENTO: usa il totale indicato con acconto/saldo coerenti; NON inventare importi diversi dal totale.
- tempistiche/consegne, recesso e cancellazione, forza maggiore, trattamento dati personali (normativa privacy
  corretta per "${jurisdiction}", non citare leggi italiane se la giurisdizione è diversa), foro competente.
Se un dato manca, usa un segnaposto tra parentesi quadre. NON inventare dati fiscali non forniti.
Rispondi ESCLUSIVAMENTE con JSON valido, senza testo intorno:
{"sections":[{"heading":"<titolo sezione>","body":"<testo completo>","type":"CLAUSULE|PRICE|TERMS"}]}

DATI:
${JSON.stringify(dossier, null, 2)}`

  // Modalità RIFINITURA: parte dalla bozza che il fornitore ha già davanti e la migliora, senza stravolgerla.
  const REFINE_PROMPT = `Sei un giurista che PERFEZIONA un contratto già impostato da un professionista di eventi/matrimoni.
Ti do (A) le SEZIONI ATTUALI del contratto così come sono nell'editor e (B) i DATI reali dell'evento.
Il tuo compito:
1) COMPILA per bene i dati: sostituisci ogni segnaposto o campo generico (parti, date, luogo, importi, prestazioni)
   con i valori reali presi dai DATI; NON inventare importi diversi dal totale indicato.
2) Rendi la lettura più PROFESSIONALE e giuridicamente solida: migliora forma, chiarezza e interpretazione,
   completa le clausole deboli, adatta il testo al sistema giuridico di "${jurisdiction}" e alla lingua "${language}"
   (usa la normativa privacy corretta per "${jurisdiction}", non citare leggi italiane se la giurisdizione è diversa).
3) PRESERVA l'intento e le scelte del professionista: mantieni le sezioni che ha già scritto e il loro senso,
   non cancellare clausole volute; puoi riordinare e aggiungerne di mancanti (es. foro competente, forza maggiore).
Rispondi ESCLUSIVAMENTE con JSON valido, senza testo intorno:
{"sections":[{"heading":"<titolo sezione>","body":"<testo completo>","type":"CLAUSULE|PRICE|TERMS"}]}

(A) SEZIONI ATTUALI:
${JSON.stringify(current, null, 2)}

(B) DATI:
${JSON.stringify(dossier, null, 2)}`

  const PROMPT = refine ? REFINE_PROMPT : GEN_PROMPT

  try {
    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${QWEN_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 2600, messages: [{ role: 'user', content: PROMPT }] }),
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
