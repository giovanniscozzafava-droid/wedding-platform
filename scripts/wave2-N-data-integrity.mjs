// Wave 2 - Agent N - Storage + Data Integrity audit (READ-ONLY, no DELETE)
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
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

// helper: run RPC for arbitrary SQL via pg fn 'exec_sql' if exists, else fall back
async function runSql(sql) {
  // try generic SQL via raw rpc names commonly present in scripts
  for (const fn of ['exec_sql', 'sql_exec', 'pg_exec']) {
    try {
      const r = await sb.rpc(fn, { query: sql })
      if (!r.error) return { rows: r.data, fn }
    } catch (_) { /* try next */ }
  }
  return { error: 'no_exec_sql_rpc' }
}

// =============== 1. STORAGE BUCKETS AUDIT ===============
async function auditStorage() {
  log('\n=== 1. Storage buckets audit ===')
  const bucketList = ['service-photos', 'brand-assets', 'quote-pdfs', 'quote-signatures', 'event-documents']
  // also try to list buckets via API
  let allBuckets = []
  try {
    const { data, error } = await sb.storage.listBuckets()
    if (!error && data) allBuckets = data.map(b => b.name)
  } catch (e) {}
  storageStats.discoveredBuckets = allBuckets
  for (const name of bucketList) {
    storageStats[name] = { exists: allBuckets.includes(name), files: 0, totalSizeBytes: 0, mimeTypes: {}, errors: [], sample: [] }
    if (!allBuckets.includes(name)) {
      pushV('storage', 'MEDIUM', `Bucket missing/not visible: ${name}`)
      continue
    }
    // recursive list (up to 2 levels)
    async function listFolder(prefix) {
      try {
        const { data, error } = await sb.storage.from(name).list(prefix, { limit: 1000, offset: 0 })
        if (error) { storageStats[name].errors.push(`${prefix}: ${error.message}`); return }
        for (const it of data ?? []) {
          if (it.id === null && it.name && !it.metadata) {
            // folder
            const subPrefix = prefix ? `${prefix}/${it.name}` : it.name
            if ((prefix?.split('/').length ?? 0) < 3) await listFolder(subPrefix)
          } else {
            storageStats[name].files++
            const size = it.metadata?.size ?? 0
            storageStats[name].totalSizeBytes += size
            const mt = it.metadata?.mimetype ?? 'unknown'
            storageStats[name].mimeTypes[mt] = (storageStats[name].mimeTypes[mt] ?? 0) + 1
            if (storageStats[name].sample.length < 5) {
              storageStats[name].sample.push({ path: prefix ? `${prefix}/${it.name}` : it.name, size, mime: mt })
            }
          }
        }
      } catch (e) { storageStats[name].errors.push(`${prefix}: ${e.message}`) }
    }
    await listFolder('')
    storageStats[name].totalSizeMB = +(storageStats[name].totalSizeBytes / 1024 / 1024).toFixed(2)
    log(`  ${name}: ${storageStats[name].files} files, ${storageStats[name].totalSizeMB} MB`)
  }

  // Orphans: files referenced in DB but missing storage (sample brand-assets and service-photos)
  // tables likely referencing storage paths: providers.logo_url, providers.cover_url, service_photos.url, brand_assets.url, contracts.signature_data (data url maybe), quote_pdfs.url, event_documents.url
  const candidatesQueries = [
    { table: 'providers', col: 'logo_url' },
    { table: 'providers', col: 'cover_url' },
    { table: 'service_photos', col: 'url' },
    { table: 'brand_assets', col: 'url' },
    { table: 'quote_pdfs', col: 'url' },
    { table: 'event_documents', col: 'url' },
  ]
  storageStats.dbRefs = {}
  for (const q of candidatesQueries) {
    try {
      const { data, error, count } = await sb.from(q.table).select(q.col, { count: 'exact', head: false }).not(q.col, 'is', null).limit(50)
      if (error) { storageStats.dbRefs[`${q.table}.${q.col}`] = { error: error.message }; continue }
      storageStats.dbRefs[`${q.table}.${q.col}`] = { count, sample: (data ?? []).slice(0, 5) }
    } catch (e) {
      storageStats.dbRefs[`${q.table}.${q.col}`] = { error: e.message }
    }
  }
}

