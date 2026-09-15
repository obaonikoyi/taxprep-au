import { useEffect, useState } from 'react'
import ReportExport from '../reports/ReportExport'
import SourceTransactions from '../transactions/SourceTransactions'
import { categories, categoryLabels, currency, evidenceLabels, reimbursementLabels, fetchExpenseReview, type Expense, type ExpenseCategory, type ExpenseReviewResult } from './expenseReview'

interface Props { expenses: Expense[]; onEdit: (category: ExpenseCategory) => void; onRemove: (category: ExpenseCategory) => void }
type ReviewState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; result: ExpenseReviewResult }

export default function ExpenseSummary({ expenses, onEdit, onRemove }: Props) {
  const [state, setState] = useState<ReviewState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!expenses.length) return
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => {
      active = false
      controller.abort()
      setState({ status: 'error', message: 'The review took too long. Your entries are still here; try again.' })
    }, 15_000)
    fetchExpenseReview(expenses, controller.signal).then(result => {
      if (active) setState({ status: 'success', result })
    }).catch(error => {
      if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not complete the review. Try again.' })
    }).finally(() => clearTimeout(timeout))
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [expenses, attempt])

  const result = state.status === 'success' ? state.result : null
  return (
    <div className="expense-summary">
      <p className="lead">Review the amounts and evidence below. A work portion is an organising calculation, not an approved deduction or a refund estimate.</p>
      {expenses.length === 0 ? <aside className="next-action"><strong>No expenses recorded</strong><p>You skipped all categories or removed your entries. Add an expense below to explore the summary.</p></aside> : <>
        {state.status === 'loading' && <p role="status">Reviewing your expense details…</p>}
        {state.status === 'error' && <div className="review-error"><p role="alert">{state.message}</p><button className="secondary-button" onClick={() => { setState({ status: 'loading' }); setAttempt(value => value + 1) }}>Retry review</button></div>}
        {result && <>
          <dl className="review-totals">
            <div><dt>Amount entered</dt><dd>{currency.format(result.enteredTotal)}</dd></div>
            <div><dt>{result.unresolvedCount > 0 ? 'Known work portions' : 'Recorded work portions'}</dt><dd>{currency.format(result.workPortionTotal)}</dd></div>
            <div><dt>Items needing attention</dt><dd>{result.attentionCount}</dd></div>
          </dl>
          <p className="field-help">Work portions include amounts with missing evidence. Fully reimbursed and 0% work-use items contribute $0. All items still need a tax eligibility check.</p>
          {result.unresolvedCount > 0 && <p className="form-message form-message--error">Partial total: {result.unresolvedCount} item(s) have an unresolved reimbursement and are not included.</p>}
          <ReportExport expenses={expenses} review={result} />
        </>}
      </>}
      <div className="expense-review-list">
        {categories.map(category => {
          const expense = expenses.find(item => item.category === category)
          const reviewed = result?.items.find(item => item.category === category)
          return <article key={category} aria-label={categoryLabels[category]}>
            <div className="expense-card-heading"><h4>{categoryLabels[category]}</h4>
              {reviewed && <span className={`expense-status expense-status--${reviewed.status}`}>{reviewed.status === 'excluded' ? 'Excluded from total' : reviewed.status === 'needs-attention' ? 'Needs attention' : 'Details recorded'}</span>}
            </div>
            {expense ? <>
              <p className="expense-calculation">{currency.format(expense.amount)} × {expense.workUsePercent}% work use</p>
              {reviewed && <p><strong>{reviewed.workPortion === null ? 'Work portion unresolved' : `${currency.format(reviewed.workPortion)} recorded work portion`}</strong></p>}
              <dl className="expense-notes">
                <div><dt>Work purpose</dt><dd>{expense.purpose || 'Not recorded'}</dd></div>
                <div><dt>Percentage basis</dt><dd>{expense.workUseBasis || 'Not recorded'}</dd></div>
                <div><dt>Reimbursement</dt><dd>{reimbursementLabels[expense.reimbursement]}</dd></div>
                <div><dt>Evidence</dt><dd>{evidenceLabels[expense.evidence]}{expense.evidenceReference ? ` · ${expense.evidenceReference}` : ''}</dd></div>
              </dl>
              {reviewed && reviewed.actions.length > 0 && <ul className="review-actions">{reviewed.actions.map(action => <li key={action}>{action}</li>)}</ul>}
              {expense.sources && <SourceTransactions sources={expense.sources} amount={expense.amount} />}
              <div className="expense-card-actions"><button className="text-button" onClick={() => onEdit(category)}>Edit {categoryLabels[category].toLowerCase()}</button><button className="text-button remove-expense" onClick={() => onRemove(category)}>Remove {categoryLabels[category].toLowerCase()}</button></div>
            </> : <><p>No expense recorded.</p><button className="text-button" onClick={() => onEdit(category)}>Add {categoryLabels[category].toLowerCase()}</button></>}
          </article>
        })}
      </div>
      <aside className="next-action"><strong>What needs checking next?</strong><p>Locate the evidence, check the work-use basis and review whether each expense meets the relevant rules before entering any claim in myTax.</p></aside>
    </div>
  )
}
