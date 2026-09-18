import { assessPhone, emptyPhoneAnswers, sources, type PhoneAnswers } from './phone'
import { money, type Evidence } from '../documents/evidence'

interface Props { item: Evidence; evidence: Evidence[]; credits: Evidence[]; counted: boolean; onChange: (item: Evidence) => void }
const choices = [['', 'Choose an answer'], ['yes', 'Yes'], ['no', 'No'], ['unsure', 'Unsure']]
export default function PhoneAssessment({ item, evidence, credits, counted, onChange }: Props) {
  if (!item.phone) return <button className="secondary-button" onClick={() => onChange({ ...item, phone: emptyPhoneAnswers() })}>Assess phone expense</button>
  const phone = item.phone
  const result = assessPhone(item, evidence, counted, '2025-26', new Date(), sources, credits)
  const select = (key: keyof PhoneAnswers, label: string, options: string[][] = choices) => <label>{label}<select aria-label={label} value={phone[key]} onChange={event => onChange({ ...item, phone: { ...phone, [key]: event.target.value } })}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
  const excluded = result.status === 'no-separate-amount'
  return <section className="phone-assessment" aria-label="Phone expense assessment">
    <p className="eyebrow">2025–26 · Employee mobile service</p><h4>Check this phone expense</h4>
    <p>Uses the reviewed amount and work details above. Complete those details once; answer only the remaining questions here.</p>
    <div className="evidence-form">
      {select('kind', 'What did this payment buy?', [['', 'Choose an answer'], ['service', 'Mobile calls/data service only'], ['device', 'Handset or other device'], ['bundle', 'Service bundled with a device'], ['other', 'Setup, insurance or another cost']])}
      {phone.kind === 'service' && <>
        {select('payer', 'Who incurred and paid the cost?', [['', 'Choose an answer'], ['you', 'I did'], ['other', 'Someone else did'], ['unsure', 'Unsure']])}
        {phone.payer !== 'other' && <>
          {select('use', 'What does your work-use percentage cover?', [['', 'Choose an answer'], ['duties', 'Performing my existing work duties'], ['availability', 'Only availability or offers of casual shifts'], ['job-search', 'Only looking for a job'], ['private', 'Only personal use'], ['mixed', 'Mixed purposes I have not separated'], ['unsure', 'Unsure']])}
          {!['availability', 'job-search', 'private'].includes(phone.use) && <>
            {select('homeMethod', 'Working-from-home method for this year', [['', 'Choose an answer'], ['none', 'No working-from-home deduction'], ['actual', 'Actual costs method'], ['fixed', 'Fixed rate method'], ['unsure', 'Unsure']])}
            {phone.homeMethod !== 'fixed' && <>
              {select('elsewhere', 'Is this cost already included elsewhere?')}
              {item.answers.reimbursed === 'yes' && <label>Amount reimbursed (AUD)<input inputMode="decimal" maxLength={14} value={phone.reimbursedAmount} onChange={event => onChange({ ...item, phone: { ...phone, reimbursedAmount: event.target.value } })} /></label>}
              {!excluded && <>
                {select('records', 'Have you checked the supplier bill and 4-week work-use record?')}
                {select('representative', 'Does the percentage reasonably apply to this entire service bill?')}
                <p className="field-help">Account for leave, changed duties, and different call/data use. The bill needs supplier, cost, service and date details. This path uses actual documented expenses; record-keeping exceptions and incidental-use methods need separate review.</p>
              </>}
            </>}
          </>}
        </>}
      </>}
    </div>
    <div className="assessment-result" aria-live="polite">
      <p className="assessment-label">{result.status === 'illustration' ? 'Illustrative work portion' : result.status === 'no-separate-amount' ? 'Draft: no separate phone amount' : result.status === 'outside-scope' ? 'Outside this assessment’s scope' : 'More information or review needed'}</p>
      {result.cents !== null && <strong className="assessment-amount">{money(result.cents)}</strong>}
      {result.calculation && <p>{result.calculation}</p>}
      <p className="assessment-gate">{result.reviewGate}</p>
    </div>
    <ul className="assessment-findings">{result.findings.map((finding, i) => <li key={i}>{finding.message} {finding.sources.map(id => <a key={id} href={sources.find(source => source.id === id)!.url} target="_blank" rel="noreferrer">ATO: {id === 'phone' ? 'phone expenses' : id === 'fixed' ? 'fixed rate' : 'records'}</a>)}</li>)}</ul>
    <details className="evidence-source"><summary>Assessment version and assumptions</summary><p>{result.ruleVersion}. One bill, supported year, employee use, service charges only. User confirmations are not independently verified. No handset depreciation, income, withholding, refund or complete return is calculated. The source register below records when guidance was retrieved.</p></details>
  </section>
}
