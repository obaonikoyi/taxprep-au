import { useEffect, useRef, useState } from 'react'
import { demoProfile, demoQuestions } from './demoData'
import ExpenseForm from '../expenses/ExpenseForm'
import ExpenseSummary from '../expenses/ExpenseSummary'
import TransactionUpload from '../../components/TransactionUpload'
import { selectionError, sourceTotal, type ExpenseSource } from '../transactions/expenseImport'
import { categoryLabels, currency, sampleExpenses, type Expense, type ExpenseCategory } from '../expenses/expenseReview'

type Step = { kind: 'welcome' | 'income' | 'summary' } | { kind: 'questions'; index: number }
  | { kind: 'details'; category: ExpenseCategory; returnTo: 'questions' | 'summary'; index: number; draft?: Partial<Expense> }

export default function GuidedDemo() {
  const [step, setStep] = useState<Step>({ kind: 'welcome' })
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [session, setSession] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) heading.current?.focus()
    mounted.current = true
  }, [step])

  const question = step.kind === 'questions' ? demoQuestions[step.index] : null
  const title = step.kind === 'welcome' ? `Meet ${demoProfile.name}`
    : step.kind === 'income' ? 'Confirm Sarah’s income'
    : step.kind === 'summary' ? 'Sarah’s preparation summary'
    : step.kind === 'details' ? `${categoryLabels[step.category]} details` : question!.title
  const progress = step.kind === 'welcome' ? 0 : step.kind === 'income' ? 1 : step.kind === 'summary' ? 3 : 2

  function nextQuestion(index: number) {
    setStep(index === demoQuestions.length - 1 ? { kind: 'summary' } : { kind: 'questions', index: index + 1 })
  }
  function saveExpense(expense: Expense) {
    setExpenses(current => [...current.filter(item => item.category !== expense.category), expense])
    if (step.kind === 'details' && step.returnTo === 'questions') nextQuestion(step.index)
    else setStep({ kind: 'summary' })
  }
  function restart() { setExpenses([]); setSession(value => value + 1); setStep({ kind: 'welcome' }) }
  function prepareSelection(category: ExpenseCategory, sources: ExpenseSource[]) {
    const used = new Map(expenses.flatMap(expense => (expense.sources ?? []).map(row => [row.key, categoryLabels[expense.category]] as const)))
    if (step.kind === 'details' || expenses.some(expense => expense.category === category) || selectionError(sources, used)) return
    setStep({ kind: 'details', category, returnTo: 'summary', index: 0, draft: { amount: sourceTotal(sources), sources } })
  }

  return (
    <><section className="demo" id="guided-demo" aria-labelledby="demo-title">
      <div className="demo-heading">
        <div><p className="eyebrow">Interactive portfolio demo</p><h2 id="demo-title">Turn expense details into a clear checklist.</h2></div>
        <span className="demo-badge">Fictional data</span>
      </div>
      <div className="demo-shell">
        <aside className="demo-sidebar" aria-label="Demo progress">
          <p className="sidebar-label">Preparation journey</p>
          <ol>{['Start demo', 'Confirm income', 'Work expenses', 'Review summary'].map((label, index) => <li key={label} className={progress === index ? 'active' : ''} aria-current={progress === index ? 'step' : undefined}>{label}</li>)}</ol>
          <p className="privacy-note">Use fictional details only. No account or identity details needed.</p>
        </aside>
        <div className="demo-content">
          <div>
            <p className="step-label">Step {progress + 1} of 4{step.kind === 'questions' ? ` · Question ${step.index + 1} of ${demoQuestions.length}` : ''}</p>
            <h3 ref={heading} tabIndex={-1} className="step-heading">{title}</h3>
            {step.kind === 'welcome' && <>
              <p className="lead">Explore a fictional support worker’s expenses, spot missing evidence and see how work-use percentages change the summary.</p>
              <dl className="profile-grid"><div><dt>Occupation</dt><dd>{demoProfile.occupation}</dd></div><div><dt>Financial year</dt><dd>{demoProfile.financialYear}</dd></div></dl>
              <div className="button-row"><button className="primary-button" onClick={() => setStep({ kind: 'income' })}>Try demo</button><button className="secondary-button" onClick={() => { setExpenses(sampleExpenses.map(item => ({ ...item }))); setStep({ kind: 'summary' }) }}>Explore example summary</button></div>
            </>}
            {step.kind === 'income' && <>
              <p className="lead">These are fictional sample values, not information retrieved from the ATO.</p>
              <div className="income-grid"><div><span>Employment income</span><strong>{currency.format(demoProfile.employmentIncome)}</strong></div><div><span>Tax withheld</span><strong>{currency.format(demoProfile.taxWithheld)}</strong></div></div>
              <div className="button-row"><button className="secondary-button" onClick={() => setStep({ kind: 'welcome' })}>Back</button><button className="primary-button" onClick={() => setStep({ kind: 'questions', index: 0 })}>Information is correct</button></div>
            </>}
            {step.kind === 'questions' && question && <>
              <p className="lead">{question.description}</p>
              <div className="answer-grid">
                <button onClick={() => setStep({ kind: 'details', category: question.id, returnTo: 'questions', index: step.index })}><strong>Yes</strong><span>Add an amount and evidence details</span></button>
                <button onClick={() => { setExpenses(current => current.filter(item => item.category !== question.id)); nextQuestion(step.index) }}><strong>No</strong><span>Skip this expense category</span></button>
              </div>
              <button className="text-button question-back" onClick={() => setStep(step.index === 0 ? { kind: 'income' } : { kind: 'questions', index: step.index - 1 })}>Previous step</button>
            </>}
            {step.kind === 'details' && <ExpenseForm key={step.category} category={step.category} initial={step.draft ?? expenses.find(item => item.category === step.category)} onSave={saveExpense} onCancel={() => setStep(step.returnTo === 'summary' ? { kind: 'summary' } : { kind: 'questions', index: step.index })} />}
            {step.kind === 'summary' && <>
              {/* Remount on an edited list so old totals/errors disappear immediately and its request is aborted. */}
              <ExpenseSummary key={JSON.stringify(expenses)} expenses={expenses} onEdit={category => setStep({ kind: 'details', category, returnTo: 'summary', index: 0 })} onRemove={category => setExpenses(current => current.filter(item => item.category !== category))} />
              <button className="secondary-button" onClick={restart}>Restart demo</button>
            </>}
            <p className="demo-data-note">Fictional details only. Saved entries stay in this tab until restart or refresh. Viewing a summary sends them to the server for an in-memory review; they are not stored.</p>
          </div>
        </div>
      </div>
    </section>
    <TransactionUpload key={session} selection={{ expenses, disabled: step.kind === 'details', onPrepare: prepareSelection }} />
    </>
  )
}
