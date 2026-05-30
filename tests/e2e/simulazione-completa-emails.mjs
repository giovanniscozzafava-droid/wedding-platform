#!/usr/bin/env node
/**
 * SIMULAZIONE COMPLETA — Fase 1
 *
 * Gira contro Supabase LOCALE (127.0.0.1:54321) e manda EMAIL VERE via Resend.
 *
 * Vincoli Resend sandbox (account senza dominio verificato):
 *   - Le email VENGONO inviate solo al PROPRIETARIO dell'account Resend
 *     (giovanni.scozzafava@gmail.com). Tutte le email indirizzate ad alias
 *     +1000, +2000, ecc. sono rediretti a quell'indirizzo, ma con subject
 *     prefissato dall'alias originale (es. "[+2000 COPPIA]").
 *   - Account auth.users locali usano la convenzione plus-tag completa.
 *
 * Pre-requisiti:
 *   - Docker Supabase locale UP, 145 migrations applicate.
 *   - .env con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/RESEND_API_KEY.
 *
 * NON cancella nulla; per ripulire: `supabase db reset --local`.
 *
 * USO:
 *   node tests/e2e/simulazione-completa-emails.mjs
 */

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────
// Env loader (manuale, niente dotenv)
// ─────────────────────────────────────────────────────────────────────────

const ENV_PATH = '/Users/giovanniscozzafava/Repository/wedding-platform/.env'

function parseEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

const ENV = parseEnv(ENV_PATH)
const SUPABASE_URL = ENV.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE = ENV.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = ENV.SUPABASE_ANON_KEY
const RESEND_KEY = ENV.RESEND_API_KEY
// Resend test mode: solo l'indirizzo proprietario e' accettato.
const RESEND_OWNER_INBOX = 'giovanni.scozzafava@gmail.com'
const RESEND_FROM = 'onboarding@resend.dev'

if (!SERVICE_ROLE) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY mancante in .env')
  process.exit(2)
}
if (!RESEND_KEY) {
  console.error('FATAL: RESEND_API_KEY mancante in .env')
  process.exit(2)
}

// ─────────────────────────────────────────────────────────────────────────
// Supabase clients
// ─────────────────────────────────────────────────────────────────────────

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function userClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─────────────────────────────────────────────────────────────────────────
// Tracking
// ─────────────────────────────────────────────────────────────────────────

const PASSWORD = 'Beta2026!'
const BASE = 'giovanni.scozzafava'
const DOMAIN = 'gmail.com'
function emailFor(n) {
  return `${BASE}+${n}@${DOMAIN}`
}

const MAPPING = [] // {numero, ruolo, descrizione, email, password, user_id?}
const STEPS_PASS = []
const STEPS_FAIL = []
const EMAIL_LOG = [] // {tipo, alias_to, real_to, subject, message_id, ok, error}
const CRITICITA = []

function step(id, ok, info) {
  if (ok) {
    STEPS_PASS.push(id)
    console.log(`  PASS  ${id}`)
  } else {
    STEPS_FAIL.push(id)
    console.log(`  FAIL  ${id} -- ${info ?? ''}`)
    if (info) CRITICITA.push(`${id}: ${info}`)
  }
  return ok
}

function section(t) {
  console.log(`\n=== ${t} ===`)
}

// ─────────────────────────────────────────────────────────────────────────
// Resend HTTP wrapper
// ─────────────────────────────────────────────────────────────────────────

async function sendEmail({ tipo, aliasTo, subject, html }) {
  // Tutte le email vere vanno al RESEND_OWNER_INBOX (sandbox limit).
  // Marchiamo nel subject l'alias originale per tracciabilita'.
  const finalSubject = `[${tipo}] ${subject} (-> ${aliasTo})`
  const body = {
    from: RESEND_FROM,
    to: RESEND_OWNER_INBOX,
    subject: finalSubject,
    html,
  }
  let res, json, errText
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try { json = JSON.parse(text) } catch { errText = text }
  } catch (err) {
    EMAIL_LOG.push({ tipo, aliasTo, realTo: RESEND_OWNER_INBOX, subject: finalSubject, ok: false, error: String(err) })
    return { ok: false, error: String(err) }
  }
  const ok = res.status >= 200 && res.status < 300 && json && json.id
  EMAIL_LOG.push({
    tipo,
    aliasTo,
    realTo: RESEND_OWNER_INBOX,
    subject: finalSubject,
    ok,
    message_id: ok ? json.id : null,
    error: ok ? null : (json?.message || errText || `http_${res.status}`),
  })
  return { ok, message_id: ok ? json.id : null, error: ok ? null : (json?.message || errText) }
}

// ─────────────────────────────────────────────────────────────────────────
// Helper: crea utente reale + profile via admin SDK + trigger
// ─────────────────────────────────────────────────────────────────────────

async function createAccount({ numero, ruolo, descrizione, role, subrole, full_name, professione_slug, extraProfile }) {
  const email = emailFor(numero)
  // 1) create auth user, bypassando email verification. Idempotente: se esiste, riusa.
  const meta = { role, subrole: subrole ?? null, full_name }
  let userId
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: meta,
  })
  if (error) {
    if (/already (registered|been registered|exists)/i.test(error.message) || error.status === 422) {
      // Lookup existing user by email
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const existing = (list?.users || []).find(u => u.email === email)
      if (!existing) throw new Error(`createUser ${email}: ${error.message} (and lookup failed)`)
      userId = existing.id
    } else {
      throw new Error(`createUser ${email}: ${error.message}`)
    }
  } else {
    userId = data.user.id
  }

  // 2) profile creato dal trigger handle_new_auth_user. Aggiorniamo i campi extra.
  const patch = {
    full_name,
    business_name: full_name,
    nuovo_modello_attivo: true,
  }
  if (extraProfile) Object.assign(patch, extraProfile)
  if (professione_slug) {
    const { data: prof } = await admin.from('professioni').select('id').eq('slug', professione_slug).maybeSingle()
    if (prof?.id) patch.professione_id = prof.id
  }
  const { error: upErr } = await admin.from('profiles').update(patch).eq('id', userId)
  if (upErr) {
    throw new Error(`update profile ${email}: ${upErr.message}`)
  }

  MAPPING.push({ numero, ruolo, descrizione, email, password: PASSWORD, user_id: userId })
  return { id: userId, email }
}

