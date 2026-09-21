// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Payslip } from '../payslips/payslip'
import { blankYearEndPreparationAnswers } from '../payslips/yearEndPreparation'
import { reconcileYearEndPay, type AnnualPaySource } from '../payslips/yearEndReconciliation'
import PreparationBackupPanel from './PreparationBackupPanel'
import type { PreparationBackupPayload } from './preparationBackup'

const mocks = vi.hoisted(() => ({
  readEncryptedPreparationBackup: vi.fn(),
  decryptPreparationBackup: vi.fn(),
  createPreparationBackup: vi.fn(),
  downloadPreparationBackup: vi.fn(),
}))

vi.mock('./preparationBackup', async importOriginal => {
  const actual = await importOriginal<typeof import('./preparationBackup')>()
  return { ...actual, ...mocks }
})

afterEach(() => cleanup())

beforeEach(() => {
  vi.clearAllMocks()
})

function reconciliation() {
  const slip: Payslip = {
    id: 'p1',
    name: 'pay.pdf',
    hash: 'a'.repeat(64),
    text: '',
    original: { employer: 'Harbour Example Services', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16', gross: '1000', withheld: '150', deductions: '0', net: '850', super: '', hours: '', rate: '', ordinary: '' },
    facts: { employer: 'Harbour Example Services', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16', gross: '1000', withheld: '150', deductions: '0', net: '850', super: '', hours: '', rate: '', ordinary: '' },
    confirmed: true,
    sample: false,
  }
  const annual: AnnualPaySource = {
    id: 'a1',
    payer: 'Harbour Example Services',
    reference: 'Annual source A',
    gross: '1000',
    withheld: '150',
    sourceType: 'income-statement',
    finalStatus: 'final',
    linkedEmployer: 'harbour example services',
    origin: 'manual',
    reviewed: true,
  }
  return reconcileYearEndPay([slip], '2026–27', [annual], 'yes')
}

it('keeps decrypted backup as a candidate until explicit restore', async () => {
  const answers = blankYearEndPreparationAnswers()
  answers.expenses.note = 'Restored preparation note'
  const payload: PreparationBackupPayload = {
    version: 'taxprep-year-end-preparation-payload-v1',
    financialYear: '2026–27',
    reconciliationFingerprint: 'f'.repeat(64),
    createdAt: '2026-09-20T10:00:00.000Z',
    answers,
    handoffs: [],
  }
  mocks.readEncryptedPreparationBackup.mockResolvedValue({ version: 'taxprep-year-end-preparation-backup-v1' })
  mocks.decryptPreparationBackup.mockResolvedValue(payload)
  const onRestore = vi.fn()

  render(<PreparationBackupPanel reconciliation={reconciliation()} answers={blankYearEndPreparationAnswers()} handoffs={[]} onRestore={onRestore} />)

  const file = new File(['encrypted'], 'backup.json', { type: 'application/json' })
  fireEvent.change(screen.getByLabelText('Import encrypted preparation backup'), { target: { files: [file] } })
  await screen.findByText(/Encrypted backup selected/)
  fireEvent.change(screen.getByLabelText('Restore year-end backup passphrase'), { target: { value: 'correct horse battery staple' } })
  fireEvent.click(screen.getByRole('button', { name: 'Decrypt and check backup' }))

  await screen.findByRole('region', { name: 'Review decrypted preparation backup' })
  expect(onRestore).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Restore preparation answers' }))
  expect(onRestore).toHaveBeenCalledTimes(1)
  expect(onRestore.mock.calls[0][0].answers.expenses.note).toBe('Restored preparation note')
})

it('does not create a backup when confirmation passphrase differs', async () => {
  render(<PreparationBackupPanel reconciliation={reconciliation()} answers={blankYearEndPreparationAnswers()} handoffs={[]} onRestore={vi.fn()} />)

  fireEvent.change(screen.getByLabelText('Year-end backup passphrase'), { target: { value: 'correct horse battery staple' } })
  fireEvent.change(screen.getByLabelText('Confirm year-end backup passphrase'), { target: { value: 'different horse battery staple' } })
  fireEvent.click(screen.getByRole('button', { name: 'Download encrypted preparation backup' }))

  expect((await screen.findByRole('alert')).textContent).toContain('do not match')
  expect(mocks.createPreparationBackup).not.toHaveBeenCalled()
})
