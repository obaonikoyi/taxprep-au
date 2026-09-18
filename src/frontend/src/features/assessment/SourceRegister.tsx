import { RULE_VERSION, SOURCE_MAX_AGE_DAYS, sources } from './phone'
export default function SourceRegister() {
  return <details className="assessment-sources"><summary>ATO sources and review status</summary>
    <p>Draft rules: {RULE_VERSION}. All three applicability mappings and examples await qualified tax review. Retrieval is not approval. Source checks expire after {SOURCE_MAX_AGE_DAYS} days under our maintenance policy; this is not an ATO deadline. This app does not search live guidance during an assessment.</p>
    <ul>{sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>Applicable year: 2025–26 (provisional). Page updated {source.updatedAt}; retrieved {source.retrievedAt}. Review: pending; no reviewer assigned.</p><details><summary>Captured source version</summary><code>SHA-256 {source.sha256}</code><p>Conditions: {source.conditions.join(', ')}</p></details></li>)}</ul>
  </details>
}
