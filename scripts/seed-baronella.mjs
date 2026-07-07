#!/usr/bin/env node
/**
 * Crea il profilo Planfully de "La Baronella" — LOCATION (capostipite).
 * Login: giovanni.scozzafava+baronella@gmail.com / Beta2026!
 *
 * Logo opzionale: passa LOGO_PATH=/percorso/logo.png per caricarlo su brand-assets
 * e settare profiles.brand_logo_url. Senza LOGO_PATH crea solo l'account.
 */
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'

// Segreti da env — NON hardcodare la service_role key nel repo.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-baronella.mjs
const URL = process.env.SUPABASE_URL || 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('Manca SUPABASE_SERVICE_ROLE_KEY (env).'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const EMAIL = 'giovanni.scozzafava+baronella@gmail.com'
const PWD = 'Beta2026!'
const LOGO_PATH = process.env.LOGO_PATH || null

async function ensureUser(email, password, metadata) {
  for (let page = 1; page < 15; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users?.length) break
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return { id: found.id, existed: true }
    if (data.users.length < 200) break
  }
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata })
  if (error) throw new Error(`create ${email}: ${error.message}`)
  return { id: data.user.id, existed: false }
}

async function main() {
  console.log('\n=== PROFILO LA BARONELLA (LOCATION / capostipite) ===\n')

  const u = await ensureUser(EMAIL, PWD, { role: 'LOCATION', full_name: 'La Baronella', subrole: 'location' })
  console.log('Account', u.existed ? 'gia\' esistente' : 'creato', `(${u.id})`)

  // logo opzionale
  let brand_logo_url
  if (LOGO_PATH) {
    const buf = await readFile(LOGO_PATH)
    const ext = (extname(LOGO_PATH) || '.png').toLowerCase()
    const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png'
    const path = `${u.id}/logo${ext === '.jpeg' ? '.jpg' : ext}`
    const up = await sb.storage.from('brand-assets').upload(path, buf, { upsert: true, contentType: mime })
    if (up.error) throw up.error
    brand_logo_url = sb.storage.from('brand-assets').getPublicUrl(path).data.publicUrl
    console.log('Logo caricato:', basename(LOGO_PATH), '->', brand_logo_url)
  }

  const patch = {
    role: 'LOCATION',
    full_name: 'La Baronella',
    business_name: 'La Baronella',
    subrole: 'location',
    country: 'Italia',
    onboarding_complete: true,
    is_discoverable: true,
    offers_full_dining: true,
    bio: 'La Baronella — location per matrimoni ed eventi.',
    work_style: 'Location con ristorazione interna. Accompagniamo gli sposi in ogni fase, dall\'allestimento al servizio a tavola.',
  }
  if (brand_logo_url) patch.brand_logo_url = brand_logo_url

  const { error } = await sb.from('profiles').update(patch).eq('id', u.id)
  if (error) throw error

  console.log('\nProfilo aggiornato: LOCATION "La Baronella", onboarding completo, ristorazione interna ON.')
  console.log('\nLogin -> ', EMAIL, '/', PWD)
  if (!LOGO_PATH) console.log('Logo: NON caricato (rilancia con LOGO_PATH=/percorso/logo.png).')
  console.log('')
}

main().catch((e) => { console.error('ERR', e); process.exit(1) })
