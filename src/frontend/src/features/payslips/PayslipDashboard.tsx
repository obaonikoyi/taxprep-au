import { useEffect, useRef, useState } from 'react'
import { appendPayslips, blankFacts, changedFacts, confirmationIssues, employerKey, financialYear, MAX_PAYSLIPS, selectedPayslips, type Payslip } from './payslip'
import { readPayslip } from './payslipReader'
import { downloadPayReport, payslipReport } from './payslipReport'
import PayslipStart from './PayslipStart'
import PayslipSummary from './PayslipSummary'
import PayslipHistory from './PayslipHistory'
import PayslipReview from './PayslipReview'
import '../statements/statements.css'
import './payslips.css'

export default function PayslipDashboard() {
  const [stage, setStage] = useState<'add' | 'review' | 'summary'>('add')
  const [clearRequested, setClearRequested] = useState(false)
  const [slips, setSlips] = useState<Payslip[]>([]), [selected, setSelected] = useState<string | null>(null)
  const [year, setYear] = useState('all'), [employer, setEmployer] = useState('all'), [grouping, setGrouping] = useState<'month' | 'payday'>('month')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const active = useRef<AbortController | null>(null), stageHeading = useRef<HTMLHeadingElement>(null), clearButton = useRef<HTMLButtonElement>(null)
  useEffect(() => () => active.current?.abort(), [])
  const confirmed = selectedPayslips(slips, year, employer)
  const allConfirmed = selectedPayslips(slips, 'all', 'all')
  const pending = slips.filter(s => !s.confirmed || confirmationIssues(s, slips).length)
  const years = [...new Set(slips.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.facts.payDate)).map(s => financialYear(s.facts.payDate)))].sort().reverse()
  const employers = [...new Map(slips.filter(s => s.facts.employer.trim()).map(s => [employerKey(s.facts.employer), s.facts.employer])).entries()]
  const current = slips.find(s => s.id === selected)
  const fictional = slips.some(s => s.sample)

  useEffect(() => {
    if (stage === 'add') return
    stageHeading.current?.focus({ preventScroll: true })
    stageHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [stage, selected])

  async function importFiles(files?: File[]) {
    if (active.current) return
    const sample = !files
    if (slips.length && fictional !== sample) { setError('Clear the current history before switching between example and your own payslips. Download a report first if you need it.'); return }
    const controller = new AbortController(); active.current = controller
    setBusy(true); setError(''); setMessage('Opening payslips…')
    let cancelListener: (() => void) | undefined
    const cancelled = new Promise<never>((_, reject) => {
      cancelListener = () => reject(new Error('Reading cancelled or timed out. Existing payslips are unchanged.'))
      controller.signal.addEventListener('abort', cancelListener, { once: true })
    })
    const timer = setTimeout(() => controller.abort(), 60_000)
    const work = async () => {
      if (!files) {
        const { default: examples } = await import('../../../../../sample-data/payslips/examples.json')
        files = examples.map(s => new File([Uint8Array.from(atob(s.pdfBase64), c => c.charCodeAt(0))], s.name, { type: 'application/pdf' }))
      }
      if (!files.length || files.length > 20 || slips.length + files.length > MAX_PAYSLIPS) throw new Error('Choose 1–20 PDFs at a time, with no more than 100 payslips in this session.')
      const next: Payslip[] = []
      for (let i = 0; i < files.length; i++) {
        if (controller.signal.aborted) throw new Error('Reading cancelled.')
        setMessage(`Reading payslip ${i + 1} of ${files.length}…`)
        next.push(await readPayslip(files[i], controller.signal, sample))
      }
      const combined = appendPayslips(slips, next)
      if (sample) {
        if (next.some(s => confirmationIssues(s, combined).length)) throw new Error('The example could not be verified.')
        // Only shipped fictional examples are pre-reviewed. Every user file starts unconfirmed.
        return combined.map(s => ({ ...s, confirmed: true }))
      }
      return combined
    }
    try {
      const combined = await Promise.race([work(), cancelled])
      if (!controller.signal.aborted) {
        setSlips(combined); setYear('all'); setEmployer('all')
        setSelected(sample ? null : combined[slips.length].id)
        setStage(sample ? 'summary' : 'review')
        setMessage(sample ? 'Six fictional payslips loaded. Example figures are pre-reviewed.' : `${combined.length - slips.length} payslip(s) read. Confirm their figures before they appear in charts.`)
      }
    } catch (e) { if (active.current === controller) { setError(e instanceof Error ? e.message : 'Could not read these payslips.'); setMessage('') } }
    finally { clearTimeout(timer); if (cancelListener) controller.signal.removeEventListener('abort', cancelListener); if (active.current === controller) { active.current = null; setBusy(false) } }
  }
  function focusStart() { requestAnimationFrame(() => { stageHeading.current?.focus({ preventScroll: true }); stageHeading.current?.scrollIntoView({ block: 'start' }) }) }
  function clear() { setStage('add'); setClearRequested(false); setSlips([]); setSelected(null); setYear('all'); setEmployer('all'); setMessage('Pay history cleared.'); setError(''); focusStart() }
  function manual() {
    if (fictional) { setError('Clear the example history before adding your own figures.'); return }
    if (slips.length >= MAX_PAYSLIPS) { setError('This session already has 100 payslips.'); return }
    const facts = blankFacts(), id = crypto.randomUUID()
    setSlips([...slips, { id, name: 'Manual payslip', hash: null, text: '', facts, original: { ...facts }, confirmed: false, sample: false }])
    setSelected(id); setStage('review'); setYear('all'); setEmployer('all'); setError(''); setMessage('Enter the period figures from your payslip, then confirm them.')
  }
  function openReview(id: string) { setSelected(id); setStage('review'); setYear('all'); setEmployer('all'); setError('') }
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
    downloadPayReport(payslipReport(confirmed, slips, scope))
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
        onClick={() => { setStage(step); setError(''); setMessage(''); setClearRequested(false); if (step === 'add') focusStart(); if (step === 'review') setSelected(selected ?? pending[0]?.id ?? slips[0]?.id ?? null) }}>
        <span className="pay-step-number" aria-hidden="true">{i + 1}</span>
        <span><strong>{['Add payslips', 'Check figures', 'View summary'][i]}</strong><small>{['Start with a file or your figures', pending.length ? `${pending.length} to check` : 'Make sure the amounts match', 'Understand and download your pay'][i]}</small></span>
      </button>)}
    </nav>

    {fictional && <aside className="pay-example-banner"><div><strong>You’re exploring an example</strong><p>These six fictional payslips show how the dashboard works.</p></div><button className="secondary-button" disabled={busy} onClick={clear}>Use my own payslips</button></aside>}
    <div className="pay-status"><p role="status">{message}</p>{busy && <button className="text-button" onClick={() => active.current?.abort()}>Cancel reading</button>}</div>
    {error && <div role="alert" className="statement-error"><strong>We couldn’t add those payslips.</strong><p>{error}</p><p>You can enter the figures manually if your PDF layout is not supported.</p></div>}

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
      <PayslipSummary slips={confirmed} years={years} employers={employers} year={year} employer={employer} grouping={grouping}
        onYear={setYear} onEmployer={setEmployer} onGrouping={setGrouping}
        onResetFilters={() => { setYear('all'); setEmployer('all') }} />
      <div className="pay-summary-actions"><button className="secondary-button" onClick={() => { setStage('add'); setError(''); setMessage(''); focusStart() }}>Add another payslip</button><button className="text-button" onClick={() => openReview(pending[0]?.id ?? slips[0].id)}>Review or edit payslips</button></div>
    </>}

    <footer className="pay-footer">
      <p><strong>{slips.length ? 'Download your report before you leave.' : 'No account needed.'}</strong> Your pay history clears when you refresh or move to another tool.</p>
      {slips.length > 0 && <button ref={clearButton} className="text-button pay-clear" disabled={busy} onClick={() => setClearRequested(true)}>Clear pay history</button>}
    </footer>
    {clearRequested && <section className="pay-clear-confirm" aria-label="Clear history confirmation"><h3>Clear all payslips?</h3><p>This removes the history in this tab. Download a report from View summary first if you need a copy.</p><div className="pay-actions"><button autoFocus className="secondary-button" onClick={() => { setClearRequested(false); clearButton.current?.focus() }}>Keep my history</button><button className="primary-button" onClick={clear}>Yes, clear history</button></div></section>}
    <details className="statement-help"><summary>What can TaxPrep check?</summary><p>We check that the figures add up and help you understand the pay recorded on your payslips. This does not confirm your award rate, your employer’s tax payments or whether super reached your fund. <a href="https://www.fairwork.gov.au/pay-and-wages/paying-wages/pay-slips" target="_blank" rel="noreferrer">Learn about payslips at Fair Work.</a></p><p>Your files are read in this tab. They are not uploaded or sent to an AI service. Keep your original payslips; the downloaded report does not contain them.</p></details>
  </section>
}
