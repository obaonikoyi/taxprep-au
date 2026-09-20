import { describe, expect, it } from 'vitest'
import type { Statement } from './statementParser'
import type { Reviews } from './statementAnalysis'
import { buildStatementYearEndHandoff } from './statementHandoff'

const hash = 'a'.repeat(64)
const statement: Statement = {
  id: hash,
  name: 'private-name.pdf',
  format: 'csv',
  from: '2025-07-01',
  to: '2025-07-31',
  opening: null,
  closing: null,
  printedDebits: null,
  printedCredits: null,
  pages: 1,
  reconciled: false,
  notices: [],
  issues: [],
  rows: [
    { id: hash + ':1', date: '2025-07-02', description: 'Private Merchant Alpha', cents: -4550, balanceCents: null, page: 2, valueDate: null },
    { id: hash + ':2', date: '2025-07-05', description: 'Private Merchant Beta', cents: -2000, balanceCents: null, page: 3, valueDate: null },
    { id: hash + ':3', date: '2025-07-08', description: 'Transfer received', cents: 10000, balanceCents: null, page: 4, valueDate: null },
  ],
}
const reviews: Reviews = {
  [hash + ':1']: { category: 'Bills', work: 'check', note: 'private note' },
}

describe('bank statement year-end handoff', () => {
  it('exports bounded coverage metrics and source hash without descriptions or notes', () => {
    const handoff = buildStatementYearEndHandoff(statement, reviews, '2025-07-01', '2025-07-31')
    expect(handoff.financialYear).toBe('2025–26')
    expect(handoff.sourceHashes).toEqual([hash])
    expect(handoff.summary).toMatchObject({
      transactionCount: 3,
      reviewedTransactions: 1,
      workReviewTransactions: 1,
      flaggedWorkAmountCents: 4550,
    })
    const json = JSON.stringify(handoff)
    expect(json).not.toContain('Private Merchant')
    expect(json).not.toContain('private note')
    expect(json).not.toContain('private-name.pdf')
  })

  it('blocks a selected period spanning two financial years', () => {
    expect(() => buildStatementYearEndHandoff({ ...statement, from: '2025-06-01', to: '2025-07-31' }, reviews, '2025-06-30', '2025-07-01')).toThrow('one Australian financial year')
  })
})
