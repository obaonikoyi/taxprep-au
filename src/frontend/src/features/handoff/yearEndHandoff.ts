export const YEAR_END_HANDOFF_VERSION = 'taxprep-year-end-handoff-v1'
export const MAX_YEAR_END_HANDOFF_BYTES = 65_536

export type StatementYearEndHandoff = {
  version: typeof YEAR_END_HANDOFF_VERSION
  kind: 'statement-analysis'
  handoffId: string
  financialYear: string
  generatedAt: string
  sourceHashes: string[]
  scope: { from: string; to: string }
  summary: {
    transactionCount: number
    reviewedTransactions: number
    workReviewTransactions: number
    flaggedWorkAmountCents: number
    uncategorised: number
    reconciled: boolean
  }
}

export type EvidenceYearEndHandoff = {
  version: typeof YEAR_END_HANDOFF_VERSION
  kind: 'evidence-review'
  handoffId: string
  financialYear: string
  generatedAt: string
  sourceHashes: string[]
  summary: {
    evidenceRecords: number
    reconciledItems: number
    confirmedItems: number
    receiptItems: number
    workPurposeAnswered: number
    reviewedSpendingCents: number
    openQuestions: number
  }
}

export type YearEndHandoff = StatementYearEndHandoff | EvidenceYearEndHandoff

export type CoveragePatch = {
  bankSpending?: 'complete' | 'partial' | 'not-reviewed' | 'not-applicable'
  receiptEvidence?: 'complete' | 'partial' | 'not-reviewed' | 'not-applicable'
  workPurpose?: 'complete' | 'partial' | 'not-reviewed' | 'not-applicable'
  reviewedTransactions?: string
  workReviewTransactions?: string
  receiptCount?: string
  workPurposeCount?: string
  flaggedWorkAmount?: string
}

const validIsoDate = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value

export function normaliseFinancialYear(value: string) {
  return value.trim().replace('-', '–')
}

export function financialYearForDate(value: string) {
  if (!validIsoDate(value)) return ''
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const start = month >= 7 ? year : year - 1
  return `${start}–${String(start + 1).slice(-2)}`
}

export function financialYearForRange(from: string, to: string) {
  if (!validIsoDate(from) || !validIsoDate(to) || from > to) return ''
  const first = financialYearForDate(from), last = financialYearForDate(to)
  return first && first === last ? first : ''
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown, max: number) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
const timestamp = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))

function base(value: Record<string, unknown>) {
  if (value.version !== YEAR_END_HANDOFF_VERSION) throw new Error('This year-end handoff version is not supported.')
  if (typeof value.handoffId !== 'string' || !value.handoffId.trim() || value.handoffId.length > 1024) throw new Error('The handoff identity is missing or invalid.')
  if (typeof value.financialYear !== 'string' || !/^\d{4}[–-]\d{2}$/.test(value.financialYear)) throw new Error('The handoff financial year is missing or invalid.')
  if (!timestamp(value.generatedAt)) throw new Error('The handoff generated-at time is invalid.')
  if (!Array.isArray(value.sourceHashes) || !value.sourceHashes.length || value.sourceHashes.length > 20 || !value.sourceHashes.every(hash)) throw new Error('The handoff source hashes are missing or invalid.')
  if (new Set(value.sourceHashes.map(item => item.toLowerCase())).size !== value.sourceHashes.length) throw new Error('The handoff repeats a source hash.')
}

export function parseYearEndHandoffValue(input: unknown): YearEndHandoff {
  if (!object(input)) throw new Error('The year-end handoff must be a JSON object.')
  base(input)
  const financialYear = normaliseFinancialYear(String(input.financialYear))
  const sourceHashes = (input.sourceHashes as string[]).map(item => item.toLowerCase())

  if (input.kind === 'statement-analysis') {
    if (!object(input.scope) || !validIsoDate(input.scope.from) || !validIsoDate(input.scope.to) || input.scope.from > input.scope.to) throw new Error('The statement handoff date range is invalid.')
    if (financialYearForRange(input.scope.from, input.scope.to) !== financialYear) throw new Error('The statement handoff date range does not match its financial year.')
    if (!object(input.summary)) throw new Error('The statement handoff summary is missing.')
    const s = input.summary
    for (const [label, value, max] of [
      ['transaction count', s.transactionCount, 5_000],
      ['reviewed transaction count', s.reviewedTransactions, 5_000],
      ['work-review transaction count', s.workReviewTransactions, 5_000],
      ['flagged work-review amount', s.flaggedWorkAmountCents, 100_000_000_000],
      ['uncategorised count', s.uncategorised, 5_000],
    ] as const) if (!integer(value, max)) throw new Error(`The statement handoff ${label} is invalid.`)
    if (Number(s.reviewedTransactions) > Number(s.transactionCount) || Number(s.workReviewTransactions) > Number(s.transactionCount) || Number(s.uncategorised) > Number(s.transactionCount)) throw new Error('The statement handoff counts are inconsistent.')
    if (typeof s.reconciled !== 'boolean') throw new Error('The statement handoff reconciliation flag is invalid.')
    if (sourceHashes.length !== 1) throw new Error('A statement handoff must reference one source file.')
    return {
      version: YEAR_END_HANDOFF_VERSION,
      kind: 'statement-analysis',
      handoffId: String(input.handoffId),
      financialYear,
      generatedAt: String(input.generatedAt),
      sourceHashes,
      scope: { from: input.scope.from, to: input.scope.to },
      summary: {
        transactionCount: Number(s.transactionCount),
        reviewedTransactions: Number(s.reviewedTransactions),
        workReviewTransactions: Number(s.workReviewTransactions),
        flaggedWorkAmountCents: Number(s.flaggedWorkAmountCents),
        uncategorised: Number(s.uncategorised),
        reconciled: s.reconciled,
      },
    }
  }

  if (input.kind === 'evidence-review') {
    if (!object(input.summary)) throw new Error('The evidence handoff summary is missing.')
    const s = input.summary
    for (const [label, value, max] of [
      ['evidence record count', s.evidenceRecords, 500],
      ['reconciled item count', s.reconciledItems, 500],
      ['confirmed item count', s.confirmedItems, 500],
      ['receipt item count', s.receiptItems, 500],
      ['work-purpose answer count', s.workPurposeAnswered, 500],
      ['reviewed-spending amount', s.reviewedSpendingCents, 100_000_000],
      ['open-question count', s.openQuestions, 10_000],
    ] as const) if (!integer(value, max)) throw new Error(`The evidence handoff ${label} is invalid.`)
    if (Number(s.confirmedItems) > Number(s.reconciledItems) || Number(s.receiptItems) > Number(s.reconciledItems) || Number(s.workPurposeAnswered) > Number(s.reconciledItems)) throw new Error('The evidence handoff counts are inconsistent.')
    return {
      version: YEAR_END_HANDOFF_VERSION,
      kind: 'evidence-review',
      handoffId: String(input.handoffId),
      financialYear,
      generatedAt: String(input.generatedAt),
      sourceHashes,
      summary: {
        evidenceRecords: Number(s.evidenceRecords),
        reconciledItems: Number(s.reconciledItems),
        confirmedItems: Number(s.confirmedItems),
        receiptItems: Number(s.receiptItems),
        workPurposeAnswered: Number(s.workPurposeAnswered),
        reviewedSpendingCents: Number(s.reviewedSpendingCents),
        openQuestions: Number(s.openQuestions),
      },
    }
  }

  throw new Error('This year-end handoff source type is not supported.')
}

