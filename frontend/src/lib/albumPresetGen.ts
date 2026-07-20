// Generatore di DISPOSIZIONI (preset) per la TAVOLA UNICA, consapevole dell'orientamento delle
// foto. Per N foto produce "tutte le disposizioni sensate" (tagli guillotine ricorsivi), poi le
// ordina premiando quelle i cui slot rispecchiano gli orientamenti reali (verticali/orizzontali),
// così ogni foto entra nello slot giusto con poco ritaglio. Coordinate 0..1 dell'INTERA tavola.

export type Orient = 'P' | 'L' | 'S' // Portrait, Landscape, Square
export type Slot = { x: number; y: number; w: number; h: number }
export type GenLayout = { slots: Slot[]; score: number; sig: string }

export function classifyAspect(aspect: number): Orient {
  if (!isFinite(aspect) || aspect <= 0) return 'S'
  if (aspect < 0.85) return 'P'
  if (aspect > 1.18) return 'L'
  return 'S'
}

function cut(r: Slot, dir: 'V' | 'H', ratio: number): [Slot, Slot] {
  if (dir === 'V') { const w1 = r.w * ratio; return [{ x: r.x, y: r.y, w: w1, h: r.h }, { x: r.x + w1, y: r.y, w: r.w - w1, h: r.h }] }
  const h1 = r.h * ratio; return [{ x: r.x, y: r.y, w: r.w, h: h1 }, { x: r.x, y: r.y + h1, w: r.w, h: r.h - h1 }]
}

// Tutte le suddivisioni guillotine di `r` in `n` celle (con tetto per non esplodere).
function gen(r: Slot, n: number, cap: number): Slot[][] {
  if (n <= 1) return [[r]]
  const out: Slot[][] = []
  for (let i = 1; i <= n - 1; i++) {
    for (const dir of ['V', 'H'] as const) {
      const ratio = i / n // taglio ad aree proporzionali = celle ~uguali (estetica pulita)
      const [ra, rb] = cut(r, dir, ratio)
      const la = gen(ra, i, cap), lb = gen(rb, n - i, cap)
      const capA = Math.max(1, Math.ceil(Math.sqrt(cap)))
      for (const a of la.slice(0, capA)) {
        for (const b of lb.slice(0, capA)) {
          out.push([...a, ...b])
          if (out.length >= cap) return out
        }
      }
    }
  }
  return out
}

function slotOrient(s: Slot, tavW: number, tavH: number): Orient {
  return classifyAspect((s.w * tavW) / (s.h * tavH))
}

// Quanto bene gli slot possono ospitare le foto per orientamento (intersezione dei multiset).
function orientScore(slots: Slot[], photos: Orient[], tavW: number, tavH: number): number {
  const cnt = (arr: Orient[]) => { const m = { P: 0, L: 0, S: 0 } as Record<Orient, number>; for (const o of arr) m[o]++; return m }
  const sc = cnt(slots.map((s) => slotOrient(s, tavW, tavH)))
  const pc = cnt(photos)
  // S (quadrato) è jolly: una foto S sta bene ovunque, e uno slot S accetta tutto con poco taglio.
  let match = Math.min(sc.P, pc.P) + Math.min(sc.L, pc.L) + Math.min(sc.S, pc.S)
  const leftSlot = { P: sc.P - Math.min(sc.P, pc.P), L: sc.L - Math.min(sc.L, pc.L), S: sc.S - Math.min(sc.S, pc.S) }
  const leftPhoto = { P: pc.P - Math.min(sc.P, pc.P), L: pc.L - Math.min(sc.L, pc.L), S: pc.S - Math.min(sc.S, pc.S) }
  match += Math.min(leftSlot.S, leftPhoto.P + leftPhoto.L) * 0.6 // slot quadrato ospita resti
  match += Math.min(leftPhoto.S, leftSlot.P + leftSlot.L) * 0.6 // foto quadrata in slot resto
  return match
}

