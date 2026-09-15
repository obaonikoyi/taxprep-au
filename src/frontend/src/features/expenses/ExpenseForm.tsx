import { useRef, useState, type FormEvent } from 'react'
import { categoryLabels, sampleExpenses, type Expense, type ExpenseCategory, type Evidence, type Reimbursement } from './expenseReview'

interface Props {
  category: ExpenseCategory
  initial?: Expense
  onSave: (expense: Expense) => void
  onCancel: () => void
}

export default function ExpenseForm({ category, initial, onSave, onCancel }: Props) {
  const [amount, setAmount] = useState(initial?.amount.toString() ?? '')
  const [percent, setPercent] = useState(initial?.workUsePercent.toString() ?? '')
  const [purpose, setPurpose] = useState(initial?.purpose ?? '')
  const [basis, setBasis] = useState(initial?.workUseBasis ?? '')
  const [reimbursement, setReimbursement] = useState<Reimbursement | ''>(initial?.reimbursement ?? '')
  const [evidence, setEvidence] = useState<Evidence | ''>(initial?.evidence ?? '')
  const [reference, setReference] = useState(initial?.evidenceReference ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const form = useRef<HTMLFormElement>(null)

  function loadExample() {
    const example = sampleExpenses.find(item => item.category === category)!
    setAmount(String(example.amount)); setPercent(String(example.workUsePercent))
    setPurpose(example.purpose); setBasis(example.workUseBasis)
    setReimbursement(example.reimbursement); setEvidence(example.evidence)
    setReference(example.evidenceReference); setErrors({})
  }

  function save(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1_000_000)
      next.amount = 'Enter $0.01 to $1,000,000, with up to two decimal places.'
    if (!/^\d{1,3}$/.test(percent) || Number(percent) > 100)
      next.percent = 'Enter a whole percentage from 0 to 100.'
    if (!reimbursement) next.reimbursement = 'Choose a reimbursement status.'
    if (!evidence) next.evidence = 'Choose an evidence status.'
    setErrors(next)
    const firstError = Object.keys(next)[0]
    if (firstError) {
      form.current?.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus()
      return
    }
    onSave({ category, amount: Number(amount), workUsePercent: Number(percent), purpose: purpose.trim(),
      workUseBasis: basis.trim(), reimbursement: reimbursement as Reimbursement, evidence: evidence as Evidence,
      evidenceReference: evidence === 'available' ? reference.trim() : '' })
  }

  return (
    <form className="expense-form" ref={form} onSubmit={save} noValidate aria-label={`${categoryLabels[category]} details`}>
      <p className="lead">Record one fictional expense in this category. You can leave notes unfinished and return to them from the summary.</p>
      {category === 'travel' && <p className="field-help">Use bus, train or taxi fares for this example. Own-car costs and kilometre calculations need a separate workflow.</p>}
      {category === 'phone' && <p className="field-help">Use a phone service bill for this example. Buying a handset needs a separate equipment review.</p>}
      <button className="text-button" type="button" onClick={loadExample}>Use example details</button>
      {Object.keys(errors).length > 0 && <p role="alert" className="form-message form-message--error">Check the highlighted fields.</p>}
      <div className="expense-fields">
        <div>
          <label htmlFor="expense-amount">Amount paid (AUD)</label>
          <input id="expense-amount" name="amount" inputMode="decimal" value={amount} maxLength={12} onChange={event => setAmount(event.target.value)} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'amount-error' : undefined} />
          {errors.amount && <p id="amount-error" className="field-error">{errors.amount}</p>}
        </div>
        <div>
          <label htmlFor="expense-percent">Work use (%)</label>
          <input id="expense-percent" name="percent" inputMode="numeric" value={percent} maxLength={3} onChange={event => setPercent(event.target.value)} aria-invalid={!!errors.percent} aria-describedby={errors.percent ? 'percent-error' : 'percent-help'} />
          {errors.percent ? <p id="percent-error" className="field-error">{errors.percent}</p> : <p id="percent-help" className="field-help">0 = personal use; 100 = all work use.</p>}
        </div>
      </div>
      <label htmlFor="expense-purpose">Work purpose <span>(optional)</span></label>
      <textarea id="expense-purpose" rows={2} maxLength={300} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="How was this used for Sarah’s work?" />
      <label htmlFor="expense-basis">How was the percentage worked out? <span>(optional)</span></label>
      <textarea id="expense-basis" rows={2} maxLength={300} value={basis} onChange={event => setBasis(event.target.value)} placeholder="For example, a usage diary. Up to 300 characters." />
      <label htmlFor="expense-reimbursement">Was Sarah reimbursed?</label>
      <select id="expense-reimbursement" name="reimbursement" value={reimbursement} onChange={event => setReimbursement(event.target.value as Reimbursement)} aria-invalid={!!errors.reimbursement} aria-describedby={errors.reimbursement ? 'reimbursement-error' : undefined}>
        <option value="">Choose an option</option><option value="none">No reimbursement</option><option value="full">Fully reimbursed</option><option value="unsure">Partly reimbursed / not sure</option>
      </select>
      {errors.reimbursement && <p id="reimbursement-error" className="field-error">{errors.reimbursement}</p>}
      <label htmlFor="expense-evidence">Supporting evidence</label>
      <select id="expense-evidence" name="evidence" value={evidence} onChange={event => setEvidence(event.target.value as Evidence)} aria-invalid={!!errors.evidence} aria-describedby={errors.evidence ? 'evidence-error' : undefined}>
        <option value="">Choose an option</option><option value="available">Available</option><option value="missing">Missing</option><option value="unsure">Not sure</option>
      </select>
      {errors.evidence && <p id="evidence-error" className="field-error">{errors.evidence}</p>}
      {evidence === 'available' && <>
        <label htmlFor="expense-reference">Evidence reference <span>(optional)</span></label>
        <input id="expense-reference" maxLength={120} value={reference} onChange={event => setReference(event.target.value)} placeholder="For example, sample phone bill and diary" />
        <p className="field-help">A reminder of where the evidence is. No receipt files are uploaded.</p>
      </>}
      <div className="button-row">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel changes</button>
        <button className="primary-button" type="submit">Save expense</button>
      </div>
    </form>
  )
}
