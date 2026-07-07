// idml_import — SPIKE (non codice di prodotto).
// Legge un file IDML (export ufficiale Adobe, ZIP di XML) ed estrae la geometria utile a
// ricostruire un album: spread, frame immagine (posizione/dimensione/rotazione), file linkato,
// crop. Output: JSON normalizzato (coord frame 0..1 relative allo spread, dimensioni in mm).
//
// USO:  node parse-idml.mjs <file.idml> [--pretty]
//
// GUARDRAIL: si parsa SOLO l'IDML esportato. Niente .sap, niente template di libreria, niente
// marchi Pixellu/SmartAlbums nel codice. Vedi REPORT.md.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { XMLParser } from 'fast-xml-parser'

const PT_TO_MM = 25.4 / 72 // 1 punto tipografico = 1/72 pollice

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: false })

// ── helper ───────────────────────────────────────────────────────────────────
const asArray = (x) => (Array.isArray(x) ? x : x == null ? [] : [x])
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }

// ItemTransform = "a b c d tx ty" (affine 2D). Punto: x' = a*x + c*y + tx ; y' = b*x + d*y + ty
function parseMatrix(s) {
  if (!s) return [1, 0, 0, 1, 0, 0]
  const p = String(s).trim().split(/\s+/).map(Number)
  return p.length === 6 && p.every(Number.isFinite) ? p : [1, 0, 0, 1, 0, 0]
}
function applyM(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] }
// compose: risultato = A∘B (applica B, poi A)
function composeM(A, B) {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5],
  ]
}
function bboxOf(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
  return { minX, minY, maxX, maxY }
}
function rotationDeg(m) { return +(Math.atan2(m[1], m[0]) * 180 / Math.PI).toFixed(2) }
function fileFromUri(uri) {
  if (!uri) return null
  try { let s = decodeURIComponent(String(uri)); s = s.replace(/^file:\/*/i, ''); return basename(s) || null } catch { return basename(String(uri)) || null }
}

// Anchor points di un item (Rectangle/Polygon/Oval) nel suo spazio locale.
function itemAnchors(item) {
  const gpt = item?.Properties?.PathGeometry?.GeometryPathType
  const pts = []
  for (const g of asArray(gpt)) {
    for (const pp of asArray(g?.PathPointArray?.PathPointType)) {
      const a = pp?.['@_Anchor']
      if (a) { const [x, y] = String(a).trim().split(/\s+/).map(Number); if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]) }
    }
  }
  return pts
}

// Un frame immagine = Rectangle/Polygon/Oval che contiene un <Image>/<PDF>/<EPS>.
const FRAME_TAGS = ['Rectangle', 'Polygon', 'Oval', 'GraphicLine']
const IMG_TAGS = ['Image', 'PDF', 'EPS']

function collectFrames(container, parentM, out, warnings, depth = 0) {
  // Ricorsione nei Group (compone la matrice del gruppo).
  for (const g of asArray(container?.Group)) {
    if (depth > 4) { warnings.push('group_nesting_troppo_profondo'); continue }
    const gm = composeM(parentM, parseMatrix(g?.['@_ItemTransform']))
    collectFrames(g, gm, out, warnings, depth + 1)
  }
  for (const tag of FRAME_TAGS) {
    for (const rect of asArray(container?.[tag])) {
      const media = IMG_TAGS.map((t) => asArray(rect?.[t])[0]).find(Boolean)
      if (!media) continue // frame vuoto o forma decorativa → non è una foto
      const m = composeM(parentM, parseMatrix(rect?.['@_ItemTransform']))
      const anchors = itemAnchors(rect)
      if (anchors.length < 2) { warnings.push('frame_senza_pathgeometry'); continue }
      const localBox = bboxOf(anchors)
      const corners = [
        [localBox.minX, localBox.minY], [localBox.maxX, localBox.minY],
        [localBox.maxX, localBox.maxY], [localBox.minX, localBox.maxY],
      ].map(([x, y]) => applyM(m, x, y))
      out.push({ rect, media, spreadCorners: corners, itemMatrix: m, localBox, tag })
    }
  }
}

// ── parsing di uno spread ──────────────────────────────────────────────────────
function parseSpread(spreadXml, index, warnings) {
  const root = xml.parse(spreadXml)
  const spread = root?.['idPkg:Spread']?.Spread ?? root?.Spread?.Spread ?? root?.Spread
  if (!spread) { warnings.push(`spread_${index}_no_spread_node`); return null }

  // bounds dello spread = unione dei bounds delle pagine (in spazio spread)
  let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity
  const pages = asArray(spread.Page)
  for (const pg of pages) {
    const gb = String(pg?.['@_GeometricBounds'] ?? '0 0 0 0').trim().split(/\s+/).map(Number) // y1 x1 y2 x2
    const [y1, x1, y2, x2] = gb
    const pm = parseMatrix(pg?.['@_ItemTransform'])
    for (const [x, y] of [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]) {
      const [sx, sy] = applyM(pm, x, y)
      if (sx < sMinX) sMinX = sx; if (sy < sMinY) sMinY = sy; if (sx > sMaxX) sMaxX = sx; if (sy > sMaxY) sMaxY = sy
    }
  }
  if (!Number.isFinite(sMinX)) { warnings.push(`spread_${index}_no_pages`); return null }
  const spreadW = sMaxX - sMinX, spreadH = sMaxY - sMinY
  if (spreadW <= 0 || spreadH <= 0) { warnings.push(`spread_${index}_bounds_degeneri`); return null }
  if (pages.length === 1) warnings.push(`spread_${index}_pagina_singola`)

  const rawFrames = []
  collectFrames(spread, [1, 0, 0, 1, 0, 0], rawFrames, warnings)

  const frames = []
  for (const f of rawFrames) {
    const bb = bboxOf(f.spreadCorners)
    const x = (bb.minX - sMinX) / spreadW
    const y = (bb.minY - sMinY) / spreadH
    const w = (bb.maxX - bb.minX) / spreadW
    const h = (bb.maxY - bb.minY) / spreadH
    const rot = rotationDeg(f.itemMatrix)
    if (Math.abs(rot) > 0.5) warnings.push('frame_ruotato')

    // crop: <Image ItemTransform> mappa lo spazio immagine nello spazio locale del frame.
    // scala ≈ |(a,b)| della matrice immagine; offset = (tx,ty) normalizzati sul frame locale.
    const im = parseMatrix(f.media?.['@_ItemTransform'])
    const frameLocalW = f.localBox.maxX - f.localBox.minX || 1
    const frameLocalH = f.localBox.maxY - f.localBox.minY || 1
    const scale = +Math.hypot(im[0], im[1]).toFixed(4)
    const image_crop = {
      offset_x: +((im[4] - f.localBox.minX) / frameLocalW).toFixed(4),
      offset_y: +((im[5] - f.localBox.minY) / frameLocalH).toFixed(4),
      scale,
      _raw_image_matrix: im, // grezzo: calibrazione crop esatta da rifinire su sample reali
    }
    const uri = asArray(f.media?.Link)[0]?.['@_LinkResourceURI'] ?? f.media?.Link?.['@_LinkResourceURI']
    const image_filename = fileFromUri(uri)
    if (!image_filename) warnings.push('frame_senza_link_immagine')

    frames.push({
      x: +x.toFixed(4), y: +y.toFixed(4), w: +w.toFixed(4), h: +h.toFixed(4),
      rotation_deg: rot, image_filename, image_crop,
    })
  }

  return {
    index,
    width_mm: +(spreadW * PT_TO_MM).toFixed(1),
    height_mm: +(spreadH * PT_TO_MM).toFixed(1),
    frames,
  }
}

// ── entry ──────────────────────────────────────────────────────────────────────
export function parseIdml(buf) {
  const warnings = []
  const files = unzipSync(new Uint8Array(buf))
  const names = Object.keys(files)

  // Ordine spread da designmap.xml se presente, altrimenti Spreads/ ordinati.
  let spreadPaths = []
  const dmName = names.find((n) => /(^|\/)designmap\.xml$/i.test(n))
  if (dmName) {
    const dm = xml.parse(strFromU8(files[dmName]))
    spreadPaths = asArray(dm?.Document?.['idPkg:Spread']).map((s) => s?.['@_src']).filter(Boolean)
  }
  if (spreadPaths.length === 0) {
    spreadPaths = names.filter((n) => /Spreads\/Spread_.*\.xml$/i.test(n)).sort()
    if (dmName) warnings.push('designmap_senza_spread_fallback_su_enumerazione')
  }

  const spreads = []
  let i = 0
  for (const p of spreadPaths) {
    const key = names.find((n) => n === p || n.endsWith('/' + p) || basename(n) === basename(p))
    if (!key) { warnings.push(`spread_file_mancante:${p}`); continue }
    try {
      const sp = parseSpread(strFromU8(files[key]), i + 1, warnings)
      if (sp) { spreads.push(sp); i++ }
    } catch (e) { warnings.push(`spread_parse_error:${p}:${String(e).slice(0, 80)}`) }
  }

  return { source: 'idml_import', spreads, warnings: [...new Set(warnings)] }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2]
  if (!file) { console.error('Uso: node parse-idml.mjs <file.idml> [--pretty]'); process.exit(1) }
  const out = parseIdml(readFileSync(file))
  const pretty = process.argv.includes('--pretty')
  process.stdout.write(JSON.stringify(out, null, pretty ? 2 : 0) + '\n')
  console.error(`\n[idml_import] ${out.spreads.length} spread · ${out.spreads.reduce((s, x) => s + x.frames.length, 0)} frame · ${out.warnings.length} warning`)
}
