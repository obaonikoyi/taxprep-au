import { aud, hoursText, type PayFacts } from './payslip'
import { checkEarnings, multiplierText, rateText, type EarningsLine } from './payslipEarnings'

/*
 * The earnings table as the payslip prints it, with the two things this app
 * can honestly say about it: whether each line follows from its own hours and
 * rate, and what each rate is as a multiple of the ordinary one.
 *
 * What it must never say is that a loading is the right one. That depends on
 * an award or an agreement nobody here has read, so the multiplier is offered
 * as a description and the closing note says plainly whose question it is.
 */
export default function PayslipEarnings({ lines, facts }: { lines: EarningsLine[]; facts: PayFacts }) {
  if (!lines.length) return null
  const result = checkEarnings(lines, facts)
  const penalty = result.lines.filter(l => l.multiplier !== null && l.multiplier !== 10_000)
  const money0 = (cents: number | null) => cents === null ? '' : aud(cents)

  return <section className="pay-earnings" aria-label="Lines on this payslip">
    <h4>How this pay adds up</h4>
    <table className="pay-earnings-table">
      <thead><tr>
        <th scope="col">Paid for</th><th scope="col">Hours</th><th scope="col">Rate</th>
        <th scope="col">Amount</th><th scope="col">Compared with ordinary</th>
      </tr></thead>
      <tbody>
        {result.lines.map((line, i) => <tr key={`${line.label}-${i}`} className={line.multipliesOut === false ? 'pay-earnings-differs' : undefined}>
          <th scope="row">{line.label}</th>
          <td>{line.hours === null ? lines[i].hours : hoursText(Math.round(line.hours / 100))}</td>
          <td>{line.rate === null ? lines[i].rate : `$${rateText(line.rate)}`}</td>
          <td>{money0(line.amount)}</td>
          <td>{line.multiplier === null ? '' : line.multiplier === 10_000 ? 'this is the ordinary rate' : `${multiplierText(line.multiplier)} times it`}</td>
        </tr>)}
      </tbody>
    </table>

    {result.disagreeing.length > 0 && <div role="alert" className="statement-error">
      <strong>{result.disagreeing.length === 1 ? 'One line does not' : `${result.disagreeing.length} lines do not`} match {result.disagreeing.length === 1 ? 'its' : 'their'} own hours and rate.</strong>
      <ul>{result.disagreeing.map((line, i) => <li key={`${line.label}-${i}`}>
        {line.label}: {hoursText(Math.round(line.hours! / 100))} hours at ${rateText(line.rate!)} comes to {aud(line.expected!)}, but this payslip says {aud(line.amount!)}.
      </li>)}</ul>
      <p>Check those figures against your payslip. A difference here is on the document itself, not something Xoba Paycheck worked out about your entitlements.</p>
    </div>}

    {result.disagreeing.length === 0 && result.lines.some(l => l.multipliesOut) &&
      <p className="pay-earnings-note">Every line with hours and a rate matches what those two come to.</p>}

    {result.itemised !== null && <p className="pay-earnings-note">
      {result.lines.length === 1 ? 'This line comes' : `These ${result.lines.length} lines come`} to {aud(result.itemised)}
      {result.unitemised === null ? '.'
        : result.unitemised === 0 ? ', which is all of your pay before deductions.'
        : result.unitemised > 0 ? `. Your pay before deductions is ${aud(result.gross!)}, so ${aud(result.unitemised)} of it is paid outside this table — an allowance or a bonus, for instance.`
        : `. That is more than the ${aud(result.gross!)} shown as pay before deductions, so one of those figures needs checking.`}
    </p>}

    {/*
      * The sentence this milestone exists for. A rate you recorded is compared
      * against the ordinary line and nothing else, and on a payslip like this
      * one that is a small share of the money. Saying "your rate checks out"
      * without saying how little it covered would be the app flattering itself.
      */}
    {penalty.length > 0 && <p className="pay-earnings-note">
      {result.ordinaryShare === null ? 'Only the ordinary line can be compared with a rate you have recorded.'
        : <>Only the ordinary line can be compared with a rate you have recorded, and it is <strong>{result.ordinaryShare}%</strong> of this pay.</>}
      {' '}The other {penalty.length === 1 ? 'line is a multiple' : `${penalty.length} lines are multiples`} of your ordinary rate, shown above.
      Whether {penalty.length === 1 ? 'that is the multiple' : 'those are the multiples'} you are entitled to depends on your award or agreement, which Xoba Paycheck has not seen.
    </p>}
  </section>
}