// Penalità per slot troppo estremi/sottili (estetica): aspetti molto fuori range = brutti.
function uglyPenalty(slots: Slot[], tavW: number, tavH: number): number {
  let p = 0
  for (const s of slots) {
    const a = (s.w * tavW) / (s.h * tavH)
    if (a > 3 || a < 1 / 3) p += 2
    else if (a > 2.2 || a < 1 / 2.2) p += 0.6
    if (s.w < 0.08 || s.h < 0.08) p += 1.5
  }
  return p
}

function sigOf(slots: Slot[]): string {
  return slots.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)},${s.w.toFixed(2)},${s.h.toFixed(2)}`).sort().join('|')
}

// Penalità per celle di area MOLTO diversa tra loro (un album bello ha riquadri equilibrati).
function balancePenalty(slots: Slot[]): number {
  const areas = slots.map((s) => s.w * s.h)
  const avg = areas.reduce((a, b) => a + b, 0) / Math.max(1, areas.length)
  let v = 0; for (const a of areas) v += Math.abs(a - avg)
  return (v / Math.max(1e-6, avg)) * 0.5
}

// "Regioni" entro cui collocare lo schema sulla tavola: dal pieno (copre tutto) a varianti con
// bordo bianco o a fascia → disposizioni più creative da impaginatore (non coprono tutta l'area).
type Region = { key: string; r: Slot; bonus: number }
const REGIONS: Region[] = [
  { key: 'full', r: { x: 0, y: 0, w: 1, h: 1 }, bonus: 0.35 },                 // a vivo, copre tutto
  { key: 'frameS', r: { x: 0.04, y: 0.055, w: 0.92, h: 0.89 }, bonus: 0.22 },   // bordino bianco
  { key: 'frameM', r: { x: 0.10, y: 0.12, w: 0.80, h: 0.76 }, bonus: 0.05 },    // cornice bianca ampia
  { key: 'frameL', r: { x: 0.17, y: 0.20, w: 0.66, h: 0.60 }, bonus: -0.1 },    // molto raccolto al centro
  { key: 'bandH', r: { x: 0.05, y: 0.26, w: 0.90, h: 0.48 }, bonus: 0.0 },      // fascia orizzontale
  { key: 'bandV', r: { x: 0.30, y: 0.06, w: 0.40, h: 0.88 }, bonus: -0.15 },    // colonna centrale stretta
]
function placeInRegion(slots: Slot[], R: Slot): Slot[] {
  return slots.map((s) => ({ x: R.x + s.x * R.w, y: R.y + s.y * R.h, w: s.w * R.w, h: s.h * R.h }))
}

// GRIGLIE pulite righe×colonne per N foto: VELOCI e ordinate (le guillotine esplodono con molte foto).
// Includo varianti "orizzontali" (più colonne che righe) e la fascia a riga unica → gestiscono bene >8 foto.
function gridLayouts(n: number): Slot[][] {
  const cols = new Set<number>()
  const s = Math.round(Math.sqrt(n))
  ;[s, s + 1, s - 1, Math.ceil(n / 2), Math.ceil(n / 3), n].forEach((c) => { if (c >= 1 && c <= n) cols.add(c) })
  const out: Slot[][] = []
  for (const c of cols) {
    const rows = Math.ceil(n / c)
    const cellW = 1 / c, cellH = 1 / rows
    const slots: Slot[] = []
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / c)
      const inRow = r === rows - 1 ? n - c * (rows - 1) : c   // celle nell'ultima riga (può essere più corta)
      const col = i - r * c
      const offX = (1 - inRow * cellW) / 2                    // ultima riga più corta → centrata
      slots.push({ x: offX + col * cellW, y: r * cellH, w: cellW, h: cellH })
    }
    out.push(slots)
  }
  return out
}

// API: genera MOLTE disposizioni per N foto (orientamenti dati), ordinate dalla migliore. Include
// varianti a vivo, con cornice bianca e a fascia (più creative). `max` = preset restituiti.
export function genTavolaLayouts(photoOrients: Orient[], tavW: number, tavH: number, max = 48): GenLayout[] {
  const n = Math.max(1, photoOrients.length)
  // GRIGLIE sempre incluse (veloci e pulite, perfette per >8 foto anche in orizzontale).
  let base: { slots: Slot[]; q: number }[] = gridLayouts(n).map((slots) => ({ slots, q: uglyPenalty(slots, tavW, tavH) + balancePenalty(slots) }))
  // GUILLOTINE (disposizioni creative a celle diverse) SOLO per N gestibile: con molte foto è
  // esponenziale (bloccava l'apertura del pannello) e le griglie coprono già il caso.
  if (n <= 8) {
    const cap = n <= 4 ? 360 : n <= 6 ? 640 : 900
    const raw = gen({ x: 0, y: 0, w: 1, h: 1 }, n, cap)
    for (const lim of [2.6, 3.2, 4.2, 99]) {
      const seen = new Set<string>(); const acc: { slots: Slot[]; q: number }[] = []
      for (const slots of raw) {
        if (slots.length !== n) continue
        let bad = false
        for (const s of slots) {
          const a = (s.w * tavW) / (s.h * tavH)
          if (a > lim || a < 1 / lim) { bad = true; break }
          if (s.w < 0.05 || s.h < 0.07) { bad = true; break }
        }
        if (bad) continue
        const sig = sigOf(slots); if (seen.has(sig)) continue; seen.add(sig)
        acc.push({ slots, q: uglyPenalty(slots, tavW, tavH) + balancePenalty(slots) })
      }
      if (acc.length >= 10 || lim === 99) { base = base.concat(acc); break }
    }
  }
  // dedup + migliori schemi base
  const seenB = new Set<string>()
  base = base.filter((b) => { const sg = sigOf(b.slots); if (seenB.has(sg)) return false; seenB.add(sg); return true })
  base.sort((a, b) => a.q - b.q)
  base = base.slice(0, 16)
  // VARIANTI: ogni schema base collocato nelle varie regioni (pieno / cornice / fascia).
  const seen2 = new Set<string>(); const out: GenLayout[] = []
  for (const b of base) {
    for (const R of REGIONS) {
      const slots = placeInRegion(b.slots, R.r)
      const sig = sigOf(slots); if (seen2.has(sig)) continue; seen2.add(sig)
      const score = orientScore(slots, photoOrients, tavW, tavH) - b.q + R.bonus
      out.push({ slots, score, sig })
    }
  }
  out.sort((a, b) => b.score - a.score)
  return out.slice(0, max)
}

// Assegna ogni foto allo slot più adatto per orientamento → ordine [indice foto per slot].
// Ritorna un array lungo come gli slot: per ogni slot, l'indice della foto da metterci (o -1).
export function assignPhotos(slots: Slot[], photoOrients: Orient[], tavW: number, tavH: number): number[] {
  const sOr = slots.map((s) => slotOrient(s, tavW, tavH))
  const used = new Array(photoOrients.length).fill(false)
  const res = new Array(slots.length).fill(-1)
  const take = (want: Orient | null) => {
    for (let i = 0; i < photoOrients.length; i++) if (!used[i] && (want === null || photoOrients[i] === want)) { used[i] = true; return i }
    return -1
  }
  // 1° giro: match esatto orientamento; 2° giro: quadrate; 3° giro: qualunque resto.
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 0; k < slots.length; k++) {
      if (res[k] >= 0) continue
      const want = pass === 0 ? sOr[k]! : pass === 1 ? 'S' : null
      const idx = take(want as Orient | null)
      if (idx >= 0) res[k] = idx
    }
  }
  return res
}

// Applica un gutter (margine tra le foto, in frazione di tavola) restringendo ogni slot.
export function gutterSlot(s: Slot, gx: number, gy: number): Slot {
  return { x: s.x + gx / 2, y: s.y + gy / 2, w: Math.max(0.02, s.w - gx), h: Math.max(0.02, s.h - gy) }
}
