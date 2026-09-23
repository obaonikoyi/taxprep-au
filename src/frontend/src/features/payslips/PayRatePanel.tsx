import { useRef, useState } from 'react'
import { confirmationIssues, employerKey, type Payslip } from './payslip'
import { addRate, blankRate, MAX_RATE_RECORDS, rateChecks, rateSources, rateText, validateRate, WEEKS_PER_YEAR, type RateRecord } from './payRate'
import { contractText, readContract } from './contractReader'

/**
 * The agreed rate, and the questions the payslips raise against it.
 *
 * Deliberately not a verdict screen. Every finding shows what the user
 * recorded, what the payslip says and the difference, then states what it
 * cannot establish. The panel never says a payslip is right — only what it
 * compared — because a user who reads silence as a pass is worse off than one
 * who reads nothing at all.
 */
export default function PayRatePanel({ slips, records, onRecords }: { slips: Payslip[]; records: RateRecord[]; onRecords: (records: RateRecord[]) => void }) {
  const [draft, setDraft] = useState<RateRecord | null>(null)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState('')
  /*
   * Reading the rate out of the contract rather than typing it. Everything
   * about this is a proposal: it fills the form in, it never saves, and the
   * sentence it was read from is shown beside it so the person can check the
   * one thing that matters before they confirm.
   */
  const [reading, setReading] = useState('')
  const [readProblem, setReadProblem] = useState('')
  const [quote, setQuote] = useState('')
  const contractInput = useRef<HTMLInputElement>(null)
  const readingNow = useRef<AbortController | null>(null)

  async function readTheContract(file: File) {
    if (readingNow.current) return
    const controller = new AbortController()
    readingNow.current = controller
    setReadProblem(''); setQuote(''); setReading('Opening your contract…')
    // Three minutes: a contract is several pages and a scanned one is several
    // pages of recognising, as a photographed payslip is.
    const timer = setTimeout(() => controller.abort(), 180_000)
    try {
      const text = await contractText(file, controller.signal, note => { if (!controller.signal.aborted) setReading(note) })
      setReading('Reading the rate from your contract…')
      const found = await readContract(text, controller.signal)
      if (controller.signal.aborted) return
      if (!found.amount) {
        // A refusal is the expected answer often enough that it gets the same
        // care as a reading: say why, and leave the form alone.
        setReadProblem(found.why || 'No single ordinary rate could be read from this contract. Enter it yourself.')
        return
      }
      setDraft(current => ({
        ...(current ?? { ...blankRate(), id: crypto.randomUUID() }),
        employer: found.employer || current?.employer || (employers.length === 1 ? employers[0] : ''),
        basis: found.basis === 'annual' ? 'annual' : 'hourly',
        amount: found.amount,
        weeklyHours: found.weeklyHours || current?.weeklyHours || '',
        from: found.from || current?.from || '',
        source: 'contract',
      }))
      setQuote(found.quote)
      setMessage('')
    } catch (error) {
      if (!controller.signal.aborted || readingNow.current === controller)
        setReadProblem(error instanceof Error ? error.message : 'The contract could not be read. Enter the rate yourself.')
    } finally {
      clearTimeout(timer)
      if (readingNow.current === controller) { readingNow.current = null; setReading('') }
    }
  }
  const employers = [...new Map(slips.filter(s => s.facts.employer.trim()).map(s => [employerKey(s.facts.employer), s.facts.employer])).values()]
  const { findings, states } = rateChecks(slips, records, slip => confirmationIssues(slip, slips))
  const issues = draft ? validateRate(draft, records) : []
  const checked = states.filter(s => s.checked).length
  const set = (patch: Partial<RateRecord>) => {
    // Once they change a figure, the sentence it was read from no longer
    // describes what is in the form, so it stops being shown.
    if (quote && ('amount' in patch || 'basis' in patch || 'from' in patch)) setQuote('')
    setDraft(current => current && { ...current, ...patch })
  }

  function save() {
    if (!draft || issues.length) return
    onRecords(addRate(records, draft))
    setDraft(null); setQuote(''); setReadProblem('')
    setMessage(`Rate recorded for ${draft.employer.trim()}. Checked payslips in this period are now compared with it.`)
  }

  /*
   * The point of the whole panel is the message someone actually sends, so it
   * is one button rather than a figure to copy out by hand.
   *
   * The clipboard is not always available — an insecure origin, a browser that
   * refuses without a permission, a locked-down device — and a copy that
   * silently does nothing is worse than no button. On a failure the text is
   * still on the page under "Read it first", so the message says to take it
   * from there.
   */
  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setMessage('Message copied. Paste it into an email or a text to your payroll contact, and change anything that does not sound like you.')
    } catch {
      setCopied('')
      setMessage('This browser would not let the page copy for you. Open “Read it first” below the button and copy the message from there.')
    }
  }

  return <section className="statement-panel pay-rate-panel" aria-label="Pay rate checks">
    <div className="pay-rate-heading">
      <div>
        <p className="eyebrow">Your agreed rate</p>
        <h3>Questions to ask</h3>
        <p>Record the rate you agreed to, and Xoba Paycheck will compare every checked payslip with it — and with the payslip’s own arithmetic. This covers every payslip in this session, whatever filters are set above.</p>
      </div>
    </div>

    <p className="pay-rate-scope">Xoba Paycheck compares your payslip with <strong>your own record</strong>. It does not know your award or classification, so it cannot tell you whether a rate is one you are entitled to. Findings here are questions to put to your employer, not conclusions about them. For entitlements, see the <a href="https://www.fairwork.gov.au/pay-and-wages" target="_blank" rel="noreferrer">Fair Work Ombudsman</a>.</p>

    <div className="pay-rate-records">
      <div className="pay-rate-records-heading"><h4>Rates you have recorded</h4>{!draft && records.length < MAX_RATE_RECORDS && <button className="secondary-button" onClick={() => { setDraft({ ...blankRate(), id: crypto.randomUUID(), employer: employers.length === 1 ? employers[0] : '' }); setMessage('') }}>Add a pay rate</button>}</div>
      {records.length === 0 && !draft && <p className="pay-rate-empty">No rate recorded yet. Payslips are still checked against their own hours and rate.</p>}
      {records.length > 0 && <ul>{records.map(record => <li key={record.id}>
        <div><strong>{record.employer}</strong><p>{rateText(record)}</p>
          <small>From {record.from}{record.to ? ` to ${record.to}` : ' onwards'} · from {rateSources.find(s => s.value === record.source)?.label.toLowerCase()}{record.note.trim() ? ` · ${record.note.trim()}` : ''}</small></div>
        <button className="text-button" onClick={() => { onRecords(records.filter(r => r.id !== record.id)); setMessage('Rate record removed. Payslips it covered are no longer compared with it.') }}>Remove</button>
      </li>)}</ul>}
    </div>

    {draft && <form className="pay-rate-form" onSubmit={event => { event.preventDefault(); save() }}>
      <fieldset><legend>Add the rate you agreed to</legend>
        <div className="pay-rate-read">
          <label className="statement-file">
            {reading ? 'Reading…' : 'Read it from my contract'}
            <input ref={contractInput} type="file" aria-label="Read the rate from my contract" accept=".pdf,application/pdf,.png,.jpg,.jpeg,image/png,image/jpeg" disabled={!!reading}
              onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readTheContract(file) }} />
          </label>
          <small>
            Optional, and it only fills this form in — nothing is saved until you check it and press save below.
            The words in your contract are sent to our server to be read; the file itself never leaves this device, and neither the file nor its words are stored.
            A contract that states a rate with a loading, or a rate that depends on a classification, is refused rather than guessed at.
          </small>
          {reading && <p role="status" className="pay-rate-reading">{reading}</p>}
          {readProblem && <div role="alert" className="statement-error pay-rate-read-problem"><strong>The rate was not taken from your contract.</strong><p>{readProblem}</p></div>}
          {quote && <div className="pay-rate-quote">
            <strong>Read from this sentence in your contract:</strong>
            <blockquote>{quote}</blockquote>
            <p>Check it says what the figures below say. If it does not, change them — nothing is saved until you press save.</p>
          </div>}
        </div>
        <div className="pay-fields">
          <div className="pay-field">
            <label htmlFor="rate-employer">Employer</label>
            <input id="rate-employer" list="rate-employers" maxLength={120} value={draft.employer} onChange={e => set({ employer: e.target.value })} />
            <datalist id="rate-employers">{employers.map(name => <option key={name} value={name} />)}</datalist>
            <small>Use the name as it appears on the payslip.</small>
          </div>
          <div className="pay-field">
            <label htmlFor="rate-basis">This rate is</label>
            <select id="rate-basis" value={draft.basis} onChange={e => set({ basis: e.target.value as RateRecord['basis'] })}>
              <option value="hourly">An hourly rate</option>
              <option value="annual">An annual salary</option>
            </select>
            <small>Choose whichever your document states.</small>
          </div>
          <div className="pay-field">
            <label htmlFor="rate-amount">{draft.basis === 'annual' ? 'Annual salary (AUD)' : 'Hourly rate (AUD)'}</label>
            <input id="rate-amount" inputMode="decimal" maxLength={30} value={draft.amount} onChange={e => set({ amount: e.target.value })} />
            <small>{draft.basis === 'annual' ? 'Before tax, as written in your document.' : 'The ordinary rate, not an overtime or penalty rate.'}</small>
          </div>
          {draft.basis === 'annual' && <div className="pay-field">
            <label htmlFor="rate-weekly">Ordinary hours a week</label>
            <input id="rate-weekly" inputMode="decimal" maxLength={10} value={draft.weeklyHours} onChange={e => set({ weeklyHours: e.target.value })} />
            <small>Xoba Paycheck divides the salary by {WEEKS_PER_YEAR} weeks and then by these hours. A different number of weeks gives a different rate.</small>
          </div>}
          <div className="pay-field">
            <label htmlFor="rate-from">This rate started</label>
            <input id="rate-from" type="date" value={draft.from} onChange={e => set({ from: e.target.value })} />
            <small>Payslips before this date are not compared with it.</small>
          </div>
          <div className="pay-field">
            <label htmlFor="rate-to">And ended (optional)</label>
            <input id="rate-to" type="date" value={draft.to} onChange={e => set({ to: e.target.value })} />
            <small>Leave blank while this rate still applies.</small>
          </div>
          <div className="pay-field">
            <label htmlFor="rate-source">Where this came from</label>
            <select id="rate-source" value={draft.source} onChange={e => set({ source: e.target.value as RateRecord['source'] })}>
              {rateSources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <small>Every finding names this, so you know how strong the evidence behind it is.</small>
          </div>
          <div className="pay-field pay-field-wide">
            <label htmlFor="rate-note">Source note (optional)</label>
            <input id="rate-note" maxLength={200} value={draft.note} onChange={e => set({ note: e.target.value })} />
            <small>A reminder of where to find it, such as “clause 4.1, signed 12 June 2026”. Xoba Paycheck stores this note and the figures — never the document itself.</small>
          </div>
        </div>
      </fieldset>
      {issues.length > 0 && <div className="pay-checks" role="alert"><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      <div className="pay-confirm-row">
        <button className="primary-button" type="submit" disabled={issues.length > 0}>Save this rate</button>
        <button className="text-button" type="button" onClick={() => { setDraft(null); setMessage(''); setQuote(''); setReadProblem('') }}>Cancel</button>
      </div>
    </form>}

    <p role="status" className="pay-rate-message">{message}</p>

    <div className="pay-rate-findings">
      <h4>{findings.length ? `${findings.length} question${findings.length === 1 ? '' : 's'} to ask` : 'Nothing to ask so far'}</h4>
      {findings.length === 0
        ? <p className="pay-rate-empty">Nothing was found in what Xoba Paycheck compared. That is not a statement that your pay is right — see what was checked below, and what was not.</p>
        : <ol>{findings.map(finding => <li key={finding.id} className="pay-rate-finding">
          <div className="pay-rate-finding-heading"><strong>{finding.heading}</strong><small>{finding.employer} · {finding.period}</small></div>
          <dl>
            {finding.yourRecord && <div><dt>Your record</dt><dd>{finding.yourRecord}</dd></div>}
            <div><dt>This payslip</dt><dd>{finding.thePayslip}</dd></div>
            <div><dt>The difference</dt><dd><strong>{finding.difference}</strong></dd></div>
          </dl>
          <p className="pay-rate-limit">{finding.limit}</p>
          <p className="pay-rate-question">{finding.question}</p>
          <div className="pay-rate-send">
            <button type="button" className="secondary-button" onClick={() => copyMessage(finding.id, finding.message)}>
              {copied === finding.id ? 'Copied ✓' : 'Copy message for payroll'}
            </button>
            <details><summary>Read it first</summary><pre>{finding.message}</pre></details>
          </div>
        </li>)}</ol>}
    </div>

    <details className="statement-help pay-rate-states">
      <summary>What was checked, and what was not ({checked} of {states.length} payslips)</summary>
      <ul>{states.map(state => <li key={state.slipId} className={state.checked ? 'pay-rate-state checked' : 'pay-rate-state'}>
        <strong>{state.employer || state.name} · {state.period}</strong>
        <span>{state.detail}</span>
      </li>)}</ul>
      <p>Every payslip in this session is listed above with what Xoba Paycheck compared, or why it compared nothing. Nothing here confirms that a figure is right — only which figures were set beside each other.</p>
    </details>
  </section>
}
