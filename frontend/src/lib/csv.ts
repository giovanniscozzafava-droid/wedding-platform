// Parser CSV minimale (RFC 4180): supporta virgole, punto e virgola, tab,
// doppi quote, escape "" e newline LF/CRLF.
//
// Limite: no streaming, file letto in memoria (OK per qualche migliaio di righe).

export type CsvRow = Record<string, string>

export function detectDelimiter(sample: string): ',' | ';' | '\t' {
  const c = sample.split('\n').slice(0, 5).join('\n')
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let inQ = false
  for (const ch of c) {
    if (ch === '"') inQ = !inQ
    else if (!inQ && (ch === ',' || ch === ';' || ch === '\t')) counts[ch]!++
  }
  return ((Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) ?? ',') as ',' | ';' | '\t'
}

export function parseCsv(text: string, delimiter?: string): { headers: string[]; rows: CsvRow[] } {
  const d = (delimiter ?? detectDelimiter(text)) as string
  const out: string[][] = [[]]
  let cur = ''
  let inQ = false
  let i = 0
  const src = text.replace(/^﻿/, '') // BOM
  while (i < src.length) {
    const ch = src[i]!
    if (inQ) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i += 2; continue }
      if (ch === '"') { inQ = false; i++; continue }
      cur += ch; i++; continue
    }
    if (ch === '"') { inQ = true; i++; continue }
    if (ch === d) { out[out.length - 1]!.push(cur); cur = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { out[out.length - 1]!.push(cur); cur = ''; out.push([]); i++; continue }
    cur += ch; i++
  }
  if (cur.length > 0 || (out[out.length - 1] && out[out.length - 1]!.length > 0)) {
    out[out.length - 1]!.push(cur)
  }
  // rimuovi righe completamente vuote
  const cleaned = out.filter((r) => r.length > 0 && r.some((c) => c.trim().length > 0))
  if (cleaned.length === 0) return { headers: [], rows: [] }
  const headers = cleaned[0]!.map((h) => h.trim())
  const rows: CsvRow[] = []
  for (let r = 1; r < cleaned.length; r++) {
    const row: CsvRow = {}
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]!] = (cleaned[r]![c] ?? '').trim()
    }
    rows.push(row)
  }
  return { headers, rows }
}

/**
 * Normalizza un header per matching fuzzy: lowercase, no spazi, no accenti.
 */
export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}
