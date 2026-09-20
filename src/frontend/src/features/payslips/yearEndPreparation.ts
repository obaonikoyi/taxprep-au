import { employerKey, money } from './payslip'
import type { YearEndReconciliation } from './yearEndReconciliation'
import type { YearEndHandoff } from '../handoff/yearEndHandoff'

export const YEAR_END_PREPARATION_VERSION = 'year-end-preparation-v1'

export type BankCheckStatus = '' | 'matched' | 'split-timing' | 'missing-deposit' | 'not-checked' | 'unsure'
export type CoverageStatus = '' | 'complete' | 'partial' | 'not-reviewed' | 'not-applicable'

export type BankDepositAnswer = {
  status: BankCheckStatus
  depositTotal: string
  note: string
}

export type ExpenseCoverageAnswers = {
  bankSpending: CoverageStatus
  receiptEvidence: CoverageStatus
  workPurpose: CoverageStatus
  ruleReview: CoverageStatus
  reviewedTransactions: string
  workReviewTransactions: string
  receiptCount: string
  workPurposeCount: string
  flaggedWorkAmount: string
  note: string
}

export type YearEndPreparationAnswers = {
  bank: Record<string, BankDepositAnswer>
  expenses: ExpenseCoverageAnswers
}

export type BankDepositRow = {
  employerKey: string
  employerName: string
  payslipCount: number
  checkedNet: number | null
  status: BankCheckStatus
  depositTotal: number | null
  difference: number | null
  note: string
  issues: string[]
}

export type ExpenseCoverageResult = ExpenseCoverageAnswers & {
  reviewedTransactionsValue: number | null
  workReviewTransactionsValue: number | null
  receiptCountValue: number | null
  workPurposeCountValue: number | null
  flaggedWorkAmountValue: number | null
  issues: string[]
}

export type YearEndPreparationResult = {
  version: string
  year: string
  reconciliation: YearEndReconciliation
  bankRows: BankDepositRow[]
  expenses: ExpenseCoverageResult
  handoffs: YearEndHandoff[]
  incomeOpenQuestions: number
  bankReviewed: number
  bankEmployers: number
  expenseAreasAnswered: number
  expenseAreas: 4
  questions: string[]
  taxResultLocked: true
  persistence: 'session-only'
}

export function blankBankDepositAnswer(): BankDepositAnswer {
  return { status: '', depositTotal: '', note: '' }
}

export function blankExpenseCoverageAnswers(): ExpenseCoverageAnswers {
  return {
    bankSpending: '',
    receiptEvidence: '',
    workPurpose: '',
    ruleReview: '',
    reviewedTransactions: '',
    workReviewTransactions: '',
    receiptCount: '',
    workPurposeCount: '',
    flaggedWorkAmount: '',
    note: '',
  }
}

export function blankYearEndPreparationAnswers(): YearEndPreparationAnswers {
  return { bank: {}, expenses: blankExpenseCoverageAnswers() }
}

function nonNegativeInteger(value: string) {
  if (!value.trim()) return null
  if (!/^\d+$/.test(value.trim())) return NaN
  return Number(value)
}

export function bankCheckStatusLabel(status: BankCheckStatus) {
  return {
    '': 'Not answered',
    matched: 'Deposits matched checked net pay',
    'split-timing': 'Split or timing difference recorded',
    'missing-deposit': 'Possible missing deposit',
    'not-checked': 'Not checked',
    unsure: 'Unsure',
  }[status]
}

export function coverageStatusLabel(status: CoverageStatus) {
  return {
    '': 'Not answered',
    complete: 'Reviewed for this preparation pass',
    partial: 'Partly reviewed',
    'not-reviewed': 'Not reviewed',
    'not-applicable': 'Not applicable',
  }[status]
}

function expenseCountIssue(label: string, raw: string) {
  const value = nonNegativeInteger(raw)
  if (Number.isNaN(value)) return `${label} must be a whole number of 0 or more.`
  return ''
}

