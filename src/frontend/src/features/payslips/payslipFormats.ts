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
import type { EarningsLine } from './payslipEarnings'

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
/*
 * Figures inside the earnings block, where a rate carries more decimals than
 * money does — an afternoon loading of $49.8080 is an ordinary thing for a
 * payroll system to print. A token filter that stops at two places cannot see
 * such a rate at all, so the column it sits in reads as empty and the line
 * goes unchecked. The totals table below keeps the stricter pattern: a gross
 * printed to four places would be a misread, not a rate.
 */
const FIGURE = /^\$?\d[\d,]*(?:\.\d{1,4})?$/

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
 * Every line is read, not only the one labelled "Ordinary".
 *
 * It used to be only that one, because a penalty multiplier depends on an
 * award and a roster this app does not know. That reasoning holds for the word
 * "correct" and for nothing else — and taking one row of a shift worker's
 * table can mean reading nine percent of their pay. Whether a line's hours
 * times its rate equals the amount printed beside it needs no award. Neither
 * does whether the lines add up. Nothing here decides that a loading is the
 * right one; see payslipEarnings.ts for what is and is not concluded.
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
  const numbers = row.tokens.filter(t => FIGURE.test(t.text.trim()))
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

const HEADER = (r: TextRow) => /hours/i.test(r.text) && /rate/i.test(r.text) && /this pay/i.test(r.text)
const ORDINARY = /^ordinary\b/i

/**
 * Every row of the earnings block, in the order the payslip prints them.
 * Empty when the document has no such block, which is every v2 advice and
 * every summary layout, so callers need no special case for those.
 */
export function earningsLines(rows: TextRow[]): EarningsLine[] {
  const cols = earningsColumns(rows)
  const start = rows.findIndex(HEADER)
  if (!cols || start < 0) return []
  const order = [cols.hours, cols.rate, cols.current, cols.ytd]
  const strip = (v: string) => v.replace(/^\$/, '')
  const lines: EarningsLine[] = []
  for (const row of rows.slice(start + 1)) {
    const text = row.text.trim()
    /*
     * The block ends at its own total or at whatever section starts next —
     * and the next section announces itself with a header of its own. Reading
     * past it would take the totals table's rows for earnings lines and count
     * gross a second time.
     */
    if (!text || /^total\b/i.test(text) || HEADER(row) || /^description\b/i.test(text)) break
    const label = row.tokens.filter(t => t.text.trim() && !FIGURE.test(t.text.trim()) && tokenCentre(t) < cols.hours)
      .map(t => t.text.trim()).join(' ').replace(/\s+/g, ' ').trim()
    const amount = strip(columnValue(row, order, 2))
    // A row with no label or no amount under "this pay" is not an earnings
    // line; a note printed inside the block should not become one.
    if (!label || !amount) continue
    lines.push({ label, hours: strip(columnValue(row, order, 0)), rate: strip(columnValue(row, order, 1)), amount })
  }
  return lines
}

/*
 * "28.7600" to "28.76", but "31.6360" left exactly as it is.
 *
 * Trailing zeros past two places are padding a payroll system printed; digits
 * past two places are the figure itself, and dropping them would change
 * somebody's rate. The review form holds hours and money to two places, so a
 * line padded out to four has to be trimmed to go in it — and one that is
 * genuinely finer than that is left alone and flagged by the form rather than
 * quietly rounded behind the person's back. The full precision is kept either
 * way on the earnings line, which is where the arithmetic is done.
 */
export const trimToCents = (value: string) => {
  const m = value.trim().match(/^(\$?\d[\d,]*\.\d\d)0+$/)
  return m ? m[1] : value.trim()
}

/** The ordinary line's three fields, which are the ones the review form has
 * always carried. Unchanged in what it returns, beyond the trimming above. */
function ordinaryLine(rows: TextRow[]): Pick<PayFacts, 'hours' | 'rate' | 'ordinary'> | null {
  const line = earningsLines(rows).find(l => ORDINARY.test(l.label))
  return line ? { hours: trimToCents(line.hours), rate: trimToCents(line.rate), ordinary: trimToCents(line.amount) } : null
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
/*
 * Reading a marker off a picture.
 *
 * A recogniser is very good at figures and merely good at short strings of
 * mixed letters and digits. Recognising a drawn "PAYSLIP SUMMARY v1" gives back
 * "PAYSLIP SUMMARY vl" — a lowercase L where the 1 should be — which is exactly
 * the kind of miss that costs nothing in a sentence and everything in a marker
 * compared with ===. Every figure on that same payslip came back correct.
 *
 * So a picture's marker line is compared with the handful of substitutions a
 * recogniser actually makes, and nothing else is loosened: field labels and
 * every value are still matched exactly, and a label that is misread simply
 * leaves its field blank for the person to fill in.
 *
 * This is narrow on purpose. It decides which parser reads a payslip, and a
 * marker matched too eagerly would hand a payslip to a parser that does not
 * understand it. "PAYSLIP SUMMARY v1" and "PAY ADVICE v2" differ by far more
 * than the characters below, so folding them together is not a risk this
 * creates.
 */
const CONFUSED: Record<string, string> = { O: '0', Q: '0', D: '0', L: '1', I: '1', '|': '1', S: '5', B: '8', Z: '2', G: '6' }
const canonical = (value: string) => value.toUpperCase().replace(/\s+/g, ' ').trim()
  .split('').map(character => CONFUSED[character] ?? character).join('')

export function detectFormat(lines: string[], recognised = false): PayslipFormat | null {
  const loosely = (format: PayslipFormat) => lines.some(line => canonical(line) === canonical(format.marker))
  const matched = FORMATS.filter(f => f.detect(lines) || (recognised && loosely(f)))
  if (matched.length > 1) throw new Error('This PDF claims more than one payslip layout. Use one payslip per file, or enter the figures manually.')
  return matched[0] ?? null
}

/*
 * Human-readable name for a recorded format id, for the UI and reports.
 *
 * Not every reading comes from a documented layout. A payslip read by asking a
 * model carries its own id, and it used to render as nothing at all — so the
 * one reading a person has most reason to look at twice was the one that said
 * least about itself.
 */
export function formatLabel(id: string | undefined): string | null {
  if (id === 'assisted-read-v1') return 'a layout we do not document, read for you'
  return FORMATS.find(f => f.id === id)?.label ?? null
}
