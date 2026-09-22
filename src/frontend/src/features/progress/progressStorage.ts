import { categories, type Expense, type ExpenseCategory } from '../expenses/expenseReview'
import type { ExpenseDraft } from '../expenses/expenseDraft'
import { selectionError, type ExpenseSource } from '../transactions/expenseImport'

export type PreparationStep = { kind: 'welcome' | 'income' | 'summary' } | { kind: 'questions'; index: number }
  | { kind: 'details'; category: ExpenseCategory; returnTo: 'questions' | 'summary'; index: number;
      draft?: { amount: number; sources: ExpenseSource[] }; fields?: ExpenseDraft }
export interface PreparationData { expenses: Expense[]; step: PreparationStep }
export interface ProgressSnapshot { version: 1; financialYear: '2025-26'; savedAt: string; data: PreparationData }
/*
 * The `taxprep-` prefix below is deliberate, and outlives the rename to Xoba
 * Paycheck (September 2026). Storage belongs to an exact origin, and
 * taxprep.3xoba.com is still live. Renaming this key would silently discard
 * the saved progress of anyone still arriving there. The move to
 * xobapaycheck.com already starts everyone fresh on the new address; there is
 * no reason to break the old one as well.
 * See docs/RENAME_TO_XOBA_PAYCHECK.md.
 */
export const PROGRESS_KEY = 'taxprep-au:preparation-progress'
export const MAX_SNAPSHOT_LENGTH = 1_000_000
export type SavedCopy = { kind: 'empty'; raw: null } | { kind: 'saved'; raw: string; snapshot: ProgressSnapshot }
  | { kind: 'invalid'; raw: string; message: string } | { kind: 'unavailable'; message: string }

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const string = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const category = (v: unknown): v is ExpenseCategory => categories.some(value => value === v)
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1_000_000 && Number(v.toFixed(2)) === v
const index = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < categories.length
const reimbursement = (v: unknown) => v === 'none' || v === 'full' || v === 'unsure'
const evidence = (v: unknown) => v === 'available' || v === 'missing' || v === 'unsure'
const isoTime = (v: unknown): v is string => typeof v === 'string' && v.length === 24 && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
const fail = (): never => { throw new Error('This saved copy is invalid or uses an unsupported format. Your current work has not changed. Delete the saved copy to save new progress.') }

