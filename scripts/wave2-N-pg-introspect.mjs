// Direct PG introspection for FK, indexes, triggers, timestamps via pooler
import pg from 'pg'
import { writeFileSync } from 'node:fs'

const OUT = '/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave2-N-data-integrity-20260525-225942'

// CLI login role provisioned by `supabase link` for project zfwlkvqxfzvubmfyxofs
const candidates = [
  { host: 'aws-1-eu-central-1.pooler.supabase.com', port: 5432, user: 'cli_login_postgres.zfwlkvqxfzvubmfyxofs', password: 'rJmdTXmQhjRJgrAFLKwFQhzMWLAJkkIh', database: 'postgres', ssl: { rejectUnauthorized: false } },
]
let client
let lastErr
for (const cfg of candidates) {
  try {
    const c = new pg.Client(cfg)
    await c.connect()
    client = c
    console.log('connected via', cfg.host, cfg.port, cfg.user)
    break
  } catch (e) { lastErr = e; console.log('failed', cfg.host, cfg.port, cfg.user, e.code ?? e.message) }
}
if (!client) throw lastErr

// (connected above)

const results = {}

// 1. FK details with delete rules
results.fks = (await client.query(`
  select tc.constraint_name, tc.table_name, kcu.column_name,
    ccu.table_name as ref_table, ccu.column_name as ref_column,
    rc.delete_rule, rc.update_rule, c.is_nullable
  from information_schema.table_constraints tc
  join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  join information_schema.columns c on c.table_name = tc.table_name and c.column_name = kcu.column_name and c.table_schema = tc.table_schema
  where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
  order by tc.table_name, kcu.column_name;
`)).rows

// 2. Index usage stats
results.indexUsage = (await client.query(`
  select schemaname, relname as table_name, indexrelname as index_name, idx_scan, idx_tup_read, idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
  from pg_stat_user_indexes
  where schemaname='public'
  order by idx_scan asc, relname;
`)).rows

// 3. Duplicate indexes by definition
results.dupIndexes = (await client.query(`
  with idx as (
    select n.nspname as schema, t.relname as table, i.relname as index,
      pg_get_indexdef(ix.indexrelid) as def
    from pg_index ix
    join pg_class i on i.oid = ix.indexrelid
    join pg_class t on t.oid = ix.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public'
  )
  select schema, table, array_agg(index order by index) as indexes,
    regexp_replace(def, 'INDEX [a-z0-9_]+', 'INDEX X') as norm_def
  from idx
  group by schema, table, norm_def
  having count(*) > 1;
`)).rows

// 4. Tables with created_at / updated_at
results.timestamps = (await client.query(`
  select c.table_name,
    max(case when c.column_name='created_at' then 1 else 0 end) as has_created,
    max(case when c.column_name='updated_at' then 1 else 0 end) as has_updated
  from information_schema.columns c
  where c.table_schema='public'
  group by c.table_name
  order by c.table_name;
`)).rows

// 5. Triggers on updated_at
results.updatedTriggers = (await client.query(`
  select event_object_table as table_name, trigger_name, action_statement
  from information_schema.triggers
  where trigger_schema='public' and (action_statement ilike '%set_updated_at%' or action_statement ilike '%updated_at%')
`)).rows

// 6. Total rows & size per table
results.tableSizes = (await client.query(`
  select n.nspname as schema, c.relname as table, c.reltuples::bigint as est_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public' and c.relkind='r'
  order by pg_total_relation_size(c.oid) desc;
`)).rows

// 7. Tables without PK
results.tablesNoPk = (await client.query(`
  select c.relname as table
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
  and not exists (
    select 1 from pg_constraint con
    where con.conrelid = c.oid and con.contype = 'p'
  );
`)).rows

// 8. FK columns without index
results.fkNoIndex = (await client.query(`
  select c.relname as table_name, a.attname as fk_column, conname as constraint_name
  from pg_constraint con
  join pg_class c on c.oid=con.conrelid
  join pg_namespace n on n.oid=c.relnamespace
  join unnest(con.conkey) with ordinality as k(attnum, ord) on true
  join pg_attribute a on a.attrelid=c.oid and a.attnum=k.attnum
  where n.nspname='public' and con.contype='f' and not exists (
    select 1 from pg_index ix
    where ix.indrelid = c.oid
      and ix.indkey::int[] @> ARRAY[a.attnum::int]
      and ix.indkey[0] = a.attnum
  )
  order by c.relname, a.attname;
`)).rows

// 9. SET NULL on NOT NULL bug detection
results.setNullBugs = results.fks.filter(f => f.delete_rule === 'SET NULL' && f.is_nullable === 'NO')

writeFileSync(`${OUT}/pg-introspection.json`, JSON.stringify(results, null, 2))

// Summary
const sum = {
  fks: results.fks.length,
  cascade: results.fks.filter(f => f.delete_rule === 'CASCADE').length,
  setNull: results.fks.filter(f => f.delete_rule === 'SET NULL').length,
  setNullBugs: results.setNullBugs.length,
  indexes: results.indexUsage.length,
  unusedIndexes: results.indexUsage.filter(i => Number(i.idx_scan) === 0).length,
  duplicateIndexes: results.dupIndexes.length,
  tables: results.timestamps.length,
  missingCreatedAt: results.timestamps.filter(t => Number(t.has_created) === 0).length,
  withUpdatedAt: results.timestamps.filter(t => Number(t.has_updated) === 1).length,
  updatedAtTriggers: results.updatedTriggers.length,
  tablesNoPk: results.tablesNoPk.length,
  fkColsWithoutIndex: results.fkNoIndex.length,
}

// Tables with updated_at but missing trigger
const tablesWithUpdated = new Set(results.timestamps.filter(t => Number(t.has_updated) === 1).map(t => t.table_name))
const tablesWithTrigger = new Set(results.updatedTriggers.map(t => t.table_name))
const missingTriggers = [...tablesWithUpdated].filter(t => !tablesWithTrigger.has(t))
sum.tablesUpdatedAtNoTrigger = missingTriggers.length
results.tablesUpdatedAtNoTrigger = missingTriggers

writeFileSync(`${OUT}/pg-introspection.json`, JSON.stringify(results, null, 2))
writeFileSync(`${OUT}/pg-summary.json`, JSON.stringify(sum, null, 2))
console.log(JSON.stringify(sum, null, 2))
console.log('\nMissing updated_at triggers:', missingTriggers)
console.log('\nUnused indexes sample:', results.indexUsage.filter(i => Number(i.idx_scan) === 0).slice(0, 15).map(i => `${i.table_name}.${i.index_name}`))
console.log('\nLargest tables:', results.tableSizes.slice(0, 10).map(r => `${r.table}=${r.est_rows} rows / ${r.total_size}`))
console.log('\nFK cols without index:', results.fkNoIndex.length, results.fkNoIndex.slice(0, 15))

await client.end()
