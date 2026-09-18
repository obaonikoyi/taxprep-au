import { money, pairKey } from '../documents/evidence'
import { changeIncome, incomeProblems, incomeSummary, MAX_INCOME_RECORDS, newIncome, removeIncome, type Answer, type IncomeFields, type Preparation } from './preparation'
import { incomeGuidance } from './guidance'
interface Props { value: Preparation; onChange: (value: Preparation) => void }
export default function IncomeEditor({ value, onChange }: Props) {
  const summary = incomeSummary(value)
  function add(kind: IncomeFields['kind']) {
    if (value.income.length < MAX_INCOME_RECORDS) onChange({ ...value, incomeComplete: '', income: [...value.income, newIncome(crypto.randomUUID(), kind)] })
  }
  return <section aria-label="Income records" className="income-editor">
    <p>Use tax-ready salary income statements or final payment summaries, and final annual bank interest statements. Enter gross amounts and tax withheld separately. Net deposits and transfers are not imported as income. This first path covers salary/wages and interest from accounts you solely own.</p>
    <p className="field-help">Gross interest includes any amount withheld by the bank. The figures here are recorded amounts, not validated tax credits. <a href={incomeGuidance[0].url} target="_blank" rel="noreferrer">ATO salary guidance</a> · <a href={incomeGuidance[1].url} target="_blank" rel="noreferrer">ATO interest guidance</a></p>
    <div className="button-row"><button className="secondary-button" disabled={value.income.length >= MAX_INCOME_RECORDS} onClick={() => add('salary')}>Add salary record</button><button className="secondary-button" disabled={value.income.length >= MAX_INCOME_RECORDS} onClick={() => add('interest')}>Add interest record</button></div>
    {value.income.length >= MAX_INCOME_RECORDS && <p className="field-help">This preview supports up to 20 annual records.</p>}
    {summary.conflicts.length > 0 && <div className="match-panel"><h4>Check possible duplicate income</h4><p>Matching source references or the same payer and income type in one year may represent the same annual income. Amended statements usually need review of which record to keep. Neither is counted until resolved.</p>{summary.conflicts.map(([a, b]) => {
      const first = value.income.find(row => row.id === a)!, second = value.income.find(row => row.id === b)!
      return <div key={pairKey(a, b)}><p>{first.payer} · {first.reference}<br />{second.payer} · {second.reference}</p><button className="secondary-button" disabled={!first.reviewed || !second.reviewed} onClick={() => onChange({ ...value, separate: [...value.separate, pairKey(a, b)] })}>These are separate income records</button><p className="field-help">Review both records first. If duplicated, remove the extra record below.</p></div>
    })}</div>}
    {summary.items.map(({ item, included, issues }, index) => {
      const patch = (fields: Partial<IncomeFields>) => onChange(changeIncome(value, item.id, fields))
      return <article className="income-card" aria-label={`Income record ${index + 1}`} key={item.id}>
        <div className="income-heading"><div><p className="eyebrow">{item.kind === 'salary' ? 'Salary / wages' : 'Australian bank interest'} · {item.origin === 'sample' ? 'Synthetic sample' : 'Manually entered'}</p><h4>{item.payer || `Income record ${index + 1}`}</h4></div><button className="text-button" onClick={() => onChange(removeIncome(value, item.id))}>Remove income record {index + 1}</button></div>
        <div className="evidence-form">
          <label>{item.kind === 'salary' ? 'Employer name' : 'Bank name'}<input maxLength={120} value={item.payer} onChange={event => patch({ payer: event.target.value })} /></label>
          <label>Source reference<input maxLength={160} placeholder="Fictional annual statement, page 1" value={item.reference} onChange={event => patch({ reference: event.target.value })} /></label>
          <label>Statement year<select aria-label="Statement year" value={item.year} onChange={event => patch({ year: event.target.value })}><option value="2025-26">2025–26</option><option value="other">Another or unknown year</option></select></label>
          <label>Gross income (AUD)<input inputMode="decimal" maxLength={16} value={item.gross} onChange={event => patch({ gross: event.target.value })} /></label>
          <label>Tax withheld (AUD)<input inputMode="decimal" maxLength={16} value={item.withheld} onChange={event => patch({ withheld: event.target.value })} /></label>
          <label>Is the annual source finalised?<select aria-label="Is the annual source finalised?" value={item.finalised} onChange={event => patch({ finalised: event.target.value as Answer })}><option value="">Choose an answer</option><option value="yes">Yes · finalised</option><option value="no">No · provisional or incomplete</option><option value="unsure">Unsure</option></select></label>
          {item.kind === 'interest' && <label>Are you the sole account owner?<select aria-label="Are you the sole account owner?" value={item.soleOwner} onChange={event => patch({ soleOwner: event.target.value as Answer })}><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No · joint ownership</option><option value="unsure">Unsure</option></select></label>}
        </div>
        <p className="field-help">Use a fictional reference, not a TFN, bank account number or other personal identifier. Enter 0 explicitly when no tax was withheld. Extra employment fields need separate review.</p>
        <p className="income-status">{included ? 'Reviewed · included in recorded totals' : 'Needs review · excluded from recorded totals'}</p>
        {issues.length > 0 && <ul className="evidence-questions">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        <button className="secondary-button" disabled={incomeProblems(item).length > 0 || item.reviewed} onClick={() => onChange({ ...value, income: value.income.map(row => row.id === item.id ? { ...row, reviewed: true } : row) })}>{item.reviewed ? 'Source reviewed' : 'Confirm income record'}</button>
        {item.original && <details className="evidence-source"><summary>Original sample values</summary><p>{item.original.payer} · {item.original.reference} · {item.original.year}<br />Gross: {money(Number(item.original.gross) * 100)} · withheld: {money(Number(item.original.withheld) * 100)}. Your edits do not change this original sample.</p></details>}
      </article>
    })}
    <div className="evidence-form"><label>Have you added all salary/wage and Australian bank-interest records?<select aria-label="Have you added all salary/wage and Australian bank-interest records?" value={value.incomeComplete} onChange={event => onChange({ ...value, incomeComplete: event.target.value as Answer })}><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No · more records to add</option><option value="unsure">Unsure</option></select></label><p className="field-help">This confirms the income list only. Other income and personal circumstances are checked below.</p></div>
  </section>
}
