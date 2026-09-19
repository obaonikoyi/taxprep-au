import { aud, type Payslip } from './payslip'
import {
  annualSourceStatusLabel,
  annualSourceTypeLabel,
  reconciliationStateLabel,
  YEAR_END_RECONCILIATION_VERSION,
  type AnnualSource,
  type YearEndResult,
} from './yearEndReconciliation'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]!))

const centsOrDash = (value: number | null) => value === null ? 'Not available' : aud(value)
const diff = (value: number | null) => value === null ? 'Not available' : value === 0 ? '$0.00' : `${value > 0 ? '+' : '−'}${aud(Math.abs(value))}`

export function yearEndReport(result: YearEndResult, sources: AnnualSource[], slips: Payslip[]) {
  const sourceRows = sources.map(source => {
    const problems = result.invalidSources.find(item => item.source.id === source.id)?.issues ?? []
    return `<tr><td>${escape(source.payer)}</td><td>${escape(annualSourceTypeLabel(source.type))}</td><td>${escape(source.reference)}</td><td>${escape(annualSourceStatusLabel(source.status))}</td><td>${escape(source.gross)}</td><td>${escape(source.withheld)}</td><td>${source.linkedEmployer ? escape(source.linkedEmployer) : 'Not linked'}</td><td>${problems.length ? escape(problems.join(' ')) : 'Recorded'}</td></tr>`
  }).join('')

  const rows = result.rows.map(row => `<tr><th>${escape(row.employerName)}</th><td>${row.payslipCount}</td><td>${aud(row.payslipGross)}</td><td>${aud(row.payslipWithheld)}</td><td>${row.finalSourceCount}</td><td>${centsOrDash(row.finalGross)}</td><td>${centsOrDash(row.finalWithheld)}</td><td>${diff(row.grossDifference)}</td><td>${diff(row.withheldDifference)}</td><td>${escape(reconciliationStateLabel(row.state))}</td></tr>`).join('')

  const paySources = slips.map(slip => `<tr><td>${escape(slip.facts.payDate)}</td><td>${escape(slip.facts.employer)}</td><td>${escape(slip.name)}</td><td>${slip.hash ? 'SHA-256 ' + escape(slip.hash) : 'Manual entry; no document attached'}</td><td>${escape(slip.facts.gross)}</td><td>${escape(slip.facts.withheld)}</td></tr>`).join('')

  const annualOnly = result.unlinkedFinalSources.length
    ? `<ul>${result.unlinkedFinalSources.map(source => `<li>${escape(source.payer)} · ${escape(source.reference)} · ${escape(source.gross)} gross · ${escape(source.withheld)} withheld</li>`).join('')}</ul>`
    : '<p>None.</p>'

  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TaxPrep AU year-end pay handover</title><style>body{max-width:1200px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#173f35}table{width:100%;border-collapse:collapse;margin:16px 0 28px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}.warning{padding:16px;border:1px solid #e3c78d;background:#fff7e6;border-radius:10px}@media print{body{font-size:9px}}@media(max-width:650px){table{font-size:10px}td,th{padding:4px}}</style>
<h1>TaxPrep AU year-end pay handover</h1>
<p><strong>Financial year:</strong> ${escape(result.year)}<br><strong>Reconciliation version:</strong> ${escape(YEAR_END_RECONCILIATION_VERSION)}</p>
<div class="warning"><strong>Do not add these two source totals together.</strong><p>Payslips and annual income statements/payment summaries are separate evidence views of employment income. This report compares them; it does not count both as extra income or calculate final tax.</p></div>
<p><strong>Checked pay records:</strong> ${result.checkedPayslipCount} across ${result.employerCount} employer(s).<br><strong>User coverage statement:</strong> ${result.coverageConfirmed ? 'User marked all known annual employment sources as added.' : 'Not confirmed; annual source coverage may be incomplete.'}<br><strong>Unresolved reconciliation items:</strong> ${result.unresolvedCount}</p>
<h2>Employer reconciliation</h2>
<table><thead><tr><th>Employer</th><th>Payslips</th><th>Payslip gross</th><th>Payslip withheld</th><th>Final annual sources</th><th>Annual gross</th><th>Annual withheld</th><th>Gross difference</th><th>Withholding difference</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Annual sources entered</h2>
<table><thead><tr><th>Payer</th><th>Type</th><th>Reference</th><th>Status</th><th>Gross</th><th>Withheld</th><th>Linked pay employer key</th><th>Record status</th></tr></thead><tbody>${sourceRows}</tbody></table>
<h2>Final annual sources without linked pay history</h2>${annualOnly}
<h2>Checked payslip sources</h2>
<table><thead><tr><th>Pay date</th><th>Employer</th><th>Source</th><th>Reference</th><th>Gross</th><th>Withheld</th></tr></thead><tbody>${paySources}</tbody></table>
<h2>Limits</h2><p>A mismatch is a review question, not a decision about which source is legally correct. Not-final or unsure annual sources remain provisional. This handover does not establish whole-return completeness, calculate a refund/debt, confirm employer remittances or lodge anything with the ATO. Raw PDFs are not embedded.</p>
</html>`
}

export function downloadYearEndReport(html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'taxprep-year-end-pay-handover.html'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
