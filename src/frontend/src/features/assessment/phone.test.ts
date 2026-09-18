import { describe, expect, it } from 'vitest'
import { assessPhone, emptyPhoneAnswers, percentageBasisPoints, phoneCredits, sources, sourceProblems, type PhoneAnswers, type Source } from './phone'
import { makeEvidence, mergeWorkDetails, reconcile, type Evidence } from '../documents/evidence'
import { evidenceReport } from '../documents/evidenceReport'

const now = new Date('2026-09-18T12:00:00Z')
function bill(phone: Partial<PhoneAnswers> = {}): Evidence {
  return { ...makeEvidence('receipt', 'phone.pdf', 'Page 1', { merchant: 'Fictional Mobile', description: 'Mobile service', date: '2025-08-14', cents: 4500 }, 'receipt', 'Original receipt'), confirmed: true,
    answers: { purpose: 'Calls to clients while performing support duties', reimbursed: 'no', workUse: '40', basis: 'Itemised bill and representative continuous 4-week log' },
    phone: { ...emptyPhoneAnswers(), kind: 'service', payer: 'you', use: 'duties', homeMethod: 'none', elsewhere: 'no', records: 'yes', representative: 'yes', ...phone } }
}
const assess = (item = bill(), evidence = [item], counted = true) => assessPhone(item, evidence, counted, '2025-26', now)
describe('draft phone rules: engineering expectations, professional review pending', () => {
  it('shows a per-bill work portion while always blocking claim-ready output', () => {
    const result = assess()
    expect(result).toMatchObject({ status: 'illustration', cents: 1800, calculation: '$45.00 × 40% = $18.00', claimReady: false })
    expect(result.reviewGate).toContain('Qualified tax review pending')
  })
  it.each([['0', 0], ['100', 4500], ['33.33', 1500]])('uses documented %s%% without annualising', (percent, cents) => {
    const item = bill(); item.answers.workUse = percent
    expect(assess(item).cents).toBe(cents)
  })
  it('uses integer half-up cents, including the upper input bound', () => {
    const item = bill(); item.facts.cents = 1; item.answers.workUse = '50'
    expect(assess(item).cents).toBe(1)
    item.facts.cents = 100_000_000; item.answers.workUse = '99.99'
    expect(assess(item).cents).toBe(99_990_000)
  })
  it.each(['-1', '100.01', '1e2', '40%', '', '0.001', 'NaN'])('rejects malformed percentage %s', value => {
    expect(percentageBasisPoints(value)).toBeNull()
    const item = bill(); item.answers.workUse = value
    expect(assess(item).cents).toBeNull()
  })
  it.each<Partial<PhoneAnswers>>([{ payer: 'other' }, { use: 'availability' }, { use: 'job-search' }, { use: 'private' }, { homeMethod: 'fixed' }, { elsewhere: 'yes' }])('explains an exclusion without requiring irrelevant followups: %j', phone => {
    const item = bill(phone); item.answers.workUse = ''; item.answers.basis = ''
    expect(assess(item)).toMatchObject({ status: 'no-separate-amount', cents: 0, claimReady: false })
  })
  it('fixed-rate overlap also covers phone use away from home', () => {
    const result = assess(bill({ homeMethod: 'fixed' }))
    expect(result.findings[0].message).toContain('away from home')
    expect(result.findings[0].sources).toEqual(['phone', 'fixed'])
  })
  it.each<Partial<PhoneAnswers>>([{ kind: '' }, { payer: '' }, { payer: 'unsure' }, { use: 'mixed' }, { homeMethod: 'unsure' }, { elsewhere: 'unsure' }, { records: 'no' }, { representative: 'no' }])('leaves missing or unsupported facts unresolved: %j', phone => {
    expect(assess(bill(phone))).toMatchObject({ status: 'unresolved', cents: null })
  })
  it.each<PhoneAnswers['kind']>(['device', 'bundle', 'other'])('does not apply service arithmetic to %s', kind => {
    expect(assess(bill({ kind }))).toMatchObject({ status: 'outside-scope', cents: null })
  })
  it.each(['purpose', 'basis'] as const)('requires the existing %s answer', key => {
    const item = bill(); item.answers[key] = ''
    expect(assess(item).cents).toBeNull()
  })
  it('blocks full reimbursements and leaves partial allocation for review', () => {
    const item = bill({ reimbursedAmount: '45' }); item.answers.reimbursed = 'yes'
    expect(assess(item)).toMatchObject({ status: 'no-separate-amount', cents: 0 })
    for (const value of ['10', '', '46']) { item.phone!.reimbursedAmount = value; expect(assess(item).cents).toBeNull() }
    item.answers.reimbursed = 'unsure'; expect(assess(item).cents).toBeNull()
  })
  it('does not treat a bank record as a supplier bill or reject all evidence exceptions', () => {
    const item = bill(); item.kind = 'bank'
    const result = assess(item)
    expect(result.cents).toBeNull()
    expect(result.findings.some(finding => finding.message.includes('exceptions need separate review'))).toBe(true)
  })
  it.each(['unconfirmed', 'credit', 'excluded', 'incorrect-year', 'duplicate'])('cannot assess %s evidence', condition => {
    const item = bill()
    if (condition === 'unconfirmed') item.confirmed = false
    if (condition === 'credit') item.credit = true
    if (condition === 'excluded') item.excluded = 'Duplicate'
    if (condition === 'incorrect-year') item.facts.date = '2025-06-30'
    expect(assess(item, [item], condition !== 'duplicate').cents).toBeNull()
  })
})
describe('source maintenance and applicability', () => {
  it('allows draft arithmetic for captured sources but never claim approval', () => {
    expect(sourceProblems('2025-26', now)).toEqual([])
    expect(assess().claimReady).toBe(false)
  })
  it.each(['missing', 'duplicate', 'stale', 'future', 'conflict', 'changed', 'wrong-year', 'withdrawn'])('blocks %s material', fault => {
    const entries: Source[] = structuredClone(sources)
    if (fault === 'missing') entries.pop()
    if (fault === 'duplicate') entries.push(entries[0])
    if (fault === 'stale') entries[0].retrievedAt = '2025-01-01'
    if (fault === 'future') entries[0].retrievedAt = '2027-01-01'
    if (fault === 'conflict') entries[0].conflict = true
    if (fault === 'changed') entries[0].sha256 = 'changed'
    if (fault === 'wrong-year') entries[0].applicableYears = ['2024-25']
    if (fault === 'withdrawn') entries[0].reviewStatus = 'withdrawn'
    const item = bill()
    expect(assessPhone(item, [item], true, '2025-26', now, entries)).toMatchObject({ status: 'unresolved', cents: null, claimReady: false })
  })
  it('rejects a selected year outside the rule year', () => {
    const item = bill()
    expect(assessPhone(item, [item], true, '2026-27', now).cents).toBeNull()
  })
})
describe('evidence and report continuity', () => {
  it('blocks a possible supplier refund until it is resolved without offsetting it', () => {
    const item = bill()
    const credit = { ...bill(), id: 'refund', kind: 'bank' as const, credit: true, facts: { ...item.facts, cents: 1000 } }
    expect(phoneCredits(item, [credit])).toEqual([credit])
    expect(assessPhone(item, [item], true, '2025-26', now, sources, phoneCredits(item, [credit])).cents).toBeNull()
    credit.excluded = 'Reviewed: refund is for an unrelated purchase'
    expect(phoneCredits(item, [credit])).toEqual([])
    credit.excluded = ''; credit.facts.merchant = 'Unrelated supplier'
    expect(phoneCredits(item, [credit])).toEqual([])
  })
  it('carries existing bank answers to a receipt and rejects conflicting answers', () => {
    const bank = bill(); bank.kind = 'bank'
    const receipt = makeEvidence('new', 'bill.pdf', 'Page 1', bank.facts, 'receipt', '')
    expect(mergeWorkDetails(bank, receipt)).toEqual({ answers: bank.answers, phone: bank.phone })
    receipt.answers.workUse = '50'
    expect(mergeWorkDetails(bank, receipt)).toBeNull()
  })
  it('assesses a linked expense once and invalidates the result when match facts change', () => {
    const receipt = bill(); const bank = { ...bill(), id: 'bank:Row 2', kind: 'bank' as const }
    const links = [{ bank: bank.id, receipt: receipt.id }]
    const linked = reconcile([receipt, bank], links, [])
    expect(linked.groups).toHaveLength(1)
    expect(assess(linked.groups[0].item, linked.groups[0].evidence, linked.groups[0].counted).cents).toBe(1800)
    receipt.facts = { ...receipt.facts, merchant: 'Corrected merchant' }
    const corrected = reconcile([receipt, bank], links, [])
    expect(corrected.groups).toHaveLength(2)
    expect(corrected.groups.every(group => assess(group.item, group.evidence, group.counted).cents === null)).toBe(true)
  })
  it('recalculates corrected amounts and preserves original evidence in escaped exports', () => {
    const item = bill(); item.facts = { ...item.facts, cents: 5000 }; item.answers.purpose = '<script>alert(1)</script>'
    expect(assess(item).cents).toBe(2000)
    const html = evidenceReport([item], [], [], [], 'Employee', [])
    for (const text of ['$45.00', '$50.00', 'Qualified tax review pending', 'employee-phone-2025-26.v1-draft', sources[0].sha256, 'Original receipt', '&lt;script&gt;']) expect(html).toContain(text)
    expect(html).not.toContain('<script>')
  })
})
