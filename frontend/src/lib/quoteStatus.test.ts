import { describe, it, expect } from 'vitest'
import { WON_QUOTE_STATUSES, isWonQuote } from './quoteStatus'

describe('invariante fatturato (won)', () => {
  it('include sia ACCETTATO sia CONVERTITO_IN_CONTRATTO', () => {
    expect([...WON_QUOTE_STATUSES].sort()).toEqual(['ACCETTATO', 'CONVERTITO_IN_CONTRATTO'])
  })
  it('CONVERTITO_IN_CONTRATTO conta nel fatturato (regressione del bug bilancio)', () => {
    expect(isWonQuote('CONVERTITO_IN_CONTRATTO')).toBe(true)
  })
  it('ACCETTATO conta', () => expect(isWonQuote('ACCETTATO')).toBe(true))
  it('INVIATO/RIFIUTATO/BOZZA NON contano', () => {
    expect(isWonQuote('INVIATO')).toBe(false)
    expect(isWonQuote('RIFIUTATO')).toBe(false)
    expect(isWonQuote('BOZZA')).toBe(false)
    expect(isWonQuote(null)).toBe(false)
  })
})
