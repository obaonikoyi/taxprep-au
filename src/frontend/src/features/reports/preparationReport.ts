import { categoryLabels, categories, currency, evidenceLabels, reimbursementLabels, isExpenseReview, type Expense, type ExpenseReviewResult } from '../expenses/expenseReview'
import type { DemoProfile } from '../demo/demoData'
import reportStyles from './report.css?raw'
import { sourceTotal, type ExpenseSource } from '../transactions/expenseImport'

export interface PreparationReport { html: string; filename: string }

// Every variable text value passes through this boundary. The downloaded file contains no scripts.
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const text = (value: string) => escapeHtml(value.trim() || 'Not recorded')
const money = (value: number) => currency.format(value)
const statusLabels = { excluded: 'Excluded from total', 'needs-attention': 'Needs attention', 'details-recorded': 'Details recorded' }

function sourceRows(sources: ExpenseSource[] | undefined, amount: number): string {
  if (!sources?.length) return ''
  const total = sourceTotal(sources)
  return `<div class="report-sources"><table><caption>Original CSV spending: ${money(total)} (${sources.length} rows)</caption><thead><tr><th scope="col">Source and date</th><th scope="col">Description</th><th scope="col">CSV amount</th></tr></thead><tbody>${sources.map(row => `<tr><th scope="row">${text(row.fileName)}<small>Row ${row.rowNumber} | ${text(row.date)}</small></th><td>${text(row.description)}</td><td>${money(row.amount)}</td></tr>`).join('')}</tbody></table>
  ${Math.round(total * 100) !== Math.round(amount * 100) ? `<p class="help">Amount adjusted to ${money(amount)}. Original CSV spending remains ${money(total)}.</p>` : ''}
  <p class="help">Source rows are references, not receipts or proof of work use. These rows share the recorded percentage and reimbursement status.</p></div>`
}

