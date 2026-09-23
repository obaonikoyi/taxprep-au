import { beforeAll, describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import advices from '../../../../../sample-data/payslips/advice-examples.json'
import { totals, validateFacts, type Payslip } from './payslip'
import { parsePayslip, textRows } from './payslipReader'
import { detectFormat, type TextRow } from './payslipFormats'

let slips: Payslip[]
beforeAll(async () => {
  slips = await Promise.all(advices.map(async (example, index) => {
    const task = getDocument({ data: new Uint8Array(Buffer.from(example.pdfBase64, 'base64')), useSystemFonts: true })
    try {
      const pdf = await task.promise, page = await pdf.getPage(1), content = await page.getTextContent()
      const rows = textRows(content.items.flatMap(i => 'str' in i && i.str.trim()
        ? [{ text: i.str, x: i.transform[4], y: i.transform[5], width: i.width }] : []))
      return parsePayslip(rows.map(r => r.text), String(index), example.name, true, rows)
    } finally { await task.destroy() }
  }))
})

/** A tabular row built by hand, so column behaviour can be tested precisely. */
function row(description: string, current: string | null, ytd: string | null): TextRow {
  const tokens = [{ text: description, x: 44, y: 100, width: 90 }]
  if (current !== null) tokens.push({ text: current, x: 380, y: 100, width: 50 })
  if (ytd !== null) tokens.push({ text: ytd, x: 495, y: 100, width: 50 })
  return { text: tokens.map(t => t.text).join(' '), tokens }
}
const header: TextRow = {
  text: 'Description This pay Year to date',
  tokens: [
    { text: 'Description', x: 44, y: 120, width: 60 },
    { text: 'This', x: 360, y: 120, width: 22 }, { text: 'pay', x: 386, y: 120, width: 18 },
    { text: 'Year', x: 470, y: 120, width: 24 }, { text: 'to', x: 498, y: 120, width: 10 },
    { text: 'date', x: 512, y: 120, width: 22 },
  ],
}
const preamble = [
  'PAY ADVICE v2',
  'Employer: Riverbend Example Cafe',
  'Pay period: 01/07/2026 to 14/07/2026',
  'Payment date: 16/07/2026',
]
const preambleRows = (): TextRow[] => preamble.map(text => ({ text, tokens: [{ text, x: 44, y: 200, width: 200 }] }))
function build(rows: TextRow[]) {
  const all = [...preambleRows(), header, ...rows]
  return parsePayslip(all.map(r => r.text), 'hash', 'advice.pdf', false, all)
}

describe('PAY ADVICE v2 tabular layout', () => {
  it('reads all three fictional pay advices and never takes the year-to-date column', () => {
    expect(slips).toHaveLength(3)
    for (const slip of slips) expect(slip.format).toBe('pay-advice-v2')

    expect(slips[0].facts).toMatchObject({
      employer: 'Riverbend Example Cafe',
      periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16',
      gross: '1,640.00', withheld: '212.00', deductions: '35.00', net: '1,393.00', super: '188.60',
    })
    for (const slip of slips) expect(validateFacts(slip.facts)).toEqual([])

    // The fixtures carry large unrelated YTD figures. Reading either column by
    // mistake would show up immediately in these totals.
    expect(totals(slips)).toMatchObject({ gross: 768550, withheld: 139200, deductions: 7000, net: 622350 })
    for (const slip of slips) expect(slip.text).toContain('48,912.00')
    expect(Object.values(slips[0].facts)).not.toContain('48,912.00')
  })

  it('leaves super unknown when the advice has no superannuation row', () => {
    expect(slips[2].facts.super).toBe('')
    expect(totals(slips)).toMatchObject({ superKnown: 2 })
  })

  it('takes the current-period figure even when year to date is smaller', () => {
    // Early in a financial year the cumulative column can be the lower number,
    // so position must decide the answer, never magnitude.
    const slip = build([row('Gross earnings', '900.00', '450.00'), row('Net pay', '800.00', '400.00')])
    expect(slip.facts.gross).toBe('900.00')
    expect(slip.facts.net).toBe('800.00')
  })

  it('leaves a field blank when one lone amount could be either column', () => {
    const slip = build([row('Gross earnings', '1,000.00', null)])
    expect(slip.facts.gross).toBe('')
  })

  it('leaves a field blank when an amount sits between the two columns', () => {
    const stray: TextRow = {
      text: 'Gross earnings 500.00 600.00',
      tokens: [
        { text: 'Gross earnings', x: 44, y: 100, width: 90 },
        { text: '500.00', x: 430, y: 100, width: 50 },  // centred between columns
        { text: '600.00', x: 495, y: 100, width: 50 },
      ],
    }
    expect(build([stray]).facts.gross).toBe('')
  })

  it('leaves every amount blank when the column header is missing', () => {
    const lines = [...preamble, 'Gross earnings 1,000.00 9,000.00']
    const rows = [...preambleRows(), row('Gross earnings', '1,000.00', '9,000.00')]
    const slip = parsePayslip(lines, 'h', 'n', false, rows)
    // Dates and employer still read: they are labelled, not tabular.
    expect(slip.facts.employer).toBe('Riverbend Example Cafe')
    expect(slip.facts.gross).toBe('')
  })

  it('strips a currency symbol but keeps the figure verbatim otherwise', () => {
    expect(build([row('PAYG withholding', '$212.00', '$9,884.00')]).facts.withheld).toBe('212.00')
  })
})

describe('format detection', () => {
  it('identifies each documented layout and rejects anything else', () => {
    expect(detectFormat(['PAYSLIP SUMMARY v1'])?.id).toBe('payslip-summary-v1')
    expect(detectFormat(['PAY ADVICE v2'])?.id).toBe('pay-advice-v2')
    expect(detectFormat(['Acme Payroll Statement'])).toBeNull()
  })

  it('refuses a document claiming to be two layouts at once', () => {
    expect(() => detectFormat(['PAYSLIP SUMMARY v1', 'PAY ADVICE v2'])).toThrow('more than one')
  })
  it('reads a marker off a picture through the misses a recogniser actually makes', () => {
    // Recognising the drawn marker gives back a lowercase L for the 1. Every
    // figure on the same payslip came back correct, so refusing the layout over
    // one character would send a perfectly readable payslip to manual entry.
    expect(detectFormat(['PAYSLIP SUMMARY vl'])).toBeNull()
    expect(detectFormat(['PAYSLIP SUMMARY vl'], true)?.id).toBe('payslip-summary-v1')
    expect(detectFormat(['PAY ADVICE vZ'], true)?.id).toBe('pay-advice-v2')
    expect(detectFormat(['PAYSL1P SUMMARY v1'], true)?.id).toBe('payslip-summary-v1')
  })
  it('does not loosen a marker into a different layout', () => {
    // The tolerance must never turn one documented layout into another, and
    // must not accept a line that is simply not a marker.
    expect(detectFormat(['PAY ADVICE v2'], true)?.id).toBe('pay-advice-v2')
    expect(detectFormat(['Acme Payroll Statement'], true)).toBeNull()
    expect(detectFormat(['PAYSLIP SUMMARY'], true)).toBeNull()
    expect(detectFormat(['PAYSLIP SUMMARY v12'], true)).toBeNull()
  })

  it('names both supported layouts when it cannot read a file', () => {
    expect(() => parsePayslip(['A scanned payslip'], 'x', 'x')).toThrow(/PAYSLIP SUMMARY v1 and PAY ADVICE v2/)
  })

  it('rejects a v2 advice that repeats a labelled field', () => {
    expect(() => parsePayslip(['PAY ADVICE v2', 'Employer: A', 'Employer: B'], 'x', 'x')).toThrow('More than one')
  })
})
