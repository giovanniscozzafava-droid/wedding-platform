// Denaro: formattazione + somma ESATTA. Gli importi arrivano già esatti dal DB (numeric(14,2),
// trigger con round(...,2)). Lato client NON si re-sommano float alla cieca: per sommare si passa
// per i centesimi interi, così non si sbaglia "di un millesimo".

const EUR0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const EUR2 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

const toNum = (n: number | string | null | undefined): number => {
  const v = typeof n === 'string' ? Number(n) : (n ?? 0)
  return Number.isFinite(v as number) ? (v as number) : 0
}

/** €1.234,56 (due decimali). */
export const eur = (n: number | string | null | undefined) => EUR2.format(toNum(n))
/** €1.235 (nessun decimale, per i totaloni). */
export const eurInt = (n: number | string | null | undefined) => EUR0.format(toNum(n))

/** Arrotonda al centesimo (input già vicino al centesimo, es. da DB). */
export const roundCents = (n: number | string | null | undefined) => Math.round(toNum(n) * 100) / 100

/** Somma esatta di importi in euro: converte ogni valore in centesimi interi, somma, ritorna euro. */
export function sumEuro(values: Array<number | string | null | undefined>): number {
  let cents = 0
  for (const v of values) cents += Math.round(toNum(v) * 100)
  return cents / 100
}
