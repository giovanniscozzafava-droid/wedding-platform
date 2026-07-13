// Decodifica di un codice fiscale italiano: data di nascita, sesso e luogo di nascita (via codice catastale).
// Best-effort: se il CF è formalmente valido estrae i dati; il luogo di nascita richiede il dataset comuni
// (lazy-loaded). Serve come PREFILL da far verificare/correggere al cliente in fase di firma.
import { findComuneByCode, type Comune } from '@/lib/comuni'

const MONTHS: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, H: 6, L: 7, M: 8, P: 9, R: 10, S: 11, T: 12 }
// Omocodia: nelle posizioni numeriche una cifra può essere sostituita da una lettera.
const OMOCODIA: Record<string, string> = { L: '0', M: '1', N: '2', P: '3', Q: '4', R: '5', S: '6', T: '7', U: '8', V: '9' }

const CF_RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/

/** Normalizza le posizioni numeriche eventualmente alterate da omocodia. */
function digit(ch: string): string { return OMOCODIA[ch] ?? ch }

export type DecodedCF = {
  valid: boolean
  birthDate?: string   // YYYY-MM-DD
  sex?: 'M' | 'F'
  catasto?: string     // codice belfiore (es. H501)
  foreign?: boolean    // nato all'estero (codice Z***)
}

/** Estrae data di nascita + sesso + codice catastale da un codice fiscale (sincrono, senza dataset). */
export function decodeCodiceFiscale(cfRaw: string): DecodedCF {
  const cf = (cfRaw ?? '').trim().toUpperCase()
  if (!CF_RE.test(cf)) return { valid: false }
  const yy = Number(digit(cf.charAt(6)) + digit(cf.charAt(7)))
  const month = MONTHS[cf.charAt(8)]
  let day = Number(digit(cf.charAt(9)) + digit(cf.charAt(10)))
  const sex: 'M' | 'F' = day > 40 ? 'F' : 'M'
  if (day > 40) day -= 40
  if (!month || day < 1 || day > 31) return { valid: false }
  // Secolo: pivot sull'anno corrente.
  const nowYear = new Date().getFullYear()
  let year = 2000 + yy
  if (year > nowYear) year = 1900 + yy
  const catasto = cf.charAt(11) + digit(cf.charAt(12)) + digit(cf.charAt(13)) + digit(cf.charAt(14))
  const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { valid: true, birthDate, sex, catasto, foreign: catasto.startsWith('Z') }
}

/** Luogo di nascita leggibile ("Roma (RM)" o "Estero") dal codice fiscale, risolvendo il codice catastale. */
export async function birthPlaceFromCF(cfRaw: string): Promise<{ label: string | null; comune: Comune | null; foreign: boolean }> {
  const d = decodeCodiceFiscale(cfRaw)
  if (!d.valid || !d.catasto) return { label: null, comune: null, foreign: false }
  if (d.foreign) return { label: 'Estero', comune: null, foreign: true }
  const c = await findComuneByCode(d.catasto)
  return { label: c ? `${c.n} (${c.s})` : null, comune: c, foreign: false }
}
