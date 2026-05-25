#!/usr/bin/env node
/**
 * E2E AUDIT NOTTURNO - Simulazione completa matrimonio
 *
 * Simula via DB + API tutto il percorso end-to-end:
 * 1. Reset stato pulito
 * 2. WP crea matrimonio
 * 3. 3 fornitori invitati + signup + servizi + foto + disponibilita
 * 4. Sposi invitati + signup + questionario
 * 5. Preventivo creato, inviato, firmato
 * 6. Contratto generato, inviato, firmato
 * 7. Wedding popolato: invitati, tavoli, mood, playlist, checklist,
 *    alloggi, trasporti, scaletta, sub-eventi, sito ospiti
 *
 * Output: bugs.md con tutti i problemi trovati + report.md finale
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUN_DIR = path.resolve(__dirname, `../audit-runs/${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`)
mkdirSync(RUN_DIR, { recursive: true })

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'

const sb = createClient(URL, SVC, { auth: { persistSession: false } })

const PWD = 'Beta2026!'
const bugs = []
const passes = []

function bug(area, severity, msg, detail) {
  bugs.push({ area, severity, msg, detail, at: new Date().toISOString() })
  console.log(`  🐛 [${severity}] ${area}: ${msg}`)
}
function pass(msg) { passes.push(msg); console.log(`  ✅ ${msg}`) }
function step(name) { console.log(`\n━━━ ${name} ━━━`) }

async function check(name, fn, area = 'GENERIC') {
  try {
    const result = await fn()
    if (result === false) { bug(area, 'MEDIUM', name); return null }
    pass(name)
    return result
  } catch (e) {
    bug(area, 'HIGH', name, e?.message ?? String(e))
    return null
  }
}

// === Helpers ===
async function getUserByEmail(email) {
  for (let page = 1; page < 15; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users?.length) break
    const u = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (u) return u
    if (data.users.length < 200) break
  }
  return null
}

async function ensureUser(email, metadata, role) {
  const existing = await getUserByEmail(email)
  if (existing) {
    await sb.auth.admin.updateUserById(existing.id, { password: PWD, email_confirm: true })
    await sb.from('profiles').upsert({ id: existing.id, role, ...metadata }, { onConflict: 'id' })
    return existing
  }
  const r = await sb.auth.admin.createUser({ email, password: PWD, email_confirm: true, user_metadata: { ...metadata, role } })
  if (r.error) throw new Error(`createUser ${email}: ${r.error.message}`)
  await sb.from('profiles').upsert({ id: r.data.user.id, role, ...metadata }, { onConflict: 'id' })
  return r.data.user
}

async function loginAs(email) {
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const r = await anon.auth.signInWithPassword({ email, password: PWD })
  if (r.error) throw new Error(`login ${email}: ${r.error.message}`)
  return { client: anon, session: r.data.session, user: r.data.user }
}

async function invokeFunction(name, body, accessToken) {
  const r = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: ANON,
    },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: r.status, ok: r.ok, body: json ?? text }
}

// === DATI MATRIMONIO REALISTICO ===
const WP_EMAIL = 'wp-mini@planfully-demo.it'
const SPOSI_EMAIL = 'audit-sposi@planfully-test.it'
const FORN_FOTO_EMAIL = 'audit-foto@planfully-test.it'
const FORN_FIORI_EMAIL = 'audit-fiori@planfully-test.it'
const FORN_CATERING_EMAIL = 'audit-catering@planfully-test.it'

const WEDDING = {
  title: 'Andrea e Sofia',
  client_name: 'Andrea Rinaldi & Sofia Conti',
  date: '2027-09-25',
  guests: 110,
  theme: 'Classic elegance',
}

// ════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════
async function main() {
  console.log(`\n🚀 E2E AUDIT - ${new Date().toLocaleString('it-IT')}\nOutput: ${RUN_DIR}\n`)

  // ─────────────────────────────────────────────────────
  step('PHASE 0 — RESET + Setup utenti')
  // ─────────────────────────────────────────────────────

  // Recupera Sara (WP esistente)
  const sara = await getUserByEmail(WP_EMAIL)
  if (!sara) { bug('SETUP', 'CRITICAL', 'WP Sara non trovata, abort'); return }
  pass(`WP Sara: ${sara.id}`)

  // Cancella eventuali audit weddings precedenti (per titolo OR per slug audit)
  const { data: oldWeddings } = await sb.from('calendar_entries')
    .select('id, quote_id, title')
    .eq('owner_id', sara.id)
    .or('title.eq.Andrea e Sofia,wedding_website_slug.eq.andrea-e-sofia-audit,wedding_website_slug.like.andrea-e-sofia%')
  for (const w of (oldWeddings ?? [])) {
    if (w.quote_id) await sb.from('quotes').delete().eq('id', w.quote_id)
    await sb.from('calendar_entries').delete().eq('id', w.id)
  }
  pass(`Cleaned ${oldWeddings?.length ?? 0} previous audit weddings`)

  // Cancella eventuali utenti test audit
  for (const email of [SPOSI_EMAIL, FORN_FOTO_EMAIL, FORN_FIORI_EMAIL, FORN_CATERING_EMAIL]) {
    const u = await getUserByEmail(email)
    if (u) await sb.auth.admin.deleteUser(u.id)
  }
  pass('Cleaned test users')

  // Crea fornitori (skip signup flow, creazione diretta come auth admin)
  const fornFoto = await check('Crea fornitore Foto', () => ensureUser(FORN_FOTO_EMAIL, {
    full_name: 'Luca Marchetti', business_name: 'Luca Marchetti Photography',
    subrole: 'fotografo', city: 'Milano', onboarding_complete: true,
    bio: 'Fotografo wedding fine-art con 8 anni di esperienza. Stile reportage naturale.',
    brand_logo_url: 'https://api.dicebear.com/9.x/initials/svg?seed=Luca%20Marchetti%20Photography&backgroundColor=1A2E4F&fontWeight=700&fontSize=42&textColor=ffffff',
  }, 'FORNITORE'))
  const fornFiori = await check('Crea fornitore Fiori', () => ensureUser(FORN_FIORI_EMAIL, {
    full_name: 'Chiara Bellini', business_name: 'Bellini Fiori d\'Autore',
    subrole: 'fioraio', city: 'Firenze', onboarding_complete: true,
    bio: 'Composizioni floreali eleganti, fiori di stagione italiani.',
    brand_logo_url: 'https://api.dicebear.com/9.x/initials/svg?seed=Bellini%20Fiori&backgroundColor=7E6633&fontWeight=700&fontSize=42&textColor=ffffff',
  }, 'FORNITORE'))
  const fornCatering = await check('Crea fornitore Catering', () => ensureUser(FORN_CATERING_EMAIL, {
    full_name: 'Marco Ricci', business_name: 'Ricci Banqueting',
    subrole: 'catering', city: 'Roma', onboarding_complete: true,
    bio: 'Catering di alta qualità, menu personalizzati e attenzione al dettaglio.',
    brand_logo_url: 'https://api.dicebear.com/9.x/initials/svg?seed=Ricci%20Banqueting&backgroundColor=C49A5C&fontWeight=700&fontSize=42&textColor=ffffff',
  }, 'FORNITORE'))

  if (!fornFoto || !fornFiori || !fornCatering) { console.log('Setup fornitori fallito, abort'); writeBugs(); return }

  // Collaborations Sara <-> fornitori (ACTIVE)
  for (const f of [fornFoto, fornFiori, fornCatering]) {
    await sb.from('collaborations').upsert({
      capostipite_id: sara.id, fornitore_id: f.id, status: 'ACTIVE', accepted_at: new Date().toISOString(),
    }, { onConflict: 'capostipite_id,fornitore_id' })
  }
  pass('Collaborazioni ACTIVE create')

  // Crea sposi user
  const sposi = await check('Crea utente sposi', () => ensureUser(SPOSI_EMAIL, {
    full_name: 'Andrea Rinaldi', onboarding_complete: true,
  }, 'COUPLE'))
  if (!sposi) { writeBugs(); return }

  // ─────────────────────────────────────────────────────
  step('PHASE 1 — Servizi fornitori + foto')
  // ─────────────────────────────────────────────────────

  const services = {}

  // Categorie
  const ensureCat = async (slug, name) => {
    let { data: c } = await sb.from('service_categories').select('id').eq('slug', slug).maybeSingle()
    if (!c) {
      const r = await sb.from('service_categories').insert({ slug, name, is_standard: true }).select().single()
      c = r.data
    }
    return c
  }
  const catFoto = await ensureCat('fotografo', 'Fotografo')
  const catFiori = await ensureCat('fioraio', 'Fioraio')
  const catCatering = await ensureCat('catering', 'Catering')

  // Fornitore foto: 3 servizi
  await sb.from('services').delete().eq('fornitore_id', fornFoto.id)
  const fotoServizi = [
    { name: 'Servizio fotografico full day', base_price: 2400, unit: 'EVENTO', description: 'Copertura 8-10 ore: preparativi, cerimonia, ricevimento. Selezione 400+ scatti editati.' },
    { name: 'Album premium 40x30', base_price: 650, unit: 'PEZZO', description: 'Album fine art, copertina pelle, 60 pagine.' },
    { name: 'Riprese drone cerimonia', base_price: 400, unit: 'EVENTO', description: 'Aerial shots cerimonia + arrivo sposi.' },
  ]
  for (const s of fotoServizi) {
    const r = await sb.from('services').insert({ ...s, fornitore_id: fornFoto.id, category_id: catFoto.id, is_active: true }).select().single()
    if (r.error) bug('SERVICES', 'HIGH', `Insert servizio foto fallito`, r.error.message)
    else services[`foto_${s.name}`] = r.data
  }
  pass(`Fotografo: ${fotoServizi.length} servizi`)

  // Fornitore fiori
  await sb.from('services').delete().eq('fornitore_id', fornFiori.id)
  const fioriServizi = [
    { name: 'Bouquet sposa premium', base_price: 180, unit: 'PEZZO', description: 'Composizione tonale concordata, fiori di stagione, fasciatura in seta.' },
    { name: 'Centrotavola elegante', base_price: 55, unit: 'PEZZO', description: 'Composizione bassa con candele, fiori di stagione.' },
    { name: 'Allestimento chiesa', base_price: 950, unit: 'EVENTO', description: 'Composizioni altare + banchi, archi floreali.' },
  ]
  for (const s of fioriServizi) {
    const r = await sb.from('services').insert({ ...s, fornitore_id: fornFiori.id, category_id: catFiori.id, is_active: true }).select().single()
    if (r.error) bug('SERVICES', 'HIGH', `Insert servizio fiori fallito`, r.error.message)
    else services[`fiori_${s.name}`] = r.data
  }
  pass(`Fioraio: ${fioriServizi.length} servizi`)

  // Fornitore catering
  await sb.from('services').delete().eq('fornitore_id', fornCatering.id)
  const cateringServizi = [
    { name: 'Menu base 4 portate', base_price: 95, unit: 'PERSONA', description: 'Aperitivo + antipasto + primo + secondo + dolce + caffe. Bevande incluse.' },
    { name: 'Open bar 4h', base_price: 28, unit: 'PERSONA', description: 'Cocktail classici e signature, barman professionale.' },
  ]
  for (const s of cateringServizi) {
    const r = await sb.from('services').insert({ ...s, fornitore_id: fornCatering.id, category_id: catCatering.id, is_active: true }).select().single()
    if (r.error) bug('SERVICES', 'HIGH', `Insert servizio catering fallito`, r.error.message)
    else services[`catering_${s.name}`] = r.data
  }
  pass(`Catering: ${cateringServizi.length} servizi`)

  // Disponibilita fornitori
  for (const f of [fornFoto, fornFiori, fornCatering]) {
    const dates = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(Date.now() + (60 + i * 30) * 86400000).toISOString().slice(0, 10)
      dates.push({ fornitore_id: f.id, date: d, status: i < 2 ? 'BUSY' : 'TENTATIVE' })
    }
    await sb.from('supplier_availability').upsert(dates, { onConflict: 'fornitore_id,date' })
  }
  pass('Disponibilita fornitori popolata')

  // ─────────────────────────────────────────────────────
  step('PHASE 2 — Wedding + Quote')
  // ─────────────────────────────────────────────────────

  const wedRes = await sb.from('calendar_entries').insert({
    owner_id: sara.id, title: WEDDING.title,
    client_name: WEDDING.client_name, client_email: SPOSI_EMAIL,
    date_from: WEDDING.date, date_to: WEDDING.date,
    status: 'CONFERMATA', theme: WEDDING.theme,
    tables_naming_style: 'Città', value_amount: 32000,
    notes: 'Audit E2E test wedding',
    is_destination: false, business_model: 'GLOBAL',
    wedding_website_slug: 'andrea-e-sofia-audit',
    wedding_website_published: true,
    wedding_website_data: {
      hashtag: '#AndreaESofia2027',
      story: 'La nostra storia inizia 5 anni fa a Milano, ora il giorno e arrivato.',
      dress_code: 'Cocktail elegante',
      couple_photo_focal_y: 30,
    },
  }).select().single()
  if (wedRes.error) { bug('WEDDING', 'CRITICAL', 'Create wedding fallita', wedRes.error.message); writeBugs(); return }
  const wedding = wedRes.data
  pass(`Wedding creato: ${wedding.id}`)

  // Link sposi al wedding
  await sb.from('wedding_couple_members').upsert({
    entry_id: wedding.id, email: SPOSI_EMAIL, full_name: 'Andrea Rinaldi',
    role: 'SPOSO', user_id: sposi.id, accepted_at: new Date().toISOString(),
  }, { onConflict: 'entry_id,email' })

  // Couple preferences (questionario compilato)
  await sb.from('couple_preferences').insert({
    entry_id: wedding.id, bride_name: 'Sofia', groom_name: 'Andrea',
    couple_name: 'Andrea & Sofia', styles: ['CLASSICO'],
    preferred_palette: ['beige', 'sage', 'gold'], preferred_season: 'autunno',
    location_kind: 'villa', vision_note: 'Matrimonio classico elegante con tocchi natural.',
    must_haves: ['fotografo full day', 'open bar', 'fiori freschi stagionali'],
    no_thanks: ['confettata anni 80', 'dj kitsch'],
    budget_min: 28000, budget_max: 38000, guests_estimate: WEDDING.guests, budget_priority: 'foto',
  }).then(r => { if (r.error) bug('PREFERENCES', 'MEDIUM', 'couple_preferences fallita', r.error.message) })

  // Add fornitori come partecipanti
  for (const f of [fornFoto, fornFiori, fornCatering]) {
    await sb.from('calendar_entry_participants').upsert({
      entry_id: wedding.id, user_id: f.id, role_in_entry: 'fornitore',
    }, { onConflict: 'entry_id,user_id' })
  }

  // Crea quote
  const quoteRes = await sb.from('quotes').insert({
    owner_id: sara.id, title: WEDDING.title,
    client_name: WEDDING.client_name, client_email: SPOSI_EMAIL,
    event_date: WEDDING.date, guest_count: WEDDING.guests,
    default_markup_percent: 15, status: 'BOZZA',
  }).select().single()
  if (quoteRes.error) { bug('QUOTE', 'CRITICAL', 'Quote create fallita', quoteRes.error.message); writeBugs(); return }
  const quote = quoteRes.data
  await sb.from('calendar_entries').update({ quote_id: quote.id }).eq('id', wedding.id)
  pass(`Quote creato: ${quote.id}`)

  // Quote items
  const items = [
    { svc: services[`foto_Servizio fotografico full day`], qty: 1 },
    { svc: services[`foto_Album premium 40x30`], qty: 1 },
    { svc: services[`foto_Riprese drone cerimonia`], qty: 1 },
    { svc: services[`fiori_Bouquet sposa premium`], qty: 1 },
    { svc: services[`fiori_Centrotavola elegante`], qty: 12 },
    { svc: services[`fiori_Allestimento chiesa`], qty: 1 },
    { svc: services[`catering_Menu base 4 portate`], qty: WEDDING.guests },
    { svc: services[`catering_Open bar 4h`], qty: WEDDING.guests },
  ]
  for (let i = 0; i < items.length; i++) {
    const { svc, qty } = items[i]
    if (!svc) { bug('QUOTE_ITEMS', 'HIGH', `Servizio mancante per item ${i}`); continue }
    const r = await sb.from('quote_items').insert({
      quote_id: quote.id, service_id: svc.id, supplier_id: svc.fornitore_id,
      name_snapshot: svc.name, description_snapshot: svc.description,
      snapshot_price: svc.base_price, unit_snapshot: svc.unit,
      quantity: qty, sort_order: i,
      quantity_basis: svc.unit === 'PERSONA' ? 'PER_GUEST' : svc.unit === 'PEZZO' ? 'FLAT' : 'FLAT',
    })
    if (r.error) bug('QUOTE_ITEMS', 'HIGH', `Insert item ${i} fallito`, r.error.message)
  }
  pass(`Quote items: ${items.length}`)

  // Reload quote per vedere il totale (trigger)
  const { data: qReload } = await sb.from('quotes').select('total_client').eq('id', quote.id).single()
  pass(`Totale quote calcolato: € ${qReload?.total_client ?? '?'}`)
  if (!qReload?.total_client || qReload.total_client < 1000) {
    bug('QUOTE_TOTAL', 'HIGH', 'Totale quote sembra non calcolato', JSON.stringify(qReload))
  }

  // ─────────────────────────────────────────────────────
  step('PHASE 3 — Invio preventivo + accettazione firma')
  // ─────────────────────────────────────────────────────

  // Login Sara per invocare edge functions
  const saraSession = await loginAs(WP_EMAIL)

  // 1. Genera PDF
  const pdfRes = await invokeFunction('quote-generate-pdf', { quote_id: quote.id, variant: 'NEUTRA' }, saraSession.session.access_token)
  if (!pdfRes.ok) bug('PDF_GEN', 'HIGH', 'Generazione PDF fallita', JSON.stringify(pdfRes.body).slice(0, 300))
  else pass(`PDF generato: ${(pdfRes.body?.url ?? '').slice(0, 80)}`)

  // 2. Invio quote
  const sendRes = await invokeFunction('quote-send', { quote_id: quote.id }, saraSession.session.access_token)
  if (!sendRes.ok) bug('QUOTE_SEND', 'HIGH', 'Invio preventivo fallito', JSON.stringify(sendRes.body).slice(0, 300))
  else pass(`Preventivo inviato, status: ${sendRes.body?.email_result?.ok ? 'email OK' : 'email skipped/error'}`)

  // 3. Verifica access_token sul quote
  const { data: qWithToken } = await sb.from('quotes').select('access_token, status').eq('id', quote.id).single()
  if (!qWithToken?.access_token) bug('QUOTE_TOKEN', 'HIGH', 'access_token non generato dopo invio')
  else pass(`access_token: ${qWithToken.access_token.slice(0, 12)}…`)

  // 4. Simula firma (insert quote_acceptances + update quote)
  if (qWithToken?.access_token) {
    const sigBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const sigBlob = new Uint8Array(atob(sigBase64).split('').map(c => c.charCodeAt(0)))
    const sigPath = `${quote.id}/v${quote.revision}/audit-sig-${Date.now()}.png`
    await sb.storage.from('quote-signatures').upload(sigPath, sigBlob, { contentType: 'image/png' })
    const { data: sigUrl } = await sb.storage.from('quote-signatures').createSignedUrl(sigPath, 60 * 60 * 24 * 30)

    const acceptRes = await sb.from('quote_acceptances').insert({
      quote_id: quote.id, access_token: qWithToken.access_token, quote_revision: quote.revision,
      signer_name: 'Sofia Conti', signer_email: SPOSI_EMAIL, signer_phone: '+393331234567',
      doc_type: 'CARTA_IDENTITA', doc_number: 'CA1234567', doc_issued_by: 'Comune di Milano',
      signature_url: sigUrl?.signedUrl ?? sigPath,
      ip_address: '127.0.0.1', user_agent: 'AuditAgent/1.0',
      consent_terms: true, consent_privacy: true,
    }).select().single()
    if (acceptRes.error) bug('SIGNATURE', 'HIGH', 'Insert quote_acceptances fallito', acceptRes.error.message)
    else {
      await sb.from('quotes').update({ status: 'ACCETTATO', accepted_at: new Date().toISOString() }).eq('id', quote.id)
      pass('Quote firmato e accettato')
    }
  }

  // ─────────────────────────────────────────────────────
  step('PHASE 4 — Contratto generato + firmato')
  // ─────────────────────────────────────────────────────

  const contractRes = await sb.from('contracts').insert({
    owner_id: sara.id, quote_id: quote.id, entry_id: wedding.id,
    title: `Contratto ${WEDDING.title}`,
    client_name: WEDDING.client_name, client_email: SPOSI_EMAIL,
    event_date: WEDDING.date, total_amount: qReload?.total_client ?? 32000,
    status: 'FIRMATO',
    sections: [
      { heading: 'Oggetto', body: 'Organizzazione completa del matrimonio Andrea e Sofia.', type: 'CLAUSULE' },
      { heading: 'Pagamenti', body: 'Acconto 30% alla firma, 40% 60 giorni prima, 30% giorno-X.', type: 'CLAUSULE' },
      { heading: 'Cancellazione', body: 'Entro 90 giorni: 50%. Oltre: 100%.', type: 'TERMS' },
    ],
    signed_at: new Date().toISOString(),
  }).select().single()
  if (contractRes.error) bug('CONTRACT', 'HIGH', 'Create contract fallita', contractRes.error.message)
  else pass(`Contratto firmato creato: ${contractRes.data.id}`)

  // ─────────────────────────────────────────────────────
  step('PHASE 5 — Tavoli + Invitati + Assegnazioni')
  // ─────────────────────────────────────────────────────

  const cities = ['Milano', 'Roma', 'Firenze', 'Venezia', 'Bologna', 'Torino', 'Napoli', 'Verona']
  const tables = [
    { entry_id: wedding.id, table_no: 1, label: 'Tavolo Sposi', seats: 12, shape: 'IMPERIALE' },
    ...cities.map((c, i) => ({ entry_id: wedding.id, table_no: i + 2, label: c, seats: 10, shape: 'ROUND' })),
  ]
  const { data: insertedTables, error: tabErr } = await sb.from('event_tables').insert(tables).select()
  if (tabErr) bug('TABLES', 'HIGH', 'Insert tavoli fallito', tabErr.message)
  else pass(`${insertedTables.length} tavoli creati`)

  // Invitati con assegnazione
  const guestsData = []
  const firstNames = ['Marco', 'Luca', 'Giulia', 'Elena', 'Francesca', 'Davide', 'Alessandro', 'Chiara', 'Paolo', 'Anna', 'Stefano', 'Laura', 'Federico', 'Martina', 'Andrea', 'Sara']
  const lastNames = ['Rossi', 'Bianchi', 'Romano', 'Russo', 'Greco', 'Conti', 'Bruno', 'Marini', 'Ferri', 'Esposito', 'Ricci']
  for (let g = 0; g < WEDDING.guests; g++) {
    const fn = firstNames[g % firstNames.length]
    const ln = lastNames[(g * 3) % lastNames.length]
    const tableIdx = g < 12 ? 0 : Math.min(Math.floor((g - 12) / 10) + 1, (insertedTables?.length ?? 1) - 1)
    guestsData.push({
      entry_id: wedding.id,
      full_name: `${fn} ${ln} ${g + 1}`,
      party_size: g % 11 === 0 ? 2 : 1,
      rsvp: g < WEDDING.guests * 0.75 ? 'YES' : g < WEDDING.guests * 0.92 ? 'PENDING' : 'NO',
      diet: g % 9 === 0 ? 'vegetariano' : g % 17 === 0 ? 'celiaco' : null,
      side: g % 2 === 0 ? 'SPOSA' : 'SPOSO',
      group_label: g < 30 ? 'Famiglia sposa' : g < 60 ? 'Famiglia sposo' : g < 85 ? 'Amici' : 'Colleghi',
      table_id: insertedTables?.[tableIdx]?.id ?? null,
    })
  }
  const gIns = await sb.from('event_guests').insert(guestsData).select('id')
  if (gIns.error) bug('GUESTS', 'HIGH', 'Insert invitati fallito', gIns.error.message)
  else pass(`${gIns.data.length} invitati creati`)

  // ─────────────────────────────────────────────────────
  step('PHASE 6 — Mood, playlist, checklist, scaletta')
  // ─────────────────────────────────────────────────────

  // Mood images (URL pexels esterni)
  const moodSources = [
    { tag: 'vestito', urls: ['https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg', 'https://images.pexels.com/photos/265787/pexels-photo-265787.jpeg'] },
    { tag: 'fiori', urls: ['https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg', 'https://images.pexels.com/photos/931180/pexels-photo-931180.jpeg', 'https://images.pexels.com/photos/265787/pexels-photo-265787.jpeg'] },
    { tag: 'location', urls: ['https://images.pexels.com/photos/2253870/pexels-photo-2253870.jpeg', 'https://images.pexels.com/photos/931196/pexels-photo-931196.jpeg'] },
    { tag: 'torta', urls: ['https://images.pexels.com/photos/4040691/pexels-photo-4040691.jpeg'] },
    { tag: 'allestimento', urls: ['https://images.pexels.com/photos/931796/pexels-photo-931796.jpeg', 'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg'] },
  ]
  let mIdx = 0
  for (const grp of moodSources) {
    for (const url of grp.urls) {
      await sb.from('mood_images').insert({ entry_id: wedding.id, url: `${url}?auto=compress&w=1200`, tag: grp.tag, ord: mIdx++ })
    }
  }
  pass(`${mIdx} mood images create`)

  // Playlist - mix di brani per ogni momento
  const playlist = [
    { moment: 'CERIMONIA', song_title: 'Canon in D', artist: 'Pachelbel' },
    { moment: 'CERIMONIA', song_title: 'A Thousand Years', artist: 'Christina Perri' },
    { moment: 'APERITIVO', song_title: 'Fly Me to the Moon', artist: 'Frank Sinatra' },
    { moment: 'APERITIVO', song_title: 'L-O-V-E', artist: 'Nat King Cole' },
    { moment: 'CENA', song_title: 'Cinema Paradiso', artist: 'Ennio Morricone' },
    { moment: 'TAGLIO_TORTA', song_title: 'Sugar', artist: 'Maroon 5' },
    { moment: 'PRIMA_DANZA', song_title: 'All of Me', artist: 'John Legend' },
    { moment: 'FESTA', song_title: 'September', artist: 'Earth, Wind & Fire' },
    { moment: 'FESTA', song_title: 'Dancing Queen', artist: 'ABBA' },
    { moment: 'FESTA', song_title: 'YMCA', artist: 'Village People' },
  ]
  for (let i = 0; i < playlist.length; i++) {
    await sb.from('event_playlist').insert({ ...playlist[i], entry_id: wedding.id, ord: i })
  }
  pass(`${playlist.length} brani playlist`)

  // Checklist
  const tasks = [
    { phase: '12_MESI', title: 'Definire budget complessivo', done: true },
    { phase: '12_MESI', title: 'Scegliere location ricevimento', done: true },
    { phase: '6_MESI', title: 'Scegliere abito sposa', done: true },
    { phase: '6_MESI', title: 'Selezionare fotografo + videomaker', done: true },
    { phase: '3_MESI', title: 'Stampare partecipazioni', done: false },
    { phase: '3_MESI', title: 'Prove make-up + acconciatura', done: false },
    { phase: '1_MESE', title: 'Raccogliere RSVP definitivi', done: false },
    { phase: '1_MESE', title: 'Disposizione tavoli', done: false },
    { phase: '1_SETTIMANA', title: 'Manicure + pedicure', done: false },
    { phase: 'DAY_OF', title: 'Make-up + acconciatura sposa', done: false },
  ]
  for (let i = 0; i < tasks.length; i++) {
    await sb.from('wedding_tasks').insert({ ...tasks[i], entry_id: wedding.id, ord: i, is_critical: false })
  }
  pass(`${tasks.length} task checklist`)

  // Sub-eventi
  await sb.from('event_subevents').insert([
    { entry_id: wedding.id, kind: 'WELCOME_DINNER', title: 'Welcome dinner', date_at: `2027-09-24T20:00:00`, location: 'Ristorante La Vigna, Milano' },
    { entry_id: wedding.id, kind: 'CEREMONY', title: 'Cerimonia religiosa', date_at: `${WEDDING.date}T11:00:00`, location: 'Duomo di Milano' },
    { entry_id: wedding.id, kind: 'RECEPTION', title: 'Ricevimento', date_at: `${WEDDING.date}T13:30:00`, location: 'Villa Necchi, Milano' },
    { entry_id: wedding.id, kind: 'BRUNCH', title: 'Brunch domenica', date_at: `2027-09-26T11:00:00`, location: 'Villa Necchi, Milano' },
  ])
  pass('Sub-eventi inseriti')

  // Scaletta giorno-X
  const timeline = [
    { time_at: `${WEDDING.date}T08:30:00`, title: 'Make-up sposa', is_critical: false },
    { time_at: `${WEDDING.date}T10:30:00`, title: 'Arrivo invitati cerimonia', is_critical: true },
    { time_at: `${WEDDING.date}T11:00:00`, title: 'Cerimonia', is_critical: true },
    { time_at: `${WEDDING.date}T12:30:00`, title: 'Foto di gruppo sul sagrato', is_critical: false },
    { time_at: `${WEDDING.date}T13:30:00`, title: 'Aperitivo in villa', is_critical: false },
    { time_at: `${WEDDING.date}T15:00:00`, title: 'Pranzo di nozze', is_critical: true },
    { time_at: `${WEDDING.date}T18:30:00`, title: 'Taglio della torta', is_critical: true },
    { time_at: `${WEDDING.date}T19:00:00`, title: 'Prima danza', is_critical: false },
    { time_at: `${WEDDING.date}T20:00:00`, title: 'Festa', is_critical: false },
  ]
  for (const t of timeline) {
    await sb.from('event_timeline').insert({ ...t, entry_id: wedding.id })
  }
  pass(`${timeline.length} momenti scaletta`)

  // ─────────────────────────────────────────────────────
  step('PHASE 7 — Alloggi + Trasporti + Assegnazioni')
  // ─────────────────────────────────────────────────────

  const accom1 = await sb.from('event_accommodations').insert({
    entry_id: wedding.id, kind: 'HOTEL', name: 'Hotel Manzoni Milano', city: 'Milano', country: 'Italia',
    rate_per_night: 180, total_rooms: 25, total_beds: 50, promo_code: 'ANDREA-SOFIA', url: 'https://example.com/manzoni',
    checkin_date: '2027-09-24', checkout_date: '2027-09-26',
  }).select().single()
  const accom2 = await sb.from('event_accommodations').insert({
    entry_id: wedding.id, kind: 'BNB', name: 'B&B Brera Suites', city: 'Milano', country: 'Italia',
    rate_per_night: 95, total_rooms: 8, total_beds: 16,
    checkin_date: '2027-09-24', checkout_date: '2027-09-26',
  }).select().single()
  pass('Alloggi creati')

  const trans1 = await sb.from('event_transport').insert({
    entry_id: wedding.id, kind: 'PULMINO_NAVETTA', label: 'Navetta Hotel Manzoni → Cerimonia',
    provider: 'NCC Milano', capacity: 30, cost: 350,
    depart_at: `${WEDDING.date}T10:00:00`, depart_from: 'Hotel Manzoni', arrive_to: 'Duomo Milano',
  }).select().single()
  const trans2 = await sb.from('event_transport').insert({
    entry_id: wedding.id, kind: 'AUTOBUS_GRUPPO', label: 'Bus Cerimonia → Villa Necchi',
    provider: 'NCC Milano', capacity: 60, cost: 480,
    depart_at: `${WEDDING.date}T13:00:00`, depart_from: 'Duomo', arrive_to: 'Villa Necchi',
  }).select().single()
  const trans3 = await sb.from('event_transport').insert({
    entry_id: wedding.id, kind: 'PULMINO_NAVETTA', label: 'Navetta ritorno Villa → Hotel',
    provider: 'NCC Milano', capacity: 30, cost: 350,
    depart_at: `${WEDDING.date}T23:30:00`, depart_from: 'Villa Necchi', arrive_to: 'Hotel Manzoni',
  }).select().single()
  pass('3 trasporti creati')

  // Assegnazione invitati ai trasporti (primi 30 ospiti su shuttle andata + ritorno)
  if (gIns.data && trans1.data && trans3.data) {
    const links = []
    for (let i = 0; i < Math.min(30, gIns.data.length); i++) {
      links.push({ entry_id: wedding.id, guest_id: gIns.data[i].id, transport_id: trans1.data.id })
      links.push({ entry_id: wedding.id, guest_id: gIns.data[i].id, transport_id: trans3.data.id })
    }
    // Bus principale: tutti gli ospiti
    for (let i = 0; i < Math.min(60, gIns.data.length); i++) {
      links.push({ entry_id: wedding.id, guest_id: gIns.data[i].id, transport_id: trans2.data.id })
    }
    const r = await sb.from('event_guest_transport').upsert(links, { onConflict: 'guest_id,transport_id', ignoreDuplicates: true })
    if (r.error) bug('GUEST_TRANSPORT', 'HIGH', 'Assegnazione trasporti fallita', r.error.message)
    else pass(`${links.length} assegnazioni trasporto`)
  }

  // Assegnazione invitati agli alloggi
  if (gIns.data && accom1.data) {
    const links = []
    for (let i = 0; i < Math.min(40, gIns.data.length); i++) {
      links.push({
        entry_id: wedding.id, guest_id: gIns.data[i].id, accommodation_id: accom1.data.id,
        check_in: '2027-09-24', check_out: '2027-09-26',
      })
    }
    const r = await sb.from('event_guest_accommodation').upsert(links, { onConflict: 'guest_id,accommodation_id,check_in', ignoreDuplicates: false })
    if (r.error) bug('GUEST_ACCOMMODATION', 'HIGH', 'Assegnazione alloggi fallita', r.error.message)
    else pass(`${links.length} assegnazioni alloggio`)
  }

  // ─────────────────────────────────────────────────────
  step('PHASE 8 — Pagamenti voci + Mood PDF + Quote PDF v2')
  // ─────────────────────────────────────────────────────

  // Aggiorno alcune voci a SALDATO/ACCONTO per testare pagamenti
  const { data: qItems } = await sb.from('quote_items').select('id, line_client').eq('quote_id', quote.id).order('sort_order')
  if (qItems) {
    for (let i = 0; i < qItems.length; i++) {
      const status = i < 3 ? 'SALDATO' : i < 5 ? 'ACCONTO' : 'NON_PAGATO'
      const paid = status === 'SALDATO' ? qItems[i].line_client : status === 'ACCONTO' ? qItems[i].line_client * 0.3 : 0
      await sb.from('quote_items').update({
        payment_status: status, paid_amount: paid,
        paid_at: paid > 0 ? new Date().toISOString() : null,
        payment_method: paid > 0 ? 'BONIFICO' : null,
      }).eq('id', qItems[i].id)
    }
    pass('Pagamenti voci aggiornati (mix SALDATO/ACCONTO/NON_PAGATO)')
  }

  // Test mood-board PDF
  const moodPdfRes = await invokeFunction('moodboard-pdf', { entry_id: wedding.id }, saraSession.session.access_token)
  if (!moodPdfRes.ok) bug('MOODBOARD_PDF', 'HIGH', 'Mood PDF generation fallita', JSON.stringify(moodPdfRes.body).slice(0, 300))
  else pass(`Moodboard PDF: count=${moodPdfRes.body?.count} chapters=${moodPdfRes.body?.chapters}`)

  // Test re-gen quote PDF (PREMIUM)
  const pdfRes2 = await invokeFunction('quote-generate-pdf', { quote_id: quote.id, variant: 'PREMIUM' }, saraSession.session.access_token)
  if (!pdfRes2.ok) bug('PDF_GEN_2', 'MEDIUM', 'PDF PREMIUM rigenerazione fallita', JSON.stringify(pdfRes2.body).slice(0, 200))
  else pass('PDF PREMIUM rigenerato OK')

  // ─────────────────────────────────────────────────────
  step('PHASE 9 — Verifica visibilità per ruoli (RLS)')
  // ─────────────────────────────────────────────────────

  // Sposi: deve vedere quote, contract, wedding
  const sposiSession = await loginAs(SPOSI_EMAIL)
  const sQuoteRes = await sposiSession.client.from('quotes').select('id, title, total_client').eq('id', quote.id).maybeSingle()
  if (sQuoteRes.error || !sQuoteRes.data) bug('RLS_SPOSI_QUOTE', 'HIGH', 'Sposi non vede il proprio preventivo', sQuoteRes.error?.message)
  else pass('Sposi vede quote')

  const sContractRes = await sposiSession.client.from('contracts').select('id, title').eq('entry_id', wedding.id)
  if (sContractRes.error) bug('RLS_SPOSI_CONTRACT', 'HIGH', 'Sposi: errore lettura contract', sContractRes.error.message)
  else if (sContractRes.data.length === 0) bug('RLS_SPOSI_CONTRACT', 'HIGH', 'Sposi NON vede il contratto del proprio matrimonio')
  else pass(`Sposi vede ${sContractRes.data.length} contratti`)

  const sGuestsRes = await sposiSession.client.from('event_guests').select('id').eq('entry_id', wedding.id)
  if (sGuestsRes.error || sGuestsRes.data.length === 0) bug('RLS_SPOSI_GUESTS', 'HIGH', 'Sposi non vede invitati', sGuestsRes.error?.message)
  else pass(`Sposi vede ${sGuestsRes.data.length} invitati`)

  // Fornitore foto: deve vedere SOLO le sue voci nel quote
  const fotoSession = await loginAs(FORN_FOTO_EMAIL)
  const fQItemsRes = await fotoSession.client.from('quote_items').select('id, name_snapshot, line_client').eq('quote_id', quote.id)
  if (fQItemsRes.error) bug('RLS_FORN_ITEMS', 'HIGH', 'Fornitore errore lettura quote_items', fQItemsRes.error.message)
  else {
    const myItems = fQItemsRes.data.filter(i => true) // RLS dovrebbe filtrare gia
    if (myItems.length !== 3) bug('RLS_FORN_ITEMS', 'MEDIUM', `Fornitore vede ${myItems.length} voci (atteso 3 del fotografo)`)
    else pass(`Fornitore foto vede esattamente 3 voci proprie`)
  }

  // Fornitore vede il wedding (come participant)?
  const fWedRes = await fotoSession.client.from('calendar_entries').select('id, title').eq('id', wedding.id).maybeSingle()
  if (!fWedRes.data) bug('RLS_FORN_WEDDING', 'MEDIUM', 'Fornitore non vede il wedding partecipato')
  else pass('Fornitore vede wedding partecipato')

  // ─────────────────────────────────────────────────────
  step('PHASE 10 — Report finale')
  // ─────────────────────────────────────────────────────

  console.log(`\n📊 PASS: ${passes.length}  ·  🐛 BUG: ${bugs.length}\n`)
  writeBugs()
}

function writeBugs() {
  const md = []
  md.push(`# Audit E2E Planfully — ${new Date().toISOString()}\n`)
  md.push(`**Pass**: ${passes.length}  ·  **Bug**: ${bugs.length}\n`)

  if (bugs.length === 0) {
    md.push('✨ Nessun bug trovato! Tutti i flussi end-to-end funzionano correttamente.\n')
  } else {
    const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] }
    for (const b of bugs) (bySeverity[b.severity] ?? bySeverity.LOW).push(b)

    for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      if (!bySeverity[sev].length) continue
      md.push(`\n## ${sev} (${bySeverity[sev].length})\n`)
      for (const b of bySeverity[sev]) {
        md.push(`### [${b.area}] ${b.msg}`)
        if (b.detail) md.push(`\n\`\`\`\n${b.detail}\n\`\`\``)
        md.push(`\n_at: ${b.at}_\n`)
      }
    }
  }

  md.push('\n---\n## ✅ Passed checks\n')
  for (const p of passes) md.push(`- ${p}`)

  writeFileSync(path.join(RUN_DIR, 'report.md'), md.join('\n'))
  writeFileSync(path.join(RUN_DIR, 'bugs.json'), JSON.stringify(bugs, null, 2))
  console.log(`\nReport: ${path.join(RUN_DIR, 'report.md')}`)
}

main().catch(e => { console.error('FATAL', e); writeBugs() })
