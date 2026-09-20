// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Payslip } from './payslip'
import { reconcileYearEndPay, type AnnualPaySource } from './yearEndReconciliation'
import YearEndPreparationHub from './YearEndPreparationHub'

afterEach(() => cleanup())

function reconciliation() {
  const slip: Payslip = {
    id: 'p1',
    name: 'pay.pdf',
    hash: 'hash-pay',
    text: '',
    original: { employer: 'Harbour Example Services', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16', gross: '1000', withheld: '150', deductions: '0', net: '850', super: '' },
    facts: { employer: 'Harbour Example Services', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16', gross: '1000', withheld: '150', deductions: '0', net: '850', super: '' },
    confirmed: true,
    sample: false,
  }
  const annual: AnnualPaySource = {
    id: 'a1',
    payer: 'Harbour Example Services',
    reference: 'Annual A',
    gross: '1000',
    withheld: '150',
    sourceType: 'income-statement',
    finalStatus: 'final',
    linkedEmployer: 'harbour example services',
    origin: 'manual',
    reviewed: true,
  }
  return reconcileYearEndPay([slip], '2026–27', [annual], 'yes')
}

it('keeps the preparation hub session-only and exposes the bank/expense review flow', () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  render(<YearEndPreparationHub reconciliation={reconciliation()} />)

  expect(screen.getByText('Bank deposits are a completeness check, not income evidence.')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Start year-end preparation hub' }))

  fireEvent.change(screen.getByLabelText('Bank check: Harbour Example Services status'), { target: { value: 'matched' } })
  fireEvent.change(screen.getByLabelText('Bank check: Harbour Example Services deposit total (AUD)'), { target: { value: '850' } })
  fireEvent.change(screen.getByLabelText('Year-end prep: bankSpending'), { target: { value: 'complete' } })
  fireEvent.change(screen.getByLabelText('Year-end prep: receiptEvidence'), { target: { value: 'partial' } })
  fireEvent.change(screen.getByLabelText('Year-end prep: workPurpose'), { target: { value: 'complete' } })
  fireEvent.change(screen.getByLabelText('Year-end prep: ruleReview'), { target: { value: 'not-reviewed' } })
  fireEvent.change(screen.getByLabelText('Year-end prep: flaggedWorkAmount'), { target: { value: '80' } })

  expect(screen.getByLabelText('Year-end preparation coverage').textContent).toContain('1/1')
  expect(screen.getByLabelText('Year-end preparation questions').textContent).toContain('Receipt/evidence review')
  expect(screen.getByText('This is not an approved deduction.')).toBeDefined()
  expect(screen.getByText('This milestone intentionally keeps the preparation hub in the current browser session and does not turn the fictional demo storage into a document vault.')).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: 'Download complete preparation handover' }))
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
})


it('reviews and explicitly applies same-year handoffs without auto-completing rules or double counting amounts', async () => {
  render(<YearEndPreparationHub reconciliation={reconciliation()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start year-end preparation hub' }))

  const statement = {
    version: 'taxprep-year-end-handoff-v1',
    kind: 'statement-analysis',
    handoffId: 'statement:component',
    financialYear: '2026–27',
    generatedAt: '2026-09-20T10:00:00.000Z',
    sourceHashes: ['a'.repeat(64)],
    scope: { from: '2026-07-01', to: '2026-08-31' },
    summary: { transactionCount: 20, reviewedTransactions: 18, workReviewTransactions: 3, flaggedWorkAmountCents: 14550, uncategorised: 2, reconciled: true },
  }
  const statementFile = new File([JSON.stringify(statement)], 'statement-handoff.json', { type: 'application/json' })
  Object.defineProperty(statementFile, 'text', { value: async () => JSON.stringify(statement) })

  fireEvent.change(screen.getByLabelText('Import year-end handoff'), { target: { files: [statementFile] } })
  await screen.findByRole('region', { name: 'Review imported year-end handoff' })
  expect((screen.getByLabelText('Year-end prep: bankSpending') as HTMLSelectElement).value).toBe('')
  expect((screen.getByLabelText('Year-end prep: ruleReview') as HTMLSelectElement).value).toBe('')

  fireEvent.click(screen.getByRole('button', { name: 'Apply imported coverage' }))
  expect((screen.getByLabelText('Year-end prep: bankSpending') as HTMLSelectElement).value).toBe('partial')
  expect((screen.getByLabelText('Year-end prep: reviewedTransactions') as HTMLInputElement).value).toBe('18')
  expect((screen.getByLabelText('Year-end prep: workReviewTransactions') as HTMLInputElement).value).toBe('3')
  expect((screen.getByLabelText('Year-end prep: flaggedWorkAmount') as HTMLInputElement).value).toBe('145.50')
  expect((screen.getByLabelText('Year-end prep: ruleReview') as HTMLSelectElement).value).toBe('')
  expect(screen.getByLabelText('Applied year-end handoffs').textContent).toContain('Bank spending summary')

  const evidence = {
    version: 'taxprep-year-end-handoff-v1',
    kind: 'evidence-review',
    handoffId: 'evidence:component',
    financialYear: '2026–27',
    generatedAt: '2026-09-20T10:01:00.000Z',
    sourceHashes: ['b'.repeat(64), 'c'.repeat(64)],
    summary: { evidenceRecords: 4, reconciledItems: 3, confirmedItems: 3, receiptItems: 2, workPurposeAnswered: 3, reviewedSpendingCents: 9000, openQuestions: 1 },
  }
  const evidenceFile = new File([JSON.stringify(evidence)], 'evidence-handoff.json', { type: 'application/json' })
  Object.defineProperty(evidenceFile, 'text', { value: async () => JSON.stringify(evidence) })
  fireEvent.change(screen.getByLabelText('Import year-end handoff'), { target: { files: [evidenceFile] } })
  await screen.findByRole('region', { name: 'Review imported year-end handoff' })
  fireEvent.click(screen.getByRole('button', { name: 'Apply imported coverage' }))

  expect((screen.getByLabelText('Year-end prep: receiptEvidence') as HTMLSelectElement).value).toBe('partial')
  expect((screen.getByLabelText('Year-end prep: workPurpose') as HTMLSelectElement).value).toBe('complete')
  expect((screen.getByLabelText('Year-end prep: receiptCount') as HTMLInputElement).value).toBe('2')
  expect((screen.getByLabelText('Year-end prep: workPurposeCount') as HTMLInputElement).value).toBe('3')
  expect((screen.getByLabelText('Year-end prep: flaggedWorkAmount') as HTMLInputElement).value).toBe('145.50')
  expect((screen.getByLabelText('Year-end prep: ruleReview') as HTMLSelectElement).value).toBe('')

  fireEvent.change(screen.getByLabelText('Import year-end handoff'), { target: { files: [statementFile] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('already been imported')

  const wrongYear = { ...evidence, handoffId: 'evidence:wrong-year', financialYear: '2025–26' }
  const wrongFile = new File([JSON.stringify(wrongYear)], 'wrong-year.json', { type: 'application/json' })
  Object.defineProperty(wrongFile, 'text', { value: async () => JSON.stringify(wrongYear) })
  fireEvent.change(screen.getByLabelText('Import year-end handoff'), { target: { files: [wrongFile] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('not the selected 2026–27 financial year')
})
