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
    await expect(readWithAssistance('some payslip text', signal)).resolves.toMatchObject({ gross: '1906.50', hours: '62.00' })
  })

  // The reader is off on any deployment without a key, which is most of them.
  // That is an ordinary answer and the person is sent to manual entry.
  it('passes the server’s own message through when it refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false, message: 'The assisted reader is not configured on this deployment. Enter the figures from your payslip instead.' }), { status: 503 })))
    await expect(readWithAssistance('some payslip text', signal)).rejects.toThrow(/not configured on this deployment/)
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
