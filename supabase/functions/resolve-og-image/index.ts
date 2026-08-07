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

// SEC / EF-2: guardia SSRF (come import-pin-url/link-preview) — blocca host interni/IP privati/metadata.
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
  if (bare === 'localhost' || bare.endsWith('.localhost') || bare.endsWith('.internal')) throw new Error('blocked host')
  if (/^[\d.]+$/.test(bare) || bare.includes(':')) { if (isPrivateIp(bare)) throw new Error('blocked private ip'); return }
  const v4 = await Deno.resolveDns(bare, 'A').catch(() => [] as string[])
  const v6 = await Deno.resolveDns(bare, 'AAAA').catch(() => [] as string[])
  const addrs = [...v4, ...v6]
  if (addrs.length === 0) throw new Error('dns no records')
  for (const a of addrs) if (isPrivateIp(a)) throw new Error('blocked private ip')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { url?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const url = (body.url ?? '').trim()
  if (!/^https?:\/\/.+/i.test(url)) return json({ error: 'invalid_url' }, 400)
  try { await assertPublicHost(url) } catch (e) { return json({ error: 'blocked_url', detail: String((e as Error)?.message ?? e) }, 400) }

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
    // Pinterest: spesso niente og:image; l'immagine vera è su i.pinimg.com (preferisci originals)
    if (!img) {
      const pin = html.match(/https:\/\/i\.pinimg\.com\/originals\/[a-z0-9/]+\.(?:jpg|png|webp)/i)
        || html.match(/https:\/\/i\.pinimg\.com\/736x\/[a-z0-9/]+\.(?:jpg|png|webp)/i)
      if (pin) img = pin[0]
    }
    if (img) img = img.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/')
    return json({ image_url: img || null, source_url: url })
  } catch (_e) {
    return json({ image_url: null, source_url: url, error: 'fetch_failed' })
  }
})
