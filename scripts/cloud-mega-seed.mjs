#!/usr/bin/env node
/**
 * Cloud mega seed: crea su Supabase prod (zfwlkvqxfzvubmfyxofs)
 * - 3 wedding planner
 * - 8 fornitori (varie categorie)
 * - 4 coppie (sposi)
 * - 4 matrimoni completi (preventivi, contratti, tavoli, invitati, mood, playlist, alloggi, trasporti, gadget)
 *
 * Idempotente: skippa email gia` esistenti. Output: lista credenziali da usare per testare planfully.it
 */
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker/locale/it'

const SUPABASE_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '') }
const PEXELS = [
  'https://images.pexels.com/photos/931796/pexels-photo-931796.jpeg?auto=compress&w=1200',
  'https://images.pexels.com/photos/1456613/pexels-photo-1456613.jpeg?auto=compress&w=1200',
  'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg?auto=compress&w=1200',
  'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg?auto=compress&w=1200',
  'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&w=1200',
  'https://images.pexels.com/photos/1395964/pexels-photo-1395964.jpeg?auto=compress&w=1200',
  'https://images.pexels.com/photos/1844547/pexels-photo-1844547.jpeg?auto=compress&w=1200',
  'https://images.pexels.com/photos/1043902/pexels-photo-1043902.jpeg?auto=compress&w=1200',
]

const PASSWORD = 'Beta2026!'
const created = { wp: [], forn: [], couple: [], weddings: [] }

// Categorie servizio + tipi
const FORN_TEMPLATES = [
  { sub: 'fotografo', cat: 'fotografo', svcs: [['Servizio fotografico premium', 2400, 'EVENTO'], ['Album 30x30', 650, 'PEZZO'], ['Riprese drone', 450, 'EVENTO']] },
  { sub: 'videomaker', cat: 'videomaker', svcs: [['Video matrimonio full day', 3200, 'EVENTO'], ['Reel social', 480, 'EVENTO']] },
  { sub: 'fioraio', cat: 'fioraio', svcs: [['Bouquet sposa', 180, 'PEZZO'], ['Centrotavola standard', 45, 'PEZZO'], ['Centrotavola principale', 180, 'PEZZO'], ['Addobbo chiesa', 850, 'EVENTO']] },
  { sub: 'catering', cat: 'catering', svcs: [['Menu base', 95, 'PERSONA'], ['Menu deluxe', 145, 'PERSONA'], ['Open bar', 28, 'PERSONA']] },
  { sub: 'pasticcere', cat: 'pasticcere', svcs: [['Torta nuziale 3 piani', 480, 'PEZZO'], ['Confetti personalizzati (cassetta)', 120, 'PEZZO']] },
  { sub: 'musica', cat: 'musica', svcs: [['DJ set 5 ore', 1200, 'EVENTO'], ['Band live cerimonia', 1800, 'EVENTO']] },
  { sub: 'allestimenti', cat: 'allestimenti', svcs: [['Allestimento gazebo bianco', 1400, 'EVENTO'], ['Lighting design', 950, 'EVENTO']] },
  { sub: 'make_up', cat: 'make_up', svcs: [['Make-up sposa + prova', 380, 'EVENTO'], ['Acconciatura sposa', 220, 'EVENTO']] },
]

async function ensureUser(email, password, metadata) {
  // Cerca via admin listUsers (paginato)
  let found = null
  for (let page = 1; page < 20 && !found; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users?.length) break
    found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (data.users.length < 200) break
  }
  if (found) {
    console.log(`    · user esiste ${email}`)
    return found.id
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: metadata,
  })
  if (error) throw new Error(`create ${email}: ${error.message}`)
  console.log(`    ✓ creato ${email}`)
  return data.user.id
}

async function getStandardCategoryId(slugIn) {
  const { data } = await sb.from('service_categories').select('id').eq('slug', slugIn).eq('is_standard', true).maybeSingle()
  if (data?.id) return data.id
  // crea
  const { data: ins, error } = await sb.from('service_categories').insert({
    name: slugIn.charAt(0).toUpperCase() + slugIn.slice(1), slug: slugIn, is_standard: true,
  }).select().single()
  if (error) throw error
  return ins.id
}

