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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { url?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const url = body.url?.trim()
  if (!url || !/^https?:\/\//.test(url)) return json({ error: 'invalid_url' }, 400)

  // Anti-SSRF: blocca IP locali e indirizzi privati
  let parsed: URL
  try { parsed = new URL(url) } catch { return json({ error: 'invalid_url' }, 400) }
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    host === '0.0.0.0' ||
    host.endsWith('.local')
  ) {
    return json({ error: 'forbidden_host' }, 400)
  }

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
