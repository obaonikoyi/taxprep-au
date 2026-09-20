import { useEffect, useRef, useState } from 'react'
import { mergeWorkDetails, money, pairKey, reconcile, validLink, YEAR, type Evidence, type EvidenceLink } from './evidence'
import { fingerprint, MAX_FILES, readDocument, validateDocument, type DocumentSource } from './documentReader'
import { downloadEvidenceReport, evidenceReport } from './evidenceReport'
import { downloadYearEndHandoff } from '../handoff/yearEndHandoff'
import { buildEvidenceYearEndHandoff } from './evidenceHandoff'
import { sampleDocuments } from './sampleDocuments'
import EvidenceCard from './EvidenceCard'
import { emptyPhoneAnswers, phoneCredits } from '../assessment/phone'
import SourceRegister from '../assessment/SourceRegister'
import PreparationWorkspace from '../preparation/PreparationWorkspace'
import { emptyPreparation } from '../preparation/preparation'
interface Job { id: string; name: string; status: string; failed: boolean; file?: File }
export default function DocumentWorkspace() {
  const [view, setView] = useState<'documents' | 'preparation'>('documents')
  const [preparation, setPreparation] = useState(emptyPreparation)
  const [year, setYear] = useState('')
  const [context, setContext] = useState('')
  const [started, setStarted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [sources, setSources] = useState<DocumentSource[]>([])
  const [records, setRecords] = useState<Evidence[]>([])
  const [links, setLinks] = useState<EvidenceLink[]>([])
  const [separate, setSeparate] = useState<string[]>([])
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const working = useRef(false)
  const sourcesRef = useRef<DocumentSource[]>([])
  const upload = useRef<HTMLInputElement>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort() } }, [])
  const { groups, conflicts } = reconcile(records, links, separate)
  const total = groups.filter(group => group.counted).reduce((sum, group) => sum + group.item.facts.cents!, 0)
  const ready = year === '2025-26' && context === 'employee'
  async function processFiles(files: File[]) {
    if (working.current || !ready || !started) return
    if (files.length + sourcesRef.current.length > MAX_FILES) { setMessage('Keep this session to 6 files. Remove a document before adding more.'); return }
    working.current = true; setBusy(true); setMessage('')
    // Keep failed jobs until successfully retried or explicitly dismissed; exports expose them.
    const queued = files.map(file => ({ id: crypto.randomUUID(), file }))
    setJobs(current => [...current.filter(job => job.failed && !files.some(file => file === job.file)), ...queued.map(({ id, file }) => ({ id, name: file.name, status: 'Queued', failed: false }))])
    let cancelBatch = false
    for (const { id: jobId, file } of queued) {
      if (!mounted.current || cancelBatch) break
      const update = (status: string, failed = false) => { if (mounted.current) setJobs(current => current.map(job => job.id === jobId ? { id: jobId, name: file.name, status, failed, ...(failed ? { file } : {}) } : job)) }
      const abort = new AbortController(); controller.current = abort
      const timeout = setTimeout(() => abort.abort(), 120_000)
      try {
        validateDocument(file)
        update('Checking file…')
        const id = await fingerprint(file)
        if (abort.signal.aborted) throw new Error('Processing cancelled. Retry the file.')
        if (sourcesRef.current.some(source => source.id === id)) { update('Already imported: identical file kept once.'); continue }
        const result = await readDocument(file, id, abort.signal, status => update(status))
        if (!mounted.current || abort.signal.aborted) break
        sourcesRef.current = [...sourcesRef.current, result.source]
        setSources(sourcesRef.current); setRecords(current => [...current, ...result.records])
        update(`Read ${result.records.length} record${result.records.length === 1 ? '' : 's'} in ${(result.source.milliseconds / 1000).toFixed(1)}s. Review facts below.`)
      } catch (error) {
        update(error instanceof Error ? error.message : 'Could not read this file. Try a clearer copy.', true)
        if (abort.signal.aborted) cancelBatch = true
      } finally { clearTimeout(timeout) }
    }
    if (mounted.current) {
      setJobs(current => current.map(job => job.status === 'Queued' ? { ...job, status: 'Not processed after cancellation. Select this file again to retry.', failed: true } : job))
      setBusy(false)
    }
    working.current = false; controller.current = null
    if (upload.current) upload.current.value = ''
  }
  function change(item: Evidence) {
    const previous = records.find(record => record.id === item.id)
    if (item.phone && previous && ['merchant', 'date', 'description'].some(key => previous.facts[key as keyof typeof previous.facts] !== item.facts[key as keyof typeof item.facts])) item = { ...item, phone: emptyPhoneAnswers() }
    const updated = records.map(record => record.id === item.id ? item : record)
    setRecords(updated)
    setLinks(current => current.filter(link => validLink(link, updated)))
    // Any edited facts invalidate a previous "different purchases" decision.
    const old = records.find(record => record.id === item.id)
    if (JSON.stringify(old?.facts) !== JSON.stringify(item.facts)) setSeparate(current => current.filter(key => !key.split('|').includes(item.id)))
  }
  function clear() {
    setPreparation(emptyPreparation()); setView('documents')
    sourcesRef.current = []; setSources([]); setRecords([]); setLinks([]); setSeparate([]); setJobs([]); setMessage('Documents and extracted records cleared from this session.'); setStarted(false)
  }
  function remove(id: string) {
    const ids = records.filter(record => record.documentId === id).map(record => record.id)
    sourcesRef.current = sourcesRef.current.filter(source => source.id !== id)
    setSources(sourcesRef.current); setRecords(current => current.filter(record => record.documentId !== id)); setLinks(current => current.filter(link => !ids.includes(link.bank) && !ids.includes(link.receipt))); setSeparate(current => current.filter(key => !ids.some(id => key.split('|').includes(id))))
  }
  return <section className="document-workspace" aria-labelledby="documents-title">
    <div className="workspace-heading"><div><p className="eyebrow">Document intake · preview</p><h2 id="documents-title">From documents to one evidence list.</h2><p>Read a receipt, find its bank payment, and keep both sources without counting the purchase twice.</p></div><span className="demo-badge">Fictional data only</span></div>
    <p className="document-privacy">Files are processed in this browser tab. No document uploads, external AI service or saved document history. Refreshing, closing or clearing this workspace removes the session. Income and preparation answers also stay in this tab. Download a report before leaving.</p>
    {!started ? <div className="workspace-setup"><div className="evidence-form"><label>Financial year<select aria-label="Financial year" value={year} onChange={event => setYear(event.target.value)}><option value="">Select a year</option><option value="2025-26">2025–26 · 1 Jul 2025–30 Jun 2026</option><option value="other">Another financial year</option></select></label><label>Tax situation<select aria-label="Tax situation" value={context} onChange={event => setContext(event.target.value)}><option value="">Select a situation</option><option value="employee">Employee · phone-service example</option><option value="complex">Business, rental, investments, foreign income or other circumstances</option></select></label></div>
    {(year === 'other' || context === 'complex') && <p role="status" className="document-warning">This prototype does not cover that year or situation. It cannot prepare those sections. Choose the fictional employee example to explore supported document intake.</p>}
    <button className="primary-button" disabled={!ready} onClick={() => setStarted(true)}>Start document review</button></div> : <>
      <div className="workspace-toolbar"><p><strong>{YEAR}</strong> · Employee phone-service example</p><button className="text-button" disabled={busy} onClick={clear}>Clear document session</button></div>
      <nav className="workspace-tabs" aria-label="Preparation workspace views"><button className="secondary-button" aria-pressed={view === 'documents'} onClick={() => setView('documents')}>Documents</button><button className="secondary-button" aria-pressed={view === 'preparation'} onClick={() => setView('preparation')}>Preparation summary</button></nav>
      {view === 'preparation' && <PreparationWorkspace value={preparation} onChange={setPreparation} records={records} links={links} separate={separate} sources={sources} importIssues={jobs.filter(job => job.failed).map(job => `${job.name}: ${job.status}`)} onDocuments={() => setView('documents')} onMessage={setMessage} busy={busy} />}
      <div hidden={view !== 'documents'}>
      <div className="document-drop"><h3>Add your fictional documents</h3><p>Up to 6 files, 2 MB each. PNG/JPG up to 12 megapixels; PDFs up to 3 pages. English, AUD, one receipt per page. CSV: Date,Description,Amount; up to 100 rows; negative amounts mean spending.</p><label className="document-file-label">Choose documents<input ref={upload} type="file" multiple accept=".csv,.png,.jpg,.jpeg,.pdf" disabled={busy} onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) void processFiles(files) }} /></label><div className="button-row"><button className="primary-button" disabled={busy} onClick={async () => { try { await processFiles(await sampleDocuments()) } catch { setMessage('Sample documents could not be loaded. Try again.') } }}>Try sample documents</button>{busy && <button className="secondary-button" onClick={() => controller.current?.abort()}>Cancel processing</button>}</div><p className="field-help">First use loads the reading engine. Some receipt layouts need manual correction. No deduction is approved by scanning.</p></div>
      <div aria-live="polite" aria-atomic="false" className="document-jobs">{jobs.map((job, index) => <div key={job.id} className={job.failed ? 'document-warning' : ''}><strong>{job.name}</strong><span>{job.status}</span>{job.failed && !busy && <div>{job.file && <button className="text-button" onClick={() => void processFiles([job.file!])}>Retry {job.name}</button>}<button className="text-button" onClick={() => setJobs(current => current.filter((_, i) => i !== index))}>Dismiss {job.name}</button></div>}</div>)}</div>
      {sources.length > 0 && <details className="document-inventory"><summary>{sources.length} source files in this session</summary><ul>{sources.map(source => <li key={source.id}><span>{source.name}</span><button className="text-button" disabled={busy} onClick={() => remove(source.id)}>Remove {source.name}</button></li>)}</ul></details>}
      {records.length > 0 && <><div className="evidence-overview"><div><span>Reviewed spending</span><strong>{money(total)}</strong><small>Gross amounts · before work use or reimbursement</small></div><div><span>Evidence records</span><strong>{records.length}</strong><small>{groups.length} items after linking</small></div><div><span>Items with questions</span><strong>{groups.filter(group => !group.item.excluded && group.unresolved.length > 0).length}</strong><small>Not a complete tax return</small></div></div>
      {conflicts.length > 0 && <section className="match-panel" aria-labelledby="matches-title"><h3 id="matches-title">Resolve possible matches</h3><p>Equal amounts with the same date or a nearby date and matching merchant. Review both sources: they may represent one purchase. Automatic suggestions are limited to a 7-day window.</p>{conflicts.map(([aId, bId]) => {
        const a = records.find(record => record.id === aId)!; const b = records.find(record => record.id === bId)!
        const bank = a.kind === 'bank' ? a : b; const receipt = a.kind === 'receipt' ? a : b
        const alreadyLinked = links.some(link => [aId, bId].includes(link.bank) || [aId, bId].includes(link.receipt))
        const details = mergeWorkDetails(bank, receipt)
        const canLink = a.kind !== b.kind && validLink({ bank: bank.id, receipt: receipt.id }, records) && !alreadyLinked && details !== null
        return <div key={pairKey(aId, bId)}><p><strong>{a.facts.merchant} · {money(a.facts.cents!)}</strong><br />{a.fileName} ({a.location}) + {b.fileName} ({b.location})</p><div className="button-row">{a.kind !== b.kind && <button className="primary-button" disabled={!canLink || busy} onClick={() => { if (details) change({ ...receipt, ...details }); setLinks(current => [...current, { bank: bank.id, receipt: receipt.id }]) }}>Link as one purchase</button>}<button className="secondary-button" disabled={!a.confirmed || !b.confirmed || busy} onClick={() => setSeparate(current => [...current, pairKey(aId, bId)])}>These are different purchases</button></div>{!details && <p className="document-warning">Work answers differ between these items. Review and align those answers before linking; neither answer is silently discarded.</p>}<p className="field-help">Review each item below before deciding. Linking requires matching confirmed merchant, date and amount. Keep valid source dates unchanged; differing payment dates remain unresolved in this version. For a duplicate, exclude it with a reason. Separate an existing link before changing its match.</p></div>
      })}</section>}
      <div className="evidence-list">{groups.map(group => <EvidenceCard key={group.item.id} item={group.item} evidence={group.evidence} sources={sources} credits={phoneCredits(group.item, records)} questions={group.unresolved} counted={group.counted} onChange={change} onUnlink={() => setLinks(current => current.filter(link => link.receipt !== group.item.id))} />)}</div>
      <SourceRegister />
      <div className="evidence-export"><h3>Take the facts and assessment with you</h3><p>The detailed report includes source references, corrections, draft phone assessments and unanswered questions. The year-end handoff carries only coverage counts, reviewed-spending metadata and source hashes — no OCR text, merchant descriptions or approved deduction.</p><div className="button-row"><button className="primary-button" disabled={busy} onClick={() => { try { downloadEvidenceReport(evidenceReport(records, links, separate, sources, 'Employee phone-service example', jobs.filter(job => job.failed).map(job => `${job.name}: ${job.status}`))); setMessage('Evidence report downloaded. Your source files are not embedded; keep them separately.') } catch { setMessage('Download failed. Please try again.') } }}>Download evidence report</button><button className="secondary-button" disabled={busy||!sources.length} onClick={() => { try { const handoff=buildEvidenceYearEndHandoff(records,links,separate,sources); downloadYearEndHandoff(handoff,'taxprep-evidence-handoff-2025-26.json'); setMessage('Year-end handoff downloaded. It contains summary coverage and source hashes only.') } catch(error) { setMessage(error instanceof Error?error.message:'Year-end handoff could not be created.') } }}>Download year-end handoff</button></div></div></>}
      </div>
    </>}
    <p role="status" className="document-message">{message}</p>
  </section>
}
