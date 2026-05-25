// Wave 2 - Agent N - Storage + Data Integrity audit (READ-ONLY, no DELETE)
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SUPA_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'

const OUT_DIR = process.env.OUT_DIR ?? '/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave2-N-data-integrity-20260525-225942'
mkdirSync(OUT_DIR, { recursive: true })

const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

const stats = { startedAt: new Date().toISOString() }
const violations = []
const cleanupCandidates = []
const storageStats = {}

function log(...a) { console.log(...a) }
function pushV(area, severity, msg, sample) {
  violations.push({ area, severity, msg, sample: sample ?? null, ts: new Date().toISOString() })
  log(`[${severity}] (${area}) ${msg}`)
}

// =============== 1. STORAGE BUCKETS AUDIT ===============
async function auditStorage() {
  log('\n=== 1. Storage buckets audit ===')
  const bucketList = ['service-photos', 'brand-assets', 'quote-pdfs', 'quote-signatures', 'event-documents']
  let allBuckets = []
  try {
    const { data, error } = await sb.storage.listBuckets()
    if (!error && data) {
      allBuckets = data.map(b => b.name)
      storageStats.bucketsMeta = data.map(b => ({ name: b.name, public: b.public, file_size_limit: b.file_size_limit, allowed_mime_types: b.allowed_mime_types }))
    }
  } catch (e) {}
  storageStats.discoveredBuckets = allBuckets
  for (const name of bucketList) {
    storageStats[name] = { exists: allBuckets.includes(name), files: 0, totalSizeBytes: 0, mimeTypes: {}, errors: [], sample: [], paths: [] }
    if (!allBuckets.includes(name)) {
      pushV('storage', 'MEDIUM', `Bucket missing/not visible: ${name}`)
      continue
    }
    async function listFolder(prefix, depth = 0) {
      if (depth > 5) return
      try {
        const { data, error } = await sb.storage.from(name).list(prefix, { limit: 1000, offset: 0 })
        if (error) { storageStats[name].errors.push(`${prefix}: ${error.message}`); return }
        for (const it of data ?? []) {
          if (it.id === null && it.name && !it.metadata) {
            const subPrefix = prefix ? `${prefix}/${it.name}` : it.name
            await listFolder(subPrefix, depth + 1)
          } else {
            storageStats[name].files++
            const size = it.metadata?.size ?? 0
            storageStats[name].totalSizeBytes += size
            const mt = it.metadata?.mimetype ?? 'unknown'
            storageStats[name].mimeTypes[mt] = (storageStats[name].mimeTypes[mt] ?? 0) + 1
            const fullPath = prefix ? `${prefix}/${it.name}` : it.name
            storageStats[name].paths.push(fullPath)
            if (storageStats[name].sample.length < 5) {
              storageStats[name].sample.push({ path: fullPath, size, mime: mt })
            }
          }
        }
      } catch (e) { storageStats[name].errors.push(`${prefix}: ${e.message}`) }
    }
    await listFolder('')
    storageStats[name].totalSizeMB = +(storageStats[name].totalSizeBytes / 1024 / 1024).toFixed(2)
    log(`  ${name}: ${storageStats[name].files} files, ${storageStats[name].totalSizeMB} MB`)
  }

  // DB references — check files referenced in DB
  const dbRefs = {}
  // quote-pdfs: quotes.pdf_url
  try {
    const { data, count } = await sb.from('quotes').select('id,pdf_url', { count: 'exact', head: false }).not('pdf_url', 'is', null).limit(1000)
    dbRefs['quotes.pdf_url'] = { count, urls: (data ?? []).map(r => r.pdf_url) }
  } catch (e) { dbRefs['quotes.pdf_url'] = { error: e.message } }
  // contracts.pdf_url
  try {
    const { data, count } = await sb.from('contracts').select('id,pdf_url', { count: 'exact', head: false }).not('pdf_url', 'is', null).limit(1000)
    dbRefs['contracts.pdf_url'] = { count, urls: (data ?? []).map(r => r.pdf_url) }
  } catch (e) { dbRefs['contracts.pdf_url'] = { error: e.message } }
  // profiles brand assets
  for (const col of ['logo_url', 'cover_url', 'avatar_url']) {
    try {
      const { data, count } = await sb.from('profiles').select(`id,${col}`, { count: 'exact', head: false }).not(col, 'is', null).limit(1000)
      dbRefs[`profiles.${col}`] = { count, sample: (data ?? []).slice(0, 5) }
    } catch (e) { dbRefs[`profiles.${col}`] = { error: e.message } }
  }
  // service photos
  for (const tbl of ['service_photos', 'services']) {
    for (const col of ['url', 'photo_url', 'photos']) {
      try {
        const { data, count } = await sb.from(tbl).select(`id,${col}`, { count: 'exact', head: false }).not(col, 'is', null).limit(20)
        dbRefs[`${tbl}.${col}`] = { count, sample: (data ?? []).slice(0, 3) }
      } catch (e) { /* ignore missing col */ }
    }
  }
  // event_documents.url
  for (const col of ['url', 'file_url', 'document_url']) {
    try {
      const { data, count } = await sb.from('event_documents').select(`id,${col}`, { count: 'exact', head: false }).not(col, 'is', null).limit(20)
      dbRefs[`event_documents.${col}`] = { count, sample: (data ?? []).slice(0, 3) }
    } catch (e) {}
  }
  storageStats.dbRefs = dbRefs

  // Cross-check: orphan files (storage but no DB ref) — naive heuristic: for quote-pdfs, every file should appear in quotes.pdf_url
  function extractStoragePath(url) {
    if (!url) return null
    const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/)
    return m ? m[1] : url
  }
  const orphans = {}
  // quote-pdfs orphans
  const quotePdfPaths = new Set(storageStats['quote-pdfs'].paths.map(p => `quote-pdfs/${p}`))
  const referencedQuotePdfs = new Set((dbRefs['quotes.pdf_url']?.urls ?? []).map(extractStoragePath).filter(Boolean))
  const orphanQuotePdfs = [...quotePdfPaths].filter(p => ![...referencedQuotePdfs].some(r => r === p || r.endsWith(p.split('/').pop())))
  const missingQuotePdfs = [...referencedQuotePdfs].filter(r => ![...quotePdfPaths].some(p => r === p || r.endsWith(p.split('/').pop())))
  orphans['quote-pdfs'] = { orphansInStorage: orphanQuotePdfs.length, sampleOrphans: orphanQuotePdfs.slice(0, 10), missingInStorage: missingQuotePdfs.length, sampleMissing: missingQuotePdfs.slice(0, 10) }
  if (orphanQuotePdfs.length > 10) pushV('storage', 'MEDIUM', `quote-pdfs storage has ${orphanQuotePdfs.length} files not referenced by quotes.pdf_url`)
  else if (orphanQuotePdfs.length) pushV('storage', 'LOW', `quote-pdfs has ${orphanQuotePdfs.length} orphan files`)
  if (missingQuotePdfs.length) pushV('storage', missingQuotePdfs.length > 5 ? 'HIGH' : 'MEDIUM', `quotes.pdf_url references ${missingQuotePdfs.length} files MISSING in storage`, missingQuotePdfs.slice(0, 5))

  storageStats.orphanReport = orphans
}

