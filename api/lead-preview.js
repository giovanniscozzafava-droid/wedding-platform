// OG dinamico per il LINK DEL FORM raccolta dati: quando si condivide
// planfully.it/embed/lead/:slug sui social (WhatsApp, Facebook, Instagram, …),
// l'anteprima mostra una FOTO DEL CATALOGO del fornitore + il suo nome.
// Per gli umani serve normalmente la SPA (il form): iniettiamo i meta nello shell
// index.html, che porta con sé gli script dell'app.
const SUPA = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
// anon key (pubblica, già presente nel bundle del frontend): basta per la RPC pubblica.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const esc = (s) => String(s ?? '').replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c]))

export default async function handler(req, res) {
  const slug = (req.query.slug || '').toString().replace(/[^a-zA-Z0-9-]/g, '')
  const origin = 'https://planfully.it'
  const formUrl = `${origin}/embed/lead/${slug}`

  let proName = ''
  let tagline = ''
  let image = `${origin}/og-image.png` // fallback generico Planfully (se esiste)
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/public_brand_kit`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    })
    if (r.ok) {
      const d = await r.json()
      proName = d?.business_name || d?.full_name || ''
      tagline = d?.tagline || ''
      if (Array.isArray(d?.photos) && d.photos[0]) image = d.photos[0]
    }
  } catch { /* fallback */ }

  // Shell della SPA (così gli umani ricevono il form normalmente).
  let shell = '<!doctype html><html lang="it"><head><meta charset="utf-8" /></head><body><div id="root"></div></body></html>'
  try {
    const host = (req.headers['x-forwarded-host'] || req.headers.host || 'planfully.it').toString()
    const r = await fetch(`https://${host}/index.html`)
    if (r.ok) shell = await r.text()
  } catch { /* fallback shell sopra */ }

  const title = proName ? `Richiedi un preventivo a ${proName}` : 'Richiedi un preventivo'
  const desc = tagline || (proName ? `Raccontaci il tuo evento: ${proName} ti ricontatterà con una proposta su misura.` : 'Raccontaci il tuo evento: ti ricontatteremo con una proposta su misura.')

  const head = [
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:url" content="${esc(formUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    `<title>${esc(title)}</title>`,
  ].join('\n    ')

  const html = shell
    .replace(/<meta property="og:[^"]*"[^>]*>/g, '')
    .replace(/<meta name="twitter:[^"]*"[^>]*>/g, '')
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('</head>', `    ${head}\n</head>`)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.status(200).send(html)
}
