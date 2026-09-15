import type { ImportedTransaction } from './importPreview'

export interface ExpenseSource extends ImportedTransaction {
  fileName: string
  key: string
}
export const MAX_SELECTED_ROWS = 50

// Match repeated uploads without relying on the filename or physical row number.
// An occurrence index keeps identical, separate rows within one file distinct.
export function identifySources(rows: ImportedTransaction[], fileName: string): ExpenseSource[] {
  const occurrences = new Map<string, number>()
  return rows.map(row => {
    const identity = JSON.stringify([row.date, row.description.trim(), row.amount])
    const occurrence = occurrences.get(identity) ?? 0
    occurrences.set(identity, occurrence + 1)
    return { ...row, fileName, key: JSON.stringify([identity, occurrence]) }
  })
}

export function unavailableReason(row: ExpenseSource, used: ReadonlyMap<string, string>): string | null {
  if (used.has(row.key)) return `Already in ${used.get(row.key)}`
  if (row.amount >= 0) return 'Incoming or zero amount'
  if (row.date < '2025-07-01' || row.date > '2026-06-30') return 'Outside 2025–26'
  if (row.amount < -1_000_000) return 'Above the expense limit'
  return null
}

export function sourceTotal(rows: ExpenseSource[]): number {
  return rows.reduce((total, row) => total + Math.round(-row.amount * 100), 0) / 100
}

export function selectionError(rows: ExpenseSource[], used: ReadonlyMap<string, string>): string | null {
  if (!rows.length) return 'Select spending rows to prepare an expense.'
  if (rows.length > MAX_SELECTED_ROWS) return `Select up to ${MAX_SELECTED_ROWS} rows for one expense.`
  if (new Set(rows.map(row => row.key)).size !== rows.length || rows.some(row => unavailableReason(row, used)))
    return 'Some selected rows are unavailable. Update your selection.'
  if (sourceTotal(rows) > 1_000_000) return 'The selected total must be no more than $1,000,000.'
  return null
}
