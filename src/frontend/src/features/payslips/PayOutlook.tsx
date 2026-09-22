import { useEffect, useMemo, useState } from 'react'
import { aud, confirmationIssues, employerKey, financialYear, totals, type Payslip } from './payslip'
import { calculatePayOutlook, frequencyLabel, outlookIssues, payFrequencies, type PayFrequency, type PayOutlookResult } from './payOutlook'
import { downloadPayOutlookReport, payOutlookReport } from './payOutlookReport'

type Props = {
  allSlips: Payslip[]
  slips: Payslip[]
  year: string
  employer: string
  employerName: string
}

export default function PayOutlook({ allSlips, slips, year, employer, employerName }: Props) {
  const scopedAll = useMemo(() => {
    if (year === 'all' || employer === 'all') return []
    return allSlips.filter(s => {
      if (employerKey(s.facts.employer) !== employer) return false
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.facts.payDate)) return true
      return financialYear(s.facts.payDate) === year
    })
  }, [allSlips, year, employer])

  const pending = scopedAll.filter(s => !s.confirmed || confirmationIssues(s, allSlips).length)
  const latest = slips.at(-1)
  const latestGross = latest?.facts.gross ?? '', latestWithheld = latest?.facts.withheld ?? ''
  const scopeKey = `${year}|${employer}|${scopedAll.map(s => `${s.id}:${s.confirmed}:${Object.values(s.facts).join('~')}`).join('|')}`

  const [nextPayDate, setNextPayDate] = useState('')
  const [frequency, setFrequency] = useState<PayFrequency | ''>('')
  const [normalGross, setNormalGross] = useState('')
  const [normalWithheld, setNormalWithheld] = useState('')
  const [regularConfirmed, setRegularConfirmed] = useState(false)
  const [historyComplete, setHistoryComplete] = useState(false)
  const [issues, setIssues] = useState<string[]>([])
  const [result, setResult] = useState<PayOutlookResult | null>(null)

  useEffect(() => {
    setNextPayDate('')
    setFrequency('')
    setNormalGross(latestGross)
    setNormalWithheld(latestWithheld)
    setRegularConfirmed(false)
    setHistoryComplete(false)
    setIssues([])
    setResult(null)
  }, [scopeKey, latestGross, latestWithheld])

  function invalidate() {
    setIssues([])
    setResult(null)
  }

  function showOutlook() {
    const input = { financialYear: year, nextPayDate, frequency, normalGross, normalWithheld, regularConfirmed, historyComplete }
    const nextIssues = outlookIssues(slips, input)
    setIssues(nextIssues)
    if (nextIssues.length) { setResult(null); return }
    setResult(calculatePayOutlook(slips, input, employerName))
  }

  if (year === 'all' || employer === 'all') {
    return <section className="pay-outlook" aria-labelledby="pay-outlook-heading">
      <div className="pay-outlook-heading"><div><p className="eyebrow">Optional outlook</p><h3 id="pay-outlook-heading">Explore the rest of the year</h3><p>Choose <strong>one financial year</strong> and <strong>one employer</strong> above first. Xoba Paycheck keeps each outlook to one job so the numbers are not mistaken for your whole income.</p></div><span className="pay-outlook-status locked">Choose a year and employer</span></div>
    </section>
  }

  if (pending.length > 0) {
    return <section className="pay-outlook" aria-labelledby="pay-outlook-heading">
      <div className="pay-outlook-heading"><div><p className="eyebrow">Optional outlook</p><h3 id="pay-outlook-heading">Explore the rest of the year</h3><p>{employerName} · {year}</p></div><span className="pay-outlook-status warning">Needs checking</span></div>
      <div className="pay-outlook-blocked"><strong>Check every payslip in this scope first.</strong><p>{pending.length} record{pending.length === 1 ? '' : 's'} for this employer and financial year are still unconfirmed or have an issue. They are not silently left out of a forecast.</p></div>
    </section>
  }

  if (!slips.length) {
    return <section className="pay-outlook" aria-labelledby="pay-outlook-heading">
      <div className="pay-outlook-heading"><div><p className="eyebrow">Optional outlook</p><h3 id="pay-outlook-heading">Explore the rest of the year</h3><p>Add and check at least one payslip for this employer and financial year first.</p></div><span className="pay-outlook-status locked">Needs a checked payslip</span></div>
    </section>
  }

  const recorded = totals(slips)

  return <section className="pay-outlook" aria-labelledby="pay-outlook-heading">
    <div className="pay-outlook-heading">
      <div><p className="eyebrow">Optional outlook</p><h3 id="pay-outlook-heading">What if my regular pay continues?</h3><p>{employerName} · {year}. Start with your checked payslips, then add explicit assumptions for future pay.</p></div>
      <span className="pay-outlook-status">One employer only</span>
    </div>

    <div className="pay-outlook-recorded" aria-label="Recorded pay used for outlook">
      <div><span>Checked payslips</span><strong>{slips.length}</strong></div>
      <div><span>Recorded gross so far</span><strong>{aud(recorded.gross)}</strong></div>
      <div><span>Latest checked payday</span><strong>{latest?.facts.payDate}</strong></div>
    </div>

    <div className="pay-outlook-form">
      <label>Next payday
        <input aria-label="Next payday" type="date" value={nextPayDate} onChange={event => { setNextPayDate(event.target.value); invalidate() }} />
        <small>Must be after the latest checked payday and on or before 30 June.</small>
      </label>
      <label>How often does this regular pay arrive?
        <select aria-label="Pay frequency" value={frequency} onChange={event => { setFrequency(event.target.value as PayFrequency | ''); invalidate() }}>
          <option value="">Choose frequency</option>
          {payFrequencies.map(value => <option key={value} value={value}>{frequencyLabel(value)}</option>)}
        </select>
      </label>
      <label>Normal gross pay
        <input aria-label="Normal gross pay (AUD)" inputMode="decimal" value={normalGross} onChange={event => { setNormalGross(event.target.value); invalidate() }} />
        <small>Pre-filled from the latest checked payslip. Change it if that amount is not your normal pattern.</small>
      </label>
      <label>Normal tax withheld
        <input aria-label="Normal tax withheld (AUD)" inputMode="decimal" value={normalWithheld} onChange={event => { setNormalWithheld(event.target.value); invalidate() }} />
        <small>Used only for the unchanged-pay scenario. It is withholding, not final tax.</small>
      </label>
    </div>

    <div className="pay-outlook-checks">
      <label><input type="checkbox" checked={regularConfirmed} onChange={event => { setRegularConfirmed(event.target.checked); invalidate() }} /> I expect these future pays to be regular, not a bonus, back pay or adjustment.</label>
      <label><input type="checkbox" checked={historyComplete} onChange={event => { setHistoryComplete(event.target.checked); invalidate() }} /> I have added all payslips I have from this employer for this financial year so far.</label>
      <p>{historyComplete ? 'You marked this employer history as complete so far. It still does not represent other jobs or whole-person income.' : 'Your recorded history is treated as partial. Missing earlier pays are not invented.'}</p>
    </div>

    {issues.length > 0 && <div className="pay-outlook-errors" role="alert"><strong>Check these assumptions</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <button className="primary-button" onClick={showOutlook}>Show pay outlook</button>

    {result && <div className="pay-outlook-results" aria-label="Pay outlook results">
      <div className="pay-outlook-result-heading"><div><h4>Employer pay scenarios through 30 June</h4><p>{result.futurePayDates.length} assumed future payday{result.futurePayDates.length === 1 ? '' : 's'} · {frequencyLabel(result.frequency)}</p></div><span className={result.historyComplete ? 'pay-outlook-status' : 'pay-outlook-status warning'}>{result.historyComplete ? 'Employer history marked complete' : 'Partial recorded history'}</span></div>
      <div className="pay-outlook-table-wrap"><table className="pay-outlook-table"><thead><tr><th>Scenario</th><th>Recorded gross</th><th>Assumed future gross</th><th>Combined employer gross</th><th>Recorded withholding</th><th>Assumed future withholding</th></tr></thead><tbody>
        {result.scenarios.map(scenario => <tr key={scenario.key}><th scope="row">{scenario.label}</th><td>{aud(result.recordedGross)}</td><td>{aud(scenario.futureGross)}</td><td>{aud(scenario.combinedGross)}</td><td>{aud(result.recordedWithheld)}</td><td>{scenario.futureWithheld === null ? 'Not estimated' : aud(scenario.futureWithheld)}</td></tr>)}
      </tbody></table></div>
      <p className="pay-outlook-note"><strong>Important:</strong> the ±20% rows change gross pay only. Xoba Paycheck does not scale withholding for them. None of these rows is final tax, a refund estimate or whole-person income.</p>
      <details className="statement-help pay-outlook-dates"><summary>View assumed future pay dates</summary><ol>{result.futurePayDates.map(date => <li key={date}>{date}</li>)}</ol></details>
      <button className="secondary-button" onClick={() => downloadPayOutlookReport(payOutlookReport(result, slips))}>Download outlook report</button>
    </div>}
  </section>
}
