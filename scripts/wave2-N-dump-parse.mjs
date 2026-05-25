// Parse /tmp/backup-test.sql to extract FK/index/timestamp metadata.
import { readFileSync, writeFileSync } from 'node:fs'

const sql = readFileSync('/tmp/backup-test.sql', 'utf8')
const OUT = '/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave2-N-data-integrity-20260525-225942'

// Foreign keys
const fkRe = /ALTER TABLE ONLY "public"\."(\w+)"\s+ADD CONSTRAINT "(\w+)" FOREIGN KEY \(([^)]+)\) REFERENCES "public"\."(\w+)"\(([^)]+)\)(?:[^;]*?ON DELETE (CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION))?(?:[^;]*?ON UPDATE (CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION))?[^;]*;/g
const fks = []
let m
while ((m = fkRe.exec(sql)) !== null) {
  fks.push({ table: m[1], constraint: m[2], column: m[3].replace(/"/g, ''), refTable: m[4], refColumn: m[5].replace(/"/g, ''), onDelete: m[6] ?? 'NO ACTION', onUpdate: m[7] ?? 'NO ACTION' })
}

// Extract NOT NULL columns per table
const tableRe = /CREATE TABLE IF NOT EXISTS "public"\."(\w+)" \(([\s\S]*?)\n\);/g
const tableCols = {}
let t
while ((t = tableRe.exec(sql)) !== null) {
  const name = t[1]; const body = t[2]
  tableCols[name] = {}
  for (const line of body.split('\n')) {
    const colMatch = line.match(/^\s*"(\w+)"\s+([^,]+),?\s*$/)
    if (!colMatch) continue
    const col = colMatch[1]; const rest = colMatch[2]
    const notNull = /NOT NULL/i.test(rest)
    const type = rest.replace(/NOT NULL.*$/i, '').replace(/DEFAULT.*$/i, '').trim()
    tableCols[name][col] = { nullable: !notNull, type }
  }
}

const setNullBugs = []
for (const f of fks) {
  if (f.onDelete === 'SET NULL') {
    const tc = tableCols[f.table]?.[f.column]
    if (tc && !tc.nullable) setNullBugs.push(f)
  }
}

// Indexes
const idxRe = /CREATE (UNIQUE )?INDEX (?:IF NOT EXISTS )?"?(\w+)"? ON "?public"?\."?(\w+)"? USING "?\w+"? \(([^)]+)\)/g
const indexes = []
while ((m = idxRe.exec(sql)) !== null) {
  indexes.push({ unique: !!m[1], name: m[2], table: m[3], cols: m[4].trim() })
}

const dupMap = {}
for (const idx of indexes) {
  const key = `${idx.table}::${idx.cols.replace(/\s+/g, '')}`
  ;(dupMap[key] = dupMap[key] || []).push(idx)
}
const duplicates = Object.values(dupMap).filter(g => g.length > 1)

const timestampsTables = []
for (const [name, cols] of Object.entries(tableCols)) {
  timestampsTables.push({ table: name, hasCreatedAt: 'created_at' in cols, hasUpdatedAt: 'updated_at' in cols })
}
const missingCreated = timestampsTables.filter(x => !x.hasCreatedAt).map(x => x.table)
const withUpdatedAt = timestampsTables.filter(x => x.hasUpdatedAt).map(x => x.table)

const trgRe = /CREATE TRIGGER "?(\w+)"? BEFORE UPDATE ON "?public"?\."?(\w+)"?[\s\S]*?set_updated_at/g
const trgTables = new Set()
while ((m = trgRe.exec(sql)) !== null) trgTables.add(m[2])
const updatedNoTrigger = withUpdatedAt.filter(t => !trgTables.has(t))

const cascadeFks = fks.filter(f => f.onDelete === 'CASCADE')
const setNullFks = fks.filter(f => f.onDelete === 'SET NULL')

const cascadeByRef = {}
for (const f of cascadeFks) cascadeByRef[f.refTable] = (cascadeByRef[f.refTable] || 0) + 1

const inlinePkRe = /CREATE TABLE IF NOT EXISTS "public"\."(\w+)"[\s\S]*?PRIMARY KEY/g
const tablesWithPk = new Set()
while ((m = inlinePkRe.exec(sql)) !== null) tablesWithPk.add(m[1])
const pkRe = /ALTER TABLE ONLY "public"\."(\w+)"\s+ADD CONSTRAINT [^;]+PRIMARY KEY/g
while ((m = pkRe.exec(sql)) !== null) tablesWithPk.add(m[1])
const tablesNoPk = Object.keys(tableCols).filter(t => !tablesWithPk.has(t))

const indexedCols = new Set(indexes.map(i => `${i.table}::${i.cols.replace(/"/g, '').replace(/\s+/g, '').split(',')[0]}`))
const fkColsNoIndex = []
for (const f of fks) {
  const k = `${f.table}::${f.column.replace(/"/g, '').trim()}`
  const isPk = tablesWithPk.has(f.table) && f.column === 'id'
  if (!indexedCols.has(k) && !isPk) fkColsNoIndex.push({ table: f.table, column: f.column, refTable: f.refTable, onDelete: f.onDelete })
}

const result = {
  summary: {
    tables: Object.keys(tableCols).length,
    fks: fks.length,
    cascadeFks: cascadeFks.length,
    setNullFks: setNullFks.length,
    setNullOnNotNullBugs: setNullBugs.length,
    indexes: indexes.length,
    duplicateIndexGroups: duplicates.length,
    tablesNoPk: tablesNoPk.length,
    missingCreatedAt: missingCreated.length,
    withUpdatedAt: withUpdatedAt.length,
    updatedAtNoTriggerCount: updatedNoTrigger.length,
    fkColsWithoutIndex: fkColsNoIndex.length,
  },
  cascadeByRefTable: cascadeByRef,
  highRiskCascadeRoots: Object.entries(cascadeByRef).sort((a, b) => b[1] - a[1]).slice(0, 10),
  setNullBugs: setNullBugs,
  duplicates: duplicates,
  tablesNoPk: tablesNoPk,
  missingCreatedAt: missingCreated,
  updatedAtNoTrigger: updatedNoTrigger,
  fkColsWithoutIndex2: fkColsNoIndex,
  fks,
  indexes,
  tables: Object.fromEntries(Object.entries(tableCols).map(([k, v]) => [k, Object.keys(v).length])),
}

writeFileSync(`${OUT}/schema-introspection.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result.summary, null, 2))
console.log('\ntop cascade roots:', result.highRiskCascadeRoots)
console.log('\nset null bugs:', setNullBugs.length, setNullBugs.slice(0, 5))
console.log('\nduplicates:', duplicates.length, duplicates.slice(0, 3))
console.log('\nupdated_at no trigger:', updatedNoTrigger)
console.log('\nmissing created_at:', missingCreated)
console.log('\ntables no PK:', tablesNoPk)
console.log('\nfk cols without index:', fkColsNoIndex.length, fkColsNoIndex.slice(0, 15))
