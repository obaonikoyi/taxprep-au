import { factError, inYear, money, parseMoney, type Evidence } from '../documents/evidence'
import register from './source-register.json'

export const RULE_VERSION = 'employee-phone-2025-26.v1-draft'
export const REVIEW_GATE = 'Qualified tax review pending. This fictional example is not ready to claim.'
export const SOURCE_MAX_AGE_DAYS = 180 // Project maintenance policy, not an ATO rule.
export const sources = register.sources
// Bind this rule version to specific captured content, not just a mutable URL.
export const bindings = {
  phone: 'a1ecdbc3ce40e60a847ec1bd81393139a33395f199572645b51e00848b04b69f',
  fixed: '5c29157c7239c74c41d29ae48a1331ad434f5a3014283539e9c56357bb17e25f',
  records: '0307dd8da7a2d4f152c4f6a8120a4ca7fa4413b5511f99430ba2fe990f8dc519',
} as const
export interface PhoneAnswers {
  kind: '' | 'service' | 'device' | 'bundle' | 'other'
  payer: '' | 'you' | 'other' | 'unsure'
  use: '' | 'duties' | 'availability' | 'job-search' | 'private' | 'mixed' | 'unsure'
  homeMethod: '' | 'none' | 'actual' | 'fixed' | 'unsure'
  elsewhere: '' | 'no' | 'yes' | 'unsure'
  records: '' | 'yes' | 'no' | 'unsure'
  representative: '' | 'yes' | 'no' | 'unsure'
  reimbursedAmount: string
}
export const emptyPhoneAnswers = (): PhoneAnswers => ({ kind: '', payer: '', use: '', homeMethod: '', elsewhere: '', records: '', representative: '', reimbursedAmount: '' })
export type Source = Omit<typeof sources[number], 'reviewedAt' | 'reviewer'> & { reviewedAt: string | null; reviewer: string | null }
export function sourceProblems(year: string, now: Date, entries: Source[] = sources): string[] {
  const result: string[] = []
  for (const [id, hash] of Object.entries(bindings)) {
    const matches = entries.filter(source => source.id === id)
    const source = matches[0]
    if (matches.length !== 1) { result.push(`Source ${id} is missing or duplicated.`); continue }
    const age = (now.getTime() - Date.parse(source.retrievedAt)) / 86_400_000
    if (!Number.isFinite(age) || age < 0 || age > SOURCE_MAX_AGE_DAYS) result.push(`Source ${id} needs a maintenance check (180-day project policy).`)
    if (source.sha256 !== hash || source.conflict || !source.applicableYears.includes(year) || !['pending', 'approved'].includes(source.reviewStatus)) result.push(`Source ${id} is conflicting, changed, withdrawn or outside the selected year.`)
  }
  return result
}
export interface Finding { condition: string; message: string; sources: (keyof typeof bindings)[] }
export interface Assessment {
  status: 'unresolved' | 'outside-scope' | 'no-separate-amount' | 'illustration'
  cents: number | null; calculation: string | null; findings: Finding[]
  claimReady: false; reviewGate: string; ruleVersion: string; sourceVersion: string
}
export function percentageBasisPoints(value: string): number | null {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const points = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return points <= 10000 ? points : null
}
export function phoneCredits(item: Evidence, records: Evidence[]) {
  const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  return records.filter(record => record.credit && !record.excluded && inYear(record.facts.date) && key(item.facts.merchant).length > 2 && key(record.facts.merchant) === key(item.facts.merchant))
}
export function assessPhone(item: Evidence, evidence: Evidence[], counted: boolean, year = '2025-26', now = new Date(), entries: Source[] = sources, credits: Evidence[] = []): Assessment {
  const findings: Finding[] = []
  const add = (condition: string, message: string, refs: Finding['sources'] = ['phone']) => findings.push({ condition, message, sources: refs })
  const result = (status: Assessment['status'], cents: number | null = null, calculation: string | null = null): Assessment => ({ status, cents, calculation, findings, claimReady: false, reviewGate: REVIEW_GATE, ruleVersion: RULE_VERSION, sourceVersion: register.version })
  const problems = sourceProblems(year, now, entries)
  if (problems.length) { problems.forEach(message => add('source-health', message, [])); return result('unresolved') }
  if (!counted || !item.confirmed || factError(item.facts) || !inYear(item.facts.date) || item.credit || item.excluded) {
    add('reconciliation', 'Resolve the extracted facts, selected-year date, exclusion, credit or duplicate before assessing this item.', [])
    return result('unresolved')
  }
  if (credits.length) {
    add('reconciliation', 'A credit from this supplier may refund or adjust the bill. Resolve its relationship before calculating; exclude an unrelated credit only with a recorded reason. No automatic offset.', [])
    return result('unresolved')
  }
  const phone = item.phone ?? emptyPhoneAnswers()
  if (!phone.kind) { add('scope', 'Confirm what the payment bought.'); return result('unresolved') }
  if (phone.kind !== 'service') {
    add('scope', 'This first assessment covers mobile service bills only. Handsets, bundled device costs, setup, insurance and other items need separate review. No amount calculated.')
    return result('outside-scope')
  }
  // Known exclusions need no further work-use interview; these remain unreviewed draft rules.
  if (phone.payer === 'other') { add('payer', 'Someone else paid the cost. This draft includes no separate amount for you.'); return result('no-separate-amount', 0) }
  if (phone.homeMethod === 'fixed') { add('overlap', 'The working-from-home fixed rate already includes phone and data use, including work use away from home. No additional phone-service amount.', ['phone', 'fixed']); return result('no-separate-amount', 0) }
  if (phone.elsewhere === 'yes') { add('overlap', 'You marked this service cost as already included elsewhere. Resolve that entry before adding it again.'); return result('no-separate-amount', 0) }
  if (['availability', 'job-search', 'private'].includes(phone.use)) {
    add('work-duty', 'Private use, job seeking, and casual calls or texts about availability or offered shifts do not meet the supported work-duty condition.')
    return result('no-separate-amount', 0)
  }
  const reimbursed = parseMoney(phone.reimbursedAmount)
  if (item.answers.reimbursed === 'yes' && reimbursed === item.facts.cents) { add('reimbursement', 'The whole bill was reimbursed. This draft includes no separate amount.'); return result('no-separate-amount', 0) }
  if (phone.payer !== 'you') add('payer', 'Confirm that you incurred and paid the service cost.')
  if (phone.use !== 'duties' || !item.answers.purpose.trim()) add('work-duty', 'Describe actual duties performed using the service. Separate availability, job-seeking or mixed purposes before proceeding.')
  if (!['none', 'actual'].includes(phone.homeMethod)) add('overlap', 'Confirm whether you use the working-from-home fixed rate.', ['phone', 'fixed'])
  if (phone.elsewhere !== 'no') add('overlap', 'Confirm this service cost is not already included in another claim.')
  if (item.answers.reimbursed === 'yes') add('reimbursement', reimbursed === null || reimbursed > item.facts.cents! ? 'Enter a valid reimbursed amount no greater than the bill.' : 'Partly reimbursed: how the reimbursement relates to work and private use needs review. No automatic allocation.')
  else if (item.answers.reimbursed !== 'no') add('reimbursement', 'Confirm whether any of the cost was reimbursed.')
  const points = percentageBasisPoints(item.answers.workUse)
  if (points === null) add('apportionment', 'Enter a work-use percentage from 0 to 100, with at most two decimal places.')
  if (!item.answers.basis.trim() || phone.records !== 'yes' || !evidence.some(source => source.kind === 'receipt' && source.confirmed)) add('records', 'This standard-evidence path needs a checked supplier bill and a continuous 4-week record supporting work/private use. A bank entry alone is insufficient here. Record-keeping exceptions need separate review.', ['phone', 'records'])
  if (phone.representative !== 'yes') add('apportionment', 'Confirm the percentage reasonably applies to this bill, including leave, changed duties and different call/data usage. Split or review costs if it does not.')
  if (findings.length) return result('unresolved')
  const cents = Math.floor((item.facts.cents! * points! + 5000) / 10000)
  add('apportionment', 'Bill amount × documented work use; rounded to the nearest cent (half up). No annual extrapolation or tax-return rounding applied.')
  add('records', 'Relies on your confirmations about supplier evidence and representative work-use records. OCR accuracy does not establish tax eligibility.', ['phone', 'records'])
  return result('illustration', cents, `${money(item.facts.cents!)} × ${item.answers.workUse}% = ${money(cents)}`)
}
