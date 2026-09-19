import { dateValue, money, totals, type Payslip } from './payslip'

export const PAY_OUTLOOK_VERSION = 'pay-outlook-arithmetic-v1'

export const payFrequencies = ['weekly', 'fortnightly', 'four-weekly', 'monthly'] as const
export type PayFrequency = typeof payFrequencies[number]

export type PayOutlookInput = {
  financialYear: string
  nextPayDate: string
  frequency: PayFrequency | ''
  normalGross: string
  normalWithheld: string
  regularConfirmed: boolean
  historyComplete: boolean
}

export type PayOutlookScenario = {
  key: 'less' | 'entered' | 'more'
  label: string
  factorPercent: 80 | 100 | 120
  futureGross: number
  combinedGross: number
  futureWithheld: number | null
  combinedWithheld: number | null
}

export type PayOutlookResult = {
  version: string
  financialYear: string
  employer: string
  frequency: PayFrequency
  nextPayDate: string
  normalGross: number
  normalWithheld: number
  historyComplete: boolean
  recordedCount: number
  recordedGross: number
  recordedWithheld: number
  latestRecordedPayDate: string
  futurePayDates: string[]
  scenarios: PayOutlookScenario[]
}

export function financialYearBounds(label: string) {
  const match = label.match(/^(\d{4})[–-](\d{2})$/)
  if (!match) throw new Error('Choose one financial year before creating an outlook.')
  const startYear = Number(match[1])
  const endYear = startYear + 1
  if (match[2] !== String(endYear).slice(-2)) throw new Error('Choose a valid financial year.')
  return { start: `${startYear}-07-01`, end: `${endYear}-06-30` }
}

function addDays(value: string, days: number) {
  const date = new Date(value + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function anchoredMonthDate(start: string, offset: number) {
  const [year, month, day] = start.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + offset, 1))
  const y = target.getUTCFullYear(), m = target.getUTCMonth()
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const d = Math.min(day, lastDay)
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function payDatesThroughYearEnd(nextPayDate: string, financialYear: string, frequency: PayFrequency) {
  const parsed = dateValue(nextPayDate)
  if (!parsed || parsed !== nextPayDate) throw new Error('Enter a valid next payday.')
  const bounds = financialYearBounds(financialYear)
  if (nextPayDate < bounds.start || nextPayDate > bounds.end) throw new Error('The next payday must fall inside the selected financial year.')

  const dates: string[] = []
  if (frequency === 'monthly') {
    for (let offset = 0; offset < 18; offset++) {
      const candidate = anchoredMonthDate(nextPayDate, offset)
      if (candidate > bounds.end) break
      dates.push(candidate)
    }
    return dates
  }

  const step = frequency === 'weekly' ? 7 : frequency === 'fortnightly' ? 14 : 28
  let current = nextPayDate
  for (let count = 0; count < 60 && current <= bounds.end; count++) {
    dates.push(current)
    current = addDays(current, step)
  }
  return dates
}

export function outlookIssues(slips: Payslip[], input: PayOutlookInput) {
  const issues: string[] = []
  if (!slips.length) issues.push('Check at least one payslip in this employer and financial year first.')

  let bounds: { start: string; end: string } | null = null
  try { bounds = financialYearBounds(input.financialYear) } catch (error) { issues.push(error instanceof Error ? error.message : 'Choose one financial year.') }

  const next = dateValue(input.nextPayDate)
  if (!next || next !== input.nextPayDate) issues.push('Enter the next payday as a valid YYYY-MM-DD date.')
  else if (bounds && (next < bounds.start || next > bounds.end)) issues.push('The next payday must fall inside the selected financial year.')

  const latest = slips.map(s => s.facts.payDate).filter(Boolean).sort().at(-1)
  if (next && latest && next <= latest) issues.push('The next payday must be after the latest checked payday in this view.')

  if (!input.frequency) issues.push('Choose how often this regular pay normally arrives.')

  const gross = money(input.normalGross), withheld = money(input.normalWithheld)
  if (gross === null || gross <= 0) issues.push('Enter a normal gross pay greater than $0.')
  if (withheld === null) issues.push('Enter the normal tax withheld in AUD, including 0 when the payslip confirms zero.')
  if (gross !== null && withheld !== null && withheld > gross) issues.push('Normal tax withheld cannot be greater than normal gross pay.')

  if (!input.regularConfirmed) issues.push('Confirm that the future pay pattern is regular rather than a bonus, back pay or adjustment.')
  return issues
}

export function calculatePayOutlook(slips: Payslip[], input: PayOutlookInput, employer: string): PayOutlookResult {
  const issues = outlookIssues(slips, input)
  if (issues.length) throw new Error(issues.join(' '))

  const frequency = input.frequency as PayFrequency
  const normalGross = money(input.normalGross)!, normalWithheld = money(input.normalWithheld)!
  const futurePayDates = payDatesThroughYearEnd(input.nextPayDate, input.financialYear, frequency)
  const recorded = totals(slips)
  const latestRecordedPayDate = slips.map(s => s.facts.payDate).sort().at(-1) ?? ''

  const scenarios = ([
    ['less', '20% less gross pay', 80],
    ['entered', 'Entered pay pattern', 100],
    ['more', '20% more gross pay', 120],
  ] as const).map(([key, label, factorPercent]) => {
    const futureGrossPerPay = Math.round(normalGross * factorPercent / 100)
    const futureGross = futureGrossPerPay * futurePayDates.length
    const futureWithheld = factorPercent === 100 ? normalWithheld * futurePayDates.length : null
    return {
      key, label, factorPercent, futureGross,
      combinedGross: recorded.gross + futureGross,
      futureWithheld,
      combinedWithheld: futureWithheld === null ? null : recorded.withheld + futureWithheld,
    }
  })

  return {
    version: PAY_OUTLOOK_VERSION,
    financialYear: input.financialYear,
    employer,
    frequency,
    nextPayDate: input.nextPayDate,
    normalGross,
    normalWithheld,
    historyComplete: input.historyComplete,
    recordedCount: recorded.count,
    recordedGross: recorded.gross,
    recordedWithheld: recorded.withheld,
    latestRecordedPayDate,
    futurePayDates,
    scenarios,
  }
}

export const frequencyLabel = (frequency: PayFrequency) => ({
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  'four-weekly': 'Every four weeks',
  monthly: 'Monthly',
}[frequency])
