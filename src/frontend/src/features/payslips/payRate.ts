/*
 * Pay rate records, and the questions a payslip raises against them.
 *
 * Xoba Paycheck compares a payslip against the rate the user says they agreed to.
 * It does NOT compare it against an award, a classification or a legal
 * minimum: it has no knowledge of any of those, so a rate that is itself
 * below an award would pass here unremarked. Every result is therefore a
 * dated arithmetic question, never a verdict, and every finding carries the
 * limit of what it can establish.
 *
 * Overtime, penalty rates and allowances are never checked. Only the ordinary
 * line is, because a multiplier depends on the award and the roster.
 *
 * `payRate.test.ts` asserts that no string produced here characterises the
 * employer or the user's situation. Keep it that way.
 */
import { aud, dateValue, employerKey, hoursText, hoursValue, money, type Payslip } from './payslip'

/** Payroll systems round legitimately and differently. Anything at or below
 * this is rounding, not a question worth putting to a payroll officer. */
export const RATE_TOLERANCE_CENTS = 2
/** The convention for turning a salary into an hourly rate. Stated on screen,
 * because a different number of weeks gives a different answer. */
export const WEEKS_PER_YEAR = 52
export const MAX_RATE_RECORDS = 20

export type RateBasis = 'hourly' | 'annual'
export type RateSource = 'contract' | 'offer' | 'roster' | 'verbal'

export type RateRecord = {
  id: string
  employer: string
  basis: RateBasis
  /** AUD per hour, or per year when the basis is annual. */
  amount: string
  /** Ordinary hours a week. Required to turn an annual salary into a rate. */
  weeklyHours: string
  from: string
  /** Optional. Set when a later record supersedes this one. */
  to: string
  source: RateSource
  note: string
}

/*
 * `cited` is for the screen, which addresses the user, and `mine` is for the
 * message, which the user sends. They cannot be one string: "your contract" on
 * the panel means the reader's own, while in an email to payroll it would mean
 * the payroll officer's.
 */
export const rateSources: { value: RateSource; label: string; cited: string; mine: string }[] = [
  { value: 'contract', label: 'Contract', cited: 'your contract', mine: 'my contract' },
  { value: 'offer', label: 'Letter of offer', cited: 'your letter of offer', mine: 'my letter of offer' },
  { value: 'roster', label: 'Roster or certificate', cited: 'your roster or certificate', mine: 'my roster or certificate' },
  // Weaker evidence, and offered deliberately: someone told a number and never
  // given paper is exactly the person this feature exists for. Findings say so.
  { value: 'verbal', label: 'Verbal, recorded by me', cited: 'a verbal agreement you recorded yourself', mine: 'a verbal agreement I noted at the time' },
]
export const citedSource = (source: RateSource) => rateSources.find(s => s.value === source)?.cited ?? 'your record'
/** The same source, as the user would name it writing to their employer. */
export const myCitedSource = (source: RateSource) => rateSources.find(s => s.value === source)?.mine ?? 'my own record'

export const blankRate = (): RateRecord => ({ id: '', employer: '', basis: 'hourly', amount: '', weeklyHours: '', from: '', to: '', source: 'contract', note: '' })

/** The agreed rate as integer cents an hour, or null when it cannot be worked out. */
export function hourlyCents(record: RateRecord): number | null {
  const amount = money(record.amount)
  if (amount === null || amount <= 0) return null
  if (record.basis === 'hourly') return amount
  const weekly = hoursValue(record.weeklyHours)
  if (weekly === null || weekly <= 0) return null
  return Math.round(amount * 100 / (WEEKS_PER_YEAR * weekly))
}

export function validateRate(record: RateRecord, all: RateRecord[]): string[] {
  const issues: string[] = []
  if (!record.employer.trim() || record.employer.length > 120) issues.push('Enter an employer name of 1–120 characters. Use the name as it appears on the payslip.')
  if (money(record.amount) === null || money(record.amount)! <= 0) issues.push(record.basis === 'annual' ? 'Enter the annual salary in AUD, such as 76000.' : 'Enter the hourly rate in AUD, such as 28.90.')
  if (record.basis === 'annual' && (hoursValue(record.weeklyHours) === null || hoursValue(record.weeklyHours)! <= 0)) issues.push('Enter the ordinary hours a week your salary covers, such as 38. A salary cannot be turned into an hourly rate without them.')
  if (!dateValue(record.from) || dateValue(record.from) !== record.from) issues.push('Enter the date this rate started, as a valid date. A rate that began mid-year must not be applied to earlier payslips.')
  if (record.to.trim()) {
    if (!dateValue(record.to) || dateValue(record.to) !== record.to) issues.push('The end date must be a valid date, or blank when this rate still applies.')
    else if (dateValue(record.from) && record.to < record.from) issues.push('The end date must be on or after the start date.')
  }
  if (record.note.length > 200) issues.push('Keep the source note to 200 characters. It is a reminder of where the rate came from, such as a clause number.')
  const overlapping = all.find(other => other.id !== record.id
    && employerKey(other.employer) === employerKey(record.employer) && !!record.employer.trim()
    && dateValue(record.from) && dateValue(other.from)
    && (!record.to || record.to >= other.from) && (!other.to || other.to >= record.from))
  // Two records covering one day would make "the rate for this period"
  // ambiguous, and a check has to know which rate it compared against.
  if (overlapping) issues.push(`Another ${record.employer.trim()} record already covers these dates. Give the earlier rate an end date so each pay period has one rate.`)
  return issues
}

