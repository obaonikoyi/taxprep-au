import { confirmationIssues, type Payslip } from './payslip'

export default function PayslipHistory({ slips, selected, onSelect }: { slips: Payslip[]; selected: string | null; onSelect: (id: string) => void }) {
  return <aside className="pay-history" aria-label="Your payslips">
    <h3>Your payslips <span>{slips.length}</span></h3><p>Choose one to view or change.</p>
    <ul>{slips.map(s => {
      const checked = s.confirmed && !confirmationIssues(s, slips).length
      return <li key={s.id}><button aria-label={`Review ${s.name} ${s.facts.payDate}`} aria-pressed={selected === s.id} onClick={() => onSelect(s.id)}>
        <strong>{s.facts.employer || 'New payslip'}</strong>
        <span>{s.facts.payDate ? new Date(s.facts.payDate + 'T00:00:00Z').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Add the pay date'}</span>
        <small>{s.name}</small><span className={`pay-badge ${checked ? 'confirmed' : ''}`}>{checked ? 'Checked' : 'To check'}</span>
      </button></li>
    })}</ul>
  </aside>
}
