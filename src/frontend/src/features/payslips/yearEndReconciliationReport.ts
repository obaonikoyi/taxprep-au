import { aud } from './payslip'
import {
  annualFinalStatusLabel,
  annualSourceGuidance,
  annualSourceTypeLabel,
  ANNUAL_SOURCE_GUIDANCE_VERSION,
  coverageAnswerLabel,
  reconciliationStateLabel,
  type YearEndReconciliation,
} from './yearEndReconciliation'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!))

const amount = (value: number | null) => value === null ? 'Not available' : aud(value)
const difference = (value: number | null) => value === null ? 'Not available' : `${value > 0 ? '+' : ''}${aud(value)}`

export function yearEndReconciliationReport(result: YearEndReconciliation) {
  const sourceRows = result.sourceRows.map(({ source, issues, finalIncluded, provisional }) => `<tr>
<td>${escape(source.payer || 'Unnamed')}</td>
<td>${escape(annualSourceTypeLabel(source.sourceType))}</td>
<td>${escape(source.reference || 'Not supplied')}</td>
<td>${escape(annualFinalStatusLabel(source.finalStatus, source.sourceType))}</td>
<td>${escape(source.linkedEmployer ? result.employerNames.find(([key]) => key === source.linkedEmployer)?.[1] ?? source.linkedEmployer : 'Not linked')}</td>
<td>${escape(source.gross || 'Not supplied')}</td>
<td>${escape(source.withheld || 'Not supplied')}</td>
<td>${finalIncluded ? 'Included as final' : provisional ? 'Provisional — excluded from final totals' : `Excluded — ${escape(issues.join(' ') || 'needs review')}`}</td>
</tr>`).join('')

  const reconciliationRows = result.rows.map(row => `<tr>
<th>${escape(row.label)}</th>
<td>${row.payCount}</td>
<td>${aud(row.payGross)}</td>
<td>${aud(row.payWithheld)}</td>
<td>${row.finalSourceCount}</td>
<td>${amount(row.annualGross)}</td>
<td>${amount(row.annualWithheld)}</td>
<td>${difference(row.grossDifference)}</td>
<td>${difference(row.withheldDifference)}</td>
<td>${escape(reconciliationStateLabel(row.state))}</td>
</tr>`).join('')

  const paySources = result.checkedSlips.map(slip => `<tr>
<td>${escape(slip.facts.payDate)}</td><td>${escape(slip.facts.employer)}</td><td>${escape(slip.name)}</td><td>${slip.hash ? 'SHA-256 ' + escape(slip.hash) : 'Manual entry; no document attached'}</td><td>${escape(slip.facts.gross)}</td><td>${escape(slip.facts.withheld)}</td>
</tr>`).join('')

  const questions = result.questions.length ? result.questions.map(question => `<li>${escape(question)}</li>`).join('') : '<li>No reconciliation questions remain from the recorded sources. This is not proof that the tax return is complete.</li>'
  const guidance = annualSourceGuidance.map(source => `<li><a href="${escape(source.url)}">${escape(source.title)}</a></li>`).join('')

  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TaxPrep AU year-end pay handover</title><style>body{max-width:1100px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#173f35}table{width:100%;border-collapse:collapse;margin:16px 0 30px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}.notice{padding:16px;border:1px solid #dccb9d;background:#fff8e9;border-radius:10px}.question{padding:16px;border:1px solid #e1d8c3;background:#fffdf8;border-radius:10px}@media print{body{font-size:9px}}@media(max-width:700px){table{font-size:10px}td,th{padding:4px}}</style>
<h1>TaxPrep AU year-end pay handover</h1>
<p><strong>Financial year:</strong> ${escape(result.year)}<br><strong>Reconciliation version:</strong> ${escape(result.version)}<br><strong>ATO terminology reference version:</strong> ${escape(ANNUAL_SOURCE_GUIDANCE_VERSION)}</p>
<div class="notice"><strong>Two views of the same employment income — do not add them together.</strong><p>Checked payslips show period-by-period pay history. Final annual income statements/payment summaries show annual employment totals. TaxPrep compares them; it does not add both sets as separate income.</p><p>Tax/refund results remain locked. A mismatch is a review question, not a decision about which source is legally correct.</p></div>
<p><strong>User annual-source coverage statement:</strong> ${escape(coverageAnswerLabel(result.coverageAnswer))}. This is a user statement, not proof of return completeness.</p>
<h2>Employer reconciliation</h2>
<table><thead><tr><th>Employer / source</th><th>Payslips</th><th>Payslip gross</th><th>Payslip withholding</th><th>Final annual sources</th><th>Final annual gross</th><th>Final annual withholding</th><th>Gross difference</th><th>Withholding difference</th><th>Status</th></tr></thead><tbody>${reconciliationRows}</tbody></table>
<h2>Annual employment sources</h2>
<table><thead><tr><th>Payer</th><th>Type</th><th>Reference</th><th>Final status</th><th>Linked pay-history employer</th><th>Gross</th><th>Withheld</th><th>Use in reconciliation</th></tr></thead><tbody>${sourceRows || '<tr><td colspan="8">No annual sources entered.</td></tr>'}</tbody></table>
<h2>Checked payslip sources</h2>
<table><thead><tr><th>Pay date</th><th>Employer</th><th>Source</th><th>Reference</th><th>Gross</th><th>Withheld</th></tr></thead><tbody>${paySources || '<tr><td colspan="6">No checked payslips in this financial year.</td></tr>'}</tbody></table>
<div class="question"><h2>Questions to review</h2><ul>${questions}</ul></div>
<h2>ATO terminology references</h2><p>These references support status wording such as Tax ready/finalised and the fact that one employer can have multiple income statements. They do not unlock a tax calculation.</p><ul>${guidance}</ul>
<p>Raw payslip or annual-statement files are not embedded. Keep originals separately. No TFN is requested in this workflow.</p>
</html>`
}

export function downloadYearEndReconciliationReport(html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })), link = document.createElement('a')
  link.href = url
  link.download = 'taxprep-year-end-pay-handover.html'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
