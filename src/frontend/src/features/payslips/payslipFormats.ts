/*
 * Supported payslip layouts.
 *
 * Each entry is a *documented* layout, not a guess at arbitrary employer PDFs.
 * A format decides whether a document is its own, and then extracts the
 * current-period facts. Anything a format cannot read with certainty is left
 * blank so the user types it, because a blank field asks a question while a
 * wrong number silently becomes a total.
 *
 * Cumulative year-to-date figures are never extracted by any format. Summing
 * YTD columns across payslips double counts earnings, which is the single
 * worst thing this reader could do.
 */
import { blankFacts, dateValue, fields, labels, type PayFacts } from './payslip'

export type TextToken = { text: string; x: number; y: number; width?: number }
export type TextRow = { text: string; tokens: TextToken[] }

export type PayslipFormat = {
  /** Recorded against each record and printed in the downloaded report. */
  id: string
  /** Shown to the user when listing what the reader supports. */
  label: string
  /** Marker line that identifies the layout. */
  marker: string
  detect: (lines: string[]) => boolean
  parse: (doc: { lines: string[]; rows: TextRow[] }) => PayFacts
}

const tokenCentre = (t: TextToken) => t.x + (t.width ?? 0) / 2

/** A single `Label: value` line, rejecting repeats so one file is one payslip. */
function labelledValue(lines: string[], prefix: string, what: string): string {
  const values = lines.filter(s => s.startsWith(prefix + ':')).map(s => s.slice(prefix.length + 1).trim())
  if (values.length > 1) throw new Error(`More than one ${what} value was found. Use one payslip per file.`)
  const value = values[0] ?? ''
  if (value.length > 120) throw new Error(`The ${what} field is too long.`)
  return value
}

/* ---------------------------------------------------------------- v1 ----
 * The original layout: one `Label: value` line per field. Kept exactly as it
 * behaved before the registry existed.
 */
const SUMMARY_V1: PayslipFormat = {
  id: 'payslip-summary-v1',
  label: 'PAYSLIP SUMMARY v1 (labelled summary)',
  marker: 'PAYSLIP SUMMARY v1',
  detect: lines => lines.some(s => s === 'PAYSLIP SUMMARY v1'),
  parse: ({ lines }) => {
    const facts = blankFacts()
    for (const key of fields) {
      facts[key] = labelledValue(lines, labels[key], labels[key].toLowerCase())
      if (key === 'periodStart' || key === 'periodEnd' || key === 'payDate') facts[key] = dateValue(facts[key]) ?? facts[key]
    }
    return facts
  },
}

/* ---------------------------------------------------------------- v2 ----
 * A tabular pay advice: each amount row carries a current-period figure and a
 * year-to-date figure side by side. This is the shape most real payslips use,
 * and the reason the reader has to understand columns rather than labels.
 *
 * Only the "This pay" column is ever read. Its position comes from the header
 * row, and each amount is matched to a column by the centre of its text. If a
 * row does not offer a confident match — a missing header, one lone amount,
 * or two amounts too close together to tell apart — the field is left blank.
 */
const AMOUNT_ROWS: [keyof PayFacts, string][] = [
  ['gross', 'Gross earnings'],
  ['withheld', 'PAYG withholding'],
  ['deductions', 'Other deductions'],
  ['net', 'Net pay'],
  ['super', 'Superannuation'],
]

const AMOUNT = /^\$?\d[\d,]*(?:\.\d{1,2})?$/

/** Column anchors from the totals header row, or null when it is not readable.
 * The `hours` guard keeps this off the earnings header below, which carries
 * the same two phrases but four columns. */
function columns(rows: TextRow[]): { current: number; ytd: number } | null {
  const header = rows.find(r => /this pay/i.test(r.text) && /year to date/i.test(r.text) && !/hours/i.test(r.text))
  if (!header) return null
  const anchor = (word: string) => {
    const token = header.tokens.find(t => t.text.trim().toLowerCase().startsWith(word))
    return token ? tokenCentre(token) : null
  }
  const current = anchor('this'), ytd = anchor('year')
  // The current-period column must sit left of year-to-date, and the two must
  // be far enough apart that "nearest column" is a meaningful question.
  if (current === null || ytd === null || ytd - current < 40) return null
  return { current, ytd }
}

function currentPeriodAmount(row: TextRow, cols: { current: number; ytd: number }): string {
  const amounts = row.tokens.filter(t => AMOUNT.test(t.text.trim()))
  // One amount alone is ambiguous: it could be either column. Ask the user.
  if (amounts.length < 2) return ''
  const scored = amounts.map(t => {
    const centre = tokenCentre(t)
    return { text: t.text.trim(), toCurrent: Math.abs(centre - cols.current), toYtd: Math.abs(centre - cols.ytd) }
  })
  const best = scored.filter(s => s.toCurrent < s.toYtd).sort((a, b) => a.toCurrent - b.toCurrent)[0]
  if (!best) return ''
  // Reject a figure that sits between the columns rather than under one.
  const margin = (cols.ytd - cols.current) / 2
  return best.toCurrent < margin ? best.text : ''
}

/* ----------------------------------------------------- earnings block ----
 * An advice may itemise its earnings above the totals, with an hours and a
 * rate column beside the amounts:
 *
 *   Earnings          Hours      Rate      This pay    Year to date
 *   Ordinary hours    38.00     28.90      1,098.20       32,946.00
 *   Overtime           4.00     43.35        173.40        1,204.00
 *
 * Only the ordinary line is read. An overtime or penalty multiplier depends
 * on the award and the roster, neither of which Xoba Paycheck knows, so those lines
 * are left to the gross total and never checked against an agreed rate.
 */