export function createPreparationReport(expenses: Expense[], review: ExpenseReviewResult,
  profile: Pick<DemoProfile, 'name' | 'occupation' | 'financialYear'>, generatedAt = new Date()): PreparationReport {
  if (!expenses.length || !isExpenseReview(review, expenses)) throw new Error('A current expense review is required to export.')
  // Reconcile the supplied rounded values; do not recalculate tax or work-use amounts in the exporter.
  const cents = (value: number) => Math.round(value * 100)
  if (cents(review.enteredTotal) !== review.items.reduce((sum, item) => sum + cents(item.amount), 0)
    || cents(review.workPortionTotal) !== review.items.reduce((sum, item) => sum + cents(item.workPortion ?? 0), 0)
    || review.unresolvedCount !== review.items.filter(item => item.workPortion === null).length
    || review.attentionCount !== review.items.filter(item => item.status === 'needs-attention').length)
    throw new Error('The review totals do not match its items. Refresh the review before exporting.')

  const year = profile.financialYear.replace(/[–—]/g, '-')
  const timestamp = generatedAt.toISOString()
  const displayedTime = new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(generatedAt) + ' UTC'
  const rows = categories.flatMap(category => {
    const item = review.items.find(entry => entry.category === category)
    const expense = expenses.find(entry => entry.category === category)
    return item && expense ? [{ item, expense }] : []
  })
  const workLabel = review.unresolvedCount > 0 ? 'Known work portions (partial total)' : 'Recorded work portions'
  const nextActions = rows.filter(({ item }) => item.status === 'needs-attention')
  const html = `<!doctype html>
<html lang="en-AU" data-report="taxprep-expenses-v1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>TaxPrep AU - ${text(profile.name)} - Preparation report ${text(year)}</title>
<style>${reportStyles}</style>
</head>
<body><main>
<header class="report-header"><span class="brand">TaxPrep AU</span><span class="badge">Fictional data</span></header>
<p class="eyebrow">Expense preparation report</p>
<h1>${text(profile.name)}'s expense summary</h1>
<p class="profile">${text(profile.occupation)} <span aria-hidden="true">|</span> Financial year ${text(year)}</p>
<p class="generated">Generated <time datetime="${timestamp}">${text(displayedTime)}</time></p>
<aside class="notice"><strong>Preparation only.</strong> This report organises entered expenses. Work portions are not approved deductions or refund estimates. No return has been lodged.</aside>
<p class="screen-only print-help">This file works offline. Use your browser's Print command to print it or save a PDF where supported.</p>
<section aria-labelledby="totals-title"><h2 id="totals-title">At a glance</h2>
<dl class="totals"><div><dt>Amount entered</dt><dd>${money(review.enteredTotal)}</dd></div><div><dt>${workLabel}</dt><dd>${money(review.workPortionTotal)}</dd></div><div><dt>Items needing attention</dt><dd>${review.attentionCount}</dd></div></dl>
${review.unresolvedCount > 0 ? `<p class="partial"><strong>Partial total:</strong> ${review.unresolvedCount} item(s) have an unresolved reimbursement and are not included. Their work portions are shown as Unresolved, not $0.</p>` : ''}
<p class="help">Work portions include items with missing evidence. Fully reimbursed and 0%-work items contribute $0. Every item still needs a tax eligibility check.</p>
<div class="table-wrap"><table><caption>Recorded expenses - all amounts in AUD</caption><thead><tr><th scope="col">Category</th><th scope="col">Amount</th><th scope="col">Work use</th><th scope="col">Work portion</th></tr></thead><tbody>
${rows.map(({ item }) => `<tr><th scope="row">${categoryLabels[item.category]}<small>${statusLabels[item.status]}</small></th><td>${money(item.amount)}</td><td>${item.workUsePercent}%</td><td>${item.workPortion === null ? '<strong>Unresolved</strong>' : money(item.workPortion)}</td></tr>`).join('')}
</tbody></table></div></section>
<section class="checklist" aria-labelledby="checklist-title"><h2 id="checklist-title">Evidence and next actions</h2>
${nextActions.length ? nextActions.map(({ item }) => `<div class="checklist-group"><h3>${categoryLabels[item.category]}</h3><ul>${item.actions.map(action => `<li>${text(action)}</li>`).join('')}</ul></div>`).join('') : '<p>No missing details were flagged in the recorded items. Their tax eligibility still needs review.</p>'}
<p class="help">Keep the referenced records and check the work-use basis before using any amount in myTax. An evidence reference is a reminder; no receipt files are attached to this report.</p>
</section>
<section class="expense-details" aria-labelledby="details-title"><h2 id="details-title">Expense details and evidence references</h2>
${rows.map(({ item, expense }) => `<article class="expense${expense.sources?.length ? ' has-sources' : ''}"><div class="expense-heading"><h3>${categoryLabels[item.category]}</h3><span class="status">${statusLabels[item.status]}</span></div>
<p class="amount-line">${money(item.amount)} entered | ${item.workUsePercent}% work use | <strong>${item.workPortion === null ? 'Work portion unresolved' : money(item.workPortion) + ' recorded work portion'}</strong></p>
<dl class="notes"><div><dt>Work purpose</dt><dd>${text(expense.purpose)}</dd></div><div><dt>Percentage basis</dt><dd>${text(expense.workUseBasis)}</dd></div><div><dt>Reimbursement</dt><dd>${reimbursementLabels[expense.reimbursement]}</dd></div><div><dt>Evidence status</dt><dd>${evidenceLabels[expense.evidence]}</dd></div><div><dt>Evidence reference</dt><dd>${text(expense.evidenceReference)}</dd></div></dl>
${item.actions.length ? `<ul class="item-actions">${item.actions.map(action => `<li>${text(action)}</li>`).join('')}</ul>` : ''}${sourceRows(expense.sources, expense.amount)}</article>`).join('')}
</section>
<footer><strong>About this copy</strong><p>This is a snapshot of ${rows.length} recorded expense(s) in Sarah's fictional demo. Only CSV rows saved into an expense are included. Skipped categories and unselected preview rows are not included. It is not a complete tax return.</p><p>Later edits or restarting the app do not update or remove this downloaded file. TaxPrep AU is independent of the Australian Taxation Office.</p><p class="version">Report format v1 | ${text(year)} | ${text(displayedTime)}</p></footer>
</main></body></html>`
  return { html, filename: `taxprep-au-preparation-${year.replace(/[^0-9-]/g, '')}-${timestamp.slice(0, 10)}.html` }
}

export function downloadPreparationReport(report: PreparationReport) {
  const url = URL.createObjectURL(new Blob([report.html], { type: 'text/html;charset=utf-8' }))
  const anchor = document.createElement('a')
  try {
    anchor.href = url; anchor.download = report.filename
    document.body.append(anchor); anchor.click()
  } finally {
    anchor.remove()
    // Allow the browser time to consume the URL, including when it opens a mobile download sheet.
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}
