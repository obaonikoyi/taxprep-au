/*
 * Two questions the app asks about a file before it joins a pay history:
 * what is it, and whose is it.
 *
 * Both are answered by the reading that already happened, so neither costs a
 * request. Both end in a sentence the person can overrule, because a classifier
 * that locks somebody out of their own unusual payslip is a worse failure than
 * one that lets a tax return through with a warning attached.
 */
import type { Payslip } from './payslip'
import type { DocumentKind } from './assistedReader'

/*
 * Why each kind is the wrong thing to add, in the terms that matter to the
 * person rather than to the reader.
 *
 * A tax return gets the longest sentence because it is both the likeliest wrong
 * document and the worst one to have misread: its figures cover a whole year,
 * so counted as a fortnight they are out by a factor of twenty-six.
 */
const NOTICES: Record<Exclude<DocumentKind, 'payslip'>, { what: string; why: string }> = {
  taxReturn: {
    what: 'a tax return or notice of assessment',
    why: 'Its figures cover a whole financial year, not one pay period. Added to your pay history they would count a year as a fortnight.',
  },
  annualIncomeStatement: {
    what: 'an income statement or payment summary',
    why: 'It covers a whole financial year. Your payslips already add up to it, so adding both would count the same pay twice. The year-end step is where this one belongs.',
  },
  bankStatement: {
    what: 'a bank statement',
    why: 'It shows money arriving in an account, not what was earned or what tax was taken out. Xoba Paycheck reads bank statements on the Bank spending screen.',
  },
  employmentContract: {
    what: 'an employment contract or letter of offer',
    why: 'It states what you agreed to be paid, not what you were paid. Record it as your agreed rate instead, in Pay rate checks.',
  },
  invoice: {
    what: 'an invoice or receipt',
    why: 'It is not a record of wages paid to you.',
  },
  other: {
    what: 'something other than a payslip',
    why: 'A payslip covers one pay period and shows what you earned, what tax was taken out, and what you were paid.',
  },
}

export type KindNotice = { heading: string; what: string; why: string; unsure: boolean }

/** What to say about a file the reading did not call a payslip. */
export function kindNotice(kind: DocumentKind): KindNotice | null {
  if (kind === 'payslip') return null
  const notice = NOTICES[kind]
  return {
    // "Does not look like" rather than "is not": the reading is an opinion, and
    // the person is about to be offered the chance to disagree with it.
    heading: `This does not look like a payslip`,
    what: notice.what,
    why: notice.why,
    // 'other' is the reader saying it could not place the document, which is a
    // weaker claim than naming a kind — so the invitation to overrule is louder.
    unsure: kind === 'other',
  }
}

/*
 * Do the documents in front of us disagree about whose they are?
 *
 * Not an identity check. The app does not know who you are and is not going to:
 * what it has is a digest per document, and all it can see is that two of them
 * differ. A name written two ways — "O. Onikoyi" on one employer's payslip and
 * the full name on another's — looks exactly like two people from here, which
 * is why the answer is always a question and never a refusal.
 */
export type NameGroup = { key: string; names: string[] }

export function mixedNames(slips: Payslip[]): NameGroup[] {
  const groups = new Map<string, string[]>()
  for (const slip of slips) {
    if (!slip.paidToKey) continue
    groups.set(slip.paidToKey, [...(groups.get(slip.paidToKey) ?? []), slip.name])
  }
  return groups.size > 1 ? [...groups].map(([key, names]) => ({ key, names })) : []
}
