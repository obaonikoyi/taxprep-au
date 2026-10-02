import { blankFacts, fields, money, type PayFacts } from './payslip'
import type { EarningsLine } from './payslipEarnings'

/*
 * The other way to read a payslip: ask a model.
 *
 * Every documented layout in this app is a parser we can hold to its
 * arithmetic, and between them they read three layouts — none of them a real
 * employer's. Someone with their own payslips types about a dozen figures per
 * document and does not come back. This is the path for their layout.
 *
 * What leaves the device, and what does not. The PDF stays here: pdf.js has
 * already extracted the text by the time this runs, and only that text is sent,
 * to this app's own server, which asks the model and keeps nothing. The
 * Content-Security-Policy is unchanged — the browser still talks to no one but
 * this origin. It is still a real change to the promise the app makes, which is
 * why nothing here happens unless the person asks for it per batch.
 *
 * What comes back is a proposal, not a reading. It lands in the same confirm
 * screen every payslip already passes through, with every field editable, and
 * reaches no chart, total or rate check until the person has confirmed it.
 */
export const ASSISTED_FORMAT = 'assisted-read-v1'
export const ASSISTED_ENDPOINT = '/api/payslip/read'

/** What the server may be believed about. Anything else is a blank to fill in. */
export function assistedFacts(value: unknown): PayFacts {
  const facts = blankFacts()
  if (value === null || typeof value !== 'object') return facts
  const source = value as Record<string, unknown>
  for (const field of fields) {
    const read = source[field]
    // The server already narrows this. Doing it again here costs nothing and
    // means a change at either end cannot put a number, a null or an object
    // where the app expects a string it can validate.
    if (typeof read === 'string' && read.length <= 120) facts[field] = read.trim()
  }
  return facts
}

export class AssistedReadError extends Error {}

/**
 * Ask the server to read one payslip's text. Throws `AssistedReadError` with a
 * message meant for the person — the reader being switched off on a deployment
 * is an ordinary answer, not a fault, and it always ends in manual entry.
 */
export async function readWithAssistance(text: string, signal: AbortSignal): Promise<{ facts: PayFacts; lines: EarningsLine[]; kind: DocumentKind; paidTo: string }> {
  let response: Response
  try {
    response = await fetch(ASSISTED_ENDPOINT, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    if (signal.aborted) throw new Error('Reading cancelled. Existing payslips are unchanged.')
    throw new AssistedReadError('Could not reach the assisted reader. Enter the figures from your payslip instead.')
  }

  let body: unknown = null
  try { body = await response.json() } catch { /* an error page, or nothing at all */ }
  const message = typeof (body as { message?: unknown })?.message === 'string'
    ? (body as { message: string }).message
    : 'The assisted reader could not read this payslip. Enter the figures from your payslip instead.'
  if (!response.ok) throw new AssistedReadError(message)

  const facts = assistedFacts((body as { fields?: unknown })?.fields)
  // A reply with nothing in it is a failure to read, not a payslip of zeroes.
  if (fields.every(field => !facts[field])) {
    throw new AssistedReadError('The assisted reader found no figures in this payslip. Enter them from your payslip instead.')
  }
  return {
    facts,
    lines: addingUp(assistedLines((body as { lines?: unknown })?.lines), facts),
    kind: documentKind((body as { documentKind?: unknown })?.documentKind),
    paidTo: name((body as { paidTo?: unknown })?.paidTo),
  }
}

/*
 * What the document is. Anything this app has no sentence for becomes "other",
 * which is the answer that asks the person rather than assuming — never blank,
 * because every file needs an answer.
 */
export const DOCUMENT_KINDS = ['payslip', 'taxReturn', 'annualIncomeStatement', 'bankStatement', 'employmentContract', 'invoice', 'other'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]
export const documentKind = (value: unknown): DocumentKind =>
  typeof value === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(value) ? value as DocumentKind : 'other'

const name = (value: unknown) => typeof value === 'string' && value.length <= 120 ? value.trim() : ''

/*
 * The name a document is made out to, reduced to something that can only be
 * compared.
 *
 * This app has never kept anybody's name and is not going to start. What it
 * needs is narrower than a name: whether two documents in front of it disagree
 * about who they belong to. A digest answers exactly that question and no
 * other — it cannot be shown beside a figure, written into a report or carried
 * out in an export, because there is nothing there to read.
 *
 * Normalised first, so the same name in capitals, with extra spaces or with
 * punctuation is the same person. It cannot do better than that, which is why
 * what it produces is a question and never a verdict.
 */
export async function paidToDigest(paidTo: string): Promise<string> {
  const normalised = paidTo.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (normalised.length < 2) return ''
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalised))
  return [...new Uint8Array(bytes)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

/*
 * The earnings table, narrowed here as well as on the server, because either
 * end could change without the other.
 *
 * A row needs a label and an amount. Hours and a rate are optional: a bonus
 * prints neither, and that row is one the arithmetic skips rather than one
 * that is wrong.
 */
export function assistedLines(value: unknown): EarningsLine[] {
  if (!Array.isArray(value)) return []
  const kept: EarningsLine[] = []
  for (const entry of value.slice(0, 30)) {
    if (entry === null || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const text = (key: string, longest: number) => {
      const read = row[key]
      return typeof read === 'string' && read.length <= longest ? read.trim() : ''
    }
    const figure = (key: string) => {
      const read = text(key, 40)
      return /^\d{1,7}(?:\.\d{1,4})?$/.test(read) ? read : ''
    }
    const label = text('label', 80), amount = figure('amount')
    if (!label || !amount) continue
    kept.push({ label, hours: figure('hours'), rate: figure('rate'), amount })
  }
  return kept
}

/*
 * The table's own checksum, and the reason an assisted reading of it can be
 * shown at all.
 *
 * Nobody checks thirty transcribed numbers by hand, so the payslip does the
 * checking. The server has already looked for every figure in the text; what
 * it cannot do as well as this can is arithmetic against the gross the person
 * is about to confirm. A dropped row and an unitemised allowance look exactly
 * alike in a total, so the only safe reading of a table that does not add up
 * is no table.
 *
 * Deliberately stricter than a documented layout, where the parser is
 * deterministic and an allowance outside the hours table is simply reported.
 * Here the same shortfall could be a row that was never read.
 */
export function addingUp(lines: EarningsLine[], facts: PayFacts): EarningsLine[] {
  if (!lines.length) return []
  const gross = money(facts.gross)
  if (gross === null) return []
  const amounts = lines.map(line => money(line.amount))
  if (amounts.some(amount => amount === null)) return []
  // A cent of slack, as everywhere else here: payroll systems disagree about
  // rounding half a cent, and a table can carry that difference a row at a time.
  return Math.abs(amounts.reduce((a, b) => a! + b!, 0)! - gross) <= lines.length ? lines : []
}