// =============== 2. SCHEMA INTEGRITY ===============
async function auditIntegrity() {
  log('\n=== 2. Schema integrity ===')

  // 2.1 quotes total_client < total_cost
  try {
    const { data, error } = await sb.from('quotes').select('id,total_client,total_cost,status,event_id').limit(2000)
    if (error) pushV('integrity', 'HIGH', `quotes select error: ${error.message}`)
    else {
      const bad = (data ?? []).filter(q => q.total_client != null && q.total_cost != null && Number(q.total_client) < Number(q.total_cost))
      if (bad.length) pushV('integrity', bad.length > 10 ? 'HIGH' : 'MEDIUM', `quotes with total_client < total_cost (negative margin): ${bad.length}`, bad.slice(0, 5))
      stats.quotesScanned = (data ?? []).length
      stats.quotesNegMargin = bad.length
    }
  } catch (e) { pushV('integrity', 'HIGH', `quotes scan failed: ${e.message}`) }

  // 2.2 quote_items line_client mismatch unit_client*quantity
  try {
    const { data, error } = await sb.from('quote_items').select('id,quote_id,unit_client,quantity,line_client,unit_cost,line_cost').limit(5000)
    if (error) pushV('integrity', 'HIGH', `quote_items select error: ${error.message}`)
    else {
      const bad = (data ?? []).filter(i => i.unit_client != null && i.quantity != null && i.line_client != null && Math.abs(Number(i.unit_client) * Number(i.quantity) - Number(i.line_client)) > 0.01)
      if (bad.length) pushV('integrity', bad.length > 10 ? 'HIGH' : 'MEDIUM', `quote_items line_client mismatch unit*qty: ${bad.length}`, bad.slice(0, 5))
      stats.quoteItemsScanned = (data ?? []).length
      stats.quoteItemsMismatch = bad.length
    }
  } catch (e) { pushV('integrity', 'HIGH', `quote_items scan failed: ${e.message}`) }

  // 2.3 calendar_entries value_amount with quote_id null
  try {
    const { data, error } = await sb.from('calendar_entries').select('id,title,value_amount,quote_id,entry_type').not('value_amount', 'is', null).is('quote_id', null).limit(500)
    if (error) {
      // value column may be named differently
      const { data: d2, error: e2 } = await sb.from('calendar_entries').select('id,title,quote_id,entry_type').is('quote_id', null).limit(50)
      if (e2) pushV('integrity', 'MEDIUM', `calendar_entries scan error: ${error.message}; fallback: ${e2.message}`)
      stats.calendarValueNoQuote = 'column_missing_or_renamed'
    } else {
      if ((data ?? []).length) pushV('integrity', data.length > 10 ? 'MEDIUM' : 'LOW', `calendar_entries with value_amount but no quote_id: ${data.length}`, data.slice(0, 5))
      stats.calendarValueNoQuote = data.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `calendar_entries scan failed: ${e.message}`) }

  // 2.4 wedding_couple_members user_id null & accepted_at not null
  try {
    const { data, error } = await sb.from('wedding_couple_members').select('id,user_id,accepted_at,role,entry_id').not('accepted_at', 'is', null).is('user_id', null).limit(500)
    if (error) pushV('integrity', 'MEDIUM', `wedding_couple_members scan error: ${error.message}`)
    else {
      if ((data ?? []).length) pushV('integrity', data.length > 10 ? 'HIGH' : 'MEDIUM', `wedding_couple_members accepted but user_id NULL: ${data.length}`, data.slice(0, 5))
      stats.couplesAcceptedNoUser = data.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `wedding_couple_members scan failed: ${e.message}`) }

  // 2.5 supplier_invites token expired but status PENDING
  try {
    const now = new Date().toISOString()
    const { data, error } = await sb.from('supplier_invites').select('id,status,expires_at,token,email').eq('status', 'PENDING').lt('expires_at', now).limit(500)
    if (error) {
      // Try alternate status casing
      const { data: d2, error: e2 } = await sb.from('supplier_invites').select('id,status,expires_at').limit(50)
      if (e2) pushV('integrity', 'MEDIUM', `supplier_invites scan err: ${error.message}; fb: ${e2.message}`)
      else stats.supplierInvitesSample = d2.slice(0, 5)
    } else {
      if ((data ?? []).length) pushV('integrity', data.length > 10 ? 'HIGH' : 'MEDIUM', `supplier_invites PENDING but expired: ${data.length}`, data.slice(0, 5))
      stats.supplierInvitesStaleP = data.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `supplier_invites scan failed: ${e.message}`) }

  // 2.6 event_guests with table_id pointing to event_tables deleted (FK cascade test)
  try {
    const { data: guests, error: e1 } = await sb.from('event_guests').select('id,table_id,event_id').not('table_id', 'is', null).limit(5000)
    if (e1) pushV('integrity', 'MEDIUM', `event_guests scan err: ${e1.message}`)
    else {
      const tableIds = [...new Set((guests ?? []).map(g => g.table_id))]
      if (tableIds.length) {
        const { data: tables, error: e2 } = await sb.from('event_tables').select('id').in('id', tableIds)
        if (e2) pushV('integrity', 'MEDIUM', `event_tables lookup err: ${e2.message}`)
        else {
          const present = new Set((tables ?? []).map(t => t.id))
          const orphans = (guests ?? []).filter(g => !present.has(g.table_id))
          if (orphans.length) pushV('integrity', orphans.length > 10 ? 'HIGH' : 'MEDIUM', `event_guests.table_id pointing to missing event_tables: ${orphans.length}`, orphans.slice(0, 5))
          stats.guestsOrphanTable = orphans.length
        }
      } else stats.guestsOrphanTable = 0
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `event_guests FK test failed: ${e.message}`) }

  // 2.7 supplier_availability date passed >30 days
  try {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const { data, error, count } = await sb.from('supplier_availability').select('id,date,provider_id', { count: 'exact', head: false }).lt('date', cutoff).limit(5)
    if (error) pushV('integrity', 'LOW', `supplier_availability scan err: ${error.message}`)
    else {
      if ((count ?? 0) > 0) pushV('integrity', count > 100 ? 'MEDIUM' : 'LOW', `supplier_availability rows older than 30 days (cleanup candidate): ${count}`, data?.slice(0, 5))
      stats.supplierAvailOldCount = count
    }
  } catch (e) { pushV('integrity', 'LOW', `supplier_availability scan failed: ${e.message}`) }

  // 2.8 quotes status ACCETTATO but accepted_at NULL
  try {
    const { data, error } = await sb.from('quotes').select('id,status,accepted_at,event_id').eq('status', 'ACCETTATO').is('accepted_at', null).limit(500)
    if (error) {
      // try lowercase
      const { data: d2 } = await sb.from('quotes').select('id,status,accepted_at').ilike('status', 'accept%').is('accepted_at', null).limit(500)
      if ((d2 ?? []).length) pushV('integrity', d2.length > 10 ? 'HIGH' : 'MEDIUM', `quotes accepted-like status but accepted_at NULL: ${d2.length}`, d2.slice(0, 5))
      stats.quoteAcceptedNoTs = d2?.length ?? 'err'
    } else {
      if ((data ?? []).length) pushV('integrity', data.length > 10 ? 'HIGH' : 'MEDIUM', `quotes ACCETTATO but accepted_at NULL: ${data.length}`, data.slice(0, 5))
      stats.quoteAcceptedNoTs = data.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `quote accepted scan failed: ${e.message}`) }

  // 2.9 contracts FIRMATO but signed_at NULL or signature_data NULL
  try {
    const { data, error } = await sb.from('contracts').select('id,status,signed_at,signature_data').eq('status', 'FIRMATO').limit(500)
    if (error) {
      const { data: d2, error: e2 } = await sb.from('contracts').select('id,status').limit(50)
      if (e2) pushV('integrity', 'MEDIUM', `contracts scan err: ${error.message}; fb: ${e2.message}`)
      else stats.contractsSample = d2.slice(0, 5)
    } else {
      const bad = (data ?? []).filter(c => !c.signed_at || !c.signature_data)
      if (bad.length) pushV('integrity', bad.length > 10 ? 'HIGH' : 'MEDIUM', `contracts FIRMATO with missing signed_at/signature_data: ${bad.length}`, bad.slice(0, 5))
      stats.contractsSignedNoData = bad.length
    }
  } catch (e) { pushV('integrity', 'MEDIUM', `contracts scan failed: ${e.message}`) }
}