export function addRate(records: RateRecord[], record: RateRecord): RateRecord[] {
  if (records.length >= MAX_RATE_RECORDS) throw new Error(`Keep no more than ${MAX_RATE_RECORDS} rate records in this session.`)
  return [...records, record].sort((a, b) => employerKey(a.employer).localeCompare(employerKey(b.employer)) || a.from.localeCompare(b.from))
}

/** The record covering this employer on this date, or null. Validation rejects
 * overlaps, so there is never more than one. */
export function recordFor(records: RateRecord[], employer: string, date: string): RateRecord | null {
  if (!employer.trim() || !dateValue(date)) return null
  return records.find(r => employerKey(r.employer) === employerKey(employer)
    && dateValue(r.from) && r.from <= date && (!r.to.trim() || r.to >= date)) ?? null
}

/** `hours × rate`, in integer units throughout, rounded to the cent once. */
export const expectedCents = (hoursHundredths: number, rateCents: number) => Math.round(hoursHundredths * rateCents / 100)

export type FindingKind = 'rate-differs' | 'amount-differs' | 'payslip-self' | 'rate-changed'

/** Always the same three parts, then what the finding cannot establish.
 * `yourRecord` is null for the check that needs no record at all. */
export type Finding = {
  id: string
  slipId: string
  kind: FindingKind
  heading: string
  employer: string
  period: string
  yourRecord: string | null
  thePayslip: string
  difference: string
  limit: string
  question: string
  /*
   * The same finding, written to be sent.
   *
   * The fields above address the user — "the rate you recorded". A message to
   * payroll is the other way round, where "you" is the payroll officer, so it
   * cannot be assembled from them and is written separately, here, where the
   * figures are in scope.
   *
   * It asks. It never asserts an entitlement, names a fault or requests money:
   * this app knows the user's own record and a payslip's arithmetic, and
   * nothing about what anyone is owed. The banned-word test in
   * `payRate.test.ts` covers this field too.
   */
  message: string
}

const OPENING = 'Hi,'
const CLOSING = 'Thanks.'
/** A message the user can send as it stands: greeting, figures, one question. */
const sendable = (...body: string[]) => [OPENING, ...body, CLOSING].join('\n\n')

export type CheckState = {
  slipId: string
  name: string
  employer: string
  period: string
  checked: boolean
  detail: string
}

const periodText = (slip: Payslip) => `${slip.facts.periodStart} to ${slip.facts.periodEnd}`
const ASK = 'Ask your employer’s payroll contact about this pay period, and keep this payslip.'

/** A rate record's own description, used wherever a finding cites it. */
export function rateText(record: RateRecord): string {
  const hourly = hourlyCents(record)
  if (hourly === null) return 'an incomplete record'
  if (record.basis === 'hourly') return `${aud(hourly)} an hour`
  return `${aud(money(record.amount)!)} a year, which is ${aud(hourly)} an hour over ${hoursText(hoursValue(record.weeklyHours)!)} hours a week`
}

/**
 * Every question the confirmed payslips raise, and — just as importantly —
 * which payslips were not checked and why. A user who sees no findings will
 * otherwise conclude they were paid right, so silence is never left bare.
 */
