import { describe, expect, it } from 'vitest'
import type { Payslip } from './payslip'
import { calculatePayOutlook, financialYearBounds, outlookIssues, payDatesThroughYearEnd } from './payOutlook'
import { payOutlookReport } from './payOutlookReport'

function slip(id: string, payDate: string, gross = '1000.00', withheld = '100.00', employer = 'Example Employer'): Payslip {
  return {
    id,
    name: id + '.pdf',
    hash: 'hash-' + id,
    text: '',
    original: { employer, periodStart: '2027-05-01', periodEnd: '2027-05-14', payDate, gross, withheld, deductions: '0', net: String(Number(gross) - Number(withheld)), super: '' },
    facts: { employer, periodStart: '2027-05-01', periodEnd: '2027-05-14', payDate, gross, withheld, deductions: '0', net: String(Number(gross) - Number(withheld)), super: '' },
    confirmed: true,
    sample: false,
  }
}

describe('pay outlook calendar arithmetic', () => {
  it('maps Australian financial-year bounds and preserves monthly payday anchoring', () => {
    expect(financialYearBounds('2026–27')).toEqual({ start: '2026-07-01', end: '2027-06-30' })
    expect(payDatesThroughYearEnd('2027-01-31', '2026–27', 'monthly')).toEqual([
      '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31', '2027-06-30',
    ])
  })

  it('stops recurring dates at 30 June across weekly and four-weekly schedules', () => {
    expect(payDatesThroughYearEnd('2027-06-23', '2026–27', 'weekly')).toEqual(['2027-06-23', '2027-06-30'])
    expect(payDatesThroughYearEnd('2026-12-31', '2026–27', 'four-weekly').at(-1)).toBe('2027-06-17')
  })
})

describe('pay outlook scenarios and limits', () => {
  const slips = [slip('a', '2027-05-20'), slip('b', '2027-06-03')]

  it('keeps recorded and assumed future gross separate and carries withholding only for the entered pattern', () => {
    const result = calculatePayOutlook(slips, {
      financialYear: '2026–27',
      nextPayDate: '2027-06-16',
      frequency: 'fortnightly',
      normalGross: '1000.00',
      normalWithheld: '100.00',
      regularConfirmed: true,
      historyComplete: false,
    }, 'Example Employer')

    expect(result.futurePayDates).toEqual(['2027-06-16', '2027-06-30'])
    expect(result.recordedGross).toBe(200000)
    expect(result.scenarios.find(s => s.key === 'entered')).toMatchObject({ futureGross: 200000, combinedGross: 400000, futureWithheld: 20000, combinedWithheld: 40000 })
    expect(result.scenarios.find(s => s.key === 'less')).toMatchObject({ futureGross: 160000, combinedGross: 360000, futureWithheld: null, combinedWithheld: null })
    expect(result.scenarios.find(s => s.key === 'more')).toMatchObject({ futureGross: 240000, combinedGross: 440000, futureWithheld: null, combinedWithheld: null })
  })

  it('requires an explicit future pattern and a next payday after the latest checked pay', () => {
    const issues = outlookIssues(slips, {
      financialYear: '2026–27',
      nextPayDate: '2027-06-03',
      frequency: '',
      normalGross: '1000',
      normalWithheld: '100',
      regularConfirmed: false,
      historyComplete: false,
    })
    expect(issues.join(' ')).toMatch(/after the latest checked payday.*Choose how often.*regular rather than a bonus/)
  })

  it('exports assumptions, dates, source references and partial-history status without unsafe HTML', () => {
    const unsafe = slip('unsafe', '2027-06-03', '1000.00', '100.00', '<img src=x onerror=bad()>')
    const result = calculatePayOutlook([unsafe], {
      financialYear: '2026–27',
      nextPayDate: '2027-06-17',
      frequency: 'fortnightly',
      normalGross: '1000.00',
      normalWithheld: '100.00',
      regularConfirmed: true,
      historyComplete: false,
    }, unsafe.facts.employer)
    const html = payOutlookReport(result, [unsafe])
    expect(html).toContain('pay-outlook-arithmetic-v1')
    expect(html).toContain('Partial recorded history')
    expect(html).toContain('2027-06-17')
    expect(html).toContain('SHA-256 hash-unsafe')
    expect(html).toContain('Not estimated')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img')
  })
})
