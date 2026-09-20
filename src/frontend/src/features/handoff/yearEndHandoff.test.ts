// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  YEAR_END_HANDOFF_VERSION,
  coveragePatchFromHandoff,
  financialYearForRange,
  handoffSummaryLines,
  handoffConflicts,
  parseYearEndHandoffValue,
  readYearEndHandoff,
  type EvidenceYearEndHandoff,
  type StatementYearEndHandoff,
} from './yearEndHandoff'

const hashA = 'a'.repeat(64)
const hashB = 'b'.repeat(64)

function statement(): StatementYearEndHandoff {
  return {
    version: YEAR_END_HANDOFF_VERSION,
    kind: 'statement-analysis',
    handoffId: 'statement:test',
    financialYear: '2026–27',
    generatedAt: '2026-09-20T10:00:00.000Z',
    sourceHashes: [hashA],
    scope: { from: '2026-07-01', to: '2026-08-31' },
    summary: {
      transactionCount: 20,
      reviewedTransactions: 18,
      workReviewTransactions: 3,
      flaggedWorkAmountCents: 14550,
      uncategorised: 2,
      reconciled: true,
    },
  }
}

function evidence(): EvidenceYearEndHandoff {
  return {
    version: YEAR_END_HANDOFF_VERSION,
    kind: 'evidence-review',
    handoffId: 'evidence:test',
    financialYear: '2026–27',
    generatedAt: '2026-09-20T10:00:00.000Z',
    sourceHashes: [hashA, hashB],
    summary: {
      evidenceRecords: 4,
      reconciledItems: 3,
      confirmedItems: 3,
      receiptItems: 2,
      workPurposeAnswered: 3,
      reviewedSpendingCents: 9000,
      openQuestions: 1,
    },
  }
}

describe('portable year-end handoff', () => {
  it('validates and normalises supported handoffs', () => {
    const value = { ...statement(), financialYear: '2026-27' }
    const parsed = parseYearEndHandoffValue(value)
    expect(parsed.financialYear).toBe('2026–27')
    expect(parsed.sourceHashes).toEqual([hashA])
    expect(financialYearForRange('2026-07-01', '2027-06-30')).toBe('2026–27')
    expect(financialYearForRange('2026-06-30', '2026-07-01')).toBe('')
  })

  it('rejects unsupported versions, invalid hashes and inconsistent counts', () => {
    expect(() => parseYearEndHandoffValue({ ...statement(), version: 'other' })).toThrow('version')
    expect(() => parseYearEndHandoffValue({ ...statement(), sourceHashes: ['not-a-hash'] })).toThrow('source hashes')
    expect(() => parseYearEndHandoffValue({
      ...statement(),
      summary: { ...statement().summary, reviewedTransactions: 21 },
    })).toThrow('counts are inconsistent')
  })

  it('rejects the wrong financial year during file import', async () => {
    const value = { ...statement(), financialYear: '2025–26', scope: { from: '2025-07-01', to: '2026-06-30' } }
    const file = new File([JSON.stringify(value)], 'handoff.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(value) })
    await expect(readYearEndHandoff(file, '2026–27')).rejects.toThrow('not the selected 2026–27')
  })

  it('rejects malformed JSON with a bounded user-facing error', async () => {
    const file = new File(['{not valid json'], 'handoff.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{not valid json' })
    await expect(readYearEndHandoff(file, '2026–27')).rejects.toThrow('not valid JSON')
  })

  it('detects duplicate identities and same-workspace source reuse', () => {
    const original = statement()
    expect(handoffConflicts([original], original)).toBe(true)
    expect(handoffConflicts([original], { ...statement(), handoffId: 'statement:other-scope', scope: { from: '2026-09-01', to: '2026-09-30' } })).toBe(true)
    expect(handoffConflicts([original], evidence())).toBe(false)
  })

  it('maps statement coverage without treating review amounts as deductions', () => {
    expect(coveragePatchFromHandoff(statement())).toEqual({
      bankSpending: 'partial',
      reviewedTransactions: '18',
      workReviewTransactions: '3',
      flaggedWorkAmount: '145.50',
    })
    expect(handoffSummaryLines(statement()).join(' ')).toContain('not a deduction')
  })

  it('maps evidence coverage without copying reviewed spending into the work-review amount', () => {
    const patch = coveragePatchFromHandoff(evidence())
    expect(patch).toEqual({
      receiptEvidence: 'partial',
      workPurpose: 'complete',
      receiptCount: '2',
      workPurposeCount: '3',
    })
    expect('flaggedWorkAmount' in patch).toBe(false)
    expect(handoffSummaryLines(evidence()).join(' ')).toContain('reviewed spending — not a deduction')
  })
})
