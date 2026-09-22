import { aud, type Payslip } from './payslip'
import { frequencyLabel, type PayOutlookResult } from './payOutlook'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))

export function payOutlookReport(result: PayOutlookResult, slips: Payslip[]) {
  const coverage = result.historyComplete
    ? 'The user marked the recorded history as complete for this employer and financial year only.'
    : 'Partial recorded history: the user did not confirm that every earlier payslip for this employer and financial year is included.'

  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xoba Paycheck pay outlook</title><style>body{max-width:1000px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#173f35}table{width:100%;border-collapse:collapse;margin:16px 0 28px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}section{margin:30px 0}small{color:#52685e}@media print{body{font-size:10px}}@media(max-width:650px){table{font-size:11px}td,th{padding:4px}}</style>
<h1>Xoba Paycheck pay outlook</h1>
<p><strong>${escape(result.employer)}</strong> · ${escape(result.financialYear)} · ${escape(frequencyLabel(result.frequency))}</p>
<p>${escape(coverage)}</p>
<p>This is a one-employer pay scenario, not whole-person income, final tax, a refund estimate or a payroll compliance check. Changed-gross scenarios do not estimate future withholding.</p>
<section><h2>Inputs and recorded amounts</h2><table>
<tr><th>Item</th><th>Value</th></tr>
<tr><th>Arithmetic version</th><td>${escape(result.version)}</td></tr>
<tr><th>Checked payslips recorded</th><td>${result.recordedCount}</td></tr>
<tr><th>Latest checked payday</th><td>${escape(result.latestRecordedPayDate)}</td></tr>
<tr><th>Recorded gross pay</th><td>${aud(result.recordedGross)}</td></tr>
<tr><th>Recorded withholding</th><td>${aud(result.recordedWithheld)}</td></tr>
<tr><th>Next payday entered</th><td>${escape(result.nextPayDate)}</td></tr>
<tr><th>Regular gross per future pay</th><td>${aud(result.normalGross)}</td></tr>
<tr><th>Regular withholding per future pay</th><td>${aud(result.normalWithheld)}</td></tr>
<tr><th>Future pattern confirmation</th><td>Confirmed as regular rather than a bonus, back pay or adjustment</td></tr>
</table></section>
<section><h2>Future pay dates through 30 June</h2><p>${result.futurePayDates.length} assumed future payday(s).</p><ol>${result.futurePayDates.map(date => `<li>${escape(date)}</li>`).join('')}</ol></section>
<section><h2>Gross-pay scenarios</h2><table><thead><tr><th>Scenario</th><th>Recorded gross</th><th>Assumed future gross</th><th>Combined employer gross</th><th>Recorded withholding</th><th>Assumed future withholding</th></tr></thead><tbody>
${result.scenarios.map(scenario => `<tr><th>${escape(scenario.label)}</th><td>${aud(result.recordedGross)}</td><td>${aud(scenario.futureGross)}</td><td>${aud(scenario.combinedGross)}</td><td>${aud(result.recordedWithheld)}</td><td>${scenario.futureWithheld === null ? 'Not estimated' : aud(scenario.futureWithheld)}</td></tr>`).join('')}
</tbody></table><p>Only the entered pay pattern carries forward the entered withholding amount. Xoba Paycheck does not scale withholding up or down for the ±20% gross scenarios and does not treat withholding as final tax.</p></section>
<section><h2>Recorded sources</h2><table><thead><tr><th>Pay date</th><th>Source</th><th>Reference</th><th>Gross</th><th>Withheld</th></tr></thead><tbody>
${slips.map(slip => `<tr><td>${escape(slip.facts.payDate)}</td><td>${escape(slip.name)}</td><td>${slip.hash ? 'SHA-256 ' + escape(slip.hash) : 'Manual entry; no document attached'}</td><td>${escape(slip.facts.gross)}</td><td>${escape(slip.facts.withheld)}</td></tr>`).join('')}
</tbody></table></section>
<p>Keep original payslips separately. This report contains arithmetic assumptions and source references only. It does not approve tax treatment or unlock a personalised tax calculation.</p></html>`
}

export function downloadPayOutlookReport(html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })), link = document.createElement('a')
  link.href = url
  link.download = 'xoba-paycheck-pay-outlook.html'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
