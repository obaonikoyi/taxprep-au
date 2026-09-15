import { currency } from '../expenses/expenseReview'
import { sourceTotal, type ExpenseSource } from './expenseImport'

export default function SourceTransactions({ sources, amount }: { sources: ExpenseSource[]; amount: number }) {
  const total = sourceTotal(sources)
  return <details className="source-transactions">
    <summary>{sources.length} source transaction{sources.length === 1 ? '' : 's'} · {currency.format(total)} original spending</summary>
    <p className="field-help">These are the original CSV rows. A bank transaction alone does not establish work use or supporting evidence.</p>
    {Math.round(amount * 100) !== Math.round(total * 100) && <p className="source-adjustment">Amount adjusted to {currency.format(amount)}. Original CSV spending remains {currency.format(total)}.</p>}
    <ul>{sources.map(row => <li key={row.key}><strong>{row.description}</strong><span>{row.date} · {currency.format(row.amount)}</span><span>{row.fileName} · Row {row.rowNumber}</span></li>)}</ul>
  </details>
}
