// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import PayslipDashboard from './PayslipDashboard'

Element.prototype.scrollIntoView = () => {}
afterEach(cleanup)
const button = (name: string) => screen.getByRole('button', { name })
function fillManual() {
  fireEvent.click(button('Type the figures in yourself'))
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

it('keeps the optional outlook to one employer/year and labels changed-pay withholding as not estimated', () => {
  render(<PayslipDashboard />)
  fillManual()
  fireEvent.click(button('Confirm and continue'))
  fireEvent.change(screen.getByLabelText('Financial year', { exact: true }), { target: { value: '2026–27' } })
  fireEvent.change(screen.getByLabelText('Employer', { exact: true }), { target: { value: 'example employer' } })
  fireEvent.change(screen.getByLabelText('Next payday', { exact: true }), { target: { value: '2027-06-01' } })
  fireEvent.change(screen.getByLabelText('Pay frequency', { exact: true }), { target: { value: 'fortnightly' } })
  fireEvent.click(screen.getByLabelText('I expect these future pays to be regular, not a bonus, back pay or adjustment.', { exact: true }))
  fireEvent.click(button('Show pay outlook'))
  const result = screen.getByLabelText('Pay outlook results', { exact: true })
  expect(result.textContent).toContain('20% less gross pay')
  expect(result.textContent).toContain('20% more gross pay')
  expect(result.textContent).toContain('$300.00')
  expect(result.textContent).toContain('$400.00')
  expect(result.textContent).toContain('Not estimated')
  expect(result.textContent).toContain('Partial recorded history')
})


it('collects whole-year tax readiness facts but never unlocks a tax result', () => {
  render(<PayslipDashboard />)
  fillManual()
  fireEvent.click(button('Confirm and continue'))
  fireEvent.change(screen.getByLabelText('Financial year', { exact: true }), { target: { value: '2026–27' } })
  fireEvent.change(screen.getByLabelText('Employer', { exact: true }), { target: { value: 'example employer' } })
  fireEvent.click(button('Start tax readiness'))
  const supported: Record<string, string> = {
    resident: 'yes',
    payCoverage: 'yes',
    otherIncome: 'no',
    studyLoan: 'no',
    declarationsKnown: 'yes',
    simpleFamily: 'yes',
    medicareSpecial: 'no',
    privateHealth: 'no',
    otherAdjustments: 'no',
    irregularPay: 'no',
  }
  for (const [key, value] of Object.entries(supported)) {
    fireEvent.change(screen.getByLabelText(`Tax readiness: ${key}`, { exact: true }), { target: { value } })
  }
  fireEvent.click(button('Review tax readiness'))
  let result = screen.getByLabelText('Tax readiness result', { exact: true })
  expect(result.textContent).toContain('Profile facts collected')
  expect(result.textContent).toContain('10/10 within current profile')
  expect(result.textContent).toContain('Tax result remains locked')
  expect(result.textContent).toContain('No refund, debt or final-tax number')

  fireEvent.change(screen.getByLabelText('Tax readiness: studyLoan', { exact: true }), { target: { value: 'yes' } })
  expect(screen.queryByLabelText('Tax readiness result', { exact: true })).toBeNull()
  fireEvent.click(button('Review tax readiness'))
  result = screen.getByLabelText('Tax readiness result', { exact: true })
  expect(result.textContent).toContain('Outside current prototype')
  expect(result.textContent).toContain('study or training support loan')
  expect(result.textContent).toContain('Tax result remains locked')
})


it('reconciles a final annual employment source without adding it to payslip income', () => {
  render(<PayslipDashboard />)
  fillManual()
  fireEvent.click(button('Confirm and continue'))
  fireEvent.change(screen.getByLabelText('Financial year', { exact: true }), { target: { value: '2026–27' } })
  fireEvent.click(button('Start year-end reconciliation'))
  fireEvent.click(button('Add annual employment source'))

  fireEvent.change(screen.getByLabelText('Annual source 1: employer or payer', { exact: true }), { target: { value: 'Example employer' } })
  fireEvent.change(screen.getByLabelText('Annual source 1: source reference', { exact: true }), { target: { value: 'myGov income statement 1' } })
  fireEvent.change(screen.getByLabelText('Annual source 1: source type', { exact: true }), { target: { value: 'income-statement' } })
  fireEvent.change(screen.getByLabelText('Annual source 1: final status', { exact: true }), { target: { value: 'final' } })
  fireEvent.change(screen.getByLabelText('Annual source 1: gross income (AUD)', { exact: true }), { target: { value: '100.00' } })
  fireEvent.change(screen.getByLabelText('Annual source 1: tax withheld (AUD)', { exact: true }), { target: { value: '10.00' } })
  fireEvent.change(screen.getByLabelText('Annual source 1: linked employer', { exact: true }), { target: { value: 'example employer' } })
  fireEvent.change(screen.getByLabelText('Annual employment source coverage', { exact: true }), { target: { value: 'yes' } })

  let result = screen.getByLabelText('Year-end pay reconciliation result', { exact: true })
  expect(result.textContent).toContain('Matches checked pay history')
  expect(result.textContent).toContain('$100.00')
  expect(result.textContent).toContain('$10.00')
  expect(result.textContent).toContain('Tax result remains locked')
  expect(screen.getByText('This is your coverage statement only. It is not proof that the tax return is complete.')).toBeDefined()

  fireEvent.change(screen.getByLabelText('Annual source 1: gross income (AUD)', { exact: true }), { target: { value: '120.00' } })
  result = screen.getByLabelText('Year-end pay reconciliation result', { exact: true })
  expect(result.textContent).toContain('Annual source differs from pay history')
  expect(result.textContent).toContain('+$20.00')
  expect(result.textContent).toContain('does not decide which is legally correct')

  fireEvent.change(screen.getByLabelText('Annual source 1: final status', { exact: true }), { target: { value: 'not-final' } })
  result = screen.getByLabelText('Year-end pay reconciliation result', { exact: true })
  expect(result.textContent).toContain('Source still provisional')
  expect(result.textContent).toContain('excluded from final reconciliation totals')
})
