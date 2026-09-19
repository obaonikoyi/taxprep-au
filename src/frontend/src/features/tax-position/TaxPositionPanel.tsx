import { money } from '../documents/evidence'
import { balanceLabel, PROFILE, ROUNDING, type TaxPosition } from './taxPosition'
import { taxSources } from './sourceHealth'
export default function TaxPositionPanel({ value }: { value: TaxPosition }) {
  return <section className="tax-position preparation-step" aria-labelledby="tax-position-title">
    <p className="eyebrow">2025–26 · Fictional calculation</p><h4 id="tax-position-title">See how the numbers fit together.</h4>
    <p>{value.review}</p>
    {value.balanceCents !== null ? <>
      <div className="tax-balance"><span>{balanceLabel(value)}</span><strong>{money(Math.abs(value.balanceCents))}</strong><p>Recorded withholding minus illustrative tax plus Medicare. This is a scenario result, not an approved tax return or a predicted ATO payment.</p></div>
      <div className="tax-table-wrap"><table><caption>Calculation breakdown · AUD</caption><thead><tr><th scope="col">Component</th><th scope="col">Amount</th></tr></thead><tbody>{value.lines.map(line => <tr key={line.label}><th scope="row">{line.label}<small>{line.explanation}</small></th><td>{money(line.cents)}</td></tr>)}</tbody></table></div>
    </> : <div className="tax-blockers"><strong>Calculation unavailable</strong><ul>{value.blockers.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>}
    <details><summary>Supported scenario, rounding and sources</summary><p>{PROFILE}</p><p>{ROUNDING}</p><p>Rule version: {value.ruleVersion}<br />Source version: {value.sourceVersion}</p><ul>{taxSources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · checked {source.retrievedAt} · qualified review pending</li>)}</ul><p>Source snapshots are checked at build time. A 180-day maintenance limit, conflicting sources or changed rule bindings stop the illustration. Source availability is not professional approval.</p></details>
  </section>
}