export async function readYearEndHandoff(file: File, selectedYear: string) {
  if (!/\.json$/i.test(file.name)) throw new Error('Choose a TaxPrep year-end handoff JSON file.')
  if (!file.size || file.size > MAX_YEAR_END_HANDOFF_BYTES) throw new Error('Use a year-end handoff file from 1 byte to 64 KB.')
  let value: unknown
  try {
    value = JSON.parse(await file.text())
  } catch {
    throw new Error('This year-end handoff is not valid JSON.')
  }
  const parsed = parseYearEndHandoffValue(value)
  const expected = normaliseFinancialYear(selectedYear)
  if (parsed.financialYear !== expected) throw new Error(`This handoff is for ${parsed.financialYear}, not the selected ${expected} financial year.`)
  return parsed
}

export function handoffLabel(handoff: YearEndHandoff) {
  return handoff.kind === 'statement-analysis' ? 'Bank spending summary' : 'Tax document evidence summary'
}

export function handoffConflicts(existing: YearEndHandoff[], next: YearEndHandoff) {
  if (existing.some(item => item.handoffId === next.handoffId)) return true
  const nextHashes = new Set(next.sourceHashes)
  return existing.some(item => item.kind === next.kind && item.sourceHashes.some(hash => nextHashes.has(hash)))
}

export function coveragePatchFromHandoff(handoff: YearEndHandoff): CoveragePatch {
  if (handoff.kind === 'statement-analysis') {
    const { transactionCount, reviewedTransactions, workReviewTransactions, flaggedWorkAmountCents } = handoff.summary
    const bankSpending = transactionCount === 0 ? 'not-reviewed' : reviewedTransactions === transactionCount ? 'complete' : reviewedTransactions > 0 ? 'partial' : 'not-reviewed'
    return {
      bankSpending,
      reviewedTransactions: String(reviewedTransactions),
      workReviewTransactions: String(workReviewTransactions),
      flaggedWorkAmount: (flaggedWorkAmountCents / 100).toFixed(2),
    }
  }
  const { reconciledItems, receiptItems, workPurposeAnswered } = handoff.summary
  const coverage = (count: number) => reconciledItems === 0 ? 'not-reviewed' as const : count === reconciledItems ? 'complete' as const : count > 0 ? 'partial' as const : 'not-reviewed' as const
  return {
    receiptEvidence: coverage(receiptItems),
    workPurpose: coverage(workPurposeAnswered),
    receiptCount: String(receiptItems),
    workPurposeCount: String(workPurposeAnswered),
  }
}

export function handoffSummaryLines(handoff: YearEndHandoff) {
  if (handoff.kind === 'statement-analysis') return [
    `${handoff.summary.transactionCount} transactions in selected period`,
    `${handoff.summary.reviewedTransactions} explicitly reviewed`,
    `${handoff.summary.workReviewTransactions} flagged for work review`,
    `AUD ${(handoff.summary.flaggedWorkAmountCents / 100).toFixed(2)} flagged for review — not a deduction`,
  ]
  return [
    `${handoff.summary.reconciledItems} evidence items after linking`,
    `${handoff.summary.receiptItems} with receipt evidence`,
    `${handoff.summary.workPurposeAnswered} with work purpose recorded`,
    `AUD ${(handoff.summary.reviewedSpendingCents / 100).toFixed(2)} reviewed spending — not a deduction`,
  ]
}

export function downloadYearEndHandoff(handoff: YearEndHandoff, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(handoff, null, 2) + '\n'], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
