import { analyse, reviewFor, type Reviews } from './statementAnalysis'
import { STATEMENT_VERSION, type Statement } from './statementParser'
import {
  YEAR_END_HANDOFF_VERSION,
  financialYearForRange,
  type StatementYearEndHandoff,
} from '../handoff/yearEndHandoff'

export function buildStatementYearEndHandoff(statement: Statement, reviews: Reviews, from: string, to: string): StatementYearEndHandoff {
  const financialYear = financialYearForRange(from, to)
  if (!financialYear) throw new Error('Choose a statement date range contained within one Australian financial year before exporting a handoff.')
  const rows = statement.rows.filter(row => row.date >= from && row.date <= to)
  const analysis = analyse(rows, reviews)
  const reviewedTransactions = rows.filter(row => !!reviews[row.id]).length
  const flagged = rows.filter(row => reviewFor(row, reviews).work === 'check')
  const flaggedWorkAmountCents = flagged.reduce((sum, row) => sum + Math.max(0, -row.cents), 0)
  return {
    version: YEAR_END_HANDOFF_VERSION,
    kind: 'statement-analysis',
    handoffId: `statement:${statement.id}:${from}:${to}:${STATEMENT_VERSION}`,
    financialYear,
    generatedAt: new Date().toISOString(),
    sourceHashes: [statement.id.toLowerCase()],
    scope: { from, to },
    summary: {
      transactionCount: rows.length,
      reviewedTransactions,
      workReviewTransactions: flagged.length,
      flaggedWorkAmountCents,
      uncategorised: analysis.uncategorised,
      reconciled: statement.reconciled,
    },
  }
}
