// Genera sitemap.xml dinamico — include pagine statiche + tutti i blog post
// pubblicati + tutti i profili fornitore discoverable.
// Vercel rewrite: /sitemap.xml → questa edge function.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BASE = 'https://planfully.it'

const STATIC_PATHS = [
  { loc: '/',           changefreq: 'weekly',  priority: '1.0' },
  { loc: '/scopri',     changefreq: 'daily',   priority: '0.9' },
  { loc: '/blog',       changefreq: 'daily',   priority: '0.9' },
  { loc: '/login',      changefreq: 'monthly', priority: '0.5' },
  { loc: '/register',   changefreq: 'monthly', priority: '0.5' },
  { loc: '/privacy',    changefreq: 'yearly',  priority: '0.3' },
  { loc: '/cookie',     changefreq: 'yearly',  priority: '0.3' },
]

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Blog post pubblicati
  const { data: posts } = await admin
    .from('blog_posts')
    .select('slug, updated_at, published_at')
    .eq('status', 'PUBLISHED')
    .order('published_at', { ascending: false })
    .limit(2000)

  // Profili fornitore discoverable
  const { data: suppliers } = await admin
    .from('profiles')
    .select('slug, updated_at')
    .eq('role', 'FORNITORE')
    .eq('is_discoverable', true)
    .not('slug', 'is', null)
    .limit(2000)

  // Categorie blog (filtri pre-built per SEO)
  const { data: cats } = await admin
    .from('blog_categories')
    .select('slug')
    .limit(20)

  const now = new Date().toISOString()
  const urls: string[] = []

  for (const s of STATIC_PATHS) {
    urls.push(`  <url>
    <loc>${BASE}${s.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${s.changefreq}</changefreq>
    <priority>${s.priority}</priority>
  </url>`)
  }

  for (const c of (cats ?? [])) {
    urls.push(`  <url>
    <loc>${BASE}/blog?cat=${xmlEscape(c.slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
  }

  for (const p of (posts ?? [])) {
    urls.push(`  <url>
    <loc>${BASE}/blog/${xmlEscape(p.slug)}</loc>
    <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`)
  }

  for (const s of (suppliers ?? [])) {
    urls.push(`  <url>
    <loc>${BASE}/p/fornitore/${xmlEscape(s.slug)}</loc>
    <lastmod>${new Date(s.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  })
})
