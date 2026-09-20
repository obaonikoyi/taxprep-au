import { useMemo, useRef, useState } from 'react'
import { aud } from './payslip'
import {
  bankCheckStatusLabel,
  blankBankDepositAnswer,
  blankYearEndPreparationAnswers,
  buildYearEndPreparation,
  coverageStatusLabel,
  type BankDepositAnswer,
  type CoverageStatus,
  type YearEndPreparationAnswers,
} from './yearEndPreparation'
import { downloadYearEndPreparationReport, yearEndPreparationReport } from './yearEndPreparationReport'
import type { YearEndReconciliation } from './yearEndReconciliation'
import {
  coveragePatchFromHandoff,
  handoffLabel,
  handoffSummaryLines,
  readYearEndHandoff,
  type YearEndHandoff,
} from '../handoff/yearEndHandoff'

type Props = {
  reconciliation: YearEndReconciliation
}

const difference = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${aud(value)}`

export default function YearEndPreparationHub({ reconciliation }: Props) {
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<YearEndPreparationAnswers>(() => blankYearEndPreparationAnswers())
  const [handoffs, setHandoffs] = useState<YearEndHandoff[]>([])
  const [handoffCandidate, setHandoffCandidate] = useState<YearEndHandoff | null>(null)
  const [handoffMessage, setHandoffMessage] = useState('')
  const [handoffError, setHandoffError] = useState('')
  const handoffInput = useRef<HTMLInputElement>(null)
  const result = useMemo(() => buildYearEndPreparation(reconciliation, answers, handoffs), [reconciliation, answers, handoffs])

  function patchBank(key: string, patch: Partial<BankDepositAnswer>) {
    setAnswers(current => ({
      ...current,
      bank: {
        ...current.bank,
        [key]: { ...(current.bank[key] ?? blankBankDepositAnswer()), ...patch },
      },
    }))
  }

  function patchExpense(patch: Partial<YearEndPreparationAnswers['expenses']>) {
    setAnswers(current => ({ ...current, expenses: { ...current.expenses, ...patch } }))
  }

  async function importHandoff(file: File) {
    setHandoffError('')
    setHandoffMessage('Checking year-end handoff…')
    try {
      const next = await readYearEndHandoff(file, reconciliation.year)
      if (handoffs.some(item => item.handoffId === next.handoffId) || handoffCandidate?.handoffId === next.handoffId) {
        throw new Error('This year-end handoff has already been imported.')
      }
      setHandoffCandidate(next)
      setHandoffMessage('Handoff checked. Review the summary before applying any coverage fields.')
    } catch (error) {
      setHandoffCandidate(null)
      setHandoffError(error instanceof Error ? error.message : 'This year-end handoff could not be read.')
      setHandoffMessage('')
    } finally {
      if (handoffInput.current) handoffInput.current.value = ''
    }
  }

  function applyHandoff() {
    if (!handoffCandidate) return
    const patch = coveragePatchFromHandoff(handoffCandidate)
    setAnswers(current => ({ ...current, expenses: { ...current.expenses, ...patch } }))
    setHandoffs(current => [...current, handoffCandidate])
    setHandoffMessage(`${handoffLabel(handoffCandidate)} applied. Source hashes remain attached to the preparation handover.`)
    setHandoffError('')
    setHandoffCandidate(null)
  }

  function coverageSelect(label: string, key: keyof Pick<YearEndPreparationAnswers['expenses'], 'bankSpending' | 'receiptEvidence' | 'workPurpose' | 'ruleReview'>) {
    return <label>{label}
      <select aria-label={`Year-end prep: ${key}`} value={answers.expenses[key]} onChange={event => patchExpense({ [key]: event.target.value as CoverageStatus })}>
        <option value="">Choose coverage</option>
        <option value="complete">Reviewed for this preparation pass</option>
        <option value="partial">Partly reviewed</option>
        <option value="not-reviewed">Not reviewed</option>
        <option value="not-applicable">Not applicable</option>
      </select>
    </label>
  }

  return <section className="year-end-preparation-hub" aria-labelledby="year-end-preparation-heading">
    <div className="year-end-prep-heading">
      <div>
        <p className="eyebrow">Milestone 16C · preparation hub</p>
        <h4 id="year-end-preparation-heading">Bring the year-end checks into one handover</h4>
        <p>Keep the reconciled employment sources above, then record optional bank-deposit checks and expense/evidence coverage for {reconciliation.year}. This does not create a tax result.</p>
      </div>
      <span className="year-end-badge locked">Session only</span>
    </div>

    <div className="year-end-prep-boundary">
      <strong>Bank deposits are a completeness check, not income evidence.</strong>
      <p>TaxPrep compares a user-entered bank deposit total with checked payslip <strong>net pay</strong>. It never derives gross income, tax withheld or taxable income from a bank deposit.</p>
    </div>

    {!open ? <button className="secondary-button" onClick={() => setOpen(true)}>Start year-end preparation hub</button> : <>
      <div className="year-end-prep-metrics" aria-label="Year-end preparation coverage">
        <div><span>Income questions</span><strong>{result.incomeOpenQuestions}</strong><small>From pay + annual-source reconciliation</small></div>
        <div><span>Bank checks reviewed</span><strong>{result.bankReviewed}/{result.bankEmployers}</strong><small>Optional completeness checks</small></div>
        <div><span>Expense/evidence areas</span><strong>{result.expenseAreasAnswered}/{result.expenseAreas}</strong><small>Coverage answers recorded</small></div>
        <div><span>Open preparation questions</span><strong>{result.questions.length}</strong><small>Remain visible in export</small></div>
      </div>

      <section className="year-end-prep-section year-end-handoff-import" aria-labelledby="workspace-handoff-heading">
        <div className="year-end-prep-section-heading">
          <div><p className="eyebrow">Explicit cross-workspace handoff</p><h5 id="workspace-handoff-heading">Import reviewed coverage from another TaxPrep workspace</h5></div>
          <span>{handoffs.length} applied</span>
        </div>
        <p className="year-end-prep-help">Bank spending and Tax documents can export a small JSON summary with coverage counts and source SHA-256 references. TaxPrep checks the version and financial year first. Nothing changes until you choose <strong>Apply imported coverage</strong>.</p>
        <p className="year-end-prep-help"><strong>Not transferred:</strong> raw bank transactions, merchant descriptions, OCR text, employer matching or an approved deduction. Rule-review coverage is never auto-completed.</p>
        <div className="year-end-handoff-actions">
          <label className="secondary-button year-end-handoff-file">Import year-end handoff
            <input ref={handoffInput} aria-label="Import year-end handoff" type="file" accept=".json,application/json" onChange={event => {
              const file = event.target.files?.[0]
              if (file) void importHandoff(file)
            }} />
          </label>
        </div>
        <p className="year-end-handoff-message" role="status">{handoffMessage}</p>
        {handoffError && <div className="annual-statement-error" role="alert"><strong>Handoff not applied.</strong><p>{handoffError}</p></div>}

        {handoffCandidate && <article className="year-end-handoff-candidate" role="region" aria-label="Review imported year-end handoff">
          <div className="year-end-bank-title">
            <div><p className="eyebrow">Candidate only</p><h6>{handoffLabel(handoffCandidate)}</h6><p>{handoffCandidate.financialYear} · {handoffCandidate.sourceHashes.length} source hash{handoffCandidate.sourceHashes.length === 1 ? '' : 'es'}</p></div>
            <button className="text-button" onClick={() => { setHandoffCandidate(null); setHandoffMessage('Handoff candidate discarded. No preparation fields changed.') }}>Discard handoff</button>
          </div>
          <ul className="year-end-handoff-summary">{handoffSummaryLines(handoffCandidate).map(line => <li key={line}>{line}</li>)}</ul>
          <details className="statement-help year-end-handoff-hashes"><summary>Source SHA-256 references</summary><ul>{handoffCandidate.sourceHashes.map(hash => <li key={hash}><code>{hash}</code></li>)}</ul></details>
          <button className="primary-button" onClick={applyHandoff}>Apply imported coverage</button>
        </article>}

        {handoffs.length > 0 && <div className="year-end-handoff-applied" aria-label="Applied year-end handoffs">
          <strong>Applied workspace summaries</strong>
          <ul>{handoffs.map(handoff => <li key={handoff.handoffId}><span>{handoffLabel(handoff)} · {handoff.financialYear}</span><small>{handoff.sourceHashes.length} source hash{handoff.sourceHashes.length === 1 ? '' : 'es'} retained in export</small></li>)}</ul>
        </div>}
      </section>

      <section className="year-end-prep-section" aria-labelledby="bank-deposit-checks-heading">
        <div className="year-end-prep-section-heading">
          <div><p className="eyebrow">Optional cross-check</p><h5 id="bank-deposit-checks-heading">Compare checked net pay with bank deposits</h5></div>
          <span>{result.bankEmployers} employer{result.bankEmployers === 1 ? '' : 's'}</span>
        </div>
        <p className="year-end-prep-help">Use totals from your bank review if you already checked them. Split payments, delayed deposits and missing entries stay as notes/questions; they do not replace payslip or annual-source figures.</p>

        <div className="year-end-bank-list">
          {result.bankRows.map(row => {
            const answer = answers.bank[row.employerKey] ?? blankBankDepositAnswer()
            return <article className="year-end-bank-card" key={row.employerKey} aria-label={`Bank check for ${row.employerName}`}>
              <div className="year-end-bank-title">
                <div><h6>{row.employerName}</h6><p>{row.payslipCount} checked payslip{row.payslipCount === 1 ? '' : 's'} · checked net pay {row.checkedNet === null ? 'not fully available' : aud(row.checkedNet)}</p></div>
                <span>{bankCheckStatusLabel(row.status)}</span>
              </div>
              <div className="year-end-bank-form">
                <label>Deposit check status
                  <select aria-label={`Bank check: ${row.employerName} status`} value={answer.status} onChange={event => patchBank(row.employerKey, { status: event.target.value as BankDepositAnswer['status'] })}>
                    <option value="">Choose status</option>
                    <option value="matched">Deposits matched checked net pay</option>
                    <option value="split-timing">Split or timing difference</option>
                    <option value="missing-deposit">Possible missing deposit</option>
                    <option value="not-checked">Not checked</option>
                    <option value="unsure">Unsure</option>
                  </select>
                </label>
                <label>Bank deposit total (AUD)
                  <input aria-label={`Bank check: ${row.employerName} deposit total (AUD)`} inputMode="decimal" placeholder="Optional unless marked matched" value={answer.depositTotal} onChange={event => patchBank(row.employerKey, { depositTotal: event.target.value })} />
                </label>
                <label className="year-end-bank-note">Split/timing/missing note
                  <textarea aria-label={`Bank check: ${row.employerName} note`} maxLength={800} rows={3} placeholder="Example: one payday landed two days later; two deposits made up one pay." value={answer.note} onChange={event => patchBank(row.employerKey, { note: event.target.value })} />
                </label>
              </div>
              <div className="year-end-bank-result">
                <span>Difference (deposits − checked net pay)</span><strong>{difference(row.difference)}</strong>
              </div>
              {row.issues.length > 0 && <ul className="year-end-issues">{row.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
            </article>
          })}
        </div>
      </section>

      <section className="year-end-prep-section" aria-labelledby="expense-coverage-heading">
        <div className="year-end-prep-section-heading">
          <div><p className="eyebrow">Expense and evidence coverage</p><h5 id="expense-coverage-heading">Record what you already reviewed</h5></div>
          <span>No deduction approval</span>
        </div>
        <p className="year-end-prep-help">These answers can be copied from the Bank spending and Tax documents workflows. They are session notes only; TaxPrep does not silently move or store your statement/receipt files between tools.</p>

        <div className="year-end-expense-form">
          {coverageSelect('Bank spending review', 'bankSpending')}
          {coverageSelect('Receipt / evidence review', 'receiptEvidence')}
          {coverageSelect('Work-purpose answers', 'workPurpose')}
          {coverageSelect('Applicable supported-rule review', 'ruleReview')}
          <label>Reviewed transactions
            <input aria-label="Year-end prep: reviewedTransactions" inputMode="numeric" value={answers.expenses.reviewedTransactions} onChange={event => patchExpense({ reviewedTransactions: event.target.value })} />
          </label>
          <label>Transactions flagged for work review
            <input aria-label="Year-end prep: workReviewTransactions" inputMode="numeric" value={answers.expenses.workReviewTransactions} onChange={event => patchExpense({ workReviewTransactions: event.target.value })} />
          </label>
          <label>Receipt / evidence items
            <input aria-label="Year-end prep: receiptCount" inputMode="numeric" value={answers.expenses.receiptCount} onChange={event => patchExpense({ receiptCount: event.target.value })} />
          </label>
          <label>Work-purpose answers recorded
            <input aria-label="Year-end prep: workPurposeCount" inputMode="numeric" value={answers.expenses.workPurposeCount} onChange={event => patchExpense({ workPurposeCount: event.target.value })} />
          </label>
          <label>Amount flagged for work review (AUD)
            <input aria-label="Year-end prep: flaggedWorkAmount" inputMode="decimal" value={answers.expenses.flaggedWorkAmount} onChange={event => patchExpense({ flaggedWorkAmount: event.target.value })} />
            <small>This is not an approved deduction.</small>
          </label>
          <label className="year-end-expense-note">Preparation note
            <textarea aria-label="Year-end prep: expenseNote" maxLength={1200} rows={4} placeholder="Keep unresolved receipt, work-purpose or rule questions here." value={answers.expenses.note} onChange={event => patchExpense({ note: event.target.value })} />
          </label>
        </div>
        {result.expenses.issues.length > 0 && <ul className="year-end-issues">{result.expenses.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}

        <div className="year-end-expense-statuses">
          <span>Bank spending: <strong>{coverageStatusLabel(result.expenses.bankSpending)}</strong></span>
          <span>Evidence: <strong>{coverageStatusLabel(result.expenses.receiptEvidence)}</strong></span>
          <span>Work purpose: <strong>{coverageStatusLabel(result.expenses.workPurpose)}</strong></span>
          <span>Rules: <strong>{coverageStatusLabel(result.expenses.ruleReview)}</strong></span>
        </div>
      </section>

      <section className="year-end-prep-section year-end-prep-questions" aria-label="Year-end preparation questions">
        <div className="year-end-prep-section-heading"><div><p className="eyebrow">One review list</p><h5>Open questions and unsupported sections</h5></div><span>{result.questions.length}</span></div>
        {result.questions.length ? <ul>{result.questions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}</ul> : <p>No open questions are recorded in this preparation pass. This is not proof that the return is complete or correct.</p>}
      </section>

      <div className="year-end-prep-export">
        <div><h5>Download one year-end preparation handover</h5><p>Includes reconciled pay sources, annual-source references, optional bank checks, expense/evidence coverage and every open question.</p></div>
        <button className="primary-button" onClick={() => downloadYearEndPreparationReport(yearEndPreparationReport(result))}>Download complete preparation handover</button>
      </div>

      <details className="statement-help year-end-prep-save-boundary">
        <summary>Why TaxPrep does not save this workspace yet</summary>
        <p>Pay histories, bank checks and receipt/evidence summaries are sensitive financial data. Before adding save/resume, TaxPrep needs an explicit design for storage location, encryption, retention period, user-initiated deletion, account recovery and separation of original files from derived facts.</p>
        <p>This milestone intentionally keeps the preparation hub in the current browser session and does not turn the fictional demo storage into a document vault.</p>
      </details>
    </>}
  </section>
}