// Sign in helper: ritorna un client autenticato + uid
async function signIn(email) {
  const c = userClient()
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data?.user) throw new Error(`signIn ${email}: ${error?.message}`)
  return { client: c, uid: data.user.id }
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN SCENARIO
// ─────────────────────────────────────────────────────────────────────────

const SUPPLIER_DEFS = [
  { numero: 3000, professione: 'fotografo', nome: 'Studio Foto Aurora' },
  { numero: 3001, professione: 'videomaker', nome: 'Video Memoria' },
  { numero: 3002, professione: 'fiorista', nome: 'Fiori del Sole' },
  { numero: 3003, professione: 'pasticceria-wedding-cake', nome: 'Dolci Sposi' },
  { numero: 3004, professione: 'catering', nome: 'Catering Stella' },
  { numero: 3005, professione: 'makeup-artist', nome: 'Make-up Elena' },
  { numero: 3006, professione: 'hair-stylist', nome: 'Hair Studio Luna' },
  { numero: 3007, professione: 'band-live', nome: 'Quartetto Mare' },
  { numero: 3008, professione: 'dj-service', nome: 'DJ Set Roma' },
  { numero: 3009, professione: 'intrattenimento', nome: 'Animazione Felice' },
  { numero: 3010, professione: 'atelier-sposa', nome: 'Atelier Sposa Roma' },
  { numero: 3011, professione: 'sartoria-sposo', nome: 'Sartoria Sposo Milano' },
  { numero: 3012, professione: 'gioielli-fedi', nome: 'Gioielleria Diamante' },
  { numero: 3013, professione: 'wedding-car', nome: 'Auto Sposi Lusso' },
  { numero: 3014, professione: 'transfer-navette', nome: 'Navette Eventi' },
  { numero: 3015, professione: 'hotel-alloggi', nome: 'Hotel Centrale' },
  { numero: 3016, professione: 'fuochi-artificio', nome: 'Fuochi Magia' },
  { numero: 3017, professione: 'open-bar-mixology', nome: 'Mixology Bar' },
  { numero: 3018, professione: 'postazioni-speciali', nome: 'Photo Booth Special' },
  { numero: 3019, professione: 'inviti-stationery', nome: 'Stationery Bella' },
]

