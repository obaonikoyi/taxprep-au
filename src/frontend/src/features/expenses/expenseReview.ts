import type { ExpenseSource } from '../transactions/expenseImport'

export const categories = ['travel', 'phone', 'protective-clothing'] as const
export type ExpenseCategory = typeof categories[number]
export type Evidence = 'available' | 'missing' | 'unsure'
export type Reimbursement = 'none' | 'full' | 'unsure'
export interface Expense {
  category: ExpenseCategory
  amount: number
  workUsePercent: number
  purpose: string
  workUseBasis: string
  reimbursement: Reimbursement
  evidence: Evidence
  evidenceReference: string
  sources?: ExpenseSource[]
}
export interface ReviewedExpense {
  category: ExpenseCategory
  amount: number
  workUsePercent: number
  workPortion: number | null
  status: 'excluded' | 'needs-attention' | 'details-recorded'
  actions: string[]
}
export interface ExpenseReviewResult {
  items: ReviewedExpense[]
  enteredTotal: number
  workPortionTotal: number
  unresolvedCount: number
  attentionCount: number
}
export const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
export const categoryLabels: Record<ExpenseCategory, string> = {
  travel: 'Transport fares', phone: 'Phone service', 'protective-clothing': 'Protective clothing',
}
export const evidenceLabels: Record<Evidence, string> = {
  available: 'Evidence available', missing: 'Evidence missing', unsure: 'Evidence to check',
}
export const reimbursementLabels: Record<Reimbursement, string> = {
  none: 'Not reimbursed', full: 'Fully reimbursed', unsure: 'Partly reimbursed / unsure',
}
export const sampleExpenses: Expense[] = [
  { category: 'travel', amount: 72.6, workUsePercent: 100, purpose: 'Bus fares between client visits.', workUseBasis: 'Fares for these two work journeys only.', reimbursement: 'none', evidence: 'missing', evidenceReference: '' },
  { category: 'phone', amount: 600, workUsePercent: 40, purpose: 'Calls and messages for shift coordination.', workUseBasis: 'Fictional usage diary: 40% work use.', reimbursement: 'none', evidence: 'available', evidenceReference: 'Sample phone bills and usage diary' },
  { category: 'protective-clothing', amount: 120, workUsePercent: 100, purpose: 'Protective gloves for work tasks.', workUseBasis: 'Used only during work shifts.', reimbursement: 'full', evidence: 'available', evidenceReference: 'Sample receipt and reimbursement record' },
]

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object'
const money = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 3_000_000
const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3

export function isExpenseReview(value: unknown, expenses: Expense[]): value is ExpenseReviewResult {
  if (!object(value) || !Array.isArray(value.items) || value.items.length !== expenses.length) return false
  const items = value.items
  return money(value.enteredTotal) && money(value.workPortionTotal)
    && count(value.unresolvedCount) && count(value.attentionCount)
    && new Set(items.map(x => object(x) ? x.category : null)).size === items.length
    && items.every(item => object(item) && expenses.some(expense => expense.category === item.category
      && expense.amount === item.amount && expense.workUsePercent === item.workUsePercent)
      && (item.workPortion === null || (money(item.workPortion) && item.workPortion <= (item.amount as number)))
      && ['excluded', 'needs-attention', 'details-recorded'].includes(String(item.status))
      && Array.isArray(item.actions) && item.actions.every(action => typeof action === 'string'))
}

export async function fetchExpenseReview(expenses: Expense[], signal: AbortSignal): Promise<ExpenseReviewResult> {
  let response: Response
  try {
    response = await fetch('/api/expenses/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenses: expenses.map(({ category, amount, workUsePercent, purpose, workUseBasis, reimbursement, evidence, evidenceReference }) =>
        ({ category, amount, workUsePercent, purpose, workUseBasis, reimbursement, evidence, evidenceReference })) }), signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Could not reach the review service. Your entries are still here; try again.')
  }
  if (response.status >= 500) throw new Error('The review service is unavailable. Your entries are still here; try again.')
  if (!response.ok) throw new Error('The review could not be completed. Check your expense details and try again.')
  let data: unknown
  try { data = await response.json() } catch { throw new Error('The review service returned an unreadable response. Try again.') }
  if (!isExpenseReview(data, expenses)) throw new Error('The review service returned an unexpected response. Try again.')
  return data
}
