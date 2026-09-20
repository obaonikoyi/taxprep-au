import { aud } from './payslip'
import { annualFinalStatusLabel, annualSourceTypeLabel, coverageAnswerLabel, reconciliationStateLabel } from './yearEndReconciliation'
import { bankCheckStatusLabel, coverageStatusLabel, type YearEndPreparationResult } from './yearEndPreparation'
import { handoffLabel, handoffSummaryLines } from '../handoff/yearEndHandoff'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!))

const amount = (value: number | null) => value === null ? 'Not available' : aud(value)
const signed = (value: number | null) => value === null ? 'Not available' : `${value > 0 ? '+' : ''}${aud(value)}`

export function yearEndPreparationReport(result: YearEndPreparationResult) {
  const r = result.reconciliation

  const incomeRows = r.rows.map(row => `<tr><th>${escape(row.label)}</th><td>${row.payCount}</td><td>${aud(row.payGross)}</td><td>${aud(row.payWithheld)}</td><td>${row.finalSourceCount}</td><td>${amount(row.annualGross)}</td><td>${amount(row.annualWithheld)}</td><td>${escape(reconciliationStateLabel(row.state))}</td></tr>`).join('')

  const annualRows = r.sourceRows.map(({ source, issues, finalIncluded, provisional }) => `<tr>
<td>${escape(source.payer || 'Unnamed')}</td><td>${escape(annualSourceTypeLabel(source.sourceType))}</td><td>${escape(source.reference || 'Not supplied')}</td><td>${escape(annualFinalStatusLabel(source.finalStatus, source.sourceType))}</td><td>${escape(source.gross || 'Not supplied')}</td><td>${escape(source.withheld || 'Not supplied')}</td><td>${escape(source.documentHash ? 'SHA-256 ' + source.documentHash : source.origin === 'manual' ? 'Manual entry' : 'No document hash')}</td><td>${finalIncluded ? 'Included as final' : provisional ? 'Provisional — excluded from final totals' : 'Excluded — ' + escape(issues.join(' ') || 'needs review')}</td>
</tr>`).join('')

  const paySources = r.checkedSlips.map(slip => `<tr><td>${escape(slip.facts.payDate)}</td><td>${escape(slip.facts.employer)}</td><td>${escape(slip.name)}</td><td>${slip.hash ? 'SHA-256 ' + escape(slip.hash) : 'Manual entry'}</td><td>${escape(slip.facts.net || 'Not supplied')}</td></tr>`).join('')

  const bankRows = result.bankRows.map(row => `<tr><th>${escape(row.employerName)}</th><td>${row.payslipCount}</td><td>${amount(row.checkedNet)}</td><td>${escape(bankCheckStatusLabel(row.status))}</td><td>${amount(row.depositTotal)}</td><td>${signed(row.difference)}</td><td>${escape(row.note || 'No note')}</td></tr>`).join('')

  const e = result.expenses
  const expenseRows = [
    ['Bank spending review', coverageStatusLabel(e.bankSpending)],
    ['Receipt/evidence review', coverageStatusLabel(e.receiptEvidence)],
    ['Work-purpose answers', coverageStatusLabel(e.workPurpose)],
    ['Applicable supported-rule review', coverageStatusLabel(e.ruleReview)],
    ['Reviewed transactions', e.reviewedTransactions || 'Not recorded'],
    ['Transactions flagged for work review', e.workReviewTransactions || 'Not recorded'],
    ['Receipts/evidence items', e.receiptCount || 'Not recorded'],
    ['Work-purpose answers recorded', e.workPurposeCount || 'Not recorded'],
    ['Amount flagged for work review', e.flaggedWorkAmountValue === null ? 'Not recorded' : aud(e.flaggedWorkAmountValue)],
    ['Preparation note', e.note || 'No note'],
  ].map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join('')

  const questions = result.questions.length
    ? result.questions.map(question => `<li>${escape(question)}</li>`).join('')
    : '<li>No open questions are recorded in this preparation pass. This is not proof that the return is complete or correct.</li>'

  const handoffRows = result.handoffs.map(handoff => `<article><h3>${escape(handoffLabel(handoff))}</h3><p><strong>Financial year:</strong> ${escape(handoff.financialYear)}<br><strong>Handoff ID:</strong> ${escape(handoff.handoffId)}<br><strong>Generated:</strong> ${escape(handoff.generatedAt)}</p><ul>${handoffSummaryLines(handoff).map(line => `<li>${escape(line)}</li>`).join('')}</ul><p><strong>Source SHA-256 references:</strong><br>${handoff.sourceHashes.map(hash => escape(hash)).join('<br>')}</p></article>`).join('')

  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TaxPrep AU year-end preparation handover</title><style>body{max-width:1120px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#173f35}table{width:100%;border-collapse:collapse;margin:14px 0 28px;table-layout:fixed}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}.notice,.question{padding:16px;border:1px solid #dccb9d;background:#fff8e9;border-radius:10px}.question{border-color:#e1d8c3;background:#fffdf8}@media(max-width:700px){table{font-size:10px}th,td{padding:4px}}@media print{body{font-size:9px}}</style>
<h1>TaxPrep AU year-end preparation handover</h1>
<p><strong>Financial year:</strong> ${escape(result.year)}<br><strong>Preparation version:</strong> ${escape(result.version)}<br><strong>Pay reconciliation version:</strong> ${escape(r.version)}<br><strong>Storage:</strong> Session by default. TaxPrep does not automatically save this workspace.</p>
<div class="notice"><strong>Important boundaries</strong><p>Payslips and annual income statements are two views of the same employment income and are not added together. Bank deposits are used only as a completeness/review check against checked net pay; they do not establish gross income, withholding or taxable income. Amounts flagged for work review are not approved deductions.</p><p>Tax/refund/final-tax results remain locked.</p></div>

<h2>Preparation coverage</h2>
<table><tbody><tr><th>Annual employment-source coverage statement</th><td>${escape(coverageAnswerLabel(r.coverageAnswer))}</td></tr><tr><th>Employment reconciliation questions</th><td>${result.incomeOpenQuestions}</td></tr><tr><th>Bank checks reviewed</th><td>${result.bankReviewed} of ${result.bankEmployers} employers</td></tr><tr><th>Expense/evidence areas answered</th><td>${result.expenseAreasAnswered} of ${result.expenseAreas}</td></tr></tbody></table>

<h2>Employment income reconciliation</h2>
<table><thead><tr><th>Employer / source</th><th>Payslips</th><th>Payslip gross</th><th>Payslip withholding</th><th>Final annual sources</th><th>Annual gross</th><th>Annual withholding</th><th>Status</th></tr></thead><tbody>${incomeRows}</tbody></table>

<h2>Annual employment sources</h2>
<table><thead><tr><th>Payer</th><th>Type</th><th>Reference</th><th>Status</th><th>Gross</th><th>Withheld</th><th>Source reference</th><th>Use</th></tr></thead><tbody>${annualRows || '<tr><td colspan="8">No annual sources recorded.</td></tr>'}</tbody></table>

<h2>Checked payslip sources</h2>
<table><thead><tr><th>Pay date</th><th>Employer</th><th>Source</th><th>Reference</th><th>Net pay</th></tr></thead><tbody>${paySources}</tbody></table>

<h2>Optional bank-deposit checks</h2>
<p>These checks compare bank deposits with checked payslip <strong>net pay only</strong>. Differences stay as questions and never replace payroll or annual-source figures.</p>
<table><thead><tr><th>Employer</th><th>Payslips</th><th>Checked net pay</th><th>Status</th><th>Deposit total</th><th>Difference</th><th>Note</th></tr></thead><tbody>${bankRows}</tbody></table>

<h2>Expense and evidence coverage</h2>
<table><tbody>${expenseRows}</tbody></table>
<p><strong>Candidate work-review amount is not a deduction.</strong> It is only a user-entered total of spending/evidence they want reviewed.</p>

<div class="question"><h2>Open questions and unsupported sections</h2><ul>${questions}</ul></div>

<h2>Imported workspace handoffs</h2>
<p>These summaries were explicitly imported and applied by the user. They contain bounded coverage metadata and source hashes, not raw transaction descriptions or OCR text.</p>
${handoffRows || '<p>No workspace handoffs were applied in this preparation pass.</p>'}

<h2>Save/resume boundary</h2>
<p>TaxPrep does not automatically save this sensitive year-end workspace to browser storage or the TaxPrep API. The optional encrypted local backup is created only when the user explicitly downloads it and remains under the user's control. It contains preparation answers and applied summary handoffs, not raw financial documents or transactions. TaxPrep does not store or recover the backup passphrase.</p>
<p>Account-based cloud save/resume remains a separate future decision requiring storage, retention, deletion, backup and account-recovery rules.</p>
</html>`
}

export function downloadYearEndPreparationReport(html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'taxprep-year-end-preparation-handover.html'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
