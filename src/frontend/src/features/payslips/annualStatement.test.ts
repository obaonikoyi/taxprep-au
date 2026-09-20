import { beforeAll, describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import example from '../../../../../sample-data/annual-statements/example.json'
import { textLines } from './payslipReader'
import {
  annualStatementIssues,
  candidateToAnnualPaySource,
  changedAnnualStatementFacts,
  parseAnnualStatement,
  suggestedEmployerLink,
  type AnnualStatementCandidate,
} from './annualStatement'
import { reconcileYearEndPay, type AnnualPaySource } from './yearEndReconciliation'
import type { Payslip } from './payslip'

let parsed: AnnualStatementCandidate

beforeAll(async () => {
  const task = getDocument({ data: new Uint8Array(Buffer.from(example.pdfBase64, 'base64')), useSystemFonts: true })
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const content = await page.getTextContent()
    const tokens = content.items.flatMap(item => 'str' in item && item.str.trim()
      ? [{ text: item.str, x: item.transform[4], y: item.transform[5] }]
      : [])
    parsed = parseAnnualStatement(textLines(tokens), 'fixture-hash', example.name, true)
  } finally {
    await task.destroy()
  }
})

const baseLines = [
  'ANNUAL INCOME STATEMENT v1',
  'Employer: Harbour Example Services',
  'Financial year: 2026-27',
  'Statement date: 2027-07-14',
  'Source reference: Harbour payroll A',
  'Status: Tax ready',
  'Gross income: 8250.00',
  'Tax withheld: 1315.00',
  'Allowances: 0.00',
  'Lump sums: none',
  'Reportable fringe benefits: none',
  'Reportable employer super: none',
  'Other employment payments: none',
]

function pay(id: string, gross: string, withheld: string): Payslip {
  return {
    id,
    name: id + '.pdf',
    hash: 'hash-' + id,
    text: '',
    original: { employer: 'Harbour Example Services', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16', gross, withheld, deductions: '0', net: String(Number(gross) - Number(withheld)), super: '' },
    facts: { employer: 'Harbour Example Services', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16', gross, witheld, deductions: '0', net: String(Number(gross) - Number(withheld)), super: '' },
    confirmed: true,
    sample: false,
  }
}

describe('annual income statement parsing', () => {
  it('extracts the real fictional PDn fixture into a review candidate', () => {
    expect(parsed.facts).toEqual({
      payer: 'Harbour Example Services',
      financialYear: '2026–27',
      statementDate: '2027-07-14',
      reference: 'Harbour payroll A',
      finalStatus: 'final',
      gross: '8250.00',
      withheld: '1315.00',
    })
    expect(parsed.original).toEqual(parsed.facts)
    expect(parsed.unresolvedCoverage).toEqual([])
    expect(annualStatementIssues(parsed, '2026–27')).toEqual([])
  })

  it('rejects unsupported and ambiguous labelled layouts', () => {
    expect(() => parseAnnualStatement(['Some employer statement'], 'x', 'bad.pdf')).toThrow('not supported')
    expect(() => parseAnnualStatement([...baseLines, 'Gross income: 9000.00'], 'x', 'ambiguous.pdf')).toThrow('More than one gross income')
  })

  it('keeps invalid or missing facts unresolved rather than guessing', () => {
    const invalid = parseAnnualStatement(baseLines.map(line => line.startsWith('Statement date:') ? 'Statement date: 2027-02-30' : line), 'bad-date', 'bad-date.pdf')
    expect(annualStatementIssues(invalid, '2026–27')).toContain('Check the statement date.')

    const wrongYear = parseAnnualStatement(baseLines.map(line => line.startsWith('Financial year:') ? 'Financial year: 2025-26' : line), 'wrong-year', 'wrong-year.pdf')
    expect(annualStatementIssues(wrongYear, '2026–27').join(' ')).toContain('not the selected 2026–27 financial year')

    const blankWithheld = parseAnnualStatement(baseLines.filter(line => !line.startsWith('Tax withheld:')), 'blank', 'blank.pdf')
    expect(annualStatementIssues(blankWithheld, '2026–27').join(' ')).toContain('Blank is not zero')
  })

  it('preserves unsupported annual fields instead of folding them into ordinary gross', () => {
    const candidate = parseAnnualStatement(baseLines.map(line => line.startsWith('Allowances:') ? 'Allowances: 150.00' : line), 'extra', 'extra.pdf')
    expect(candidate.unresolvedCoverage).toEqual(['Allowances: 150.00'])
    const source = candidateToAnnualPaySource(candidate, 'harbour example services')
    expect(source.unresolvedCoverage).toEqual(['Allowances: 150.00'])
    const result = reconcileYearEndPay([pay('p1', '8250.00', '1315.00')], '2026–27', [source], 'yes')
    expect(result.rows[0].state).toBe('pay-without-final-source')
    expect(result.questions.join(' ')).toContain('Unsupported annual-statement field needs separate review')
  })

  it('retains original extraction and correction provenance through transfer', () => {
    const corrected = changedAnnualStatementFacts(parsed, { ...parsed.facts, reference: 'Corrected reference' })
    const source = candidateToAnnualPaySource(corrected, suggestedEmployerLink(corrected, [['harbour example services', 'Harbour Example Services']]))
    expect(source.origin).toBe('document')
    expect(source.reviewed).toBe(true)
    expect(source.documentHash).toBe('fixture-hash')
    expect(source.originalExtraction?.reference).toBe('Harbour payroll A')
    expect(source.reference).toBe('Corrected reference')
    expect(source.originalText).toContain('ANNUAL INCOME STATEMENT v1')
    expect(source.linkedEmployer).toBe('harbour example services')
  })
})

describe('imported source review gates', () => {
  it('blocks edited imported sources until reconfirmed and repeated document hashes', () => {
    const source = candidateToAnnualPaySource(parsed, 'harbour example services')
    const edited: AnnualPaySource = { ...source, reference: 'Edited after confirmation', reviewed: false }
    const result = reconcileYearEndPay([pay('p1', '8250.00', '1315.00')], '2026–27', [edited], 'yes')
    expect(result.rows[0].state).toBe('pay-without-final-source')
    expect(result.questions.join(' ')).toContain('Reconfirm this imported source')

    const duplicate = { ...source, id: 'other-id', reference: 'Different label, same file' }
    const duplicateResult = reconcileYearEndPay([pay('p1', '8250.00', '1315.00')], '2026–27', [source, duplicate], 'yes')
    expect(duplicateResult.sourceRows.every(row => row.duplicate)).toBe(true)
    expect(duplicateResult.questions.join(' ')).toContain('Possible duplicate annual source')
  })
})
