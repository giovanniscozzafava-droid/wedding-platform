// Edge function instagram-avatar:
// Dato un handle o un URL Instagram, prova a recuperare l'avatar pubblico
// del profilo leggendo i meta tag Open Graph (og:image) della pagina.
//
// POST { handle?: "@gisko.it", url?: "https://instagram.com/gisko.it" }
// → { ok, avatar_url, display_name?, username }
//
// NB: Instagram cambia spesso le contromisure anti-scraping. Lo scraping
// funziona sulla maggior parte dei profili PUBBLICI ma non è garantito.
// Per profili privati o con anti-bot attivo si ritorna ok=false e l'utente
// può comunque caricare il logo a mano.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\\u0026/g, '&').replace(/\\\//g, '/')
}

function extractMeta(html: string, prop: string): string | null {
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

/**
 * Estrae lo username da varie forme di input:
 *  - "@gisko.it"
 *  - "gisko.it"
 *  - "https://instagram.com/gisko.it/"
 *  - "https://www.instagram.com/gisko.it?utm=…"
 */
function normalizeHandle(input: string): string | null {
  let v = input.trim()
  if (!v) return null
  // se è un URL, estrai il path
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v)
      if (!u.hostname.toLowerCase().includes('instagram.com')) return null
      v = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || ''
    } catch { return null }
  }
  // rimuovi @
  v = v.replace(/^@/, '').trim()
  // accetta solo alfanumerico + . _
  if (!/^[A-Za-z0-9._]{1,30}$/.test(v)) return null
  return v.toLowerCase()
}

type IgProfileInfo = { avatar_url: string | null; display_name: string | null }

/** API privata web di Instagram — funziona meglio dell'HTML scraping. */
async function fetchViaWebProfileInfo(username: string): Promise<IgProfileInfo | null> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 8000)
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'accept': '*/*',
        'accept-language': 'it-IT,it;q=0.9,en;q=0.8',
        'x-ig-app-id': '936619743392459',
        'x-asbd-id': '129477',
        'x-requested-with': 'XMLHttpRequest',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'referer': `https://www.instagram.com/${encodeURIComponent(username)}/`,
      },
      signal: ac.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const u = data?.data?.user
    if (!u) return null
    return {
      avatar_url: (u.profile_pic_url_hd || u.profile_pic_url || null) as string | null,
      display_name: (u.full_name || null) as string | null,
    }
  } catch {
    return null
  }
}

/** Fallback: HTML pubblico, parse og:image/profile_pic_url. */
async function fetchViaHtml(username: string): Promise<IgProfileInfo | null> {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`
  const uas = [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  ]
  for (const ua of uas) {
    try {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 8000)
      const res = await fetch(url, {
        headers: {
          'user-agent': ua,
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'it-IT,it;q=0.9,en;q=0.8',
        },
        signal: ac.signal,
        redirect: 'follow',
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const html = await res.text()
      const avatar_url = extractAvatar(html)
      const display_name = extractDisplayName(html)
      if (avatar_url) return { avatar_url, display_name }
    } catch {
      continue
    }
  }
  return null
}

function extractAvatar(html: string): string | null {
  // 1) og:image dei meta
  const og = extractMeta(html, 'og:image')
  if (og && og.startsWith('http')) return og
  // 2) profile_pic_url_hd o profile_pic_url dal JSON embedded
  const hd = html.match(/"profile_pic_url_hd":"([^"]+)"/)
  if (hd && hd[1]) return decodeHtmlEntities(hd[1])
  const pp = html.match(/"profile_pic_url":"([^"]+)"/)
  if (pp && pp[1]) return decodeHtmlEntities(pp[1])
  return null
}

function extractDisplayName(html: string): string | null {
  const og = extractMeta(html, 'og:title')
  if (og) {
    // og:title tipico: "Nome Cognome (@handle) • Instagram photos and videos"
    const cleaned = og.replace(/\s*\(@[^)]+\)\s*/, '').replace(/\s*[•·]\s*Instagram.*/i, '').trim()
    if (cleaned) return cleaned
  }
  const fn = html.match(/"full_name":"([^"]+)"/)
  if (fn && fn[1]) return decodeHtmlEntities(fn[1])
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { handle?: string; url?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const raw = body.handle || body.url || ''
  const username = normalizeHandle(raw)
  if (!username) return json({ ok: false, error: 'invalid_handle' }, 400)

  // Strategia 1: API web profile info di Instagram (più affidabile)
  let info = await fetchViaWebProfileInfo(username)
  // Strategia 2 (fallback): scraping HTML og:meta
  if (!info?.avatar_url) info = await fetchViaHtml(username)

  if (!info?.avatar_url) {
    return json({ ok: false, username, error: 'no_avatar' })
  }

  return json({
    ok: true,
    username,
    avatar_url: info.avatar_url,
    display_name: info.display_name,
    profile_url: `https://www.instagram.com/${username}/`,
  })
})