// =============== 3. FOREIGN KEY HEALTH ===============
async function auditFK() {
  log('\n=== 3. Foreign key health ===')
  const sql = `
    select
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name as referenced_table,
      ccu.column_name as referenced_column,
      rc.delete_rule,
      rc.update_rule,
      c.is_nullable
    from information_schema.table_constraints tc
    join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    join information_schema.columns c on c.table_name = tc.table_name and c.column_name = kcu.column_name and c.table_schema = tc.table_schema
    where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
    order by tc.table_name, kcu.column_name;`
  const r = await runSql(sql)
  if (r.error) {
    pushV('fk', 'LOW', 'No exec_sql RPC available; FK introspection skipped (run via psql instead).')
    stats.fkIntrospection = 'no_rpc'
    return
  }
  stats.fkRows = (r.rows ?? []).length
  const cascadeAll = (r.rows ?? []).filter(x => x.delete_rule === 'CASCADE')
  const setNullOnNotNull = (r.rows ?? []).filter(x => x.delete_rule === 'SET NULL' && x.is_nullable === 'NO')
  storageStats.fkSummary = {
    total: stats.fkRows,
    cascadeDelete: cascadeAll.length,
    setNullOnNotNull: setNullOnNotNull.length,
    cascadeSample: cascadeAll.slice(0, 10),
    setNullBugs: setNullOnNotNull,
  }
  if (setNullOnNotNull.length) pushV('fk', 'CRITICAL', `FK with ON DELETE SET NULL on NOT NULL column (impossible): ${setNullOnNotNull.length}`, setNullOnNotNull)
  if (cascadeAll.length > 30) pushV('fk', 'MEDIUM', `Many CASCADE FKs (${cascadeAll.length}) - review wedding/event roots for potential dataloss radius`)
}

