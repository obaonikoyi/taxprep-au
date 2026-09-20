import { describe, expect, it } from 'vitest'
import { emptyAnswers, makeEvidence, type EvidenceLink } from './evidence'
import type { DocumentSource } from './documentReader'
import { buildEvidenceYearEndHandoff } from './evidenceHandoff'

const bankHash = 'a'.repeat(64)
const receiptHash = 'b'.repeat(64)

function source(id: string): DocumentSource {
  return { id, name: 'private-file.pdf', file: {} as File, previews: ['private preview'], milliseconds: 20, pages: 1 }
}

describe('document evidence year-end handoff', () => {
  it('exports coverage/source hashes without OCR text, merchants or file names', () => {
    const bank = makeEvidence(bankHash, 'bank.csv', 'Row 2', { merchant: 'Private Supplier', date: '2025-08-14', description: 'Private service', cents: 4500 }, 'bank', 'raw bank text')
    const receipt = makeEvidence(receiptHash, 'receipt.pdf', 'Page 1', { merchant: 'Private Supplier', date: '2025-08-14', description: 'Private service', cents: 4500 }, 'receipt', 'raw OCR text')
    bank.confirmed = true
    receipt.confirmed = true
    receipt.answers = { ...emptyAnswers(), purpose: 'Work purpose' }
    const links: EvidenceLink[] = [{ bank: bank.id, receipt: receipt.id }]

    const handoff = buildEvidenceYearEndHandoff([bank, receipt], links, [], [source(bankHash), source(receiptHash)])
    expect(handoff.financialYear).toBe('2025–26')
    expect(handoff.sourceHashes).toEqual([bankHash, receiptHash])
    expect(handoff.summary).toMatchObject({
      evidenceRecords: 2,
      reconciledItems: 1,
      confirmedItems: 1,
      receiptItems: 1,
      workPurposeAnswered: 1,
      reviewedSpendingCents: 4500,
    })
    const json = JSON.stringify(handoff)
    expect(json).not.toContain('Private Supplier')
    expect(json).not.toContain('Private service')
    expect(json).not.toContain('raw OCR')
    expect(json).not.toContain('private-file')
    expect(json).not.toContain('preview')
  })
})
