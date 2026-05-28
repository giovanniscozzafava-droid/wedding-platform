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

  // Instagram: tenta endpoint embed pubblico /embed/ (non richiede login).
  // L'HTML embed include URL scontent.cdninstagram.com/v/t39.30808-6 (post content).
  // Se l'URL utente specifica ?img_index=N (1-based) selezioniamo la N-esima
  // foto del carosello invece della prima.
  let finalUrl = target.toString()
  const host = target.hostname.replace(/^www\./, '')
  const isInstagram = host.includes('instagram.')
  let carouselIndex: number | null = null
  if (isInstagram) {
    // Parsing img_index sia da query (?img_index=5) sia da path (/img_index/5).
    const qIdx = target.searchParams.get('img_index')
    if (qIdx) {
      const n = parseInt(qIdx, 10)
      if (!isNaN(n) && n >= 1) carouselIndex = n
    }
    const pathMatch = target.pathname.match(/^\/(p|reel|reels|tv)\/([^/]+)/)
    if (pathMatch) {
      finalUrl = `https://www.instagram.com/p/${pathMatch[2]}/embed/`
    }
  }

  // Pinterest/Instagram bloccano facebookexternalhit. Tentativi multi-UA:
  let html = ''
  const uaAttempts: Array<{ tag: string; ua: string }> = [
    { tag: 'fb', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
    { tag: 'twitter', ua: 'Twitterbot/1.0' },
    { tag: 'chrome', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
  ]
  let lastErr = ''
  let ok = false
  for (const att of uaAttempts) {
    const htmlAc = new AbortController()
    const htmlTimeout = setTimeout(() => htmlAc.abort(), 8000)
    try {
      const r = await fetch(finalUrl, {
        redirect: 'follow',
        signal: htmlAc.signal,
        headers: {
          'user-agent': att.ua,
          'accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'accept-language': 'it-IT,it;q=0.9,en;q=0.8',
        },
      })
      clearTimeout(htmlTimeout)
      if (!r.ok) { lastErr = `${att.tag}:HTTP_${r.status}`; continue }
      finalUrl = r.url
      html = await r.text()
      ok = true
      break
    } catch (e: any) {
      clearTimeout(htmlTimeout)
      lastErr = `${att.tag}:${e?.name === 'AbortError' ? 'timeout' : (e?.message ?? 'fetch_error').slice(0, 40)}`
    }
  }
  if (!ok) {
    // Pinterest / Instagram bloccano spesso TUTTI i bot. Messaggio user-friendly.
    const host = target.hostname.replace(/^www\./, '')
    if (host.includes('pinterest.') || host.includes('instagram.')) {
      return json({
        error: `${host.split('.')[0]} blocca l'estrazione automatica. Salva l'immagine sul tuo device e caricala con il tasto Upload.`,
        detail: lastErr,
      }, 422)
    }
    return json({ error: `Pagina non raggiungibile: ${lastErr}` }, 502)
  }

  // Pickup standard og:image / twitter:image
  let image = pickMeta(html, 'og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src')
  const title = pickMeta(html, 'og:title', 'twitter:title') || ''
  const desc = pickMeta(html, 'og:description', 'description', 'twitter:description') || ''

  // Per Instagram preferisci sempre scontent.cdninstagram.com (foto post, size
  // grande) invece dello og:image lookaside che rimanda al login wall.
  if (isInstagram) {
    // Match generoso su scontent. Pattern conosciuti:
    //   t39.30808-6   = post content (carosello classico)
    //   t51.82787-15  = post content (variante recente)
    //   t51.71878-15  = video cover frame
    //   t51.2885-19   = AVATAR profilo (scartare!)
    //   t51.2885-15   = post mid-size
    const allRe = /https:\/\/scontent[^"\s]*\/v\/[^"\s]+\.(?:jpg|jpeg|png|webp)[^"\s]*/g
    const all = [...html.matchAll(allRe)].map((m) => m[0].replace(/&amp;/g, '&'))
    // Escludi avatar profilo (-19 finale dopo punto)
    const candidates = all.filter((u) => !/\/v\/t51\.\d+-19\//.test(u))
    if (candidates.length > 0) {
      // Per ogni "slide" del carosello, Instagram emette piu' size della stessa
      // foto. Raggruppiamo per FBID (l'identificatore inviato in querystring),
      // cosi possiamo distinguere "slide 1" da "slide 2" e scegliere la slide
      // giusta in base a img_index.
      const groups = new Map<string, string[]>()
      const order: string[] = []
      for (const url of candidates) {
        // Match _nc_ohc, fbid_=, oh=, oe= → usiamo il path base (senza query)
        // come chiave: scontent ruota i CDN ma il path di base e' stabile per
        // slide.
        const baseKey = url.split('?')[0]!.replace(/_n\.(jpg|jpeg|png|webp)$/, '_n')
        if (!groups.has(baseKey)) { groups.set(baseKey, []); order.push(baseKey) }
        groups.get(baseKey)!.push(url)
      }

      // Per ogni gruppo (slide), scegli la variante con risoluzione piu' alta.
      function pickBest(urls: string[]): string {
        const ranked = urls.map((url) => {
          const isSmall = /s150x150|s240x240|s320x320|s640x640/.test(url)
          const big1440 = url.includes('1440x1440') || url.includes('p1440x1440')
          const big1080 = url.includes('1080x1080') || url.includes('p1080x1080')
          const big750 = url.includes('p750x750') || url.includes('s750x750')
          const noSize = !/s\d+x\d+|p\d+x\d+/.test(url)
          let score = 0
          if (big1440) score += 100
          else if (big1080) score += 80
          else if (noSize) score += 70
          else if (big750) score += 40
          if (isSmall) score -= 50
          if (/\/v\/t39\.30808-6\//.test(url)) score += 30
          if (/\/v\/t51\.(82787|71878)-15\//.test(url)) score += 20
          score += url.length / 100
          return { url, score }
        }).sort((a, b) => b.score - a.score)
        return ranked[0]!.url
      }

      // Slides nell'ordine in cui appaiono nell'HTML embed (= ordine del carosello).
      const slides = order.map((key) => pickBest(groups.get(key)!))

      if (carouselIndex && slides.length > 1) {
        // Se l'utente ha chiesto img_index=N e ci sono almeno N slide, prendi la
        // N-esima. Altrimenti fallback alla prima.
        image = slides[Math.min(carouselIndex, slides.length) - 1] ?? slides[0]
      } else {
        image = slides[0]
      }
    }
    // Fallback secondario: EmbeddedMediaImage class
    if (!image) {
      const m1 = html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^"]+)"/i)
      if (m1 && m1[1]) image = m1[1].replace(/&amp;/g, '&')
    }
  }

  if (!image) {
    if (isInstagram) {
      return json({
        error: 'Instagram non permette di estrarre questa foto (probabilmente caroselli o post privato). Apri il post, fai screenshot o salva la foto, e usa il bottone "Carica file" qui sopra.',
      }, 422)
    }
    return json({ error: 'Nessuna immagine trovata nella pagina (manca og:image).' }, 422)
  }

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
      {
        tag: 'images-weserv',
        url: `https://images.weserv.nl/?url=${encodeURIComponent(image.replace(/^https?:\/\//, ''))}&output=jpg&q=85`,
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
        // Validazione content_type: deve essere image/*, no HTML (login wall).
        const ct = (ir.headers.get('content-type') ?? '').toLowerCase()
        if (!ct.startsWith('image/')) {
          imageFetchError = `${att.tag}:not_an_image_${ct.slice(0, 30)}`
          continue
        }
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
    carousel_index: carouselIndex,
  })
})