// =============== 4. INDEX HEALTH ===============
async function auditIndexes() {
  log('\n=== 4. Index health ===')
  const sql = `
    select schemaname, relname as table, indexrelname as index, idx_scan, idx_tup_read, idx_tup_fetch
    from pg_stat_user_indexes
    where schemaname='public'
    order by idx_scan asc, relname;`
  const r = await runSql(sql)
  if (r.error) { pushV('index', 'LOW', 'pg_stat_user_indexes unreachable via RPC'); stats.indexIntrospection = 'no_rpc'; return }
  const unused = (r.rows ?? []).filter(x => Number(x.idx_scan) === 0)
  storageStats.indexSummary = { total: (r.rows ?? []).length, unused: unused.length, unusedSample: unused.slice(0, 20) }
  if (unused.length > 20) pushV('index', 'LOW', `Unused indexes (idx_scan=0): ${unused.length} — drop candidates`, unused.slice(0, 10))
  else if (unused.length) pushV('index', 'LOW', `Unused indexes: ${unused.length}`, unused.slice(0, 10))

  // Duplicate index detection
  const dupSql = `
    select t.relname as table, array_agg(i.relname order by i.relname) as indexes, pg_get_indexdef(ix.indexrelid) as def
    from pg_index ix
    join pg_class i on i.oid = ix.indexrelid
    join pg_class t on t.oid = ix.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public'
    group by t.relname, pg_get_indexdef(ix.indexrelid)
    having count(*) > 1;`
  const r2 = await runSql(dupSql)
  if (!r2.error && (r2.rows ?? []).length) {
    pushV('index', 'LOW', `Duplicate index definitions found: ${r2.rows.length}`, r2.rows.slice(0, 5))
    storageStats.indexSummary.duplicates = r2.rows
  }
}

