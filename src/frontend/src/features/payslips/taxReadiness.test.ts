import { describe, expect, it } from 'vitest'
import type { Payslip } from './payslip'
import {
  assessTaxReadiness,
  blankTaxReadinessAnswers,
  taxReadinessCoverage,
  type TaxReadinessAnswers,
} from './taxReadiness'
import { taxReadinessReport } from './taxReadinessReport'

function slip(id: string, employer: string, payDate: string, confirmed = true): Payslip {
  return {
    id,
    name: id + '.pdf',
    hash: 'hash-' + id,
    text: '',
    original: {
      employer,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-14',
      payDate,
      gross: '1000.00',
      withheld: '100.00',
      deductions: '0.00',
      net: '900.00',
      super: '120.00',
    },
    facts: {
      employer,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-14',
      payDate,
      gross: '1000.00',
      withheld: '100.00',
      deductions: '0.00',
      net: '900.00',
      super: '120.00',
    },
    confirmed,
    sample: false,
  }
}

const supportedAnswers = (): TaxReadinessAnswers => ({
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
})

describe('tax readiness profile classification', () => {
  it('keeps a complete narrow profile locked even when every supported answer is supplied', () => {
    const result = assessTaxReadiness(supportedAnswers())
    expect(result.answered).toHaveLength(10)
    expect(result.needsInformation).toHaveLength(0)
    expect(result.outsideProfile).toHaveLength(0)
    expect(result.taxResultLocked).toBe(true)
    expect(result.review).toMatch(/issue #28.*pending/i)
  })

  it('keeps unknown and incomplete declaration/coverage answers in needs-information', () => {
    const answers = supportedAnswers()
    answers.payCoverage = 'no'
    answers.declarationsKnown = 'no'
    answers.studyLoan = 'unsure'
    const result = assessTaxReadiness(answers)
    expect(result.needsInformation.map(item => item.key)).toEqual(expect.arrayContaining(['payCoverage', 'declarationsKnown', 'studyLoan']))
    expect(result.outsideProfile).toHaveLength(0)
  })

  it('separates explicit unsupported circumstances from missing information', () => {
    const answers = supportedAnswers()
    answers.resident = 'no'
    answers.studyLoan = 'yes'
    answers.simpleFamily = 'no'
    answers.irregularPay = 'yes'
    const result = assessTaxReadiness(answers)
    expect(result.outsideProfile.map(item => item.key)).toEqual(expect.arrayContaining(['resident', 'studyLoan', 'simpleFamily', 'irregularPay']))
    expect(result.needsInformation).toHaveLength(0)
  })

  it('starts with every fact unknown rather than assuming the simple profile', () => {
    const result = assessTaxReadiness(blankTaxReadinessAnswers())
    expect(result.answered).toHaveLength(0)
    expect(result.needsInformation).toHaveLength(10)
    expect(result.outsideProfile).toHaveLength(0)
  })
})

describe('tax readiness pay coverage', () => {
  it('uses all employers for the selected financial year', () => {
    const slips = [
      slip('a', 'Harbour Example Services', '2026-07-16'),
      slip('b', 'Garden Example Studio', '2026-07-31'),
      slip('old', 'Old Example', '2026-06-30'),
    ]
    const coverage = taxReadinessCoverage(slips, '2026–27')
    expect(coverage.checkedSlips.map(item => item.id)).toEqual(['a', 'b'])
    expect(coverage.employerCount).toBe(2)
    expect(coverage.employerNames).toEqual(['Garden Example Studio', 'Harbour Example Services'])
  })

  it('blocks an unresolved selected-year record and an unresolved record with an unknown pay date', () => {
    const selected = slip('pending', 'Harbour Example Services', '2026-08-13', false)
    const unknownDate = slip('unknown', 'Another Employer', '', false)
    const old = slip('old', 'Old Example', '2026-06-30', false)
    const coverage = taxReadinessCoverage([selected, unknownDate, old], '2026–27')
    expect(coverage.pendingSlips.map(item => item.id)).toEqual(expect.arrayContaining(['pending', 'unknown']))
    expect(coverage.pendingSlips.map(item => item.id)).not.toContain('old')
  })
})

describe('tax readiness report', () => {
  it('escapes source data and preserves the locked-review state and source references', () => {
    const bad = slip('bad', '<img src=x onerror=bad()>', '2026-07-16')
    const coverage = taxReadinessCoverage([bad], '2026–27')
    const answers = supportedAnswers()
    const result = assessTaxReadiness(answers)
    const html = taxReadinessReport(coverage, answers, result, coverage.checkedSlips)
    expect(html).toContain('tax-readiness-profile-v1')
    expect(html).toContain('Tax result locked')
    expect(html).toContain('Recorded withholding is not final tax')
    expect(html).toContain('SHA-256 hash-bad')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img')
    expect(html).toContain('ATO — Tax file number declaration')
  })
})
