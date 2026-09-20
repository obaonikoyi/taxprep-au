import { useRef, useState } from 'react'
import {
  annualStatementIssues,
  candidateToAnnualPaySource,
  changedAnnualStatementFacts,
  suggestedEmployerLink,
  type AnnualStatementCandidate,
  type AnnualStatementFacts,
} from './annualStatement'
import { readAnnualStatement } from './annualStatementReader'
import { MAX_ANNUAL_PAY_SOURCES, type AnnualPaySource } from './yearEndReconciliation'

type Props = {
  year: string
  employers: [string, string][]
  sources: AnnualPaySource[]
  onAdd: (source: AnnualPaySource) => void
}

function base64Bytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

export default function AnnualStatementIntake({ year, employers, sources, onAdd }: Props) {
  const [candidate, setCandidate] = useState<AnnualStatementCandidate | null>(null)
  const [linkedEmployer, setLinkedEmployer] = useState('')
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const upload = useRef<HTMLInputElement>(null)

  const issues = candidate ? annualStatementIssues(candidate, year) : []

  async function process(file: File, sample = false) {
    if (busy) return
    setBusy(true); setError(''); setMessage('Checking annual statement…')
    const abort = new AbortController()
    controller.current = abort
    try {
      const next = await readAnnualStatement(file, abort.signal, setMessage, sample)
      if (sources.some(source => source.documentHash === next.hash)) throw new Error('This exact annual-statement file has already been added.')
      setCandidate(next)
      setLinkedEmployer(suggestedEmployerLink(next, employers))
      setChecked(false)
      setMessage('Annual statement read. Check every extracted field before adding it.')
    } catch (err) {
      setCandidate(null)
      setLinkedEmployer('')
      setChecked(false)
      setError(err instanceof Error ? err.message : 'Could not read this annual statement.')
      setMessage('')
    } finally {
      setBusy(false)
      controller.current = null
      if (upload.current) upload.current.value = ''
    }
  }

  async function loadSample() {
    try {
      const response = await fetch('/samples/annual-statement.json', { cache: 'no-store' })
      if (!response.ok) throw new Error('Sample annual statement could not be loaded.')
      const sample = await response.json() as { name: string; pdfBase64: string }
      const file = new File([base64Bytes(sample.pdfBase64)], sample.name, { type: 'application/pdf' })
      await process(file, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sample annual statement could not be loaded.')
    }
  }

  function patch(patch: Partial<AnnualStatementFacts>) {
    if (!candidate) return
    setCandidate(changedAnnualStatementFacts(candidate, { ...candidate.facts, ...patch }))
    setChecked(false)
  }

  function confirm() {
    if (!candidate || !checked || annualStatementIssues(candidate, year).length) return
    if (sources.length >= MAX_ANNUAL_PAY_SOURCES) {
      setError('This session supports up to 30 annual employment sources. Remove one before adding another.')
      return
    }
    onAdd(candidateToAnnualPaySource(candidate, linkedEmployer))
    setCandidate(null)
    setLinkedEmployer('')
    setChecked(false)
    setMessage('Confirmed annual statement added to year-end reconciliation.')
    setError('')
  }

  return <section className="annual-statement-intake" aria-labelledby="annual-statement-intake-heading">
    <div className="annual-statement-intake-heading">
      <div>
        <p className="eyebrow">Optional local extraction</p>
        <h4 id="annual-statement-intake-heading">Read a supported annual income statement</h4>
        <p>Supported first layout: <strong>ANNUAL INCOME STATEMENT v1</strong>. PDF text is read locally; PNG/JPG and image-only PDFs use local OCR. Other layouts still need manual entry.</p>
      </div>
      <span className="year-end-badge">Local only</span>
    </div>

    <div className="annual-statement-actions">
      <label className="secondary-button annual-statement-file">Upload annual statement
        <input ref={upload} type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={event => {
          const file = event.target.files?.[0]
          if (file) void process(file)
        }} />
      </label>
      <button className="secondary-button" disabled={busy} onClick={() => void loadSample()}>Try fictional annual statement</button>
      {busy && <button className="text-button" onClick={() => controller.current?.abort()}>Cancel reading</button>}
    </div>
    <p className="annual-statement-message" role="status">{message}</p>
    {error && <div className="annual-statement-error" role="alert"><strong>Annual statement not added.</strong><p>{error}</p></div>}

    {candidate && <article className="annual-statement-review" aria-label="Review extracted annual statement">
      <div className="annual-statement-review-heading">
        <div><p className="eyebrow">Review before transfer</p><h4>{candidate.name}</h4><p>Page {candidate.page} · SHA-256 {candidate.hash}</p></div>
        <button className="text-button" onClick={() => { setCandidate(null); setChecked(false); setMessage('Candidate discarded. No annual source was added.') }}>Discard candidate</button>
      </div>

      <div className="annual-statement-form">
        <label>Employer / payer
          <input aria-label="Extracted annual statement employer" value={candidate.facts.payer} maxLength={120} onChange={event => patch({ payer: event.target.value })} />
          {candidate.original.payer !== candidate.facts.payer && <small>Original extraction: {candidate.original.payer || 'blank'}</small>}
        </label>
        <label>Financial year
          <input aria-label="Extracted annual statement financial year" value={candidate.facts.financialYear} onChange={event => patch({ financialYear: event.target.value })} />
          {candidate.original.financialYear !== candidate.facts.financialYear && <small>Original extraction: {candidate.original.financialYear || 'blank'}</small>}
        </label>
        <label>Statement date
          <input aria-label="Extracted annual statement date" type="date" value={candidate.facts.statementDate} onChange={event => patch({ statementDate: event.target.value })} />
          {candidate.original.statementDate !== candidate.facts.statementDate && <small>Original extraction: {candidate.original.statementDate || 'blank'}</small>}
        </label>
        <label>Source reference
          <input aria-label="Extracted annual statement reference" value={candidate.facts.reference} maxLength={160} onChange={event => patch({ reference: event.target.value })} />
          {candidate.original.reference !== candidate.facts.reference && <small>Original extraction: {candidate.original.reference || 'blank'}</small>}
        </label>
        <label>Final status
          <select aria-label="Extracted annual statement status" value={candidate.facts.finalStatus} onChange={event => patch({ finalStatus: event.target.value as AnnualStatementFacts['finalStatus'] })}>
            <option value="">Choose status</option><option value="final">Tax ready / finalised</option><option value="not-final">Not final</option><option value="unsure">Unsure</option>
          </select>
        </label>
        <label>Gross income
          <input aria-label="Extracted annual statement gross income (AUD)" inputMode="decimal" value={candidate.facts.gross} onChange={event => patch({ gross: event.target.value })} />
          {candidate.original.gross !== candidate.facts.gross && <small>Original extraction: {candidate.original.gross || 'blank'}</small>}
        </label>
        <label>Tax withheld
          <input aria-label="Extracted annual statement tax withheld (AUD)" inputMode="decimal" value={candidate.facts.withheld} onChange={event => patch({ withheld: event.target.value })} />
          {candidate.original.witheld !== candidate.facts.withheld && <small>Original extraction: {candidate.original.withheld || 'blank'}</small>}
        </label>
        <label>Link to checked pay history (optional)
          <select aria-label="Extracted annual statement linked employer" value={linkedEmployer} onChange={event => { setLinkedEmployer(event.target.value); setChecked(false) }}>
            <option value="">Not linked yet</option>{employers.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
        </label>
      </div>

      {candidate.unresolvedCoverage.length > 0 && <div className="annual-statement-coverage-warning"><strong>Extra annual fields need separate review</strong><ul>{candidate.unresolvedCoverage.map(note => <li key={note}>{note}</li<)}</ul><p>They are preserved but never folded into ordinary gross income automatically. This source will stay excluded from final reconciliation totals until those fields are supported or separately reviewed.</p></div>}
      {issues.length > 0 && <div className="annual-statement-issues" role="alert"><strong>Check these extracted values</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}

      <label className="annual-statement-confirm"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} /> I checked these extracted values against the annual source.</label>
      <button className="primary-button" disabled={!checked || issues.length > 0} onClick={confirm}>Confirm and add annual source</button>

      <details className="statement-help annual-statement-source-text"><summary>View extracted source text</summary><pre>{candidate.text}</pre></details>
    </article>}
  </section>
}