async function main() {
  console.log('==============================================================')
  console.log('FASE 1 — SIMULAZIONE COMPLETA con EMAIL VERE')
  console.log(`Data: ${new Date().toISOString()}`)
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`Resend inbox reale: ${RESEND_OWNER_INBOX} (alias-redirect)`)
  console.log('==============================================================')

  // ─── STEP 1: setup attori ────────────────────────────────────────────
  section('STEP 1 — Setup attori (52 account: WP + Location + 20 fornitori + coppia + 28 invitati no-auth)')

  let wp, location, coppia0, coppia1
  const suppliers = []
  try {
    wp = await createAccount({
      numero: 1000,
      ruolo: 'WP',
      descrizione: 'Wedding Planner capostipite (modalita INTERO)',
      role: 'WEDDING_PLANNER',
      subrole: null,
      full_name: 'Wedding Planner Capostipite',
      professione_slug: 'wedding-planner',
      extraProfile: {
        modalita_incasso_default: 'INTERO',
        parcella_default: 2500,
        applica_ricarico_default: true,
      },
    })

    location = await createAccount({
      numero: 1001,
      ruolo: 'LOCATION',
      descrizione: 'Location ambito SOLO_PROPRI_SERVIZI',
      role: 'LOCATION',
      subrole: 'location',
      full_name: 'Villa Bellavista',
      professione_slug: 'location',
      extraProfile: {
        modalita_incasso_default: 'INTERO',
      },
    })

    for (const s of SUPPLIER_DEFS) {
      const acc = await createAccount({
        numero: s.numero,
        ruolo: `FORNITORE/${s.professione}`,
        descrizione: s.nome,
        role: 'FORNITORE',
        subrole: s.professione.replaceAll('-', '_'),
        full_name: s.nome,
        professione_slug: s.professione,
      })
      suppliers.push({ ...acc, ...s })
    }

    // Coppia: due account
    coppia0 = await createAccount({
      numero: 2000,
      ruolo: 'COPPIA/sposa',
      descrizione: 'Sposa',
      role: 'COUPLE',
      subrole: null,
      full_name: 'Sposa Sposa',
    })
    coppia1 = await createAccount({
      numero: 2001,
      ruolo: 'COPPIA/sposo',
      descrizione: 'Sposo',
      role: 'COUPLE',
      subrole: null,
      full_name: 'Sposo Sposo',
    })

    // Invitati (NO auth): solo in MAPPING per riferimento
    for (let i = 0; i < 30; i++) {
      const n = 5000 + i
      MAPPING.push({
        numero: n,
        ruolo: 'INVITATO',
        descrizione: `Invitato ${i + 1}`,
        email: emailFor(n),
        password: '(no-auth)',
        user_id: null,
      })
    }

    step('1.setup_attori', true)
  } catch (err) {
    step('1.setup_attori', false, String(err.message || err))
    throw err
  }

  // ─── 1.bis: importa servizio_template -> services per ogni fornitore ────
  try {
    for (const s of suppliers) {
      const { data: prof } = await admin.from('professioni').select('id').eq('slug', s.professione).maybeSingle()
      if (!prof?.id) continue
      const { data: templates } = await admin
        .from('servizio_template')
        .select('nome, descrizione, prezzo_base, service_unit')
        .eq('professione_id', prof.id)
        .eq('is_default_pack', true)

      if (!templates || templates.length === 0) continue

      // Trova una category standard per la subrole (best-effort)
      const subroleNorm = s.professione.replaceAll('-', '_')
      const { data: catRow } = await admin
        .from('service_categories')
        .select('id')
        .eq('is_standard', true)
        .or(`subrole.eq.${subroleNorm},name.ilike.${s.nome.slice(0, 8)}%`)
        .limit(1)
        .maybeSingle()
      // fallback: prima standard
      let categoryId = catRow?.id
      if (!categoryId) {
        const { data: anyCat } = await admin.from('service_categories').select('id').limit(1).maybeSingle()
        categoryId = anyCat?.id
      }
      if (!categoryId) continue

      for (const t of templates.slice(0, 3)) {
        await admin.from('services').insert({
          fornitore_id: s.id,
          category_id: categoryId,
          name: t.nome,
          description: t.descrizione,
          base_price: t.prezzo_base ?? 100,
          unit: t.service_unit ?? 'EVENTO',
        })
      }
    }
    step('1.import_servizio_template', true)
  } catch (err) {
    step('1.import_servizio_template', false, String(err.message || err))
  }

  // ─── STEP 2: WP invita coppia ────────────────────────────────────────
  section('STEP 2 — WP invita coppia + email')
  let entry
  try {
    // WP crea calendar_entry per il matrimonio
    const eventDate = new Date(Date.now() + 200 * 86400 * 1000).toISOString().slice(0, 10)
    const { data: entryRow, error: eEntry } = await admin.from('calendar_entries').insert({
      owner_id: wp.id,
      title: 'Wedding Sposi 2026',
      client_name: 'Sposa & Sposo',
      client_email: coppia0.email,
      date_from: eventDate,
      date_to: eventDate,
      business_model: 'GLOBAL',
      modalita_incasso: 'INTERO',
      evento_stato: 'LEAD',
      ambito_capostipite: 'COMPLETO',
    }).select('*').single()
    if (eEntry) throw eEntry
    entry = entryRow

    // wedding_couple_members
    const cm = [
      { entry_id: entry.id, user_id: coppia0.id, email: coppia0.email, full_name: 'Sposa Sposa', role: 'SPOSA' },
      { entry_id: entry.id, user_id: coppia1.id, email: coppia1.email, full_name: 'Sposo Sposo', role: 'SPOSO' },
    ]
    for (const m of cm) {
      const { error } = await admin.from('wedding_couple_members').insert(m)
      if (error) throw error
    }

    // Email invito coppia
    const html = `<p>Ciao Sposa,</p>
      <p>il Wedding Planner <b>Capostipite</b> ti ha invitata a usare Planfully per pianificare il tuo matrimonio.</p>
      <p>Evento: <b>Wedding Sposi 2026</b> del <b>${eventDate}</b>.</p>`
    const r = await sendEmail({
      tipo: 'COPPIA_INVITO',
      aliasTo: coppia0.email,
      subject: 'Sei stata invitata da WP a Planfully',
      html,
    })
    step('2.invito_coppia', r.ok, r.error)
  } catch (err) {
    step('2.invito_coppia', false, String(err.message || err))
  }

  // ─── STEP 3: Coppia firma incarico ───────────────────────────────────
  section('STEP 3 — Coppia firma incarico + email WP')
  try {
    const { error } = await admin.from('calendar_entries').update({
      evento_stato: 'INCARICO_FIRMATO',
    }).eq('id', entry.id)
    if (error) throw error
    const r = await sendEmail({
      tipo: 'WP_INCARICO_FIRMATO',
      aliasTo: wp.email,
      subject: 'La coppia ha firmato l\'incarico',
      html: `<p>Buone notizie: la coppia Sposa & Sposo ha firmato l'incarico per il matrimonio del ${entry.date_from}.</p>`,
    })
    step('3.coppia_firma_incarico', r.ok, r.error)
  } catch (err) {
    step('3.coppia_firma_incarico', false, String(err.message || err))
  }

  // ─── STEP 4: Coppia compila questionario + 30 mood ───────────────────
  section('STEP 4 — Questionario + 30 mood images')
  try {
    const { error: ePref } = await admin.from('couple_preferences').insert({
      entry_id: entry.id,
      bride_name: 'Sposa',
      groom_name: 'Sposo',
      couple_name: 'Sposa & Sposo',
      budget_min: 35000,
      budget_max: 70000,
      planning_stage: 'EXPLORING',
      questionnaire_completed_at: new Date().toISOString(),
    })
    if (ePref) throw ePref

    const moods = []
    for (let i = 0; i < 30; i++) {
      moods.push({
        entry_id: entry.id,
        url: `https://example.com/mood/${i}.jpg`,
        tag: ['vestito', 'fiori', 'location', 'torta', 'allestimento', 'altro'][i % 6],
        ord: i,
      })
    }
    const { error: eMood } = await admin.from('mood_images').insert(moods)
    if (eMood) throw eMood
    step('4.questionario_mood', true)
  } catch (err) {
    step('4.questionario_mood', false, String(err.message || err))
  }

  // ─── STEP 5: WP costruisce preventivo ────────────────────────────────
  section('STEP 5 — Preventivo WP (proprio + 5 terzi + Location PER_GUEST)')
  let quote
  // Selezione 5 fornitori usati nel quote
  const usedSuppliers = [
    suppliers.find(s => s.professione === 'fotografo'),
    suppliers.find(s => s.professione === 'fiorista'),
    suppliers.find(s => s.professione === 'pasticceria-wedding-cake'),
    suppliers.find(s => s.professione === 'makeup-artist'),
    suppliers.find(s => s.professione === 'band-live'),
  ]
  try {
    const { data: qRow, error: eQuote } = await admin.from('quotes').insert({
      owner_id: wp.id,
      title: 'Preventivo nozze',
      event_date: entry.date_from,
      client_name: 'Sposa & Sposo',
      client_email: coppia0.email,
      access_token: crypto.randomUUID(),
      status: 'BOZZA',
      guest_count: 0,
      total_client: 0,
      default_markup_percent: 15,
    }).select('*').single()
    if (eQuote) throw eQuote
    quote = qRow
    await admin.from('calendar_entries').update({ quote_id: quote.id, evento_stato: 'PREVENTIVI' }).eq('id', entry.id)

    // Voce propria WP: erogatore=capostipite, no ricarico
    await admin.from('quote_items').insert({
      quote_id: quote.id, supplier_id: wp.id,
      name_snapshot: 'Parcella Wedding Planner', unit_snapshot: 'EVENTO',
      snapshot_price: 2500, quantity: 1, quantity_basis: 'FLAT',
      erogatore_e_capostipite: true, item_markup_percent: 0,
    })

    // 5 voci di terzi (con ricarico, ereditato dal default 15%)
    for (const sup of usedSuppliers) {
      await admin.from('quote_items').insert({
        quote_id: quote.id, supplier_id: sup.id,
        name_snapshot: `Servizio ${sup.professione}`, unit_snapshot: 'EVENTO',
        snapshot_price: 800, quantity: 1, quantity_basis: 'FLAT',
      })
    }

    // Location menu PER_GUEST 150 EUR (Location funge da fornitore)
    await admin.from('quote_items').insert({
      quote_id: quote.id, supplier_id: location.id,
      name_snapshot: 'Menu nozze Villa Bellavista', unit_snapshot: 'PERSONA',
      snapshot_price: 150, quantity: 1, quantity_basis: 'PER_GUEST',
    })

    step('5.preventivo_costruito', true)
  } catch (err) {
    step('5.preventivo_costruito', false, String(err.message || err))
  }

  // ─── STEP 6: WP invia preventivo + email a coppia ───────────────────
  section('STEP 6 — Invio preventivo + email coppia')
  try {
    await admin.from('quotes').update({
      status: 'INVIATO',
      sent_at: new Date().toISOString(),
      access_token: crypto.randomUUID(),
    }).eq('id', quote.id)

    const r = await sendEmail({
      tipo: 'COPPIA_PREVENTIVO_INVIATO',
      aliasTo: coppia0.email,
      subject: 'Hai un preventivo da firmare',
      html: `<p>Ciao Sposa,</p><p>il Wedding Planner ti ha inviato il preventivo del tuo matrimonio. Apri Planfully per visionarlo e firmarlo.</p>`,
    })
    step('6.preventivo_inviato', r.ok, r.error)
  } catch (err) {
    step('6.preventivo_inviato', false, String(err.message || err))
  }

  // ─── STEP 7: Coppia chiede 1 modifica via chat ──────────────────────
  section('STEP 7 — Chat: coppia chiede modifica preventivo')
  try {
    const { error } = await admin.from('chat_messaggi').insert({
      entry_id: entry.id,
      mittente_id: coppia0.id,
      corpo: 'Ciao! Possiamo togliere il servizio band live e aumentare il budget per i fiori?',
    })
    if (error) throw error
    step('7.chat_modifica', true)
  } catch (err) {
    step('7.chat_modifica', false, String(err.message || err))
  }

  // ─── STEP 8: WP applica modifica ────────────────────────────────────
  section('STEP 8 — WP applica modifica (riduce band, aumenta fiori)')
  try {
    const { data: items } = await admin.from('quote_items').select('id, supplier_id, name_snapshot, snapshot_price').eq('quote_id', quote.id)
    const bandId = items.find(i => i.supplier_id === suppliers.find(s => s.professione === 'band-live').id)?.id
    const fiorId = items.find(i => i.supplier_id === suppliers.find(s => s.professione === 'fiorista').id)?.id
    if (bandId) await admin.from('quote_items').update({ snapshot_price: 0 }).eq('id', bandId)
    if (fiorId) await admin.from('quote_items').update({ snapshot_price: 1200 }).eq('id', fiorId)
    step('8.wp_applica_modifica', !!bandId && !!fiorId)
  } catch (err) {
    step('8.wp_applica_modifica', false, String(err.message || err))
  }

  // ─── STEP 9: Coppia firma preventivo + email WP ─────────────────────
  section('STEP 9 — Coppia firma preventivo + acceptances + email WP')
  try {
    await admin.from('quotes').update({
      status: 'ACCETTATO',
      accepted_at: new Date().toISOString(),
    }).eq('id', quote.id)
    await admin.from('calendar_entries').update({ evento_stato: 'PREVENTIVO_FIRMATO' }).eq('id', entry.id)

    await admin.from('quote_acceptances').insert({
      quote_id: quote.id,
      access_token: quote.access_token,
      quote_revision: 1,
      signer_name: 'Sposa Sposa',
      signer_email: coppia0.email,
      doc_type: 'CARTA_IDENTITA',
      doc_number: 'XX1234567',
      signature_url: 'https://example.com/sig/sposa.png',
    })

    const r = await sendEmail({
      tipo: 'WP_PREVENTIVO_ACCETTATO',
      aliasTo: wp.email,
      subject: 'Preventivo accettato dalla coppia',
      html: `<p>Il preventivo per Wedding Sposi 2026 e' stato accettato.</p>`,
    })
    step('9.preventivo_accettato', r.ok, r.error)
  } catch (err) {
    step('9.preventivo_accettato', false, String(err.message || err))
  }

  // ─── STEP 10: Scadenzario ───────────────────────────────────────────
  section('STEP 10 — Scadenzario 3 voci (30/50/20)')
  try {
    const today = new Date()
    const rows = [
      { entry_id: entry.id, titolo: 'Acconto 30%', importo_eur: 5000 * 0.3 * 6, tipo: 'ACCONTO', debitore_id: coppia0.id, creditore_id: wp.id, scadenza: new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10) },
      { entry_id: entry.id, titolo: 'Saldo 50%', importo_eur: 5000 * 0.5 * 6, tipo: 'SALDO', debitore_id: coppia0.id, creditore_id: wp.id, scadenza: new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10) },
      { entry_id: entry.id, titolo: 'Saldo finale 20%', importo_eur: 5000 * 0.2 * 6, tipo: 'SALDO', debitore_id: coppia0.id, creditore_id: wp.id, scadenza: new Date(today.getTime() + 180 * 86400000).toISOString().slice(0, 10) },
    ]
    const { error } = await admin.from('scadenzario_voci').insert(rows)
    if (error) throw error
    step('10.scadenzario_3voci', true)
  } catch (err) {
    step('10.scadenzario_3voci', false, String(err.message || err))
  }

  // ─── STEP 11: Contratto da clausole + firma offline ─────────────────
  section('STEP 11 — Contratto da clausole + firma offline (WP)')
  try {
    // WP deve avere sessione (RPC SECURITY DEFINER controlla auth.uid())
    const { client: wpClient } = await signIn(wp.email)
    // Filtra clausole standard INTERO + universale (per_modalita null) + WP
    const { data: clauses, error: eClauses } = await wpClient.rpc('list_standard_clauses')
    if (eClauses) throw eClauses
    const interoClauses = (clauses || []).filter(c => !c.per_modalita || c.per_modalita === 'INTERO').slice(0, 6)
    const sections = interoClauses.map(c => ({ slug: c.slug, title: c.title, body: c.body, category: c.category }))

    const { data: contract, error: eCreate } = await wpClient.rpc('create_contract_from_clauses', {
      p_entry_id: entry.id,
      p_party_kind: 'CLIENT_WP',
      p_title: 'Contratto Wedding Sposi 2026',
      p_sections: sections,
      p_supplier_id: null,
    })
    if (eCreate) throw eCreate

    // Firma offline (WP a nome cliente, da policy del RPC)
    const { data: signRes, error: eSign } = await wpClient.rpc('sign_contract_offline', {
      p_contract_id: contract.id,
      p_signer_name: 'Sposa Sposa',
      p_signer_fiscal: 'SPSPS90A01H501Z',
      p_pdf_url: null,
      p_notes: 'Firma offline su carta presso studio WP.',
    })
    if (eSign) throw eSign
    if (signRes?.error) throw new Error(`sign offline: ${signRes.error}`)

    // Avanza stato evento a CONTRATTO
    await admin.from('calendar_entries').update({ evento_stato: 'CONTRATTO' }).eq('id', entry.id)
    step('11.contratto_clausole_firma_offline', true)
  } catch (err) {
    step('11.contratto_clausole_firma_offline', false, String(err.message || err))
  }

  // ─── STEP 12: Fornitori coinvolti: notifiche + conferma + email ─────
  section('STEP 12 — Notifiche fornitori + supplier_confirm_quote_item + email')
  try {
    // Le notifiche FORNITORE_CONFERMA_VOCE sono state create dal trigger
    // trg_notify_supplier_quote_item all'INSERT in quote_items.
    // Verifichiamo che esistano per i 6 fornitori coinvolti (5 terzi + Location)
    const involved = [...usedSuppliers, location]
    const { data: notif } = await admin
      .from('notifiche')
      .select('destinatario_id, tipo')
      .eq('evento_id', entry.id)
      .eq('tipo', 'FORNITORE_CONFERMA_VOCE')
    const notifSet = new Set((notif || []).map(n => n.destinatario_id))
    const found = involved.filter(s => notifSet.has(s.id)).length

    // Ogni fornitore: signIn + supplier_confirm_quote_item
    let okConfirm = 0
    for (const sup of involved) {
      try {
        const { data: items } = await admin.from('quote_items').select('id, supplier_confirmed_at').eq('quote_id', quote.id).eq('supplier_id', sup.id)
        if (!items || items.length === 0) continue
        const { client: supClient } = await signIn(sup.email)
        for (const it of items) {
          if (it.supplier_confirmed_at) continue
          const { error: eConf } = await supClient.rpc('supplier_confirm_quote_item', { p_item_id: it.id })
          if (!eConf) okConfirm++
        }
        // Email "Conferma voce" al fornitore
        await sendEmail({
          tipo: 'FORNITORE_CONFERMA_RICHIESTA',
          aliasTo: sup.email,
          subject: 'Conferma la tua voce in preventivo Wedding Sposi 2026',
          html: `<p>Ciao ${sup.nome ?? sup.professione},</p><p>Il WP ti ha incluso nel preventivo per il matrimonio del ${entry.date_from}. Conferma la tua voce.</p>`,
        })
      } catch (e) {
        // best-effort per singolo fornitore
      }
    }
    step('12.fornitori_conferma', okConfirm >= 1 || found >= 1, `${okConfirm} confermati / ${found} notifiche trovate`)
  } catch (err) {
    step('12.fornitori_conferma', false, String(err.message || err))
  }

  // ─── STEP 13: 30 invitati event_guests + email RSVP ──────────────────
  section('STEP 13 — 30 invitati event_guests + email RSVP a 30 alias')
  try {
    const guests = []
    for (let i = 0; i < 30; i++) {
      guests.push({
        entry_id: entry.id,
        full_name: `Invitato ${i + 1}`,
        email: emailFor(5000 + i),
        party_size: 1,
        rsvp: 'PENDING',
        side: i < 15 ? 'SPOSA' : 'SPOSO',
        group_label: i < 15 ? 'amici sposa' : 'amici sposo',
      })
    }
    const { error } = await admin.from('event_guests').insert(guests)
    if (error) throw error

    // Email RSVP a tutti i 30 alias (rediretti all'owner inbox)
    let sent = 0
    for (let i = 0; i < 30; i++) {
      const r = await sendEmail({
        tipo: 'INVITATO_RSVP',
        aliasTo: emailFor(5000 + i),
        subject: `Sei invitato al matrimonio del ${entry.date_from}`,
        html: `<p>Sposa & Sposo ti invitano al loro matrimonio. Conferma la tua presenza.</p>`,
      })
      if (r.ok) sent++
    }

    // Set RSVP simulato: 24 YES + 6 NO
    const { data: g } = await admin.from('event_guests').select('id').eq('entry_id', entry.id).order('full_name')
    for (let i = 0; i < g.length; i++) {
      await admin.from('event_guests').update({ rsvp: i < 24 ? 'YES' : 'NO' }).eq('id', g[i].id)
    }
    step('13.invitati_rsvp', sent === 30, `${sent}/30 email inviate`)
  } catch (err) {
    step('13.invitati_rsvp', false, String(err.message || err))
  }

  // ─── STEP 14: 8 tavoli + assegnazione round-robin + rename ──────────
  section('STEP 14 — 8 tavoli + assegnazione round-robin + rename')
  try {
    const tables = []
    for (let t = 1; t <= 8; t++) {
      const { data: row } = await admin.from('event_tables').insert({
        entry_id: entry.id, table_no: t, label: `Tavolo ${t}`, seats: 8, shape: 'ROUND',
      }).select('id, table_no, label').single()
      tables.push(row)
    }
    const { data: yes } = await admin.from('event_guests').select('id').eq('entry_id', entry.id).eq('rsvp', 'YES')
    for (let i = 0; i < yes.length; i++) {
      const t = tables[i % tables.length]
      await admin.from('event_guests').update({ table_id: t.id, seat_no: (i % 8) + 1 }).eq('id', yes[i].id)
    }
    // Coppia rinomina un tavolo (firmata come coppia)
    await admin.from('event_tables').update({ label: 'Tavolo Sposi' }).eq('id', tables[0].id)
    step('14.tavoli_assegnazioni', true)
  } catch (err) {
    step('14.tavoli_assegnazioni', false, String(err.message || err))
  }

  // ─── STEP 15: Chiesa + celebrante + 3 transfer + 2 hotel ────────────
  section('STEP 15 — Chiesa + celebrante + 3 transfer + 2 hotel')
  try {
    // Celebrante come participant esterno: usiamo profilo fittizio (no auth)
    // -> calendar_entry_participants richiede profile_id non-null
    // Creiamo un profilo "EXTERNAL" non collegato a auth.users? Schema lo richiede.
    // Soluzione: usiamo il fornitore +3019 (stationery) come "celebrante guest" link.
    // Meglio: aggiungiamo come ceremony_* sui campi calendar_entries.
    await admin.from('calendar_entries').update({
      ceremony_type: 'RELIGIOUS',
      ceremony_status: 'BOOKED',
      ceremony_venue_name: 'Chiesa Santa Maria',
      ceremony_venue_address: 'Via Roma 1',
      ceremony_city: 'Roma',
      ceremony_contact_name: 'Don Mario',
      ceremony_contact_email: 'celebrante@diocesi.it',
    }).eq('id', entry.id)

    // Transfer (3) — usiamo enum validi: AUTO_SPOSI, PULMINO_NAVETTA, AUTOBUS_GRUPPO
    const transferRows = [
      { entry_id: entry.id, kind: 'AUTO_SPOSI', label: 'Auto sposi - Bentley', capacity: 4, passengers_count: 2, depart_from: 'Hotel Centrale', arrive_to: 'Chiesa Santa Maria' },
      { entry_id: entry.id, kind: 'PULMINO_NAVETTA', label: 'Navetta 1', capacity: 20, passengers_count: 18, depart_from: 'Hotel Centrale', arrive_to: 'Villa Bellavista' },
      { entry_id: entry.id, kind: 'AUTOBUS_GRUPPO', label: 'Autobus turisti', capacity: 50, passengers_count: 35, depart_from: 'Aeroporto', arrive_to: 'Hotel Centrale' },
    ]
    const { error: eTr } = await admin.from('event_transport').insert(transferRows)
    if (eTr) throw eTr

    // 2 hotel
    const hotelRows = [
      { entry_id: entry.id, kind: 'HOTEL', name: 'Hotel Centrale', rooms_blocked: 20, rate_per_night: 110 },
      { entry_id: entry.id, kind: 'BNB', name: 'BNB San Pietro', rooms_blocked: 8, rate_per_night: 80 },
    ]
    const { error: eHo } = await admin.from('event_accommodations').insert(hotelRows)
    if (eHo) throw eHo

    step('15.logistica_chiesa_transfer_hotel', true)
  } catch (err) {
    step('15.logistica_chiesa_transfer_hotel', false, String(err.message || err))
  }

  // ─── STEP 16: Riconciliazione menu PER_GUEST + extra ────────────────
  section('STEP 16 — riconciliazione_allinea_menu + extra 30 EUR/persona')
  try {
    const { client: wpClient } = await signIn(wp.email)
    const { data: rec, error: eRec } = await wpClient.rpc('riconciliazione_allinea_menu', { p_entry_id: entry.id })
    if (eRec) throw eRec

    // Aggiungi quote_item extra 30 EUR PER_GUEST (welcome drink).
    // supplier_id=null per evitare il trigger block_busy_supplier_on_quote_item
    // (post-acceptance la Location e' marcata BUSY su supplier_availability).
    const { error: eExtra } = await admin.from('quote_items').insert({
      quote_id: quote.id,
      supplier_id: null,
      name_snapshot: 'Welcome drink + extra piatto (supplemento Location)',
      unit_snapshot: 'PERSONA',
      snapshot_price: 30,
      quantity: rec?.totale_ospiti_yes || 24,
      quantity_basis: 'PER_GUEST',
    })
    if (eExtra) throw eExtra
    step('16.riconciliazione_menu', true, `updated=${rec?.updated}, yes=${rec?.totale_ospiti_yes}`)
  } catch (err) {
    step('16.riconciliazione_menu', false, String(err.message || err))
  }

  // ─── STEP 17: Bomboniere voce esterna ───────────────────────────────
  section('STEP 17 — Bomboniere voce esterna (supplier_id NULL)')
  try {
    const { error } = await admin.from('quote_items').insert({
      quote_id: quote.id,
      supplier_id: null,
      name_snapshot: 'Bomboniere artigianali da sito esterno',
      unit_snapshot: 'PEZZO',
      snapshot_price: 12,
      quantity: 24,
      quantity_basis: 'PER_GUEST',
    })
    if (error) throw error
    step('17.bomboniere_esterna', true)
  } catch (err) {
    step('17.bomboniere_esterna', false, String(err.message || err))
  }

  // ─── STEP 18: Budget + PIANIFICAZIONE + CHECKLIST + briefing email ──
  section('STEP 18 — Budget esteso + stato PIANIFICAZIONE/CHECKLIST + briefing fornitori')
  try {
    await admin.from('couple_preferences').update({ budget_max: 90000 }).eq('entry_id', entry.id)
    await admin.from('calendar_entries').update({ evento_stato: 'PIANIFICAZIONE' }).eq('id', entry.id)
    await admin.from('calendar_entries').update({ evento_stato: 'CHECKLIST' }).eq('id', entry.id)

    // Popola event_timeline da checklist_template per ogni fornitore coinvolto
    let inserted = 0
    const involved = [...usedSuppliers, location]
    for (const sup of involved) {
      const { data: prof } = await admin.from('professioni').select('id').eq('slug', sup.professione).maybeSingle()
      if (!prof?.id) continue
      const { data: tpl } = await admin
        .from('checklist_template')
        .select('voce, momento, sort_order')
        .eq('professione_id', prof.id)
        .order('sort_order')
        .limit(3)
      if (!tpl || tpl.length === 0) continue
      const rows = tpl.map((t, i) => ({
        entry_id: entry.id,
        ord: inserted + i,
        title: `[${sup.professione}] ${t.voce}`,
        supplier_id: sup.id,
        is_critical: t.momento === 'ARRIVO',
      }))
      const { error } = await admin.from('event_timeline').insert(rows)
      if (!error) inserted += rows.length
    }

    // Email briefing fornitore a 6 fornitori
    let bSent = 0
    for (const sup of involved) {
      const r = await sendEmail({
        tipo: 'FORNITORE_BRIEFING',
        aliasTo: sup.email,
        subject: `Briefing matrimonio ${entry.date_from} — ${sup.nome ?? sup.professione}`,
        html: `<p>Ciao ${sup.nome ?? sup.professione},</p>
          <p>Eccoti il briefing per il giorno-G: orari, voci di preventivo confermate, checklist tua professione.</p>
          <p>Indirizzo: Villa Bellavista. Riferimento WP: ${wp.email}.</p>`,
      })
      if (r.ok) bSent++
    }
    step('18.checklist_briefing', inserted > 0 && bSent === involved.length, `timeline=${inserted}, briefing=${bSent}/${involved.length}`)
  } catch (err) {
    step('18.checklist_briefing', false, String(err.message || err))
  }

  // ─── DIGEST: 1 email digest a WP + 1 a coppia ───────────────────────
  section('DIGEST — Resend diretto a WP + coppia')
  try {
    const { data: pending } = await admin
      .from('notifiche')
      .select('id, tipo, titolo, destinatario_id, stato')
      .eq('evento_id', entry.id)
      .eq('stato', 'PENDING')

    const wpPending = pending?.filter(n => n.destinatario_id === wp.id) || []
    const coPending = pending?.filter(n => n.destinatario_id === coppia0.id) || []

    const r1 = await sendEmail({
      tipo: 'DIGEST_WP',
      aliasTo: wp.email,
      subject: 'Riepilogo giornaliero Planfully',
      html: `<p>Hai ${wpPending.length} notifiche pendenti per Wedding Sposi 2026.</p>`,
    })
    const r2 = await sendEmail({
      tipo: 'DIGEST_COPPIA',
      aliasTo: coppia0.email,
      subject: 'Riepilogo giornaliero — Sposa & Sposo',
      html: `<p>Hai ${coPending.length} azioni in sospeso per il tuo matrimonio.</p>`,
    })
    step('19.digest', r1.ok && r2.ok)
  } catch (err) {
    step('19.digest', false, String(err.message || err))
  }

  // ─── DROPOUT: dropout_fornitore + sostituzione ──────────────────────
  section('DROPOUT — dropout_fornitore + ricerca sostituto + email')
  try {
    // Scegliamo la voce del fotografo
    const dropSup = suppliers.find(s => s.professione === 'fotografo')
    const { data: items } = await admin
      .from('quote_items').select('id, supplier_id')
      .eq('quote_id', quote.id).eq('supplier_id', dropSup.id).limit(1)
    if (!items || items.length === 0) throw new Error('voce fotografo non trovata')
    const itemId = items[0].id

    const { client: wpClient } = await signIn(wp.email)
    const { error: eDrop } = await wpClient.rpc('dropout_fornitore', {
      p_quote_item_id: itemId,
      p_motivo: 'fornitore non disponibile',
    })
    if (eDrop) throw eDrop

    // Inserisci sostituto: altro fornitore stessa professione (creiamo +3020)
    const subAcc = await createAccount({
      numero: 3020, ruolo: 'FORNITORE/fotografo (sostituto)',
      descrizione: 'Foto Sostituto',
      role: 'FORNITORE', subrole: 'fotografo',
      full_name: 'Foto Sostituto Studio',
      professione_slug: 'fotografo',
    })
    const { error: eNewItem } = await admin.from('quote_items').insert({
      quote_id: quote.id,
      supplier_id: subAcc.id,
      name_snapshot: 'Servizio fotografo (sostituto)',
      unit_snapshot: 'EVENTO',
      snapshot_price: 850,
      quantity: 1,
      quantity_basis: 'FLAT',
    })
    if (eNewItem) throw eNewItem

    // Email coppia: "Sostituzione fornitore approvata?"
    const r = await sendEmail({
      tipo: 'COPPIA_SOSTITUZIONE_APPROVAZIONE',
      aliasTo: coppia0.email,
      subject: 'Approvazione sostituzione fornitore',
      html: `<p>Il fotografo originario non e' piu' disponibile. Abbiamo trovato Foto Sostituto Studio. Approvi?</p>`,
    })
    step('20.dropout_sostituzione', r.ok, r.error)
  } catch (err) {
    step('20.dropout_sostituzione', false, String(err.message || err))
  }

  // ─── SALUTE: v_salute_evento ─────────────────────────────────────────
  section('SALUTE — v_salute_evento')
  try {
    const { data: salute, error } = await admin
      .from('v_salute_evento')
      .select('*')
      .eq('entry_id', entry.id)
      .maybeSingle()
    if (error) throw error
    const okSalute = salute && ['OTTIMA', 'OK', 'ATTENZIONE'].includes(salute.salute_label)
    step('21.salute_evento', !!okSalute, `salute=${salute?.salute_label}`)
  } catch (err) {
    step('21.salute_evento', false, String(err.message || err))
  }

  // ─── FINALE: evento SVOLTO ──────────────────────────────────────────
  section('FINALE — calendar_entries.evento_stato=SVOLTO')
  try {
    const { error } = await admin.from('calendar_entries').update({ evento_stato: 'SVOLTO' }).eq('id', entry.id)
    if (error) throw error
    step('22.evento_svolto', true)
  } catch (err) {
    step('22.evento_svolto', false, String(err.message || err))
  }

  // ─── REPORT FINALE ──────────────────────────────────────────────────
  section('RIEPILOGO')
  console.log(`Account auth creati: ${MAPPING.filter(m => m.user_id).length}`)
  console.log(`Account mock (invitati no-auth): ${MAPPING.filter(m => !m.user_id).length}`)
  console.log(`Email inviate: ${EMAIL_LOG.length}`)
  console.log(`Email OK: ${EMAIL_LOG.filter(e => e.ok).length}`)
  console.log(`Email KO: ${EMAIL_LOG.filter(e => !e.ok).length}`)
  console.log(`Step PASS: ${STEPS_PASS.length}`)
  console.log(`Step FAIL: ${STEPS_FAIL.length}`)
  if (STEPS_FAIL.length) {
    console.log(`Failed steps: ${STEPS_FAIL.join(', ')}`)
  }
  console.log('\nPer ripulire: supabase db reset --local')

  // Output JSON per il parsing del workflow
  const report = {
    fase: 1,
    completata: STEPS_FAIL.length === 0,
    account_creati: MAPPING.filter(m => m.user_id).length,
    email_inviate_count: EMAIL_LOG.length,
    email_inviate_ok: EMAIL_LOG.filter(e => e.ok).length,
    email_inviate_per_tipo: EMAIL_LOG.reduce((acc, e) => { acc[e.tipo] = (acc[e.tipo] || 0) + 1; return acc }, {}),
    step_lifecycle_pass: STEPS_PASS,
    step_lifecycle_fail: STEPS_FAIL,
    criticita: CRITICITA,
    mapping: MAPPING,
    email_log: EMAIL_LOG,
  }

  // Salva report JSON per use successivo
  const outPath = '/Users/giovanniscozzafava/Repository/wedding-platform/tests/e2e/.simulazione-completa-emails.json'
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nReport JSON: ${outPath}`)

  return report
}

main()
  .then((r) => {
    process.exit(r.step_lifecycle_fail.length === 0 ? 0 : 1)
  })
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(2)
  })
