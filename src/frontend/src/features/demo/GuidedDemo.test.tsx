// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import GuidedDemo from './GuidedDemo'
import type { ExpenseReviewResult } from '../expenses/expenseReview'

const sampleReview: ExpenseReviewResult = {
  items: [
    { category: 'travel', amount: 72.6, workUsePercent: 100, workPortion: 72.6, status: 'needs-attention', actions: ['Find or check the supporting evidence.'] },
    { category: 'phone', amount: 600, workUsePercent: 40, workPortion: 240, status: 'details-recorded', actions: [] },
    { category: 'protective-clothing', amount: 120, workUsePercent: 100, workPortion: 0, status: 'excluded', actions: ['Fully reimbursed: excluded from the work-portion total.'] },
  ], enteredTotal: 792.6, workPortionTotal: 312.6, attentionCount: 1, unresolvedCount: 0,
}
const response = (result = sampleReview) => ({ ok: true, status: 200, json: async () => result })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('skips every category without calling the API and lets the visitor add one later', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup(); render(<GuidedDemo />)
  await user.click(screen.getByRole('button', { name: 'Try demo' }))
  await user.click(screen.getByRole('button', { name: 'Information is correct' }))
  for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: /^No/ }))
  expect(screen.getByText('No expenses recorded')).toBeVisible()
  expect(fetch).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Add phone service' }))
  expect(screen.getByRole('heading', { name: 'Phone service details' })).toHaveFocus()
  expect(screen.getByLabelText('Amount paid (AUD)')).toHaveValue('')
})

it('validates entries, saves a phone expense and shows the server work portion', async () => {
  const fetch = vi.fn().mockResolvedValue(response({ ...sampleReview, items: [{ ...sampleReview.items[1], amount: 100, workPortion: 40 }], enteredTotal: 100, workPortionTotal: 40, attentionCount: 0 }))
  vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup(); render(<GuidedDemo />)
  await user.click(screen.getByRole('button', { name: 'Try demo' }))
  await user.click(screen.getByRole('button', { name: 'Information is correct' }))
  await user.click(screen.getByRole('button', { name: /^No/ }))
  await user.click(screen.getByRole('button', { name: /^Yes/ }))
  await user.click(screen.getByRole('button', { name: 'Save expense' }))
  expect(screen.getByRole('alert')).toHaveTextContent('highlighted')
  expect(screen.getByLabelText('Amount paid (AUD)')).toHaveFocus()
  expect(fetch).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Use example details' }))
  await user.clear(screen.getByLabelText('Amount paid (AUD)')); await user.type(screen.getByLabelText('Amount paid (AUD)'), '100')
  await user.clear(screen.getByLabelText('Work use (%)')); await user.type(screen.getByLabelText('Work use (%)'), '101')
  await user.click(screen.getByRole('button', { name: 'Save expense' }))
  expect(screen.getByText('Enter a whole percentage from 0 to 100.')).toBeVisible()
  await user.clear(screen.getByLabelText('Work use (%)')); await user.type(screen.getByLabelText('Work use (%)'), '40')
  await user.click(screen.getByRole('button', { name: 'Save expense' }))
  await user.click(screen.getByRole('button', { name: /^No/ }))
  expect(await screen.findByText('$40.00 recorded work portion')).toBeVisible()
  expect(JSON.parse(fetch.mock.calls[0][1].body).expenses[0]).toMatchObject({ amount: 100, workUsePercent: 40 })
})

it('loads the example, preserves cancelled edits, and removes entries with fresh totals', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response()).mockResolvedValueOnce(response({ ...sampleReview, items: sampleReview.items.filter(item => item.category !== 'phone'), enteredTotal: 192.6, workPortionTotal: 72.6 }))
  vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup(); render(<GuidedDemo />)
  await user.click(screen.getByRole('button', { name: 'Explore example summary' }))
  expect(await screen.findByText('$312.60')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Edit phone service' }))
  await user.clear(screen.getByLabelText('Amount paid (AUD)')); await user.type(screen.getByLabelText('Amount paid (AUD)'), '900')
  await user.click(screen.getByRole('button', { name: 'Cancel changes' }))
  expect(await screen.findByText('$312.60')).toBeVisible()
  expect(within(screen.getByRole('article', { name: 'Phone service' })).getByText('$600.00 × 40% work use')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Remove phone service' }))
  expect(await screen.findByText('$192.60')).toBeVisible()
  expect(screen.queryByText('$312.60')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add phone service' })).toBeVisible()
})

it('changes evidence and reimbursement without approving uncertain amounts', async () => {
  const changed = { ...sampleReview, items: sampleReview.items.map(item => item.category === 'phone' ? { ...item, workPortion: null, status: 'needs-attention' as const, actions: ['Clarify the reimbursement amount before including a work portion.'] } : item), workPortionTotal: 72.6, unresolvedCount: 1, attentionCount: 2 }
  const fetch = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response(changed)); vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup(); render(<GuidedDemo />)
  await user.click(screen.getByRole('button', { name: 'Explore example summary' }))
  await screen.findByText('$312.60')
  await user.click(screen.getByRole('button', { name: 'Edit phone service' }))
  await user.selectOptions(screen.getByLabelText('Was Sarah reimbursed?'), 'unsure')
  await user.selectOptions(screen.getByLabelText('Supporting evidence'), 'missing')
  await user.click(screen.getByRole('button', { name: 'Save expense' }))
  expect(await screen.findByText(/Partial total:/)).toBeVisible()
  expect(screen.getByText('Work portion unresolved')).toBeVisible()
  const body = JSON.parse(fetch.mock.calls[1][1].body)
  expect(body.expenses.find((item: { category: string }) => item.category === 'phone')).toMatchObject({ evidence: 'missing', evidenceReference: '', reimbursement: 'unsure' })
})

it('keeps entries after failure and retries the same request', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(response()); vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup(); render(<GuidedDemo />)
  await user.click(screen.getByRole('button', { name: 'Explore example summary' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('entries are still here')
  expect(screen.getByText('$600.00 × 40% work use')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Retry review' }))
  expect(await screen.findByText('$312.60')).toBeVisible()
  expect(fetch.mock.calls[1][1].body).toEqual(fetch.mock.calls[0][1].body)
})

it('aborts on restart and ignores a late response, with a clean new session', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void
  const fetch = vi.fn().mockReturnValue(new Promise(r => { resolve = r })); vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup(); render(<GuidedDemo />)
  await user.click(screen.getByRole('button', { name: 'Explore example summary' }))
  await user.click(screen.getByRole('button', { name: 'Restart demo' }))
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => resolve(response()))
  expect(screen.queryByText('$312.60')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Try demo' }))
  await user.click(screen.getByRole('button', { name: 'Information is correct' }))
  await user.click(screen.getByRole('button', { name: /^Yes/ }))
  expect(screen.getByLabelText('Amount paid (AUD)')).toHaveValue('')
})

it('times out even if the transport never settles', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockReturnValue(new Promise(() => {})); vi.stubGlobal('fetch', fetch)
  render(<GuidedDemo />)
  await act(async () => screen.getByRole('button', { name: 'Explore example summary' }).click())
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
  expect(screen.getByRole('alert')).toHaveTextContent('took too long')
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
  expect(screen.getByRole('button', { name: 'Retry review' })).toBeEnabled()
})
