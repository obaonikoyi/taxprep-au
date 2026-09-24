import { afterEach, describe, expect, it, vi } from 'vitest'
import { assistedStatement, AssistedStatementError, readStatementWithAssistance } from './assistedStatement'

/*
 * The checksum is the whole design.
 *
 * Nobody is going to hand-check two hundred transactions, so a statement read
 * by a model is not a proposal to eyeball. It is accepted only if it adds up to
 * the opening balance, the closing balance and the totals the statement itself
 * prints — and refused entirely if it does not.
 */
const row = (date: string, description: string, amount: string, balance: string) => ({ date, description, amount, balance })
const good = {
  opening: '1000.00', closing: '1250.50', printedDebits: '149.50', printedCredits: '400.00',
  from: '2026-07-01', to: '2026-07-31', why: '',
  rows: [
    row('2026-07-02', 'WOOLWORTHS 1234 ADELAIDE', '-49.50', '950.50'),
    row('2026-07-05', 'SALARY KESTREL EXAMPLE', '400.00', '1350.50'),
    row('2026-07-20', 'RENT TRANSFER', '-100.00', '1250.50'),
  ],
}
const read = (value: unknown) => assistedStatement(value, 'hash', 'statement.pdf')

describe('a statement is believed only when it adds up', () => {
  it('accepts a transcription that reconciles exactly', () => {
    const statement = read(good)
    expect(statement.rows).toHaveLength(3)
    expect(statement.reconciled).toBe(true)
    expect(statement.opening).toBe(100000)
    expect(statement.closing).toBe(125050)
    expect(statement.format).toBe('assisted-read-v1')
  })

  it('refuses a transcription that lost a transaction', () => {
    // The failure that matters most, and the one nobody would notice by eye.
    expect(() => read({ ...good, rows: [good.rows[0], good.rows[1]] })).toThrow(/do not add up to its closing balance/)
  })

  it('refuses a transcription that invented one', () => {
    expect(() => read({ ...good, rows: [...good.rows, row('2026-07-28', 'SOMETHING MADE UP', '-10.00', '1240.50')] }))
      .toThrow(AssistedStatementError)
  })

  it('refuses a transposed amount', () => {
    expect(() => read({ ...good, rows: [row('2026-07-02', 'WOOLWORTHS', '-94.50', '950.50'), good.rows[1], good.rows[2]] }))
      .toThrow(/running balance after transaction 1/)
  })

  it('catches two mistakes that cancel each other out', () => {
    // Ten dollars too much out and ten too much in. The closing balance still
    // lands, and every running balance agrees with the amounts beside it — so
    // the printed debit and credit totals are the only thing standing here.
    // That is why all three checks are kept rather than just the closing one.
    expect(() => read({
      ...good,
      rows: [
        row('2026-07-02', 'WOOLWORTHS', '-59.50', '940.50'),
        row('2026-07-05', 'SALARY KESTREL EXAMPLE', '410.00', '1350.50'),
        good.rows[2],
      ],
    })).toThrow(/money out does not match the total printed/)
  })

  it('catches a swap the totals cannot see, because the balances can', () => {
    // Same debits, same credits, same closing balance: two amounts swapped
    // between rows. Only the running balance on the row itself notices.
    expect(() => read({
      ...good,
      rows: [
        row('2026-07-02', 'WOOLWORTHS 1234 ADELAIDE', '-100.00', '950.50'),
        good.rows[1],
        row('2026-07-20', 'RENT TRANSFER', '-49.50', '1250.50'),
      ],
    })).toThrow(/running balance after transaction 1/)
  })

  it('refuses when the money out disagrees with the printed total', () => {
    expect(() => read({ ...good, printedDebits: '200.00' })).toThrow(/money out does not match the total printed/)
  })

  it('refuses when the money in disagrees with the printed total', () => {
    expect(() => read({ ...good, printedCredits: '500.00' })).toThrow(/money in does not match the total printed/)
  })

  it('refuses a statement with no balances to check against', () => {
    // Without a checksum there is no reason to believe any of it, and asking a
    // person to verify the rows themselves is asking for a click-through.
    expect(() => read({ ...good, opening: '', printedDebits: '', printedCredits: '' })).toThrow(/cannot be checked/)
  })

  it('still reconciles when the statement prints no running balance on a row', () => {
    const statement = read({ ...good, rows: good.rows.map(r => ({ ...r, balance: '' })) })
    expect(statement.rows).toHaveLength(3)
    expect(statement.rows.every(r => r.balanceCents === null)).toBe(true)
  })

  it('refuses a transaction dated outside the statement period', () => {
    expect(() => read({ ...good, rows: [{ ...good.rows[0], date: '2025-01-05' }, good.rows[1], good.rows[2]] }))
      .toThrow(/outside the statement period/)
  })

  it('refuses a row with a missing date, description or amount', () => {
    for (const patch of [{ date: '' }, { description: '' }, { amount: '' }, { date: 'the 2nd' }, { amount: '$49.50' }])
      expect(() => read({ ...good, rows: [{ ...good.rows[0], ...patch }, good.rows[1], good.rows[2]] })).toThrow(/could not be read/)
  })

  it('passes a refusal’s reason through rather than inventing one', () => {
    expect(() => read({ ...good, rows: [], why: 'This statement is a scan with no readable text.' }))
      .toThrow(/scan with no readable text/)
  })

  it('answers with a refusal for anything that is not a statement at all', () => {
    for (const value of [null, undefined, 'text', 42, [], {}]) expect(() => read(value)).toThrow(AssistedStatementError)
  })

  it('refuses more transactions than it will look at', () => {
    const many = Array.from({ length: 401 }, (_, i) => row('2026-07-02', `ROW ${i}`, '-1.00', '0.00'))
    expect(() => read({ ...good, rows: many })).toThrow(/more than 400 transactions/)
  })

  it('says plainly that the arithmetic cannot vouch for the descriptions', () => {
    // The one thing the checksum does not cover, said where it is read.
    expect(read(good).notices.join(' ')).toMatch(/cannot tell whether a description was copied correctly/)
  })
})

describe('asking the server to read a statement', () => {
  const signal = new AbortController().signal
  const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  afterEach(() => { vi.unstubAllGlobals() })

  it('sends only the text, to this app’s own server', async () => {
    const fetcher = ok({ available: true, statement: good })
    vi.stubGlobal('fetch', fetcher)
    await readStatementWithAssistance('--- page 1 ---\nSTATEMENT', 'hash', 'statement.pdf', signal)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/statement/read')
    expect(url.startsWith('/')).toBe(true)
    expect(JSON.parse(String(init.body))).toEqual({ text: '--- page 1 ---\nSTATEMENT' })
  })

  it('passes the server’s own message through when it refuses', async () => {
    vi.stubGlobal('fetch', ok({ available: false, message: 'Reading an unsupported statement layout is not configured on this deployment. Use a CSV export from your bank instead.' }, 503))
    await expect(readStatementWithAssistance('text', 'hash', 'a.pdf', signal)).rejects.toThrow(/not configured on this deployment/)
  })

  it('survives an error page where JSON was expected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    await expect(readStatementWithAssistance('text', 'hash', 'a.pdf', signal)).rejects.toThrow(/CSV export from your bank/)
  })

  it('says the reader is unreachable rather than failing silently', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    await expect(readStatementWithAssistance('text', 'hash', 'a.pdf', signal)).rejects.toThrow(/Could not reach the statement reader/)
  })
})