export function buildYearEndPreparation(
  reconciliation: YearEndReconciliation,
  answers: YearEndPreparationAnswers,
  handoffs: YearEndHandoff[] = [],
): YearEndPreparationResult {
  const bankRows: BankDepositRow[] = reconciliation.employerNames.map(([key, name]) => {
    const slips = reconciliation.checkedSlips.filter(slip => employerKey(slip.facts.employer) === key)
    const netValues = slips.map(slip => money(slip.facts.net))
    const checkedNet = netValues.every(value => value !== null)
      ? netValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null
    const answer = answers.bank[key] ?? blankBankDepositAnswer()
    const depositTotal = answer.depositTotal.trim() ? money(answer.depositTotal) : null
    const difference = checkedNet !== null && depositTotal !== null ? depositTotal - checkedNet : null
    const issues: string[] = []

    if (!answer.status) issues.push('Choose a bank-deposit check status.')
    if (answer.depositTotal.trim() && depositTotal === null) issues.push('Bank deposit total must be a valid AUD amount.')
    if (answer.status === 'matched') {
      if (checkedNet === null) issues.push('Checked payslip net pay is incomplete, so a deposit match cannot be confirmed.')
      if (depositTotal === null) issues.push('Enter the bank deposit total before marking deposits matched.')
      if (difference !== null && difference !== 0) issues.push('Deposit total differs from checked net pay. Use split/timing difference or review the amount.')
    }
    if (answer.status === 'split-timing' && !answer.note.trim()) issues.push('Describe the split payment or timing difference.')
    if (answer.note.length > 800) issues.push('Bank-check note must be 800 characters or fewer.')

    return {
      employerKey: key,
      employerName: name,
      payslipCount: slips.length,
      checkedNet,
      status: answer.status,
      depositTotal,
      difference,
      note: answer.note.trim(),
      issues,
    }
  })

  const e = answers.expenses
  const expenseIssues = [
    expenseCountIssue('Reviewed transaction count', e.reviewedTransactions),
    expenseCountIssue('Work-review transaction count', e.workReviewTransactions),
    expenseCountIssue('Receipt count', e.receiptCount),
    expenseCountIssue('Work-purpose answer count', e.workPurposeCount),
  ].filter(Boolean)

  const flaggedWorkAmountValue = e.flaggedWorkAmount.trim() ? money(e.flaggedWorkAmount) : null
  if (e.flaggedWorkAmount.trim() && flaggedWorkAmountValue === null) expenseIssues.push('Flagged work-review amount must be a valid AUD amount.')
  if (e.note.length > 1200) expenseIssues.push('Expense/evidence note must be 1,200 characters or fewer.')

  const expenses: ExpenseCoverageResult = {
    ...e,
    reviewedTransactionsValue: nonNegativeInteger(e.reviewedTransactions),
    workReviewTransactionsValue: nonNegativeInteger(e.workReviewTransactions),
    receiptCountValue: nonNegativeInteger(e.receiptCount),
    workPurposeCountValue: nonNegativeInteger(e.workPurposeCount),
    flaggedWorkAmountValue,
    issues: expenseIssues,
  }

  const questions = [...reconciliation.questions]

  for (const row of bankRows) {
    for (const issue of row.issues) questions.push(`${row.employerName} bank check: ${issue}`)
    if (row.status === 'split-timing') questions.push(`${row.employerName}: bank deposits involve a split or timing difference that should remain visible in the handover.`)
    if (row.status === 'missing-deposit') questions.push(`${row.employerName}: a possible missing pay deposit needs review.`)
    if (row.status === 'not-checked') questions.push(`${row.employerName}: bank deposits were not checked against payslip net pay.`)
    if (row.status === 'unsure') questions.push(`${row.employerName}: bank-deposit coverage is unsure.`)
  }

  const expenseAreas: [string, CoverageStatus][] = [
    ['Bank spending review', e.bankSpending],
    ['Receipt/evidence review', e.receiptEvidence],
    ['Work-purpose answers', e.workPurpose],
    ['Applicable supported-rule review', e.ruleReview],
  ]

  for (const [label, status] of expenseAreas) {
    if (!status) questions.push(`${label}: coverage has not been recorded.`)
    if (status === 'partial') questions.push(`${label}: only part of this area has been reviewed.`)
    if (status === 'not-reviewed') questions.push(`${label}: this area has not been reviewed.`)
  }
  for (const issue of expenseIssues) questions.push(`Expense/evidence coverage: ${issue}`)
  if (e.note.trim()) questions.push(`Expense/evidence note: ${e.note.trim()}`)

  return {
    version: YEAR_END_PREPARATION_VERSION,
    year: reconciliation.year,
    reconciliation,
    bankRows,
    expenses,
    handoffs: [...handoffs],
    incomeOpenQuestions: reconciliation.questions.length,
    bankReviewed: bankRows.filter(row => row.status && row.status !== 'not-checked').length,
    bankEmployers: bankRows.length,
    expenseAreasAnswered: expenseAreas.filter(([, status]) => !!status).length,
    expenseAreas: 4,
    questions,
    taxResultLocked: true,
    persistence: 'session-only',
  }
}