// =============== 5. AUDIT LOG (created_at / updated_at) ===============
async function auditTimestamps() {
  log('\n=== 5. Audit log integrity ===')
  const sql = `
    select c.table_name,
      max(case when c.column_name='created_at' then 1 else 0 end) as has_created,
      max(case when c.column_name='updated_at' then 1 else 0 end) as has_updated
    from information_schema.columns c
    where c.table_schema='public'
    group by c.table_name
    order by c.table_name;`
  const r = await runSql(sql)
  if (r.error) { pushV('audit', 'LOW', 'No exec_sql RPC; timestamp introspection skipped'); stats.timestampsIntrospection = 'no_rpc'; return }
  const missingCreated = (r.rows ?? []).filter(t => Number(t.has_created) === 0)
  storageStats.timestamps = {
    tables: r.rows.length,
    missingCreatedAt: missingCreated.map(t => t.table_name),
    withUpdatedAt: r.rows.filter(t => Number(t.has_updated) === 1).map(t => t.table_name),
  }
  if (missingCreated.length) pushV('audit', missingCreated.length > 5 ? 'MEDIUM' : 'LOW', `Tables without created_at: ${missingCreated.length}`, missingCreated.slice(0, 10))

  // Trigger check
  const trgSql = `
    select event_object_table as table, trigger_name, action_statement
    from information_schema.triggers
    where trigger_schema='public' and action_statement ilike '%updated_at%';`
  const r2 = await runSql(trgSql)
  if (!r2.error) {
    const triggerTables = new Set((r2.rows ?? []).map(x => x.table))
    const tablesWithUpdatedAt = (r.rows ?? []).filter(t => Number(t.has_updated) === 1).map(t => t.table_name)
    const noTrigger = tablesWithUpdatedAt.filter(t => !triggerTables.has(t))
    if (noTrigger.length) pushV('audit', noTrigger.length > 5 ? 'MEDIUM' : 'LOW', `Tables with updated_at but NO trigger touching it: ${noTrigger.length}`, noTrigger.slice(0, 10))
    storageStats.timestamps.tablesUpdatedWithoutTrigger = noTrigger
  }
}

// =============== 6. BACKUP RECOVERABILITY ===============
// (separate step in shell)

// =============== 7. TEST DATA RESIDUE ===============
async function auditTestData() {
  log('\n=== 7. Test data residue ===')
  const checks = [
    { table: 'profiles', col: 'email', patterns: ['%test%', '%demo%', '%agent-%', '%@example.%'] },
    { table: 'profiles', col: 'full_name', patterns: ['Test %', 'TEST %', 'Demo %', 'AGENT-%'] },
    { table: 'weddings', col: 'title', patterns: ['AGENT-%', 'TEST %', 'TMP %', 'Test %'] },
    { table: 'providers', col: 'business_name', patterns: ['AGENT-%', 'TEST %', 'Test %', 'Demo %', 'TMP %'] },
    { table: 'events', col: 'title', patterns: ['AGENT-%', 'TEST %', 'TMP %', 'Test %'] },
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

// ============== EXECUTE ==============
async function main() {
  try { await auditStorage() } catch (e) { pushV('storage', 'HIGH', `storage audit crashed: ${e.message}`) }
  try { await auditIntegrity() } catch (e) { pushV('integrity', 'HIGH', `integrity audit crashed: ${e.message}`) }
  try { await auditFK() } catch (e) { pushV('fk', 'HIGH', `FK audit crashed: ${e.message}`) }
  try { await auditIndexes() } catch (e) { pushV('index', 'LOW', `index audit crashed: ${e.message}`) }
  try { await auditTimestamps() } catch (e) { pushV('audit', 'LOW', `timestamps audit crashed: ${e.message}`) }
  try { await auditTestData() } catch (e) { pushV('cleanup', 'LOW', `testdata audit crashed: ${e.message}`) }

  stats.endedAt = new Date().toISOString()
  writeFileSync(join(OUT_DIR, 'integrity-violations.json'), JSON.stringify({ stats, violations }, null, 2))
  writeFileSync(join(OUT_DIR, 'storage-stats.json'), JSON.stringify(storageStats, null, 2))
  writeFileSync(join(OUT_DIR, 'cleanup-candidates.json'), JSON.stringify(cleanupCandidates, null, 2))
  log(`\nDONE. Violations: ${violations.length}. Cleanup candidates: ${cleanupCandidates.length}.`)
  log(`Output: ${OUT_DIR}`)
}

await main()
