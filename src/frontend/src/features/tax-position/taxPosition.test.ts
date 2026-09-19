import { describe, expect, it } from 'vitest'
import { taxPosition } from './taxPosition'
import { taxSources, taxSourceProblems } from './sourceHealth'
import { taxPositionReport } from './taxPositionReport'
import { changeIncome, samplePreparation, situationQuestions } from '../preparation/preparation'
const now = new Date('2026-09-19T12:00:00Z')
const sample = () => { const p = samplePreparation(); p.income.forEach(i => { i.reviewed = true }); return p }
function at(gross: string, withheld = '0') {
  const p = sample(); p.income = [{ ...p.income[0], gross, withheld }]; return taxPosition(p, 0, [], now)
}
const component = (result: ReturnType<typeof taxPosition>, label: string) => result.lines.find(line => line.label === label)?.cents

describe('2025–26 fictional no-deduction arithmetic', () => {
  it.each([
    ['0', 0, 0, 0], ['18200', 0, 0, 0], ['18201', 16, 16, 0],
    ['22575', 70000, 70000, 0], ['28011', 156976, 70000, 0],
    ['28012', 156992, 70000, 10], ['29000', 172800, 70000, 9890],
    ['35013', 269008, 70000, 70020], ['35014', 269024, 70000, 70028],
    ['37500', 308800, 70000, 75000], ['37501', 308816, 69995, 75002],
    ['45000', 428800, 32500, 90000], ['45001', 428830, 32499, 90002],
    ['66666', 1078780, 1, 133332], ['66667', 1078810, 0, 133334],
    ['101000', 2108800, 0, 202000],
  ])('at $%s: verifies tax, used offset and levy independently', (gross, tax, lito, levy) => {
    const result = at(String(gross))
    expect(result.status).toBe('illustration')
    expect(component(result, 'Income tax before offsets')).toBe(tax)
    expect(component(result, 'Low income tax offset used')).toBe(lito)
    expect(component(result, 'Medicare levy')).toBe(levy)
    expect(result.balanceCents).toBe(-Number(tax) + Number(lito) - Number(levy))
  })
  it('uses the official Angie $29,000 Medicare example ($98.90)', () => {
    expect(component(at('29000'), 'Medicare levy')).toBe(9890)
  })
  it('retains cents and rounds the final offset, not the amount it reduces by', () => {
    expect(component(at('45001.00'), 'Low income tax offset used')).toBe(32499)
    expect(component(at('18200.04'), 'Income tax before offsets')).toBe(1)
    expect(component(at('37500.10'), 'Low income tax offset used')).toBe(70000)
    expect(component(at('28011.05'), 'Medicare levy')).toBe(1)
    expect(component(at('100999.99'), 'Illustrative taxable income')).toBe(10099999)
    expect(at('101000.01').status).toBe('blocked')
  })
  it('shows both balance directions and an exact even balance without issuing a real estimate', () => {
    const result = taxPosition(sample(), 0, [], now)
    expect(result.balanceCents).toBe(2400)
    expect(component(result, 'Illustrative tax plus Medicare')).toBe(1707600)
    expect(at('82150', '17076').balanceCents).toBe(0)
    expect(at('83150', '17100').balanceCents).toBe(-29600)
    expect(result).toMatchObject({ estimateCents: null, claimReady: false })
  })
  it('never refunds unused low-income offset or applies it to Medicare', () => {
    expect(at('10000').balanceCents).toBe(0)
    expect(component(at('29000'), 'Medicare levy')).toBe(9890)
  })
})
describe('complete facts and reviewed deductions cannot be bypassed', () => {
  it.each(situationQuestions.map(q => q.key))('blocks unanswered, unsure and unsupported %s', key => {
    const p = sample(); const q = situationQuestions.find(q => q.key === key)!
    for (const value of ['', 'unsure', q.normal === 'yes' ? 'no' : 'yes'] as const) {
      p.situation[key] = value
      expect(taxPosition(p, 0, [], now)).toMatchObject({ status: 'blocked', lines: [], balanceCents: null, estimateCents: null })
    }
  })
  it('blocks changed, incomplete, duplicate or wrong-year income rather than computing a partial result', () => {
    const p = sample()
    expect(taxPosition(changeIncome(p, p.income[0].id, { gross: '65000' }), 0, [], now).balanceCents).toBeNull()
    p.income.push({ ...p.income[0], id: 'copy' })
    expect(taxPosition(p, 0, [], now).balanceCents).toBeNull()
    const other = sample(); other.income[0].year = '2024-25'
    expect(taxPosition(other, 0, [], now).balanceCents).toBeNull()
  })
  it('blocks any expense evidence, including draft phone, zero, excluded and unresolved records', () => {
    const result = taxPosition(sample(), 1, [], now)
    expect(result.balanceCents).toBeNull(); expect(result.blockers.join(' ')).toContain('not an approved deduction')
    expect(result.lines).toEqual([])
  })
  it('blocks import failures and unverified bank-interest credits', () => {
    expect(taxPosition(sample(), 0, ['failed.pdf'], now).status).toBe('blocked')
    const p = sample(); p.income[2].withheld = '15'
    expect(taxPosition(p, 0, [], now).blockers.join(' ')).toContain('Bank-interest tax credits')
  })
})
describe('rule provenance and report', () => {
  it('binds every calculation to the selected year and rejects stale/future/invalid checks', () => {
    expect(taxSourceProblems('2025-26', now)).toEqual([])
    for (const date of [new Date('2026-09-18'), new Date('2027-03-19'), new Date('invalid')]) expect(taxPosition(sample(), 0, [], date).balanceCents).toBeNull()
    expect(taxPosition(sample(), 0, [], now, taxSources, '2026-27').balanceCents).toBeNull()
  })
  it.each(['missing', 'duplicate', 'hash', 'conflict', 'year', 'withdrawn', 'fake-review'])('rejects %s source state', mode => {
    const entries = structuredClone(taxSources)
    if (mode === 'missing') entries.pop()
    if (mode === 'duplicate') entries.push(entries[0])
    if (mode === 'hash') entries[0].sha256 = 'changed'
    if (mode === 'conflict') entries[0].conflict = true
    if (mode === 'year') entries[0].applicableYears = ['2026-27']
    if (mode === 'withdrawn') entries[0].reviewStatus = 'withdrawn'
    if (mode === 'fake-review') entries[0].reviewStatus = 'approved'
    expect(taxPosition(sample(), 0, [], now, entries)).toMatchObject({ lines: [], balanceCents: null, estimateCents: null })
  })
  it('exports arithmetic, assumptions, rounding, source hashes and the pending review gate', () => {
    const html = taxPositionReport(taxPosition(sample(), 0, [], now))
    for (const text of ['$24.00', '$17,076.00', '2025–26', 'half up', 'pending', 'employee-no-deductions-2025-26.v1-draft', taxSources[0].sha256]) expect(html).toContain(text)
    const blocked = taxPosition(sample(), 1, [], now); blocked.blockers.push('<script>bad</script>')
    const report = taxPositionReport(blocked)
    expect(report).toContain('Calculation unavailable'); expect(report).toContain('&lt;script&gt;'); expect(report).not.toContain('<script>')
    expect(report).not.toContain('$24.00')
  })
})
