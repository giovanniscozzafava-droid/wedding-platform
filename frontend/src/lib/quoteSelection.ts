// Regola R1 (condivisa da tutte le superfici cliente): il cliente vede SEMPRE e
// SOLO il totale di ciò che ha selezionato.
//   • Se ha accettato voci singole (client_decision='ACCETTATO') → totale = quelle.
//   • Se non ha fatto nessuna selezione per-voce → totale = preventivo intero.
// È la STESSA regola che lega contratto/atto/acconto (migration R1): teniamola in
// un solo posto perché preview, accept e portale coppia non divergano mai più.

export type CoupleDecision = 'IN_ATTESA' | 'ACCETTATO' | 'RIFIUTATO' | 'FORSE' | null | undefined

/** true se il cliente ha accettato solo un sottoinsieme di voci. */
export function hasPartialSelection(totalClientSelected: number | null | undefined): boolean {
  return Number(totalClientSelected ?? 0) > 0
}

/** Il totale da MOSTRARE al cliente: selezionato se esiste, altrimenti pieno. */
export function shownTotal(totalClient: number | null | undefined, totalClientSelected: number | null | undefined): number {
  const sel = Number(totalClientSelected ?? 0)
  return sel > 0 ? sel : Number(totalClient ?? 0)
}

/** Se la voce concorre al totale mostrato (con selezione parziale, solo le ACCETTATO). */
export function itemIncluded(decision: CoupleDecision, hasSelection: boolean): boolean {
  if (!hasSelection) return true
  return decision === 'ACCETTATO'
}
