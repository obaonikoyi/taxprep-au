import { confirmationIssues, employerKey, financialYear, money, totals, type Payslip } from './payslip'

export const YEAR_END_RECONCILIATION_VERSION = 'year-end-reconciliation-v1'
export const MAX_ANNUAL_SOURCES = 20

export type AnnualSourceType = '' | 'income-statement' | 'payment-summary'
export type AnnualSourceStatus = '' | 'final' | 'not-final' | 'unsure'

export type AnnualSource = {
  id: string
  payer: string
  reference: string
  type: AnnualSourceType
  status: AnnualSourceStatus
  gross: string
  withheld: string
  linkedEmployer: string
}

export type ReconciliationState = 'matches' | 'differs' | 'missing-annual' | 'provisional'

export type EmployerReconciliation = {
  employerKey: string
  employerName: string
  payslipCount: number
  payslipGross: number
  payslipWithheld: number
  finalSourceCount: number
  finalGross: number | null
  finalWithheld: number | null
  provisionalSourceCount: number
  grossDifference: number | null
  withheldDifference: number | null
  state: ReconciliationState
}

export type YearEndResult = {
  version: string
  year: string
  checkedPayslipCount: number
  employerCount: number
  coverageConfirmed: boolean
  rows: EmployerReconciliation[]
  unlinkedFinalSources: AnnualSource[]
  invalidSources: { source: AnnualSource; issues: string[] }[]
  unresolvedCount: number
  taxResultLocked: true
}

export const blankAnnualSource = (id: string): AnnualSource => ({
  id,
  payer: '',
  reference: '',
  type: '',
  status: '',
  gross: '',
  withheld: '',
  linkedEmployer: '',
})

const norm = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
const validPayDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

export function annualSourceProblems(source: AnnualSource, all: AnnualSource[] = []) {
  const issues: string[] = []
  if (!source.payer.trim() || source.payer.length > 120) issues.push('Enter a payer/employer name of 1–120 characters.')
  if (!source.reference.trim() || source.reference.length > 160) issues.push('Enter a source reference of 1–160 characters. Do not enter a TFN.')
  if (!source.type) issues.push('Choose whether this is an income statement or payment summary.')
  if (!source.status) issues.push('Choose whether this annual source is final, not final or unsure.')
  const gross = money(source.gross), withheld = money(source.withheld)
  if (gross === null) issues.push('Enter gross income in AUD. Enter 0 only when the source confirms zero.')
  if (withheld === null) issues.push('Enter tax withheld in AUD. Enter 0 only when the source confirms zero.')
  if (gross !== null && withheld !== null && withheld > gross) issues.push('Tax withheld cannot be greater than gross income for this reconciliation source.')

  const key = `${norm(source.payer)}|${source.type}|${norm(source.reference)}`
  if (source.payer.trim() && source.type && source.reference.trim() && all.some(other =>
    other.id !== source.id && `${norm(other.payer)}|${other.type}|${norm(other.reference)}` === key
  )) issues.push('Another annual source has the same payer, source type and reference. Remove the duplicate or replace the superseded record.')

  return issues
}

export function yearEndCoverage(allSlips: Payslip[], year: string) {
  if (year === 'all') return { checked: [] as Payslip[], pending: [] as Payslip[] }

  const checked = allSlips.filter(slip =>
    validPayDate(slip.facts.payDate)
    && financialYear(slip.facts.payDate) === year
    && slip.confirmed
    && confirmationIssues(slip, allSlips).length === 0
  )

  const pending = allSlips.filter(slip => {
    const couldBelong = !validPayDate(slip.facts.payDate) || financialYear(slip.facts.payDate) === year
    return couldBelong && (!slip.confirmed || confirmationIssues(slip, allSlips).length > 0)
  })

  return { checked, pending }
}

