// ============================================================================
// Moduli CONGELATI ("in pausa"). Refocus sul core rete/network: gli strumenti
// non essenziali restano nel codice ma sono sospesi — spariscono da /strumenti
// e le loro rotte mostrano un avviso "in pausa" con ritorno agli Strumenti.
//
// Riattivare un modulo = togliere la sua riga da qui. Nessun codice va rimosso.
// Scelta prodotto (08/08/2026): congelati Gestionale generico + F&B. Il core
// rete (preventivi, contratti, rete, eventi, finanze rete, da confermare/
// rivedere, referenti/clienti/suggerimenti, rewards/crediti) resta attivo.
// ============================================================================

/** Path esatti congelati → etichetta mostrata nell'avviso "in pausa". */
export const FROZEN_MODULES: Record<string, string> = {
  // Gestionale generico (contabilità non legata alla rete; Finanze rete RESTA)
  '/bilancio':    'Bilancio',
  '/prima-nota':  'Prima nota',
  '/ragioniere':  'Ragioniere',
  '/calcolatore': 'Calcolatore',
  // F&B / Cucina & sala
  '/food-cost':   'Food cost',
  '/prove-menu':  'Prove menu',
  '/magazzino':   'Magazzino',
}

/** true se il path è quello di un modulo congelato. */
export function isFrozen(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(FROZEN_MODULES, path)
}
