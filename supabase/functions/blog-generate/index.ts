// Edge function: blog-generate
// Genera una bozza di articolo blog (IT, SEO) a partire da uno spunto: la
// caption di un post Instagram (incollata) o un tema. Usa Claude (Anthropic).
// Aperto a tutti i professionisti autenticati. Richiede il secret ANTHROPIC_API_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MODEL = 'claude-sonnet-4-6'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Best-effort: estrae la meta description (caption) da un URL di post.
async function fetchMeta(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Planfully/1.0)' } })
    const html = await r.text()
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i)
    return m?.[1] ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').slice(0, 1200) : ''
  } catch { return '' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Richiede un utente autenticato (qualunque professionista).
  const authHeader = req.headers.get('Authorization') ?? ''
  const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  if (!ANTHROPIC_KEY) {
    return json({ error: 'no_ai_key', hint: 'Imposta il secret ANTHROPIC_API_KEY su Supabase Functions.' }, 503)
  }

  let body: { caption?: string; post_url?: string; topic?: string; author_name?: string; subrole?: string; city?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  let seed = (body.caption ?? '').trim()
  if (!seed && body.post_url) seed = await fetchMeta(body.post_url.trim())
  const topic = (body.topic ?? '').trim()
  if (!seed && !topic) return json({ error: 'empty_input', hint: 'Incolla la caption del post (o un tema).' }, 400)

  const who = [body.author_name && `di ${body.author_name}`, body.subrole && `(${body.subrole})`, body.city && `a ${body.city}`].filter(Boolean).join(' ')

  const prompt = `Sei un copywriter SEO esperto del settore matrimoni ed eventi in Italia.
Scrivi un articolo di blog in ITALIANO, naturale e coinvolgente (non robotico), per un professionista ${who || 'del settore eventi'}.
${topic ? `Tema: ${topic}\n` : ''}${seed ? `Spunto (caption Instagram del professionista):\n"""${seed}"""\n` : ''}
Requisiti:
- 500-800 parole, tono professionale ma caldo, in prima persona quando ha senso.
- Ottimizzato per la ricerca (parole chiave naturali, niente keyword stuffing).
- Struttura con sottotitoli <h2> e paragrafi <p>; usa una <ul> dove utile.
- Chiudi con una breve call-to-action discreta.
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con questi campi:
{"title": string, "excerpt": string (max 200 caratteri), "body_html": string (solo <h2>,<p>,<ul>,<li>,<strong>,<em>), "tags": string[] (4-6 tag brevi), "seo_title": string (max 60 caratteri), "seo_description": string (max 155 caratteri)}`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2400, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      return json({ error: 'ai_error', status: r.status, detail: t.slice(0, 300) }, 502)
    }
    const data = await r.json()
    const text: string = data?.content?.[0]?.text ?? ''
    const start = text.indexOf('{'); const end = text.lastIndexOf('}')
    if (start < 0 || end < 0) return json({ error: 'ai_no_json', raw: text.slice(0, 300) }, 502)
    let draft: Record<string, unknown>
    try { draft = JSON.parse(text.slice(start, end + 1)) } catch { return json({ error: 'ai_bad_json', raw: text.slice(0, 300) }, 502) }
    return json({ ok: true, draft })
  } catch (e) {
    return json({ error: 'fetch_failed', detail: (e as Error).message }, 502)
  }
})
