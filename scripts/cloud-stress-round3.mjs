#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker/locale/it'

const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M',
  { auth: { persistSession: false } })

const stats = { ok: 0, err: 0 }
async function r(fn) { try { const x = await fn(); if (x?.error) { stats.err++; if (stats.err < 5) console.error('!', x.error.message); return null } stats.ok++; return x?.data ?? x } catch (e) { stats.err++; return null } }

// quote_views (schema reale)
console.log('[1] quote_views...')
const { data: quotes } = await sb.from('quotes').select('id').not('access_token', 'is', null).limit(50)
const VEVENTS = ['OPEN', 'SCROLL', 'ITEM_FOCUS', 'OPEN', 'SCROLL', 'PDF_DOWNLOAD']
for (const q of quotes ?? []) {
  for (let v = 0; v < 6; v++) {
    await r(() => sb.from('quote_views').insert({
      quote_id: q.id,
      event_type: faker.helpers.arrayElement(VEVENTS),
      payload: { delta: faker.number.int({ min: 0, max: 100 }) },
      user_agent: faker.helpers.arrayElement(['Mozilla/5.0 iPhone', 'Mozilla/5.0 Mac', 'Mozilla/5.0 Windows']),
      ip_hash: faker.string.hexadecimal({ length: 16 }),
    }))
  }
}
console.log(`  ${stats.ok} views`)

// contracts (schema reale, status enum)
console.log('\n[2] contracts...')
const before2 = stats.ok
const { data: acc } = await sb.from('quotes').select('id, owner_id, client_name, client_email, event_date, total_client').eq('status', 'ACCETTATO')
for (const q of acc ?? []) {
  await r(() => sb.from('contracts').insert({
    owner_id: q.owner_id, quote_id: q.id,
    title: `Contratto matrimonio ${q.client_name ?? ''}`,
    client_name: q.client_name, client_email: q.client_email, event_date: q.event_date,
    total_amount: q.total_client ?? 0,
    status: faker.helpers.arrayElement(['BOZZA', 'INVIATO', 'FIRMATO']),
    sections: [
      { heading: 'Oggetto del contratto', body: 'Pianificazione e coordinamento del matrimonio.', type: 'CLAUSULE' },
      { heading: 'Compenso', body: `Importo totale ${q.total_client}€ IVA inclusa.`, type: 'PRICE' },
      { heading: 'Modalita` di pagamento', body: 'Acconto 30% alla firma, saldo 7gg prima evento.', type: 'TERMS' },
      { heading: 'Disdetta', body: 'Penale del 50% in caso di disdetta entro 60 gg dall\'evento.', type: 'CLAUSULE' },
    ],
    signed_at: Math.random() > 0.5 ? new Date().toISOString() : null,
  }))
}
console.log(`  ${stats.ok - before2} contracts`)

// event_documents (schema reale)
console.log('\n[3] event_documents...')
const before3 = stats.ok
const { data: weddings } = await sb.from('calendar_entries').select('id, owner_id').like('title', 'Matrimonio%')
const KINDS = ['CONTRATTO', 'FATTURA', 'RICEVUTA', 'PERMESSO', 'LIBERATORIA', 'OTHER']
for (const w of weddings ?? []) {
  for (const k of KINDS) {
    await r(() => sb.from('event_documents').insert({
      entry_id: w.id, kind: k,
      name: `${k}_${faker.lorem.slug(2)}.pdf`,
      storage_path: `entries/${w.id}/${k.toLowerCase()}_${Date.now()}.pdf`,
      size_bytes: faker.number.int({ min: 50_000, max: 3_000_000 }),
      mime: 'application/pdf',
      uploaded_by: w.owner_id,
    }))
  }
}
console.log(`  ${stats.ok - before3} documents`)

console.log(`\n═══════ ROUND 3 STATS ═══════`)
console.log(`OK: ${stats.ok}  ERR: ${stats.err}`)
