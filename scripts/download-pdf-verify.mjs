import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV'
const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })
const fornFoto = '747707fe-03be-4bb8-95b8-17b43b465526'

const date = '2027-06-12'
const { data: sc } = await admin.from('supplier_clients').insert({
  supplier_id: fornFoto,
  full_name: 'Cliente PDF Test (E2E-TEST-VERIFY)',
  email: 'pdf.test@example.com',
  event_date: date, location_text: 'Casale Roma', status: 'TRATTATIVA',
}).select().single()
const { data: q } = await admin.from('quotes').insert({
  owner_id: fornFoto, direct_client_id: sc.id,
  title: 'E2E-TEST-VERIFY PDF C',
  client_name: 'Famiglia Rossi', client_email: 'pdf.test@example.com',
  event_date: date, event_location: 'Casale Roma',
  status: 'BOZZA', guest_count: 80, total_client: 2010, total_cost: 2010,
}).select().single()
for (const [name, price, qty] of [['Cerimonia fotografica',1200,1],['Album premium',450,1],['Stampe extra',12,30]]) {
  await admin.from('quote_items').insert({
    quote_id: q.id, supplier_id: fornFoto,
    name_snapshot: name, snapshot_price: price, quantity: qty,
    line_cost: price*qty, line_client: price*qty,
  })
}
const r = await fetch(`${SUPA_URL}/functions/v1/quote-generate-pdf`, {
  method:'POST', headers: { authorization: `Bearer ${SERVICE_KEY}`, 'content-type':'application/json' },
  body: JSON.stringify({ quote_id: q.id, variant: 'NEUTRA' }),
})
const j = await r.json()
console.log('PDF resp keys:', Object.keys(j).join(','))

const outDir = process.argv[2] || '/tmp'
mkdirSync(outDir, { recursive: true })
const pdfPath = path.join(outDir, 'scenario-C-quote.pdf')
const pdfResp = await fetch(j.url)
const buf = Buffer.from(await pdfResp.arrayBuffer())
writeFileSync(pdfPath, buf)
console.log('PDF size:', buf.length, '→', pdfPath)

const pdfParseMod = await import('pdf-parse/lib/pdf-parse.js')
const pdfParse = pdfParseMod.default
const parsed = await pdfParse(buf)
const txt = parsed.text
writeFileSync(pdfPath.replace('.pdf','.txt'), txt)
console.log('\n--- TEXT EXTRACT ---\n' + txt + '\n--- END ---\n')

const checks = {
  hasFornitoreBrand: /Marco Bianchi Photography/i.test(txt),
  hasFornitoreName: /Marco Bianchi/i.test(txt),
  hasWpName: /Sara De Luca/i.test(txt),
  hasWpBrand: /Beta Wedding Studio/i.test(txt),
  hasWeddingPlanner: /Wedding planner/i.test(txt),
  hasFotografo: /fotografo/i.test(txt),
  hasFornitoreLabel: /Fornitore/.test(txt),
}
console.log('CHECKS:', JSON.stringify(checks, null, 2))

await admin.from('quotes').delete().eq('id', q.id)
await admin.from('supplier_clients').delete().eq('id', sc.id)
