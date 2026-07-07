#!/usr/bin/env node
/**
 * Set test MINIMAL Planfully (cloud) — 1 preventivo beta, 4 utenti.
 *
 * Login (password Beta2026!):
 *   WP:        wp-mini@planfully-demo.it     (Beta Wedding Studio)
 *   Coppia:    sposi-mini@planfully-demo.it  (Andrea & Giulia Romano)
 *   Fotografo: forn-mini-foto@planfully-demo.it
 *   Fioraio:   forn-mini-fiori@planfully-demo.it
 */
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker/locale/it'

const URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const sb = createClient(URL, KEY, { auth: { persistSession: false } })
const PWD = 'Beta2026!'

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

const COUPLE = {
  email: 'sposi-mini@planfully-demo.it',
  sposa: 'Giulia',
  sposo: 'Andrea',
  ln: 'Romano',
  date: '2027-09-18',
  guests: 90,
  theme: 'Classic elegance',
}

const FORNS = [
  {
    sub: 'fotografo',
    email: 'forn-mini-foto@planfully-demo.it',
    name: 'Marco Bianchi',
    biz: 'Marco Bianchi Photography',
    services: [
      ['Servizio fotografico full day', 2400, 'EVENTO'],
      ['Album premium 40x30', 650, 'PEZZO'],
      ['Riprese drone cerimonia', 380, 'EVENTO'],
    ],
    photos: [
      'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg',
      'https://images.pexels.com/photos/931796/pexels-photo-931796.jpeg',
      'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg',
      'https://images.pexels.com/photos/1454018/pexels-photo-1454018.jpeg',
    ],
  },
  {
    sub: 'fioraio',
    email: 'forn-mini-fiori@planfully-demo.it',
    name: 'Sofia Verdi',
    biz: 'Sofia Fiori e Decorazioni',
    services: [
      ['Bouquet sposa premium', 180, 'PEZZO'],
      ['Centrotavola elegante', 55, 'PEZZO'],
      ['Allestimento chiesa', 950, 'EVENTO'],
    ],
    photos: [
      'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg',
      'https://images.pexels.com/photos/931180/pexels-photo-931180.jpeg',
      'https://images.pexels.com/photos/4926579/pexels-photo-4926579.jpeg',
      'https://images.pexels.com/photos/265787/pexels-photo-265787.jpeg',
    ],
  },
]

