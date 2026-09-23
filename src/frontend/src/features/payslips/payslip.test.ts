import { beforeAll, describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import examples from '../../../../../sample-data/payslips/examples.json'
import { appendPayslips, MAX_PAYSLIPS, buckets, changedFacts, confirmationIssues, dateValue, financialYear, money, observations, selectedPayslips, totals, validateFacts, type Payslip } from './payslip'
import { parsePayslip, textLines } from './payslipReader'
import { payslipReport } from './payslipReport'
let slips: Payslip[]
beforeAll(async () => {
  slips = await Promise.all(examples.map(async (example, index) => {
    const task = getDocument({ data: new Uint8Array(Buffer.from(example.pdfBase64, 'base64')), useSystemFonts: true })
    try {
      const pdf = await task.promise, page = await pdf.getPage(1), content = await page.getTextContent()
      const lines = textLines(content.items.flatMap(i => 'str' in i && i.str.trim() ? [{ text: i.str, x: i.transform[4], y: i.transform[5] }] : []))
      return parsePayslip(lines, String(index), example.name, true)
    } finally { await task.destroy() }
  }))
})
const reviewed = () => slips.map(s => ({ ...structuredClone(s), confirmed: true }))
describe('actual payslip PDFs and period facts', () => {
  it('extracts all six PDFs and never sums cumulative YTD fields', () => {
    expect(slips).toHaveLength(6)
    for (const s of slips) { expect(s.confirmed).toBe(false); expect(validateFacts(s.facts)).toEqual([]); expect(s.text).toContain('YTD gross pay: 99999.00') }
    expect(totals(slips)).toMatchObject({ gross: 1045000, withheld: 155500, deductions: 8000, net: 881500, superCents: 111000, superKnown: 5, percentage: '14.9' })
  })
  it('preserves missing withholding as unresolved and missing super as unknown', () => {
    const s = structuredClone(slips[0]); s.facts.withheld = ''
    expect(confirmationIssues(s, [s]).join(' ')).toContain('tax withheld')
    expect(slips[5].facts.super).toBe(''); expect(money(slips[5].facts.super)).toBeNull()
  })
  it('rejects ambiguous fields and unsupported PDF layouts', () => {
    expect(() => parsePayslip(['PAYSLIP SUMMARY v1', 'Gross pay: 10', 'Gross pay: 20'], 'x', 'x')).toThrow('More than one')
    expect(() => parsePayslip(['A scanned payslip'], 'x', 'x')).toThrow('not supported')
  })
  it.each([['1,234.56', 123456], ['$45.10', 4510], ['0', 0], ['0.01', 1], ['', null], ['12,34', null], ['1e3', null], ['1.001', null], ['-1', null], ['10000000.01', null]])('strictly parses %s', (input, result) => expect(money(String(input))).toBe(result))
  it('validates real calendar dates and maps years by pay date', () => {
    expect(dateValue('2026-02-29')).toBeNull(); expect(dateValue('29/02/2024')).toBe('2024-02-29')
    expect(financialYear('2026-06-30')).toBe('2025–26'); expect(financialYear('2026-07-01')).toBe('2026–27')
    const a = reviewed(); a[0].facts.payDate = '2026-06-30'; a[0].facts.periodStart = '2026-06-01'; a[0].facts.periodEnd = '2026-06-14'
    expect(selectedPayslips(a, '2025–26', 'all')).toHaveLength(1)
  })
  it('blocks arithmetic mismatch, reversed dates, long periods and missing zero', () => {
    const f = { ...slips[0].facts, net: '1', periodStart: '2026-08-01', periodEnd: '2026-07-01' }
    expect(validateFacts(f).join(' ')).toMatch(/run forwards.*does not equal/)
    expect(validateFacts({ ...slips[0].facts, deductions: '' }).join(' ')).toContain('Other'.toLowerCase())
    expect(validateFacts({ ...slips[0].facts, periodEnd: '2027-01-01' }).join(' ')).toContain('63 days')
  })
})
describe('review, duplication and honest totals', () => {
  it('excludes pending records and immediately invalidates confirmed edits', () => {
    expect(selectedPayslips(slips, 'all', 'all')).toEqual([])
    const a = reviewed(); a[0] = changedFacts(a[0], { ...a[0].facts, super: '' })
    expect(selectedPayslips(a, 'all', 'all')).toHaveLength(5); expect(a[0].original.super).toBe('216.00')
  })
  it('refuses the same bytes and the same pay identity, including renamed files', () => {
    const renamed = appendPayslips(slips, [{ ...slips[0], name: 'renamed.pdf' }])
    expect(renamed.kept).toHaveLength(6)
    expect(renamed.skipped).toEqual([{ name: 'renamed.pdf', reason: 'This file has already been added.' }])

    // Different bytes, same employer, pay date and period.
    const repeated = appendPayslips([slips[0]], [{ ...slips[0], id: 'new', hash: 'new', name: 'again.pdf' }])
    expect(repeated.kept).toHaveLength(1)
    expect(repeated.skipped[0].reason).toContain('employer, pay date and period')
  })
  it('keeps the files it can add rather than refusing the whole batch for one repeat', () => {
    // The point of the change: nineteen good files are not thrown away because
    // the twentieth was already added.
    const { kept, skipped } = appendPayslips([slips[0]], [
      { ...slips[1] }, { ...slips[0], name: 'repeat.pdf' }, { ...slips[2] },
    ])
    expect(kept.map(s => s.id)).toEqual([slips[0].id, slips[1].id, slips[2].id])
    expect(skipped.map(f => f.name)).toEqual(['repeat.pdf'])
    expect(slips).toHaveLength(6)
  })
  it('stops at the session limit and says which files that cost', () => {
    const full = Array.from({ length: MAX_PAYSLIPS }, (_, i) => ({ ...slips[0], id: `f${i}`, hash: `f${i}`, facts: { ...slips[0].facts, payDate: '' } }))
    const { kept, skipped } = appendPayslips(full, [{ ...slips[0], id: 'x', hash: 'x', name: 'one-too-many.pdf' }])
    expect(kept).toHaveLength(MAX_PAYSLIPS)
    expect(skipped).toEqual([{ name: 'one-too-many.pdf', reason: `This session already holds ${MAX_PAYSLIPS} payslips.` }])
  })
  it('does not allow edited duplicates to inflate confirmed totals', () => {
    const a = reviewed(); a[1].facts = { ...a[0].facts, employer: ' HARBOUR   EXAMPLE SERVICES ' }
    expect(selectedPayslips(a, 'all', 'all')).toHaveLength(4)
  })
  it('separates employers and never calls missing super zero in grouped coverage', () => {
    const selected = selectedPayslips(reviewed(), '2026–27', 'garden example studio')
    expect(totals(selected)).toMatchObject({ gross: 220000, superCents: 12000, superKnown: 1, count: 2 })
    expect(buckets(selected, 'month')[1]).toMatchObject({ superKnown: 0, count: 1 })
    expect(buckets(reviewed(), 'payday')).toHaveLength(6)
  })
  it('flags overlaps and gaps without manufacturing amounts or accusations', () => {
    const a = reviewed().slice(0, 2); a[1].facts.periodStart = '2026-07-14'
    expect(observations(a).join(' ')).toContain('overlap')
    a[1].facts.periodStart = '2026-07-18'
    expect(observations(a).join(' ')).toContain('3 day(s)')
    expect(totals(a).gross).toBe(390000)
  })
  it('reports observed changes only, and treats different period lengths cautiously', () => {
    expect(observations(reviewed()).join(' ')).toContain('does not establish why')
    const changed = reviewed(); changed[5].facts.periodEnd = '2026-08-30'
    expect(observations(changed).join(' ')).toContain('different lengths')
  })
  it('exports selected confirmed figures, provenance, corrections and pending questions, escaping hostile text', () => {
    const a = reviewed(); a[0].facts.employer = '<img src=x onerror=bad()>'; a[0].facts.super = '200.00'; a[1].confirmed = false
    const selected = selectedPayslips(a, 'all', 'all'), html = payslipReport(selected, a, '<script>bad</script>')
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('&lt;img'); expect(html).not.toContain('<img'); expect(html).not.toContain('<script>')
    expect(html).toContain('216.00'); expect(html).toContain('200.00'); expect(html).toContain('SHA-256'); expect(html).toContain('1 record(s) excluded')
    expect(html).not.toContain('YTD gross pay: 99999.00'); expect(html).toContain('No refund forecast')
  })
})
