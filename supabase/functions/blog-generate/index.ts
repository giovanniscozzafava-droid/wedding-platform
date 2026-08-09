// Edge function: blog-generate
// Genera una bozza di articolo blog (IT, SEO) a partire da uno spunto: la
// caption di un post Instagram (incollata) o un tema. AI via layer unificato:
// Qwen primario, fallback OpenAI/Claude (vedi _shared/ai.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { aiChat, firstJson } from '../_shared/ai.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Best-effort: estrae la meta description (caption) da un URL di post.
// SSRF guard: post_url è fornito dall'utente e scaricato server-side.
function isPrivateIp(ip: string): boolean {
  const s = ip.toLowerCase()
  if (s === '::1' || s === '::' || s === '0.0.0.0') return true
  if (s.startsWith('fe80:') || s.startsWith('fc') || s.startsWith('fd')) return true
  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const v4 = mapped ? mapped[1] : (/^\d+\.\d+\.\d+\.\d+$/.test(s) ? s : null)
  if (v4) {
    const p = v4.split('.').map(Number)
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true
    if (p[0] === 169 && p[1] === 254) return true
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true
    if (p[0] === 192 && p[1] === 168) return true
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true
    if (p[0] >= 224) return true
  }
  return false
}
async function assertPublicHost(urlStr: string): Promise<void> {
  let u: URL
  try { u = new URL(urlStr) } catch { throw new Error('invalid url') }
  if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol')
  const bare = u.hostname.replace(/^\[|\]$/g, '')
  if (bare === 'localhost' || bare.endsWith('.localhost') || bare.endsWith('.internal') || bare.endsWith('.local')) throw new Error('blocked host')
  if (/^[\d.]+$/.test(bare) || bare.includes(':')) { if (isPrivateIp(bare)) throw new Error('blocked private ip'); return }
  const v4 = await Deno.resolveDns(bare, 'A').catch(() => [] as string[])
  const v6 = await Deno.resolveDns(bare, 'AAAA').catch(() => [] as string[])
  const addrs = [...v4, ...v6]
  if (addrs.length === 0) throw new Error('dns no records')
  for (const a of addrs) if (isPrivateIp(a)) throw new Error('blocked private ip')
}

async function fetchMeta(url: string): Promise<string> {
  try {
    await assertPublicHost(url)
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Planfully/1.0)' }, redirect: 'follow' })
    await assertPublicHost(r.url)
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

  const res = await aiChat({ parts: [{ text: prompt }], maxTokens: 2400 })
  if (!res.ok) return json({ error: res.error === 'no_provider' ? 'no_ai_key' : 'ai_error', attempts: res.attempts }, res.error === 'no_provider' ? 503 : 502)
  const draft = firstJson<Record<string, unknown>>(res.text)
  if (!draft) return json({ error: 'ai_no_json', raw: res.text.slice(0, 300) }, 502)
  return json({ ok: true, draft, provider: res.provider })
})
