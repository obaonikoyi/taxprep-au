import { dateValue, employerKey, money } from './payslip'
import type { AnnualFinalStatus, AnnualPaySource } from './yearEndReconciliation'

export const ANNUAL_STATEMENT_VERSION = 'annual-income-statement-v1'
export const ANNUAL_STATEMENT_LAYOUT = 'ANNUAL INCOME STATEMENT v1'
export const MAX_ANNUAL_STATEMENT_BYTES = 2_000_000

export type AnnualStatementFacts = {
  payer: string
  financialYear: string
  statementDate: string
  reference: string
  finalStatus: AnnualFinalStatus
  gross: string
  withheld: string
}

export type AnnualStatementCandidate = {
  id: string
  name: string
  hash: string
  page: number
  text: string
  facts: AnnualStatementFacts
  original: AnnualStatementFacts
  unresolvedCoverage: string[]
  sample: boolean
}

const prefixes = {
  payer: 'Employer:',
  financialYear: 'Financial year:',
  statementDate: 'Statement date:',
  reference: 'Source reference:',
  finalStatus: 'Status:',
  gross: 'Gross income:',
  withheld: 'Tax withheld:',
} as const

const extraPrefixes = [
  'Allowances:',
  'Lump sums:',
  'Reportable fringe benefits:',
  'Reportable employer super:',
  'Other employment payments:',
] as const

const compactYear = (value: string) => value.trim().replace(/\s/g, '').replace('-', '–')

function oneValue(lines: string[], prefix: string) {
  const values = lines.filter(line => line.startsWith(prefix)).map(line => line.slice(prefix.length).trim())
  if (values.length > 1) throw new Error(`More than one ${prefix.slice(0, -1).toLowerCase()} value was found.`)
  return values[0] ?? ''
}

function statusValue(value: string): AnnualFinalStatus {
  const normal = value.trim().toLowerCase()
  if (normal === 'tax ready' || normal === 'final' || normal === 'finalised' || normal === 'finalized') return 'final'
  if (normal === 'not final' || normal === 'not tax ready') return 'not-final'
  if (normal === 'unsure' || normal === 'unknown') return 'unsure'
  return ''
}

function hasMeaningfulExtra(value: string) {
  const normal = value.trim().toLowerCase()
  if (!normal || ['none', 'nil', 'n/a', 'not applicable', '0', '0.00', '$0', '$0.00'].includes(normal)) return false
  const parsed = money(value)
  return parsed === null || parsed !== 0
}

export function parseAnnualStatement(lines: string[], hash: string, name: string, sample = false): AnnualStatementCandidate {
  if (!lines.some(line => line === ANNUAL_STATEMENT_LAYOUT)) {
    throw new Error('This annual statement layout is not supported yet. Use the labelled fictional example or enter the annual source manually.')
  }
  if (lines.join('\n').length > 20_000) throw new Error('This annual statement contains too much text.')

  const statusRaw = oneValue(lines, prefixes.finalStatus)
  const facts: AnnualStatementFacts = {
    payer: oneValue(lines, prefixes.payer),
    financialYear: compactYear(oneValue(lines, prefixes.financialYear)),
    statementDate: oneValue(lines, prefixes.statementDate),
    reference: oneValue(lines, prefixes.reference),
    finalStatus: statusValue(statusRaw),
    gross: oneValue(lines, prefixes.gross),
    withheld: oneValue(lines, prefixes.withheld),
  }

  const unresolvedCoverage = extraPrefixes.flatMap(prefix => {
    const values = lines.filter(line => line.startsWith(prefix)).map(line => line.slice(prefix.length).trim())
    if (values.length > 1) throw new Error(`More than one ${prefix.slice(0, -1).toLowerCase()} value was found.`)
    return values[0] && hasMeaningfulExtra(values[0]) ? [`${prefix.slice(0, -1)}: ${values[0]}`] : []
  })

  return {
    id: hash,
    hash,
    name,
    page: 1,
    text: lines.join('\n'),
    facts,
    original: { ...facts },
    unresolvedCoverage,
    sample,
  }
}

export function annualStatementIssues(candidate: AnnualStatementCandidate, selectedYear: string) {
  const issues: string[] = []
  const facts = candidate.facts
  if (!facts.payer.trim() || facts.payer.length > 120) issues.push('Check the employer/payer name.')
  if (!facts.reference.trim() || facts.reference.length > 160) issues.push('Check the source reference.')
  if (!/^\d{4}–\d{2}$/.test(facts.financialYear)) issues.push('Check the financial year.')
  else if (facts.financialYear !== selectedYear) issues.push(`This source is for ${facts.financialYear}, not the selected ${selectedYear} financial year.`)
  const statementDate = dateValue(facts.statementDate)
  if (!statementDate || statementDate !== facts.statementDate) issues.push('Check the statement date.')
  const gross = money(facts.gross), withheld = money(facts.withheld)
  if (gross === null) issues.push('Check gross income. Blank is not zero.')
  if (withheld === null) issues.push('Check tax withheld. Enter 0 only when the source confirms zero.')
  if (gross !== null && withheld !== null && withheld > gross) issues.push('Tax withheld cannot be greater than gross income.')
  if (!facts.finalStatus) issues.push('Check whether the source is Tax ready/finalised, not final or unsure.')
  return issues
}

export function changedAnnualStatementFacts(candidate: AnnualStatementCandidate, facts: AnnualStatementFacts): AnnualStatementCandidate {
  return { ...candidate, facts }
}

export function candidateToAnnualPaySource(candidate: AnnualStatementCandidate, linkedEmployer = ''): AnnualPaySource {
  return {
    id: crypto.randomUUID(),
    payer: candidate.facts.payer.trim(),
    reference: candidate.facts.reference.trim(),
    gross: candidate.facts.gross,
    withheld: candidate.facts.withheld,
    sourceType: 'income-statement',
    finalStatus: candidate.facts.finalStatus,
    linkedEmployer,
    origin: 'document',
    reviewed: true,
    documentName: candidate.name,
    documentHash: candidate.hash,
    documentPage: candidate.page,
    originalExtraction: {
      payer: candidate.original.payer,
      reference: candidate.original.reference,
      gross: candidate.original.gross,
      withheld: candidate.original.withheld,
      finalStatus: candidate.original.finalStatus,
      financialYear: candidate.original.financialYear,
      statementDate: candidate.original.statementDate,
    },
    originalText: candidate.text,
    parserVersion: ANNUAL_STATEMENT_VERSION,
    unresolvedCoverage: [...candidate.unresolvedCoverage],
  }
}

export function suggestedEmployerLink(candidate: AnnualStatementCandidate, employers: [string, string][]) {
  const candidateKey = employerKey(candidate.facts.payer)
  return employers.find(([key]) => key === candidateKey)?.[0] ?? ''
}
