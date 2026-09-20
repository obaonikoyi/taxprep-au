import { confirmationIssues, employerKey, financialYear, money, totals, type Payslip } from './payslip'

export const YEAR_END_RECONCILIATION_VERSION = 'year-end-pay-reconciliation-v1'
export const ANNUAL_SOURCE_GUIDANCE_VERSION = 'ato-annual-employment-sources.2026-09-20'
export const MAX_ANNUAL_PAY_SOURCES = 30

export const annualSourceGuidance = [
  { id: 'income-statement-status', title: 'ATO — Accessing your income statement', url: 'https://www.ato.gov.au/api/public/content/0-880e199f-24f7-4808-8de9-4f96e7e5571b' },
  { id: 'multiple-statements', title: 'ATO — Multiple income statements from one employer', url: 'https://www.ato.gov.au/api/public/content/0-9e8a6a9e-7a55-456b-8bd4-ff06ea9a2694' },
  { id: 'stp-finalisation', title: 'ATO — Finalising Single Touch Payroll data', url: 'https://www.ato.gov.au/api/public/content/0-2f417730-27cf-4825-8b51-ee53bfe00358' },
] as const

export type AnnualSourceType = '' | 'income-statement' | 'payment-summary'
export type AnnualFinalStatus = '' | 'final' | 'not-final' | 'unsure'
export type CoverageAnswer = '' | 'yes' | 'no' | 'unsure'

export type AnnualPaySource = {
  id: string
  payer: string
  reference: string
  gross: string
  withheld: string
  sourceType: AnnualSourceType
  finalStatus: AnnualFinalStatus
  linkedEmployer: string
}

export type ReconciliationState =
  | 'matches'
  | 'differs'
  | 'pay-without-final-source'
  | 'annual-without-pay-history'
  | 'source-still-provisional'

export type ReconciliationRow = {
  key: string
  label: string
  linkedEmployer: string | null
  payCount: number
  payGross: number
  payWithheld: number
  finalSourceCount: number
  provisionalSourceCount: number
  annualGross: number | null
  annualWithheld: number | null
  grossDifference: number | null
  withheldDifference: number | null
  state: ReconciliationState
  sourceIds: string[]
}

export type YearEndReconciliation = {
  version: string
  year: string
  checkedSlips: Payslip[]
  pendingSlips: Payslip[]
  employerNames: [string, string][]
  sourceRows: { source: AnnualPaySource; issues: string[]; duplicate: boolean; finalIncluded: boolean; provisional: boolean }[]
  rows: ReconciliationRow[]
  coverageAnswer: CoverageAnswer
  questions: string[]
  taxResultLocked: true
}

export function blankAnnualPaySource(id: string): AnnualPaySource {
  return {
    id,
    payer: '',
    reference: '',
    gross: '',
    withheld: '',
    sourceType: '',
    finalStatus: '',
    linkedEmployer: '',
  }
}

const compact = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
const validPayDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

export function annualSourceTypeLabel(type: AnnualSourceType) {
  return type === 'income-statement' ? 'Income statement' : type === 'payment-summary' ? 'Payment summary' : 'Not selected'
}

export function annualFinalStatusLabel(status: AnnualFinalStatus, type: AnnualSourceType) {
  if (status === 'final') return type === 'income-statement' ? 'Tax ready / finalised' : 'Finalised'
  if (status === 'not-final') return 'Not final'
  if (status === 'unsure') return 'Unsure'
  return 'Not selected'
}

export function annualSourceIdentity(source: AnnualPaySource) {
  if (!source.payer.trim() || !source.reference.trim() || !source.sourceType) return ''
  return [compact(source.payer), source.sourceType, compact(source.reference)].join('|')
}

export function duplicateAnnualSourceIds(sources: AnnualPaySource[]) {
  const groups = new Map<string, string[]>()
  for (const source of sources) {
    const identity = annualSourceIdentity(source)
    if (!identity) continue
    groups.set(identity, [...(groups.get(identity) ?? []), source.id])
  }
  return new Set([...groups.values()].filter(ids => ids.length > 1).flat())
}

export function annualSourceIssues(source: AnnualPaySource): string[] {
  const issues: string[] = []
  if (!source.payer.trim() || source.payer.trim().length > 120) issues.push('Enter the employer or payer name, up to 120 characters.')
  if (!source.reference.trim() || source.reference.trim().length > 160) issues.push('Enter a source reference, up to 160 characters.')
  if (!source.sourceType) issues.push('Choose whether this is an income statement or payment summary.')
  const gross = money(source.gross), withheld = money(source.withheld)
  if (gross === null) issues.push('Enter gross income in AUD. Blank is not zero.')
  if (withheld === null) issues.push('Enter tax withheld in AUD, including 0 when the source confirms zero.')
  if (gross !== null && withheld !== null && withheld > gross) issues.push('Tax withheld cannot be greater than gross income for this source.')
  if (!source.finalStatus) issues.push('Choose whether the annual source is final, not final or unsure.')
  return issues
}

export function payCoverageForYear(allSlips: Payslip[], year: string) {
  if (year === 'all') return { checkedSlips: [], pendingSlips: [], employerNames: [] as [string, string][] }

  const checkedSlips = allSlips.filter(slip => {
    if (!validPayDate(slip.facts.payDate) || financialYear(slip.facts.payDate) !== year) return false
    return slip.confirmed && confirmationIssues(slip, allSlips).length === 0
  })

  const pendingSlips = allSlips.filter(slip => {
    const couldBelong = !validPayDate(slip.facts.payDate) || financialYear(slip.facts.payDate) === year
    if (!couldBelong) return false
    return !slip.confirmed || confirmationIssues(slip, allSlips).length > 0
  })

  const employers = new Map<string, string>()
  for (const slip of checkedSlips) {
    const key = employerKey(slip.facts.employer)
    if (key && !employers.has(key)) employers.set(key, slip.facts.employer.trim())
  }

  return {
    checkedSlips,
    pendingSlips,
    employerNames: [...employers.entries()].sort((a, b) => a[1].localeCompare(b[1])),
  }
}

