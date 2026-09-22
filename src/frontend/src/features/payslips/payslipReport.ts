import { aud, employerKey, fields, labels, totals, observations, confirmationIssues, PAYSLIP_VERSION, type Payslip } from './payslip'
import { rateChecks, rateSources, rateText, type RateRecord } from './payRate'
const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/**
 * The rate questions, the rates they were asked against, and — the part that
 * cannot be dropped — the payslips nobody compared and why. A report that
 * listed only findings would let its reader infer that everything else had
 * been verified, which is exactly what Xoba Paycheck is not in a position to say.
 *
 * `scoped` is the payslips inside the report's own filters, confirmed or not.
 * The on-screen panel deliberately looks at the whole session so a filter can
 * never hide a question, but a report is a document someone sends on: one
 * scoped to a single employer must not name another.
 */
function rateSection(scoped: Payslip[], records: RateRecord[]): string {
  const { findings, states } = rateChecks(scoped, records, slip => confirmationIssues(slip, scoped))
  const inScope = (r: RateRecord) => scoped.some(s => employerKey(s.facts.employer) === employerKey(r.employer))
  records = records.filter(inScope)
  const sourceLabel = (r: RateRecord) => rateSources.find(s => s.value === r.source)?.label.toLowerCase() ?? 'a record'
  return `<h2>Pay rate checks</h2><p>These cover the payslips inside this report's filters, and compare each checked one with the rate the user recorded and with the payslip's own hours and rate. The app's own screen checks every payslip in the session, so it may list more than this report does. Xoba Paycheck has no knowledge of awards, classifications, penalty rates or rostering, so nothing here establishes what the user is entitled to be paid. Each item is a question to put to the employer's payroll contact.</p>
<h3>Rates recorded in this session</h3>${records.length ? `<ul>${records.map(r => `<li>${escape(r.employer)}: ${escape(rateText(r))}, from ${escape(r.from)}${r.to ? ` to ${escape(r.to)}` : ' onwards'}, recorded from ${escape(sourceLabel(r))}${r.note.trim() ? ` (${escape(r.note.trim())})` : ''}.</li>`).join('')}</ul>` : '<p>No rate was recorded. Payslips were still compared with their own hours and rate where they stated them.</p>'}
<h3>${findings.length} question(s)</h3>${findings.length ? findings.map(f => `<section><h4>${escape(f.heading)}</h4><p>${escape(f.employer)} · ${escape(f.period)}</p><table>${f.yourRecord ? `<tr><th>Your record</th><td>${escape(f.yourRecord)}</td></tr>` : ''}<tr><th>This payslip</th><td>${escape(f.thePayslip)}</td></tr><tr><th>The difference</th><td>${escape(f.difference)}</td></tr></table><p>${escape(f.limit)}</p><p>${escape(f.question)}</p></section>`).join('') : '<p>Nothing was found in what was compared. This is not a statement that the pay is right; see the list below for what was and was not checked.</p>'}
<h3>What was checked, and what was not</h3><table><tr><th>Payslip</th><th>Compared</th></tr>${states.map(state => `<tr><th>${escape(state.employer || state.name)} · ${escape(state.period)}</th><td>${escape(state.detail)}</td></tr>`).join('')}</table>`
}

export function payslipReport(selected: Payslip[], all: Payslip[], scope: string, records: RateRecord[] = [], scoped: Payslip[] = selected): string {
  const t = totals(selected), pending = all.filter(s => !s.confirmed || confirmationIssues(s, all).length)
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xoba Paycheck pay history</title><style>body{max-width:1000px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#2b2338}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}section{margin:30px 0}@media print{body{font-size:10px}}@media(max-width:650px){table{font-size:11px}td,th{padding:4px}}</style><h1>Xoba Paycheck pay history</h1><p>${escape(scope)}. ${selected.length} confirmed records. ${all.some(s => s.sample) ? 'Fictional example data.' : 'User-supplied records.'}</p><p>Gross ${aud(t.gross)} · Withheld ${aud(t.withheld)} · Other deductions ${aud(t.deductions)} · Net ${aud(t.net)}. Withheld share of gross: ${t.percentage ?? 'unavailable'}${t.percentage === null ? '' : '%'}.</p><p>Super recorded: ${t.superKnown ? aud(t.superCents) : 'unknown'} (${t.superKnown}/${t.count} records supplied an amount). This is not a fund balance or proof of payment.</p><p>These are confirmed period figures only. Missing pays are not inferred and cumulative YTD figures are not added. Confirmation means the user checked data entry, not that tax, wages or employer remittances are correct. No refund forecast, award audit or tax-return lodgment is included. Reader ${PAYSLIP_VERSION}; each record below names the layout that read it.</p><h2>Things to check</h2><ul>${observations(selected).map(n => `<li>${escape(n)}</li>`).join('')}</ul><h2>Confirmed records in selected view</h2>${selected.map(s => `<section><h3>${escape(s.facts.employer)} · ${escape(s.facts.payDate)}</h3><p>Source ${escape(s.name)} · ${s.hash ? 'Page 1 · SHA-256 ' + escape(s.hash) : 'Manual entry; no document attached'} · Layout ${escape(s.format ?? 'manual entry')}</p><table><tr><th>Field</th><th>Original extraction</th><th>Confirmed value</th></tr>${fields.map(k => `<tr><th>${labels[k]}</th><td>${escape(s.original[k]) || 'Not supplied'}</td><td>${escape(s.facts[k]) || 'Unknown'}</td></tr>`).join('')}</table></section>`).join('')}${rateSection(scoped, records)}<h2>Outstanding reviews across the session</h2><p>${pending.length} record(s) excluded from totals. This list is not restricted by the selected filters.</p><ul>${pending.map(s => `<li>${escape(s.name)}: ${escape(confirmationIssues(s, all).join(' ') || 'User confirmation needed.')}</li>`).join('')}</ul><p>Original PDFs and complete extracted text are not embedded. Keep original documents separately. Downloaded reports remain on your device.</p></html>`
}
export function downloadPayReport(html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })), a = document.createElement('a')
  a.href = url; a.download = 'xoba-paycheck-pay-history.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
