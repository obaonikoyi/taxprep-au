import { describe, expect, it } from 'vitest'
import { checkAgainstContract, kindOf, type ContractPenalty } from './contractPenalties'
import { rateValue, type EarningsLine } from './payslipEarnings'

const ORDINARY = rateValue('32.50')!   // 325000
const line = (label: string, rate: string): EarningsLine => ({ label, hours: '8.0000', rate, amount: '0.00' })
const term = (kind: string, multiplier: string, amount = '', quote = 'a sentence from the contract'): ContractPenalty =>
  ({ kind, multiplier, amount, quote })

describe('which kind of day a payslip line is for', () => {
  it.each([
    ['Saturday hours', 'saturday'], ['SAT PENALTY', 'saturday'],
    ['Sunday hours', 'sunday'], ['Sun loading', 'sunday'],
    ['Public holiday hours', 'publicHoliday'], ['Pub hol', 'publicHoliday'],
    ['Afternoon hours', 'evening'], ['Evening shift', 'evening'],
    ['Night hours', 'night'], ['Overtime', 'overtime'], ['O/T hours', 'overtime'],
  ])('reads %s as %s', (label, kind) => expect(kindOf(label)).toBe(kind))

  it.each(['Ordinary hours', 'Base pay', 'Bonus', 'Travel allowance', 'Annual leave', ''])(
    'makes no claim about %s', label => expect(kindOf(label)).toBeNull())

  /*
   * A label can carry two of these words. Overtime worked on a Saturday is
   * overtime, and a contract's Saturday rate is not the rate for it — reading
   * it as Saturday would compare a real line against the wrong term and
   * produce a difference that is not there.
   */
  it('reads a label carrying two words as the more specific one', () => {
    expect(kindOf('Saturday overtime')).toBe('overtime')
    expect(kindOf('Public holiday overtime')).toBe('overtime')
    expect(kindOf('Sunday public holiday')).toBe('publicHoliday')
  })
})

describe('a payslip line against a contract term', () => {
  it('agrees when the rate is the multiple the contract states', () => {
    // 32.50 x 1.5 = 48.75
    const result = checkAgainstContract([line('Saturday hours', '48.7500')], ORDINARY, [term('saturday', '1.5')])
    expect(result.differing).toEqual([])
    expect(result.compared).toHaveLength(1)
    expect(result.compared[0]).toMatchObject({ kind: 'saturday', paid: 487500, expected: 487500, agrees: true, basis: 'multiplier' })
  })

  it('raises the difference when it is not', () => {
    const result = checkAgainstContract([line('Saturday hours', '45.5000')], ORDINARY, [term('saturday', '1.5')])
    expect(result.differing).toHaveLength(1)
    expect(result.differing[0]).toMatchObject({ paid: 455000, expected: 487500, agrees: false, multiplier: '1.5' })
    expect(result.differing[0].quote).toBe('a sentence from the contract')
  })

  it('takes a flat rate the contract states instead of a multiple', () => {
    const result = checkAgainstContract([line('Sunday hours', '58.5000')], ORDINARY, [term('sunday', '', '58.50')])
    expect(result.compared[0]).toMatchObject({ basis: 'amount', expected: 585000, agrees: true })
    // A flat term needs no ordinary rate to be applied to.
    expect(checkAgainstContract([line('Sunday hours', '58.5000')], null, [term('sunday', '', '58.50')]).compared).toHaveLength(1)
  })

  /*
   * Half a cent, because a multiplier applied to a rate with four places can
   * land finer than either document prints. Being exact would raise questions
   * about pay that is right.
   */
  it('allows half a cent either way, and no more', () => {
    const near = checkAgainstContract([line('Saturday hours', '48.7549')], ORDINARY, [term('saturday', '1.5')])
    expect(near.differing).toEqual([])
    const past = checkAgainstContract([line('Saturday hours', '48.7551')], ORDINARY, [term('saturday', '1.5')])
    expect(past.differing).toHaveLength(1)
  })
})

describe('what it refuses to conclude', () => {
  it('reports a penalty line the contract says nothing about as not compared', () => {
    const result = checkAgainstContract(
      [line('Saturday hours', '48.7500'), line('Sunday hours', '65.0000')], ORDINARY, [term('saturday', '1.5')])
    expect(result.compared).toHaveLength(1)
    expect(result.uncompared).toEqual(['Sunday hours'])
    expect(result.differing).toEqual([])
  })

  it('reports a contract term this payslip has no line for as unseen, not as unpaid', () => {
    // A fortnight with no Sunday shift pays no Sunday penalty. That is not a
    // shortfall and must never be raised as one.
    const result = checkAgainstContract([line('Saturday hours', '48.7500')], ORDINARY, [term('saturday', '1.5'), term('sunday', '2')])
    expect(result.unseen).toEqual(['sunday'])
    expect(result.differing).toEqual([])
  })

  it('compares nothing when a multiplier has no ordinary rate to apply to', () => {
    const result = checkAgainstContract([line('Saturday hours', '48.7500')], null, [term('saturday', '1.5')])
    expect(result.compared).toEqual([])
    expect(result.uncompared).toEqual(['Saturday hours'])
  })

  it('compares nothing when the payslip line prints no rate', () => {
    const noRate: EarningsLine = { label: 'Saturday hours', hours: '', rate: '', amount: '300.00' }
    const result = checkAgainstContract([noRate], ORDINARY, [term('saturday', '1.5')])
    expect(result.compared).toEqual([])
    expect(result.uncompared).toEqual(['Saturday hours'])
  })

  it('never compares an ordinary line against a penalty term', () => {
    const result = checkAgainstContract([line('Ordinary hours', '32.5000')], ORDINARY, [term('saturday', '1.5')])
    expect(result.compared).toEqual([])
    expect(result.uncompared).toEqual([])
    expect(result.unseen).toEqual(['saturday'])
  })

  it('does nothing at all when the contract states no penalties', () => {
    const result = checkAgainstContract([line('Saturday hours', '10.0000')], ORDINARY, [])
    expect(result.compared).toEqual([])
    expect(result.differing).toEqual([])
    expect(result.uncompared).toEqual(['Saturday hours'])
    expect(result.unseen).toEqual([])
  })

  it('keeps the first term when a kind is stated twice', () => {
    const result = checkAgainstContract([line('Saturday hours', '48.7500')], ORDINARY,
      [term('saturday', '1.5'), term('saturday', '2')])
    expect(result.compared[0].multiplier).toBe('1.5')
  })
})
