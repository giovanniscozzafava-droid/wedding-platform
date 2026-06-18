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

// API: genera le disposizioni per N foto (orientamenti dati), ordinate dalla migliore.
// Filtra le celle TROPPO estreme/sottili (album = riquadri equilibrati): se ne restano troppo
// poche, allenta progressivamente la soglia. `max` = numero massimo di preset restituiti.
export function genTavolaLayouts(photoOrients: Orient[], tavW: number, tavH: number, max = 18): GenLayout[] {
  const n = Math.max(1, photoOrients.length)
  const cap = n <= 4 ? 300 : n <= 6 ? 520 : 720
  const raw = gen({ x: 0, y: 0, w: 1, h: 1 }, n, cap)
  // soglie di "estremità" rilassate finché non abbiamo abbastanza schemi puliti
  for (const lim of [2.6, 3.2, 4.2, 99]) {
    const seen = new Set<string>()
    const layouts: GenLayout[] = []
    for (const slots of raw) {
      if (slots.length !== n) continue
      let bad = false
      for (const s of slots) {
        const a = (s.w * tavW) / (s.h * tavH)
        if (a > lim || a < 1 / lim) { bad = true; break }
        if (s.w < 0.06 || s.h < 0.08) { bad = true; break }
      }
      if (bad) continue
      const sig = sigOf(slots)
      if (seen.has(sig)) continue
      seen.add(sig)
      const score = orientScore(slots, photoOrients, tavW, tavH) - uglyPenalty(slots, tavW, tavH) - balancePenalty(slots)
      layouts.push({ slots, score, sig })
    }
    if (layouts.length >= Math.min(8, max) || lim === 99) {
      layouts.sort((a, b) => b.score - a.score)
      return layouts.slice(0, max)
    }
  }
  return []
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
