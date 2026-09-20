export const PAYSLIP_VERSION = 'payslip-summary-v1'
export const MAX_PAYSLIPS = 100
export const fields = ['employer', 'periodStart', 'periodEnd', 'payDate', 'gross', 'withheld', 'deductions', 'net', 'super'] as const
export type PayField = typeof fields[number]
export type PayFacts = Record<PayField, string>
export type Payslip = {
  id: string; name: string; hash: string | null; text: string; original: PayFacts;
  facts: PayFacts; confirmed: boolean; sample: boolean;
  /** Which documented layout read this file. Absent for manual entry. */
  format?: string;
}
export const labels: Record<PayField, string> = {
  employer: 'Employer', periodStart: 'Period start', periodEnd: 'Period end', payDate: 'Pay date',
  gross: 'Gross pay', withheld: 'Tax withheld', deductions: 'Other deductions', net: 'Net pay', super: 'Super recorded',
}
export const blankFacts = (): PayFacts => Object.fromEntries(fields.map(key => [key, ''])) as PayFacts
export const aud = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
export function money(value: string): number | null {
  const m = value.trim().match(/^\$?((?:\d{1,3}(?:,\d{3})+|\d{1,8}))(?:\.(\d{1,2}))?$/)
  if (!m) return null
  const n = Number(m[1].replaceAll(',', '')) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(n) && n <= 1_000_000_000 ? n : null
}
export function dateValue(value: string): string | null {
  const au = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const s = au ? `${au[3]}-${au[2]}-${au[1]}` : value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '2000-01-01' || s > '2100-12-31') return null
  const d = new Date(s + 'T00:00:00Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null
}
export function financialYear(date: string): string {
  const y = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0)
  return `${y}–${String(y + 1).slice(-2)}`
}
export const employerKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
export function validateFacts(f: PayFacts): string[] {
  const issues: string[] = []
  if (!f.employer.trim() || f.employer.length > 120) issues.push('Enter an employer name of 1–120 characters.')
  for (const key of ['periodStart', 'periodEnd', 'payDate'] as const) if (!dateValue(f[key]) || dateValue(f[key]) !== f[key]) issues.push(`Check ${labels[key].toLowerCase()}. Use a valid YYYY-MM-DD date between 2000 and 2100.`)
  if (dateValue(f.periodStart) && dateValue(f.periodEnd)) {
    const days = (Date.parse(f.periodEnd) - Date.parse(f.periodStart)) / 86400000
    if (days < 0 || days > 62) issues.push('The pay period must run forwards and cover no more than 63 days.')
  }
  for (const key of ['gross', 'withheld', 'deductions', 'net'] as const) if (money(f[key]) === null) issues.push(`Enter ${labels[key].toLowerCase()} in AUD. Enter 0 only when the source confirms zero.`)
  if (f.super.trim() && money(f.super) === null) issues.push('Super must be a valid AUD amount, or blank when unknown.')
  const gross = money(f.gross), withheld = money(f.withheld), deductions = money(f.deductions), net = money(f.net)
  if (gross !== null && withheld !== null && deductions !== null && net !== null && gross - withheld - deductions !== net) issues.push('Gross pay minus tax withheld and other deductions does not equal net pay. Check every figure; this may be an unsupported pay structure.')
  return issues
}
export function samePay(a: PayFacts, b: PayFacts): boolean {
  return !!a.employer.trim() && employerKey(a.employer) === employerKey(b.employer) && !!dateValue(a.payDate) && a.payDate === b.payDate && a.periodStart === b.periodStart && a.periodEnd === b.periodEnd
}
export function confirmationIssues(slip: Payslip, all: Payslip[]): string[] {
  const issues = validateFacts(slip.facts)
  if (all.some(s => s.id !== slip.id && samePay(s.facts, slip.facts))) issues.push('Another entry has this employer, pay date and period. Compare them and remove the duplicate or superseded entry before confirming.')
  return issues
}
export function changedFacts(slip: Payslip, facts: PayFacts): Payslip {
  return { ...slip, facts, confirmed: false }
}
export function appendPayslips(existing: Payslip[], incoming: Payslip[]): Payslip[] {
  if (existing.length + incoming.length > MAX_PAYSLIPS) throw new Error(`Keep no more than ${MAX_PAYSLIPS} payslips in this session.`)
  const result = [...existing]
  for (const slip of incoming) {
    if (slip.hash && result.some(s => s.hash === slip.hash)) throw new Error('This batch includes a file already added. No files from this batch were added.')
    if (result.some(s => samePay(s.facts, slip.facts))) throw new Error('This batch repeats an employer, pay date and period. Remove the duplicate or superseded entry first. No files from this batch were added.')
    result.push(slip)
  }
  return result
}
export function selectedPayslips(all: Payslip[], year: string, employer: string): Payslip[] {
  return all.filter(s => s.confirmed && !confirmationIssues(s, all).length && (year === 'all' || financialYear(s.facts.payDate) === year) && (employer === 'all' || employerKey(s.facts.employer) === employer)).sort((a, b) => a.facts.payDate.localeCompare(b.facts.payDate) || a.facts.employer.localeCompare(b.facts.employer))
}
export function totals(slips: Payslip[]) {
  let gross = 0, withheld = 0, net = 0, deductions = 0, superCents = 0, superKnown = 0
  for (const { facts: f } of slips) {
    gross += money(f.gross)!; withheld += money(f.withheld)!; net += money(f.net)!; deductions += money(f.deductions)!
    const s = money(f.super); if (s !== null) { superCents += s; superKnown++ }
  }
  return { gross, withheld, net, deductions, superCents, superKnown, count: slips.length, percentage: gross ? (withheld / gross * 100).toFixed(1) : null }
}
export function buckets(slips: Payslip[], grouping: 'payday' | 'month') {
  const grouped = new Map<string, Payslip[]>()
  for (const slip of slips) {
    const key = slip.facts.payDate.slice(0, grouping === 'month' ? 7 : 10)
    grouped.set(key, [...(grouped.get(key) ?? []), slip])
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({ date, ...totals(rows) }))
}
export function observations(slips: Payslip[]): string[] {
  const notes: string[] = []
  const employers = [...new Set(slips.map(s => employerKey(s.facts.employer)))]
  for (const employer of employers) {
    const rows = slips.filter(s => employerKey(s.facts.employer) === employer).sort((a, b) => a.facts.periodStart.localeCompare(b.facts.periodStart))
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1].facts, b = rows[i].facts
      const days = (Date.parse(b.periodStart) - Date.parse(a.periodEnd)) / 86400000
      if (days <= 0) notes.push(`${b.employer}: periods ending ${a.periodEnd} and ${b.periodEnd} overlap. Check for an adjustment or duplicate; both remain counted.`)
      if (days > 1) notes.push(`${b.employer}: no uploaded period covers ${days - 1} day(s) between these records. This may be time off or a missing payslip; no earnings have been invented.`)
    }
    const byDate = [...rows].sort((a, b) => a.facts.payDate.localeCompare(b.facts.payDate))
    if (byDate.length > 1) {
      const a = byDate.at(-2)!.facts, b = byDate.at(-1)!.facts
      if (a.payDate === b.payDate) continue
      const sameLength = Date.parse(a.periodEnd) - Date.parse(a.periodStart) === Date.parse(b.periodEnd) - Date.parse(b.periodStart)
      if (!sameLength) { notes.push(`${b.employer}: the latest two pay periods have different lengths. Compare their dates before comparing amounts.`); continue }
      const change = money(b.gross)! - money(a.gross)!, taxChange = money(b.withheld)! - money(a.withheld)!
      notes.push(`${b.employer}: on ${b.payDate}, gross pay was ${aud(Math.abs(change))} ${change < 0 ? 'lower' : 'higher'} and withholding was ${aud(Math.abs(taxChange))} ${taxChange < 0 ? 'lower' : 'higher'} than the previous uploaded payday. The summary does not establish why.`)
    }
  }
  return notes
}
