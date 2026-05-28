// Validazione codice fiscale italiano (persona fisica, 16 char).
// Implementa: pattern + checksum (algoritmo ufficiale Agenzia delle Entrate).
//
// NB: Verifica solo la coerenza formale (checksum corretto). NON conferma
// che il CF sia effettivamente registrato all'anagrafe tributaria —
// quello richiede l'API a pagamento di Sogei/Agenzia delle Entrate.

const CF_REGEX = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i

const ODD: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}

const EVEN: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
}

const CHECKSUM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Valida la forma del codice fiscale + checksum. */
export function isValidCodiceFiscale(input: string): boolean {
  if (!input) return false
  const cf = input.replace(/\s+/g, '').toUpperCase()
  if (cf.length !== 16) return false
  if (!CF_REGEX.test(cf)) return false
  const expected = computeChecksum(cf.slice(0, 15))
  return cf[15] === expected
}

/** Calcola il carattere di controllo dato il CF privo del 16° char. */
export function computeChecksum(first15: string): string {
  const cf = first15.toUpperCase()
  let sum = 0
  for (let i = 0; i < 15; i++) {
    const ch = cf[i]!
    sum += (i % 2 === 0 ? ODD : EVEN)[ch] ?? 0
  }
  return CHECKSUM_CHARS[sum % 26]!
}

/** Restituisce un messaggio user-friendly se il CF è invalido, altrimenti null. */
export function describeCodiceFiscaleError(input: string): string | null {
  if (!input || input.trim() === '') return null // vuoto = non validare
  const cf = input.replace(/\s+/g, '').toUpperCase()
  if (cf.length !== 16) return `Il codice fiscale deve essere di 16 caratteri (attuali: ${cf.length}).`
  if (!CF_REGEX.test(cf)) return 'Formato non valido (deve essere tipo ABCDEF12A34B567C).'
  const expected = computeChecksum(cf.slice(0, 15))
  if (cf[15] !== expected) return `Carattere di controllo errato (atteso "${expected}").`
  return null
}
