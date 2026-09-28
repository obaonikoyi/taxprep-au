/*
 * The whole earnings table, not just its first line.
 *
 * Until now one row of that table was read — the one labelled "Ordinary" — and
 * the rest were left to the gross total, on the reasoning that a penalty
 * multiplier depends on an award and a roster that this app does not know.
 * That reasoning holds for the word "correct" and for nothing else. A real
 * payslip brought to this project:
 *
 *   Ordinary Hours    8.0000   $45.2800     $362.24
 *   Afternoon Hours  38.5000   $49.8080   $1,917.61
 *   Saturday Hours    7.5000   $63.3920     $475.44
 *   Sunday Hours     15.5000   $81.5040   $1,263.31
 *                                        ----------
 *                                         $4,018.60
 *
 * Reading only the first row means checking $362 of $4,019 — nine percent —
 * and shift work, where the loadings are, is where pay most often goes wrong.
 *
 * None of the arithmetic below needs an award. Whether hours times rate equals
 * the amount printed beside it is a fact about the page. Whether the rows add
 * up to the total is a fact about the page. What each rate is as a multiple of
 * the ordinary rate is a fact about the page. Whether 1.4 is the *right*
 * Saturday loading is not, and nothing here says it is.
 */
import type { PayFacts } from './payslip'
import { money } from './payslip'

export type EarningsLine = { label: string; hours: string; rate: string; amount: string }

/*
 * Rates carry more decimals than money does, and it is not decoration: this
 * payslip's afternoon rate is $49.8080, and 38.5 hours of it comes to
 * $1,917.608, printed as $1,917.61. Round the rate to cents first and the same
 * multiplication gives $1,917.69 — eight cents out, on every line, for the
 * whole table. The check would then fail on payslips that are perfectly
 * consistent, which is worse than not checking.
 *
 * Held as ten-thousandths, so nothing here touches a float.
 */
export function rateValue(value: string): number | null {
  const m = value.trim().match(/^\$?((?:\d{1,3}(?:,\d{3})+|\d{1,6}))(?:\.(\d{1,4}))?$/)
  if (!m) return null
  const n = Number(m[1].replaceAll(',', '')) * 10_000 + Number((m[2] ?? '').padEnd(4, '0'))
  return Number.isSafeInteger(n) && n <= 100_000_0000 ? n : null
}
export const rateText = (tenThousandths: number) =>
  (tenThousandths / 10_000).toFixed(4).replace(/(\.\d\d)00$/, '$1')

/** Hours are printed to four places too ("8.0000"), so this is deliberately
 * more permissive than the two-place `hoursValue` the review form enforces. */
export function lineHours(value: string): number | null {
  const m = value.trim().match(/^(\d{1,3})(?:\.(\d{1,4}))?$/)
  if (!m) return null
  const n = Number(m[1]) * 10_000 + Number((m[2] ?? '').padEnd(4, '0'))
  return n <= 400_0000 ? n : null
}

/** Hours (ten-thousandths) x rate (ten-thousandths), in whole cents. */
export const lineAmount = (hours: number, rate: number) => Math.round((hours * rate) / 1_000_000)

export type LineCheck = {
  label: string
  hours: number | null
  rate: number | null
  amount: number | null
  /** What hours x rate comes to, when both were readable. */
  expected: number | null
  /*
   * Null when it could not be worked out at all — a line with no rate printed
   * is common and is not a discrepancy. A cent either way is allowed because
   * payroll systems disagree about rounding half a cent, and being strict
   * there would raise a question about a payslip that is perfectly consistent.
   */
  multipliesOut: boolean | null
  /** This line's rate over the ordinary rate, in ten-thousandths: 14_000 is 1.4. */
  multiplier: number | null
}

export type EarningsCheck = {
  lines: LineCheck[]
  /** The lines that do not multiply out. Empty is the ordinary case. */
  disagreeing: LineCheck[]
  /** Everything the table accounts for, in cents. */
  itemised: number | null
  /** Gross, when it was readable, so the caller can say what is not itemised. */
  gross: number | null
  /** Gross minus itemised: allowances, bonuses, anything not in the table. */
  unitemised: number | null
  /** The ordinary line's rate, which multipliers are expressed against. */
  ordinaryRate: number | null
  /** What the ordinary line is worth as a share of gross, in whole percent.
   * This is the number that says how much a rate check actually covered. */
  ordinaryShare: number | null
}

const ORDINARY = /^ordinary\b/i

export function checkEarnings(lines: EarningsLine[], facts: PayFacts): EarningsCheck {
  const ordinaryRate = (() => {
    const row = lines.find(l => ORDINARY.test(l.label))
    return row ? rateValue(row.rate) : rateValue(facts.rate)
  })()

  const checked: LineCheck[] = lines.map(line => {
    const hours = lineHours(line.hours), rate = rateValue(line.rate), amount = money(line.amount)
    const expected = hours !== null && rate !== null ? lineAmount(hours, rate) : null
    return {
      label: line.label,
      hours, rate, amount, expected,
      multipliesOut: expected === null || amount === null ? null : Math.abs(expected - amount) <= 1,
      multiplier: rate !== null && ordinaryRate ? Math.round((rate * 10_000) / ordinaryRate) : null,
    }
  })

  const amounts = checked.map(l => l.amount)
  const itemised = amounts.length && amounts.every(a => a !== null) ? amounts.reduce((a, b) => a! + b!, 0) : null
  const gross = money(facts.gross)
  const ordinaryAmount = checked.find(l => ORDINARY.test(l.label))?.amount ?? null

  return {
    lines: checked,
    disagreeing: checked.filter(l => l.multipliesOut === false),
    itemised,
    gross,
    unitemised: gross !== null && itemised !== null ? gross - itemised : null,
    ordinaryRate,
    ordinaryShare: gross && ordinaryAmount !== null ? Math.round((ordinaryAmount * 100) / gross) : null,
  }
}

/*
 * A loading printed beside a line. Australian penalty rates land on halves and
 * quarters — 1.25, 1.5, 1.75, 2 — so an exact one should read as "1.5" and not
 * "1.5000". Trailing zeros go; significant places stay. A rate that is really
 * 1.4997 of the ordinary one is shown as 1.4997 rather than rounded into
 * looking like the round number it is not, because that would be this app
 * inventing a fact about somebody's pay.
 */
export const multiplierText = (tenThousandths: number) =>
  (tenThousandths / 10_000).toFixed(4).replace(/\.?0+$/, '')