// =============== 2. SCHEMA INTEGRITY ===============
async function auditIntegrity() {
  log('\n=== 2. Schema integrity ===')

  // 2.1 quotes total_client < total_cost
  try {
    const { data, error } = await sb.from('quotes').select('id,total_client,total_cost,status,owner_id,title,margin_amount,margin_percent').limit(5000)
    if (error) pushV('integrity', 'HIGH', `quotes select error: ${error.message}`)
    else {
      const bad = (data ?? []).filter(q => q.total_client != null && q.total_cost != null && Number(q.total_client) < Number(q.total_cost))
      const zero = (data ?? []).filter(q => Number(q.total_client) === 0 && Number(q.total_cost) === 0)
      if (bad.length) pushV('integrity', bad.length > 10 ? 'HIGH' : 'MEDIUM', `quotes with total_client < total_cost (negative margin): ${bad.length}`, bad.slice(0, 5))
      stats.quotesScanned = (data ?? []).length
      stats.quotesNegMargin = bad.length
      stats.quotesZero = zero.length
    }
  } catch (e) { pushV('integrity', 'HIGH', `quotes scan failed: ${e.message}`) }

  // 2.2 quote_items line_client = snapshot_price * quantity (after markup)
  try {
    const { data, error } = await sb.from('quote_items').select('id,quote_id,snapshot_price,quantity,line_client,line_cost,item_markup_percent').limit(10000)
    if (error) pushV('integrity', 'HIGH', `quote_items select error: ${error.message}`)
    else {
      // Without item-level markup, line_cost = snapshot_price * quantity (per migration: 20260521150700)
      const costMismatch = (data ?? []).filter(i => i.snapshot_price != null && i.quantity != null && i.line_cost != null && Math.abs(Number(i.snapshot_price) * Number(i.quantity) - Number(i.line_cost)) > 0.05)
      // line_client must be >= line_cost
      const clientLessCost = (data ?? []).filter(i => i.line_client != null && i.line_cost != null && Number(i.line_client) < Number(i.line_cost) - 0.05)
      if (costMismatch.length) pushV('integrity', costMismatch.length > 10 ? 'HIGH' : 'MEDIUM', `quote_items line_cost mismatch snapshot_price*qty: ${costMismatch.length}`, costMismatch.slice(0, 5))
      if (clientLessCost.length) pushV('integrity', clientLessCost.length > 10 ? 'HIGH' : 'MEDIUM', `quote_items line_client < line_cost (loss-margin row): ${clientLessCost.length}`, clientLessCost.slice(0, 5))
      stats.quoteItemsScanned = (data ?? []).length
      stats.quoteItemsCostMismatch = costMismatch.length
      stats.quoteItemsClientLossMargin = clientLessCost.length
    }
  } catch (e) { pushV('integrity', 'HIGH', `quote_items scan failed: ${e.message}`) }

  // 2.3 calendar_entries with value_amount but quote_id null
  try {
    const { data, error } = await sb.from('calendar_entries').select('id,title,value_amount,quote_id,owner_id,status').not('value_amount', 'is', null).is('quote_id', null).limit(2000)
    if (error) pushV('integrity', 'MEDIUM', `calendar_entries scan err: ${error.message}`)
    else {
      if ((data ?? []).length) pushV('integrity', data.length > 50 ? 'MEDIUM' : 'LOW', `calendar_entries with value_amount but no quote_id: ${data.length}`, data.slice(0, 5))
      stats.calendarValueNoQuote = data.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `calendar_entries scan failed: ${e.message}`) }

  // 2.4 wedding_couple_members
  try {
    const { data, error } = await sb.from('wedding_couple_members').select('id,user_id,accepted_at,role,entry_id').not('accepted_at', 'is', null).is('user_id', null).limit(500)
    if (error) pushV('integrity', 'MEDIUM', `wedding_couple_members scan err: ${error.message}`)
    else {
      if ((data ?? []).length) pushV('integrity', data.length > 10 ? 'HIGH' : 'MEDIUM', `wedding_couple_members accepted but user_id NULL: ${data.length}`, data.slice(0, 5))
      stats.couplesAcceptedNoUser = data.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `wedding_couple_members scan failed: ${e.message}`) }

  // 2.5 supplier_invites expired but PENDING
  try {
    const now = new Date().toISOString()
    const { data, error } = await sb.from('supplier_invites').select('id,status,expires_at,email,capostipite_id').eq('status', 'PENDING').lt('expires_at', now).limit(500)
    if (error) pushV('integrity', 'MEDIUM', `supplier_invites scan err: ${error.message}`)
    else {
      if ((data ?? []).length) pushV('integrity', data.length > 10 ? 'HIGH' : 'MEDIUM', `supplier_invites PENDING but expired: ${data.length}`, data.slice(0, 5))
      stats.supplierInvitesStalePending = data.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `supplier_invites scan failed: ${e.message}`) }

  // 2.6 event_guests with table_id pointing to missing event_tables
  try {
    const { data: guests, error: e1 } = await sb.from('event_guests').select('id,table_id,entry_id').not('table_id', 'is', null).limit(10000)
    if (e1) pushV('integrity', 'MEDIUM', `event_guests scan err: ${e1.message}`)
    else {
      const tableIds = [...new Set((guests ?? []).map(g => g.table_id))]
      if (tableIds.length) {
        const { data: tables, error: e2 } = await sb.from('event_tables').select('id').in('id', tableIds)
        if (e2) pushV('integrity', 'MEDIUM', `event_tables lookup err: ${e2.message}`)
        else {
          const present = new Set((tables ?? []).map(t => t.id))
          const orphans = (guests ?? []).filter(g => !present.has(g.table_id))
          if (orphans.length) pushV('integrity', orphans.length > 10 ? 'HIGH' : 'MEDIUM', `event_guests.table_id -> missing event_tables: ${orphans.length}`, orphans.slice(0, 5))
          stats.guestsOrphanTable = orphans.length
          stats.guestsScanned = guests.length
        }
      } else stats.guestsOrphanTable = 0
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `event_guests FK test failed: ${e.message}`) }

  // 2.7 supplier_availability date < cutoff (using fornitore_id column)
  try {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const { data, error, count } = await sb.from('supplier_availability').select('id,date,fornitore_id,status', { count: 'exact', head: false }).lt('date', cutoff).limit(5)
    if (error) pushV('integrity', 'LOW', `supplier_availability scan err: ${error.message}`)
    else {
      if ((count ?? 0) > 0) pushV('integrity', count > 100 ? 'MEDIUM' : 'LOW', `supplier_availability rows older than 30 days (cleanup candidate): ${count}`, data?.slice(0, 5))
      stats.supplierAvailOldCount = count
    }
  } catch (e) { pushV('integrity', 'LOW', `supplier_availability scan failed: ${e.message}`) }

  // 2.8 quotes ACCETTATO but accepted_at NULL
  try {
    const { data, error } = await sb.from('quotes').select('id,status,accepted_at,owner_id,title').eq('status', 'ACCETTATO').is('accepted_at', null).limit(500)
    if (error) pushV('integrity', 'MEDIUM', `quotes accepted scan err: ${error.message}`)
    else {
      if ((data ?? []).length) pushV('integrity', data.length > 10 ? 'HIGH' : 'MEDIUM', `quotes ACCETTATO but accepted_at NULL: ${data.length}`, data.slice(0, 5))
      stats.quoteAcceptedNoTs = data.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `quote accepted scan failed: ${e.message}`) }

  // 2.9 contracts FIRMATO but signed_at NULL or signature_data NULL
  try {
    const { data, error } = await sb.from('contracts').select('id,status,signed_at,signature_data,owner_id,title').eq('status', 'FIRMATO').limit(500)
    if (error) pushV('integrity', 'MEDIUM', `contracts scan err: ${error.message}`)
    else {
      const bad = (data ?? []).filter(c => !c.signed_at || !c.signature_data)
      if (bad.length) pushV('integrity', bad.length > 10 ? 'HIGH' : 'MEDIUM', `contracts FIRMATO with missing signed_at/signature_data: ${bad.length}`, bad.slice(0, 5))
      stats.contractsSignedNoData = bad.length
      stats.contractsFirmatoTotal = (data ?? []).length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `contracts scan failed: ${e.message}`) }

  // 2.10 BONUS — quote_items with quote_id not in quotes table
  try {
    const { data: items, error } = await sb.from('quote_items').select('id,quote_id').limit(10000)
    if (!error && items?.length) {
      const qids = [...new Set(items.map(i => i.quote_id))]
      const { data: qs } = await sb.from('quotes').select('id').in('id', qids)
      const present = new Set((qs ?? []).map(q => q.id))
      const orphans = items.filter(i => !present.has(i.quote_id))
      if (orphans.length) pushV('integrity', 'HIGH', `quote_items orphan (no parent quote): ${orphans.length}`, orphans.slice(0, 5))
      stats.quoteItemsOrphans = orphans.length
    }
  } catch (e) {}

  // 2.11 BONUS — contracts.quote_id pointing to missing quotes
  try {
    const { data: cs, error } = await sb.from('contracts').select('id,quote_id').not('quote_id', 'is', null).limit(5000)
    if (!error && cs?.length) {
      const qids = [...new Set(cs.map(i => i.quote_id))]
      const { data: qs } = await sb.from('quotes').select('id').in('id', qids)
      const present = new Set((qs ?? []).map(q => q.id))
      const orphans = cs.filter(i => !present.has(i.quote_id))
      if (orphans.length) pushV('integrity', orphans.length > 5 ? 'HIGH' : 'MEDIUM', `contracts.quote_id -> missing quotes: ${orphans.length}`, orphans.slice(0, 5))
      stats.contractsOrphanQuoteRef = orphans.length
    }
  } catch (e) {}
}

