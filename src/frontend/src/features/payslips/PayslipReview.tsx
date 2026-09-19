import { fields, labels, confirmationIssues, type Payslip, type PayFacts } from './payslip'
export default function PayslipReview({ slip, all, onChange, onConfirm, onClose, onRemove }: { slip: Payslip; all: Payslip[]; onChange: (facts: PayFacts) => void; onConfirm: () => void; onClose: () => void; onRemove: () => void }) {
  const issues = confirmationIssues(slip, all)
  return <section className="statement-panel pay-review" aria-label="Review payslip"><div className="panel-heading"><div><p className="eyebrow">Check against your payslip</p><h3>{slip.name}</h3></div><button className="text-button" onClick={onClose}>Close review</button></div>
    <p>Enter current-period amounts only. Changing a field removes this record from the charts until you confirm it again. Missing withholding is not zero.</p>
    <form onSubmit={event => { event.preventDefault(); if (!issues.length) onConfirm() }}>
      <div className="pay-fields">{fields.map(key => <label key={key}>{labels[key]}{key === 'super' ? ' (AUD, optional)' : ['gross', 'withheld', 'deductions', 'net'].includes(key) ? ' (AUD)' : ''}<input value={slip.facts[key]} maxLength={key === 'employer' ? 120 : 30} type={key === 'periodStart' || key === 'periodEnd' || key === 'payDate' ? 'date' : 'text'} inputMode={['gross', 'withheld', 'deductions', 'net', 'super'].includes(key) ? 'decimal' : undefined} onChange={event => onChange({ ...slip.facts, [key]: event.target.value })} />{slip.original[key] !== slip.facts[key] && <small>Original: {slip.original[key] || 'not supplied'}</small>}</label>)}</div>
      <p className="chart-note">Other deductions: enter 0 only if there are none. Super: leave blank if unknown. Reimbursements, salary packaging or adjustments may need a different layout; do not change figures just to make them balance.</p>
      {issues.length > 0 && <div className="pay-checks"><strong>Before confirming</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      <div className="pay-actions"><button className="primary-button" disabled={issues.length > 0 || slip.confirmed} type="submit">{slip.confirmed ? 'Figures confirmed' : 'Confirm these figures'}</button><button className="text-button" type="button" onClick={onRemove}>Remove this payslip</button></div>
    </form>
    <details className="statement-help"><summary>Original extracted text and source</summary><p>{slip.hash ? `Page 1 · File SHA-256 ${slip.hash}` : 'Manual entry; no source document attached.'}</p><pre>{slip.text || 'Check these figures against your own original payslip.'}</pre></details>
  </section>
}
