import { describe, expect, it } from 'vitest'
import { blankFacts } from './payslip'
import { checkEarnings, lineAmount, lineHours, multiplierText, rateValue, rateText, type EarningsLine } from './payslipEarnings'

/*
 * A fortnight of shift work: a base rate with cents in it, and three loadings
 * that are exact multiples of it. Fictional, and deliberately shaped like the
 * real payslip that prompted this — four lines, most of the money in the
 * penalty rows, rates printed to four places and two amounts that only come
 * out right if those places are kept.
 */
const BASE = '28.7600'
const TABLE: EarningsLine[] = [
  { label: 'Ordinary Hours', hours: '7.5000', rate: BASE, amount: '215.70' },
  { label: 'Afternoon Hours', hours: '36.2500', rate: '31.6360', amount: '1,146.81' },
  { label: 'Saturday Hours', hours: '8.0000', rate: '40.2640', amount: '322.11' },
  { label: 'Sunday Hours', hours: '14.0000', rate: '51.7680', amount: '724.75' },
]
const facts = (gross: string) => ({ ...blankFacts(), gross })

describe('the whole earnings table', () => {
  it('checks every line against its own hours and rate', () => {
    const result = checkEarnings(TABLE, facts('2409.37'))
    expect(result.lines.map(l => l.multipliesOut)).toEqual([true, true, true, true])
    expect(result.disagreeing).toEqual([])
    expect(result.itemised).toBe(240937)
    expect(result.unitemised).toBe(0)
  })

  it('reports each loading as a multiple of the ordinary rate, without calling it right', () => {
    const result = checkEarnings(TABLE, facts('2409.37'))
    expect(result.ordinaryRate).toBe(287600)
    expect(result.lines.map(l => l.multiplier && multiplierText(l.multiplier)))
      .toEqual(['1', '1.1', '1.4', '1.8'])
  })

  /*
   * The reason rates are held to four places. Round this table's rates to
   * cents — which is all the app could read before — and two of its four lines
   * stop agreeing with amounts that are perfectly correct. A check that fires
   * on a consistent payslip is worse than no check.
   */
  it('would raise false questions if rates were rounded to cents', () => {
    const rounded = TABLE.map(l => ({ ...l, rate: (rateValue(l.rate)! / 10_000).toFixed(2) }))
    const result = checkEarnings(rounded, facts('2409.37'))
    // Three of the four penalty lines, on a payslip with nothing wrong with it.
    expect(result.disagreeing.map(l => l.label)).toEqual(['Afternoon Hours', 'Saturday Hours', 'Sunday Hours'])
  })

  it('names a line whose amount does not follow from its hours and rate', () => {
    const wrong = TABLE.map(l => l.label === 'Saturday Hours' ? { ...l, amount: '422.11' } : l)
    const result = checkEarnings(wrong, facts('2509.37'))
    expect(result.disagreeing.map(l => l.label)).toEqual(['Saturday Hours'])
    expect(result.disagreeing[0].expected).toBe(32211)
    expect(result.disagreeing[0].amount).toBe(42211)
  })

  it('allows a cent of rounding either way, and no more', () => {
    const cent = TABLE.map(l => l.label === 'Sunday Hours' ? { ...l, amount: '724.76' } : l)
    expect(checkEarnings(cent, facts('2409.38')).disagreeing).toEqual([])
    const two = TABLE.map(l => l.label === 'Sunday Hours' ? { ...l, amount: '724.77' } : l)
    expect(checkEarnings(two, facts('2409.39')).disagreeing.map(l => l.label)).toEqual(['Sunday Hours'])
  })

  it('says what the table does not account for rather than refusing', () => {
    // An allowance paid outside the hours table is ordinary, not an error.
    const result = checkEarnings(TABLE, facts('2509.37'))
    expect(result.itemised).toBe(240937)
    expect(result.unitemised).toBe(10000)
    expect(result.disagreeing).toEqual([])
  })

  /*
   * The number this milestone exists for. Checking a recorded rate against the
   * ordinary line alone, on this payslip, is checking nine percent of the pay
   * — and the screen has to be able to say so.
   */
  it('works out how little of the pay the ordinary line is', () => {
    expect(checkEarnings(TABLE, facts('2409.37')).ordinaryShare).toBe(9)
    const salaried: EarningsLine[] = [{ label: 'Ordinary Hours', hours: '76.0000', rate: '30.0000', amount: '2280.00' }]
    expect(checkEarnings(salaried, facts('2280.00')).ordinaryShare).toBe(100)
  })

  it('treats a line with no rate as unchecked, not as wrong', () => {
    const bonus = [...TABLE, { label: 'Bonus', hours: '', rate: '', amount: '500.00' }]
    const result = checkEarnings(bonus, facts('2909.37'))
    expect(result.lines[4].multipliesOut).toBeNull()
    expect(result.lines[4].multiplier).toBeNull()
    expect(result.disagreeing).toEqual([])
    expect(result.itemised).toBe(290937)
  })

  it('falls back to the recorded ordinary rate when the table has no ordinary line', () => {
    const noOrdinary = TABLE.filter(l => l.label !== 'Ordinary Hours')
    const result = checkEarnings(noOrdinary, { ...blankFacts(), gross: '2193.67', rate: BASE })
    expect(result.ordinaryRate).toBe(287600)
    expect(result.lines.map(l => l.multiplier && multiplierText(l.multiplier))).toEqual(['1.1', '1.4', '1.8'])
    expect(result.ordinaryShare).toBeNull()
  })
})

describe('rates to four places', () => {
  it.each([
    ['45.2800', 452800], ['49.8080', 498080], ['$63.3920', 633920], ['81.5040', 815040],
    ['30', 300000], ['30.5', 305000], ['1,234.5678', 12345678],
  ])('reads %s', (input, expected) => expect(rateValue(input)).toBe(expected))

  it.each(['', '30.12345', '12,34', '-1', '1e3', 'abc', '30.'])('rejects %s', input => expect(rateValue(input)).toBeNull())

  it('prints a rate back the way a payslip would', () => {
    expect(rateText(452800)).toBe('45.28')
    expect(rateText(498080)).toBe('49.8080')
    expect(rateText(300000)).toBe('30.00')
  })

  it('multiplies hours by rate in whole cents without floats', () => {
    expect(lineAmount(lineHours('38.5000')!, rateValue('49.8080')!)).toBe(191761)
    expect(lineAmount(lineHours('8.0000')!, rateValue('45.2800')!)).toBe(36224)
    expect(lineAmount(lineHours('15.5000')!, rateValue('81.5040')!)).toBe(126331)
    expect(lineAmount(lineHours('0')!, rateValue('45.2800')!)).toBe(0)
  })

  it('shows an exact loading plainly and an inexact one honestly', () => {
    expect(multiplierText(10_000)).toBe('1')
    expect(multiplierText(15_000)).toBe('1.5')
    expect(multiplierText(12_500)).toBe('1.25')
    expect(multiplierText(14_997)).toBe('1.4997')
  })
})
