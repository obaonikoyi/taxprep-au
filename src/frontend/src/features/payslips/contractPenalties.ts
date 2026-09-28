/*
 * Comparing the lines a payslip pays against the penalty rates a contract
 * states. Both documents are the person's own; nothing here knows an award.
 *
 * This is the other half of Milestone 29. The payslip side reads every line of
 * the earnings table and can say what each rate is as a multiple of the
 * ordinary one — but a multiple is only a description until there is something
 * to compare it with. A contract that says "work performed on a Saturday is
 * paid at time and a half" supplies that, and only for the days it names.
 *
 * What this will not do is fill a gap. A payslip line with no matching term is
 * reported as not compared, never assumed to be fine; a contract term with no
 * matching line is reported as not seen, never treated as unpaid.
 */
import { lineHours, rateValue, type EarningsLine } from './payslipEarnings'

/** As the contract reader returns it. Exactly one of multiplier and amount. */
export type ContractPenalty = { kind: string; multiplier: string; amount: string; quote: string }

export const PENALTY_KINDS = ['saturday', 'sunday', 'publicHoliday', 'evening', 'night', 'overtime'] as const
export type PenaltyKind = (typeof PENALTY_KINDS)[number]

export const kindLabels: Record<PenaltyKind, string> = {
  saturday: 'Saturday', sunday: 'Sunday', publicHoliday: 'Public holiday',
  evening: 'Evening', night: 'Night', overtime: 'Overtime',
}

/* The same words inside a sentence. A day of the week keeps its capital
 * wherever it sits; the rest are ordinary nouns and lowercasing the label
 * blindly would give "The saturday rate", which reads like a typo. */
export const kindInSentence: Record<PenaltyKind, string> = {
  saturday: 'Saturday', sunday: 'Sunday', publicHoliday: 'public holiday',
  evening: 'evening', night: 'night', overtime: 'overtime',
}

/*
 * Which kind of day a payslip line is for, read from how it is labelled.
 *
 * Ordered, because a label can carry two of these words: "Saturday overtime"
 * is overtime worked on a Saturday, and a contract's Saturday rate is not the
 * rate for it. Overtime and public holidays are tested first for that reason.
 *
 * A label matching nothing here is not a penalty line, which is the right
 * answer for "Ordinary hours", "Bonus", "Allowance" and anything else this app
 * has no business making a claim about.
 */
const PATTERNS: [PenaltyKind, RegExp][] = [
  ['overtime', /\b(overtime|o\/?t)\b/i],
  ['publicHoliday', /\b(public holiday|pub hol|holiday)\b/i],
  ['saturday', /\b(saturday|sat)\b/i],
  ['sunday', /\b(sunday|sun)\b/i],
  ['night', /\b(night|graveyard)\b/i],
  ['evening', /\b(evening|afternoon|arvo|late)\b/i],
]
export function kindOf(label: string): PenaltyKind | null {
  for (const [kind, pattern] of PATTERNS) if (pattern.test(label)) return kind
  return null
}

/*
 * Half a cent either way.
 *
 * A contract states a multiplier and a payroll system applies it to a rate
 * that may itself have four places, so the product can be finer than anything
 * either document prints. Being exact here would raise questions about pay
 * that is right; being loose would miss a real difference. Half a cent is the
 * smallest unit either document can express.
 */
export const RATE_TOLERANCE = 50

export type PenaltyComparison = {
  kind: PenaltyKind
  /** The payslip line's own label, so the screen can say what the person reads. */
  label: string
  /** What this line was actually paid at, in ten-thousandths. */
  paid: number
  /** The line's hours, in ten-thousandths, or null when it prints none. A gap
   * of a few cents an hour means nothing until it is multiplied out. */
  hours: number | null
  /** What the contract's term comes to, in ten-thousandths. */
  expected: number
  agrees: boolean
  /** How the contract put it: a multiple of the ordinary rate, or a flat rate. */
  basis: 'multiplier' | 'amount'
  multiplier: string
  quote: string
}

export type PenaltyCheck = {
  /** Lines compared against a contract term, agreeing or not. */
  compared: PenaltyComparison[]
  /** Those that do not agree. The only thing worth raising. */
  differing: PenaltyComparison[]
  /** Penalty lines the contract says nothing about. Not a problem — a silence. */
  uncompared: string[]
  /** Kinds the contract states that this payslip has no line for. Also a silence:
   * a fortnight with no Sunday shift pays no Sunday penalty. */
  unseen: PenaltyKind[]
}

/**
 * @param lines every earnings line read from the payslip
 * @param ordinary the ordinary rate in ten-thousandths, or null when unknown
 * @param penalties the terms the contract states
 */
export function checkAgainstContract(lines: EarningsLine[], ordinary: number | null, penalties: ContractPenalty[]): PenaltyCheck {
  const terms = new Map<string, ContractPenalty>()
  for (const penalty of penalties) if (!terms.has(penalty.kind)) terms.set(penalty.kind, penalty)

  const compared: PenaltyComparison[] = []
  const uncompared: string[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const kind = kindOf(line.label)
    if (!kind) continue
    seen.add(kind)
    const paid = rateValue(line.rate)
    const term = terms.get(kind)
    // No term, or no rate printed on the line, or a multiplier with no
    // ordinary rate to apply it to: all silences, none of them findings.
    if (!term || paid === null) { uncompared.push(line.label); continue }
    const expected = term.multiplier
      ? ordinary === null ? null : Math.round((ordinary * rateValue(term.multiplier)!) / 10_000)
      : rateValue(term.amount)
    if (expected === null) { uncompared.push(line.label); continue }
    compared.push({
      kind, label: line.label, paid, expected, hours: lineHours(line.hours),
      agrees: Math.abs(paid - expected) <= RATE_TOLERANCE,
      basis: term.multiplier ? 'multiplier' : 'amount',
      multiplier: term.multiplier,
      quote: term.quote,
    })
  }

  return {
    compared,
    differing: compared.filter(c => !c.agrees),
    uncompared,
    unseen: [...terms.keys()].filter(k => !seen.has(k)) as PenaltyKind[],
  }
}
