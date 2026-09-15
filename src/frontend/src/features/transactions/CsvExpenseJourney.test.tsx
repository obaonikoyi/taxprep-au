// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import GuidedDemo from '../demo/GuidedDemo'

const transactions = [
  { rowNumber: 2, date: '2025-07-01', description: 'July phone', amount: -20.1 },
  { rowNumber: 3, date: '2025-08-01', description: 'August phone', amount: -30.2 },
  { rowNumber: 4, date: '2026-07-01', description: 'Next year', amount: -1 },
  { rowNumber: 5, date: '2026-01-01', description: 'Pay', amount: 200 },
]
const review = { items: [{ category: 'phone', amount: 50.3, workUsePercent: 50, workPortion: 25.15, status: 'needs-attention', actions: ['Find or check the supporting evidence.'] }], enteredTotal: 50.3, workPortionTotal: 25.15, attentionCount: 1, unresolvedCount: 0 }
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data })
function setup() {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(response(url.includes('import-preview') ? { transactions, errors: [], netTotal: 148.7 } : review)))
  vi.stubGlobal('fetch', fetch)
  render(<GuidedDemo />)
  return { user: userEvent.setup(), fetch }
}
const row = (n: number) => screen.getByRole('checkbox', { name: new RegExp(`^Select row ${n}:`) })
async function startDraft(user: ReturnType<typeof userEvent.setup>) {
  await user.click(row(2)); await user.click(row(3))
  await user.selectOptions(screen.getByLabelText('Expense category'), 'phone')
  await user.click(screen.getByRole('button', { name: 'Review selected spending' }))
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('groups rows, requires explicit answers, excludes source metadata from the API and exports source references', async () => {
  const { user, fetch } = setup()
  await user.click(screen.getByRole('button', { name: 'Try sample CSV' }))
  await screen.findByRole('checkbox', { name: /^Select row 2:/ })
  expect(row(4)).toBeDisabled(); expect(row(5)).toBeDisabled()
  await startDraft(user)
  expect(screen.getByLabelText('Amount paid (AUD)')).toHaveValue('50.3')
  expect(screen.getByLabelText('Work use (%)')).toHaveValue('')
  expect(screen.getByLabelText('Was Sarah reimbursed?')).toHaveValue('')
  expect(screen.getByLabelText('Supporting evidence')).toHaveValue('')
  expect(screen.getByRole('heading', { name: 'Phone service details' })).toHaveFocus()
  expect(screen.queryByRole('button', { name: 'Use example details' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save expense' }))
  expect(screen.getByLabelText('Work use (%)')).toHaveFocus()
  expect(fetch).toHaveBeenCalledTimes(1)
  await user.type(screen.getByLabelText('Work use (%)'), '50')
  await user.selectOptions(screen.getByLabelText('Was Sarah reimbursed?'), 'none')
  await user.selectOptions(screen.getByLabelText('Supporting evidence'), 'missing')
  await user.click(screen.getByRole('button', { name: 'Save expense' }))
  await screen.findByText('$25.15 recorded work portion')
  expect(JSON.parse(fetch.mock.calls[1][1].body).expenses[0]).not.toHaveProperty('sources')
  const html = screen.getByTitle('Preparation report preview').getAttribute('srcdoc')!
  const doc = new DOMParser().parseFromString(html, 'text/html')
  expect(doc.querySelectorAll('.report-sources tbody tr')).toHaveLength(2)
  expect(doc.querySelector('.report-sources')?.textContent).toContain('July phone')
  expect(doc.querySelector('.report-sources')?.textContent).not.toContain('Next year')
  expect(row(2)).toBeDisabled(); expect(row(3)).toBeDisabled()
  expect(screen.getByRole('option', { name: /Phone service — already recorded/ })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Clear preview' }))
  expect(screen.getByRole('button', { name: 'Download report (HTML)' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Try sample CSV' }))
  await screen.findByRole('checkbox', { name: /^Select row 2:/ })
  expect(row(2)).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Remove phone service' }))
  expect(row(2)).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Download report (HTML)' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Restart demo' }))
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByText('No file selected')).toBeVisible()
})

it('keeps a draft snapshot across preview replacement and cancellation leaves rows available', async () => {
  const { user, fetch } = setup()
  await user.click(screen.getByRole('button', { name: 'Try sample CSV' }))
  await screen.findByRole('checkbox', { name: /^Select row 2:/ }); await startDraft(user)
  await user.click(screen.getByRole('button', { name: 'Clear preview' }))
  expect(screen.getByLabelText('Amount paid (AUD)')).toHaveValue('50.3')
  await user.click(screen.getByRole('button', { name: 'Cancel changes' }))
  expect(screen.getByText('No expenses recorded')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Try sample CSV' }))
  await screen.findByRole('checkbox', { name: /^Select row 2:/ })
  expect(row(2)).toBeEnabled()
  expect(screen.getByRole('option', { name: 'Phone service' })).toBeEnabled()
})
