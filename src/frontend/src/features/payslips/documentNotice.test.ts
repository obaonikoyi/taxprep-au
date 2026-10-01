import { describe, expect, it } from 'vitest'
import { kindNotice, mixedNames } from './documentNotice'
import { DOCUMENT_KINDS } from './assistedReader'
import { blankFacts, type Payslip } from './payslip'

const slip = (name: string, paidToKey?: string): Payslip => {
  const facts = blankFacts()
  return { id: name, name, hash: name, text: '', facts, original: { ...facts }, confirmed: false, sample: false, paidToKey }
}

describe('what to say about a document that is not a payslip', () => {
  it('says nothing at all about a payslip', () => expect(kindNotice('payslip')).toBeNull())

  it('has a sentence for every kind the reader can answer', () => {
    for (const kind of DOCUMENT_KINDS.filter(k => k !== 'payslip')) {
      const notice = kindNotice(kind)!
      expect(notice.what.length).toBeGreaterThan(5)
      expect(notice.why.length).toBeGreaterThan(20)
    }
  })

  /*
   * The reading is an opinion and the person is about to be offered the chance
   * to disagree with it, so it may not be phrased as a fact.
   */
  it('never claims to know what the document is', () => {
    for (const kind of DOCUMENT_KINDS.filter(k => k !== 'payslip')) {
      expect(kindNotice(kind)!.heading).toBe('This does not look like a payslip')
      expect(kindNotice(kind)!.heading).not.toMatch(/\bis not\b/)
    }
  })

  it('explains a tax return by the thing that makes it dangerous', () => {
    // Not "wrong document" — the factor of twenty-six.
    expect(kindNotice('taxReturn')!.why).toContain('whole financial year')
    expect(kindNotice('taxReturn')!.why).toContain('count a year as a fortnight')
  })

  it('sends the other kinds where they actually belong', () => {
    expect(kindNotice('bankStatement')!.why).toContain('Bank spending')
    expect(kindNotice('employmentContract')!.why).toContain('Pay rate checks')
    expect(kindNotice('annualIncomeStatement')!.why).toContain('year-end')
  })

  it('marks an unplaceable document as the weaker claim it is', () => {
    // "other" is the reader saying it could not tell, which is not the same as
    // naming a kind — so the invitation to overrule has to be louder.
    expect(kindNotice('other')!.unsure).toBe(true)
    for (const kind of ['taxReturn', 'bankStatement', 'invoice'] as const) expect(kindNotice(kind)!.unsure).toBe(false)
  })
})

describe('whether the documents disagree about whose they are', () => {
  it('says nothing when every document names the same person', () =>
    expect(mixedNames([slip('a.pdf', 'aaaa1111'), slip('b.pdf', 'aaaa1111')])).toEqual([]))

  it('says nothing when no document names anybody', () =>
    expect(mixedNames([slip('a.pdf'), slip('b.pdf'), slip('c.pdf', '')])).toEqual([]))

  it('groups the files by who they are made out to when they differ', () => {
    const groups = mixedNames([slip('mine.pdf', 'aaaa1111'), slip('theirs.pdf', 'bbbb2222'), slip('mine-2.pdf', 'aaaa1111')])
    expect(groups).toHaveLength(2)
    expect(groups[0].names).toEqual(['mine.pdf', 'mine-2.pdf'])
    expect(groups[1].names).toEqual(['theirs.pdf'])
  })

  /*
   * A documented layout states no name, and manual entry states none either.
   * Neither is evidence of anything, so one named document beside two unnamed
   * ones is not a disagreement.
   */
  it('does not treat a document with no name as a second person', () =>
    expect(mixedNames([slip('a.pdf', 'aaaa1111'), slip('b.pdf'), slip('c.pdf')])).toEqual([]))

  it('never carries a name, only a digest', () => {
    const groups = mixedNames([slip('mine.pdf', 'aaaa1111'), slip('theirs.pdf', 'bbbb2222')])
    // What comes out is file names and opaque keys. There is nowhere for a
    // person's name to appear, because nothing here ever held one.
    for (const group of groups) {
      expect(group.key).toMatch(/^[0-9a-f]+$/)
      expect(group.names.every(name => name.endsWith('.pdf'))).toBe(true)
    }
  })
})
