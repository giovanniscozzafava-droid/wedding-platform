#!/usr/bin/env node
// Aggrega tutti i REPORT.md sotto audit-runs/night-*/  prodotti dagli agent
// notturni in un singolo NIGHT-MASTER.md ordinato per severità.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL(import.meta.url).pathname, '../../audit-runs')
const runs = readdirSync(root)
  .filter((n) => n.startsWith('night-'))
  .map((n) => path.join(root, n))
  .filter((p) => statSync(p).isDirectory())
  .sort()

const allBugs = []
const sections = []

for (const dir of runs) {
  const reportPath = path.join(dir, 'REPORT.md')
  let content = ''
  try { content = readFileSync(reportPath, 'utf-8') } catch { continue }
  const slug = path.basename(dir)
  sections.push({ slug, content })

  // Parse bug entries — pattern: lines starting with "- [CRITICAL]" / "[HIGH]" / etc.
  const lines = content.split('\n')
  for (const l of lines) {
    const m = l.match(/\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*(.+)/)
    if (m) {
      allBugs.push({ severity: m[1], agent: slug, text: m[2].trim() })
    }
  }
}

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
allBugs.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])

const out = []
out.push(`# Planfully — Master Night Report\n\n`)
out.push(`Generato: ${new Date().toISOString()}\n\n`)
out.push(`## Sintesi bug\n\n`)
const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
for (const b of allBugs) counts[b.severity]++
for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
  out.push(`- **${sev}**: ${counts[sev]}\n`)
}
out.push(`\n`)

if (allBugs.length === 0) {
  out.push(`✨ Nessun bug trovato dai ${runs.length} agent notturni.\n`)
} else {
  out.push(`## Bug ordinati per severità\n\n`)
  for (const b of allBugs) {
    out.push(`- **[${b.severity}]** ${b.text}  \n  _(da ${b.agent})_\n`)
  }
}

out.push(`\n## Report per agent\n\n`)
for (const s of sections) {
  out.push(`### ${s.slug}\n\n`)
  out.push(s.content)
  out.push(`\n\n---\n\n`)
}

const dest = path.join(root, `NIGHT-MASTER-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`)
writeFileSync(dest, out.join(''))
console.log(`Wrote ${dest}`)
console.log(`Bugs total: ${allBugs.length}`, counts)