export function reconcileYearEnd(
  allSlips: Payslip[],
  year: string,
  sources: AnnualSource[],
  coverageConfirmed: boolean,
): YearEndResult {
  const { checked } = yearEndCoverage(allSlips, year)
  const invalidSources = sources
    .map(source => ({ source, issues: annualSourceProblems(source, sources) }))
    .filter(item => item.issues.length > 0)

  const validIds = new Set(sources.filter(source => annualSourceProblems(source, sources).length === 0).map(source => source.id))
  const validSources = sources.filter(source => validIds.has(source.id))
  const finalSources = validSources.filter(source => source.status === 'final')
  const provisionalSources = validSources.filter(source => source.status !== 'final')

  const employerMap = new Map<string, { name: string; slips: Payslip[] }>()
  for (const slip of checked) {
    const key = employerKey(slip.facts.employer)
    const current = employerMap.get(key) ?? { name: slip.facts.employer.trim(), slips: [] }
    current.slips.push(slip)
    employerMap.set(key, current)
  }

  const linkedFinal = new Map<string, AnnualSource[]>()
  const linkedProvisional = new Map<string, AnnualSource[]>()
  for (const source of finalSources) {
    if (!source.linkedEmployer) continue
    linkedFinal.set(source.linkedEmployer, [...(linkedFinal.get(source.linkedEmployer) ?? []), source])
  }
  for (const source of provisionalSources) {
    if (!source.linkedEmployer) continue
    linkedProvisional.set(source.linkedEmployer, [...(linkedProvisional.get(source.linkedEmployer) ?? []), source])
  }

  const rows = [...employerMap.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([key, entry]) => {
    const pay = totals(entry.slips)
    const finals = linkedFinal.get(key) ?? []
    const provisional = linkedProvisional.get(key) ?? []
    const finalGross = finals.length ? finals.reduce((sum, source) => sum + money(source.gross)!, 0) : null
    const finalWithheld = finals.length ? finals.reduce((sum, source) => sum + money(source.withheld)!, 0) : null
    const grossDifference = finalGross === null ? null : finalGross - pay.gross
    const withheldDifference = finalWithheld === null ? null : finalWithheld - pay.withheld

    let state: ReconciliationState
    if (finalGross === null) state = provisional.length ? 'provisional' : 'missing-annual'
    else if (grossDifference === 0 && withheldDifference === 0) state = 'matches'
    else state = 'differs'

    return {
      employerKey: key,
      employerName: entry.name,
      payslipCount: entry.slips.length,
      payslipGross: pay.gross,
      payslipWithheld: pay.withheld,
      finalSourceCount: finals.length,
      finalGross,
      finalWithheld,
      provisionalSourceCount: provisional.length,
      grossDifference,
      withheldDifference,
      state,
    }
  })

  const unlinkedFinalSources = finalSources.filter(source => !source.linkedEmployer || !employerMap.has(source.linkedEmployer))
  const unresolvedCount =
    rows.filter(row => row.state !== 'matches').length
    + unlinkedFinalSources.length
    + invalidSources.length
    + provisionalSources.filter(source => !source.linkedEmployer).length
    + (coverageConfirmed ? 0 : 1)

  return {
    version: YEAR_END_RECONCILIATION_VERSION,
    year,
    checkedPayslipCount: checked.length,
    employerCount: employerMap.size,
    coverageConfirmed,
    rows,
    unlinkedFinalSources,
    invalidSources,
    unresolvedCount,
    taxResultLocked: true,
  }
}

export const annualSourceTypeLabel = (value: AnnualSourceType) => ({
  '': 'Not selected',
  'income-statement': 'Income statement',
  'payment-summary': 'Payment summary',
}[value])

export const annualSourceStatusLabel = (value: AnnualSourceStatus) => ({
  '': 'Not selected',
  final: 'Tax ready / finalised',
  'not-final': 'Not final',
  unsure: 'Unsure',
}[value])

export const reconciliationStateLabel = (value: ReconciliationState) => ({
  matches: 'Matches checked pay history',
  differs: 'Annual source differs from pay history',
  'missing-annual': 'No final annual source added',
  provisional: 'Annual source is not final',
}[value])
