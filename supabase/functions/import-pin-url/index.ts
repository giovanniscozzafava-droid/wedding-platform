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
  const htmlAc = new AbortController()
  const htmlTimeout = setTimeout(() => htmlAc.abort(), 8000)
  try {
    const r = await fetch(finalUrl, {
      redirect: 'follow',
      signal: htmlAc.signal,
      headers: {
        'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'accept-language': 'it-IT,it;q=0.9,en;q=0.8',
      },
    })
    clearTimeout(htmlTimeout)
    if (!r.ok) return json({ error: `Pagina non raggiungibile (HTTP ${r.status})` }, 502)
    finalUrl = r.url
    html = await r.text()
  } catch (e: any) {
    clearTimeout(htmlTimeout)
    const msg = e?.name === 'AbortError' ? 'timeout caricamento pagina (8s)' : (e?.message ?? 'fetch error')
    return json({ error: `Impossibile leggere la pagina: ${msg}` }, 502)
  }

  const image = pickMeta(html, 'og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src')
  const title = pickMeta(html, 'og:title', 'twitter:title') || ''
  const desc = pickMeta(html, 'og:description', 'description', 'twitter:description') || ''

  if (!image) return json({ error: 'no og:image found' }, 422)

  // Se richiesto, scarica l'immagine lato server (bypassa CORS browser) e
  // ritorna in base64 + content-type. Il client puo' poi ricostruire un Blob/File.
  // Per Instagram carosello og:image punta a scontent-*.cdninstagram.com che a volte
  // rifiuta facebookexternalhit. Provo piu' user-agent prima di arrendermi.
  let imageBase64: string | null = null
  let imageContentType: string | null = null
  let imageFetchError: string | null = null

  if (body.fetch_image) {
    // Tentativi in ordine: direct (FB UA), direct (Chrome UA), proxy wsrv.nl
    // (wsrv.nl e' un image proxy CDN gratuito Cloudflare che funziona anche
    //  quando Instagram blocca tutti i bot).
    const attempts: { tag: string; url: string; headers: Record<string, string> }[] = [
      {
        tag: 'fb',
        url: image,
        headers: {
          'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'referer': finalUrl,
          'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      },
      {
        tag: 'chrome',
        url: image,
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'referer': finalUrl,
          'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      },
      {
        tag: 'wsrv',
        url: `https://wsrv.nl/?url=${encodeURIComponent(image)}&output=jpg&q=85`,
        headers: { 'user-agent': 'Planfully/1.0' },
      },
    ]
    for (const att of attempts) {
      const ac = new AbortController()
      const timeout = setTimeout(() => ac.abort(), 8000)
      try {
        const ir = await fetch(att.url, { redirect: 'follow', signal: ac.signal, headers: att.headers })
        clearTimeout(timeout)
        if (!ir.ok) { imageFetchError = `${att.tag}:HTTP_${ir.status}`; continue }
        const ab = await ir.arrayBuffer()
        if (ab.byteLength < 200) { imageFetchError = `${att.tag}:empty`; continue }
        const u8 = new Uint8Array(ab)
        let bin = ''
        const chunkSize = 0x8000
        for (let i = 0; i < u8.length; i += chunkSize) {
          bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunkSize)))
        }
        imageBase64 = btoa(bin)
        imageContentType = ir.headers.get('content-type') ?? 'image/jpeg'
        imageFetchError = null
        break
      } catch (e: any) {
        clearTimeout(timeout)
        imageFetchError = `${att.tag}:${e?.name === 'AbortError' ? 'timeout' : (e?.message ?? 'fetch_error').slice(0, 40)}`
      }
    }
  }

  return json({
    image,
    image_base64: imageBase64,
    image_content_type: imageContentType,
    image_fetch_error: imageFetchError,
    title: title.slice(0, 200),
    description: desc.slice(0, 500),
    source_url: finalUrl,
  })
})
