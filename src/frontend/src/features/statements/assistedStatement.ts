import { isoDate, type Statement, type StatementRow } from './statementParser'

/*
 * Reading a bank statement whose layout nobody documented.
 *
 * This is the most sensitive document the app touches, and it is not close. A
 * payslip says who employs you and what you earn. A statement says where you
 * shop, what you subscribe to, who you pay and when, line by line. So this is
 * off unless the person turns it on for that one file, the statement is never
 * uploaded — only the text the browser already extracted, to this origin — and
 * nothing about it is stored anywhere.
 *
 * What makes it defensible is something the payslip reader does not have: a
 * statement carries its own checksum. It prints an opening balance, a closing
 * balance and the debit and credit totals, and the transactions between them
 * must come to exactly that.
 *
 * So a reading here is not a proposal to eyeball. Nobody is going to check two
 * hundred rows by hand, and a screen that asks them to is a screen that gets
 * clicked past. It is arithmetic: it reconciles, or it is refused and the
 * person is sent to their bank's CSV export, which always works.
 */
export const ASSISTED_STATEMENT_FORMAT = 'assisted-read-v1'
export const ASSISTED_STATEMENT_ENDPOINT = '/api/statement/read'
export const MAX_ASSISTED_ROWS = 400

export class AssistedStatementError extends Error {}

type ReadRow = { date: string; description: string; amount: string; balance: string }

const text = (value: unknown, longest: number) =>
  typeof value === 'string' && value.length <= longest ? value.trim() : ''

/*
 * An amount as this reader asks for it: plain, signed, negative for money out.
 * Deliberately not the statement parser's own reader, which takes its sign from
 * a CR/DR column that a transcription does not have — and deliberately strict,
 * because a currency symbol or a bracket means the transcriber did something
 * other than what it was asked, and that is worth failing on rather than
 * interpreting.
 */
function signedMoney(value: string): number | null {
  const match = value.match(/^(-?)((?:\d{1,3}(?:,\d{3})+|\d{1,9}))(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const cents = Number(match[2].replaceAll(',', '')) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_000) return null
  return match[1] ? -cents : cents
}

/** A date the statement stated, or null. Never today's date, never a guess. */
function readDate(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return isoDate(+match[3], +match[2] - 1, +match[1])
}

/**
 * Turn the answer into a statement, or throw with a reason the person can act
 * on. Every figure is re-derived here; nothing the server said is taken on
 * trust beyond its being a string.
 */
export function assistedStatement(value: unknown, id: string, name: string): Statement {
  const source = (value !== null && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const why = text(source.why, 300)
  const listed = Array.isArray(source.rows) ? source.rows : []
  if (!listed.length) {
    throw new AssistedStatementError(why || 'No transactions could be read from this statement. Use a CSV export from your bank instead.')
  }
  if (listed.length > MAX_ASSISTED_ROWS) {
    throw new AssistedStatementError(`This statement has more than ${MAX_ASSISTED_ROWS} transactions. Use a shorter period, or a CSV export from your bank.`)
  }

  const opening = signedMoney(text(source.opening, 40))
  const closing = signedMoney(text(source.closing, 40))
  const printedDebits = signedMoney(text(source.printedDebits, 40))
  const printedCredits = signedMoney(text(source.printedCredits, 40))
  const from = readDate(text(source.from, 40))
  const to = readDate(text(source.to, 40))

  /*
   * Without an opening and a closing balance there is no checksum, and without
   * a checksum there is no reason to believe any of this. A person cannot
   * verify two hundred rows and should not be asked to pretend otherwise.
   */
  if (opening === null || closing === null) {
    throw new AssistedStatementError('This statement does not print an opening and closing balance, so the transactions read from it cannot be checked. Use a CSV export from your bank instead.')
  }
  if (!from || !to || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) {
    throw new AssistedStatementError('The statement period could not be read, or covers more than a year. Use a CSV export from your bank instead.')
  }

  const rows: StatementRow[] = []
  let running = opening
  let debits = 0
  let credits = 0

  listed.forEach((entry, index) => {
    const row = (entry !== null && typeof entry === 'object' ? entry : {}) as Partial<ReadRow>
    const date = readDate(text(row.date, 40))
    const description = text(row.description, 1000)
    const cents = signedMoney(text(row.amount, 40))
    const stated = text(row.balance, 40)
    const balanceCents = stated ? signedMoney(stated) : null

    if (!date || !description || cents === null || (stated && balanceCents === null)) {
      throw new AssistedStatementError(`Transaction ${index + 1} could not be read from this statement. Use a CSV export from your bank instead.`)
    }
    if (date < from || date > to) {
      throw new AssistedStatementError(`Transaction ${index + 1} is dated outside the statement period. Use a CSV export from your bank instead.`)
    }

    running += cents
    if (cents < 0) debits -= cents; else credits += cents
    // A printed running balance is a checksum on every single row, not just on
    // the total: two mistakes that cancel out still fail here.
    if (balanceCents !== null && balanceCents !== running) {
      throw new AssistedStatementError(`The running balance after transaction ${index + 1} does not match the statement. Nothing has been imported — use a CSV export from your bank instead.`)
    }
    rows.push({ id: `${id}:${index + 1}`, date, description, cents, balanceCents, page: index + 1, valueDate: null })
  })

  // The checksum. A dropped transaction, a transposed amount and an invented
  // row all break this, and none of them can be hidden from it.
  if (running !== closing) {
    throw new AssistedStatementError('The transactions read from this statement do not add up to its closing balance, so they have not been imported. Use a CSV export from your bank instead.')
  }
  if (printedDebits !== null && debits !== printedDebits) {
    throw new AssistedStatementError('The money out does not match the total printed on this statement, so nothing has been imported. Use a CSV export from your bank instead.')
  }
  if (printedCredits !== null && credits !== printedCredits) {
    throw new AssistedStatementError('The money in does not match the total printed on this statement, so nothing has been imported. Use a CSV export from your bank instead.')
  }

  const dates = rows.map(r => r.date).sort()
  return {
    id, name, format: ASSISTED_STATEMENT_FORMAT,
    from: dates[0], to: dates.at(-1)!,
    opening, closing, printedDebits, printedCredits, rows,
    notices: [
      'This statement was read by a model because its layout is not one this app documents. Every transaction was checked against the statement’s own opening balance, closing balance and printed totals, and they add up exactly.',
      'Those checks cannot tell whether a description was copied correctly. Compare a few against your statement before relying on the categories.',
    ],
    issues: [], pages: 0,
    // Only ever reached when the arithmetic closes, which is what this means.
    reconciled: true,
  }
}

/** Ask the server to read one statement's text. Always ends somewhere that works. */
export async function readStatementWithAssistance(text: string, id: string, name: string, signal: AbortSignal): Promise<Statement> {
  let response: Response
  try {
    response = await fetch(ASSISTED_STATEMENT_ENDPOINT, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    if (signal.aborted) throw new Error('Reading cancelled. Your previous statement is unchanged.')
    throw new AssistedStatementError('Could not reach the statement reader. Use a CSV export from your bank instead.')
  }

  let body: unknown = null
  try { body = await response.json() } catch { /* an error page, or nothing at all */ }
  const message = typeof (body as { message?: unknown })?.message === 'string'
    ? (body as { message: string }).message
    : 'The statement could not be read. Use a CSV export from your bank instead.'
  if (!response.ok) throw new AssistedStatementError(message)
  return assistedStatement((body as { statement?: unknown })?.statement, id, name)
}