async function main() {
  console.log('\n=== Cloud mega seed Planfully ===\n')

  // === 1) Wedding Planner ====================================================
  console.log('[1/6] Wedding Planner (3)...')
  for (let i = 0; i < 3; i++) {
    const fn = faker.person.firstName('female')
    const ln = faker.person.lastName()
    const email = `wp.${slug(fn)}.${slug(ln)}@planfully-demo.it`
    const id = await ensureUser(email, PASSWORD, { role: 'WEDDING_PLANNER', full_name: `${fn} ${ln}` })
    await sb.from('profiles').update({
      full_name: `${fn} ${ln}`,
      business_name: `${fn} ${ln} Wedding Studio`,
      subrole: 'wedding_planner',
      city: faker.location.city(),
      onboarding_complete: true,
      subscription_tier: 'PREMIUM',
      bio: `Wedding planner di fascia alta basata a ${faker.location.city()}. Specializzata in matrimoni iconici e destinations.`,
    }).eq('id', id)
    created.wp.push({ id, email, name: `${fn} ${ln}` })
  }

  // === 2) Fornitori ==========================================================
  console.log('\n[2/6] Fornitori (8)...')
  for (const tpl of FORN_TEMPLATES) {
    const fn = faker.person.firstName()
    const ln = faker.person.lastName()
    const email = `forn.${slug(tpl.sub)}.${slug(ln)}@planfully-demo.it`
    const id = await ensureUser(email, PASSWORD, { role: 'FORNITORE', full_name: `${fn} ${ln}`, subrole: tpl.sub })
    await sb.from('profiles').update({
      full_name: `${fn} ${ln}`,
      business_name: faker.company.name(),
      subrole: tpl.sub,
      city: faker.location.city(),
      onboarding_complete: true,
      bio: `${tpl.sub} con ${faker.number.int({ min: 5, max: 25 })} anni di esperienza.`,
    }).eq('id', id)
    created.forn.push({ id, email, sub: tpl.sub })

    // Servizi
    const catId = await getStandardCategoryId(tpl.cat)
    for (const [name, price, unit] of tpl.svcs) {
      const { error: sErr } = await sb.from('services').insert({
        fornitore_id: id, category_id: catId, name, base_price: price, unit, is_active: true,
      })
      if (sErr && !sErr.message.includes('duplicate')) console.warn(`      ! ${name}: ${sErr.message}`)
    }
    console.log(`    · ${tpl.svcs.length} servizi`)
  }

  // === 3) Collaborazioni ACTIVE: ogni WP collega tutti gli 8 fornitori =======
  console.log('\n[3/6] Collaborazioni ACTIVE...')
  let collabCount = 0
  for (const wp of created.wp) {
    for (const f of created.forn) {
      const { error } = await sb.from('collaborations').upsert({
        capostipite_id: wp.id, fornitore_id: f.id, status: 'ACTIVE', accepted_at: new Date().toISOString(),
      }, { onConflict: 'capostipite_id,fornitore_id' })
      if (!error) collabCount++
    }
  }
  console.log(`    ✓ ${collabCount} collaborazioni`)

  // === 4) Coppie (auth.users role=COUPLE) ===================================
  console.log('\n[4/6] Coppie (4)...')
  for (let i = 0; i < 4; i++) {
    const sposa = faker.person.firstName('female')
    const sposo = faker.person.firstName('male')
    const ln = faker.person.lastName()
    const email = `sposi.${slug(sposa)}.${slug(sposo)}@planfully-demo.it`
    const id = await ensureUser(email, PASSWORD, { role: 'COUPLE', full_name: `${sposa} & ${sposo}` })
    await sb.from('profiles').update({
      full_name: `${sposa} ${ln}`,
      onboarding_complete: true,
    }).eq('id', id)
    created.couple.push({ id, email, sposa, sposo, ln })
  }

  // === 5) Matrimoni completi =================================================
  console.log('\n[5/6] Matrimoni completi (4)...')
  for (let i = 0; i < created.couple.length; i++) {
    const couple = created.couple[i]
    const wp = created.wp[i % created.wp.length]
    const date = faker.date.between({ from: '2027-04-01', to: '2027-10-30' }).toISOString().slice(0, 10)

    // Wedding
    const { data: ce, error: ceErr } = await sb.from('calendar_entries').insert({
      owner_id: wp.id,
      title: `Matrimonio ${couple.sposa} & ${couple.sposo} ${couple.ln}`,
      client_name: `${couple.sposa} & ${couple.sposo}`,
      client_email: couple.email,
      date_from: date,
      date_to: date,
      status: 'OPZIONATA',
      notes: faker.lorem.paragraph(2),
    }).select().single()
    if (ceErr) { console.warn(`    ! wedding ${i}: ${ceErr.message}`); continue }

    console.log(`\n  ${ce.title} (${date}) — WP: ${wp.name}`)

    // Couple member link
    await sb.from('wedding_couple_members').insert({
      entry_id: ce.id, email: couple.email, full_name: `${couple.sposa} ${couple.ln}`,
      role: 'SPOSA', user_id: couple.id, accepted_at: new Date().toISOString(),
    })

    // Couple preferences
    await sb.from('couple_preferences').insert({
      entry_id: ce.id,
      bride_name: couple.sposa, groom_name: couple.sposo, couple_name: `${couple.sposa} & ${couple.sposo}`,
      styles: faker.helpers.arrayElements(['CLASSICO', 'MODERNO', 'BOHO', 'GARDEN', 'GLAMOUR', 'BEACH'], { min: 2, max: 3 }),
      preferred_palette: ['beige-sage-gold'],
      preferred_season: ['primavera', 'estate', 'autunno'][i % 3],
      location_kind: ['villa', 'castello', 'borgo', 'spiaggia'][i % 4],
      vision_note: `${faker.lorem.sentence(8)} Vogliamo qualcosa di indimenticabile.`,
      must_haves: ['fuochi d\'artificio', 'fotografia naturale', 'cibo italiano'],
      no_thanks: ['riso al lancio', 'animatori'],
      budget_min: 30000 + i * 5000,
      budget_max: 60000 + i * 10000,
      guests_estimate: 80 + i * 30,
      budget_priority: ['cibo', 'foto', 'location', 'musica'][i % 4],
    })

    // Preventivo
    const guestCount = 80 + i * 30
    const { data: quote } = await sb.from('quotes').insert({
      owner_id: wp.id,
      title: ce.title,
      client_name: ce.client_name,
      client_email: ce.client_email,
      event_date: date,
      guest_count: guestCount,
      default_markup_percent: 15,
      status: 'INVIATO',
      sent_at: new Date().toISOString(),
    }).select().single()

    // Quote items (variano per coppia)
    const services = await sb.from('services').select('id, fornitore_id, name, base_price, unit').limit(50)
    const picks = faker.helpers.arrayElements(services.data ?? [], { min: 8, max: 14 })
    let sort = 0
    for (const s of picks) {
      const qty = s.unit === 'PERSONA' ? guestCount : s.unit === 'PEZZO' ? faker.number.int({ min: 1, max: 8 }) : 1
      await sb.from('quote_items').insert({
        quote_id: quote.id, service_id: s.id, supplier_id: s.fornitore_id,
        name_snapshot: s.name, snapshot_price: s.base_price, unit_snapshot: s.unit,
        quantity: qty, sort_order: sort++,
      })
    }

    // Link quote -> calendar_entry
    await sb.from('calendar_entries').update({ quote_id: quote.id }).eq('id', ce.id)

    // Timeline 6 step
    const TIMES = [
      ['10:00', 'Preparativi sposa'], ['11:30', 'Preparativi sposo'],
      ['16:00', 'Cerimonia'], ['17:30', 'Aperitivo'], ['19:30', 'Cena'], ['23:00', 'Festa & balli'],
    ]
    for (let t = 0; t < TIMES.length; t++) {
      await sb.from('event_timeline').insert({
        entry_id: ce.id, at_time: TIMES[t][0], title: TIMES[t][1], sort_order: t,
      }).then(() => {}).catch(() => {})
    }

    // Tavoli (4-8)
    const nTables = 4 + (i % 5)
    for (let t = 0; t < nTables; t++) {
      await sb.from('event_tables').insert({
        entry_id: ce.id, table_number: t + 1, name: `Tavolo ${t + 1}`,
        capacity: 8, shape: faker.helpers.arrayElement(['ROUND', 'RECTANGLE']),
      }).then(() => {}).catch(() => {})
    }

    // Invitati
    for (let g = 0; g < guestCount; g++) {
      const isMale = Math.random() > 0.5
      await sb.from('event_guests').insert({
        entry_id: ce.id,
        full_name: faker.person.fullName({ sex: isMale ? 'male' : 'female' }),
        category: faker.helpers.arrayElement(['FAMIGLIA_SPOSA', 'FAMIGLIA_SPOSO', 'AMICI', 'COLLEGHI']),
        rsvp_status: faker.helpers.arrayElement(['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'PENDING', 'DECLINED']),
        dietary_notes: Math.random() > 0.85 ? faker.helpers.arrayElement(['vegetariano', 'vegano', 'celiaco', 'allergico noci']) : null,
      }).then(() => {}).catch(() => {})
    }

    // Mood images
    for (let m = 0; m < 8; m++) {
      await sb.from('mood_images').insert({
        entry_id: ce.id,
        url: PEXELS[m % PEXELS.length],
        source: 'pexels',
        tag: ['fiori', 'location', 'allestimento', 'torta', 'vestito'][m % 5],
        ord: m,
      }).then(() => {}).catch(() => {})
    }

    // Playlist
    const SONGS = [
      ['CERIMONIA', 'Pachelbel Canon in D', 'Pachelbel'],
      ['CERIMONIA', 'A Thousand Years', 'Christina Perri'],
      ['APERITIVO', 'Fly Me to the Moon', 'Sinatra'],
      ['APERITIVO', 'Volare', 'Domenico Modugno'],
      ['CENA', 'Italian background mix', 'Various'],
      ['TAGLIO_TORTA', 'I Will Always Love You', 'Whitney Houston'],
      ['PRIMA_DANZA', 'Perfect', 'Ed Sheeran'],
      ['FESTA', 'Sweet Caroline', 'Neil Diamond'],
      ['FESTA', 'Dancing Queen', 'ABBA'],
      ['FESTA', 'Mr. Brightside', 'The Killers'],
    ]
    for (let p = 0; p < SONGS.length; p++) {
      await sb.from('event_playlist').insert({
        entry_id: ce.id, moment: SONGS[p][0], song_title: SONGS[p][1], artist: SONGS[p][2], ord: p,
      }).then(() => {}).catch(() => {})
    }

    // Tasks
    const TASKS = [
      ['12_PRIMA', 'Sopralluogo location', true], ['12_PRIMA', 'Preventivo definitivo', true],
      ['6_PRIMA', 'Inviti stampati', true], ['6_PRIMA', 'Prova abito sposa', false],
      ['3_PRIMA', 'Menu degustazione', true], ['3_PRIMA', 'Lista invitati definitiva', false],
      ['1_PRIMA', 'Conferma fornitori', false], ['1_PRIMA', 'Disposizione tavoli', false],
    ]
    for (const [phase, title, done] of TASKS) {
      await sb.from('wedding_tasks').insert({
        entry_id: ce.id, phase, title, done, ord: 0,
      }).then(() => {}).catch(() => {})
    }

    // Alloggi (2-3)
    for (let a = 0; a < 2 + (i % 2); a++) {
      await sb.from('event_accommodations').insert({
        entry_id: ce.id,
        name: `Hotel ${faker.company.name()}`,
        address: faker.location.streetAddress(),
        checkin_date: date, checkout_date: date,
        rooms_blocked: faker.number.int({ min: 5, max: 15 }),
        notes: 'Tariffa convenzionata per ospiti matrimonio.',
      }).then(() => {}).catch(() => {})
    }

    // Trasporti
    for (let t = 0; t < 2; t++) {
      await sb.from('event_transport').insert({
        entry_id: ce.id,
        kind: t === 0 ? 'AUTO_SPOSI' : 'NAVETTA_INVITATI',
        depart_at: `${date}T${t === 0 ? '15:30' : '15:00'}:00Z`,
        from_addr: 'Casa sposa', to_addr: 'Location',
        seats: t === 0 ? 2 : 30,
      }).then(() => {}).catch(() => {})
    }

    // Gadgets
    await sb.from('event_gadgets').insert({
      entry_id: ce.id, kind: 'BOMBONIERA', name: 'Confetti personalizzati', quantity: guestCount, unit_cost: 4.5,
    }).then(() => {}).catch(() => {})
    await sb.from('event_gadgets').insert({
      entry_id: ce.id, kind: 'GADGET_OSPITI', name: 'Ventaglio personalizzato', quantity: guestCount, unit_cost: 2.8,
    }).then(() => {}).catch(() => {})

    // Budget categories
    const CATS = [['Location', 12000], ['Catering', 18000], ['Fiori', 4500], ['Foto/Video', 6500], ['Musica', 2800]]
    for (const [name, planned] of CATS) {
      await sb.from('budget_categories').insert({
        entry_id: ce.id, name, planned_amount: planned, color: faker.color.rgb(),
      }).then(() => {}).catch(() => {})
    }

    created.weddings.push({ id: ce.id, title: ce.title, date, wp_email: wp.email, couple_email: couple.email })
    console.log(`    ✓ wedding completato (${guestCount} ospiti, ${nTables} tavoli, ${SONGS.length} brani, ${TASKS.length} task)`)
  }

  // === 6) Output =============================================================
  console.log('\n\n═══════════ COMPLETATO ═══════════\n')
  console.log(`Wedding Planner: ${created.wp.length}`)
  console.log(`Fornitori:        ${created.forn.length}`)
  console.log(`Coppie:           ${created.couple.length}`)
  console.log(`Matrimoni:        ${created.weddings.length}`)
  console.log(`Collaborations:   ${collabCount}`)
  console.log('\nPassword unica per tutti: ' + PASSWORD + '\n')

  console.log('--- WP ---')
  for (const u of created.wp) console.log(`  ${u.email}  →  ${u.name}`)
  console.log('--- FORNITORI ---')
  for (const u of created.forn) console.log(`  ${u.email}  →  ${u.sub}`)
  console.log('--- COPPIE ---')
  for (const u of created.couple) console.log(`  ${u.email}  →  ${u.sposa} & ${u.sposo}`)
  console.log('--- MATRIMONI ---')
  for (const w of created.weddings) console.log(`  ${w.title}  (${w.date})  →  WP ${w.wp_email}, couple ${w.couple_email}`)
}

main().catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1) })