type Anchors = { hours: number; rate: number; current: number; ytd: number }

function earningsColumns(rows: TextRow[]): Anchors | null {
  const header = rows.find(r => /hours/i.test(r.text) && /rate/i.test(r.text) && /this pay/i.test(r.text))
  if (!header) return null
  const anchor = (word: string) => {
    const token = header.tokens.find(t => t.text.trim().toLowerCase().startsWith(word))
    return token ? tokenCentre(token) : null
  }
  const hours = anchor('hours'), rate = anchor('rate'), current = anchor('this'), ytd = anchor('year')
  if (hours === null || rate === null || current === null || ytd === null) return null
  const ordered = [hours, rate, current, ytd]
  // Columns must run left to right and stay far enough apart that "nearest
  // column" is a meaningful question for a right-aligned figure.
  for (let i = 1; i < ordered.length; i++) if (ordered[i] - ordered[i - 1] < 30) return null
  return { hours, rate, current, ytd }
}

/** The figure under one of several columns, or blank when it is not clearly
 * under any of them. Same discipline as the two-column rule above. */
function columnValue(row: TextRow, anchors: number[], index: number): string {
  const numbers = row.tokens.filter(t => AMOUNT.test(t.text.trim()))
  // One lone figure in a multi-column row could belong to any of them.
  if (numbers.length < 2) return ''
  let best: { text: string; distance: number } | null = null
  for (const token of numbers) {
    const centre = tokenCentre(token)
    const distances = anchors.map(a => Math.abs(centre - a))
    const nearest = distances.indexOf(Math.min(...distances))
    if (nearest !== index) continue
    if (!best || distances[index] < best.distance) best = { text: token.text.trim(), distance: distances[index] }
  }
  if (!best) return ''
  const margin = Math.min(...anchors.flatMap((a, i) => i === index ? [] : [Math.abs(a - anchors[index])])) / 2
  return best.distance < margin ? best.text : ''
}

function ordinaryLine(rows: TextRow[]): Pick<PayFacts, 'hours' | 'rate' | 'ordinary'> | null {
  const cols = earningsColumns(rows)
  if (!cols) return null
  const row = rows.find(r => /^ordinary\b/i.test(r.text.trim()))
  if (!row) return null
  const order = [cols.hours, cols.rate, cols.current, cols.ytd]
  const strip = (v: string) => v.replace(/^\$/, '')
  return { hours: strip(columnValue(row, order, 0)), rate: strip(columnValue(row, order, 1)), ordinary: strip(columnValue(row, order, 2)) }
}

const PAY_ADVICE_V2: PayslipFormat = {
  id: 'pay-advice-v2',
  label: 'PAY ADVICE v2 (this pay / year to date table)',
  marker: 'PAY ADVICE v2',
  detect: lines => lines.some(s => s === 'PAY ADVICE v2'),
  parse: ({ lines, rows }) => {
    const facts = blankFacts()
    facts.employer = labelledValue(lines, 'Employer', 'employer')
    facts.payDate = dateValue(labelledValue(lines, 'Payment date', 'payment date')) ?? ''

    // "Pay period: 01/07/2026 to 14/07/2026" — both ends from one line.
    const period = labelledValue(lines, 'Pay period', 'pay period')
    const ends = period.split(/\s+to\s+/i)
    if (ends.length === 2) {
      facts.periodStart = dateValue(ends[0].trim()) ?? ''
      facts.periodEnd = dateValue(ends[1].trim()) ?? ''
    }

    const cols = columns(rows)
    if (cols) {
      for (const [key, description] of AMOUNT_ROWS) {
        const row = rows.find(r => r.text.trim().toLowerCase().startsWith(description.toLowerCase()))
        if (row) facts[key] = currentPeriodAmount(row, cols).replace(/^\$/, '')
      }
    }
    // A v2 advice has no earnings block, so this reads nothing and its
    // behaviour is unchanged. A v3 advice fills hours, rate and ordinary pay.
    const ordinary = ordinaryLine(rows)
    if (ordinary) Object.assign(facts, ordinary)
    return facts
  },
}

/* ---------------------------------------------------------------- v3 ----
 * The v2 advice with an itemised earnings block. Everything else about it —
 * the totals table, the labelled employer and dates, the untouched
 * year-to-date column — is identical, so it shares v2's parser outright.
 */
const PAY_ADVICE_V3: PayslipFormat = {
  id: 'pay-advice-v3',
  label: 'PAY ADVICE v3 (itemised earnings with hours and rate)',
  marker: 'PAY ADVICE v3',
  detect: lines => lines.some(s => s === 'PAY ADVICE v3'),
  parse: PAY_ADVICE_V2.parse,
}

export const FORMATS: PayslipFormat[] = [SUMMARY_V1, PAY_ADVICE_V2, PAY_ADVICE_V3]

/** The layout this document uses, or null when none of them claims it. */
export function detectFormat(lines: string[]): PayslipFormat | null {
  const matched = FORMATS.filter(f => f.detect(lines))
  if (matched.length > 1) throw new Error('This PDF claims more than one payslip layout. Use one payslip per file, or enter the figures manually.')
  return matched[0] ?? null
}

/** Human-readable name for a recorded format id, for the UI and reports. */
export function formatLabel(id: string | undefined): string | null {
  return FORMATS.find(f => f.id === id)?.label ?? null
}
