#!/usr/bin/env node
/**
 * Set test UFFICIALE Planfully (cloud).
 * 1 WP "Beta Tester" + 8 fornitori dedicati + 3 coppie reali + matrimoni completi
 * con tutti i passaggi: foto, preventivi, pagamenti, disponibilità, finanziamento, assicurazione.
 *
 * Login:
 *   wp-beta@planfully-demo.it / Beta2026!
 *   forn-beta-{tipo}@planfully-demo.it / Beta2026!
 *   sposi-beta-{n}@planfully-demo.it / Beta2026!
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

const FORNS = [
  { sub: 'fotografo',    name: 'Marco Bianchi',     biz: 'Marco Bianchi Photography' },
  { sub: 'videomaker',   name: 'Elena Rossi',       biz: 'Elena Rossi Film' },
  { sub: 'fioraio',      name: 'Sofia Verdi',       biz: 'Sofia Fiori e Decorazioni' },
  { sub: 'catering',     name: 'Antonio Esposito',  biz: 'Esposito Banqueting' },
  { sub: 'pasticcere',   name: 'Giulia Conti',      biz: 'Pasticceria Conti' },
  { sub: 'musica',       name: 'DJ Luca Marini',    biz: 'Luca Marini DJ & Live' },
  { sub: 'make_up',      name: 'Sara Greco',        biz: 'Sara Greco Beauty' },
  { sub: 'location',     name: 'Villa Calabrese',   biz: 'Villa Calabrese SRL', dining: true },
]

const COUPLES = [
  { id: 1, sposa: 'Anna', sposo: 'Paolo', ln: 'Rizzo', date: '2027-05-15', guests: 100, theme: 'BOHO' },
  { id: 2, sposa: 'Chiara', sposo: 'Davide', ln: 'Marini', date: '2027-09-08', guests: 130, theme: 'CLASSICO' },
  { id: 3, sposa: 'Federica', sposo: 'Luca', ln: 'Russo', date: '2027-06-22', guests: 80, theme: 'GARDEN' },
]

async function main() {
  console.log('\n=== SET TEST UFFICIALE ===\n')

  // 1. WP
  const wp = await ensureUser('wp-beta@planfully-demo.it', PWD, { role: 'WEDDING_PLANNER', full_name: 'Beta WP' })
  console.log('WP', wp.existed ? 'esiste' : 'creato')
  await sb.from('profiles').update({
    role: 'WEDDING_PLANNER', full_name: 'Beta Tester WP',
    business_name: 'Beta Wedding Studio', subrole: 'wedding_planner',
    city: 'Cosenza', country: 'Italia', onboarding_complete: true,
    subscription_tier: 'PREMIUM',
    bio: 'Wedding planner per beta test ufficiale Planfully.',
    work_style: 'Pianificazione completa A-Z. Mi occupo io di tutto, dalla scelta della location alle bomboniere.',
  }).eq('id', wp.id)

  // 2. Fornitori + servizi + foto + disponibilità
  const forns = []
  const PEXELS_BY_CAT = {
    fotografo: ['https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg', 'https://images.pexels.com/photos/931796/pexels-photo-931796.jpeg', 'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg', 'https://images.pexels.com/photos/1043902/pexels-photo-1043902.jpeg', 'https://images.pexels.com/photos/1454018/pexels-photo-1454018.jpeg', 'https://images.pexels.com/photos/1244627/pexels-photo-1244627.jpeg'],
    videomaker: ['https://images.pexels.com/photos/1844547/pexels-photo-1844547.jpeg', 'https://images.pexels.com/photos/1683975/pexels-photo-1683975.jpeg', 'https://images.pexels.com/photos/3014853/pexels-photo-3014853.jpeg'],
    fioraio: ['https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg', 'https://images.pexels.com/photos/931180/pexels-photo-931180.jpeg', 'https://images.pexels.com/photos/265787/pexels-photo-265787.jpeg', 'https://images.pexels.com/photos/4926579/pexels-photo-4926579.jpeg'],
    catering: ['https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg', 'https://images.pexels.com/photos/587741/pexels-photo-587741.jpeg', 'https://images.pexels.com/photos/45659/pexels-photo-45659.jpeg'],
    pasticcere: ['https://images.pexels.com/photos/4040691/pexels-photo-4040691.jpeg', 'https://images.pexels.com/photos/265801/pexels-photo-265801.jpeg', 'https://images.pexels.com/photos/2233348/pexels-photo-2233348.jpeg'],
    musica: ['https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg', 'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg', 'https://images.pexels.com/photos/164938/pexels-photo-164938.jpeg'],
    make_up: ['https://images.pexels.com/photos/2113855/pexels-photo-2113855.jpeg', 'https://images.pexels.com/photos/2693209/pexels-photo-2693209.jpeg', 'https://images.pexels.com/photos/1462630/pexels-photo-1462630.jpeg'],
    location: ['https://images.pexels.com/photos/2253870/pexels-photo-2253870.jpeg', 'https://images.pexels.com/photos/931196/pexels-photo-931196.jpeg', 'https://images.pexels.com/photos/931796/pexels-photo-931796.jpeg'],
  }
  const SERVICES_BY_SUB = {
    fotografo:  [['Servizio fotografico full day', 2200, 'EVENTO'], ['Album premium', 600, 'PEZZO'], ['Riprese drone', 380, 'EVENTO']],
    videomaker: [['Video matrimonio + trailer', 2800, 'EVENTO'], ['Reel social', 380, 'EVENTO']],
    fioraio:    [['Bouquet sposa', 160, 'PEZZO'], ['Centrotavola', 45, 'PEZZO'], ['Allestimento chiesa', 850, 'EVENTO']],
    catering:   [['Menu base', 95, 'PERSONA'], ['Menu deluxe', 140, 'PERSONA'], ['Open bar', 28, 'PERSONA']],
    pasticcere: [['Torta nuziale 3 piani', 480, 'PEZZO'], ['Confettata', 130, 'PEZZO']],
    musica:     [['DJ set 5h', 1100, 'EVENTO'], ['Band cerimonia', 1600, 'EVENTO']],
    make_up:    [['Beauty sposa prova+giorno', 350, 'EVENTO']],
    location:   [['Affitto sala + menu', 130, 'PERSONA']],
  }

  for (const f of FORNS) {
    const u = await ensureUser(`forn-beta-${f.sub.replace('_','-')}@planfully-demo.it`, PWD, { role: f.sub === 'location' ? 'LOCATION' : 'FORNITORE', full_name: f.name, subrole: f.sub })
    await sb.from('profiles').update({
      role: f.sub === 'location' ? 'LOCATION' : 'FORNITORE',
      full_name: f.name, business_name: f.biz, subrole: f.sub,
      city: 'Cosenza', country: 'Italia', onboarding_complete: true,
      bio: `${f.biz} — partner di fiducia per beta test.`,
      work_style: `Approccio professionale e calibrato sullo stile della coppia. ${f.sub === 'location' ? 'Ristorazione interna premium.' : ''}`,
      offers_full_dining: !!f.dining,
    }).eq('id', u.id)
    forns.push({ ...u, ...f })

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

    // servizi + foto
    const svcList = SERVICES_BY_SUB[f.sub] || []
    const pexels = PEXELS_BY_CAT[f.sub] || PEXELS_BY_CAT.fotografo
    for (const [name, price, unit] of svcList) {
      const { data: svc } = await sb.from('services').insert({
        fornitore_id: u.id, category_id: cat.id, name, base_price: price, unit, is_active: true,
        description: `${name}. Offerto da ${f.biz}. Destination wedding.`,
      }).select().single()
      if (svc) {
        const photos = pexels.map((p, i) => ({ service_id: svc.id, original_url: `${p}?auto=compress&w=1600`, thumbnail_url: `${p}?auto=compress&w=400`, sort_order: i }))
        await sb.from('service_photos').insert(photos)
        await sb.from('service_modifiers').insert([
          { service_id: svc.id, name: 'Sconto fedeltà cliente abituale', modifier_type: 'PERCENT', value: -10 },
          { service_id: svc.id, name: 'Supplemento destination wedding', modifier_type: 'FIXED', value: 200 },
        ])
      }
    }

    // disponibilità: blocca 5 giorni random nei prossimi 6 mesi
    const availInserts = []
    for (let i = 0; i < 5; i++) {
      const offset = faker.number.int({ min: 30, max: 180 })
      const d = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
      availInserts.push({ fornitore_id: u.id, date: d, status: i < 3 ? 'BUSY' : 'TENTATIVE' })
    }
    await sb.from('supplier_availability').upsert(availInserts, { onConflict: 'fornitore_id,date' })

    console.log(`  ✓ ${f.sub.padEnd(12)} ${f.name}`)
  }

  // 3. Coppie + matrimoni completi
  for (const c of COUPLES) {
    const cu = await ensureUser(`sposi-beta-${c.id}@planfully-demo.it`, PWD, { role: 'COUPLE', full_name: `${c.sposa} & ${c.sposo}` })
    await sb.from('profiles').update({
      role: 'COUPLE', full_name: `${c.sposa} ${c.ln}`, onboarding_complete: true,
    }).eq('id', cu.id)

    // wedding
    const { data: ce } = await sb.from('calendar_entries').insert({
      owner_id: wp.id, title: `${c.sposa} & ${c.sposo} ${c.ln}`,
      client_name: `${c.sposa} & ${c.sposo}`, client_email: `sposi-beta-${c.id}@planfully-demo.it`,
      date_from: c.date, date_to: c.date, status: 'OPZIONATA',
      theme: c.theme, tables_naming_style: 'CITTA',
      notes: `Matrimonio beta test. Tema ${c.theme}. ${c.guests} ospiti.`,
    }).select().single()

    // couple_member accepted
    await sb.from('wedding_couple_members').insert({
      entry_id: ce.id, email: `sposi-beta-${c.id}@planfully-demo.it`, full_name: `${c.sposa} ${c.ln}`,
      role: 'SPOSA', user_id: cu.id, accepted_at: new Date().toISOString(),
    })

    // couple_preferences
    await sb.from('couple_preferences').insert({
      entry_id: ce.id, bride_name: c.sposa, groom_name: c.sposo,
      couple_name: `${c.sposa} & ${c.sposo}`, styles: [c.theme],
      preferred_palette: ['beige-sage-gold'], preferred_season: 'estate', location_kind: 'villa',
      vision_note: `Matrimonio ${c.theme} in Calabria. ${c.guests} ospiti.`,
      budget_min: 25000, budget_max: 50000, guests_estimate: c.guests, budget_priority: 'foto',
    })

    // quote completo
    const allSvcs = await sb.from('services').select('id, fornitore_id, name, base_price, unit').in('fornitore_id', forns.map((f) => f.id)).eq('is_active', true).limit(20)
    const picks = allSvcs.data.slice(0, 10)
    const { data: q } = await sb.from('quotes').insert({
      owner_id: wp.id, title: `${c.sposa} & ${c.sposo}`,
      client_name: `${c.sposa} & ${c.sposo}`, client_email: `sposi-beta-${c.id}@planfully-demo.it`,
      event_date: c.date, guest_count: c.guests, default_markup_percent: 15,
      status: c.id === 1 ? 'ACCETTATO' : 'INVIATO',
      sent_at: new Date().toISOString(),
    }).select().single()

    // quote_items con pagamenti diversi
    for (let i = 0; i < picks.length; i++) {
      const s = picks[i]
      const qty = s.unit === 'PERSONA' ? c.guests : s.unit === 'PEZZO' ? faker.number.int({ min: 1, max: 6 }) : 1
      const payment_status = i < 3 ? 'SALDATO' : i < 6 ? 'ACCONTO' : 'NON_PAGATO'
      const paid_amount = payment_status === 'SALDATO' ? Number(s.base_price) * qty : payment_status === 'ACCONTO' ? Number(s.base_price) * qty * 0.3 : 0
      await sb.from('quote_items').insert({
        quote_id: q.id, service_id: s.id, supplier_id: s.fornitore_id,
        name_snapshot: s.name, snapshot_price: s.base_price, unit_snapshot: s.unit,
        quantity: qty, sort_order: i,
        payment_status, paid_amount, paid_at: paid_amount > 0 ? new Date().toISOString() : null,
        payment_method: paid_amount > 0 ? 'BONIFICO' : null,
      })
    }

    // link quote
    await sb.from('calendar_entries').update({ quote_id: q.id }).eq('id', ce.id)

    // contract per c.id === 1 (ACCETTATO)
    if (c.id === 1) {
      await sb.from('contracts').insert({
        owner_id: wp.id, quote_id: q.id, entry_id: ce.id,
        title: `Contratto ${c.sposa} & ${c.sposo}`,
        client_name: `${c.sposa} & ${c.sposo}`, client_email: `sposi-beta-${c.id}@planfully-demo.it`,
        event_date: c.date, total_amount: 30000, status: 'FIRMATO',
        sections: [{ heading: 'Oggetto', body: 'Pianificazione completa matrimonio', type: 'CLAUSULE' }],
        signed_at: new Date().toISOString(),
      })
    }

    // finance application
    await sb.from('finance_applications').insert({
      offer_id: (await sb.from('finance_offers').select('id').limit(1).maybeSingle()).data?.id,
      quote_id: q.id, applicant_id: cu.id,
      amount: 15000, months: 36, status: c.id === 1 ? 'APPROVATA' : 'INVIATA',
    })

    // insurance policy
    await sb.from('insurance_policies').insert({
      offer_id: (await sb.from('insurance_offers').select('id').limit(1).maybeSingle()).data?.id,
      entry_id: ce.id, policy_number: `POL-2027-${c.id}`,
      premium: 280, status: c.id === 1 ? 'ATTIVA' : 'PREVENTIVO',
      start_date: new Date().toISOString().slice(0, 10), end_date: c.date,
    })

    // event_tables (10 tavoli misti: 1 imperiale sposi + 9 rotondi tipo citta`)
    const cities = ['Cosenza', 'Rende', 'Catanzaro', 'Reggio', 'Tropea', 'Scalea', 'Paola', 'Diamante', 'Pizzo']
    const tables = [
      { entry_id: ce.id, table_no: 1, label: 'Tavolo Imperiale Sposi', seats: 12, shape: 'IMPERIALE' },
      ...cities.map((cit, i) => ({ entry_id: ce.id, table_no: i + 2, label: cit, seats: 8, shape: 'ROUND' })),
    ]
    await sb.from('event_tables').insert(tables)

    // guests
    const guests = []
    for (let g = 0; g < c.guests; g++) {
      guests.push({
        entry_id: ce.id, full_name: faker.person.fullName(), party_size: Math.random() > 0.85 ? 2 : 1,
        rsvp: faker.helpers.weightedArrayElement([{ weight: 6, value: 'YES' }, { weight: 2, value: 'PENDING' }, { weight: 1, value: 'NO' }]),
        diet: Math.random() > 0.85 ? faker.helpers.arrayElement(['vegetariano', 'celiaco']) : null,
        side: faker.helpers.arrayElement(['SPOSA', 'SPOSO']),
        group_label: faker.helpers.arrayElement(['Famiglia sposa', 'Famiglia sposo', 'Amici', 'Colleghi']),
      })
    }
    await sb.from('event_guests').insert(guests)

    console.log(`  ✓ wedding ${c.sposa} & ${c.sposo} ${c.ln} (${c.guests} ospiti, ${tables.length} tavoli, quote ${q.status})`)
  }

  console.log('\n═══ COMPLETATO ═══\n')
  console.log('Login (password Beta2026!):')
  console.log('  WP:     wp-beta@planfully-demo.it')
  for (const f of FORNS) console.log(`  ${f.sub.padEnd(12)} forn-beta-${f.sub.replace('_','-')}@planfully-demo.it`)
  for (const c of COUPLES) console.log(`  Coppia ${c.id}: sposi-beta-${c.id}@planfully-demo.it (${c.sposa} & ${c.sposo})`)
}

main().catch((e) => { console.error('ERR', e); process.exit(1) })
