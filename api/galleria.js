// OG dinamico per il link galleria ospiti: quando si condivide
// planfully.it/galleria/:id?t=… (es. su WhatsApp), l'anteprima del link mostra il
// QR DI QUEL MATRIMONIO come immagine. Per gli umani serve normalmente la SPA.
export default async function handler(req, res) {
  const id = (req.query.id || '').toString().replace(/[^a-zA-Z0-9-]/g, '')
  const t = (req.query.t || '').toString().replace(/[^a-zA-Z0-9]/g, '')
  const origin = 'https://planfully.it'
  const guestUrl = `${origin}/galleria/${id}${t ? `?t=${t}` : ''}`
  // QR del link (immagine di anteprima). Endpoint pubblico, nessuna dipendenza.
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=16&data=${encodeURIComponent(guestUrl)}`

  let shell = '<!doctype html><html lang="it"><head><meta charset="utf-8" /></head><body><div id="root"></div></body></html>'
  try {
    const host = (req.headers['x-forwarded-host'] || req.headers.host || 'planfully.it').toString()
    const r = await fetch(`https://${host}/index.html`)
    if (r.ok) shell = await r.text()
  } catch { /* fallback shell sopra */ }

  const title = 'Foto e video del matrimonio'
  const desc = 'Inquadra il QR o apri il link: vedi e carichi le foto e i video di questo matrimonio.'
  const head = [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:image" content="${qr}" />`,
    `<meta property="og:image:width" content="600" />`,
    `<meta property="og:image:height" content="600" />`,
    `<meta property="og:url" content="${guestUrl}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${qr}" />`,
    `<title>${title}</title>`,
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
