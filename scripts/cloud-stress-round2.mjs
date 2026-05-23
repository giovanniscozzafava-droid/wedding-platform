#!/usr/bin/env node
/**
 * Round 2 stress: notification_queue, price_versions multi, mood extra,
 * service_photos extra (gallery completa), quote_views (visite cliente al preventivo),
 * contracts (firme), event_documents.
 */
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker/locale/it'

const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M',
  { auth: { persistSession: false } })

const stats = { ok: 0, err: 0 }
async function run(fn) {
  try { const r = await fn(); if (r?.error) { stats.err++; console.error('  !', r.error.message); return null } stats.ok++; return r?.data ?? r } catch (e) { stats.err++; console.error('  !', e.message); return null }
}

// === Notification queue ====================================================
console.log('[1] Notification queue...')
const { data: users } = await sb.from('profiles').select('id, role').limit(50)
const EVENTS = ['wedding_created', 'wedding_status_changed', 'quote_sent', 'quote_accepted', 'reminder_30_days', 'reminder_7_days', 'task_due', 'supplier_collab_invite']
for (const u of users) {
  for (let n = 0; n < 4; n++) {
    await run(() => sb.from('notification_queue').insert({
      user_id: u.id,
      event_type: faker.helpers.arrayElement(EVENTS),
      payload: { title: faker.lorem.sentence(5), at: new Date().toISOString() },
      scheduled_for: new Date(Date.now() - faker.number.int({ min: -7, max: 30 }) * 86400000).toISOString(),
      sent_at: Math.random() > 0.5 ? new Date().toISOString() : null,
      attempts: Math.random() > 0.7 ? 1 : 0,
    }))
  }
}
console.log(`  ✓ ${stats.ok} notifications`)

// === Price versions (history) ==============================================
console.log('\n[2] Price versions...')
const baseOk = stats.ok
const { data: svcs } = await sb.from('services').select('id, base_price')
for (const s of svcs.slice(0, 30)) {
  // 2 vecchie price_versions
  await run(() => sb.from('price_versions').insert([
    { service_id: s.id, price: Number(s.base_price) * 0.85, valid_from: new Date(Date.now() - 365 * 86400000).toISOString(), valid_until: new Date(Date.now() - 180 * 86400000).toISOString() },
    { service_id: s.id, price: Number(s.base_price) * 0.92, valid_from: new Date(Date.now() - 180 * 86400000).toISOString(), valid_until: new Date(Date.now() - 30 * 86400000).toISOString() },
  ]))
}
console.log(`  ✓ ${stats.ok - baseOk} prince_version inserts`)

// === Quote views (visite cliente al preventivo) ============================
console.log('\n[3] Quote views...')
const before3 = stats.ok
const { data: quotes } = await sb.from('quotes').select('id, access_token').not('access_token', 'is', null)
for (const q of quotes ?? []) {
  for (let v = 0; v < 4; v++) {
    await run(() => sb.from('quote_views').insert({
      quote_id: q.id,
      ip_hash: faker.string.hexadecimal({ length: 16 }),
      user_agent: faker.helpers.arrayElement(['Mozilla/5.0 iPhone', 'Mozilla/5.0 Mac', 'Mozilla/5.0 Windows']),
      viewed_at: new Date(Date.now() - v * 86400000).toISOString(),
    }))
  }
}
console.log(`  ✓ ${stats.ok - before3} quote_views`)

// === Contracts ============================================================
console.log('\n[4] Contracts (su preventivi ACCETTATO)...')
const before4 = stats.ok
const { data: acceptedQuotes } = await sb.from('quotes').select('id, owner_id, client_name, client_email, total_client').eq('status', 'ACCETTATO').limit(40)
for (const q of acceptedQuotes ?? []) {
  await run(() => sb.from('contracts').insert({
    quote_id: q.id, owner_id: q.owner_id,
    title: `Contratto ${q.client_name ?? 'cliente'}`,
    pdf_url: 'https://placeholder/contract.pdf',
    sent_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    signed_at: Math.random() > 0.5 ? new Date(Date.now() - 7 * 86400000).toISOString() : null,
    client_signature_name: q.client_name ?? 'Cliente',
    deposit_amount: Number(q.total_client) * 0.3,
    deposit_paid: Math.random() > 0.4,
  }))
}
console.log(`  ✓ ${stats.ok - before4} contracts`)

// === Event documents (file finti per ogni wedding) ========================
console.log('\n[5] Event documents...')
const before5 = stats.ok
const { data: weddings } = await sb.from('calendar_entries').select('id, owner_id').like('title', 'Matrimonio%')
const DOC_KINDS = ['CONTRATTO', 'PERMESSO', 'PLANIMETRIA', 'MENU', 'PROGRAMMA_DETTAGLIATO', 'ASSICURAZIONE']
for (const w of weddings ?? []) {
  for (const kind of DOC_KINDS) {
    await run(() => sb.from('event_documents').insert({
      entry_id: w.id, owner_id: w.owner_id, kind,
      title: `${kind} — ${faker.lorem.words(3)}`,
      file_url: `https://placeholder/${kind.toLowerCase()}.pdf`,
      file_size_kb: faker.number.int({ min: 50, max: 2500 }),
    }))
  }
}
console.log(`  ✓ ${stats.ok - before5} documents`)

console.log(`\n\n═══════ ROUND 2 STATS ═══════`)
console.log(`OK:  ${stats.ok}`)
console.log(`ERR: ${stats.err}`)
