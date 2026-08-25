// Proxy immagini con header CORS. Serve all'editor foto: le immagini di Google
// Drive (e alcune sorgenti) NON mandano header CORS, quindi il <canvas> del client
// non può leggerle per esportare il ritaglio (tainted canvas). Questo proxy scarica
// l'immagine server-side e la ri-serve con Access-Control-Allow-Origin: *.
// Anti-SSRF: SOLO host consentiti (Drive/googleusercontent/Supabase storage).
// Pubblica (verify_jwt=false in config.toml): è un semplice proxy read-only di immagini.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function allowedHost(h: string): boolean {
  return h === 'drive.google.com'
    || h === 'lh3.googleusercontent.com'
    || h.endsWith('.googleusercontent.com')
    || h.endsWith('.supabase.co')
    || h.endsWith('.supabase.in')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const raw = new URL(req.url).searchParams.get('url') ?? ''
  let target: URL
  try { target = new URL(raw) } catch { return new Response('bad url', { status: 400, headers: cors }) }
  if (target.protocol !== 'https:' || !allowedHost(target.hostname)) {
    return new Response('host not allowed', { status: 403, headers: cors })
  }
  try {
    const r = await fetch(target.toString(), { redirect: 'follow', headers: { 'User-Agent': 'Planfully-img-proxy' } })
    if (!r.ok) return new Response('fetch failed', { status: 502, headers: cors })
    const ct = r.headers.get('content-type') ?? 'image/jpeg'
    if (!ct.startsWith('image/')) return new Response('not an image', { status: 415, headers: cors })
    const buf = await r.arrayBuffer()
    return new Response(buf, { headers: { ...cors, 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' } })
  } catch (e) {
    return new Response('proxy error: ' + (e as Error).message, { status: 502, headers: cors })
  }
})
