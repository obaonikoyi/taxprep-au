import { describe, expect, it } from 'vitest'
import type { Payslip } from './payslip'
import { reconcileYearEndPay, type AnnualPaySource } from './yearEndReconciliation'
import {
  blankYearEndPreparationAnswers,
  buildYearEndPreparation,
  type YearEndPreparationAnswers,
} from './yearEndPreparation'
import { yearEndPreparationReport } from './yearEndPreparationReport'

function pay(id: string, employer: string, gross: string, withheld: string, net: string): Payslip {
  const payDate = id === 'a2' ? '2026-07-30' : '2026-07-16'
  return {
    id,
    name: id + '.pdf',
    hash: 'hash-' + id,
    text: '',
    original: {
      employer,
      periodStart: payDate,
      periodEnd: payDate,
      payDate,
      gross,
      withheld,
      deductions: '0',
      net,
      super: '',
      hours: '', rate: '', ordinary: '',
    },
    facts: {
      employer,
      periodStart: payDate,
      periodEnd: payDate,
      payDate,
      gross,
      withheld,
      deductions: '0',
      net,
      super: '',
      hours: '', rate: '', ordinary: '',
    },
    confirmed: true,
    sample: false,
  }
}

function source(id: string, payer: string, gross: string, withheld: string, linkedEmployer: string): AnnualPaySource {
  return {
    id,
    payer,
    reference: id,
    gross,
    withheld,
    sourceType: 'income-statement',
    finalStatus: 'final',
    linkedEmployer,
    origin: 'manual',
    reviewed: true,
  }
}

function baseReconciliation() {
  return reconcileYearEndPay(
    [
      pay('a1', 'Harbour Example Services', '1000', '150', '850'),
      pay('a2', 'Harbour Example Services', '1200', '180', '1020'),
    ],
    '2026–27',
    [source('annual-a', 'Harbour Example Services', '2200', '330', 'harbour example services')],
    'yes',
  )
}

describe('year-end preparation hub model', () => {
  it('uses bank deposits only as a net-pay completeness check and never changes income reconciliation', () => {
    const reconciliation = baseReconciliation()
    const answers = blankYearEndPreparationAnswers()
    answers.bank['harbour example services'] = {
      status: 'matched',
      depositTotal: '1870',
      note: '',
    }

    const result = buildYearEndPreparation(reconciliation, answers)

    expect(result.bankRows[0]).toMatchObject({
      checkedNet: 187000,
      depositTotal: 187000,
      difference: 0,
      status: 'matched',
      issues: [],
    })
    expect(result.reconciliation.rows[0].payGross).toBe(220000)
    expect(result.reconciliation.rows[0].annualGross).toBe(220000)
    expect(result.reconciliation.rows[0].payWithheld).toBe(33000)
    expect(result.reconciliation.rows[0].annualWithheld).toBe(33000)
    expect(result.questions.some(question => question.includes('bank'))).toBe(false)
  })

  it('keeps split/timing differences and possible missing deposits as review questions', () => {
    const reconciliation = baseReconciliation()
    const answers = blankYearEndPreparationAnswers()
    answers.bank['harbour example services'] = {
      status: 'split-timing',
      depositTotal: '850',
      note: 'Second payday landed after the statement period.',
    }

    const split = buildYearEndPreparation(reconciliation, answers)
    expect(split.bankRows[0].difference).toBe(-102000)
    expect(split.questions.join(' ')).toContain('split or timing difference')
    expect(split.reconciliation.rows[0].state).toBe('matches')

    answers.bank['harbour example services'] = {
      status: 'missing-deposit',
      depositTotal: '',
      note: 'One deposit could not be found.',
    }
    const missing = buildYearEndPreparation(reconciliation, answers)
    expect(missing.questions.join(' ')).toContain('possible missing pay deposit')
    expect(missing.bankRows[0].depositTotal).toBeNull()
  })

  it('does not accept a mismatching deposit total as a clean match', () => {
    const reconciliation = baseReconciliation()
    const answers = blankYearEndPreparationAnswers()
    answers.bank['harbour example services'] = {
      status: 'matched',
      depositTotal: '1800',
      note: '',
    }

    const result = buildYearEndPreparation(reconciliation, answers)
    expect(result.bankRows[0].issues.join(' ')).toContain('Deposit total differs')
    expect(result.questions.join(' ')).toContain('Deposit total differs')
  })

  it('records expense/evidence coverage without turning a flagged amount into a deduction', () => {
    const reconciliation = baseReconciliation()
    const answers: YearEndPreparationAnswers = {
      bank: {},
      expenses: {
        bankSpending: 'complete',
        receiptEvidence: 'partial',
        workPurpose: 'complete',
        ruleReview: 'not-reviewed',
        reviewedTransactions: '24',
        workReviewTransactions: '3',
        receiptCount: '2',
        workPurposeCount: '3',
        flaggedWorkAmount: '145.50',
        note: 'Phone rule review is still pending.',
      },
    }

    const result = buildYearEndPreparation(reconciliation, answers)

    expect(result.expenses.flaggedWorkAmountValue).toBe(14550)
    expect(result.expenseAreasAnswered).toBe(4)
    expect(result.questions.join(' ')).toContain('Receipt/evidence review: only part')
    expect(result.questions.join(' ')).toContain('Applicable supported-rule review: this area has not been reviewed')
    expect(result.taxResultLocked).toBe(true)
  })

  it('keeps invalid counts and missing coverage explicit', () => {
    const reconciliation = baseReconciliation()
    const answers = blankYearEndPreparationAnswers()
    answers.expenses.reviewedTransactions = '-1'
    answers.expenses.receiptCount = '1.5'

    const result = buildYearEndPreparation(reconciliation, answers)
    expect(result.expenses.issues.join(' ')).toContain('whole number')
    expect(result.questions.join(' ')).toContain('coverage has not been recorded')
  })

  it('escapes user-entered notes and includes source references in the unified handover', () => {
    const reconciliation = baseReconciliation()
    const answers = blankYearEndPreparationAnswers()
    answers.bank['harbour example services'] = {
      status: 'split-timing',
      depositTotal: '1870',
      note: '<script>bad()</script>',
    }
    answers.expenses.bankSpending = 'complete'
    answers.expenses.receiptEvidence = 'complete'
    answers.expenses.workPurpose = 'complete'
    answers.expenses.ruleReview = 'partial'
    answers.expenses.flaggedWorkAmount = '50'
    answers.expenses.note = '<img src=x onerror=bad()>'

    const html = yearEndPreparationReport(buildYearEndPreparation(reconciliation, answers))

    expect(html).toContain('year-end-preparation-v1')
    expect(html).toContain('year-end-pay-reconciliation-v2')
    expect(html).toContain('Bank deposits are used only as a completeness/review check')
    expect(html).toContain('Candidate work-review amount is not a deduction')
    expect(html).toContain('SHA-256 hash-a1')
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=bad()&gt;')
    expect(html).not.toContain('<script>bad()</script>')
    expect(html).not.toContain('<img src=x')
  })
})
