// deno-lint-ignore-file no-explicit-any
// Estrae og:image da URL pubblico (Pinterest, Instagram, qualsiasi sito).
// POST { url: "https://www.pinterest.com/pin/..." }
// -> { image: "...", title: "...", source_url: "..." }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { 'content-type': 'application/json', ...cors },
  })
}

function pickMeta(html: string, ...names: string[]) {
  for (const name of names) {
    // og:image, og:title, twitter:image, etc.
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
    const m = html.match(re)
    if (m && m[1]) return m[1]
    // Order swap
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i')
    const m2 = html.match(re2)
    if (m2 && m2[1]) return m2[1]
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { url?: string; fetch_image?: boolean }
  if (!body.url) return json({ error: 'url required' }, 400)

  let target: URL
  try {
    target = new URL(body.url)
  } catch {
    return json({ error: 'invalid url' }, 400)
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return json({ error: 'unsupported protocol' }, 400)
  }

  // Pinterest/Instagram servono og:image solo a crawler whitelisted.
  // Usiamo facebookexternalhit che è universalmente accettato.
  let finalUrl = target.toString()
  let html = ''
  try {
    const r = await fetch(finalUrl, {
      redirect: 'follow',
      headers: {
        'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'accept-language': 'it-IT,it;q=0.9,en;q=0.8',
      },
    })
    if (!r.ok) return json({ error: `fetch failed ${r.status}` }, 502)
    finalUrl = r.url
    html = await r.text()
  } catch (e: any) {
    return json({ error: 'fetch error', detail: e?.message }, 502)
  }

  const image = pickMeta(html, 'og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src')
  const title = pickMeta(html, 'og:title', 'twitter:title') || ''
  const desc = pickMeta(html, 'og:description', 'description', 'twitter:description') || ''

  if (!image) return json({ error: 'no og:image found' }, 422)

  // Se richiesto, scarica l'immagine lato server (bypassa CORS browser) e
  // ritorna in base64 + content-type. Il client puo' poi ricostruire un Blob/File.
  let imageBase64: string | null = null
  let imageContentType: string | null = null
  if (body.fetch_image) {
    try {
      const ir = await fetch(image, {
        redirect: 'follow',
        headers: {
          'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'referer': finalUrl,
          'accept': 'image/*',
        },
      })
      if (ir.ok) {
        const ab = await ir.arrayBuffer()
        const u8 = new Uint8Array(ab)
        // base64 senza dipendenze: usa btoa con string accumulata
        let bin = ''
        for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
        imageBase64 = btoa(bin)
        imageContentType = ir.headers.get('content-type') ?? 'image/jpeg'
      }
    } catch { /* fallthrough: ritorna solo URL */ }
  }

  return json({
    image,
    image_base64: imageBase64,
    image_content_type: imageContentType,
    title: title.slice(0, 200),
    description: desc.slice(0, 500),
    source_url: finalUrl,
  })
})
