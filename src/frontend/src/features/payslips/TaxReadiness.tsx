import { useEffect, useMemo, useState } from 'react'
import type { Payslip } from './payslip'
import {
  assessTaxReadiness,
  blankTaxReadinessAnswers,
  taxReadinessCoverage,
  taxReadinessQuestions,
  taxReadinessSources,
  TAX_READINESS_REVIEW,
  type ReadinessAnswer,
  type TaxReadinessAnswers,
  type TaxReadinessResult,
} from './taxReadiness'
import { downloadTaxReadinessReport, taxReadinessReport } from './taxReadinessReport'

type Props = {
  allSlips: Payslip[]
  year: string
  employerFilter: string
}

export default function TaxReadiness({ allSlips, year, employerFilter }: Props) {
  const coverage = useMemo(() => taxReadinessCoverage(allSlips, year), [allSlips, year])
  const scopeKey = `${year}|${allSlips.map(slip => `${slip.id}:${slip.confirmed}:${Object.values(slip.facts).join('~')}`).join('|')}`
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<TaxReadinessAnswers>(blankTaxReadinessAnswers)
  const [result, setResult] = useState<TaxReadinessResult | null>(null)

  useEffect(() => {
    setOpen(false)
    setAnswers(blankTaxReadinessAnswers())
    setResult(null)
  }, [scopeKey])

  function answer(key: keyof TaxReadinessAnswers, value: ReadinessAnswer) {
    setAnswers(current => ({ ...current, [key]: value }))
    setResult(null)
  }

  function review() {
    setResult(assessTaxReadiness(answers))
  }

  function clear() {
    setAnswers(blankTaxReadinessAnswers())
    setResult(null)
  }

  if (year === 'all') {
    return <section className="tax-readiness" aria-labelledby="tax-readiness-heading">
      <div className="tax-readiness-heading"><div><p className="eyebrow">Optional tax readiness</p><h3 id="tax-readiness-heading">What would TaxPrep still need for tax?</h3><p>Choose one financial year above first. This check is whole-person and year scoped, so it cannot use a mixed-year view.</p></div><span className="tax-readiness-badge locked">No tax estimate</span></div>
    </section>
  }

  if (coverage.pendingSlips.length > 0) {
    return <section className="tax-readiness" aria-labelledby="tax-readiness-heading">
      <div className="tax-readiness-heading"><div><p className="eyebrow">Optional tax readiness</p><h3 id="tax-readiness-heading">What would TaxPrep still need for tax?</h3><p>{year} · all employers for this year</p></div><span className="tax-readiness-badge warning">Pay records need checking</span></div>
      <div className="tax-readiness-blocked"><strong>Check the pay records first.</strong><p>{coverage.pendingSlips.length} record{coverage.pendingSlips.length === 1 ? '' : 's'} could belong to this financial year but are unconfirmed or unresolved. TaxPrep will not silently leave them out of a whole-year readiness check.</p></div>
    </section>
  }

  if (!coverage.checkedSlips.length) {
    return <section className="tax-readiness" aria-labelledby="tax-readiness-heading">
      <div className="tax-readiness-heading"><div><p className="eyebrow">Optional tax readiness</p><h3 id="tax-readiness-heading">What would TaxPrep still need for tax?</h3><p>No checked payslips are available for {year}. Add and confirm pay records first.</p></div><span className="tax-readiness-badge locked">No tax estimate</span></div>
    </section>
  }

  const status = !result
    ? null
    : result.outsideProfile.length
      ? 'Outside current prototype'
      : result.needsInformation.length
        ? 'Needs more information'
        : 'Profile facts collected'

  return <section className="tax-readiness" aria-labelledby="tax-readiness-heading">
    <div className="tax-readiness-heading">
      <div>
        <p className="eyebrow">Optional tax readiness</p>
        <h3 id="tax-readiness-heading">What would TaxPrep still need for tax?</h3>
        <p>This checks profile completeness for <strong>{year}</strong>. It uses all checked employers in that financial year and does not calculate a refund or debt.</p>
      </div>
      <span className="tax-readiness-badge locked">Tax result locked</span>
    </div>

    {employerFilter !== 'all' && <p className="tax-readiness-scope-note"><strong>Whole-year scope:</strong> your chart is filtered to one employer, but this readiness section intentionally uses all employers recorded for {year}.</p>}

    <div className="tax-readiness-coverage">
      <div><span>Checked pay records</span><strong>{coverage.checkedSlips.length}</strong></div>
      <div><span>Employers represented</span><strong>{coverage.employerCount}</strong></div>
      <div><span>Financial year</span><strong>{coverage.year}</strong></div>
    </div>
    <p className="tax-readiness-employers">Recorded employers: {coverage.employerNames.join(', ') || 'None'}.</p>

    {!open ? <button className="secondary-button" onClick={() => setOpen(true)}>Start tax readiness</button> : <>
      <div className="tax-readiness-lock">
        <strong>This cannot unlock a tax estimate.</strong>
        <p>{TAX_READINESS_REVIEW} Recorded PAYG withholding is money withheld during the year, not final tax by itself.</p>
      </div>

      <div className="tax-readiness-form">
        {taxReadinessQuestions.map((question, index) => <label key={question.key} htmlFor={`tax-readiness-${question.key}`}>
          <span><strong>{index + 1}. {question.label}</strong><small>{question.help}</small></span>
          <select
            id={`tax-readiness-${question.key}`}
            aria-label={`Tax readiness: ${question.key}`}
            value={answers[question.key]}
            onChange={event => answer(question.key, event.target.value as ReadinessAnswer)}
          >
            <option value="">Choose an answer</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unsure">Unsure</option>
          </select>
        </label>)}
      </div>

      <div className="tax-readiness-actions">
        <button className="primary-button" onClick={review}>Review tax readiness</button>
        <button className="text-button" onClick={clear}>Clear profile answers</button>
      </div>

      {result && <div className="tax-readiness-result" aria-label="Tax readiness result">
        <div className="tax-readiness-result-heading">
          <div><h4>{status}</h4><p>Profile questions only · no tax result produced</p></div>
          <span className={result.outsideProfile.length ? 'tax-readiness-badge warning' : result.needsInformation.length ? 'tax-readiness-badge info' : 'tax-readiness-badge'}>{result.answered.length}/{taxReadinessQuestions.length} within current profile</span>
        </div>
        <div className="tax-readiness-counts">
          <div><span>Answered within profile</span><strong>{result.answered.length}</strong></div>
          <div><span>Need information</span><strong>{result.needsInformation.length}</strong></div>
          <div><span>Outside current profile</span><strong>{result.outsideProfile.length}</strong></div>
        </div>
        {result.needsInformation.length > 0 && <div className="tax-readiness-list"><strong>Needs information</strong><ul>{result.needsInformation.map(question => <li key={question.key}>{question.label}</li>)}</ul></div>}
        {result.outsideProfile.length > 0 && <div className="tax-readiness-list warning"><strong>Outside the current supported profile</strong><ul>{result.outsideProfile.map(question => <li key={question.key}>{question.label}</li>)}</ul><p>TaxPrep should not squeeze these circumstances into the narrow prototype. A later reviewed rule set would need to support them explicitly.</p></div>}
        {result.needsInformation.length === 0 && result.outsideProfile.length === 0 && <div className="tax-readiness-list ready"><strong>Profile facts collected for the narrow prototype.</strong><p>The calculation is still locked because source/rule/rounding review is pending. Completing this form is not professional approval.</p></div>}
        <div className="tax-readiness-lock final"><strong>Tax result remains locked</strong><p>No refund, debt or final-tax number is produced from these answers.</p></div>
        <button className="secondary-button" onClick={() => downloadTaxReadinessReport(taxReadinessReport(coverage, answers, result, coverage.checkedSlips))}>Download readiness report</button>
      </div>}

      <details className="statement-help tax-readiness-sources">
        <summary>Why these questions?</summary>
        <p>These ATO links are terminology references only. TaxPrep is not applying a withholding schedule or annual-tax rule in this readiness step.</p>
        <ul>{taxReadinessSources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
      </details>
    </>}
  </section>
}
