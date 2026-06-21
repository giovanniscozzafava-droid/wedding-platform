// Criteri standard di banqueting per disegnare la piantina IN SCALA e contare i posti giusti.
// Riferimenti d'uso comune nel catering matrimoni:
//  · "coperto" (spazio lineare/arco per persona seduta): ~0,60–0,65 m
//  · tavolo rotondo Ø1,50 m ≈ 8 persone; Ø1,80 m ≈ 10; il perimetro / 0,65 dà il numero
//  · tavolo rettangolare/imperiale: persone sui due lati lunghi, ~0,65 m a testa
//  · profondità tavolo rettangolare ~0,90 m (imperiale ~1,20 m), presidenza un solo lato
//  · spazio sala per invitato seduto (tavoli + sedie + passaggi): ~1,4 m²
// Tutte le misure sono in METRI.

export const COVER = 0.65 // m per coperto
export const M2_PER_GUEST = 1.4 // m² a invitato (banchetto, incl. passaggi)

export type Footprint = { w: number; l: number; round: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Ingombro fisico del tavolo (m) dato forma + numero posti, secondo gli standard. */
export function tableFootprint(shape: string, seatsRaw: number): Footprint {
  const seats = Math.max(1, Math.round(seatsRaw || 0))
  switch (shape) {
    case 'ROUND': {
      const d = clamp((seats * COVER) / Math.PI, 1.0, 3.2)
      return { w: d, l: d, round: true }
    }
    case 'SQUARE': {
      const side = clamp(Math.ceil(seats / 4) * COVER, 0.9, 3.2)
      return { w: side, l: side, round: false }
    }
    case 'HEAD': {
      // presidenza: posti su un solo lato
      return { w: clamp(seats * COVER, 1.2, 24), l: 0.8, round: false }
    }
    case 'FERRO_CAVALLO': {
      // a U: i posti stanno sul perimetro dei tre lati esterni (approssimazione del bounding box)
      const w = clamp(Math.ceil(seats / 3) * COVER, 1.6, 12)
      return { w, l: clamp(w * 0.62, 1.4, 8), round: false }
    }
    default: {
      // RECT / IMPERIALE: posti sui due lati lunghi
      const perSide = Math.ceil(seats / 2)
      const len = clamp(perSide * COVER, 1.2, 24)
      const depth = shape === 'IMPERIALE' ? 1.2 : 0.95
      return { w: len, l: depth, round: false }
    }
  }
}

/** Posti consigliati per una data dimensione fisica (m), per validare/suggerire. */
export function recommendedSeats(shape: string, wM: number, lM = wM): number {
  const w = Math.max(0.5, wM)
  switch (shape) {
    case 'ROUND': return Math.max(2, Math.floor((Math.PI * w) / COVER))
    case 'SQUARE': return Math.max(2, Math.floor(w / COVER) * 4)
    case 'HEAD': return Math.max(1, Math.floor(w / COVER))
    case 'FERRO_CAVALLO': return Math.max(3, Math.floor(w / COVER) * 3)
    default: return Math.max(2, Math.floor(Math.max(w, lM) / COVER) * 2)
  }
}

/** Capienza indicativa della sala (m² → invitati seduti comodi). */
export function roomCapacity(widthM: number, lengthM: number): { area: number; guests: number } {
  const area = Math.max(0, widthM) * Math.max(0, lengthM)
  return { area: Math.round(area * 10) / 10, guests: Math.floor(area / M2_PER_GUEST) }
}

/** Somma degli invitati realmente seduti su tavoli reali (no staff). Per i conteggi. */
export function seatedCount(guests: Array<{ table_id: string | null; rsvp?: string | null; age_group?: string | null }>): number {
  return guests.filter((g) => g.table_id && (g.rsvp ?? 'PENDING') !== 'NO' && g.age_group !== 'INFANT').length
}
