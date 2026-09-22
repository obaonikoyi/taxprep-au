import { beforeAll, describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import advicesV3 from '../../../../../sample-data/payslips/advice-v3-examples.json'
import advicesV2 from '../../../../../sample-data/payslips/advice-examples.json'
import { blankFacts, confirmationIssues, validateFacts, type PayFacts, type Payslip } from './payslip'
import { parsePayslip, textRows } from './payslipReader'
import { payslipReport } from './payslipReport'
import { addRate, blankRate, hourlyCents, rateChecks, recordFor, validateRate, type Finding, type RateRecord } from './payRate'

async function read(example: { name: string; pdfBase64: string }, index: number): Promise<Payslip> {
  const task = getDocument({ data: new Uint8Array(Buffer.from(example.pdfBase64, 'base64')), useSystemFonts: true })
  try {
    const pdf = await task.promise, page = await pdf.getPage(1), content = await page.getTextContent()
    const rows = textRows(content.items.flatMap(i => 'str' in i && i.str.trim()
      ? [{ text: i.str, x: i.transform[4], y: i.transform[5], width: i.width }] : []))
    return parsePayslip(rows.map(r => r.text), String(index), example.name, true, rows)
  } finally { await task.destroy() }
}

let v3: Payslip[], v2: Payslip[]
beforeAll(async () => {
  v3 = await Promise.all(advicesV3.map(read))
  v2 = await Promise.all(advicesV2.map(read))
})

describe('PAY ADVICE v3 earnings block', () => {
  it('reads ordinary hours, rate and pay from the itemised block', () => {
    expect(v3).toHaveLength(3)
    for (const slip of v3) expect(slip.format).toBe('pay-advice-v3')
    expect(v3[0].facts).toMatchObject({ hours: '38.00', rate: '28.90', ordinary: '1,098.20', gross: '1,098.20' })
    expect(v3[1].facts).toMatchObject({ hours: '38.00', rate: '27.50', ordinary: '1,045.00', gross: '1,045.00' })
    expect(v3[2].facts).toMatchObject({ hours: '38.00', rate: '28.90', ordinary: '1,080.00', gross: '1,253.40' })
    for (const slip of v3) expect(validateFacts(slip.facts)).toEqual([])
  })

  it('reads only the ordinary line, never the overtime beside it', () => {
    // The third advice pays 4.00 overtime hours at 43.35 for 173.40. An
    // overtime multiplier depends on an award, so none of it may be read.
    const facts = v3[2].facts
    expect(facts.hours).not.toBe('4.00')
    expect(facts.rate).not.toBe('43.35')
    expect(facts.ordinary).not.toBe('173.40')
    expect(v3[2].text).toContain('43.35')
  })

  it('never takes a year-to-date figure into hours, rate or pay', () => {
    for (const slip of v3) {
      expect(slip.text).toContain('48,912.00')
      for (const value of Object.values(slip.facts)) expect(['32,946.00', '33,991.00', '34,120.00', '4,120.00', '48,912.00']).not.toContain(value)
    }
  })

  it('leaves a v2 advice exactly as it was, with no earnings block to read', () => {
    for (const slip of v2) {
      expect(slip.format).toBe('pay-advice-v2')
      expect(slip.facts).toMatchObject({ hours: '', rate: '', ordinary: '' })
    }
    expect(v2[0].facts).toMatchObject({ gross: '1,640.00', withheld: '212.00', net: '1,393.00' })
  })
})

/* ------------------------------------------------------------------------ */

const facts = (over: Partial<PayFacts>): PayFacts => ({
  ...blankFacts(),
  employer: 'Riverbend Example Cafe', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16',
  gross: '1098.20', withheld: '152.00', deductions: '20.00', net: '926.20', ...over,
})
let seq = 0
const slip = (over: Partial<PayFacts>, confirmed = true): Payslip => {
  const f = facts(over), id = `slip-${++seq}`
  return { id, name: `${id}.pdf`, hash: id, text: '', facts: f, original: { ...f }, confirmed, sample: false }
}
const rate = (over: Partial<RateRecord>): RateRecord => ({ ...blankRate(), id: `rate-${++seq}`, employer: 'Riverbend Example Cafe', amount: '28.90', from: '2026-07-01', ...over })
const check = (slips: Payslip[], records: RateRecord[] = []) => rateChecks(slips, records, s => confirmationIssues(s, slips))
const kinds = (findings: Finding[]) => findings.map(f => f.kind)

describe('a recorded pay rate', () => {
  it('reads an hourly rate straight through and converts a salary over 52 weeks', () => {
    expect(hourlyCents(rate({ basis: 'hourly', amount: '28.90' }))).toBe(2890)
    // 76,000 / 52 / 38 = 38.4615…, taken to the cent once.
    expect(hourlyCents(rate({ basis: 'annual', amount: '76000', weeklyHours: '38' }))).toBe(3846)
    expect(hourlyCents(rate({ basis: 'annual', amount: '76000', weeklyHours: '' }))).toBeNull()
  })

  it('refuses two records covering one day, so a period always has one rate', () => {
    const first = rate({ from: '2026-07-01', to: '2026-12-31' })
    expect(validateRate(rate({ from: '2027-01-01' }), [first])).toEqual([])
    expect(validateRate(rate({ from: '2026-12-31' }), [first]).join(' ')).toContain('already covers these dates')
  })

  it('asks for the hours a salary covers, and for a start date', () => {
    expect(validateRate(rate({ basis: 'annual', amount: '76000' }), []).join(' ')).toContain('ordinary hours a week')
    expect(validateRate(rate({ from: '' }), []).join(' ')).toContain('date this rate started')
    expect(validateRate(rate({ from: '2026-07-01', to: '2026-06-01' }), []).join(' ')).toContain('on or after the start date')
  })

  it('picks the record covering the period, and none when the dates fall outside it', () => {
    const records = addRate(addRate([], rate({ amount: '27.00', from: '2026-07-01', to: '2026-12-31' })), rate({ amount: '28.90', from: '2027-01-01' }))
    expect(recordFor(records, 'Riverbend Example Cafe', '2026-09-01')?.amount).toBe('27.00')
    expect(recordFor(records, 'Riverbend Example Cafe', '2027-02-01')?.amount).toBe('28.90')
    expect(recordFor(records, 'Riverbend Example Cafe', '2026-01-01')).toBeNull()
    expect(recordFor(records, 'Another Employer', '2026-09-01')).toBeNull()
  })
})

describe('checking a payslip against itself', () => {
  it('raises the difference when hours times rate is not the pay for those hours', () => {
    const { findings } = check([slip({ hours: '38.00', rate: '28.90', ordinary: '1080.00', gross: '1253.40', withheld: '196.00', deductions: '25.00', net: '1032.40' })])
    expect(kinds(findings)).toEqual(['payslip-self'])
    expect(findings[0].thePayslip).toBe('38.00 hours at $28.90 is $1,098.20, but the pay for those hours reads $1,080.00.')
    expect(findings[0].difference).toContain('$18.20 less than')
    expect(findings[0].yourRecord).toBeNull()
  })

  it('needs no rate record at all', () => {
    const { findings, states } = check([slip({ hours: '38.00', rate: '28.90', ordinary: '1080.00', gross: '1253.40', withheld: '196.00', deductions: '25.00', net: '1032.40' })], [])
    expect(findings).toHaveLength(1)
    expect(states[0].checked).toBe(true)
    expect(states[0].detail).toContain('hours and rate on this payslip against each other')
  })

  it('treats two cents as rounding and three cents as a question', () => {
    const at = (ordinary: string) => check([slip({ hours: '38.00', rate: '28.90', ordinary, gross: '1200.00', withheld: '152.00', deductions: '20.00', net: '1028.00' })]).findings
    expect(at('1098.22')).toHaveLength(0)
    expect(at('1098.18')).toHaveLength(0)
    expect(at('1098.23')).toHaveLength(1)
    expect(at('1098.17')).toHaveLength(1)
  })
})

describe('checking a payslip against the rate you recorded', () => {
  it('states your record, the payslip and the difference over the period', () => {
    const { findings } = check([slip({ hours: '38.00', rate: '27.50', ordinary: '1045.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' })], [rate({ note: 'clause 4.1' })])
    expect(kinds(findings)).toEqual(['rate-differs'])
    const [f] = findings
    expect(f.yourRecord).toBe('$28.90 an hour, from your contract (clause 4.1), effective 2026-07-01.')
    expect(f.thePayslip).toBe('$27.50 an hour. Over 38.00 hours that is $1,098.20 rather than $1,045.00.')
    expect(f.difference).toBe('$1.40 an hour below what you recorded, or $53.20 over this period.')
    expect(f.limit).toContain('does not know your award')
  })

  it('names a verbal record as a verbal record wherever it is cited', () => {
    const { findings } = check([slip({ hours: '38.00', rate: '27.50', ordinary: '1045.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' })], [rate({ source: 'verbal' })])
    expect(findings[0].yourRecord).toContain('a verbal agreement you recorded yourself')
  })

  it('compares the amount instead when the payslip states no rate', () => {
    const { findings } = check([slip({ hours: '38.00', ordinary: '1045.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' })], [rate({})])
    expect(kinds(findings)).toEqual(['amount-differs'])
    expect(findings[0].difference).toBe('$53.20 less than your recorded rate comes to over these hours.')
  })

  it('does not raise the same sum twice when the payslip states a matching rate', () => {
    // The self-check already tests hours x rate; repeating it against an
    // identical recorded rate would be two questions about one arithmetic.
    const { findings } = check([slip({ hours: '38.00', rate: '28.90', ordinary: '1080.00', gross: '1253.40', withheld: '196.00', deductions: '25.00', net: '1032.40' })], [rate({})])
    expect(kinds(findings)).toEqual(['payslip-self'])
  })

  it('uses the rate that applied to the period, not the latest one', () => {
    const records = addRate(addRate([], rate({ amount: '27.50', from: '2026-07-01', to: '2026-07-31' })), rate({ amount: '28.90', from: '2026-08-01' }))
    const { findings } = check([slip({ hours: '38.00', rate: '27.50', ordinary: '1045.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' })], records)
    expect(findings).toHaveLength(0)
  })

  it('converts a salary before comparing it', () => {
    const { findings } = check([slip({ hours: '38.00', rate: '30.00', ordinary: '1140.00', gross: '1140.00', withheld: '213.80', deductions: '0', net: '926.20' })], [rate({ basis: 'annual', amount: '76000', weeklyHours: '38' })])
    expect(kinds(findings)).toEqual(['rate-differs'])
    expect(findings[0].yourRecord).toContain('$38.46 an hour over 38.00 hours a week')
  })
})

describe('a rate that changed with nothing recorded', () => {
  const august = { periodStart: '2026-08-12', periodEnd: '2026-08-25', payDate: '2026-08-27' }
  const pair = () => [
    slip({ hours: '38.00', rate: '28.90', ordinary: '1098.20' }),
    slip({ ...august, hours: '38.00', rate: '27.50', ordinary: '1045.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' }),
  ]

  it('raises the change and shows both periods', () => {
    const { findings } = check(pair())
    expect(kinds(findings)).toEqual(['rate-changed'])
    expect(findings[0].thePayslip).toBe('$28.90 an hour on the period ending 2026-07-14, and $27.50 an hour on the period ending 2026-08-25.')
    expect(findings[0].difference).toBe('$1.40 an hour lower than the previous period.')
  })

  it('stops raising it once the user records the change', () => {
    const records = addRate(addRate([], rate({ amount: '28.90', from: '2026-07-01', to: '2026-08-11' })), rate({ amount: '27.50', from: '2026-08-12' }))
    expect(kinds(check(pair(), records).findings)).toEqual([])
  })

  it('ignores a change smaller than the rounding band', () => {
    const rows = [slip({ hours: '38.00', rate: '28.90', ordinary: '1098.20' }), slip({ ...august, hours: '38.00', rate: '28.92', ordinary: '1098.96', gross: '1098.96', withheld: '152.76', deductions: '20.00', net: '926.20' })]
    expect(kinds(check(rows).findings)).toEqual([])
  })
})

describe('what was not checked, and why', () => {
  it('gives every payslip a checked state with a reason', () => {
    const rows = [
      slip({ hours: '38.00', rate: '28.90', ordinary: '1098.20' }),
      slip({ employer: 'Tallow Example Logistics' }),
      slip({ hours: '38.00', rate: '28.90', ordinary: '1098.20' }, false),
    ]
    const { states } = check(rows, [rate({})])
    expect(states).toHaveLength(3)
    for (const state of states) expect(state.detail.length).toBeGreaterThan(20)
  })

  it('says a payslip must be checked before it is compared', () => {
    const { states } = check([slip({ hours: '38.00', rate: '28.90', ordinary: '1098.20' }, false)], [rate({})])
    expect(states[0]).toMatchObject({ checked: false })
    expect(states[0].detail).toContain('Check this payslip’s figures first')
  })

  it('asks for a rate when the payslip shows figures but nothing is recorded', () => {
    const { states } = check([slip({ hours: '38.00' })], [])
    expect(states[0].checked).toBe(false)
    expect(states[0].detail).toBe('Add the rate you agreed with Riverbend Example Cafe to check this payslip against it.')
  })

  it('says so when a record exists but its dates do not reach the period', () => {
    const { states } = check([slip({ hours: '38.00', rate: '28.90', ordinary: '1098.20', periodStart: '2026-06-01', periodEnd: '2026-06-14', payDate: '2026-06-16' })], [rate({ from: '2026-07-01' })])
    // The self-check still ran, so this payslip is checked — but only partly.
    expect(states[0].checked).toBe(true)
    expect(states[0].detail).not.toContain('$28.90')
  })

  it('names the missing figures when the payslip states none of them', () => {
    const { states } = check([slip({})], [rate({})])
    expect(states[0].checked).toBe(false)
    expect(states[0].detail).toContain('does not show ordinary hours, an hourly rate or the pay for those hours')
  })

  it('points at the rate records when a period falls outside every one of them', () => {
    const { states } = check([slip({ periodStart: '2026-06-01', periodEnd: '2026-06-14', payDate: '2026-06-16', hours: '38.00' })], [rate({ from: '2026-07-01' })])
    expect(states[0].detail).toBe('Your Riverbend Example Cafe rate records do not cover 2026-06-01. Add the rate that applied then to check this payslip.')
  })
})

describe('the downloaded report', () => {
  const tallow = { employer: 'Tallow Example Logistics' }
  const rows = () => [
    slip({ hours: '38.00', rate: '27.50', ordinary: '1045.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' }),
    slip({ ...tallow, hours: '38.00', rate: '28.90', ordinary: '1098.20' }),
  ]

  it('states the questions, the rates behind them and what was not checked', () => {
    const all = rows(), html = payslipReport(all, all, 'All financial years · All employers', [rate({ note: 'clause 4.1' })], all)
    expect(html).toContain('Pay rate checks')
    expect(html).toContain('clause 4.1')
    expect(html).toContain('$53.20 over this period')
    expect(html).toContain('What was checked, and what was not')
    // Tallow has no recorded rate, so only its own arithmetic was compared —
    // and the report says exactly that rather than leaving it off the list.
    expect(html).toContain('<th>Tallow Example Logistics · 2026-07-01 to 2026-07-14</th><td>Checked the hours and rate on this payslip against each other.</td>')
  })

  it('never names an employer the report is filtered away from', () => {
    // A report scoped to one employer is a document someone sends on. The
    // on-screen panel covers the whole session; this must not.
    const all = rows(), scoped = all.filter(s => s.facts.employer.startsWith('Tallow'))
    const html = payslipReport(scoped, all, '2026–27 · Tallow Example Logistics', [rate({}), rate({ ...tallow, amount: '28.90' })], scoped)
    expect(html).toContain('Tallow Example Logistics')
    expect(html).not.toContain('Riverbend')
  })
})

describe('the safety property', () => {
  // A wrong claim about an employer is worse than no claim. These words are
  // conclusions Xoba Paycheck is in no position to reach: it knows the user's own
  // record and the payslip's arithmetic, and nothing about entitlement.
  const banned = /\b(underpaid|underpayment|unlawful|illegal|owed|owes|stolen|wage theft|correct|incorrect|fraud)\b/i

  it('never characterises the employer or the user’s situation', () => {
    const records = addRate(addRate([], rate({ amount: '28.90', from: '2026-07-01', to: '2026-07-31' })), rate({ amount: '30.00', from: '2026-08-01', source: 'verbal' }))
    const tallow = { employer: 'Tallow Example Logistics' }
    const rows = [
      // Its own arithmetic is out AND its rate is under the record: two questions.
      slip({ hours: '38.00', rate: '27.50', ordinary: '1000.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' }),
      // No rate stated, so the amount is compared instead.
      slip({ periodStart: '2026-08-12', periodEnd: '2026-08-25', payDate: '2026-08-27', hours: '38.00', ordinary: '1045.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' }),
      // Under the later, verbally recorded rate.
      slip({ periodStart: '2026-09-01', periodEnd: '2026-09-14', payDate: '2026-09-16', hours: '38.00', rate: '26.00', ordinary: '988.00', gross: '988.00', withheld: '61.80', deductions: '0', net: '926.20' }),
      // A second employer whose rate moves with nothing recorded.
      slip({ ...tallow, hours: '38.00', rate: '40.00', ordinary: '1520.00', gross: '1520.00', withheld: '300.00', deductions: '20.00', net: '1200.00' }),
      slip({ ...tallow, periodStart: '2026-07-15', periodEnd: '2026-07-28', payDate: '2026-07-30', hours: '38.00', rate: '38.00', ordinary: '1444.00', gross: '1444.00', withheld: '244.00', deductions: '0', net: '1200.00' }),
      // And one nobody has checked yet.
      slip({ periodStart: '2026-10-01', periodEnd: '2026-10-14', payDate: '2026-10-16', hours: '38.00', rate: '28.90', ordinary: '1098.20' }, false),
    ]
    const { findings, states } = check(rows, records)
    expect(kinds(findings).sort()).toEqual(['amount-differs', 'payslip-self', 'rate-changed', 'rate-differs', 'rate-differs'])
    const strings = [
      ...findings.flatMap(f => [f.heading, f.thePayslip, f.difference, f.limit, f.question, f.message, f.yourRecord ?? '']),
      ...states.map(s => s.detail),
    ]
    for (const text of strings) expect(text).not.toMatch(banned)
  })

  it('gives every finding all three parts and a stated limit', () => {
    const records = [rate({})]
    const rows = [slip({ hours: '38.00', rate: '27.50', ordinary: '1000.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' })]
    for (const finding of check(rows, records).findings) {
      expect(finding.thePayslip.length).toBeGreaterThan(10)
      expect(finding.difference.length).toBeGreaterThan(10)
      expect(finding.limit.length).toBeGreaterThan(30)
      expect(finding.question).toContain('payroll contact')
    }
  })
})

/* ------------------------------------------------------------------------ */

/*
 * The message someone sends.
 *
 * A dashboard is not the outcome — an email to payroll is. These check the
 * thing that leaves the app: that it carries the figures, that it is written
 * from the user rather than to them, and that it asks rather than accuses.
 */
describe('the message to payroll', () => {
  const twoEmployers = { employer: 'Tallow Example Logistics' }
  const everyKind = () => {
    const records = addRate(addRate([], rate({ amount: '28.90', from: '2026-07-01', to: '2026-07-31' })), rate({ amount: '30.00', from: '2026-08-01', source: 'verbal' }))
    return check([
      slip({ hours: '38.00', rate: '27.50', ordinary: '1000.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' }),
      slip({ periodStart: '2026-08-12', periodEnd: '2026-08-25', payDate: '2026-08-27', hours: '38.00', ordinary: '1045.00', gross: '1045.00', withheld: '118.80', deductions: '0', net: '926.20' }),
      slip({ ...twoEmployers, hours: '38.00', rate: '40.00', ordinary: '1520.00', gross: '1520.00', withheld: '300.00', deductions: '20.00', net: '1200.00' }),
      slip({ ...twoEmployers, periodStart: '2026-07-15', periodEnd: '2026-07-28', payDate: '2026-07-30', hours: '38.00', rate: '38.00', ordinary: '1444.00', gross: '1444.00', withheld: '244.00', deductions: '0', net: '1200.00' }),
    ], records).findings
  }

  it('is sendable as it stands: a greeting, the figures and one question', () => {
    for (const finding of everyKind()) {
      expect(finding.message.startsWith('Hi,')).toBe(true)
      expect(finding.message.endsWith('Thanks.')).toBe(true)
      expect(finding.message).toContain('?')
      expect(finding.message.length).toBeGreaterThan(80)
    }
  })

  // The panel's other text addresses the user — "the rate you recorded". In a
  // message to payroll "you" is the payroll officer, so that wording would
  // reverse who recorded what. This is the reason the message is written
  // separately rather than assembled from the fields above it.
  it('never tells the reader what they themselves recorded', () => {
    for (const finding of everyKind()) {
      expect(finding.message).not.toMatch(/\byou recorded\b/i)
      expect(finding.message).not.toMatch(/\byour record\b/i)
      expect(finding.message).not.toMatch(/\byour (contract|payslip|rate)\b/i)
    }
  })

  it('asks rather than demands: no claim of entitlement and no request for money', () => {
    for (const finding of everyKind()) {
      expect(finding.message).not.toMatch(/\b(entitled|entitlement|pay me|back ?pay|immediately|must|should have)\b/i)
      expect(finding.message).toMatch(/could you/i)
    }
  })

  it('carries the figures a payroll officer needs to look it up', () => {
    const findings = everyKind()
    const differs = findings.find(f => f.kind === 'rate-differs')!
    // The period, both rates, and what the gap comes to over the hours worked.
    expect(differs.message).toContain('2026-07-01 to 2026-07-14')
    expect(differs.message).toContain('$27.50')
    expect(differs.message).toContain('$28.90')
    expect(differs.message).toContain('38.00 hours')
    expect(differs.message).toContain('$53.20')

    const self = findings.find(f => f.kind === 'payslip-self')!
    expect(self.message).toContain('$1,045.00')
    expect(self.message).toContain('$1,000.00')

    const amount = findings.find(f => f.kind === 'amount-differs')!
    expect(amount.message).toContain('2026-08-12 to 2026-08-25')
    expect(amount.message).toContain('does not show an hourly rate')

    const changed = findings.find(f => f.kind === 'rate-changed')!
    expect(changed.message).toContain('$40.00')
    expect(changed.message).toContain('$38.00')
    expect(changed.message).toContain('2026-07-28')
  })
})
