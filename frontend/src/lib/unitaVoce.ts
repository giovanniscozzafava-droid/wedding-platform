// Come si chiama l'unità di una voce di preventivo, in italiano, davanti al
// cliente. L'enum del database è PEZZO/PERSONA/ORA/EVENTO, ma "pezzo" è la
// parola sbagliata per un pacchetto o un servizio: si dice "unità".
// Stessa logica nell'edge `quote-generate-pdf` (il PDF non può importare da qui).

const NOMI: Record<string, [singolare: string, plurale: string]> = {
  PEZZO: ['unità', 'unità'], // invariabile
  PERSONA: ['persona', 'persone'],
  ORA: ['ora', 'ore'],
  EVENTO: ['evento', 'eventi'],
}

/** "unità" / "persone" / "ore" — il sostantivo giusto per quantità e unità. */
export function nomeUnita(unit: string | null | undefined, qty = 1): string {
  const [sing, plur] = NOMI[String(unit ?? '').toUpperCase()] ?? NOMI.PEZZO!
  return Number(qty) === 1 ? sing : plur
}

/** "1 unità" / "4 unità" / "120 persone" / "4 ore" — quantità + unità. */
export function quantitaConUnita(qty: number | null | undefined, unit: string | null | undefined): string {
  const n = Number(qty)
  const v = Number.isFinite(n) && n > 0 ? n : 1
  const q = Number.isInteger(v) ? String(v) : String(v).replace('.', ',')
  return `${q} ${nomeUnita(unit, v)}`
}

/** Riga completa: "1 unità · 250,00 €" oppure "4 unità × 50,00 €". */
export function rigaQuantita(qty: number | null | undefined, unit: string | null | undefined, prezzo: string): string {
  const n = Number(qty)
  const v = Number.isFinite(n) && n > 0 ? n : 1
  return v === 1 ? `${quantitaConUnita(v, unit)} · ${prezzo}` : `${quantitaConUnita(v, unit)} × ${prezzo}`
}