export function rateChecks(slips: Payslip[], records: RateRecord[], issuesFor: (slip: Payslip) => string[]): { findings: Finding[]; states: CheckState[] } {
  const findings: Finding[] = []
  const states: CheckState[] = []

  for (const slip of slips) {
    const f = slip.facts
    const state = (checked: boolean, detail: string) => states.push({ slipId: slip.id, name: slip.name, employer: f.employer, period: periodText(slip), checked, detail })

    if (!slip.confirmed || issuesFor(slip).length) { state(false, 'Check this payslip’s figures first. Only checked payslips are compared with your rate.'); continue }

    const hours = hoursValue(f.hours), rate = money(f.rate), ordinary = money(f.ordinary)
    const record = recordFor(records, f.employer, f.periodStart)
    const recorded = record ? hourlyCents(record) : null
    const compared: string[] = []

    // 2 · The payslip does not agree with itself. Needs no record at all, and
    // is the most useful check in the set for exactly that reason.
    if (hours !== null && rate !== null && ordinary !== null) {
      compared.push('the hours and rate on this payslip against each other')
      const expected = expectedCents(hours, rate)
      if (Math.abs(expected - ordinary) > RATE_TOLERANCE_CENTS) findings.push({
        id: `${slip.id}:self`, slipId: slip.id, kind: 'payslip-self',
        heading: 'This payslip does not agree with itself',
        employer: f.employer, period: periodText(slip), yourRecord: null,
        thePayslip: `${hoursText(hours)} hours at ${aud(rate)} is ${aud(expected)}, but the pay for those hours reads ${aud(ordinary)}.`,
        difference: `${aud(Math.abs(expected - ordinary))} ${expected > ordinary ? 'less than' : 'more than'} the payslip’s own hours and rate come to.`,
        limit: 'An adjustment from another period, unpaid leave or a figure shown elsewhere on the payslip can each produce this. Xoba Paycheck cannot tell which figure is the one to change.',
        question: ASK,
        message: sendable(
          `Could you help me check my payslip for the period ${periodText(slip)}?`,
          `It shows ${hoursText(hours)} hours at ${aud(rate)}, which comes to ${aud(expected)}, but the pay for those hours reads ${aud(ordinary)}.`,
          'I may be reading it the wrong way. Could you let me know which figure applies, and whether anything needs adjusting?'),
      })
    }

    if (record && recorded !== null) {
      // 1 · The payslip's stated rate against the rate you recorded.
      if (rate !== null) {
        compared.push(`this payslip’s rate against ${rateText(record)} from ${citedSource(record.source)}`)
        if (Math.abs(rate - recorded) > RATE_TOLERANCE_CENTS) {
          const consequence = hours !== null
            ? ` Over ${hoursText(hours)} hours that is ${aud(expectedCents(hours, recorded))} rather than ${aud(expectedCents(hours, rate))}.`
            : ''
          findings.push({
            id: `${slip.id}:rate`, slipId: slip.id, kind: 'rate-differs',
            heading: 'The rate on this payslip is not the rate you recorded',
            employer: f.employer, period: periodText(slip),
            yourRecord: `${rateText(record)}, from ${citedSource(record.source)}${record.note.trim() ? ` (${record.note.trim()})` : ''}, effective ${record.from}.`,
            thePayslip: `${aud(rate)} an hour.${consequence}`,
            difference: `${aud(Math.abs(rate - recorded))} an hour ${rate < recorded ? 'below' : 'above'} what you recorded${hours !== null ? `, or ${aud(Math.abs(expectedCents(hours, recorded) - expectedCents(hours, rate)))} over this period` : ''}.`,
            limit: 'Xoba Paycheck cannot tell you which rate applies. Your recorded rate may have been superseded, your classification may have changed, or the record itself may need updating. It also does not know your award, so it cannot say whether either rate is one you are entitled to.',
            question: ASK,
            message: sendable(
              `Could you help me check my pay for the period ${periodText(slip)}?`,
              `The payslip shows an hourly rate of ${aud(rate)}. I have ${rateText(record)} from ${record.from}, taken from ${myCitedSource(record.source)}.`
                + (hours !== null ? ` Over ${hoursText(hours)} hours the two come to ${aud(expectedCents(hours, rate))} and ${aud(expectedCents(hours, recorded))}, a difference of ${aud(Math.abs(expectedCents(hours, recorded) - expectedCents(hours, rate)))}.` : ''),
              'Could you let me know which rate applies for this period, and whether my record is out of date?'),
          })
        }
      } else if (hours !== null && ordinary !== null) {
        // The payslip shows no rate, so compare the amount instead. When it
        // does show one, the self-check above already tests the same sum.
        compared.push(`the pay for those hours against ${rateText(record)} from ${citedSource(record.source)}`)
        const expected = expectedCents(hours, recorded)
        if (Math.abs(expected - ordinary) > RATE_TOLERANCE_CENTS) findings.push({
          id: `${slip.id}:amount`, slipId: slip.id, kind: 'amount-differs',
          heading: 'The pay for these hours is not what your recorded rate comes to',
          employer: f.employer, period: periodText(slip),
          yourRecord: `${rateText(record)}, from ${citedSource(record.source)}. Over ${hoursText(hours)} hours that is ${aud(expected)}.`,
          thePayslip: `${aud(ordinary)} for ${hoursText(hours)} ordinary hours. This payslip does not show an hourly rate.`,
          difference: `${aud(Math.abs(expected - ordinary))} ${expected > ordinary ? 'less than' : 'more than'} your recorded rate comes to over these hours.`,
          limit: 'This payslip states no rate, so the difference may come from the rate, the hours, or an adjustment the payslip does not itemise. Xoba Paycheck does not know your award and cannot say which rate you are entitled to.',
          question: ASK,
          message: sendable(
            `Could you help me check my pay for the period ${periodText(slip)}?`,
            `The payslip shows ${aud(ordinary)} for ${hoursText(hours)} ordinary hours and does not show an hourly rate. I have ${rateText(record)} from ${myCitedSource(record.source)}, which over those hours comes to ${aud(expected)} — a difference of ${aud(Math.abs(expected - ordinary))}.`,
            'Could you let me know the hourly rate used for this period, and whether the hours are as you have them?'),
        })
      }
    }

    if (compared.length) { state(true, `Checked ${compared.join(', and ')}.`); continue }

    // Nothing ran. Say which of the two halves is missing, so the user knows
    // what to do rather than reading silence as a pass.
    const hasAny = f.hours.trim() || f.rate.trim() || f.ordinary.trim()
    if (!record) {
      const anyForEmployer = records.some(r => employerKey(r.employer) === employerKey(f.employer))
      if (anyForEmployer) state(false, `Your ${f.employer} rate records do not cover ${f.periodStart}. Add the rate that applied then to check this payslip.`)
      else if (hasAny) state(false, `Add the rate you agreed with ${f.employer} to check this payslip against it.`)
      else state(false, `This payslip does not show ordinary hours, an hourly rate or the pay for those hours, and you have recorded no rate for ${f.employer}. You can type the figures in from the original.`)
    } else if (recorded === null) {
      state(false, `Your ${f.employer} rate record is incomplete, so nothing was compared. Check its amount and hours.`)
    } else {
      state(false, 'This payslip does not show ordinary hours, an hourly rate or the pay for those hours, so it cannot be checked against your rate. You can type them in from the original.')
    }
  }

  // 3 · A rate that moved between consecutive payslips with nothing recorded
  // to explain it. Attached to the later payslip.
  const checkable = slips.filter(s => s.confirmed && !issuesFor(s).length && money(s.facts.rate) !== null && dateValue(s.facts.periodStart))
  for (const employer of new Set(checkable.map(s => employerKey(s.facts.employer)))) {
    const rows = checkable.filter(s => employerKey(s.facts.employer) === employer).sort((a, b) => a.facts.periodStart.localeCompare(b.facts.periodStart))
    for (let i = 1; i < rows.length; i++) {
      const before = rows[i - 1], after = rows[i]
      const a = money(before.facts.rate)!, b = money(after.facts.rate)!
      if (Math.abs(a - b) <= RATE_TOLERANCE_CENTS) continue
      // A record starting inside the gap is the user saying they knew.
      const explained = records.some(r => employerKey(r.employer) === employer && dateValue(r.from)
        && r.from > before.facts.periodStart && r.from <= after.facts.periodStart)
      if (explained) continue
      findings.push({
        id: `${after.id}:changed`, slipId: after.id, kind: 'rate-changed',
        heading: 'Your rate changed with no rate change recorded',
        employer: after.facts.employer, period: periodText(after),
        yourRecord: `You have recorded no rate change for ${after.facts.employer} between ${before.facts.periodStart} and ${after.facts.periodStart}.`,
        thePayslip: `${aud(a)} an hour on the period ending ${before.facts.periodEnd}, and ${aud(b)} an hour on the period ending ${after.facts.periodEnd}.`,
        difference: `${aud(Math.abs(a - b))} an hour ${b < a ? 'lower' : 'higher'} than the previous period.`,
        limit: 'A change of classification, the end of a casual loading arrangement or a different roster can all move a rate legitimately. If you knew about this change, record it as a new rate and this question will stop being raised.',
        question: `If this change is news to you, ${ASK[0].toLowerCase()}${ASK.slice(1)}`,
        message: sendable(
          'Could you help me check my hourly rate?',
          `My payslip for the period ending ${before.facts.periodEnd} shows ${aud(a)} an hour, and the one for the period ending ${after.facts.periodEnd} shows ${aud(b)}.`,
          'I do not have a note of a rate change between those periods. Could you let me know what changed, so I can update my own records?'),
      })
    }
  }

  return { findings, states }
}
