import { describe, expect, it } from 'vitest'
import type { Payslip } from '../payslips/payslip'
import { blankYearEndPreparationAnswers } from '../payslips/yearEndPreparation'
import { reconcileYearEndPay, type AnnualPaySource } from '../payslips/yearEndReconciliation'
import {
  createPreparationBackup,
  decryptPreparationBackup,
  MIN_BACKUP_PASSPHRASE_LENGTH,
  reconciliationFingerprint,
} from './preparationBackup'
import type { YearEndHandoff } from './yearEndHandoff'

function reconciliation() {
  const slip: Payslip = {
    id: 'p1',
    name: 'private-pay.pdf',
    hash: 'a'.repeat(64),
    text: 'raw private payslip text must never enter backup',
    original: { employer: 'Harbour Example Services', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16', gross: '1000', withheld: '150', deductions: '0', net: '850', super: '' },
    facts: { employer: 'Harbour Example Services', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16', gross: '1000', withheld: '150', deductions: '0', net: '850', super: '' },
    confirmed: true,
    sample: false,
  }
  const annual: AnnualPaySource = {
    id: 'annual-1',
    payer: 'Harbour Example Services',
    reference: 'Annual source A',
    gross: '1000',
    withheld: '150',
    sourceType: 'income-statement',
    finalStatus: 'final',
    linkedEmployer: 'harbour example services',
    origin: 'document',
    reviewed: true,
    documentName: 'private-annual.pdf',
    documentHash: 'b'.repeat(64),
    documentPage: 1,
    originalText: 'raw annual statement text must never enter backup',
  }
  return reconcileYearEndPay([slip], '2026–27', [annual], 'yes')
}

function statementHandoff(): YearEndHandoff {
  return {
    version: 'taxprep-year-end-handoff-v1',
    kind: 'statement-analysis',
    handoffId: 'statement:test',
    financialYear: '2026–27',
    generatedAt: '2026-09-20T10:00:00.000Z',
    sourceHashes: ['c'.repeat(64)],
    scope: { from: '2026-07-01', to: '2026-08-31' },
    summary: { transactionCount: 10, reviewedTransactions: 8, workReviewTransactions: 2, flaggedWorkAmountCents: 5500, uncategorised: 2, reconciled: true },
  }
}

describe('encrypted local preparation backup', () => {
  it('encrypts only the bounded preparation payload and restores it against the same reconciliation', async () => {
    const rec = reconciliation()
    const answers = blankYearEndPreparationAnswers()
    answers.bank['harbour example services'] = { status: 'split-timing', depositTotal: '850.00', note: 'Deposit arrived next morning.' }
    answers.expenses.bankSpending = 'partial'
    answers.expenses.reviewedTransactions = '8'
    answers.expenses.flaggedWorkAmount = '55.00'
    answers.expenses.note = 'Private preparation note'
    const handoff = statementHandoff()
    const passphrase = 'correct horse battery staple'

    const envelope = await createPreparationBackup(rec, answers, [handoff], passphrase)
    const encoded = JSON.stringify(envelope)

    expect(encoded).toContain('taxprep-year-end-preparation-backup-v1')
    expect(encoded).not.toContain('Private preparation note')
    expect(encoded).not.toContain('Harbour Example Services')
    expect(encoded).not.toContain('private-pay.pdf')
    expect(encoded).not.toContain('raw private payslip text')
    expect(encoded).not.toContain('raw annual statement text')

    const restored = await decryptPreparationBackup(envelope, passphrase, rec)
    expect(restored.financialYear).toBe('2026–27')
    expect(restored.answers).toEqual(answers)
    expect(restored.handoffs).toEqual([handoff])
    expect(restored.reconciliationFingerprint).toBe(await reconciliationFingerprint(rec))
  })

  it('rejects wrong passphrases and authenticated-ciphertext changes', async () => {
    const rec = reconciliation()
    const passphrase = 'correct horse battery staple'
    const envelope = await createPreparationBackup(rec, blankYearEndPreparationAnswers(), [], passphrase)

    await expect(decryptPreparationBackup(envelope, 'this passphrase is wrong', rec)).rejects.toThrow('could not be decrypted')

    const changed = structuredClone(envelope)
    changed.ciphertext = changed.ciphertext.slice(0, -4) + 'AAAA'
    await expect(decryptPreparationBackup(changed, passphrase, rec)).rejects.toThrow()
  })

  it('rejects a backup when the current year or reconciliation facts changed', async () => {
    const rec = reconciliation()
    const passphrase = 'correct horse battery staple'
    const envelope = await createPreparationBackup(rec, blankYearEndPreparationAnswers(), [], passphrase)

    await expect(decryptPreparationBackup(envelope, passphrase, { ...rec, year: '2025–26' })).rejects.toThrow('not the selected 2025–26 financial year')

    const changed = structuredClone(rec)
    changed.checkedSlips[0].facts.net = '851'
    await expect(decryptPreparationBackup(envelope, passphrase, changed)).rejects.toThrow('different checked pay or annual-source facts')
  })

  it('requires a meaningful passphrase', async () => {
    await expect(createPreparationBackup(reconciliation(), blankYearEndPreparationAnswers(), [], 'short')).rejects.toThrow(String(MIN_BACKUP_PASSPHRASE_LENGTH))
  })
})
