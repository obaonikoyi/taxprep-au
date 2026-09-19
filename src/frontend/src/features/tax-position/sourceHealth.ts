import register from './source-register.json'
export const TAX_RULE_VERSION = 'employee-no-deductions-2025-26.v1-draft'
export const TAX_SOURCE_VERSION = register.version
export const taxSources = register.sources
export const TAX_REVIEW = 'Qualified tax review pending. Fictional arithmetic only; a reliable refund/payable estimate is unavailable.'
export const bindings = {
  "rates": "d39a3d95a7b376192e9beac79d3ec6a9df8ade1d6269258194406661b5154fbe",
  "lito": "7653c902e00df1b16ea1842effd519fe030702a1797e7ef1bc425c99b8c66b88",
  "medicare": "6396030e956b6049a7f541a37ddedf63583c5ceadb8c448d117e720b8471c52e",
  "mls": "3336e92768e7268bc9ee4b3204349edb3d88560c71974cc814078144a88c8341",
  "instructions": "2711e653e850e6f0f91b58b8ae86e34a1ff6c876a62ae40fe5c72342b0e7fc60"
} as const
export type TaxSource = Omit<typeof taxSources[number], 'reviewer' | 'reviewedAt'> & { reviewer: string | null; reviewedAt: string | null }
export function taxSourceProblems(year: string, now: Date, entries: TaxSource[] = taxSources): string[] {
  const problems: string[] = []
  for (const [id, hash] of Object.entries(bindings)) {
    const matches = entries.filter(source => source.id === id)
    if (matches.length !== 1) { problems.push(`ATO source ${id} is missing or duplicated.`); continue }
    const source = matches[0]
    const age = (now.getTime() - Date.parse(source.retrievedAt)) / 86400000
    if (!Number.isFinite(age) || age < 0 || age > 180) problems.push(`ATO source ${id} needs a maintenance check (180-day project policy).`)
    if (source.sha256 !== hash || source.conflict || !source.applicableYears.includes(year) || source.reviewStatus !== 'pending' || source.reviewer !== null || source.reviewedAt !== null) problems.push(`ATO source ${id} changed, conflicts or needs a new reviewed rule version.`)
  }
  return problems
}
