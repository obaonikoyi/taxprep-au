// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import ReportExport from './ReportExport'
import { sampleExpenses, type ExpenseReviewResult } from '../expenses/expenseReview'

const expenses = [sampleExpenses[1]]
const review: ExpenseReviewResult = { items: [{ category: 'phone', amount: 600, workUsePercent: 40, workPortion: 240, status: 'details-recorded', actions: [] }], enteredTotal: 600, workPortionTotal: 240, attentionCount: 0, unresolvedCount: 0 }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('waits for the report document before printing, then prints that frame only', async () => {
  const user = userEvent.setup(); render(<ReportExport expenses={expenses} review={review} />)
  const button = screen.getByRole('button', { name: 'Print / save PDF' })
  expect(button).toBeDisabled()
  const frame = screen.getByTitle('Preparation report preview') as HTMLIFrameElement
  expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-modals')
  frame.contentDocument!.documentElement.dataset.report = 'taxprep-expenses-v1'
  const print = vi.fn(); const focus = vi.fn()
  Object.defineProperty(frame.contentWindow, 'print', { value: print, configurable: true })
  Object.defineProperty(frame.contentWindow, 'focus', { value: focus, configurable: true })
  fireEvent.load(frame)
  await user.click(button)
  expect(print).toHaveBeenCalledOnce()
  expect(focus).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('Print requested')
})

it('reports download failure and leaves retry available', async () => {
  const createObjectURL = vi.fn().mockImplementation(() => { throw Error('unavailable') })
  vi.stubGlobal('URL', { createObjectURL })
  const user = userEvent.setup(); render(<ReportExport expenses={expenses} review={review} />)
  await user.click(screen.getByRole('button', { name: 'Download report (HTML)' }))
  expect(screen.getByRole('alert')).toHaveTextContent('download could not start')
  await user.click(screen.getByRole('button', { name: 'Download report (HTML)' }))
  expect(createObjectURL).toHaveBeenCalledTimes(2)
})

it('explains a print failure with the downloadable alternative', async () => {
  const user = userEvent.setup(); render(<ReportExport expenses={expenses} review={review} />)
  const frame = screen.getByTitle('Preparation report preview') as HTMLIFrameElement
  frame.contentDocument!.documentElement.dataset.report = 'taxprep-expenses-v1'
  Object.defineProperty(frame.contentWindow, 'focus', { value: () => {}, configurable: true })
  Object.defineProperty(frame.contentWindow, 'print', { value: () => { throw Error('blocked') }, configurable: true })
  fireEvent.load(frame)
  await user.click(screen.getByRole('button', { name: 'Print / save PDF' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Download the HTML report')
})

it('blocks report actions when supplied totals cannot be reconciled', () => {
  render(<ReportExport expenses={expenses} review={{ ...review, workPortionTotal: 900 }} />)
  expect(screen.getByRole('alert')).toHaveTextContent('could not be prepared')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
