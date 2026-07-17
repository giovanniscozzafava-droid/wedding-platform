// OG dinamico per il link della GALLERIA SPOSI: quando si condivide planfully.it/g/:token
// (es. su WhatsApp), l'anteprima mostra una FOTO VERA della coppia + i loro nomi. Per gli umani
// serve normalmente la SPA (la galleria): iniettiamo i meta nello shell index.html.
const SUPA = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
// anon key (pubblica, già nel bundle del frontend): basta per la RPC pubblica gallery_get_by_token.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const esc = (s) => String(s ?? '').replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c]))
const isDrive = (id) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:') && !id.startsWith('album:')
// URL immagine per l'anteprima: Drive thumbnail pubblica (crawler-safe) o storage public URL.
const imgUrl = (m) => (isDrive(m?.drive_file_id) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1200` : (m?.thumbnail_link || ''))

export default async function handler(req, res) {
  const token = (req.query.token || '').toString().replace(/[^a-zA-Z0-9-]/g, '')
  const origin = 'https://planfully.it'
  const url = `${origin}/g/${token}`

  let couple = 'La vostra galleria'
  let studio = ''
  let image = `${origin}/hero/preview.jpg` // fallback: hero Planfully reale
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/gallery_get_by_token`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    })
    if (r.ok) {
      const d = await r.json()
      if (d && d.ok) {
        couple = d.gallery?.couple_label || d.gallery?.title || couple
        studio = d.photographer?.business_name || d.photographer?.full_name || ''
        const media = Array.isArray(d.media) ? d.media : []
        // hero: preferisci un ritratto di coppia, altrimenti la prima foto
        const hero = media.find((m) => m.album_moment === 'coppia' && m.media_type === 'PHOTO')
          || media.find((m) => m.media_type === 'PHOTO') || media[0]
        const u = imgUrl(hero)
        if (u) image = u
      }
    }
  } catch { /* fallback hero Planfully */ }

  // Shell della SPA (così gli umani ricevono la galleria normalmente).
  let shell = '<!doctype html><html lang="it"><head><meta charset="utf-8" /></head><body><div id="root"></div></body></html>'
  try {
    const host = (req.headers['x-forwarded-host'] || req.headers.host || 'planfully.it').toString()
    const r = await fetch(`https://${host}/index.html`)
    if (r.ok) shell = await r.text()
  } catch { /* fallback shell sopra */ }

  const title = couple
  const desc = studio
    ? `Le vostre foto del matrimonio, da ${studio}. Sfogliatele e scegliete quelle per l'album.`
    : `Le vostre foto del matrimonio. Sfogliatele e scegliete quelle per l'album.`

  const head = [
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
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
