// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import PayslipDashboard from './PayslipDashboard'

// JSDOM has no layout/scroll implementation; real scrolling is exercised in browser CI.
Element.prototype.scrollIntoView = () => {}

it('keeps filter and review labels stable while manual edits invalidate chart inclusion', () => {
  render(<PayslipDashboard />)
  fireEvent.click(screen.getByRole('button', { name: 'Enter figures manually' }))
  expect(screen.getByLabelText('Chart grouping', { exact: true })).toBeDefined()
  expect(screen.getByLabelText('Financial year', { exact: true })).toBeDefined()
  const review = within(screen.getByRole('region', { name: 'Review payslip' }))
  for (const [name, value] of [['Employer', 'Example employer'], ['Period start', '2026-07-01'], ['Period end', '2026-07-14'], ['Pay date', '2026-07-16'], ['Gross pay (AUD)', '100'], ['Tax withheld (AUD)', '10'], ['Other deductions (AUD)', '0'], ['Net pay (AUD)', '90']]) {
    fireEvent.change(review.getByLabelText(name, { exact: true }), { target: { value } })
    expect(review.getByLabelText(name, { exact: true })).toBeDefined()
  }
  const metrics = screen.getByLabelText('Confirmed pay totals')
  expect(metrics.textContent).not.toContain('$100.00')
  fireEvent.click(review.getByRole('button', { name: 'Confirm these figures' }))
  expect(metrics.textContent).toContain('$100.00'); expect(metrics.textContent).toContain('Unknown')
  fireEvent.click(screen.getByRole('button', { name: 'Review Manual payslip 2026-07-16' }))
  fireEvent.change(screen.getByLabelText('Tax withheld (AUD)', { exact: true }), { target: { value: '' } })
  expect(metrics.textContent).not.toContain('$100.00')
  expect(screen.getByRole('button', { name: 'Confirm these figures' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByLabelText('Tax withheld (AUD)', { exact: true })).toBeDefined()
})
