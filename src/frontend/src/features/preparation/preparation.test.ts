import { describe, expect, it } from 'vitest'
import { changeIncome, emptyPreparation, incomeAmount, incomeProblems, incomeSummary, newIncome, preparationSummary, removeIncome, samplePreparation, situationQuestions } from './preparation'
import { makeEvidence, pairKey } from '../documents/evidence'
import { emptyPhoneAnswers } from '../assessment/phone'
import { preparationReport } from './preparationReport'
const now = new Date('2026-09-18T12:00:00Z')
const reviewedSample = () => { const prep = samplePreparation(); prep.income = prep.income.map(item => ({ ...item, reviewed: true })); return prep }
describe('recorded annual income', () => {
  it('keeps blank distinct from zero and adds exact cents', () => {
    expect(incomeAmount('')).toBeNull(); expect(incomeAmount('0')).toBe(0); expect(incomeAmount('$0.00')).toBe(0)
    const prep = reviewedSample(); prep.income[0].gross = '64000.10'; prep.income[1].gross = '18000.20'
    expect(incomeSummary(prep)).toMatchObject({ included: 3, grossCents: 8_215_030, withheldCents: 1_710_000, complete: true })
  })
  it.each(['-1', 'NaN', 'Infinity', '1e5', '1000000.01', '12,34', '1.001'])('rejects unsupported money %s', value => expect(incomeAmount(value)).toBeNull())
  it('excludes all unreviewed sample records without treating their values as verified', () => {
    expect(incomeSummary(samplePreparation())).toMatchObject({ included: 0, grossCents: 0, withheldCents: 0, complete: false })
  })
  it.each(['reference', 'payer', 'gross', 'withheld', 'finalised'] as const)('keeps missing %s unresolved', field => {
    const item = reviewedSample().income[0]; item[field] = ''
    expect(incomeProblems(item).length).toBeGreaterThan(0)
  })
  it('excludes incorrect-year, unfinished and unsupported joint-interest entries', () => {
    const prep = reviewedSample(); prep.income[0].year = '2024-25'; prep.income[1].finalised = 'no'; prep.income[2].soleOwner = 'no'
    expect(incomeSummary(prep).included).toBe(0)
    expect(incomeSummary(prep).items.every(item => item.issues.length > 0)).toBe(true)
  })
  it('flags tax withheld exceeding gross without guessing an adjustment', () => {
    const item = reviewedSample().income[0]; item.withheld = '70000'
    expect(incomeProblems(item).join(' ')).toContain('exceeds gross')
  })
  it('does not double count repeated or amended annual records', () => {
    const prep = reviewedSample(); prep.income.push({ ...prep.income[0], id: 'copy', reference: 'Amended statement', gross: '65000' })
    const result = incomeSummary(prep)
    expect(result.conflicts).toHaveLength(1); expect(result.grossCents).toBe(1_815_000)
    expect(result.included).toBe(2); expect(result.complete).toBe(false)
  })
  it('detects reused source references even if the payer wording differs', () => {
    const prep = reviewedSample(); prep.income[1].reference = prep.income[0].reference.toUpperCase()
    expect(incomeSummary(prep).included).toBe(1)
  })
  it('retains separate-record decisions only until a related record changes', () => {
    let prep = reviewedSample(); prep.income.push({ ...prep.income[0], id: 'second' })
    prep.separate = [pairKey(prep.income[0].id, 'second')]
    expect(incomeSummary(prep).included).toBe(4)
    prep = changeIncome(prep, 'second', { gross: '120' })
    expect(prep.incomeComplete).toBe(''); expect(prep.separate).toEqual([])
    expect(prep.income.find(item => item.id === 'second')!.reviewed).toBe(false)
    expect(incomeSummary(prep).conflicts).toHaveLength(1)
  })
  it('recomputes after edits and removals while retaining original sample facts', () => {
    let prep = changeIncome(reviewedSample(), 'sample-employer-1', { gross: '65000' })
    expect(incomeSummary(prep)).toMatchObject({ included: 2, grossCents: 1_815_000, complete: false })
    expect(prep.income[0].original?.gross).toBe('64000')
    prep.income[0].reviewed = true
    expect(incomeSummary(prep).grossCents).toBe(8_315_000)
    prep = removeIncome(prep, 'sample-employer-1')
    expect(incomeSummary(prep).grossCents).toBe(1_815_000)
  })
})
describe('preparation coverage and evidence', () => {
  it('does not infer income from bank records, including positive deposits', () => {
    const deposit = makeEvidence('bank', 'bank.csv', 'Row 2', { merchant: 'Payroll', description: 'Net salary', date: '2025-08-14', cents: 400000 }, 'bank', '', true)
    const result = preparationSummary(emptyPreparation(), [deposit], [], [], [], now)
    expect(result.income.included).toBe(0); expect(result.income.grossCents).toBe(0)
    expect(result.gaps.some(gap => gap.message.includes('No income is inferred'))).toBe(true)
  })
  it.each(situationQuestions.map(q => q.key))('keeps unanswered and unsupported %s visible', key => {
    const prep = reviewedSample(); const question = situationQuestions.find(q => q.key === key)!
    prep.situation[key] = 'unsure'
    expect(preparationSummary(prep, [], [], [], [], now).gaps.some(gap => gap.message.includes(`${question.label} Unsure`))).toBe(true)
    prep.situation[key] = question.normal === 'yes' ? 'no' : 'yes'
    expect(preparationSummary(prep, [], [], [], [], now).gaps.some(gap => gap.message === question.gap)).toBe(true)
  })
  it('never reports a completed return or approved claims, even with all sample answers', () => {
    const result = preparationSummary(reviewedSample(), [], [], [], [], now)
    expect(result.claimReady).toBe(false)
    expect(result.gaps.filter(gap => gap.section === 'Review')).toHaveLength(2)
  })
  it('carries failed imports and unassessed expenses into the handover gaps', () => {
    const item = makeEvidence('receipt', 'phone.pdf', 'Page 1', { merchant: 'Example Phone', date: '2025-08-14', description: 'Service', cents: 4500 }, 'receipt', '')
    const result = preparationSummary(reviewedSample(), [item], [], [], ['broken.pdf could not be read'], now)
    expect(result.gaps.some(gap => gap.message.includes('broken.pdf'))).toBe(true)
    expect(result.gaps.some(gap => gap.message.includes('assessment not started'))).toBe(true)
  })
  it('totals a linked phone illustration once, never subtracting it from recorded income', () => {
    const item = { ...makeEvidence('receipt', 'phone.pdf', 'Page 1', { merchant: 'Example Phone', date: '2025-08-14', description: 'Service', cents: 4500 }, 'receipt', ''), confirmed: true,
      answers: { purpose: 'Client work calls', reimbursed: 'no' as const, workUse: '40', basis: 'Itemised log' },
      phone: { ...emptyPhoneAnswers(), kind: 'service' as const, payer: 'you' as const, use: 'duties' as const, homeMethod: 'none' as const, elsewhere: 'no' as const, records: 'yes' as const, representative: 'yes' as const } }
    const bank = { ...item, id: 'bank', kind: 'bank' as const }
    const result = preparationSummary(reviewedSample(), [item, bank], [{ bank: bank.id, receipt: item.id }], [], [], now)
    expect(result.illustrativeCents).toBe(1800); expect(result.illustrationCount).toBe(1)
    expect(result.income.grossCents).toBe(8_215_000)
    const refund = { ...bank, id: 'credit', credit: true, facts: { ...bank.facts, cents: 1000 } }
    expect(preparationSummary(reviewedSample(), [item, bank, refund], [{ bank: bank.id, receipt: item.id }], [], [], now).illustrationCount).toBe(0)
  })
  it('exports unresolved input, circumstances, provenance and hostile text safely', () => {
    const prep = reviewedSample(); prep.notes = '<script>alert(1)</script>'; prep.situation.otherIncome = 'yes'
    prep.income[0].payer = '<img src=x onerror=steal()>'; prep.income.push(newIncome('blank', 'salary'))
    const html = preparationReport(prep, [], [], [], [], ['Unreadable file'])
    for (const value of ['TaxPrep AU preparation handover', '$82,150.00', '$17,100.00', 'preparation-2025-26.v1', 'Other income sections remain unprepared', 'Original sample values', 'Blank (unresolved)', 'Unreadable file', 'ato.gov.au', '&lt;script&gt;', '&lt;img']) expect(html).toContain(value)
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=x')
    expect(html).toContain('not ready to lodge')
  })
})
