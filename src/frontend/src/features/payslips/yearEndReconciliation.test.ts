import { describe, expect, it } from 'vitest'
import type { Payslip } from './payslip'
import {
  blankAnnualPaySource,
  duplicateAnnualSourceIds,
  payCoverageForYear,
  reconcileYearEndPay,
  type AnnualPaySource,
} from './yearEndReconciliation'
import { yearEndReconciliationReport } from './yearEndReconciliationReport'

function slip(id: string, employer: string, payDate: string, gross: string, withheld: string, confirmed = true): Payslip {
  return {
    id,
    name: `${id}.pdf`,
    hash: `hash-${id}`,
    text: '',
    original: { employer, periodStart: payDate, periodEnd: payDate, payDate, gross, withheld, deductions: '0', net: String(Number(gross) - Number(withheld)), super: '' },
    facts: { employer, periodStart: payDate, periodEnd: payDate, payDate, gross, withheld, deductions: '0', net: String(Number(gross) - Number(withheld)), super: '' },
    confirmed,
    sample: false,
  }
}

function annual(id: string, patch: Partial<AnnualPaySource> = {}): AnnualPaySource {
  return {
    ...blankAnnualPaySource(id),
    payer: 'Example Employer',
    reference: `Annual ${id}`,
    gross: '2000.00',
    withheld: '200.00',
    sourceType: 'income-statement',
    finalStatus: 'final',
    linkedEmployer: 'example employer',
    ...patch,
  }
}

const pay = [
  slip('p1', 'Example Employer', '2026-07-16', '1000.00', '100.00'),
  slip('p2', 'Example Employer', '2026-07-30', '1000.00', '100.00'),
]

describe('year-end employment reconciliation', () => {
  it('shows a final annual source as a second matching view rather than extra income', () => {
    const result = reconcileYearEndPay(pay, '2026–27', [annual('a')], 'yes')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      payGross: 200000,
      payWithheld: 20000,
      annualGross: 200000,
      annualWithheld: 20000,
      grossDifference: 0,
      withheldDifference: 0,
      state: 'matches',
      finalSourceCount: 1,
    })
    expect(result.taxResultLocked).toBe(true)
    expect(result.questions).toEqual([])
  })

  it('supports multiple final annual sources linked to one employer and sums only those annual sources', () => {
    const result = reconcileYearEndPay(pay, '2026–27', [
      annual('a', { reference: 'Payroll ID A', gross: '1200.00', withheld: '120.00' }),
      annual('b', { reference: 'Payroll ID B', gross: '800.00', withheld: '80.00' }),
    ], 'yes')
    expect(result.rows[0]).toMatchObject({ finalSourceCount: 2, annualGross: 200000, annualWithheld: 20000, state: 'matches' })
  })

  it('keeps a mismatch as a review question without deciding which source is correct', () => {
    const result = reconcileYearEndPay(pay, '2026–27', [annual('a', { gross: '2100.00', withheld: '205.00' })], 'yes')
    expect(result.rows[0]).toMatchObject({ state: 'differs', grossDifference: 10000, withheldDifference: 500 })
    expect(result.questions.join(' ')).toContain('does not decide which is legally correct')
  })

  it('excludes not-final and unsure sources from final annual totals', () => {
    const notFinal = reconcileYearEndPay(pay, '2026–27', [annual('a', { finalStatus: 'not-final' })], 'yes')
    expect(notFinal.rows[0]).toMatchObject({ state: 'source-still-provisional', annualGross: null, annualWithheld: null, finalSourceCount: 0, provisionalSourceCount: 1 })
    expect(notFinal.questions.join(' ')).toContain('excluded from final reconciliation totals')

    const unsure = reconcileYearEndPay(pay, '2026–27', [annual('a', { finalStatus: 'unsure' })], 'yes')
    expect(unsure.rows[0].state).toBe('source-still-provisional')
  })

  it('shows missing and unlinked source states explicitly', () => {
    const noAnnual = reconcileYearEndPay(pay, '2026–27', [], 'yes')
    expect(noAnnual.rows[0].state).toBe('pay-without-final-source')

    const unlinked = reconcileYearEndPay(pay, '2026–27', [annual('a', { payer: 'Other Employer', linkedEmployer: '', gross: '500.00', withheld: '20.00' })], 'yes')
    expect(unlinked.rows.some(row => row.state === 'annual-without-pay-history')).toBe(true)
    expect(unlinked.questions.join(' ')).toContain('has no linked checked pay history')
  })

  it('detects exact source identity/reference duplicates but allows distinct payroll references for one employer', () => {
    const first = annual('a', { payer: ' Example  Employer ', reference: ' Payroll ID 1 ' })
    const duplicate = annual('b', { payer: 'example employer', reference: 'payroll id 1' })
    expect([...duplicateAnnualSourceIds([first, duplicate])].sort()).toEqual(['a', 'b'])

    const distinct = annual('c', { reference: 'Payroll ID 2' })
    const result = reconcileYearEndPay(pay, '2026–27', [first, distinct], 'yes')
    expect(result.sourceRows.every(row => row.duplicate === false)).toBe(true)
  })

  it('blocks whole-year coverage when a possibly in-year pay record is unresolved', () => {
    const pending = slip('pending', 'Example Employer', '2026-08-10', '100.00', '10.00', false)
    const invalidDate = slip('unknown-date', 'Example Employer', 'bad-date', '100.00', '10.00', false)
    const coverage = payCoverageForYear([...pay, pending, invalidDate], '2026–27')
    expect(coverage.checkedSlips).toHaveLength(2)
    expect(coverage.pendingSlips.map(row => row.id).sort()).toEqual(['pending', 'unknown-date'])
  })

  it('preserves coverage uncertainty and produces an escaped source-linked handover', () => {
    const hostile = annual('x', { payer: '<img src=x onerror=bad()>', reference: '<script>bad</script>', linkedEmployer: '' })
    const result = reconcileYearEndPay(pay, '2026–27', [hostile], 'unsure')
    expect(result.questions.join(' ')).toContain('unsure whether every annual employment source')
    const html = yearEndReconciliationReport(result)
    expect(html).toContain('year-end-pay-reconciliation-v1')
    expect(html).toContain('ato-annual-employment-sources.2026-09-20')
    expect(html).toContain('do not add them together')
    expect(html).toContain('SHA-256 hash-p1')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>bad</script>')
    expect(html).toContain('Tax/refund results remain locked')
  })
})
