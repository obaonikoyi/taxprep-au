import type { Payslip } from './payslip'
import {
  answerLabel,
  TAX_READINESS_REVIEW,
  TAX_READINESS_VERSION,
  taxReadinessQuestions,
  taxReadinessSources,
  type TaxReadinessAnswers,
  type TaxReadinessCoverage,
  type TaxReadinessResult,
} from './taxReadiness'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]!))

export function taxReadinessReport(
  coverage: TaxReadinessCoverage,
  answers: TaxReadinessAnswers,
  result: TaxReadinessResult,
  slips: Payslip[],
) {
  const sources = taxReadinessSources.map(source =>
    `<li><a href="${escape(source.url)}">${escape(source.title)}</a></li>`
  ).join('')

  const rows = taxReadinessQuestions.map(question => {
    const answer = answers[question.key]
    const status = result.needsInformation.some(item => item.key === question.key)
      ? 'Needs information'
      : result.outsideProfile.some(item => item.key === question.key)
        ? 'Outside current supported profile'
        : 'Answered within current profile'
    return `<tr><th>${escape(question.label)}</th><td>${escape(answerLabel(answer))}</td><td>${escape(status)}</td></tr>`
  }).join('')

  const sourceRows = slips.map(slip =>
    `<tr><td>${escape(slip.facts.payDate)}</td><td>${escape(slip.facts.employer)}</td><td>${escape(slip.name)}</td><td>${slip.hash ? 'SHA-256 ' + escape(slip.hash) : 'Manual entry; no document attached'}</td></tr>`
  ).join('')

  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TaxPrep AU tax readiness</title><style>body{max-width:1000px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#173f35}table{width:100%;border-collapse:collapse;margin:16px 0 28px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}.locked{padding:16px;border:1px solid #e3c78d;background:#fff7e6;border-radius:10px}@media print{body{font-size:10px}}@media(max-width:650px){table{font-size:11px}td,th{padding:4px}}</style>
<h1>TaxPrep AU tax readiness</h1>
<p><strong>Financial year:</strong> ${escape(coverage.year)}</p>
<p><strong>Readiness version:</strong> ${escape(TAX_READINESS_VERSION)}</p>
<p><strong>Checked pay records:</strong> ${coverage.checkedSlips.length} across ${coverage.employerCount} employer(s).</p>
<p><strong>Employers:</strong> ${coverage.employerNames.length ? coverage.employerNames.map(escape).join(', ') : 'None recorded'}</p>
<div class="locked"><strong>Tax result locked</strong><p>${escape(TAX_READINESS_REVIEW)}</p><p>This report does not estimate a refund, debt or final tax. Recorded withholding is not final tax.</p></div>
<h2>Profile answers</h2>
<table><thead><tr><th>Question</th><th>Answer</th><th>Readiness status</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Readiness summary</h2>
<ul><li>${result.answered.length} answered within the current narrow prototype.</li><li>${result.needsInformation.length} need more information.</li><li>${result.outsideProfile.length} are outside the current supported profile.</li></ul>
<h2>Checked pay sources</h2>
<table><thead><tr><th>Pay date</th><th>Employer</th><th>Source</th><th>Reference</th></tr></thead><tbody>${sourceRows}</tbody></table>
<h2>Terminology references</h2>
<p>These links inform question wording only. No PAYG schedule or annual-tax rule is activated by this readiness report.</p><ul>${sources}</ul>
<p>Keep original payslips separately. Raw PDFs are not embedded in this report.</p></html>`
}

export function downloadTaxReadinessReport(html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'taxprep-tax-readiness.html'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
