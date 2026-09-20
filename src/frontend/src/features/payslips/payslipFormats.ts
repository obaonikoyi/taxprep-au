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

/** Column anchors from the header row, or null when it is not readable. */
function columns(rows: TextRow[]): { current: number; ytd: number } | null {
  const header = rows.find(r => /this pay/i.test(r.text) && /year to date/i.test(r.text))
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
    return facts
  },
}

export const FORMATS: PayslipFormat[] = [SUMMARY_V1, PAY_ADVICE_V2]

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
