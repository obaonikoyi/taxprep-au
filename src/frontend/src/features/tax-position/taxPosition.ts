import { incomeAmount, incomeSummary, situationQuestions, type Preparation } from '../preparation/preparation'
import { taxSourceProblems, taxSources, TAX_REVIEW, TAX_RULE_VERSION, TAX_SOURCE_VERSION, type TaxSource } from './sourceHealth'

export const PROFILE = '2025–26 full-year resident adult using ordinary resident rates (no working holiday maker or other special rate); salary/wages and sole-owner Australian bank interest only; single with no dependants; no deductions, other offsets, private health insurance, Medicare exemptions, study loans or other adjustments; income up to $101,000.'
export const ROUNDING = 'Illustration policy: retain entered cents; round each tax/offset/levy component to the nearest cent, half up. No annualisation or whole-dollar filing conversion. ATO assessment and settlement rounding still require qualified verification.'
export interface TaxLine { label: string; cents: number; explanation: string; sources: string[] }
export interface TaxPosition {
  status: 'blocked' | 'illustration'; blockers: string[]; lines: TaxLine[]
  balanceCents: number | null; estimateCents: null; claimReady: false
  ruleVersion: string; sourceVersion: string; review: string
}
const rate = (cents: number, basisPoints: number) => Math.floor((cents * basisPoints + 5000) / 10000)

export function taxPosition(prep: Preparation, expenseCount = 0, importIssues: string[] = [], now = new Date(), entries: TaxSource[] = taxSources, year = '2025-26'): TaxPosition {
  const income = incomeSummary(prep)
  const blockers = taxSourceProblems(year, now, entries)
  if (year !== '2025-26') blockers.push('Only the 2025–26 rule version is available.')
  if (!income.complete) blockers.push('Review every income record, resolve duplicates and confirm the complete salary/interest list.')
  for (const question of situationQuestions) {
    const value = prep.situation[question.key]
    if (value !== question.normal) blockers.push(!value || value === 'unsure' ? `${question.label} Answer needed.` : question.gap)
  }
  if (income.grossCents > 10_100_000) blockers.push('Income exceeds $101,000. Medicare levy surcharge and higher-income scenarios are outside this version.')
  // Expense review is a separate rule set. Even excluded/zero/unresolved evidence is never silently
  // promoted to an approved deduction or disregarded by answering "no deductions".
  if (expenseCount > 0) blockers.push('Expense documents are present. Their treatment needs qualified review; this no-deduction calculation cannot combine them with income. The phone illustration is not an approved deduction.')
  if (importIssues.length) blockers.push('Document processing is incomplete. Resolve failed imports before any calculation.')
  if (prep.income.some(item => item.kind === 'interest' && incomeAmount(item.withheld) !== 0)) blockers.push('Bank-interest tax credits need separate verification; this calculation supports zero interest withholding only.')
  const result: TaxPosition = { status: blockers.length ? 'blocked' : 'illustration', blockers, lines: [], balanceCents: null, estimateCents: null, claimReady: false, ruleVersion: TAX_RULE_VERSION, sourceVersion: TAX_SOURCE_VERSION, review: TAX_REVIEW }
  if (blockers.length) return result
  const taxable = income.grossCents // Explicit no-deductions profile only; never subtract draft phone portions.
  const tax = taxable <= 1_820_000 ? 0 : taxable <= 4_500_000 ? rate(taxable - 1_820_000, 1600) : 428_800 + rate(taxable - 4_500_000, 3000)
  const offset = taxable <= 3_750_000 ? 70_000 : taxable <= 4_500_000 ? Math.floor((700_000_000 - (taxable - 3_750_000) * 500 + 5000) / 10000) : Math.max(0, Math.floor((325_000_000 - (taxable - 4_500_000) * 150 + 5000) / 10000))
  const usedOffset = Math.min(tax, offset)
  const medicare = Math.min(rate(taxable, 200), rate(Math.max(0, taxable - 2_801_100), 1000))
  const liability = tax - usedOffset + medicare
  const line = (label: string, cents: number, explanation: string, sources: string[]): TaxLine => ({ label, cents, explanation, sources })
  result.lines = [
    line('Recorded gross income', income.grossCents, 'Sum of reviewed salary/wage and sole-owner interest records.', []),
    line('Deductions in this scenario', 0, 'Explicit no-deduction scenario. No expense assessment is approved or included.', []),
    line('Illustrative taxable income', taxable, 'Recorded gross income minus zero scenario deductions. Entered cents retained.', ['rates']),
    line('Income tax before offsets', tax, taxable <= 1_820_000 ? 'Income is within the $18,200 tax-free threshold.' : taxable <= 4_500_000 ? '16% of income above $18,200.' : '$4,288 plus 30% of income above $45,000.', ['rates']),
    line('Low income tax offset used', usedOffset, 'Up to $700; reduces by 5c/$ above $37,500, then $325 minus 1.5c/$ above $45,000. Capped at income tax; unused offset is not refundable and does not reduce Medicare.', ['lito']),
    line('Income tax after offset', tax - usedOffset, 'Income tax before offsets minus the non-refundable offset used.', ['rates', 'lito']),
    line('Medicare levy', medicare, 'Non-SAPTO single profile: zero up to $28,011; 10% of the excess, capped at 2% of taxable income. No exemption days or family reduction.', ['medicare', 'instructions']),
    line('Medicare levy surcharge', 0, 'Zero within the 2025–26 $101,000 single threshold. Profile excludes every additional MLS-income component.', ['mls']),
    line('Other offsets, loans and adjustments', 0, 'Excluded by explicit profile answers, including private health rebate and other tax credits.', []),
    line('Illustrative tax plus Medicare', liability, 'Income tax after offset plus Medicare levy; other supported components are zero.', ['rates', 'lito', 'medicare', 'mls']),
    line('Recorded tax withheld', income.withheldCents, 'Reviewed salary/wage withholding only. Not itself a refund; no other payments or credits.', []),
  ]
  result.balanceCents = income.withheldCents - liability
  return result
}
export function balanceLabel(position: TaxPosition) {
  return position.balanceCents === null ? 'Calculation unavailable' : position.balanceCents > 0 ? 'Fictional refund balance' : position.balanceCents < 0 ? 'Fictional amount payable' : 'Fictional balance: even'
}
