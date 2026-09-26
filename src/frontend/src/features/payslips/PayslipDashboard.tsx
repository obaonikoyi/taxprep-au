import { useEffect, useRef, useState } from 'react'
import { appendPayslips, blankFacts, changedFacts, confirmationIssues, employerKey, financialYear, MAX_PAYSLIPS, selectedPayslips, type Payslip, type SkippedFile } from './payslip'
import { isUnknownLayout, readPayslip } from './payslipReader'
import { downloadPayReport, payslipReport } from './payslipReport'
import PayslipStart from './PayslipStart'
import PayslipSummary from './PayslipSummary'
import PayslipHistory from './PayslipHistory'
import PayslipReview from './PayslipReview'
import PayRatePanel from './PayRatePanel'
import type { RateRecord } from './payRate'

export default function PayslipDashboard() {
  const [stage, setStage] = useState<'add' | 'review' | 'summary'>('add')
  const [clearRequested, setClearRequested] = useState(false)
  const [slips, setSlips] = useState<Payslip[]>([]), [selected, setSelected] = useState<string | null>(null)
  // Rate records live beside the payslips and clear with them: they are the
  // user's statement of what they agreed to, not a stored document.
  const [rates, setRates] = useState<RateRecord[]>([])
  const [year, setYear] = useState('all'), [employer, setEmployer] = useState('all'), [grouping, setGrouping] = useState<'month' | 'payday'>('month')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  // Files this batch could not add. Named rather than dropped quietly: the
  // person chose them, and they need to know which ones to deal with by hand.
  const [skipped, setSkipped] = useState<SkippedFile[]>([])
  /*
   * Files whose layout nothing here recognises, held so the person can be asked
   * about them by name. The asking used to be a checkbox above the file picker,
   * ticked before anything had happened, to guarantee that consent came before
   * anything left the device. It still does: choosing a file sends nothing, the
   * layouts are tried here, and only a "yes" to this question — naming these
   * files — ever puts their text on the wire. What has gone is being asked to
   * decide about a thing that had not happened yet, in words that needed the
   * idea of a "layout" to make sense.
   */
  const [offer, setOffer] = useState<File[]>([])
  const active = useRef<AbortController | null>(null), stageHeading = useRef<HTMLHeadingElement>(null), clearButton = useRef<HTMLButtonElement>(null)
  /*
   * Everything this screen says about a batch is said above the start card. By
   * the time somebody has scrolled down far enough to choose a file, that is
   * off the top of the screen — so the app answering there, and leaving the
   * page where it was, is indistinguishable from the app doing nothing. Every
   * answer now brings the page to it.
   */
  const alerts = useRef<HTMLDivElement>(null)
  useEffect(() => () => active.current?.abort(), [])
  const confirmed = selectedPayslips(slips, year, employer)
  const allConfirmed = selectedPayslips(slips, 'all', 'all')
  const pending = slips.filter(s => !s.confirmed || confirmationIssues(s, slips).length)
  // Everything the current filters cover, confirmed or not. The rate section
  // of the downloaded report is built from this, so a report scoped to one
  // employer never names another.
  const inScope = slips.filter(s => (year === 'all' || financialYear(s.facts.payDate) === year) && (employer === 'all' || employerKey(s.facts.employer) === employer))
  const years = [...new Set(slips.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.facts.payDate)).map(s => financialYear(s.facts.payDate)))].sort().reverse()
  const employers = [...new Map(slips.filter(s => s.facts.employer.trim()).map(s => [employerKey(s.facts.employer), s.facts.employer])).entries()]
  const current = slips.find(s => s.id === selected)
  const fictional = slips.some(s => s.sample)

  useEffect(() => {
    if (stage === 'add') return
    stageHeading.current?.focus({ preventScroll: true })
    stageHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [stage, selected])

  /*
   * Declared after the stage effect so it wins when a batch does both — reads
   * some files and has a question about others. Both run on the same commit,
   * and the last one to take focus keeps it. The question is the thing that
   * needs answering; the heading is just where the reading landed.
   *
   * The last child is what gets scrolled to, not the region: when a batch
   * produced a failure and a question, the question is below the failure, and
   * centring the pair can leave it off the bottom of a short window.
   */
  useEffect(() => {
    if (!error && !skipped.length && !offer.length) return
    alerts.current?.focus({ preventScroll: true })
    alerts.current?.lastElementChild?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [error, skipped, offer])

  async function importFiles(files?: File[], assist = false) {
    if (active.current) return
    const sample = !files
    if (slips.length && fictional !== sample) { setError('Clear the current history before switching between example and your own payslips. Download a report first if you need it.'); return }
    const controller = new AbortController(); active.current = controller
    setBusy(true); setError(''); setSkipped([]); setOffer([]); setMessage('Opening payslips…')
    let cancelListener: (() => void) | undefined
    const cancelled = new Promise<never>((_, reject) => {
      cancelListener = () => reject(new Error('Reading cancelled. Existing payslips are unchanged.'))
      controller.signal.addEventListener('abort', cancelListener, { once: true })
    })
    /*
     * A deadline per file, not per batch. One deadline across a batch was
     * already tight for twenty PDFs and is wrong now that a file can be read by
     * asking a server or by recognising a picture: twenty of those take far
     * longer than a minute between them, so the batch would have been cut off
     * mid-way through work that was going fine. A file that stalls now fails on
     * its own and the rest carry on.
     *
     * Three minutes rather than one, because recognising a picture is seconds
     * of work and the first one also fetches the recogniser — and because a PDF
     * that turns out to be a scan cannot be told apart from one that is not
     * until it has been opened. The deadline is here to stop a hang, not to
     * hurry anybody: a PDF with its own text still finishes in well under a
     * second.
     */
    const readOne = async (file: File, note: (message: string) => void) => {
      const perFile = new AbortController()
      const stop = () => perFile.abort()
      controller.signal.addEventListener('abort', stop, { once: true })
      const timer = setTimeout(stop, 180_000)
      try { return await readPayslip(file, perFile.signal, sample, assist && !sample, note) }
      finally { clearTimeout(timer); controller.signal.removeEventListener('abort', stop) }
    }
    const reasonFor = (e: unknown) => {
      if (!(e instanceof Error)) return 'It could not be read.'
      // Inside the reader a deadline looks like a cancellation. Nobody cancelled
      // this one, and saying so would be a lie about what just happened.
      return /Reading cancelled/.test(e.message) ? 'It took more than three minutes to read. Try it on its own.' : e.message
    }
    const work = async () => {
      if (!files) {
        const { default: examples } = await import('../../../../../sample-data/payslips/examples.json')
        files = examples.map(s => new File([Uint8Array.from(atob(s.pdfBase64), c => c.charCodeAt(0))], s.name, { type: 'application/pdf' }))
      }
      if (!files.length || files.length > 20 || slips.length + files.length > MAX_PAYSLIPS) throw new Error('Choose 1–20 PDFs at a time, with no more than 100 payslips in this session.')
      const next: Payslip[] = []
      const unread: SkippedFile[] = []
      const unknown: File[] = []
      for (let i = 0; i < files.length; i++) {
        if (controller.signal.aborted) throw new Error('Reading cancelled.')
        const opening = `Reading payslip ${i + 1} of ${files.length}`
        setMessage(`${opening}…`)
        try {
          // Recognising a picture takes seconds, and a screen that says nothing
          // for ten of them reads as a screen that has stopped working.
          next.push(await readOne(files[i], note => { if (!controller.signal.aborted) setMessage(`${opening}: ${note}`) }))
        } catch (e) {
          // A shipped example failing is a fault in this app, not in a file
          // somebody chose, and a half-loaded example is not an example.
          if (sample || controller.signal.aborted) throw e
          // A layout nothing recognises is not a failure, it is a question this
          // app can still ask. Kept apart from files that are genuinely broken.
          if (!assist && isUnknownLayout(e)) unknown.push(files[i])
          else unread.push({ name: files[i].name, reason: reasonFor(e) })
        }
      }
      const { kept, skipped: notAdded } = appendPayslips(slips, next)
      const skipped = [...unread, ...notAdded]
      // Nothing was added and nothing can be offered, so this is simply a
      // failure and reads like one. A batch with a question still to ask is not
      // that, even when it added nothing: the question is the outcome.
      if (kept.length === slips.length && !unknown.length) throw new Error(skipped[0]?.reason ?? 'Could not read these payslips.')
      if (sample) {
        if (next.some(s => confirmationIssues(s, kept).length)) throw new Error('The example could not be verified.')
        // Only shipped fictional examples are pre-reviewed. Every user file starts unconfirmed.
        return { combined: kept.map(s => ({ ...s, confirmed: true })), skipped, unknown }
      }
      return { combined: kept, skipped, unknown }
    }
    try {
      const { combined, skipped, unknown } = await Promise.race([work(), cancelled])
      if (!controller.signal.aborted) {
        const added = combined.length - slips.length
        setSlips(combined); setYear('all'); setEmployer('all'); setSkipped(skipped); setOffer(unknown)
        setSelected(sample || !added ? null : combined[slips.length].id)
        // Nothing new to check means there is nothing to move on to. Staying on
        // this step keeps the question, and the file picker, where they are.
        setStage(sample ? 'summary' : added ? 'review' : 'add')
        setMessage(sample ? 'Six fictional payslips loaded. Example figures are pre-reviewed.'
          : added ? `${added} payslip(s) read. Confirm their figures before they appear in charts.` : '')
      }
    } catch (e) { if (active.current === controller) { setError(e instanceof Error ? e.message : 'Could not read these payslips.'); setMessage('') } }
    finally { if (cancelListener) controller.signal.removeEventListener('abort', cancelListener); if (active.current === controller) { active.current = null; setBusy(false) } }
  }
  function focusStart() { requestAnimationFrame(() => { stageHeading.current?.focus({ preventScroll: true }); stageHeading.current?.scrollIntoView({ block: 'start' }) }) }
  function clear() { setStage('add'); setClearRequested(false); setSlips([]); setRates([]); setSelected(null); setYear('all'); setEmployer('all'); setMessage('Pay history cleared.'); setError(''); setSkipped([]); setOffer([]); focusStart() }
  function manual() {
    if (fictional) { setError('Clear the example history before adding your own figures.'); return }
    if (slips.length >= MAX_PAYSLIPS) { setError('This session already has 100 payslips.'); return }
    const facts = blankFacts(), id = crypto.randomUUID()
    setSlips([...slips, { id, name: 'Manual payslip', hash: null, text: '', facts, original: { ...facts }, confirmed: false, sample: false }])
    setSelected(id); setStage('review'); setYear('all'); setEmployer('all'); setError(''); setMessage('Enter the period figures from your payslip, then confirm them.')
  }
  function openReview(id: string) { setSelected(id); setStage('review'); setYear('all'); setEmployer('all'); setError(''); setSkipped([]); setOffer([]) }
  function confirmCurrent() {
    if (!current || confirmationIssues(current, slips).length) return
    const updated = slips.map(s => s.id === current.id ? { ...s, confirmed: true } : s)
    const next = updated.find(s => !s.confirmed || confirmationIssues(s, updated).length)
    setSlips(updated)
    setSelected(next?.id ?? null)
    setStage(next ? 'review' : 'summary')
    setMessage(next ? 'Payslip checked. Continue with the next one.' : 'All figures checked. Your pay summary is ready.')
  }
  function download() {
    const scope = `${year === 'all' ? 'All financial years' : year} · ${employer === 'all' ? 'All employers' : employers.find(([k]) => k === employer)?.[1] ?? employer}`
    downloadPayReport(payslipReport(confirmed, slips, scope, rates, inScope))
    setMessage('Pay report downloaded. Keep your original payslips too.')
  }

  return <section className="statement-dashboard payslip-dashboard" aria-label="Payslip dashboard">
    <header className="pay-heading">
      <div><p className="eyebrow">My pay</p><h1>Understand your payslip.</h1><p>See what you earned, how much tax was taken out, and what you took home.</p></div>
      <span className="local-badge">Files stay on your device</span>
    </header>

    <nav className="pay-steps" aria-label="Payslip steps">
      {(['add', 'review', 'summary'] as const).map((step, i) => <button key={step}
        aria-label={['Add payslips', 'Check figures', 'View summary'][i]}
        aria-current={stage === step ? 'step' : undefined}
        disabled={busy || (step !== 'add' && !slips.length)}
        onClick={() => { setStage(step); setError(''); setSkipped([]); setOffer([]); setMessage(''); setClearRequested(false); if (step === 'add') focusStart(); if (step === 'review') setSelected(selected ?? pending[0]?.id ?? slips[0]?.id ?? null) }}>
        <span className="pay-step-number" aria-hidden="true">{i + 1}</span>
        <span><strong>{['Add payslips', 'Check figures', 'View summary'][i]}</strong><small>{['Start with a file or your figures', pending.length ? `${pending.length} to check` : 'Make sure the amounts match', 'Understand and download your pay'][i]}</small></span>
      </button>)}
    </nav>

    {fictional && <aside className="pay-example-banner"><div><strong>You’re exploring an example</strong><p>These six fictional payslips show how the dashboard works.</p></div><button className="secondary-button" disabled={busy} onClick={clear}>Use my own payslips</button></aside>}
    <div className="pay-status"><p role="status">{message}</p>{busy && <button className="text-button" onClick={() => active.current?.abort()}>Cancel reading</button>}</div>
    {(error || skipped.length > 0 || offer.length > 0) && <div className="pay-alerts" ref={alerts} tabIndex={-1}>
      {error && <div role="alert" className="statement-error"><strong>We couldn’t add those payslips.</strong><p>{error}</p><p>You can type the figures in yourself instead.</p></div>}
      {skipped.length > 0 && <div role="alert" className="statement-error">
        <strong>{skipped.length} of those files {skipped.length === 1 ? 'was' : 'were'} not added.</strong>
        <p>The rest were read and are waiting for you to check them. Add these again on their own, or type their figures in by hand.</p>
        <ul>{skipped.map((file, i) => <li key={`${file.name}-${i}`}>{file.name} — {file.reason}</li>)}</ul>
      </div>}
      {offer.length > 0 && <div role="alert" className="pay-offer">
        <strong>{offer.length === 1 ? 'Your payslip is set out in a way this app has not seen before' : `${offer.length} of those payslips are set out in a way this app has not seen before`}</strong>
        <ul>{offer.map((file, i) => <li key={`${file.name}-${i}`}>{file.name}</li>)}</ul>
        <p>Nothing has left your device. There are two ways forward, and both end with you checking every figure.</p>
        <dl className="pay-offer-choices">
          <dt>Type the figures in yourself</dt>
          <dd>Nothing is sent anywhere at all. You copy the amounts off your payslip.</dd>
          <dt>Let our reader try</dt>
          <dd>The <em>words</em> of {offer.length === 1 ? 'this payslip' : 'these payslips'} are sent to our server to be read — never the file, and never a picture of it. Nothing is stored. The reading comes back for you to check, and no figure counts until you confirm it.</dd>
        </dl>
        <div className="pay-offer-actions">
          <button className="primary-button" disabled={busy} onClick={() => { const files = offer; setOffer([]); void importFiles(files, true) }}>Let our reader try</button>
          <button className="secondary-button" disabled={busy} onClick={() => { setOffer([]); manual() }}>Type the figures in myself</button>
        </div>
      </div>}
    </div>}

    {stage === 'add' && <PayslipStart headingRef={stageHeading} busy={busy} hasRecords={slips.length > 0} fictional={fictional} onManual={manual} onImport={files => void importFiles(files)} />}

    {stage === 'review' && <>
      <div className="pay-section-heading"><div><p className="eyebrow">Step 2 of 3</p><h2 ref={stageHeading} tabIndex={-1}>Check your figures</h2><p>{allConfirmed.length} of {slips.length} payslips checked. Match each amount to your original payslip.</p></div>{allConfirmed.length > 0 && <button className="secondary-button" onClick={() => setStage('summary')}>See checked totals</button>}</div>
      <div className="pay-review-layout">
        <PayslipHistory slips={slips} selected={selected} onSelect={openReview} />
        {current ? <PayslipReview key={current.id} slip={current} all={slips}
          onChange={facts => { setSlips(rows => rows.map(s => s.id === current.id ? changedFacts(s, facts) : s)); setMessage('Changes are included only after you confirm the figures again.') }}
          onConfirm={confirmCurrent} onClose={() => setSelected(null)}
          onRemove={() => {
            const remaining = slips.filter(s => s.id !== current.id)
            setSlips(remaining); setSelected(remaining[0]?.id ?? null); setYear('all'); setEmployer('all')
            if (!remaining.length) { setStage('add'); focusStart() }
            setMessage('Payslip removed. Your totals have been updated.')
          }} /> : <div className="statement-panel pay-empty"><h3>Choose a payslip to check</h3><p>Select a payslip from your list to see its details.</p></div>}
      </div>
    </>}

    {stage === 'summary' && <>
      <div className="pay-section-heading"><div><p className="eyebrow">Step 3 of 3</p><h2 ref={stageHeading} tabIndex={-1}>Your pay at a glance</h2><p>Totals from the payslips you checked. This is your pay history, not a tax refund estimate.</p></div><button className="primary-button" onClick={download}>Download pay report</button></div>
      {pending.length > 0 && <aside className="pay-pending"><div><strong>{pending.length} payslip{pending.length === 1 ? '' : 's'} still to check</strong><p>They are not included in these totals yet.</p></div><button className="secondary-button" onClick={() => openReview(pending[0].id)}>Check remaining payslips</button></aside>}
      <PayslipSummary allSlips={slips} slips={confirmed} years={years} employers={employers} year={year} employer={employer} grouping={grouping}
        onYear={setYear} onEmployer={setEmployer} onGrouping={setGrouping}
        onResetFilters={() => { setYear('all'); setEmployer('all') }} />
      <PayRatePanel slips={slips} records={rates} onRecords={setRates} />
      <div className="pay-summary-actions"><button className="secondary-button" onClick={() => { setStage('add'); setError(''); setMessage(''); focusStart() }}>Add another payslip</button><button className="text-button" onClick={() => openReview(pending[0]?.id ?? slips[0].id)}>Review or edit payslips</button></div>
    </>}

    <footer className="pay-footer">
      <p><strong>{slips.length ? 'Download your report before you leave.' : 'No account needed.'}</strong> Your pay history clears when you refresh or move to another tool.</p>
      {slips.length > 0 && <button ref={clearButton} className="text-button pay-clear" disabled={busy} onClick={() => setClearRequested(true)}>Clear pay history</button>}
    </footer>
    {clearRequested && <section className="pay-clear-confirm" aria-label="Clear history confirmation"><h3>Clear all payslips?</h3><p>This removes the history and any rates you recorded in this tab. Download a report from View summary first if you need a copy.</p><div className="pay-actions"><button autoFocus className="secondary-button" onClick={() => { setClearRequested(false); clearButton.current?.focus() }}>Keep my history</button><button className="primary-button" onClick={clear}>Yes, clear history</button></div></section>}
    <details className="statement-help"><summary>What can Xoba Paycheck check?</summary><p>We check that the figures add up and help you understand the pay recorded on your payslips. This does not confirm your award rate, your employer’s tax payments or whether super reached your fund. <a href="https://www.fairwork.gov.au/pay-and-wages/paying-wages/pay-slips" target="_blank" rel="noreferrer">Learn about payslips at Fair Work.</a></p><p>Your files are read in this tab. They are not uploaded or sent to an AI service. Keep your original payslips; the downloaded report does not contain them.</p></details>
  </section>
}
