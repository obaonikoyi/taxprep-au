import { afterEach, describe, expect, it, vi } from 'vitest'
import { ASSISTED_ENDPOINT, assistedFacts, AssistedReadError, readWithAssistance } from './assistedReader'
import { fields } from './payslip'

/*
 * The model's answer is data from outside the app, so it is checked like any
 * other. These are the boundary: what is allowed through, and what becomes a
 * blank for the person to fill in.
 */
const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
const complete = {
  employer: 'Kestrel Example Hospitality', periodStart: '2026-08-12', periodEnd: '2026-08-25', payDate: '2026-08-27',
  gross: '1906.50', withheld: '295.00', deductions: '0.00', net: '1611.50',
  super: '219.25', hours: '62.00', rate: '30.75', ordinary: '1906.50',
}
afterEach(() => { vi.unstubAllGlobals() })

describe('what the assisted reader will believe', () => {
  it('keeps the twelve fields and nothing else', () => {
    const facts = assistedFacts({ ...complete, ytdGross: '48912.00', note: 'anything' })
    expect(Object.keys(facts).sort()).toEqual([...fields].sort())
    expect(facts.rate).toBe('30.75')
  })

  it('blanks anything that is not a string, rather than passing it on', () => {
    const facts = assistedFacts({ employer: { name: 'Kestrel' }, gross: 1906.5, net: null, withheld: ['295.00'], super: true })
    for (const field of fields) expect(facts[field]).toBe('')
  })

  it('blanks a value too long to be a figure or an employer name', () => {
    expect(assistedFacts({ employer: 'x'.repeat(200), gross: '1906.50' })).toMatchObject({ employer: '', gross: '1906.50' })
  })

  it('answers blanks for anything that is not an object at all', () => {
    for (const value of [null, undefined, 'a string', 42, [1, 2, 3]]) {
      const facts = assistedFacts(value)
      expect(fields.every(field => facts[field] === '')).toBe(true)
    }
  })
})

describe('asking the server to read a payslip', () => {
  const signal = new AbortController().signal

  it('sends only the text, to this app’s own server', async () => {
    const fetcher = ok({ available: true, fields: complete })
    vi.stubGlobal('fetch', fetcher)
    await readWithAssistance('PAY ADVICE\nGross 1906.50', signal)
    expect(fetcher).toHaveBeenCalledOnce()
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(ASSISTED_ENDPOINT)
    expect(url.startsWith('/')).toBe(true)
    expect(JSON.parse(String(init.body))).toEqual({ text: 'PAY ADVICE\nGross 1906.50' })
  })

  it('returns the proposed figures', async () => {
    vi.stubGlobal('fetch', ok({ available: true, fields: complete }))
    await expect(readWithAssistance('some payslip text', signal)).resolves.toMatchObject({ facts: { gross: '1906.50', hours: '62.00' } })
  })

  // The reader is off on any deployment without a key, which is most of them.
  // That is an ordinary answer and the person is sent to manual entry.
  it('passes the server’s own message through when it refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false, message: 'The assisted reader is not configured on this deployment. Enter the figures from your payslip instead.' }), { status: 503 })))
    await expect(readWithAssistance('some payslip text', signal)).rejects.toThrow(/not configured on this deployment/)
  })

  // The server limits how many payslips it will read, because each one costs
  // whoever runs the deployment money. A person who meets that limit is told
  // when to come back and what to do instead, not shown a generic failure.
  it('passes a limit message through with what to do instead', async () => {
    const message = 'You have had a lot of payslips read recently. The assisted reader is available to you again in about 12 minutes. Enter the figures from this payslip instead — that always works.'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false, message }), { status: 429, headers: { 'Retry-After': '720' } })))
    await expect(readWithAssistance('some payslip text', signal)).rejects.toThrow(/available to you again in about 12 minutes/)
    await expect(readWithAssistance('some payslip text', signal)).rejects.toThrow(/Enter the figures/)
  })

  it('treats a reply with no figures in it as a failure to read, not a payslip of zeroes', async () => {
    vi.stubGlobal('fetch', ok({ available: true, fields: Object.fromEntries(fields.map(f => [f, ''])) }))
    await expect(readWithAssistance('some payslip text', signal)).rejects.toBeInstanceOf(AssistedReadError)
  })

  it('survives an error page where JSON was expected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    await expect(readWithAssistance('some payslip text', signal)).rejects.toThrow(/Enter the figures from your payslip/)
  })

  it('says the reader is unreachable rather than failing silently', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    await expect(readWithAssistance('some payslip text', signal)).rejects.toThrow(/Could not reach the assisted reader/)
  })

  it('reports a cancellation as a cancellation, not as a reader fault', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError') }))
    await expect(readWithAssistance('some payslip text', controller.signal)).rejects.toThrow(/cancelled/i)
  })
})