async function main() {
  console.log('\n=== SET MINIMAL BETA — 1 preventivo, 4 utenti ===\n')

  // 1. WP
  const wp = await ensureUser('wp-mini@planfully-demo.it', PWD, { role: 'WEDDING_PLANNER', full_name: 'Beta Mini WP' })
  console.log('WP', wp.existed ? 'esistente' : 'creato')
  await sb.from('profiles').update({
    role: 'WEDDING_PLANNER',
    full_name: 'Sara De Luca',
    business_name: 'Beta Wedding Studio',
    subrole: 'wedding_planner',
    city: 'Cosenza',
    country: 'Italia',
    onboarding_complete: true,
    subscription_tier: 'PREMIUM',
    bio: 'Wedding planner per la coppia beta minimal. Studio specializzato in matrimoni di fascia alta.',
    work_style: 'Pianificazione completa A-Z, coordinamento giorno-X, gestione fornitori e ospiti.',
    brand_primary_color: '#1A2E4F',
    brand_secondary_color: '#C49A5C',
  }).eq('id', wp.id)

  // 2. Fornitori
  const supplierIds = []
  for (const f of FORNS) {
    const u = await ensureUser(f.email, PWD, { role: 'FORNITORE', full_name: f.name, subrole: f.sub })
    await sb.from('profiles').update({
      role: 'FORNITORE',
      full_name: f.name,
      business_name: f.biz,
      subrole: f.sub,
      city: 'Cosenza',
      country: 'Italia',
      onboarding_complete: true,
      bio: `${f.biz} — partner di fiducia. Destination wedding.`,
      work_style: 'Approccio professionale, attento ai dettagli, calibrato sullo stile della coppia.',
      brand_primary_color: f.sub === 'fotografo' ? '#1F3A5F' : '#7E6633',
    }).eq('id', u.id)
    supplierIds.push({ ...u, ...f })

    // collaboration con WP
    await sb.from('collaborations').upsert({
      capostipite_id: wp.id, fornitore_id: u.id, status: 'ACTIVE', accepted_at: new Date().toISOString(),
    }, { onConflict: 'capostipite_id,fornitore_id' })

    // categoria
    let cat = (await sb.from('service_categories').select('id').eq('slug', f.sub).maybeSingle()).data
    if (!cat) {
      const r = await sb.from('service_categories').insert({ name: f.sub, slug: f.sub, is_standard: true }).select().single()
      cat = r.data
    }

    // svuota servizi precedenti (per re-run pulito)
    await sb.from('services').delete().eq('fornitore_id', u.id)

    // servizi + foto + modifiers
    for (const [name, price, unit] of f.services) {
      const { data: svc } = await sb.from('services').insert({
        fornitore_id: u.id, category_id: cat.id, name, base_price: price, unit, is_active: true,
        description: `${name} offerto da ${f.biz}.`,
      }).select().single()
      if (svc) {
        const photos = f.photos.map((p, i) => ({
          service_id: svc.id,
          original_url: `${p}?auto=compress&w=1600`,
          thumbnail_url: `${p}?auto=compress&w=400`,
          sort_order: i,
        }))
        await sb.from('service_photos').insert(photos)
        await sb.from('service_modifiers').insert([
          { service_id: svc.id, name: 'Sconto fedeltà', modifier_type: 'PERCENT', value: -10 },
          { service_id: svc.id, name: 'Supplemento destination wedding', modifier_type: 'FIXED', value: 200 },
        ])
      }
    }

    // disponibilità: blocca alcuni giorni casuali nei prossimi 6 mesi
    const availInserts = []
    for (let i = 0; i < 4; i++) {
      const offset = faker.number.int({ min: 30, max: 180 })
      const d = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
      availInserts.push({ fornitore_id: u.id, date: d, status: i < 2 ? 'BUSY' : 'TENTATIVE' })
    }
    await sb.from('supplier_availability').upsert(availInserts, { onConflict: 'fornitore_id,date' })

    console.log(`  ✓ ${f.sub.padEnd(10)} ${f.name}`)
  }

  // 3. Coppia
  const cu = await ensureUser(COUPLE.email, PWD, { role: 'COUPLE', full_name: `${COUPLE.sposa} & ${COUPLE.sposo}` })
  await sb.from('profiles').update({
    role: 'COUPLE', full_name: `${COUPLE.sposa} ${COUPLE.ln}`, onboarding_complete: true,
  }).eq('id', cu.id)
  console.log(`  ✓ Coppia    ${COUPLE.sposa} & ${COUPLE.sposo} ${COUPLE.ln}`)

  // 4. Cleanup wedding precedente con stesso titolo (re-run pulito)
  const title = `${COUPLE.sposa} & ${COUPLE.sposo} ${COUPLE.ln}`
  const { data: existing } = await sb.from('calendar_entries').select('id, quote_id').eq('owner_id', wp.id).eq('title', title)
  for (const w of (existing ?? [])) {
    if (w.quote_id) await sb.from('quotes').delete().eq('id', w.quote_id)
    await sb.from('calendar_entries').delete().eq('id', w.id)
  }

  // 5. Wedding + couple data
  const slug = `${COUPLE.sposa}-e-${COUPLE.sposo}`.toLowerCase()
  const insertRes = await sb.from('calendar_entries').insert({
    owner_id: wp.id,
    title,
    client_name: `${COUPLE.sposa} & ${COUPLE.sposo}`,
    client_email: COUPLE.email,
    date_from: COUPLE.date,
    date_to: COUPLE.date,
    status: 'CONFERMATA',
    theme: COUPLE.theme,
    tables_naming_style: 'Città',
    value_amount: 28000,
    notes: `Matrimonio MINIMAL BETA — coppia che attraversa tutte le fasi. ${COUPLE.guests} ospiti previsti, 10 tavoli.`,
    is_destination: false,
    wedding_website_slug: slug,
    wedding_website_published: true,
    wedding_website_data: {
      hashtag: `#${COUPLE.sposa}E${COUPLE.sposo}2027`,
      story: 'Ci siamo conosciuti su un treno tra Cosenza e Roma, una mattina d\'estate. Sei anni dopo, finalmente diciamo sì.',
      dress_code: 'Cocktail elegante · evitare il bianco',
      gift_registry_url: 'https://amazon.it/wedding/registry/example',
      map_url: 'https://maps.google.com/maps?q=cosenza',
      travel_info: 'Aeroporto consigliato: Lamezia Terme (SUF). Da lì 40 min in auto fino al ricevimento.',
      things_to_do: 'Centro storico di Cosenza, Sila, Tropea, costa tirrenica.',
      couple_photo_url: 'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&w=1600',
      couple_photo_focal_y: 30,
    },
  }).select().single()
  if (insertRes.error) throw insertRes.error
  const ce = insertRes.data

  await sb.from('wedding_couple_members').insert({
    entry_id: ce.id, email: COUPLE.email, full_name: `${COUPLE.sposa} ${COUPLE.ln}`,
    role: 'SPOSA', user_id: cu.id, accepted_at: new Date().toISOString(),
  })

  await sb.from('couple_preferences').insert({
    entry_id: ce.id, bride_name: COUPLE.sposa, groom_name: COUPLE.sposo,
    couple_name: `${COUPLE.sposa} & ${COUPLE.sposo}`,
    styles: ['Classic elegance'],
    preferred_palette: ['beige-sage-gold'],
    preferred_season: 'autunno',
    location_kind: 'villa',
    vision_note: 'Matrimonio Classic elegance in Calabria, attenzione massima ai dettagli floreali e fotografici.',
    budget_min: 25000, budget_max: 40000,
    guests_estimate: COUPLE.guests, budget_priority: 'foto',
  })

  // 6. Quote completo con mix di pagamenti
  const allSvcs = await sb.from('services')
    .select('id, fornitore_id, name, base_price, unit')
    .in('fornitore_id', supplierIds.map((s) => s.id))
    .eq('is_active', true)
  const picks = (allSvcs.data ?? [])

  const { data: q } = await sb.from('quotes').insert({
    owner_id: wp.id,
    title: `${COUPLE.sposa} & ${COUPLE.sposo}`,
    client_name: `${COUPLE.sposa} & ${COUPLE.sposo}`,
    client_email: COUPLE.email,
    event_date: COUPLE.date,
    guest_count: COUPLE.guests,
    default_markup_percent: 15,
    status: 'ACCETTATO',
    sent_at: new Date().toISOString(),
  }).select().single()

  for (let i = 0; i < picks.length; i++) {
    const s = picks[i]
    const qty = s.unit === 'PERSONA' ? COUPLE.guests : s.unit === 'PEZZO' ? (s.name.includes('Centrotavola') ? 10 : 1) : 1
    // mix: 2 saldati, 2 acconto, resto non pagato
    const payment_status = i < 2 ? 'SALDATO' : i < 4 ? 'ACCONTO' : 'NON_PAGATO'
    const lineClient = Number(s.base_price) * qty * 1.15
    const paid_amount = payment_status === 'SALDATO' ? lineClient : payment_status === 'ACCONTO' ? lineClient * 0.3 : 0
    await sb.from('quote_items').insert({
      quote_id: q.id, service_id: s.id, supplier_id: s.fornitore_id,
      name_snapshot: s.name, snapshot_price: s.base_price, unit_snapshot: s.unit,
      quantity: qty, sort_order: i,
      payment_status, paid_amount, paid_at: paid_amount > 0 ? new Date().toISOString() : null,
      payment_method: paid_amount > 0 ? 'BONIFICO' : null,
    })
  }

  await sb.from('calendar_entries').update({ quote_id: q.id }).eq('id', ce.id)

  // 7. Contract firmato
  await sb.from('contracts').insert({
    owner_id: wp.id, quote_id: q.id, entry_id: ce.id,
    title: `Contratto ${COUPLE.sposa} & ${COUPLE.sposo}`,
    client_name: `${COUPLE.sposa} & ${COUPLE.sposo}`, client_email: COUPLE.email,
    event_date: COUPLE.date, total_amount: 28000, status: 'FIRMATO',
    sections: [
      { heading: 'Oggetto', body: 'Pianificazione completa del matrimonio.', type: 'CLAUSULE' },
      { heading: 'Pagamenti', body: 'Acconto 30%, saldo 30gg prima evento.', type: 'CLAUSULE' },
    ],
    signed_at: new Date().toISOString(),
  })

  // 8. Finanziamento + Assicurazione
  const fo = (await sb.from('finance_offers').select('id').limit(1).maybeSingle()).data
  if (fo) {
    await sb.from('finance_applications').insert({
      offer_id: fo.id, quote_id: q.id, applicant_id: cu.id,
      amount: 12000, months: 36, status: 'APPROVATA',
      notes: 'Richiesta beta minimal, approvata per testing.',
    })
  }
  const io = (await sb.from('insurance_offers').select('id').limit(1).maybeSingle()).data
  if (io) {
    await sb.from('insurance_policies').insert({
      offer_id: io.id, entry_id: ce.id,
      policy_number: 'POL-BETA-MINI-001',
      premium: 260, status: 'ATTIVA',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: COUPLE.date,
    })
  }

  // 9. Tavoli: 1 imperiale sposi + 9 città (preset attivo)
  const cities = ['Cosenza', 'Rende', 'Catanzaro', 'Tropea', 'Scalea', 'Paola', 'Diamante', 'Pizzo', 'Reggio']
  const tables = [
    { entry_id: ce.id, table_no: 1, label: 'Tavolo Imperiale Sposi', seats: 12, shape: 'IMPERIALE' },
    ...cities.map((cit, i) => ({ entry_id: ce.id, table_no: i + 2, label: cit, seats: 8, shape: 'ROUND' })),
  ]
  const { data: insertedTables } = await sb.from('event_tables').insert(tables).select()

  // 10. Ospiti distribuiti + assegnati ai tavoli
  const guestsData = []
  for (let g = 0; g < COUPLE.guests; g++) {
    const tableIdx = g < 12 ? 0 : Math.floor((g - 12) / 8) + 1
    const tableId = insertedTables?.[Math.min(tableIdx, insertedTables.length - 1)]?.id ?? null
    guestsData.push({
      entry_id: ce.id,
      full_name: faker.person.fullName(),
      party_size: Math.random() > 0.85 ? 2 : 1,
      rsvp: faker.helpers.weightedArrayElement([
        { weight: 7, value: 'YES' },
        { weight: 2, value: 'PENDING' },
        { weight: 1, value: 'NO' },
      ]),
      diet: Math.random() > 0.85 ? faker.helpers.arrayElement(['vegetariano', 'celiaco', 'vegano']) : null,
      side: faker.helpers.arrayElement(['SPOSA', 'SPOSO']),
      group_label: faker.helpers.arrayElement(['Famiglia sposa', 'Famiglia sposo', 'Amici', 'Colleghi']),
      table_id: tableId,
    })
  }
  await sb.from('event_guests').insert(guestsData)

  // 11. Sub-eventi + scaletta
  const subevents = [
    { entry_id: ce.id, kind: 'WELCOME_DINNER', title: 'Welcome dinner ospiti fuori sede', date_at: `${COUPLE.date}T20:00:00`, location: 'Ristorante Le Magnolie, Cosenza' },
    { entry_id: ce.id, kind: 'CEREMONY', title: 'Cerimonia religiosa', date_at: `${COUPLE.date}T11:00:00`, location: 'Chiesa Cattedrale di Cosenza' },
    { entry_id: ce.id, kind: 'RECEPTION', title: 'Ricevimento + cena + festa', date_at: `${COUPLE.date}T13:30:00`, location: 'Villa Romano, Rende' },
  ]
  await sb.from('event_subevents').insert(subevents)

  const timelineItems = [
    { entry_id: ce.id, time_at: `${COUPLE.date}T08:30:00`, title: 'Make-up sposa', is_critical: false },
    { entry_id: ce.id, time_at: `${COUPLE.date}T10:30:00`, title: 'Arrivo invitati in chiesa', is_critical: true },
    { entry_id: ce.id, time_at: `${COUPLE.date}T11:00:00`, title: 'Cerimonia religiosa', is_critical: true },
    { entry_id: ce.id, time_at: `${COUPLE.date}T12:30:00`, title: 'Foto di gruppo sul sagrato', is_critical: false },
    { entry_id: ce.id, time_at: `${COUPLE.date}T13:30:00`, title: 'Aperitivo in villa', is_critical: false },
    { entry_id: ce.id, time_at: `${COUPLE.date}T15:00:00`, title: 'Pranzo di nozze', is_critical: true },
    { entry_id: ce.id, time_at: `${COUPLE.date}T18:30:00`, title: 'Taglio della torta', is_critical: true },
    { entry_id: ce.id, time_at: `${COUPLE.date}T20:00:00`, title: 'Festa', is_critical: false },
  ]
  await sb.from('event_timeline').insert(timelineItems)

  // 12. Alloggi consigliati
  await sb.from('event_accommodations').insert([
    { entry_id: ce.id, kind: 'HOTEL', name: 'Hotel Royal Cosenza', city: 'Cosenza', country: 'Italia', rate_per_night: 95, promo_code: 'ROMANO27', url: 'https://example.com/royal' },
    { entry_id: ce.id, kind: 'B&B', name: 'B&B Tipologia Calabria', city: 'Rende', country: 'Italia', rate_per_night: 65, url: 'https://example.com/bnb' },
  ])

  // 13. Trasporti
  await sb.from('event_transport').insert([
    { entry_id: ce.id, kind: 'BUS_NAVETTA', label: 'Navetta hotel → chiesa', depart_at: `${COUPLE.date}T10:00:00`, depart_from: 'Hotel Royal', arrive_to: 'Cattedrale Cosenza' },
    { entry_id: ce.id, kind: 'BUS_NAVETTA', label: 'Navetta villa → hotel', depart_at: `${COUPLE.date}T23:30:00`, depart_from: 'Villa Romano', arrive_to: 'Hotel Royal' },
  ])

  // 14. Una richiesta modifica già pendente (per testare flusso WP)
  await sb.from('couple_change_requests').insert({
    wedding_id: ce.id,
    requested_by: cu.id,
    entity_type: 'TABLE',
    action: 'UPDATE',
    title: 'Spostare zia Carmela dal tavolo Tropea al Cosenza',
    description: 'Vorremmo che la zia Carmela sedesse al Cosenza accanto alla nonna. Grazie!',
    status: 'PENDING',
  })

  // 15. Aggiungo i fornitori come participants del wedding
  for (const s of supplierIds) {
    const r = await sb.from('calendar_entry_participants').insert({
      entry_id: ce.id, user_id: s.id, role_in_entry: s.sub.toUpperCase(),
    })
    if (r.error && !r.error.message.includes('duplicate')) console.log(`  ! partecipante ${s.sub}: ${r.error.message}`)
  }

  console.log('\n═══ COMPLETATO ═══\n')
  console.log('Login (password Beta2026!):')
  console.log('  WP:        wp-mini@planfully-demo.it')
  console.log('  Coppia:    sposi-mini@planfully-demo.it')
  for (const f of FORNS) console.log(`  ${f.sub.padEnd(10)} ${f.email}`)
  console.log(`\nMatrimonio: ${title}`)
  console.log(`Data: ${COUPLE.date} · ${COUPLE.guests} ospiti · 10 tavoli`)
  console.log(`Quote: ${q.id.slice(0, 8)} (ACCETTATO, ${picks.length} voci, mix pagamenti)`)
  console.log(`Sito ospiti: https://planfully.it/w/${slug}`)
  console.log(`Richiesta modifica già pending pronta per il WP.\n`)
}

main().catch((e) => { console.error('ERR', e); process.exit(1) })
