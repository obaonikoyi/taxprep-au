import type { Expense, Evidence, Reimbursement } from './expenseReview'

export interface ExpenseDraft {
  amount: string
  percent: string
  purpose: string
  basis: string
  reimbursement: Reimbursement | ''
  evidence: Evidence | ''
  reference: string
}
export function createExpenseDraft(initial?: Partial<Expense>): ExpenseDraft {
  return { amount: initial?.amount?.toString() ?? '', percent: initial?.workUsePercent?.toString() ?? '',
    purpose: initial?.purpose ?? '', basis: initial?.workUseBasis ?? '', reimbursement: initial?.reimbursement ?? '',
    evidence: initial?.evidence ?? '', reference: initial?.evidenceReference ?? '' }
}
