// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import PayslipDashboard from './PayslipDashboard'

Element.prototype.scrollIntoView = () => {}
afterEach(cleanup)
const button = (name: string) => screen.getByRole('button', { name })
function fillManual() {
  fireEvent.click(button('Enter figures manually'))
  const review = within(screen.getByRole('region', { name: 'Review payslip' }))
  for (const [name, value] of [['Employer', 'Example employer'], ['Period start', '2026-07-01'], ['Period end', '2026-07-14'], ['Pay date', '2026-07-16'], ['Gross pay (AUD)', '100'], ['Tax withheld (AUD)', '10'], ['Other deductions (AUD)', '0'], ['Net pay (AUD)', '90']]) {
    fireEvent.change(review.getByLabelText(name, { exact: true }), { target: { value } })
    expect(review.getByLabelText(name, { exact: true })).toBeDefined()
  }
}
it('takes manual figures through review to summary and excludes unconfirmed corrections', () => {
  render(<PayslipDashboard />)
  expect(button('View summary').hasAttribute('disabled')).toBe(true)
  fillManual()
  expect(button('Check figures').getAttribute('aria-current')).toBe('step')
  expect(screen.queryByLabelText('Confirmed pay totals')).toBeNull()
  fireEvent.click(button('Confirm and continue'))
  expect(button('View summary').getAttribute('aria-current')).toBe('step')
  expect(screen.getByRole('heading', { name: 'Your pay at a glance' })).toBe(document.activeElement)
  expect(screen.getByLabelText('Confirmed pay totals').textContent).toContain('$100.00')
  expect(screen.getByLabelText('Confirmed pay totals').textContent).toContain('Unknown')
  expect(screen.getByLabelText('Chart grouping', { exact: true })).toBeDefined()
  fireEvent.click(button('Review or edit payslips'))
  fireEvent.change(screen.getByLabelText('Tax withheld (AUD)', { exact: true }), { target: { value: '' } })
  expect(button('Confirm and continue').hasAttribute('disabled')).toBe(true)
  fireEvent.click(button('View summary'))
  expect(screen.queryByLabelText('Confirmed pay totals')).toBeNull()
  expect(screen.getByText('1 payslip still to check')).toBeDefined()
  fireEvent.click(button('Check remaining payslips'))
  expect((screen.getByLabelText('Tax withheld (AUD)') as HTMLInputElement).value).toBe('')
})
it('preserves history between steps and makes clearing a deliberate choice', () => {
  render(<PayslipDashboard />)
  fillManual()
  fireEvent.click(button('Add payslips'))
  fireEvent.click(button('Check figures'))
  expect((screen.getByLabelText('Employer', { exact: true }) as HTMLInputElement).value).toBe('Example employer')
  fireEvent.click(button('Clear pay history'))
  fireEvent.click(button('Keep my history'))
  expect(screen.getByLabelText('Employer', { exact: true })).toBeDefined()
  fireEvent.click(button('Clear pay history'))
  fireEvent.click(button('Yes, clear history'))
  expect(button('Add payslips').getAttribute('aria-current')).toBe('step')
  expect(button('Check figures').hasAttribute('disabled')).toBe(true)
  expect(screen.queryByRole('region', { name: 'Review payslip' })).toBeNull()
})
