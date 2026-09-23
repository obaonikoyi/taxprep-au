import { afterEach, describe, expect, it, vi } from 'vitest'
import { contractReading, ContractReadError, readContract } from './contractReader'

/*
 * What the app will believe about a contract.
 *
 * A wrong rate here is worse than a wrong figure on a payslip: it becomes the
 * baseline every payslip is compared against, so it produces a run of
 * confident, specific, wrong findings the person may send their employer.
 */
const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
const complete = {
  employer: 'Kestrel Example Hospitality', basis: 'hourly', amount: '32.50', weeklyHours: '',
  from: '2026-07-01', quote: 'The ordinary hourly rate is $32.50 per hour, effective 1 July 2026.', why: '',
}
const contract = 'a contract '.repeat(40)
afterEach(() => { vi.unstubAllGlobals() })

describe('what the app will believe about a contract', () => {
  it('keeps a plain hourly rate and the sentence it came from', () => {
    const reading = contractReading(complete)
    expect(reading.amount).toBe('32.50')
    expect(reading.basis).toBe('hourly')
    expect(reading.quote).toContain('$32.50 per hour')
  })

  it('keeps only the two bases this app understands', () => {
    for (const basis of ['weekly', 'daily', 'HOURLY', 'per hour', '', 'fortnightly'])
      expect(contractReading({ ...complete, basis }).amount).toBe('')
    expect(contractReading({ ...complete, basis: 'annual', amount: '76000' }).basis).toBe('annual')
  })

  it('treats a rate with no basis, or a basis with no rate, as nothing', () => {
    expect(contractReading({ ...complete, amount: '' }).basis).toBe('')
    expect(contractReading({ ...complete, basis: '' }).amount).toBe('')
  })

  it('drops the sentence when it drops the rate, so nothing is shown that nothing supports', () => {
    expect(contractReading({ ...complete, basis: 'weekly' }).quote).toBe('')
  })

  it('blanks anything that is not a string', () => {
    const reading = contractReading({ employer: { name: 'Kestrel' }, amount: 3250, basis: ['hourly'], quote: null, why: 7 })
    expect(reading).toEqual({ employer: '', basis: '', amount: '', weeklyHours: '', from: '', quote: '', why: '' })
  })

  it('answers blanks for anything that is not an object at all', () => {
    for (const value of [null, undefined, 'a string', 42, [1, 2]]) expect(contractReading(value).amount).toBe('')
  })

  it('keeps a refusal’s reason, because that is what the person reads', () => {
    const reading = contractReading({ ...complete, amount: '', basis: '', why: 'The rate depends on a classification this document does not state.' })
    expect(reading.why).toContain('classification')
  })
})

describe('asking the server to read a contract', () => {
  const signal = new AbortController().signal

  it('sends only the text, to this app’s own server', async () => {
    const fetcher = ok({ available: true, fields: complete })
    vi.stubGlobal('fetch', fetcher)
    await readContract(contract, signal)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/contract/read')
    expect(url.startsWith('/')).toBe(true)
    expect(JSON.parse(String(init.body))).toEqual({ text: contract })
  })

  it('refuses to send something too short to be a contract', async () => {
    const fetcher = ok({ available: true, fields: complete })
    vi.stubGlobal('fetch', fetcher)
    await expect(readContract('The rate is $32.50.', signal)).rejects.toBeInstanceOf(ContractReadError)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('refuses to send something too long, rather than cutting the rate clause off', async () => {
    const fetcher = ok({ available: true, fields: complete })
    vi.stubGlobal('fetch', fetcher)
    await expect(readContract('x'.repeat(60_001), signal)).rejects.toThrow(/too long/)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns a refusal as an answer rather than an error', async () => {
    // A contract this app will not read a rate from is an ordinary outcome, and
    // the reason has to reach the person.
    vi.stubGlobal('fetch', ok({ available: true, fields: { ...complete, amount: '', basis: '', why: 'The rate depends on a classification this document does not state.' } }))
    const reading = await readContract(contract, signal)
    expect(reading.amount).toBe('')
    expect(reading.why).toContain('classification')
  })

  it('passes the server’s own message through when it refuses to answer', async () => {
    vi.stubGlobal('fetch', ok({ available: false, message: 'Reading a contract is not configured on this deployment. Enter the rate from your contract instead.' }, 503))
    await expect(readContract(contract, signal)).rejects.toThrow(/not configured on this deployment/)
  })

  it('passes a limit message through', async () => {
    vi.stubGlobal('fetch', ok({ available: false, message: 'The assisted reader has reached its limit for now. It is available again in about 20 minutes. Enter the figures from your payslip instead — that always works.' }, 429))
    await expect(readContract(contract, signal)).rejects.toThrow(/available again in about 20 minutes/)
  })

  it('survives an error page where JSON was expected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    await expect(readContract(contract, signal)).rejects.toThrow(/Enter the rate from your contract/)
  })

  it('says the reader is unreachable rather than failing silently', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    await expect(readContract(contract, signal)).rejects.toThrow(/Could not reach the contract reader/)
  })

  it('reports a cancellation as a cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError') }))
    await expect(readContract(contract, controller.signal)).rejects.toThrow(/cancelled/i)
  })
})