function sources(value: unknown): ExpenseSource[] {
  if (!Array.isArray(value) || !value.length || value.length > 50) return fail()
  const rows = value.map(v => {
    if (!object(v) || !string(v.date, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)
      || !isoTime(v.date + 'T00:00:00.000Z') || !string(v.description, 500) || !v.description.trim()
      || typeof v.amount !== 'number' || !amount(-v.amount) || !string(v.fileName, 255) || !v.fileName
      || !Number.isSafeInteger(v.rowNumber) || (v.rowNumber as number) < 1 || (v.rowNumber as number) > 1_000_001
      || !string(v.key, 8000)) return fail()
    let key: unknown
    try { key = JSON.parse(v.key) } catch { return fail() }
    if (!Array.isArray(key) || key.length !== 2 || key[0] !== JSON.stringify([v.date, v.description.trim(), v.amount])
      || !Number.isInteger(key[1]) || key[1] < 0 || key[1] >= 5000) return fail()
    return { date: v.date, description: v.description, amount: v.amount, fileName: v.fileName, rowNumber: v.rowNumber as number, key: v.key }
  })
  if (selectionError(rows, new Map())) return fail()
  return rows
}
function expense(value: unknown): Expense {
  if (!object(value) || !category(value.category) || !amount(value.amount) || typeof value.workUsePercent !== 'number'
    || !Number.isInteger(value.workUsePercent) || value.workUsePercent < 0 || value.workUsePercent > 100
    || !string(value.purpose, 300) || !string(value.workUseBasis, 300) || !string(value.evidenceReference, 120)
    || !reimbursement(value.reimbursement) || !evidence(value.evidence)) return fail()
  return { category: value.category, amount: value.amount, workUsePercent: value.workUsePercent,
    purpose: value.purpose, workUseBasis: value.workUseBasis, reimbursement: value.reimbursement as Expense['reimbursement'],
    evidence: value.evidence as Expense['evidence'], evidenceReference: value.evidenceReference,
    ...(value.sources === undefined ? {} : { sources: sources(value.sources) }) }
}
function draftFields(v: unknown): ExpenseDraft {
  if (!object(v) || !string(v.amount, 12) || !string(v.percent, 3) || !string(v.purpose, 300)
    || !string(v.basis, 300) || !string(v.reference, 120) || !(v.reimbursement === '' || reimbursement(v.reimbursement))
    || !(v.evidence === '' || evidence(v.evidence))) return fail()
  // Incomplete or invalid number text is intentional here; Save expense still validates it.
  return { amount: v.amount, percent: v.percent, purpose: v.purpose, basis: v.basis, reference: v.reference,
    reimbursement: v.reimbursement as ExpenseDraft['reimbursement'], evidence: v.evidence as ExpenseDraft['evidence'] }
}
function step(v: unknown): PreparationStep {
  if (!object(v)) return fail()
  if (v.kind === 'welcome' || v.kind === 'income' || v.kind === 'summary') return { kind: v.kind }
  if (v.kind === 'questions' && index(v.index)) return { kind: 'questions', index: v.index }
  if (v.kind !== 'details' || !category(v.category) || !index(v.index) || (v.returnTo !== 'questions' && v.returnTo !== 'summary')
    || (v.returnTo === 'questions' && categories[v.index] !== v.category)) return fail()
  let imported: { amount: number; sources: ExpenseSource[] } | undefined
  if (v.draft !== undefined) {
    if (!object(v.draft) || !amount(v.draft.amount) || v.returnTo !== 'summary') return fail()
    imported = { amount: v.draft.amount, sources: sources(v.draft.sources) }
  }
  return { kind: 'details', category: v.category, index: v.index, returnTo: v.returnTo,
    ...(imported ? { draft: imported } : {}), ...(v.fields === undefined ? {} : { fields: draftFields(v.fields) }) }
}
export function parseProgress(raw: string): ProgressSnapshot {
  if (raw.length > MAX_SNAPSHOT_LENGTH) return fail()
  let v: unknown
  try { v = JSON.parse(raw) } catch { return fail() }
  if (!object(v) || v.version !== 1 || v.financialYear !== '2025-26' || !isoTime(v.savedAt)
    || !object(v.data) || !Array.isArray(v.data.expenses) || v.data.expenses.length > 3) return fail()
  const expenses = v.data.expenses.map(expense)
  const currentStep = step(v.data.step)
  const used = expenses.flatMap(item => item.sources?.map(row => row.key) ?? [])
  if (new Set(expenses.map(item => item.category)).size !== expenses.length || new Set(used).size !== used.length) return fail()
  if (currentStep.kind === 'details' && currentStep.draft && (expenses.some(item => item.category === currentStep.category)
    || currentStep.draft.sources.some(row => used.includes(row.key)))) return fail()
  return { version: 1, financialYear: '2025-26', savedAt: v.savedAt, data: { expenses, step: currentStep } }
}
export function encodeProgress(data: PreparationData, now = new Date()): string {
  return JSON.stringify(parseProgress(JSON.stringify({ version: 1, financialYear: '2025-26', savedAt: now.toISOString(), data })))
}
export function readProgress(): SavedCopy {
  let raw: string | null
  try { raw = window.localStorage.getItem(PROGRESS_KEY) }
  catch { return { kind: 'unavailable', message: 'Browser storage is unavailable. Your work can continue in this tab, but it cannot be saved here.' } }
  if (raw === null) return { kind: 'empty', raw }
  try { return { kind: 'saved', raw, snapshot: parseProgress(raw) } }
  catch (error) { return { kind: 'invalid', raw, message: error instanceof Error ? error.message : 'The saved copy could not be read.' } }
}
