// Edge function pexels-search:
// Proxy server-side alla Pexels API. Tiene la chiave fuori dal bundle frontend.
//
// POST { query: "rose bouquet", per_page?: 12, orientation?: "landscape", page?: 1 }
// → { ok, photos: [{ id, src: {medium, large, original}, photographer, alt }] }
//
// Richiede secret PEXELS_API_KEY (gratuito su https://www.pexels.com/api/new/).

const PEXELS_KEY = Deno.env.get('PEXELS_API_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  if (!PEXELS_KEY) {
    return json({
      ok: false,
      error: 'no_pexels_key',
      hint: 'Set PEXELS_API_KEY secret on Supabase Functions (free at pexels.com/api).',
    }, 503)
  }

  let body: { query?: string; per_page?: number; orientation?: string; page?: number }
  try { body = await req.json() } catch { return json({ ok: false, error: 'invalid_json' }, 400) }

  const query = (body.query ?? '').trim()
  if (!query) return json({ ok: false, error: 'empty_query' }, 400)

  const params = new URLSearchParams({
    query,
    per_page: String(Math.min(80, Math.max(1, body.per_page ?? 12))),
    page: String(Math.max(1, body.page ?? 1)),
  })
  if (body.orientation && ['landscape', 'portrait', 'square'].includes(body.orientation)) {
    params.set('orientation', body.orientation)
  }

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 10000)
    const r = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: {
        Authorization: PEXELS_KEY,
        'user-agent': 'Planfully/1.0 (+https://planfully.it)',
      },
      signal: ac.signal,
    })
    clearTimeout(timer)
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return json({ ok: false, error: 'pexels_error', status: r.status, detail: txt.slice(0, 200) }, 502)
    }
    const data = await r.json()
    const photos = (data.photos ?? []).map((p: any) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      src: {
        medium: p.src?.medium,
        large: p.src?.large,
        original: p.src?.original,
      },
      photographer: p.photographer,
      photographer_url: p.photographer_url,
      alt: p.alt,
      url: p.url,
    }))
    return json({
      ok: true,
      photos,
      total_results: data.total_results,
      page: data.page,
      per_page: data.per_page,
      next_page: data.next_page ?? null,
    })
  } catch (e) {
    return json({ ok: false, error: 'fetch_failed', detail: (e as Error).message }, 502)
  }
})
