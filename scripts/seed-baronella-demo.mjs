#!/usr/bin/env node
/**
 * DEMO per l'account LOCATION "La Baronella".
 * Popola eventi + preventivi (con pagamenti) + fornitori/ordini F&B ricevuti,
 * e rende la PRIMA NOTA live: righe AUTO (entrate da voci preventivo pagate,
 * uscite da ordini F&B ricevuti) + movimenti manuali.
 *
 * Idempotente: azzera SOLO i dati di Baronella (per owner_id) e riseeda.
 *
 * Uso:  SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-baronella-demo.mjs
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('Manca SUPABASE_SERVICE_ROLE_KEY (env).'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const EMAIL = 'giovanni.scozzafava+baronella@gmail.com'
const BARONELLA_ID = 'c117d389-0626-4a9e-8dd4-b2751902df27' // account creato da seed-baronella.mjs
const d = (s) => new Date(s).toISOString()

async function ownerId() {
  const { data, error } = await sb.auth.admin.getUserById(BARONELLA_ID)
  if (error || !data?.user || data.user.email?.toLowerCase() !== EMAIL.toLowerCase()) {
    throw new Error('Account Baronella non trovato: esegui prima seed-baronella.mjs')
  }
  return data.user.id
}

async function wipe(owner) {
  // ordine: prima le figlie/collegate, poi i padri. Filtri stretti su owner.
  await sb.from('prima_nota_entries').delete().eq('owner_id', owner)
  const { data: qs } = await sb.from('quotes').select('id').eq('owner_id', owner)
  for (const q of qs ?? []) await sb.from('quote_items').delete().eq('quote_id', q.id)
  await sb.from('quotes').delete().eq('owner_id', owner)
  const { data: es } = await sb.from('calendar_entries').select('id').eq('owner_id', owner)
  for (const e of es ?? []) await sb.from('calendar_entries_private').delete().eq('entry_id', e.id)
  await sb.from('calendar_entries').delete().eq('owner_id', owner)
  const { data: pos } = await sb.from('fb_purchase_orders').select('id').eq('location_id', owner)
  for (const p of pos ?? []) await sb.from('fb_purchase_order_items').delete().eq('order_id', p.id)
  await sb.from('fb_purchase_orders').delete().eq('location_id', owner)
  await sb.from('fb_suppliers').delete().eq('location_id', owner)
}

// ── Definizione demo ───────────────────────────────────────────────────────
// paid: quota già incassata di quella voce (entra in prima nota); method: come è stata incassata.
const EVENTS = [
  {
    title: 'Matrimonio Rossi & Bruno', kind: 'wedding', date: '2026-05-24', guests: 120,
    entry: 'CONFERMATA', quote: 'ACCETTATO', theme: 'CLASSICO',
    client: 'Marta Rossi & Luca Bruno', email: 'marta.rossi@example.it',
    items: [
      ['Sala e location esclusiva', 'EVENTO', 3500, 1, 3500, 'BONIFICO'],
      ['Menu matrimonio Gold', 'PERSONA', 88, 120, 88 * 120, 'BONIFICO'],
      ['Open bar premium', 'PERSONA', 18, 120, 18 * 120, 'CONTANTI'],
      ['Allestimento floreale sala', 'EVENTO', 1400, 1, 1400, 'BONIFICO'],
    ],
  },
  {
    title: 'Matrimonio Greco & Marra', kind: 'wedding', date: '2026-06-14', guests: 90,
    entry: 'CONFERMATA', quote: 'ACCETTATO', theme: 'GARDEN',
    client: 'Sara Greco & Antonio Marra', email: 'sara.greco@example.it',
    items: [
      ['Sala e giardino', 'EVENTO', 3000, 1, 3000, 'BONIFICO'],
      ['Menu matrimonio Classic', 'PERSONA', 72, 90, 72 * 90, 'BONIFICO'],
      ['Angolo confettata', 'EVENTO', 650, 1, 650, 'CONTANTI'],
    ],
  },
  {
    title: 'Cena aziendale Callipo', kind: 'event', date: '2026-07-05', guests: 80,
    entry: 'CONFERMATA', quote: 'ACCETTATO', theme: null,
    client: 'Callipo S.p.A.', email: 'eventi@callipo.example.it',
    items: [
      ['Sala meeting + cena', 'PERSONA', 55, 80, 55 * 80, 'BONIFICO'],
      ['Service audio/video', 'EVENTO', 800, 1, 800, 'BONIFICO'],
    ],
  },
  {
    title: 'Battesimo Alessandro', kind: 'event', date: '2026-07-20', guests: 60,
    entry: 'CONFERMATA', quote: 'INVIATO', theme: null,
    client: 'Famiglia Perri', email: 'perri.famiglia@example.it',
    // acconto 30% sul menu, sala saldata
    items: [
      ['Sala e allestimento', 'EVENTO', 1200, 1, 1200, 'BONIFICO'],
      ['Menu battesimo', 'PERSONA', 48, 60, Math.round(48 * 60 * 0.3), 'BONIFICO'],
    ],
  },
  {
    title: 'Matrimonio Perri & Sculco', kind: 'wedding', date: '2026-09-13', guests: 150,
    entry: 'OPZIONATA', quote: 'INVIATO', theme: 'ELEGANTE',
    client: 'Giada Perri & Marco Sculco', email: 'giada.perri@example.it',
    // solo acconto di conferma data sulla sala
    items: [
      ['Sala e location esclusiva', 'EVENTO', 4000, 1, 1000, 'BONIFICO'],
      ['Menu matrimonio Gold', 'PERSONA', 92, 150, 0, null],
      ['Open bar premium', 'PERSONA', 20, 150, 0, null],
    ],
  },
]

// Fornitori materie prime + ordini RICEVUTI → uscite auto in prima nota
const FB = [
  { name: 'Ittica dello Stretto', total: 1420, when: '2026-05-20' },
  { name: 'Az. Agricola Sila Bio', total: 680, when: '2026-06-10' },
  { name: 'Cantine Librandi', total: 940, when: '2026-05-22' },
  { name: 'Panificio Aprigliano', total: 310, when: '2026-07-01' },
]

// Movimenti manuali (cassa non tracciata altrove)
const MANUAL = [
  { dir: 'USCITA', amount: 4200, desc: 'Stipendi personale sala — giugno', cat: 'Stipendi', method: 'BONIFICO', date: '2026-06-27' },
  { dir: 'USCITA', amount: 1180, desc: 'Bolletta energia elettrica', cat: 'Utenze', method: 'BONIFICO', date: '2026-06-15' },
  { dir: 'USCITA', amount: 620, desc: 'Fiori e centrotavola (contanti)', cat: 'Acquisti F&B', method: 'CONTANTI', date: '2026-06-13' },
  { dir: 'USCITA', amount: 350, desc: 'Manutenzione giardino', cat: 'Manutenzione', method: 'CONTANTI', date: '2026-06-30' },
  { dir: 'USCITA', amount: 890, desc: 'IMU — acconto', cat: 'Tasse', method: 'BONIFICO', date: '2026-06-16' },
  { dir: 'ENTRATA', amount: 300, desc: 'Mance personale — evento Rossi', cat: 'Mancia', method: 'CONTANTI', date: '2026-05-24' },
  { dir: 'ENTRATA', amount: 450, desc: 'Affitto sala per shooting fotografico', cat: 'Altro', method: 'BONIFICO', date: '2026-06-20' },
]

async function main() {
  console.log('\n=== DEMO LA BARONELLA ===\n')
  const owner = await ownerId()
  console.log('Owner', owner)

  console.log('Azzero dati precedenti di Baronella…')
  await wipe(owner)

  const pnRows = []
  let entrateTot = 0, usciteTot = 0

  // 1) Eventi + preventivi + voci + pagamenti
  for (const ev of EVENTS) {
    const { data: ce, error: e1 } = await sb.from('calendar_entries').insert({
      owner_id: owner, title: ev.title, date_from: ev.date, date_to: ev.date,
      status: ev.entry, guest_count: ev.guests, event_kind: ev.kind, theme: ev.theme,
    }).select().single()
    if (e1) throw e1
    await sb.from('calendar_entries_private').insert({
      entry_id: ce.id, client_name: ev.client, client_email: ev.email,
      notes: `Evento presso La Baronella — ${ev.guests} coperti.`,
      value_amount: ev.items.reduce((s, [, , price, qty]) => s + price * qty, 0),
    })

    const { data: q, error: e2 } = await sb.from('quotes').insert({
      owner_id: owner, title: ev.title, client_name: ev.client, client_email: ev.email,
      event_date: ev.date, guest_count: ev.guests, status: ev.quote,
      default_markup_percent: 0, event_location: 'La Baronella', event_kind: ev.kind,
      sent_at: d(ev.date + 'T09:00:00'),
      accepted_at: ev.quote === 'ACCETTATO' ? d(ev.date + 'T10:00:00') : null,
    }).select().single()
    if (e2) throw e2
    await sb.from('calendar_entries').update({ quote_id: q.id }).eq('id', ce.id)

    let subtotal = 0, cost = 0, sort = 0
    for (const [name, unit, price, qty, paid, method] of ev.items) {
      const lineClient = price * qty
      const lineCost = Math.round(lineClient * 0.58)
      subtotal += lineClient; cost += lineCost
      const status = paid <= 0 ? 'NON_PAGATO' : paid >= lineClient ? 'SALDATO' : 'ACCONTO'
      const { data: qi, error: e3 } = await sb.from('quote_items').insert({
        quote_id: q.id, service_id: null, supplier_id: null,
        name_snapshot: name, unit_snapshot: unit, snapshot_price: price, quantity: qty,
        line_client: lineClient, line_cost: lineCost, sort_order: sort++,
        payment_status: status, paid_amount: paid,
        paid_at: paid > 0 ? d(ev.date + 'T12:00:00') : null,
        payment_method: paid > 0 ? method : null,
      }).select().single()
      if (e3) throw e3

      // ENTRATA auto in prima nota (stessa chiave del RPC prima_nota_sync)
      if (paid > 0) {
        entrateTot += paid
        pnRows.push({
          owner_id: owner, entry_date: ev.date, direction: 'ENTRATA', amount: paid,
          description: `${ev.client} — ${name}`, category: 'Incasso preventivo',
          method, event_id: ce.id, source: 'QUOTE_ITEM', source_ref_id: qi.id,
        })
      }
    }
    // totali preventivo coerenti
    await sb.from('quotes').update({
      total_cost: cost, subtotal_client: subtotal, total_client: subtotal,
      margin_amount: subtotal - cost, margin_percent: subtotal ? Math.round(((subtotal - cost) / subtotal) * 100) : 0,
    }).eq('id', q.id)
    console.log(`  ✓ ${ev.title} (${ev.items.length} voci, incassato ${ev.items.reduce((s, [, , , , p]) => s + (p > 0 ? p : 0), 0)}€)`)
  }

  // 2) Fornitori F&B + ordini RICEVUTI → uscite auto
  for (const f of FB) {
    const { data: sup, error: e4 } = await sb.from('fb_suppliers').insert({
      location_id: owner, name: f.name, is_active: true,
    }).select().single()
    if (e4) throw e4
    const { data: po, error: e5 } = await sb.from('fb_purchase_orders').insert({
      location_id: owner, supplier_id: sup.id, status: 'RICEVUTO',
      expected_date: f.when, total_cost: f.total,
    }).select().single()
    if (e5) throw e5
    usciteTot += f.total
    pnRows.push({
      owner_id: owner, entry_date: f.when, direction: 'USCITA', amount: f.total,
      description: `Ordine materie prime — ${f.name}`, category: 'Acquisti F&B',
      source: 'FB_PO', source_ref_id: po.id,
    })
    console.log(`  ✓ F&B ${f.name} — ordine RICEVUTO ${f.total}€`)
  }

  // 3) Movimenti manuali
  for (const m of MANUAL) {
    if (m.dir === 'ENTRATA') entrateTot += m.amount; else usciteTot += m.amount
    pnRows.push({
      owner_id: owner, entry_date: m.date, direction: m.dir, amount: m.amount,
      description: m.desc, category: m.cat, method: m.method, source: 'MANUAL',
    })
  }

  // 4) Scrivo la prima nota (live da subito)
  const { error: e6 } = await sb.from('prima_nota_entries').insert(pnRows)
  if (e6) throw e6

  console.log(`\n═══ DEMO PRONTA ═══`)
  console.log(`Prima nota: ${pnRows.length} movimenti`)
  console.log(`  Entrate: ${entrateTot.toLocaleString('it-IT')}€`)
  console.log(`  Uscite:  ${usciteTot.toLocaleString('it-IT')}€`)
  console.log(`  Saldo:   ${(entrateTot - usciteTot).toLocaleString('it-IT')}€`)
  console.log(`\nLogin: ${EMAIL} / Beta2026!  →  /prima-nota\n`)
}

main().catch((e) => { console.error('ERR', e); process.exit(1) })
