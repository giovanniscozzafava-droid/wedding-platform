#!/usr/bin/env node
/**
 * Seed foto reali Pexels su tutti i seed dati Wedding Platform.
 *
 *  - per ogni servizio cerca una keyword pertinente
 *  - prende fino a 3 foto, scarica + upload Storage + upsert service_photos
 *  - genera 6 avatar (1 per profilo) con keyword vicina al ruolo/subrole
 *  - genera 1 logo PREMIUM placeholder per Giulia
 *  - salva 4 hero immagini pagine pubbliche in public/hero/*.jpg per il login + /p
 *
 * Esegui una sola volta con: node scripts/seed-pexels.mjs
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PUBLIC_HERO = path.resolve(ROOT, 'frontend/public/hero')

const PEXELS_API_KEY = process.env.PEXELS_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!PEXELS_API_KEY) throw new Error('PEXELS_API_KEY missing in .env')
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing in .env')

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const SERVICE_QUERIES = {
  // Fioreria Bianchi
  '22220000-0004-0000-0000-000000000001': 'bridal bouquet white roses',
  '22220000-0004-0000-0000-000000000002': 'bohemian wildflower bouquet',
  '22220000-0004-0000-0000-000000000003': 'church wedding flower arrangement altar',
  '22220000-0004-0000-0000-000000000004': 'civil ceremony floral arch wedding',
  '22220000-0004-0000-0000-000000000005': 'wedding centerpiece round table',
  '22220000-0004-0000-0000-000000000006': 'long wedding centerpiece head table',
  '22220000-0004-0000-0000-000000000007': 'wedding venue entrance flowers',
  '22220000-0004-0000-0000-000000000008': 'wedding flower petals confetti',
  // Mario Foto
  '22220000-0005-0000-0000-000000000001': 'wedding photographer couple portrait',
  '22220000-0005-0000-0000-000000000002': 'luxury wedding photographer details',
  '22220000-0005-0000-0000-000000000003': 'wedding photo album fine art print',
  '22220000-0005-0000-0000-000000000004': 'wedding videographer cinematic',
  '22220000-0005-0000-0000-000000000005': 'wedding drone aerial venue',
  // Catering Sole
  '22220000-0006-0000-0000-000000000001': 'wedding banquet table elegant food',
  '22220000-0006-0000-0000-000000000002': 'gourmet wedding plated dish',
  '22220000-0006-0000-0000-000000000003': 'vegan wedding menu food plant',
  '22220000-0006-0000-0000-000000000004': 'wedding open bar cocktail bartender',
  '22220000-0006-0000-0000-000000000005': 'wedding mocktail juice bar',
  '22220000-0006-0000-0000-000000000006': 'wedding catering waiter service tray',
  // Villa Aurora
  '22220000-0003-0000-0000-000000000001': 'italian wedding venue villa interior',
  '22220000-0003-0000-0000-000000000002': 'wedding reception decor table candles',
  '22220000-0003-0000-0000-000000000003': 'wedding welcome aperitif garden',
  '22220000-0003-0000-0000-000000000004': 'wedding dinner gala chandelier',
}

const AVATAR_QUERIES = {
  '00000000-aaaa-0000-0000-000000000001': 'business portrait professional',
  '00000000-aaaa-0000-0000-000000000002': 'female wedding planner portrait',
  '00000000-aaaa-0000-0000-000000000003': 'italian villa estate manager',
  '00000000-aaaa-0000-0000-000000000004': 'florist studio woman portrait',
  '00000000-aaaa-0000-0000-000000000005': 'wedding photographer man portrait camera',
  '00000000-aaaa-0000-0000-000000000006': 'italian chef catering portrait',
}

const HERO_QUERIES = {
  'auth.jpg':    'italian wedding sunset countryside',
  'preview.jpg': 'wedding ceremony aisle florals romantic',
  'success.jpg': 'wedding couple celebration confetti',
  'reject.jpg':  'wedding venue empty rustic',
}

async function pexelsSearch(query, perPage = 3, orientation = 'landscape') {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`
  const r = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } })
  if (!r.ok) throw new Error(`Pexels ${r.status}: ${await r.text()}`)
  const j = await r.json()
  return j.photos ?? []
}

async function downloadBuffer(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`download ${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

async function uploadToBucket(bucket, key, data, contentType) {
  const { error } = await sb.storage.from(bucket).upload(key, data, { contentType, upsert: true })
  if (error) throw error
  const { data: pub } = sb.storage.from(bucket).getPublicUrl(key)
  return pub.publicUrl
}

let okCount = 0
let failCount = 0

async function seedServicePhotos() {
  console.log('\n──── Servizi (Pexels → bucket service-photos) ────')
  // Cancella foto seed precedenti (placeholder /seed-photos/*)
  await sb.from('service_photos').delete().like('original_url', '/seed-photos/%')

  for (const [serviceId, query] of Object.entries(SERVICE_QUERIES)) {
    try {
      const photos = await pexelsSearch(query, 2, 'landscape')
      if (photos.length === 0) { console.log(`  [SKIP] ${serviceId} no results`); continue }

      let order = 0
      for (const p of photos) {
        const originalUrl = p.src.large
        const thumbUrl = p.src.medium
        const photoId = crypto.randomUUID()
        const origKey = `${serviceId}/${photoId}.jpg`
        const thumbKey = `${serviceId}/thumb/${photoId}.jpg`

        const [origBuf, thumbBuf] = await Promise.all([
          downloadBuffer(originalUrl),
          downloadBuffer(thumbUrl),
        ])
        const origPub = await uploadToBucket('service-photos', origKey, origBuf, 'image/jpeg')
        const thumbPub = await uploadToBucket('service-photos', thumbKey, thumbBuf, 'image/jpeg')

        await sb.from('service_photos').insert({
          id: photoId,
          service_id: serviceId,
          original_url: origPub,
          thumbnail_url: thumbPub,
          sort_order: order++,
        })
      }
      console.log(`  ✓ ${serviceId.slice(-4)} "${query}" → ${photos.length} foto`)
      okCount++
    } catch (e) {
      console.log(`  ✗ ${serviceId} ${e.message}`)
      failCount++
    }
  }
}

async function seedAvatars() {
  console.log('\n──── Avatar profili (Pexels → bucket brand-assets) ────')
  for (const [userId, query] of Object.entries(AVATAR_QUERIES)) {
    try {
      const photos = await pexelsSearch(query, 1, 'square')
      const p = photos[0]
      if (!p) { console.log(`  [SKIP] ${userId} no results`); continue }
      const buf = await downloadBuffer(p.src.medium)
      const key = `${userId}/avatar.jpg`
      const pub = await uploadToBucket('brand-assets', key, buf, 'image/jpeg')
      // Mettiamo l'avatar come brand_logo_url solo per il WP (Giulia) come logo demo
      // Gli altri usano questo path nelle prossime UI feature
      console.log(`  ✓ ${userId.slice(-4)} → ${pub.slice(-40)}…`)
      okCount++
    } catch (e) {
      console.log(`  ✗ ${userId} ${e.message}`)
      failCount++
    }
  }
}

async function seedBrandLogo() {
  console.log('\n──── Logo PREMIUM Giulia ────')
  // Genero un SVG logo wordmark elegante
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1A2E4F"/><stop offset="1" stop-color="#3A5680"/>
    </linearGradient>
  </defs>
  <rect width="400" height="120" fill="white"/>
  <g transform="translate(28,30)">
    <circle cx="30" cy="30" r="28" fill="none" stroke="#D4AF37" stroke-width="2"/>
    <path d="M14 36 Q30 14 46 36" fill="none" stroke="#D4AF37" stroke-width="2" stroke-linecap="round"/>
    <circle cx="30" cy="22" r="3" fill="#D4AF37"/>
  </g>
  <text x="100" y="62" font-family="Georgia, serif" font-size="32" fill="url(#g)" font-weight="600">Giulia Rossi</text>
  <text x="100" y="86" font-family="Helvetica, sans-serif" font-size="12" letter-spacing="3" fill="#7A8294">WEDDING ATELIER</text>
</svg>`
  const key = '00000000-aaaa-0000-0000-000000000002/logo-giulia.svg'
  const pub = await uploadToBucket('brand-assets', key, new TextEncoder().encode(svg), 'image/svg+xml')
  await sb.from('profiles').update({ brand_logo_url: pub, brand_primary_color: '#1A2E4F', brand_secondary_color: '#D4AF37', subscription_tier: 'PREMIUM' }).eq('id', '00000000-aaaa-0000-0000-000000000002')
  console.log(`  ✓ Giulia Rossi logo + PREMIUM`)
  okCount++
}

async function seedHero() {
  console.log('\n──── Hero immagini statiche (frontend/public/hero/) ────')
  if (!existsSync(PUBLIC_HERO)) mkdirSync(PUBLIC_HERO, { recursive: true })
  for (const [filename, query] of Object.entries(HERO_QUERIES)) {
    try {
      const photos = await pexelsSearch(query, 1, 'landscape')
      const p = photos[0]
      if (!p) { console.log(`  [SKIP] ${filename}`); continue }
      const buf = await downloadBuffer(p.src.large2x ?? p.src.large)
      writeFileSync(path.join(PUBLIC_HERO, filename), buf)
      console.log(`  ✓ ${filename}  ${(buf.length / 1024).toFixed(0)} KB`)
      okCount++
    } catch (e) {
      console.log(`  ✗ ${filename} ${e.message}`)
      failCount++
    }
  }
}

console.log('🌺 Wedding Platform — Seed foto reali da Pexels')
console.log(`   Supabase: ${SUPABASE_URL}`)

await seedServicePhotos()
await seedAvatars()
await seedBrandLogo()
await seedHero()

console.log(`\n──── Risultato ────`)
console.log(`  ✓ ${okCount} batch OK · ✗ ${failCount} fail`)
console.log('  Ora ricarica il frontend (Cmd+Shift+R).')