/*
 * The earnings table an assisted reading brings back, and the arithmetic that
 * decides whether it may be shown at all.
 *
 * This is the whole reason the table can come from a model. Nobody checks
 * thirty transcribed numbers by hand, so the payslip checks them: the server
 * looks for every figure in the document, and this end makes the rows add up
 * to the gross the person is about to confirm. A dropped row and an
 * unitemised allowance look identical in a total, so a table that does not add
 * up is not a table with a gap — it is a table that cannot be trusted.
 */
describe('the earnings table from an assisted reading', () => {
  const signal = new AbortController().signal
  const row = (label: string, hours: string, rate: string, amount: string) => ({ label, hours, rate, amount })
  const table = [
    row('Ordinary Hours', '8.0000', '45.2800', '362.24'),
    row('Afternoon Hours', '38.5000', '49.8080', '1917.61'),
    row('Saturday Hours', '7.5000', '63.3920', '475.44'),
    row('Sunday Hours', '15.5000', '81.5040', '1263.31'),
  ]
  const facts = { ...complete, gross: '4018.60' }
  const read = async (lines: unknown, over: Record<string, string> = {}) => {
    vi.stubGlobal('fetch', ok({ available: true, fields: { ...facts, ...over }, lines }))
    return readWithAssistance('some payslip text', signal)
  }

  it('keeps a table whose rows add up to the gross beside them', async () => {
    const { lines } = await read(table)
    expect(lines.map(l => l.label)).toEqual(['Ordinary Hours', 'Afternoon Hours', 'Saturday Hours', 'Sunday Hours'])
    expect(lines[1].rate).toBe('49.8080')
  })

  it('throws the table away when a row is missing', async () => {
    // Without this, the missing $1,917.61 would read as pay that was never
    // itemised rather than a row nobody read.
    expect((await read(table.filter(l => l.label !== 'Afternoon Hours'))).lines).toEqual([])
  })

  it('throws it away when a row was invented', async () => {
    expect((await read([...table, row('Public Holiday', '4.0000', '90.5600', '362.24')])).lines).toEqual([])
  })

  it('allows a cent a row, and no more', async () => {
    const cent = table.map(l => l.label === 'Sunday Hours' ? { ...l, amount: '1263.32' } : l)
    expect((await read(cent)).lines).toHaveLength(4)
    const tooFar = table.map(l => l.label === 'Sunday Hours' ? { ...l, amount: '1263.36' } : l)
    expect((await read(tooFar)).lines).toEqual([])
  })

  it('keeps a row with an amount and no hours, when the total still holds', async () => {
    const bonus = [...table, row('Bonus', '', '', '500.00')]
    const { lines } = await read(bonus, { gross: '4518.60' })
    expect(lines).toHaveLength(5)
    expect(lines[4]).toMatchObject({ label: 'Bonus', hours: '', rate: '' })
  })

  it('shows no table rather than an unchecked one when gross is not readable', async () => {
    expect((await read(table, { gross: '' })).lines).toEqual([])
  })

  it.each([
    ['a row with no label', [{ label: '', hours: '', rate: '', amount: '362.24' }]],
    ['a row with no amount', [{ label: 'Ordinary Hours', hours: '8.0000', rate: '45.2800', amount: '' }]],
    ['an amount carrying a symbol', [{ label: 'Ordinary Hours', hours: '', rate: '', amount: '$362.24' }]],
    ['something that is not a list', 'Ordinary Hours'],
    ['entries that are not objects', [null, 7, 'Ordinary']],
    ['nothing at all', undefined],
  ])('drops %s', async (_why, lines) => expect((await read(lines)).lines).toEqual([]))

  it('blanks a rate that is not plain without losing the row', async () => {
    const odd = table.map(l => l.label === 'Ordinary Hours' ? { ...l, rate: '$45.28' } : l)
    const { lines } = await read(odd)
    expect(lines).toHaveLength(4)
    expect(lines[0].rate).toBe('')
    expect(lines[0].amount).toBe('362.24')
  })
})

