import { useEffect, useMemo, useState } from 'react'
import { aud, type Payslip } from './payslip'
import {
  annualFinalStatusLabel,
  annualSourceGuidance,
  annualSourceTypeLabel,
  ANNUAL_SOURCE_GUIDANCE_VERSION,
  blankAnnualPaySource,
  MAX_ANNUAL_PAY_SOURCES,
  payCoverageForYear,
  reconcileYearEndPay,
  reconciliationStateLabel,
  type AnnualPaySource,
  type CoverageAnswer,
} from './yearEndReconciliation'
import { downloadYearEndReconciliationReport, yearEndReconciliationReport } from './yearEndReconciliationReport'

type Props = {
  allSlips: Payslip[]
  year: string
  employerFilter: string
}

const moneyDifference = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${aud(value)}`

export default function YearEndReconciliation({ allSlips, year, employerFilter }: Props) {
  const coverage = useMemo(() => payCoverageForYear(allSlips, year), [allSlips, year])
  const scopeKey = `${year}|${allSlips.map(slip => `${slip.id}:${slip.confirmed}:${Object.values(slip.facts).join('~')}`).join('|')}`
  const [open, setOpen] = useState(false)
  const [sources, setSources] = useState<AnnualPaySource[]>([])
  const [coverageAnswer, setCoverageAnswer] = useState<CoverageAnswer>('')

  useEffect(() => {
    setOpen(false)
    setSources([])
    setCoverageAnswer('')
  }, [scopeKey])

  const result = useMemo(() => reconcileYearEndPay(allSlips, year, sources, coverageAnswer), [allSlips, year, sources, coverageAnswer])

  function addSource() {
    if (sources.length >= MAX_ANNUAL_PAY_SOURCES) return
    setSources(current => [...current, blankAnnualPaySource(crypto.randomUUID())])
    setCoverageAnswer('')
  }

  function patchSource(id: string, patch: Partial<AnnualPaySource>) {
    setSources(current => current.map(source => source.id === id ? { ...source, ...patch } : source))
    setCoverageAnswer('')
  }

  function removeSource(id: string) {
    setSources(current => current.filter(source => source.id !== id))
    setCoverageAnswer('')
  }

  if (year === 'all') {
    return <section className="year-end-reconciliation" aria-labelledby="year-end-reconciliation-heading">
      <div className="year-end-heading"><div><p className="eyebrow">Year-end preparation</p><h3 id="year-end-reconciliation-heading">Compare payslips with annual income sources</h3><p>Choose one financial year above first. Reconciliation is year scoped and uses all checked employers in that year.</p></div><span className="year-end-badge locked">Tax result locked</span></div>
    </section>
  }

  if (coverage.pendingSlips.length > 0) {
    return <section className="year-end-reconciliation" aria-labelledby="year-end-reconciliation-heading">
      <div className="year-end-heading"><div><p className="eyebrow">Year-end preparation</p><h3 id="year-end-reconciliation-heading">Compare payslips with annual income sources</h3><p>{year} · all employers in this year</p></div><span className="year-end-badge warning">Pay records need checking</span></div>
      <div className="year-end-blocked"><strong>Check the pay records first.</strong><p>{coverage.pendingSlips.length} record{coverage.pendingSlips.length === 1 ? '' : 's'} could belong to this financial year but are unconfirmed or unresolved. Reconciliation will not silently leave them out.</p></div>
    </section>
  }

  if (!coverage.checkedSlips.length) {
    return <section className="year-end-reconciliation" aria-labelledby="year-end-reconciliation-heading">
      <div className="year-end-heading"><div><p className="eyebrow">Year-end preparation</p><h3 id="year-end-reconciliation-heading">Compare payslips with annual income sources</h3><p>No checked payslips are available for {year}. Add and confirm pay records first.</p></div><span className="year-end-badge locked">Tax result locked</span></div>
    </section>
  }

  return <section className="year-end-reconciliation" aria-labelledby="year-end-reconciliation-heading">
    <div className="year-end-heading">
      <div><p className="eyebrow">Year-end preparation</p><h3 id="year-end-reconciliation-heading">Compare payslips with annual income sources</h3><p>Use final income statements or payment summaries to compare annual employer totals with your checked {year} pay history.</p></div>
      <span className="year-end-badge locked">Tax result locked</span>
    </div>

    {employerFilter !== 'all' && <p className="year-end-scope-note"><strong>Whole-year scope:</strong> your chart is filtered to one employer, but this section intentionally uses all checked employers recorded for {year}.</p>}

    <div className="year-end-notice"><strong>Do not add these two views together.</strong><p>Payslips are period-by-period history. A final income statement/payment summary is an annual view of that employment income. TaxPrep compares them; it does not count both as separate income.</p></div>

    <div className="year-end-coverage">
      <div><span>Checked payslips</span><strong>{coverage.checkedSlips.length}</strong></div>
      <div><span>Employers in pay history</span><strong>{coverage.employerNames.length}</strong></div>
      <div><span>Annual sources entered</span><strong>{sources.length}</strong></div>
    </div>
    <p className="year-end-employers">Recorded employers: {coverage.employerNames.map(([, name]) => name).join(', ')}.</p>

    {!open ? <button className="secondary-button" onClick={() => setOpen(true)}>Start year-end reconciliation</button> : <>
      <div className="year-end-guidance"><strong>Manual entry first.</strong><p>Enter figures from the annual source itself. Do not enter a TFN. One employer can have more than one income statement, so link each source individually.</p></div>

      <div className="year-end-actions"><button className="secondary-button" disabled={sources.length >= MAX_ANNUAL_PAY_SOURCES} onClick={addSource}>Add annual employment source</button><span>{sources.length}/{MAX_ANNUAL_PAY_SOURCES}</span></div>

      {sources.length === 0 && <div className="year-end-empty"><strong>No annual sources entered yet.</strong><p>Add a Tax ready/final income statement or final payment summary when you have one. Provisional sources can also be recorded, but they stay out of final reconciliation totals.</p></div>}

      <div className="year-end-source-list">
        {result.sourceRows.map(({ source, issues, finalIncluded, provisional }, index) => <article className="year-end-source-card" aria-label={`Annual employment source ${index + 1}`} key={source.id}>
          <div className="year-end-source-heading"><div><p className="eyebrow">Annual source {index + 1}</p><h4>{source.payer || 'Unnamed annual source'}</h4></div><button className="text-button" onClick={() => removeSource(source.id)}>Remove source {index + 1}</button></div>
          <div className="year-end-form">
            <label>Employer / payer name<input aria-label={`Annual source ${index + 1}: employer or payer`} maxLength={120} value={source.payer} onChange={event => patchSource(source.id, { payer: event.target.value })} /></label>
            <label>Source reference<input aria-label={`Annual source ${index + 1}: source reference`} maxLength={160} placeholder="Example: myGov income statement 1" value={source.reference} onChange={event => patchSource(source.id, { reference: event.target.value })} /><small>Use a label you recognise. Do not enter your TFN.</small></label>
            <label>Source type<select aria-label={`Annual source ${index + 1}: source type`} value={source.sourceType} onChange={event => patchSource(source.id, { sourceType: event.target.value as AnnualPaySource['sourceType'] })}><option value="">Choose source type</option><option value="income-statement">Income statement</option><option value="payment-summary">Payment summary</option></select></label>
            <label>Final status<select aria-label={`Annual source ${index + 1}: final status`} value={source.finalStatus} onChange={event => patchSource(source.id, { finalStatus: event.target.value as AnnualPaySource['finalStatus'] })}><option value="">Choose status</option><option value="final">Tax ready / finalised</option><option value="not-final">Not final</option><option value="unsure">Unsure</option></select><small>For an income statement, Tax ready means the employer has finalised it.</small></label>
            <label>Gross income<input aria-label={`Annual source ${index + 1}: gross income (AUD)`} inputMode="decimal" value={source.gross} onChange={event => patchSource(source.id, { gross: event.target.value })} /></label>
            <label>Tax withheld<input aria-label={`Annual source ${index + 1}: tax withheld (AUD)`} inputMode="decimal" value={source.withheld} onChange={event => patchSource(source.id, { withheld: event.target.value })} /></label>
            <label className="year-end-link-field">Link to checked pay history (optional)<select aria-label={`Annual source ${index + 1}: linked employer`} value={source.linkedEmployer} onChange={event => patchSource(source.id, { linkedEmployer: event.target.value })}><option value="">Not linked yet</option>{coverage.employerNames.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select><small>Multiple annual sources may link to the same employer.</small></label>
          </div>
          <div className={`year-end-source-status ${finalIncluded ? 'final' : provisional ? 'provisional' : 'needs-review'}`}><strong>{finalIncluded ? 'Final source included in annual totals' : provisional ? `${annualFinalStatusLabel(source.finalStatus, source.sourceType)} · excluded from final totals` : 'Needs review before reconciliation'}</strong><span>{source.sourceType ? annualSourceTypeLabel(source.sourceType) : 'Source type not selected'}</span></div>
          {issues.length > 0 && <ul className="year-end-issues">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        </article>)}
      </div>

      <div className="year-end-coverage-answer"><label>Have you added every annual employment source you know about for {year}?<select aria-label="Annual employment source coverage" value={coverageAnswer} onChange={event => setCoverageAnswer(event.target.value as CoverageAnswer)}><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No · more to add</option><option value="unsure">Unsure</option></select></label><p>This is your coverage statement only. It is not proof that the tax return is complete.</p></div>

      <div className="year-end-result" aria-label="Year-end pay reconciliation result">
        <div className="year-end-result-heading"><div><h4>Employer reconciliation</h4><p>Checked payslip history and final annual-source totals are shown separately. Differences are annual source minus payslip history.</p></div><span className="year-end-badge locked">No tax/refund result</span></div>
        <div className="year-end-table-wrap"><table className="year-end-table"><thead><tr><th>Employer / source</th><th>Payslips</th><th>Pay-history gross</th><th>Pay-history withholding</th><th>Final annual sources</th><th>Final annual gross</th><th>Final annual witholding</th><th>Gross difference</th><th>Withholding difference</th><th>Status</th></tr></thead><tbody>
          {result.rows.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.payCount}</td><td>{aud(row.payGross)}</td><td>{aud(row.payWitheld)}</td><td>{row.finalSourceCount}</td><td>{row.annualGross === null ? '—' : aud(row.annualGross)}</td><td>{row.annualWitheld === null ? '—' : aud(row.annualWithheld)}</td><td>{moneyDifference(row.grossDifference)}</td><td>{moneyDifference(row.withheldDifference)}</td><td><span className={`year-end-state ${row.state}`}>{reconciliationStateLabel(row.state)}</span>{row.provisionalSourceCount > 0 && <small>{row.provisionalSourceCount} provisional source{row.provisionalSourceCount === 1 ? '' : 's'} linked</small>}</td></tr>)}
        </tbody></table></div>

        <div className={result.questions.length ? 'year-end-questions' : 'year-end-questions clear'}><strong>{result.questions.length ? 'Questions to review' : 'No reconciliation questions from these recorded sources'}</strong>{result.questions.length ? <ul>{result.questions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}</ul> : <p>This does not prove your return is complete or unlock a tax result.</p>}</div>
        <div className="year-end-lock"><strong>Tax result remains locked.</strong><p>This reconciliation does not calculate final tax, a refund, a debt, or decide which source is legally correct when figures differ.</p></div>
        <button className="secondary-button" onClick={() => downloadYearEndReconciliationReport(yearEndReconciliationReport(result))}>Download year-end pay handover</button>
      </div>

      <details className="statement-help year-end-sources"><summary>Why Tax ready and why can one employer have multiple sources?</summary><p>ATO wording references only · version {ANNUAL_SOURCE_GUIDANCE_VERSION}. These links support source-status wording and multiple-statement handling; they do not unlock TaxPrep tax calculations.</p><ul>{annualSourceGuidance.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
    </>}
  </section>
}
