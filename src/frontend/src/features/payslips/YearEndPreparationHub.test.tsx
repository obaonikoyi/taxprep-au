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
  expect(screen.getByLabelText('Year-end preparation questions').textContent).toContain('Receipt/evidence review'i)
  expect(screen.getByText('This is not an approved deduction.')).toBeDefined()
  expect(screen.getByText('This milestone intentionally keeps the preparation hub in the current browser session and does not turn the fictional demo storage into a document vault.')).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: 'Download complete preparation handover' }))
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
})
