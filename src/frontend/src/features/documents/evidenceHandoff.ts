import { reconcile, YEAR, type Evidence, type EvidenceLink } from './evidence'
import type { DocumentSource } from './documentReader'
import {
  YEAR_END_HANDOFF_VERSION,
  normaliseFinancialYear,
  type EvidenceYearEndHandoff,
} from '../handoff/yearEndHandoff'

export function buildEvidenceYearEndHandoff(
  records: Evidence[],
  links: EvidenceLink[],
  separate: string[],
  sources: DocumentSource[],
): EvidenceYearEndHandoff {
  if (!sources.length) throw new Error('Add and review at least one source document before exporting a year-end handoff.')
  const { groups } = reconcile(records, links, separate)
  const sourceHashes = [...new Set(sources.map(source => source.id.toLowerCase()))].sort()
  if (!sourceHashes.length) throw new Error('No source hashes are available for this evidence handoff.')
  const reviewedSpendingCents = groups.filter(group => group.counted).reduce((sum, group) => sum + group.item.facts.cents!, 0)
  const receiptItems = groups.filter(group => group.evidence.some(source => source.kind === 'receipt')).length
  const workPurposeAnswered = groups.filter(group => group.item.answers.purpose.trim()).length
  const confirmedItems = groups.filter(group => group.item.confirmed).length
  const openQuestions = groups.reduce((sum, group) => sum + group.unresolved.length, 0)
  return {
    version: YEAR_END_HANDOFF_VERSION,
    kind: 'evidence-review',
    handoffId: `evidence:${normaliseFinancialYear(YEAR)}:${sourceHashes.join('+')}`,
    financialYear: normaliseFinancialYear(YEAR),
    generatedAt: new Date().toISOString(),
    sourceHashes,
    summary: {
      evidenceRecords: records.length,
      reconciledItems: groups.length,
      confirmedItems,
      receiptItems,
      workPurposeAnswered,
      reviewedSpendingCents,
      openQuestions,
    },
  }
}
