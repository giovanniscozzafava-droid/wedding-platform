// Edge function link-preview: data un URL, fetcha la pagina e ritorna
// i meta tag Open Graph + Twitter Card per generare card unfurled.
//
// POST { url: "https://..." } → { ok, title, description, image, site_name, url }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

function extractMeta(html: string, prop: string): string | null {
  // og: e twitter: name="..." content="..." in qualsiasi ordine
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m && m[1]) return decodeHtmlEntities(m[1])
  }
  return null
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? decodeHtmlEntities(m[1].trim()) : null
}

function extractDescription(html: string): string | null {
  // og:description prima, poi name=description
  const og = extractMeta(html, 'og:description')
  if (og) return og
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  if (m) return decodeHtmlEntities(m[1])
  const m2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
  if (m2) return decodeHtmlEntities(m2[1])
  return null
}

function absUrl(maybeUrl: string | null, baseUrl: string): string | null {
  if (!maybeUrl) return null
  try {
    const u = new URL(maybeUrl, baseUrl)
    return u.toString()
  } catch { return null }
}

// Anti-SSRF robusto: la blocklist su stringa-host è aggirabile (172.16/12, IPv6,
// IP numerici/ottali/hex, DNS-rebinding). Risolviamo il DNS e validiamo l'IP.
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
  let h: string
  try { h = new URL(urlStr).hostname } catch { throw new Error('invalid url') }
  const bare = h.replace(/^\[|\]$/g, '')
  if (bare === 'localhost' || bare.endsWith('.localhost') || bare.endsWith('.local') || bare.endsWith('.internal')) throw new Error('blocked host')
  if (/^[\d.]+$/.test(bare) || bare.includes(':')) {
    if (isPrivateIp(bare)) throw new Error('blocked private ip')
    return
  }
  const v4 = await Deno.resolveDns(bare, 'A').catch(() => [] as string[])
  const v6 = await Deno.resolveDns(bare, 'AAAA').catch(() => [] as string[])
  const addrs = [...v4, ...v6]
  if (addrs.length === 0) throw new Error('dns no records')
  for (const a of addrs) if (isPrivateIp(a)) throw new Error('blocked private ip')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { url?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const url = body.url?.trim()
  if (!url || !/^https?:\/\//.test(url)) return json({ error: 'invalid_url' }, 400)

  // Anti-SSRF: valida l'IP risolto (no IP privati/loopback/metadata).
  try { await assertPublicHost(url) } catch (e) { return json({ error: 'forbidden_host', detail: String((e as Error)?.message ?? e) }, 400) }

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 8000)
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; PlanfullyBot/1.0; +https://planfully.it)',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'it,en;q=0.7',
      },
      signal: ac.signal,
      redirect: 'follow',
    })
    clearTimeout(timer)
    // Dopo eventuali redirect, l'URL finale potrebbe puntare a un host interno:
    // rivalida prima di leggere il body (anti-SSRF redirect).
    try { await assertPublicHost(res.url) } catch { return json({ ok: false, error: 'forbidden_redirect', url }) }
    if (!res.ok) return json({ ok: false, error: `fetch_failed_${res.status}`, url })
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return json({ ok: false, error: 'not_html', url, content_type: ct })
    }

    const html = (await res.text()).slice(0, 500_000)  // limita a 500KB

    const baseUrl = res.url || url
    const finalUrl = extractMeta(html, 'og:url') ?? baseUrl
    const title = extractMeta(html, 'og:title') ?? extractMeta(html, 'twitter:title') ?? extractTitle(html)
    const description = extractDescription(html)
    const image = absUrl(extractMeta(html, 'og:image') ?? extractMeta(html, 'twitter:image'), baseUrl)
    const siteName = extractMeta(html, 'og:site_name') ?? new URL(baseUrl).hostname

    return json({
      ok: true,
      url: finalUrl,
      title,
      description: description ? description.slice(0, 280) : null,
      image,
      site_name: siteName,
    })
  } catch (e) {
    return json({ ok: false, error: 'fetch_error', detail: (e as Error).message, url })
  }
})
