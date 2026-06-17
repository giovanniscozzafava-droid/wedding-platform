// Edge function: resolve-og-image
// Dato un link (Pinterest/Instagram/web), recupera la pagina lato server ed estrae
// l'immagine principale (og:image / twitter:image). Serve per aggiungere asset-stile
// al volo da un link, senza che il fornitore carichi il file.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

function pick(html: string, res: RegExp[]): string | null {
  for (const re of res) { const m = html.match(re); if (m?.[1]) return m[1] }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { url?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const url = (body.url ?? '').trim()
  if (!/^https?:\/\/.+/i.test(url)) return json({ error: 'invalid_url' }, 400)

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PlanfullyBot/1.0; +https://planfully.it)', 'Accept': 'text/html' },
      redirect: 'follow',
    })
    const html = (await res.text()).slice(0, 600000)
    let img = pick(html, [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
      /"display_url":"([^"]+)"/i,            // Instagram JSON
      /"image_url":"([^"]+)"/i,             // Pinterest JSON
    ])
    if (img) img = img.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/')
    return json({ image_url: img || null, source_url: url })
  } catch (_e) {
    return json({ image_url: null, source_url: url, error: 'fetch_failed' })
  }
})
