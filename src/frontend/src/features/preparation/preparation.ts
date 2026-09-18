import { parseMoney, pairKey, reconcile, type Evidence, type EvidenceLink } from '../documents/evidence'
import { assessPhone, phoneCredits, sources } from '../assessment/phone'

export const PREPARATION_VERSION = 'preparation-2025-26.v1'
export const MAX_INCOME_RECORDS = 20
export type Answer = '' | 'yes' | 'no' | 'unsure'
export const situationQuestions = [
  { key: 'resident', label: 'Australian resident for tax purposes for the whole year?', normal: 'yes', help: 'Tax residency is not the same as citizenship or visa status. Choose unsure if it needs checking.', gap: 'Residency needs review; part-year and non-resident returns are not covered.' },
  { key: 'adult', label: 'Aged 18 or over for the whole year?', normal: 'yes', help: 'This prototype starts with adult employee examples.', gap: 'Under-18 circumstances need separate preparation.' },
  { key: 'medicare', label: 'Entitled to Medicare for the whole year?', normal: 'yes', help: 'This records context only; no Medicare levy is calculated.', gap: 'Medicare eligibility, reductions or exemptions need review.' },
  { key: 'household', label: 'A spouse or dependants during the year?', normal: 'no', help: 'Spouse details and dependant-related calculations are not prepared here.', gap: 'Spouse and dependant sections remain unprepared.' },
  { key: 'health', label: 'Private health insurance during the year?', normal: 'no', help: 'Keep the annual insurer statement separately. Do not enter a membership number.', gap: 'Private health insurance, rebate and surcharge details need separate preparation.' },
  { key: 'loans', label: 'A HELP, VSL, AASL or other study or training loan?', normal: 'no', help: 'Loan repayments are not calculated by this prototype.', gap: 'Study or training loan obligations remain unprepared.' },
  { key: 'employmentExtras', label: 'Separately reported allowances, lump sums or other employment payments?', normal: 'no', help: 'Do not silently fold extra statement fields into ordinary gross salary. Keep their details for review.', gap: 'Additional employment payment fields need review and are not included automatically.' },
  { key: 'reportable', label: 'Reportable benefits, extra employer super or deductible personal super contributions?', normal: 'no', help: 'These can require separate fields or income tests; the prototype does not calculate them.', gap: 'Reportable benefits and superannuation-related fields remain unprepared.' },
  { key: 'otherIncome', label: 'Any income beyond salary, wages and Australian bank interest?', normal: 'no', help: 'For example: business/ABN income, rental, dividends, crypto or other capital gains, foreign income, government payments, super pensions or trust distributions.', gap: 'Other income sections remain unprepared. Record the type in the handover notes.' },
  { key: 'otherClaims', label: 'Other deductions, offsets, adjustments or earlier-year losses?', normal: 'no', help: 'Only the linked draft phone-service assessment is available here. Other claims need their own review.', gap: 'Other deductions, offsets, adjustments or losses remain unprepared.' },
] as const
export type SituationKey = typeof situationQuestions[number]['key']
export type Situation = Record<SituationKey, Answer>
export interface IncomeFields {
  kind: 'salary' | 'interest'; payer: string; reference: string; year: string
  gross: string; withheld: string; finalised: Answer; soleOwner: Answer
}
export interface IncomeRecord extends IncomeFields { id: string; reviewed: boolean; origin: 'manual' | 'sample'; original?: IncomeFields }
export interface Preparation {
  income: IncomeRecord[]; separate: string[]; situation: Situation; incomeComplete: Answer; notes: string
}
export interface Gap { section: 'Income' | 'Situation' | 'Documents' | 'Review'; message: string }
export const emptyPreparation = (): Preparation => ({ income: [], separate: [], situation: Object.fromEntries(situationQuestions.map(q => [q.key, ''])) as Situation, incomeComplete: '', notes: '' })
export const newIncome = (id: string, kind: IncomeFields['kind']): IncomeRecord => ({ id, kind, payer: '', reference: '', year: '2025-26', gross: '', withheld: '', finalised: '', soleOwner: '', reviewed: false, origin: 'manual' })
export function incomeAmount(value: string): number | null {
  if (value.length > 16) return null
  const plain = value.trim().replace(/^(?:AUD\s*|\$)/i, '').trim()
  return /^0{1,7}(?:\.0{1,2})?$/.test(plain) ? 0 : parseMoney(value)
}
export function incomeProblems(item: IncomeRecord): string[] {
  const issues: string[] = []
  if (!item.payer.trim() || item.payer.length > 120) issues.push('Add an employer or bank name, up to 120 characters.')
  if (!item.reference.trim() || item.reference.length > 160) issues.push('Add a source reference, up to 160 characters, without personal identifiers.')
  if (item.year !== '2025-26') issues.push('The source must be for 2025–26; other years are excluded from this subtotal.')
  const gross = incomeAmount(item.gross), withheld = incomeAmount(item.withheld)
  if (gross === null) issues.push('Enter gross income from $0 to $1,000,000. Blank is not zero.')
  if (withheld === null) issues.push('Enter tax withheld from $0 to $1,000,000; enter 0 when none was withheld.')
  if (gross !== null && withheld !== null && withheld > gross) issues.push('Tax withheld exceeds gross income. Check the statement or obtain separate review.')
  if (item.finalised !== 'yes') issues.push('Confirm the annual source is finalised; salary statements should be tax ready.')
  if (item.kind === 'interest' && item.soleOwner !== 'yes') issues.push('Joint or uncertain account ownership needs a share calculation outside this first income path.')
  return issues
}
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
export function incomeSummary(prep: Preparation) {
  const conflicts = prep.income.flatMap((item, index) => prep.income.slice(index + 1).filter(other => item.year === other.year && (
    (key(item.reference).length > 2 && key(item.reference) === key(other.reference)) ||
    (item.kind === other.kind && key(item.payer).length > 2 && key(item.payer) === key(other.payer))
  ) && !prep.separate.includes(pairKey(item.id, other.id))).map(other => [item.id, other.id] as const))
  const blocked = new Set(conflicts.flat())
  const items = prep.income.map(item => {
    const issues = incomeProblems(item)
    if (!item.reviewed) issues.push('Review this record against its source.')
    if (blocked.has(item.id)) issues.push('Possible duplicate annual record: resolve before counting.')
    return { item, issues, included: issues.length === 0 }
  })
  const included = items.filter(row => row.included)
  return { items, conflicts, included: included.length,
    grossCents: included.reduce((sum, row) => sum + incomeAmount(row.item.gross)!, 0),
    withheldCents: included.reduce((sum, row) => sum + incomeAmount(row.item.withheld)!, 0),
    complete: items.length > 0 && included.length === items.length && prep.incomeComplete === 'yes' }
}
export function changeIncome(prep: Preparation, id: string, fields: Partial<IncomeFields>): Preparation {
  return { ...prep, incomeComplete: '', separate: prep.separate.filter(pair => !pair.split('|').includes(id)), income: prep.income.map(item => item.id === id ? { ...item, ...fields, reviewed: false } : item) }
}
export function removeIncome(prep: Preparation, id: string): Preparation {
  return { ...prep, incomeComplete: '', separate: prep.separate.filter(pair => !pair.split('|').includes(id)), income: prep.income.filter(item => item.id !== id) }
}
export function samplePreparation(): Preparation {
  const example = (id: string, kind: IncomeFields['kind'], payer: string, gross: string, withheld: string): IncomeRecord => {
    const fields: IncomeFields = { kind, payer, reference: `Fictional annual statement ${id}`, year: '2025-26', gross, withheld, finalised: 'yes', soleOwner: kind === 'interest' ? 'yes' : '' }
    return { ...fields, id, reviewed: false, origin: 'sample', original: { ...fields } }
  }
  return { ...emptyPreparation(), income: [example('sample-employer-1', 'salary', 'Harbour Services (fictional)', '64000', '13500'), example('sample-employer-2', 'salary', 'Greenway Services (fictional)', '18000', '3600'), example('sample-bank-interest', 'interest', 'Example Bank (fictional)', '150', '0')], situation: Object.fromEntries(situationQuestions.map(q => [q.key, q.normal])) as Situation, incomeComplete: 'yes', notes: 'Synthetic adult employee example. Review all supplied answers; no ATO pre-fill connection.' }
}
export function preparationSummary(prep: Preparation, records: Evidence[], links: EvidenceLink[], separate: string[], importIssues: string[], now = new Date()) {
  const income = incomeSummary(prep)
  const gaps: Gap[] = []
  if (!prep.income.length) gaps.push({ section: 'Income', message: 'Add salary/wage or Australian bank-interest records. No income is inferred from bank deposits.' })
  income.items.forEach(({ item, issues }) => issues.forEach(message => gaps.push({ section: 'Income', message: `${item.payer || 'Unnamed income source'}: ${message}` })))
  if (prep.incomeComplete !== 'yes') gaps.push({ section: 'Income', message: 'Confirm whether all salary/wage and bank-interest records have been added. Other income is checked separately.' })
  situationQuestions.forEach(question => {
    const answer = prep.situation[question.key]
    if (!answer || answer === 'unsure') gaps.push({ section: 'Situation', message: `${question.label} ${answer === 'unsure' ? 'Unsure — needs review.' : 'Unanswered.'}` })
    else if (answer !== question.normal) gaps.push({ section: 'Situation', message: question.gap })
  })
  const { groups } = reconcile(records, links, separate)
  const expenses = groups.map(group => ({ ...group, assessment: group.item.phone ? assessPhone(group.item, group.evidence, group.counted, '2025-26', now, sources, phoneCredits(group.item, records)) : null }))
  if (!groups.length) gaps.push({ section: 'Documents', message: 'No expense evidence added. Other claims still need to be considered; this does not mean you have no deductions.' })
  expenses.filter(group => !group.item.excluded).forEach(group => {
    group.unresolved.forEach(message => gaps.push({ section: 'Documents', message: `${group.item.facts.merchant || group.item.fileName}: ${message}` }))
    if (!group.assessment && !group.item.credit) gaps.push({ section: 'Documents', message: `${group.item.facts.merchant || group.item.fileName}: Phone assessment not started, or this expense needs another category.` })
    if (group.assessment && ['unresolved', 'outside-scope'].includes(group.assessment.status)) group.assessment.findings.forEach(finding => gaps.push({ section: 'Documents', message: `${group.item.facts.merchant || group.item.fileName}: ${finding.message}` }))
  })
  importIssues.forEach(message => gaps.push({ section: 'Documents', message: `File processing unresolved: ${message}` }))
  gaps.push({ section: 'Review', message: 'Phone rules and expected examples await qualified tax review. Illustrative work portions are not approved deductions.' })
  gaps.push({ section: 'Review', message: 'Taxable income, tax rates, offsets, Medicare, surcharge, loan repayments and a refund/payable estimate have not been calculated. This is a handover, not a complete return or a myTax entry guide.' })
  const illustrations = expenses.filter(group => group.assessment?.status === 'illustration')
  return { income, expenses, gaps, illustrationCount: illustrations.length, illustrativeCents: illustrations.reduce((sum, group) => sum + group.assessment!.cents!, 0), claimReady: false as const }
}
