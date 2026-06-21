// Invariante "vinto": un preventivo contribuisce al fatturato se è firmato dal cliente — sia
// ACCETTATO sia CONVERTITO_IN_CONTRATTO (alla firma del contratto lo stato passa a quest'ultimo).
// Tenere UN solo posto evita il bug del bilancio (contare solo ACCETTATO perdeva i contratti).
export const WON_QUOTE_STATUSES = ['ACCETTATO', 'CONVERTITO_IN_CONTRATTO'] as const
export type WonQuoteStatus = typeof WON_QUOTE_STATUSES[number]

export const isWonQuote = (status: string | null | undefined): boolean =>
  !!status && (WON_QUOTE_STATUSES as readonly string[]).includes(status)
