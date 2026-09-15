import { afterEach, expect, it, vi } from 'vitest'
import { fetchExpenseReview, sampleExpenses, type ExpenseReviewResult } from './expenseReview'

const phone = sampleExpenses[1]
const result: ExpenseReviewResult = {
  items: [{ category: 'phone', amount: 600, workUsePercent: 40, workPortion: 240, status: 'details-recorded', actions: [] }],
  enteredTotal: 600, workPortionTotal: 240, attentionCount: 0, unresolvedCount: 0,
}
afterEach(() => vi.unstubAllGlobals())
it('sends JSON and cancellation signal, accepting the matching response', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => result })
  vi.stubGlobal('fetch', fetch)
  const signal = new AbortController().signal
  expect(await fetchExpenseReview([phone], signal)).toEqual(result)
  expect(fetch).toHaveBeenCalledWith('/api/expenses/review', expect.objectContaining({ signal, method: 'POST', body: JSON.stringify({ expenses: [phone] }), headers: { 'Content-Type': 'application/json' } }))
})
it.each([
  null,
  { ...result, workPortionTotal: '240' },
  { ...result, items: [] },
  { ...result, items: [{ ...result.items[0], amount: 100 }] },
  { ...result, items: [{ ...result.items[0], status: 'approved' }] },
  { ...result, items: [{ ...result.items[0], workPortion: 1000 }] },
])('rejects incompatible or mismatched responses (%#)', async data => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
  await expect(fetchExpenseReview([phone], new AbortController().signal)).rejects.toThrow('unexpected response')
})
it.each([400, 413, 500])('reports HTTP %s without displaying server internals', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ message: 'internal exception' }) }))
  await expect(fetchExpenseReview([phone], new AbortController().signal)).rejects.toThrow(/could not|unavailable/)
})
it('handles an unavailable service and malformed JSON', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => { throw Error('html') } })
  vi.stubGlobal('fetch', fetch)
  await expect(fetchExpenseReview([phone], new AbortController().signal)).rejects.toThrow('Could not reach')
  await expect(fetchExpenseReview([phone], new AbortController().signal)).rejects.toThrow('unreadable')
})
