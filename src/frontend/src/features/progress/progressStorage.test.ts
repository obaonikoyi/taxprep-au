// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createExpenseDraft } from '../expenses/expenseDraft'
import { sampleExpenses } from '../expenses/expenseReview'
import { identifySources } from '../transactions/expenseImport'
import { encodeProgress, MAX_SNAPSHOT_LENGTH, parseProgress, PROGRESS_KEY, readProgress, type PreparationData } from './progressStorage'

const data: PreparationData = { expenses: sampleExpenses, step: { kind: 'summary' } }
const now = new Date('2026-09-17T09:00:00.000Z')
const source = identifySources([{ rowNumber: 2, date: '2025-07-01', description: 'Phone Café 中文', amount: -20.1 }], 'phone.csv')
const imported: PreparationData = { expenses: [], step: { kind: 'details', category: 'phone', returnTo: 'summary', index: 0,
  draft: { amount: 20.1, sources: source }, fields: { ...createExpenseDraft(), amount: '20.', percent: 'abc', purpose: 'unfinished\nnote' } } }
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

it('round-trips completed records and keeps a versioned, dated, minimal snapshot', () => {
  const raw = encodeProgress(data, now)
  expect(parseProgress(raw)).toEqual({ version: 1, financialYear: '2025-26', savedAt: now.toISOString(), data })
  const extended = { ...JSON.parse(raw), report: '<html>stale</html>', apiResult: { total: 42 } }
  expect(parseProgress(JSON.stringify(extended))).not.toHaveProperty('report')
  expect(parseProgress(JSON.stringify(extended))).not.toHaveProperty('apiResult')
})
it('preserves incomplete text and imported draft references without approving the draft', () => {
  expect(parseProgress(encodeProgress(imported, now)).data).toEqual(imported)
})
it('preserves nonzero source occurrence identities when earlier identical rows were not selected', () => {
  const repeated = identifySources([{ rowNumber: 2, date: '2025-07-01', description: 'Bill', amount: -1 }, { rowNumber: 3, date: '2025-07-01', description: 'Bill', amount: -1 }], 'bills.csv')
  const records = [{ ...sampleExpenses[1], sources: [repeated[1]] }]
  expect(parseProgress(encodeProgress({ expenses: records, step: { kind: 'summary' } })).data.expenses[0].sources).toEqual([repeated[1]])
})
it.each([
  ['unsupported version', (v: any) => { v.version = 2 }],
  ['wrong year', (v: any) => { v.financialYear = '2026-27' }],
  ['invalid timestamp', (v: any) => { v.savedAt = 'yesterday' }],
  ['duplicate category', (v: any) => { v.data.expenses[1] = v.data.expenses[0] }],
  ['amount precision', (v: any) => { v.data.expenses[0].amount = 1.001 }],
  ['invalid percentage', (v: any) => { v.data.expenses[0].workUsePercent = 101 }],
  ['unknown reimbursement', (v: any) => { v.data.expenses[0].reimbursement = 'yes' }],
  ['long note', (v: any) => { v.data.expenses[0].purpose = 'x'.repeat(301) }],
  ['question index', (v: any) => { v.data.step = { kind: 'questions', index: 3 } }],
  ['wrong question category', (v: any) => { v.data.step = { kind: 'details', category: 'phone', index: 0, returnTo: 'questions' } }],
])('rejects %s', (_name, mutate) => {
  const value = JSON.parse(encodeProgress(data, now)); mutate(value)
  expect(() => parseProgress(JSON.stringify(value))).toThrow()
})
it.each([
  ['invalid source key', (v: any) => { v.data.step.draft.sources[0].key = 'invalid' }],
  ['impossible date', (v: any) => { v.data.step.draft.sources[0].date = '2026-02-30' }],
  ['outside year', (v: any) => { v.data.step.draft.sources = identifySources([{ rowNumber: 2, date: '2026-07-01', description: 'Bill', amount: -1 }], 'bills.csv') }],
  ['duplicate source', (v: any) => { v.data.step.draft.sources.push(v.data.step.draft.sources[0]) }],
  ['invalid draft field', (v: any) => { v.data.step.fields.amount = null }],
  ['too many source rows', (v: any) => { v.data.step.draft.sources = Array(51).fill(v.data.step.draft.sources[0]) }],
  ['occupied imported category', (v: any) => { v.data.expenses = [sampleExpenses[1]] }],
])('rejects %s', (_name, mutate) => {
  const value = JSON.parse(encodeProgress(imported, now)); mutate(value)
  expect(() => parseProgress(JSON.stringify(value))).toThrow()
})
it('rejects source reuse across saved records and a pending import', () => {
  const shared = [{ ...sampleExpenses[0], sources: source }, { ...sampleExpenses[1], sources: source }]
  expect(() => encodeProgress({ expenses: shared, step: { kind: 'summary' } })).toThrow()
  expect(() => encodeProgress({ ...imported, expenses: [shared[0]] })).toThrow()
})
it('does not silently remove malformed, oversized or incompatible copies', () => {
  for (const raw of ['{broken', 'x'.repeat(MAX_SNAPSHOT_LENGTH + 1), '{"version":99}']) {
    localStorage.setItem(PROGRESS_KEY, raw)
    expect(readProgress().kind).toBe('invalid')
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw)
  }
})
it('handles inaccessible browser storage', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
  expect(readProgress().kind).toBe('unavailable')
})