// =============== 7. TEST DATA RESIDUE ===============
async function auditTestData() {
  log('\n=== 7. Test data residue ===')
  const checks = [
    { table: 'profiles', col: 'email', patterns: ['%test%', '%demo%', '%agent-%', '%@example.%', '%planfully-demo%', '%@playwright%'] },
    { table: 'profiles', col: 'full_name', patterns: ['Test %', 'TEST %', 'Demo %', 'AGENT-%', 'TMP %', 'Playwright%'] },
    { table: 'calendar_entries', col: 'title', patterns: ['AGENT-%', 'TEST %', 'TMP %', 'Test %', 'Demo %'] },
    { table: 'calendar_entries', col: 'client_name', patterns: ['Test %', 'TEST %', 'Demo %', 'AGENT-%'] },
    { table: 'quotes', col: 'title', patterns: ['AGENT-%', 'TEST %', 'TMP %', 'Test %', 'Demo %', '%playwright%'] },
    { table: 'quotes', col: 'client_name', patterns: ['Test %', 'TEST %', 'Demo %', 'AGENT-%'] },
    { table: 'services', col: 'name', patterns: ['AGENT-%', 'TEST %', 'Test %', 'TMP %'] },
    { table: 'contracts', col: 'title', patterns: ['AGENT-%', 'TEST %', 'TMP %', 'Test %', 'Demo %'] },
  ]
  for (const c of checks) {
    for (const p of c.patterns) {
      try {
        const { data, error, count } = await sb.from(c.table).select(`id,${c.col}`, { count: 'exact', head: false }).ilike(c.col, p).limit(5)
        if (error) continue
        if ((count ?? 0) > 0) {
          cleanupCandidates.push({ table: c.table, column: c.col, pattern: p, count, sample: data })
          log(`  ${c.table}.${c.col} ILIKE '${p}' -> ${count}`)
        }
      } catch (e) {}
    }
  }
  if (cleanupCandidates.length > 10) pushV('cleanup', 'MEDIUM', `Large amount of test/demo residue: ${cleanupCandidates.length} pattern hits`)
  else if (cleanupCandidates.length) pushV('cleanup', 'LOW', `Test/demo residue patterns: ${cleanupCandidates.length}`)
}

