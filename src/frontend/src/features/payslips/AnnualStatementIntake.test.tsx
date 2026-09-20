// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import AnnualStatementIntake from './AnnualStatementIntake'
import type { AnnualStatementCandidate } from './annualStatement'

const candidate: AnnualStatementCandidate = {
  id: 'hash-annual',
  hash: 'hash-annual',
  name: 'annual.pdf',
  page: 1,
  text: 'ANNUAL INCOME STATEMENT v1\nEmployer: Harbour Example Services',
  facts: {
    payer: 'Harbour Example Services',
    financialYear: '2026–27',
    statementDate: '2027-07-14',
    reference: 'Harbour payroll A',
    finalStatus: 'final',
    gross: '8250.00',
    withheld: '1315.00',
  },
  original: {
    payer: 'Harbour Example Services',
    financialYear: '2026–27',
    statementDate: '2027-07-14',
    reference: 'Harbour payroll A',
    finalStatus: 'final',
    gross: '8250.00',
    withheld: '1315.00',
  },
  unresolvedCoverage: [],
  sample: false,
}

vi.mock('./annualStatementReader', () => ({
  readAnnualStatement: vi.fn(async () => structuredClone(candidate)),
}))

afterEach(() => cleanup())

it('keeps extracted annual statement data outside reconciliation until explicit review and confirmation', async () => {
  const onAdd = vi.fn()
  render(<AnnualStatementIntake
    year="2026–27"
    employers={[['harbour example services', 'Harbour Example Services']]}
    sources={[]}
    onAdd={onAdd}
  />)

  const input = screen.getByLabelText('Upload annual statement')
  const file = new File(['fictional'], 'annual.pdf', { type: 'application/pdf' })
  fireEvent.change(input, { target: { files: [file] } })

  const review = await screen.findByRole('region', { name: 'Review extracted annual statement' })
  expect(review.textContent).toContain('annual.pdf')
  expect((screen.getByLabelText('Extracted annual statement employer') as HTMLInputElement).value).toBe('Harbour Example Services')
  expect((screen.getByLabelText('Extracted annual statement linked employer') as HTMLSelectElement).value).toBe('harbour example services')
  expect(onAdd).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Confirm and add annual source' }).hasAttribute('disabled')).toBe(true)

  fireEvent.click(screen.getByLabelText('I checked these extracted values against the annual source.'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and add annual source' }))

  await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
  const added = onAdd.mock.calls[0][0]
  expect(added).toMatchObject({
    payer: 'Harbour Example Services',
    reference: 'Harbour payroll A',
    gross: '8250.00',
    withheld: '1315.00',
    linkedEmployer: 'harbour example services',
    origin: 'document',
    reviewed: true,
    documentName: 'annual.pdf',
    documentHash: 'hash-annual',
    parserVersion: 'annual-income-statement-v1',
  })
})

it('requires review again after correcting an extracted field before transfer', async () => {
  const onAdd = vi.fn()
  render(<AnnualStatementIntake year="2026–27" employers={[]} sources={[]} onAdd={onAdd} />)

  fireEvent.change(screen.getByLabelText('Upload annual statement'), {
    target: { files: [new File(['fictional'], 'annual.pdf', { type: 'application/pdf' })] },
  })
  await screen.findByRole('region', { name: 'Review extracted annual statement' })

  fireEvent.click(screen.getByLabelText('I checked these extracted values against the annual source.'))
  fireEvent.change(screen.getByLabelText('Extracted annual statement reference'), { target: { value: 'Corrected reference' } })
  expect((screen.getByLabelText('I checked these extracted values against the annual source.') as HTMLInputElement).checked).toBe(false)
  expect(screen.getByText('Original extraction: Harbour payroll A')).toBeDefined()
  expect(onAdd).not.toHaveBeenCalled()
})
