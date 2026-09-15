import { expect, it } from 'vitest'
import { identifySources, selectionError, sourceTotal, unavailableReason } from './expenseImport'

const rows = [
  { rowNumber: 2, date: '2025-07-01', description: 'Phone bill', amount: -.1 },
  { rowNumber: 3, date: '2026-06-30', description: 'Phone bill', amount: -.2 },
]
it('sums spending in cents and retains original signed amounts', () => {
  const sources = identifySources(rows, 'bills.csv')
  expect(sourceTotal(sources)).toBe(.3)
  expect(sources.map(row => row.amount)).toEqual([-.1, -.2])
  expect(selectionError(sources, new Map())).toBeNull()
})
it('matches renamed/reordered uploads while distinguishing repeated rows within a file', () => {
  const sources = identifySources([rows[0], { ...rows[0], rowNumber: 3 }, rows[1]], 'bills.csv')
  expect(new Set(sources.map(row => row.key)).size).toBe(3)
  const again = identifySources([rows[1], { ...rows[0], rowNumber: 6 }, { ...rows[0], rowNumber: 7 }], 'renamed.csv')
  expect(new Set(again.map(row => row.key))).toEqual(new Set(sources.map(row => row.key)))
  expect(unavailableReason(again[1], new Map([[sources[0].key, 'Phone service']]))).toBe('Already in Phone service')
})
it.each([
  { date: '2025-06-30', amount: -1, reason: 'Outside 2025–26' },
  { date: '2026-07-01', amount: -1, reason: 'Outside 2025–26' },
  { date: '2026-01-01', amount: 1, reason: 'Incoming or zero amount' },
  { date: '2026-01-01', amount: 0, reason: 'Incoming or zero amount' },
  { date: '2026-01-01', amount: -1_000_001, reason: 'Above the expense limit' },
])('does not allow unsupported rows: $reason ($date, $amount)', ({ date, amount, reason }) => {
  const [source] = identifySources([{ ...rows[0], date, amount }], 'test.csv')
  expect(unavailableReason(source, new Map())).toBe(reason)
  expect(selectionError([source], new Map())).toBeTruthy()
})
it('rejects empty, duplicate, over-limit and over-total groups', () => {
  const sources = identifySources(rows.map(row => ({ ...row, amount: -600_000 })), 'large.csv')
  expect(selectionError([], new Map())).toMatch(/Select spending/)
  expect(selectionError([sources[0], sources[0]], new Map())).toMatch(/unavailable/)
  expect(selectionError(sources, new Map())).toMatch(/total/)
  const many = identifySources(Array.from({ length: 51 }, (_, i) => ({ ...rows[0], rowNumber: i + 2 })), 'many.csv')
  expect(selectionError(many, new Map())).toMatch(/50 rows/)
  expect(selectionError(many.slice(0, 50), new Map())).toBeNull()
})