// =============== 5. AUDIT LOG (created_at/updated_at) — parse from migrations ===============
function auditTimestampsFromMigrations() {
  log('\n=== 5. Audit log integrity (from migrations) ===')
  const migDir = '/Users/giovanniscozzafava/Repository/wedding-platform/supabase/migrations'
  const files = readdirSync(migDir).filter(f => f.endsWith('.sql')).sort()
  const allSql = files.map(f => readFileSync(join(migDir, f), 'utf8')).join('\n')

  // Find tables
  const tableRe = /create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi
  const tables = {}
  let m
  while ((m = tableRe.exec(allSql)) !== null) {
    const name = m[1]; const body = m[2]
    if (name === 'set_updated_at') continue
    tables[name] = { hasCreatedAt: /\bcreated_at\b/i.test(body), hasUpdatedAt: /\bupdated_at\b/i.test(body) }
  }

  // Find triggers calling set_updated_at — handle multiline
  const trgRe = /create trigger\s+\w+\s+before update\s+on\s+(?:public\.)?(\w+)[^;]*?set_updated_at/gi
  const triggerTables = new Set()
  while ((m = trgRe.exec(allSql)) !== null) triggerTables.add(m[1])

  const missingCreated = Object.entries(tables).filter(([_, v]) => !v.hasCreatedAt).map(([k]) => k)
  const withUpdated = Object.entries(tables).filter(([_, v]) => v.hasUpdatedAt).map(([k]) => k)
  const missingTrigger = withUpdated.filter(t => !triggerTables.has(t))

  storageStats.timestamps = {
    tables: Object.keys(tables).length,
    missingCreatedAt: missingCreated,
    withUpdatedAt: withUpdated.length,
    tablesWithUpdatedAtTrigger: [...triggerTables],
    tablesUpdatedAtNoTrigger: missingTrigger,
  }
  if (missingCreated.length) pushV('audit', missingCreated.length > 5 ? 'MEDIUM' : 'LOW', `Tables without created_at: ${missingCreated.length}`, missingCreated)
  if (missingTrigger.length) pushV('audit', missingTrigger.length > 5 ? 'MEDIUM' : 'LOW', `Tables with updated_at but NO set_updated_at trigger (from migrations): ${missingTrigger.length}`, missingTrigger.slice(0, 15))
  log(`  ${Object.keys(tables).length} tables; missing created_at: ${missingCreated.length}; updated_at w/o trigger: ${missingTrigger.length}`)
}

async function main() {
  try { await auditStorage() } catch (e) { pushV('storage', 'HIGH', `storage audit crashed: ${e.message}`) }
  try { await auditIntegrity() } catch (e) { pushV('integrity', 'HIGH', `integrity audit crashed: ${e.message}`) }
  try { auditTimestampsFromMigrations() } catch (e) { pushV('audit', 'LOW', `timestamps audit crashed: ${e.message}`) }
  try { await auditTestData() } catch (e) { pushV('cleanup', 'LOW', `testdata audit crashed: ${e.message}`) }

  stats.endedAt = new Date().toISOString()
  writeFileSync(join(OUT_DIR, 'integrity-violations.json'), JSON.stringify({ stats, violations }, null, 2))
  writeFileSync(join(OUT_DIR, 'storage-stats.json'), JSON.stringify(storageStats, null, 2))
  writeFileSync(join(OUT_DIR, 'cleanup-candidates.json'), JSON.stringify(cleanupCandidates, null, 2))
  log(`\nDONE. Violations: ${violations.length}. Cleanup candidates: ${cleanupCandidates.length}.`)
  log(`Output: ${OUT_DIR}`)
}

await main()
