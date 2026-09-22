import { labels, confirmationIssues, optionalFields, type Payslip, type PayFacts, type PayField } from './payslip'
import { formatLabel } from './payslipFormats'

const groups: { title: string; fields: PayField[] }[] = [
  { title: 'Employer and dates', fields: ['employer', 'periodStart', 'periodEnd', 'payDate'] },
  { title: 'Amounts for this pay period', fields: ['gross', 'withheld', 'deductions', 'net', 'super'] },
  // Optional throughout. Each one a payslip states is one more thing the rate
  // checks can compare; each one it omits simply withholds a check.
  { title: 'Ordinary hours and rate', fields: ['hours', 'rate', 'ordinary'] },
]
const help: Record<PayField, string> = {
  employer: 'The employer named on this payslip.', periodStart: 'First day covered by this payslip.', periodEnd: 'Last day covered by this payslip.', payDate: 'The date this payment was made.',
  gross: 'Your pay before tax and other deductions.', withheld: 'May be called PAYG or income tax.', deductions: 'Other amounts taken out. Enter 0 if there are none.', net: 'The amount paid to you after deductions.', super: 'Optional. Leave blank if it is not shown.',
  hours: 'Optional. Ordinary hours only — leave out overtime and penalty hours.',
  rate: 'Optional. The ordinary hourly rate shown on the payslip.',
  ordinary: 'Optional. The amount paid for those ordinary hours, before any overtime or allowances.',
}
export default function PayslipReview({ slip, all, onChange, onConfirm, onClose, onRemove }: { slip: Payslip; all: Payslip[]; onChange: (facts: PayFacts) => void; onConfirm: () => void; onClose: () => void; onRemove: () => void }) {
  const issues = confirmationIssues(slip, all)
  return <section className="statement-panel pay-review" aria-label="Review payslip">
    <div className="panel-heading"><div><p className="eyebrow">{slip.hash ? 'Read from your PDF' : 'Enter from your payslip'}</p><h3>{slip.facts.employer || 'New payslip'}</h3><p className="pay-source-name">{slip.name}{formatLabel(slip.format) ? <> · read as <strong>{formatLabel(slip.format)}</strong></> : null}</p></div><button className="text-button" onClick={onClose}>Close review</button></div>
    <p className="pay-review-tip">Use the amounts for <strong>this pay period</strong>, not the year-to-date (YTD) totals.</p>
    <p className="pay-review-tip">Hours and rate are optional. Filling them in lets Xoba Paycheck compare this payslip with the rate you agreed to, and with its own arithmetic.</p>
    {slip.hash && <details className="statement-help pay-source"><summary>Compare with text from your PDF</summary><pre>{slip.text}</pre><details><summary>File reference</summary><p>Page 1 · SHA-256 {slip.hash}</p></details></details>}
    <form onSubmit={event => { event.preventDefault(); if (!issues.length) onConfirm() }}>
      {groups.map(group => <fieldset key={group.title}><legend>{group.title}</legend><div className="pay-fields">{group.fields.map(key => {
        const monetary = ['gross', 'withheld', 'deductions', 'net', 'super', 'rate', 'ordinary'].includes(key)
        const optional = (optionalFields as readonly PayField[]).includes(key)
        const label = labels[key] + (monetary ? optional ? ' (AUD, optional)' : ' (AUD)' : key === 'hours' ? ' (optional)' : '')
        return <div className={`pay-field pay-field-${key}`} key={key}>
          <label htmlFor={`pay-${key}`}>{label}</label>
          <input id={`pay-${key}`} aria-describedby={`pay-help-${key}`} value={slip.facts[key]} maxLength={key === 'employer' ? 120 : 30} type={['periodStart', 'periodEnd', 'payDate'].includes(key) ? 'date' : 'text'} inputMode={monetary || key === 'hours' ? 'decimal' : undefined} onChange={event => onChange({ ...slip.facts, [key]: event.target.value })} />
          <small id={`pay-help-${key}`}>{help[key]}</small>
          {slip.hash && slip.original[key] !== slip.facts[key] && <small className="pay-original">Read from PDF: {slip.original[key] || 'not shown'}</small>}
        </div>
      })}</div></fieldset>)}
      {issues.length > 0 && <details className="pay-checks" open={!!slip.hash}><summary>{issues.length} thing{issues.length === 1 ? '' : 's'} to check before continuing</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      <div className="pay-confirm-row"><button className="primary-button" disabled={issues.length > 0 || slip.confirmed} type="submit">{slip.confirmed ? 'Figures confirmed' : 'Confirm and continue'}</button><p>{slip.confirmed ? 'Editing a figure will remove this payslip from totals until you confirm it again.' : issues.length ? 'Complete the required figures above to continue.' : 'By continuing, you confirm these match your payslip.'}</p></div>
      <details className="statement-help"><summary>My figures don’t add up — what should I do?</summary><p>Check that you used current-period amounts and included other deductions. Salary packaging, reimbursements or adjustments may need a different pay layout. Keep the true figures; don’t change them just to make the check pass.</p></details>
      <button className="text-button pay-clear" type="button" onClick={onRemove}>Remove this payslip</button>
    </form>
  </section>
}
