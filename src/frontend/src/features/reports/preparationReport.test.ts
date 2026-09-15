// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createPreparationReport, downloadPreparationReport } from './preparationReport'
import { demoProfile } from '../demo/demoData'
import { sampleExpenses, type ExpenseReviewResult } from '../expenses/expenseReview'

const review: ExpenseReviewResult = {
  items: [
    { category: 'travel', amount: 72.6, workUsePercent: 100, workPortion: 72.6, status: 'needs-attention', actions: ['Find or check the supporting evidence.'] },
    { category: 'phone', amount: 600, workUsePercent: 40, workPortion: 240, status: 'details-recorded', actions: [] },
    { category: 'protective-clothing', amount: 120, workUsePercent: 100, workPortion: 0, status: 'excluded', actions: ['Fully reimbursed: excluded from the work-portion total.'] },
  ], enteredTotal: 792.6, workPortionTotal: 312.6, attentionCount: 1, unresolvedCount: 0,
}
const generatedAt = new Date('2026-09-15T09:30:00Z')
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('exports a dated, self-contained snapshot with all totals, notes and evidence', () => {
  const report = createPreparationReport(sampleExpenses, review, demoProfile, generatedAt)
  const doc = parse(report.html)
  expect(report.filename).toBe('taxprep-au-preparation-2025-26-2026-09-15.html')
  expect(doc.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-15T09:30:00.000Z')
  expect(doc.querySelectorAll('tbody tr')).toHaveLength(3)
  expect([...doc.querySelectorAll('.totals dd')].map(el => el.textContent)).toEqual(['$792.60', '$312.60', '1'])
  for (const expense of sampleExpenses) {
    expect(doc.body.textContent).toContain(expense.purpose)
    expect(doc.body.textContent).toContain(expense.workUseBasis)
    if (expense.evidenceReference) expect(doc.body.textContent).toContain(expense.evidenceReference)
  }
  expect(doc.querySelector('.checklist')?.textContent).toContain('Find or check the supporting evidence.')
  expect(doc.body.textContent).toContain('not a complete tax return')
  expect(doc.querySelectorAll('script, link, img, a, iframe, form')).toHaveLength(0)
  expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')).not.toBeNull()
})

it('preserves unresolved work portions as unknown and labels the subtotal partial', () => {
  const expenses = sampleExpenses.map(e => e.category === 'phone' ? { ...e, reimbursement: 'unsure' as const } : e)
  const partial: ExpenseReviewResult = { ...review, items: review.items.map(item => item.category === 'phone' ? { ...item, workPortion: null, status: 'needs-attention', actions: ['Clarify reimbursement.'] } : item), workPortionTotal: 72.6, unresolvedCount: 1, attentionCount: 2 }
  const doc = parse(createPreparationReport(expenses, partial, demoProfile, generatedAt).html)
  expect(doc.querySelector('.partial')?.textContent).toContain('1 item(s)')
  expect(doc.querySelectorAll('tbody tr')[1].lastElementChild?.textContent).toBe('Unresolved')
  expect(doc.querySelectorAll('.totals dd')[1].textContent).toBe('$72.60')
  expect(doc.querySelectorAll('tbody tr')[2].lastElementChild?.textContent).toBe('$0.00')
})

it('uses supplied per-item rounded cents rather than recalculating work-use amounts', () => {
  const expenses = [sampleExpenses[1], sampleExpenses[0]].map(e => ({ ...e, amount: .05, workUsePercent: 10 }))
  const rounded: ExpenseReviewResult = { items: expenses.map(e => ({ category: e.category, amount: .05, workUsePercent: 10, workPortion: .01, status: 'details-recorded', actions: [] })), enteredTotal: .1, workPortionTotal: .02, attentionCount: 0, unresolvedCount: 0 }
  const doc = parse(createPreparationReport(expenses, rounded, demoProfile, generatedAt).html)
  expect(doc.querySelectorAll('.totals dd')[1].textContent).toBe('$0.02')
  expect([...doc.querySelectorAll('tbody td:last-child')].map(el => el.textContent)).toEqual(['$0.01', '$0.01'])
})

it('escapes markup in every variable text field while retaining Unicode and newlines', () => {
  const unsafe = '<img src="https://example.invalid/x" onerror="alert(1)"> & </style><script>alert(2)</script>\nCafé — 中文 — Ọlọ́run'
  const expenses = sampleExpenses.map(e => ({ ...e, purpose: unsafe, workUseBasis: unsafe, evidenceReference: unsafe }))
  const changed = { ...review, items: review.items.map(item => ({ ...item, actions: [unsafe] })) }
  const doc = parse(createPreparationReport(expenses, changed, { name: unsafe, occupation: unsafe, financialYear: '2025–26' }, generatedAt).html)
  expect(doc.querySelectorAll('script, img')).toHaveLength(0)
  expect(doc.querySelector('.notes dd')?.textContent).toBe(unsafe)
  expect(doc.querySelector('.checklist li')?.textContent).toBe(unsafe)
  expect(doc.querySelector('h1')?.textContent).toContain(unsafe)
})

it.each([
  { ...review, enteredTotal: 1 },
  { ...review, workPortionTotal: 1 },
  { ...review, unresolvedCount: 1 },
  { ...review, attentionCount: 0 },
  { ...review, items: [] },
])('refuses an inconsistent or stale snapshot (%#)', result => {
  expect(() => createPreparationReport(sampleExpenses, result, demoProfile, generatedAt)).toThrow()
})

it('refuses an empty report and does not mutate an earlier exported copy after edits', () => {
  expect(() => createPreparationReport([], { ...review, items: [] }, demoProfile)).toThrow()
  const expenses = structuredClone(sampleExpenses)
  const report = createPreparationReport(expenses, review, demoProfile, generatedAt)
  expenses[1].purpose = 'A later edit'
  expect(report.html).not.toContain('A later edit')
})

it('starts a UTF-8 download and releases its temporary URL after the browser can consume it', () => {
  vi.useFakeTimers()
  const create = vi.fn().mockReturnValue('blob:report')
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('example.html')
    expect(this.href).toBe('blob:report')
    expect(this.isConnected).toBe(true)
  })
  downloadPreparationReport({ filename: 'example.html', html: '<p>Café</p>' })
  expect(create.mock.calls[0][0].type).toBe('text/html;charset=utf-8')
  expect(click).toHaveBeenCalledOnce()
  expect(document.querySelector('a')).toBeNull()
  expect(revoke).not.toHaveBeenCalled()
  vi.advanceTimersByTime(30_000)
  expect(revoke).toHaveBeenCalledWith('blob:report')
})

it('retains escaped source references and distinguishes adjusted totals from original spending', () => {
  const sources = [{ key: 'source-1', fileName: '<script>alert(1)</script>.csv', rowNumber: 4, date: '2025-07-01', description: '<img src=x onerror=alert(1)> Café / 中文', amount: -50.3 }]
  const expenses = sampleExpenses.map(e => e.category === 'phone' ? { ...e, sources } : e)
  const report = createPreparationReport(expenses, review, demoProfile, generatedAt)
  const doc = parse(report.html)
  expect(doc.querySelectorAll('script, img')).toHaveLength(0)
  expect(doc.querySelector('.report-sources')?.textContent).toContain(sources[0].fileName)
  expect(doc.querySelector('.report-sources')?.textContent).toContain(sources[0].description)
  expect(doc.querySelector('.report-sources')?.textContent).toContain('Amount adjusted to $600.00. Original CSV spending remains $50.30.')
  sources[0].description = 'Later changed'
  expect(report.html).not.toContain('Later changed')
})
