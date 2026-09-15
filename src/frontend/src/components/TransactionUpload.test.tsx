// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import TransactionUpload from './TransactionUpload'
import type { ImportPreview } from '../features/transactions/importPreview'

const preview = (description = 'Sample row'): ImportPreview => ({ transactions: [{ rowNumber: 2, date: '2026-01-01', description, amount: -3.5 }], errors: [], netTotal: -3.5 })
const response = (data = preview()) => ({ ok: true, status: 200, json: async () => data })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('renders partial results, row errors and total, then clears them', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...preview(), errors: [{ rowNumber: 3, message: 'Invalid date.' }] })))
  const user = userEvent.setup()
  render(<TransactionUpload />)
  await user.click(screen.getByRole('button', { name: 'Try sample CSV' }))
  expect(await screen.findByText('Sample row')).toBeVisible()
  expect(screen.getByText('Row 3: Invalid date.')).toBeVisible()
  expect(screen.getByText('-$3.50 net')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Clear preview' }))
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('ignores a late response after replacing the selected file', async () => {
  let resolveOld!: (value: ReturnType<typeof response>) => void
  const fetch = vi.fn().mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve })).mockResolvedValueOnce(response(preview('New row')))
  vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup()
  render(<TransactionUpload />)
  await user.click(screen.getByRole('button', { name: 'Try sample CSV' }))
  expect(screen.getByRole('button', { name: 'Validating…' })).toBeDisabled()
  const oldSignal = fetch.mock.calls[0][1].signal as AbortSignal
  await user.upload(screen.getByLabelText('Transaction CSV'), new File(['date,description,amount\n2026-01-01,New row,-3.50'], 'new.csv', { type: 'text/csv' }))
  expect(oldSignal.aborted).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Preview transactions' }))
  expect(await screen.findByText('New row')).toBeVisible()
  await act(async () => resolveOld(response(preview('Old row'))))
  expect(screen.queryByText('Old row')).not.toBeInTheDocument()
  expect(screen.getByText('New row')).toBeVisible()
})

it('lets the user retry a failed upload', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(response()))
  const user = userEvent.setup()
  render(<TransactionUpload />)
  await user.click(screen.getByRole('button', { name: 'Try sample CSV' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach')
  await user.click(screen.getByRole('button', { name: 'Preview transactions' }))
  expect(await screen.findByText('Sample row')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('cancels a request and clears the selection', async () => {
  const fetch = vi.fn().mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('fetch', fetch)
  const user = userEvent.setup()
  render(<TransactionUpload />)
  await user.click(screen.getByRole('button', { name: 'Try sample CSV' }))
  await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
  expect(screen.getByText('No file selected')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Preview transactions' })).toBeEnabled()
})

it('recovers from the 15-second timeout', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })))
  render(<TransactionUpload />)
  await act(async () => screen.getByRole('button', { name: 'Try sample CSV' }).click())
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
  expect(screen.getByRole('alert')).toHaveTextContent('took too long')
  expect(screen.getByRole('button', { name: 'Preview transactions' })).toBeEnabled()
})
