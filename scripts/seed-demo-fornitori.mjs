#!/usr/bin/env node
/**
 * Crea FORNITORI demo Planfully collegati ai capostipiti demo (Baronella, Tenuta).
 * Popola l'ecosistema (precondizione #3 della sequenza Maestranze: "≥3 capostipiti
 * attivi con fornitori collegati") e pre-carica le squadre (supplier_team_members),
 * che diventeranno il pool di "Invita la tua squadra" quando arrivera' Maestranze.
 *
 * Login di tutti: giovanni.scozzafava+<slug>@gmail.com / Beta2026!
 *
 * Uso (key NON hardcodata, come seed-baronella):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo-fornitori.mjs
 *
 * Idempotente: rilanciarlo aggiorna, non duplica.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('Manca SUPABASE_SERVICE_ROLE_KEY (env).'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const PWD = 'Beta2026!'
// Capostipiti demo a cui collegare i fornitori (via email di login).
const CAPI = {
  baronella: 'giovanni.scozzafava+baronella@gmail.com',
  tenuta: 'giovanni.scozzafava+tenutadellegrazie@gmail.com',
}

// I 6 fornitori demo. `capi` = a quali capostipiti agganciare la collaborazione ATTIVA.
const FORNITORI = [
  {
    slug: 'lucenord', email: 'giovanni.scozzafava+lucenord@gmail.com',
    full_name: 'Luce Nord Studio', business_name: 'Luce Nord Studio',
    subrole: 'fotografo', city: 'Catanzaro', province: 'CZ', radius: 120,
    bio: 'Fotografia di matrimonio dallo stile editoriale, luce naturale.',
    work_style: 'Reportage discreto + ritratti curati. Due fotografi in coppia, consegna in 30 giorni.',
    capi: ['baronella', 'tenuta'],
    team: [
      { full_name: 'Marco Aiello', role_label: 'Secondo fotografo' },
      { full_name: 'Sara Pugliese', role_label: 'Assistente / backup' },
    ],
  },
  {
    slug: 'ecolive', email: 'giovanni.scozzafava+ecolive@gmail.com',
    full_name: 'Eco Live Band', business_name: 'Eco Live Band',
    subrole: 'musica', city: 'Lamezia Terme', province: 'CZ', radius: 150,
    bio: 'Band dal vivo per cerimonia, aperitivo e festa: dal soul al pop italiano.',
    work_style: 'Formazione modulare 3-7 elementi + DJ set a fine serata. Service audio incluso.',
    capi: ['baronella'],
    team: [
      { full_name: 'Davide Rossi', role_label: 'Voce' },
      { full_name: 'Ilaria Conte', role_label: 'Chitarra' },
      { full_name: 'Peppe Muto', role_label: 'Fonico / Service audio' },
    ],
  },
  {
    slug: 'fioridicalabria', email: 'giovanni.scozzafava+fioridicalabria@gmail.com',
    full_name: 'Fiori di Calabria', business_name: 'Fiori di Calabria',
    subrole: 'fioraio', city: 'Soverato', province: 'CZ', radius: 90,
    bio: 'Allestimenti floreali per matrimoni ed eventi, fiori di stagione a km 0.',
    work_style: 'Progetto floreale su misura, sopralluogo in location, allestimento e disallestimento a nostro carico.',
    capi: ['baronella', 'tenuta'],
    team: [
      { full_name: 'Rosa Belcastro', role_label: 'Flower designer' },
      { full_name: 'Antonio Greco', role_label: 'Allestitore' },
    ],
  },
  {
    slug: 'dolciradici', email: 'giovanni.scozzafava+dolciradici@gmail.com',
    full_name: 'Dolci Radici', business_name: 'Dolci Radici — Wedding Cake',
    subrole: 'pasticcere', city: 'Cosenza', province: 'CS', radius: 110,
    bio: 'Wedding cake e sweet table d\'autore, ingredienti calabresi selezionati.',
    work_style: 'Degustazione preventiva, torte a piani e confettata coordinata al tema.',
    capi: ['tenuta'],
    team: [
      { full_name: 'Chiara Sposato', role_label: 'Cake designer' },
    ],
  },
  {
    slug: 'vanitaatelier', email: 'giovanni.scozzafava+vanitaatelier@gmail.com',
    full_name: 'Vanità Atelier', business_name: 'Vanità Atelier Beauty',
    subrole: 'make_up', city: 'Reggio Calabria', province: 'RC', radius: 130,
    bio: 'Make-up e hair per la sposa e il suo entourage, prova inclusa.',
    work_style: 'Team mobile che raggiunge la location all\'alba; look naturale a lunga tenuta.',
    capi: ['baronella'],
    team: [
      { full_name: 'Federica Nania', role_label: 'Make-up artist' },
      { full_name: 'Luana Ferraro', role_label: 'Hairstylist' },
    ],
  },
  {
    slug: 'daisylab', email: 'giovanni.scozzafava+daisylab@gmail.com',
    full_name: 'DaisyLab_21', business_name: 'DaisyLab_21',
    subrole: 'stampe', city: 'Vibo Valentia', province: 'VV', radius: 200,
    bio: 'Cartoleria d\'evento illustrata a mano: partecipazioni, tableau, menu, ventagli.',
    work_style: 'Progettazione grafica su misura (acquerello + lettering), stampa fine-art e consegna coordinata.',
    capi: ['baronella', 'tenuta'],
    team: [
      { full_name: 'Daisy Romeo', role_label: 'Illustratrice / Titolare' },
      { full_name: 'Gianluca Sestito', role_label: 'Prestampa' },
    ],
  },
]

async function ensureUser(email, password, metadata) {
  for (let page = 1; page < 25; page++) {
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

async function findUserIdByEmail(email) {
  for (let page = 1; page < 25; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users?.length) break
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found.id
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  console.log('\n=== FORNITORI DEMO Planfully ===\n')

  // Risolvi i capostipiti (per collegare le collaborazioni).
  const capiIds = {}
  for (const [k, email] of Object.entries(CAPI)) {
    const id = await findUserIdByEmail(email)
    capiIds[k] = id
    console.log(`Capostipite ${k}: ${id ? id : 'NON TROVATO (salto le sue collaborazioni)'}`)
  }
  console.log('')

  const summary = []
  for (const f of FORNITORI) {
    const u = await ensureUser(f.email, PWD, { role: 'FORNITORE', full_name: f.full_name, subrole: f.subrole })

    const patch = {
      role: 'FORNITORE',
      full_name: f.full_name,
      business_name: f.business_name,
      subrole: f.subrole,
      city: f.city,
      province: f.province,
      service_radius_km: f.radius,
      country: 'Italia',
      is_discoverable: true,
      onboarding_complete: true,
      bio: f.bio,
      work_style: f.work_style,
    }
    const up = await sb.from('profiles').update(patch).eq('id', u.id)
    if (up.error) throw new Error(`profiles ${f.slug}: ${up.error.message}`)

    // Collaborazioni ATTIVE con i capostipiti indicati.
    const capiLinked = []
    for (const capKey of f.capi) {
      const capId = capiIds[capKey]
      if (!capId) continue
      const col = await sb.from('collaborations').upsert({
        capostipite_id: capId, fornitore_id: u.id, status: 'ACTIVE', accepted_at: new Date().toISOString(),
      }, { onConflict: 'capostipite_id,fornitore_id' })
      if (col.error) throw new Error(`collab ${f.slug}->${capKey}: ${col.error.message}`)
      capiLinked.push(capKey)
    }

    // Squadra (idempotente: inserisci solo i membri mancanti per full_name).
    const existing = await sb.from('supplier_team_members').select('full_name').eq('supplier_id', u.id)
    const have = new Set((existing.data ?? []).map((r) => r.full_name))
    const toAdd = f.team.filter((m) => !have.has(m.full_name)).map((m) => ({
      supplier_id: u.id, full_name: m.full_name, role_label: m.role_label, active: true,
    }))
    if (toAdd.length) {
      const ins = await sb.from('supplier_team_members').insert(toAdd)
      if (ins.error) throw new Error(`team ${f.slug}: ${ins.error.message}`)
    }

    console.log(`✓ ${f.full_name} (${f.subrole}) ${u.existed ? '[agg.]' : '[nuovo]'} — collab: ${capiLinked.join(', ') || 'nessuna'} — squadra: ${f.team.length}`)
    summary.push({ nome: f.full_name, subrole: f.subrole, login: f.email })
  }

  console.log('\n=== CREDENZIALI (password: ' + PWD + ') ===')
  for (const s of summary) console.log(`  ${s.nome.padEnd(22)} ${s.subrole.padEnd(12)} ${s.login}`)
  console.log('\nFatto.\n')
}

main().catch((e) => { console.error('ERRORE:', e.message); process.exit(1) })
