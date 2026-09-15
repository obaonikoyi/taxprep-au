import { useMemo, useState } from 'react'
import { categories, categoryLabels, currency, type Expense, type ExpenseCategory } from '../expenses/expenseReview'
import { identifySources, MAX_SELECTED_ROWS, selectionError, sourceTotal, unavailableReason, type ExpenseSource } from './expenseImport'
import type { ImportedTransaction } from './importPreview'

export interface SelectionProps {
  expenses: Expense[]
  disabled: boolean
  onPrepare: (category: ExpenseCategory, sources: ExpenseSource[]) => void
}

export default function TransactionSelection({ transactions, fileName, expenses, disabled, onPrepare }: SelectionProps & { transactions: ImportedTransaction[]; fileName: string }) {
  const sources = useMemo(() => identifySources(transactions, fileName), [transactions, fileName])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState<ExpenseCategory | ''>('')
  const used = new Map(expenses.flatMap(expense => (expense.sources ?? []).map(row => [row.key, categoryLabels[expense.category]] as const)))
  const selected = sources.filter(row => selectedKeys.has(row.key) && !used.has(row.key))
  const occupied = expenses.some(expense => expense.category === category)
  const error = selectionError(selected, used)

  return <>
    <div className="transaction-selection">
      <h4>Prepare selected spending</h4>
      <p>Choose spending from 1 July 2025 to 30 June 2026, then pick its category. Only select rows that share the same work-use and reimbursement treatment.</p>
      <label htmlFor="import-category">Expense category</label>
      <select id="import-category" value={category} disabled={disabled} onChange={event => setCategory(event.target.value as ExpenseCategory)}>
        <option value="">Choose a category</option>
        {categories.map(value => <option key={value} value={value} disabled={expenses.some(expense => expense.category === value)}>{categoryLabels[value]}{expenses.some(expense => expense.category === value) ? ' — already recorded' : ''}</option>)}
      </select>
      <p className="field-help">One record per category, up to {MAX_SELECTED_ROWS} rows. To replace a recorded category, remove it from the summary first. Transport covers fares; phone covers service bills.</p>
      <p role="status" className="selection-total">{selected.length} selected · {currency.format(sourceTotal(selected))} spending</p>
      {error && selected.length > 0 && <p className="field-error">{error}</p>}
      {occupied && <p className="field-help">This category is already recorded. Choose another category or remove the existing expense.</p>}
      <button className="primary-button" disabled={disabled || !!error || !category || occupied} onClick={() => {
        if (!category || occupied || selectionError(selected, used)) return
        onPrepare(category, selected.map(row => ({ ...row })))
        setSelectedKeys(new Set())
      }}>Review selected spending</button>
      {disabled && <p className="field-help">Finish or cancel the expense form above before starting another import.</p>}
    </div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Transaction preview table">
      <table><thead><tr><th scope="col">Select</th><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Amount</th></tr></thead>
        <tbody>{sources.map(row => {
          const reason = unavailableReason(row, used)
          const checked = selectedKeys.has(row.key) && !used.has(row.key)
          const limitReached = !checked && selected.length >= MAX_SELECTED_ROWS
          return <tr key={row.key}>
            <td><input type="checkbox" aria-label={`Select row ${row.rowNumber}: ${row.description}`} aria-describedby={reason || limitReached ? `row-${row.rowNumber}-reason` : undefined} checked={checked} disabled={disabled || !!reason || limitReached} onChange={event => {
              const checkedNow = event.target.checked
              setSelectedKeys(current => { const next = new Set(current); if (checkedNow) next.add(row.key); else next.delete(row.key); return next })
            }} />{(reason || limitReached) && <small id={`row-${row.rowNumber}-reason`}>{reason ?? `${MAX_SELECTED_ROWS}-row limit`}</small>}</td>
            <td>{row.date}</td><td>{row.description}</td><td className={row.amount < 0 ? 'expense' : 'income'}>{currency.format(row.amount)}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </>
}
