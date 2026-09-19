import { aud, observations, totals, type Payslip } from './payslip'
import PayslipCharts from './PayslipCharts'

type Props = {
  slips: Payslip[]; years: string[]; employers: [string, string][]; year: string; employer: string; grouping: 'month' | 'payday';
  onYear: (value: string) => void; onEmployer: (value: string) => void; onGrouping: (value: 'month' | 'payday') => void; onResetFilters: () => void;
}
export default function PayslipSummary({ slips, years, employers, year, employer, grouping, onYear, onEmployer, onGrouping, onResetFilters }: Props) {
  const t = totals(slips), notes = observations(slips)
  return <>
    <div className="pay-filter-row"><strong>{slips.length} checked payslip{slips.length === 1 ? '' : 's'} in this view</strong><div className="pay-filters">
      <label>Financial year<select aria-label="Financial year" value={year} onChange={e => onYear(e.target.value)}><option value="all">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
      <label>Employer<select aria-label="Employer" value={employer} onChange={e => onEmployer(e.target.value)}><option value="all">All employers</option>{employers.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    </div></div>
    {slips.length === 0 ? <div className="statement-panel pay-empty"><h3>No checked payslips to show</h3><p>Check your payslip figures first. If you already have, try showing all years and employers.</p>{(year !== 'all' || employer !== 'all') && <button className="secondary-button" onClick={onResetFilters}>Show all payslips</button>}</div> : <>
      <div className="statement-metrics pay-metrics" aria-label="Confirmed pay totals">
        <div><span>Pay before deductions</span><strong>{aud(t.gross)}</strong><small>Called “gross pay” on your payslip</small></div>
        <div><span>Take-home pay</span><strong>{aud(t.net)}</strong><small>What you were paid after deductions</small></div>
        <div><span>Tax taken out</span><strong>{aud(t.withheld)}</strong><small>{t.percentage === null ? 'Withholding recorded on your payslips' : `${t.percentage}% of pay before deductions`}</small></div>
        <div><span>Super on payslips</span><strong>{t.superKnown ? aud(t.superCents) : 'Unknown'}</strong><small>{t.superKnown} of {t.count} payslips show an amount · check your fund for payments</small></div>
      </div>
      <section className="pay-breakdown" aria-label="How your pay adds up"><h3>How your take-home pay adds up</h3><div className="pay-equation">
        <span><small>Before deductions</small><strong>{aud(t.gross)}</strong></span><b aria-label="minus">−</b>
        <span><small>Tax taken out</small><strong>{aud(t.withheld)}</strong></span><b aria-label="minus">−</b>
        <span><small>Other deductions</small><strong>{aud(t.deductions)}</strong></span><b aria-label="equals">=</b>
        <span><small>Take-home pay</small><strong>{aud(t.net)}</strong></span>
      </div><p>Super is shown separately. Tax taken out is withholding; your final tax is worked out at tax time.</p></section>
      <PayslipCharts slips={slips} grouping={grouping} onGrouping={onGrouping} />
      {notes.length > 0 && <details className="statement-help pay-observations"><summary>Pay changes to look at</summary><p>These compare your uploaded payslips. They can help you spot a change, but don’t explain its cause.</p><ul>{notes.map((note, i) => <li key={i}>{note}</li>)}</ul></details>}
    </>}
  </>
}
