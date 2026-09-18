import { useState } from 'react'
import { factError, money, parseMoney, type Evidence, type Facts } from './evidence'
import type { DocumentSource } from './documentReader'
import PhoneAssessment from '../assessment/PhoneAssessment'

function FactList({ facts }: { facts: Facts }) {
  return <dl className="source-facts"><div><dt>Merchant</dt><dd>{facts.merchant || 'Unresolved'}</dd></div><div><dt>Date</dt><dd>{facts.date || 'Unresolved'}</dd></div><div><dt>Description</dt><dd>{facts.description || 'Unresolved'}</dd></div><div><dt>Amount</dt><dd>{facts.cents === null ? 'Unresolved' : money(facts.cents)}</dd></div></dl>
}
interface Props { item: Evidence; evidence: Evidence[]; sources: DocumentSource[]; credits: Evidence[]; questions: string[]; counted: boolean; onChange: (item: Evidence) => void; onUnlink: () => void }
export default function EvidenceCard({ item, evidence, sources, credits, questions, counted, onChange, onUnlink }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.facts)
  const [amount, setAmount] = useState(item.facts.cents === null ? '' : (item.facts.cents / 100).toFixed(2))
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  function openEdit() { setDraft(item.facts); setAmount(item.facts.cents === null ? '' : (item.facts.cents / 100).toFixed(2)); setEditing(true); setError('') }
  function confirm() {
    const facts = { ...draft, merchant: draft.merchant.trim(), description: draft.description.trim(), cents: parseMoney(amount) }
    const message = factError(facts)
    if (message) { setError(message); return }
    onChange({ ...item, facts, confirmed: true }); setEditing(false); setError('')
  }
  const title = item.facts.merchant || 'Unreadable receipt'
  return <article className="evidence-card" aria-label={`${title} · ${item.location}`}>
    <div className="evidence-heading"><div><p className="eyebrow">{evidence.length > 1 ? 'Receipt + bank evidence' : item.kind === 'bank' ? 'Bank transaction' : 'Receipt'}</p><h3>{title}</h3><p>{item.facts.date || 'Date unresolved'} · {item.facts.description || 'Description unresolved'}</p></div><strong className="evidence-amount">{item.facts.cents === null ? 'Amount unresolved' : money(item.facts.cents)}</strong></div>
    <p className={`evidence-state ${counted ? 'evidence-state--ready' : ''}`}>{item.excluded ? 'Excluded with a recorded reason' : counted ? 'Facts reviewed · spending counted once' : 'Needs review · not in spending total'}</p>
    <details className="evidence-source"><summary>View {evidence.length} source{evidence.length > 1 ? 's' : ''} and original facts</summary>{evidence.map(record => {
      const source = sources.find(source => source.id === record.documentId)
      const page = Number(record.location.replace('Page ', ''))
      return <div key={record.id}><h4>{record.fileName} · {record.location}</h4>{source?.previews[page - 1] && <img src={source.previews[page - 1]} alt={`${record.fileName}, ${record.location}`} />}<h5>Original extracted facts</h5><FactList facts={record.original} /><h5>Current reviewed facts</h5><FactList facts={record.facts} /><pre>{record.raw || 'No readable text was found.'}</pre></div>
    })}</details>
    {questions.length > 0 && <ul className="evidence-questions">{questions.map(question => <li key={question}>{question}</li>)}</ul>}
    {editing ? <form className="evidence-form" onSubmit={event => { event.preventDefault(); confirm() }}>
      <label>Merchant<input value={draft.merchant} maxLength={160} onChange={event => setDraft({ ...draft, merchant: event.target.value })} /></label>
      <label>Date<input type="date" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
      <label>Description<input value={draft.description} maxLength={160} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <label>Amount (AUD)<input inputMode="decimal" value={amount} maxLength={14} onChange={event => setAmount(event.target.value)} /></label>
      <p className="field-help">Confirm against the source. Changed match details separate linked evidence for another review.</p>
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="button-row"><button className="primary-button" type="submit">Confirm facts</button><button className="secondary-button" type="button" onClick={() => setEditing(false)}>Cancel edit</button></div>
    </form> : !item.excluded && <button className="secondary-button" onClick={openEdit}>{item.confirmed ? 'Correct facts' : 'Review extracted facts'}</button>}
    {!item.excluded && !item.credit && <details className="evidence-source"><summary>Work details documents cannot tell us</summary><div className="evidence-form">
      <label>Work purpose<input maxLength={500} value={item.answers.purpose} onChange={event => onChange({ ...item, answers: { ...item.answers, purpose: event.target.value } })} /></label>
      <label>Employer reimbursement<select aria-label="Employer reimbursement" value={item.answers.reimbursed} onChange={event => onChange({ ...item, answers: { ...item.answers, reimbursed: event.target.value as Evidence['answers']['reimbursed'] } })}><option value="">Choose an answer</option><option value="no">No reimbursement</option><option value="yes">Some or all reimbursed</option><option value="unsure">Unsure</option></select></label>
      <label>Work use (%)<input inputMode="decimal" maxLength={6} value={item.answers.workUse} onChange={event => onChange({ ...item, answers: { ...item.answers, workUse: event.target.value } })} /></label>
      <label>Work-use evidence or basis<input maxLength={500} value={item.answers.basis} onChange={event => onChange({ ...item, answers: { ...item.answers, basis: event.target.value } })} /></label>
    </div></details>}
    {!item.excluded && !item.credit && <PhoneAssessment item={item} evidence={evidence} credits={credits} counted={counted} onChange={onChange} />}
    <div className="evidence-actions">{evidence.length > 1 && <button className="text-button" onClick={onUnlink}>Separate linked evidence</button>}
    {item.excluded ? <button className="text-button" onClick={() => onChange({ ...item, excluded: '' })}>Restore item for review</button> : <details><summary>Exclude this item</summary><label>Reason for exclusion<input value={reason} maxLength={200} onChange={event => setReason(event.target.value)} /></label><button className="text-button" disabled={!reason.trim()} onClick={() => { onChange({ ...item, excluded: reason.trim() }); setEditing(false) }}>Record exclusion</button></details>}</div>
  </article>
}