export function reconcileYearEndPay(
  allSlips: Payslip[],
  year: string,
  sources: AnnualPaySource[],
  coverageAnswer: CoverageAnswer,
): YearEndReconciliation {
  const coverage = payCoverageForYear(allSlips, year)
  const duplicates = duplicateAnnualSourceIds(sources)

  const sourceRows = sources.map(source => {
    const issues = annualSourceIssues(source)
    const duplicate = duplicates.has(source.id)
    if (duplicate) issues.push('Possible duplicate annual source: the payer, source type and reference match another entry.')
    return {
      source,
      issues,
      duplicate,
      finalIncluded: issues.length === 0 && source.finalStatus === 'final',
      provisional: issues.length === 0 && source.finalStatus !== 'final',
    }
  })

  const rows: ReconciliationRow[] = coverage.employerNames.map(([key, name]) => {
    const paySlips = coverage.checkedSlips.filter(slip => employerKey(slip.facts.employer) === key)
    const pay = totals(paySlips)
    const linked = sourceRows.filter(row => row.source.linkedEmployer === key && row.issues.length === 0)
    const finals = linked.filter(row => row.finalIncluded)
    const provisional = linked.filter(row => row.provisional)
    const annualGross = finals.length ? finals.reduce((sum, row) => sum + money(row.source.gross)!, 0) : null
    const annualWithheld = finals.length ? finals.reduce((sum, row) => sum + money(row.source.withheld)!, 0) : null

    let state: ReconciliationState
    if (finals.length) state = annualGross === pay.gross && annualWithheld === pay.withheld ? 'matches' : 'differs'
    else if (provisional.length) state = 'source-still-provisional'
    else state = 'pay-without-final-source'

    return {
      key: 'employer:' + key,
      label: name,
      linkedEmployer: key,
      payCount: pay.count,
      payGross: pay.gross,
      payWithheld: pay.withheld,
      finalSourceCount: finals.length,
      provisionalSourceCount: provisional.length,
      annualGross,
      annualWithheld,
      grossDifference: annualGross === null ? null : annualGross - pay.gross,
      withheldDifference: annualWithheld === null ? null : annualWithheld - pay.withheld,
      state,
      sourceIds: linked.map(row => row.source.id),
    }
  })

  for (const row of sourceRows.filter(row => !row.source.linkedEmployer && row.issues.length === 0)) {
    const source = row.source
    const gross = money(source.gross)!
    const withheld = money(source.withheld)!
    rows.push({
      key: 'unlinked:' + source.id,
      label: source.payer.trim(),
      linkedEmployer: null,
      payCount: 0,
      payGross: 0,
      payWithheld: 0,
      finalSourceCount: row.finalIncluded ? 1 : 0,
      provisionalSourceCount: row.provisional ? 1 : 0,
      annualGross: row.finalIncluded ? gross : null,
      annualWithheld: row.finalIncluded ? withheld : null,
      grossDifference: null,
      withheldDifference: null,
      state: row.provisional ? 'source-still-provisional' : 'annual-without-pay-history',
      sourceIds: [source.id],
    })
  }

  const questions: string[] = []
  for (const sourceRow of sourceRows) {
    for (const issue of sourceRow.issues) questions.push(`${sourceRow.source.payer.trim() || 'Unnamed annual source'}: ${issue}`)
    if (sourceRow.provisional) questions.push(`${sourceRow.source.payer.trim()}: annual source is ${annualFinalStatusLabel(sourceRow.source.finalStatus, sourceRow.source.sourceType).toLowerCase()} and is excluded from final reconciliation totals.`)
  }
  for (const row of rows) {
    if (row.state === 'differs') questions.push(`${row.label}: final annual source totals differ from checked payslip totals. Review the sources; TaxPrep does not decide which is legally correct.`)
    if (row.state === 'pay-without-final-source') questions.push(`${row.label}: checked pay history has no linked final annual source.`)
    if (row.state === 'annual-without-pay-history') questions.push(`${row.label}: final annual source has no linked checked pay history.`)
  }
  if (coverageAnswer !== 'yes') {
    questions.push(coverageAnswer === 'no'
      ? 'You said more annual employment sources still need to be added.'
      : coverageAnswer === 'unsure'
        ? 'You are unsure whether every annual employment source has been added.'
        : 'Confirm whether you have added every annual employment source you know about for this financial year.')
  }

  return {
    version: YEAR_END_RECONCILIATION_VERSION,
    year,
    checkedSlips: coverage.checkedSlips,
    pendingSlips: coverage.pendingSlips,
    employerNames: coverage.employerNames,
    sourceRows,
    rows,
    coverageAnswer,
    questions,
    taxResultLocked: true,
  }
}

export function reconciliationStateLabel(state: ReconciliationState) {
  return {
    matches: 'Matches checked pay history',
    differs: 'Annual source differs from pay history',
    'pay-without-final-source': 'Pay history has no final annual source',
    'annual-without-pay-history': 'Annual source has no linked pay history',
    'source-still-provisional': 'Source still provisional',
  }[state]
}

export function coverageAnswerLabel(answer: CoverageAnswer) {
  return answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : answer === 'unsure' ? 'Unsure' : 'Not confirmed'
}
