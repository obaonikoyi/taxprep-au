import { useEffect, useRef, useState } from 'react'
import { appendPayslips, aud, blankFacts, changedFacts, confirmationIssues, employerKey, financialYear, MAX_PAYSLIPS, money, observations, selectedPayslips, totals, type Payslip } from './payslip'
import { readPayslip } from './payslipReader'
import { downloadPayReport, payslipReport } from './payslipReport'
import PayslipCharts from './PayslipCharts'
import PayslipReview from './PayslipReview'
import '../statements/statements.css'
import './payslips.css'

export default function PayslipDashboard() {
  const [slips, setSlips] = useState<Payslip[]>([]), [selected, setSelected] = useState<string | null>(null)
  const [year, setYear] = useState('all'), [employer, setEmployer] = useState('all'), [grouping, setGrouping] = useState<'month' | 'payday'>('month')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const active = useRef<AbortController | null>(null), review = useRef<HTMLDivElement>(null)
  useEffect(() => () => active.current?.abort(), [])
  const confirmed = selectedPayslips(slips, year, employer), t = totals(confirmed)
  const pending = slips.filter(s => !s.confirmed || confirmationIssues(s, slips).length)
  const years = [...new Set(slips.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.facts.payDate)).map(s => financialYear(s.facts.payDate)))].sort().reverse()
  const employers = [...new Map(slips.filter(s => s.facts.employer.trim()).map(s => [employerKey(s.facts.employer), s.facts.employer])).entries()]
  const current = slips.find(s => s.id === selected), notes = observations(confirmed)
  const fictional = slips.some(s => s.sample)

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
        setMessage(sample ? 'Six fictional payslips loaded. Example figures are pre-reviewed.' : `${combined.length - slips.length} payslip(s) read. Confirm their figures before they appear in charts.`)
      }
    } catch (e) { if (active.current === controller) { setError(e instanceof Error ? e.message : 'Could not read these payslips.'); setMessage('') } }
    finally { clearTimeout(timer); if (cancelListener) controller.signal.removeEventListener('abort', cancelListener); if (active.current === controller) { active.current = null; setBusy(false) } }
  }
  function clear() { setSlips([]); setSelected(null); setYear('all'); setEmployer('all'); setMessage('Pay history cleared.'); setError('') }
  function manual() {
    if (fictional) { setError('Clear the example history before adding your own figures.'); return }
    if (slips.length >= MAX_PAYSLIPS) { setError('This session already has 100 payslips.'); return }
    const facts = blankFacts(), id = crypto.randomUUID()
    setSlips([...slips, { id, name: 'Manual payslip', hash: null, text: '', facts, original: { ...facts }, confirmed: false, sample: false }])
    setSelected(id); setError(''); setMessage('Enter the period figures from your payslip, then confirm them.')
  }
  function openReview(id: string) { setSelected(id); requestAnimationFrame(() => review.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  return <section className="statement-dashboard payslip-dashboard" aria-label="Payslip dashboard">
    <div className="statement-title-row"><div><p className="eyebrow">Your pay, throughout the year</p><h1>Every payday, a clearer picture.</h1><p>Understand what you earned, what was withheld, and the super shown on your payslips. Build a useful history before tax time.</p></div><div className="local-badge"><span aria-hidden="true">●</span> Processed on your device</div></div>
    <div className="statement-upload"><div className="upload-symbol" aria-hidden="true">↥</div><div><h2>Add your payslips</h2><p>Start with a supported PDF or enter your figures. Your files stay in this tab. Download your report before refreshing or switching workspaces.</p><div className="pay-actions"><label className="statement-file">Choose payslip PDFs<input aria-label="Choose payslip PDFs" type="file" accept=".pdf,application/pdf" multiple disabled={busy} onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) void importFiles(files) }} /></label><button className="text-button" disabled={busy} onClick={manual}>Enter figures manually</button></div><details className="pay-format"><summary>Supported PDF format</summary><p>One native-text page per file, up to 2 MB; 20 files per batch. The first reader supports the labelled <strong>PAYSLIP SUMMARY v1</strong> format shown in the example. Other payroll layouts, scans and images need manual entry for now. Use current-period figures, never cumulative YTD totals.</p><button className="text-button" disabled={busy} onClick={async () => { const { default: examples } = await import('../../../../../sample-data/payslips/examples.json'); const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(examples[0].pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = 'example-payslip.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }}>Download example PDF</button></details></div><div className="pay-example"><span className="eyebrow">Take a look first</span><h3>Two jobs. Six payslips.</h3><p>Explore a fictional pay history with fortnightly and monthly pay.</p><button className="primary-button" disabled={busy || slips.length > 0} onClick={() => void importFiles()}>Try example payslips</button></div></div>
    <div className="pay-status"><p role="status" className="statement-status">{message}</p>{busy && <button className="text-button" onClick={() => active.current?.abort()}>Cancel reading</button>}</div>
    {error && <p role="alert" className="statement-error">{error}</p>}
    {slips.length > 0 && <>
      <div className="pay-filter-row"><div><strong>{fictional ? 'Fictional example history' : 'Your pay history'}</strong><p>{confirmed.length} confirmed in this view · {pending.length} awaiting review across this session</p></div><div className="pay-filters"><label>Financial year<select value={year} onChange={e => setYear(e.target.value)}><option value="all">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select></label><label>Employer<select value={employer} onChange={e => setEmployer(e.target.value)}><option value="all">All employers</option>{employers.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>Chart grouping<select value={grouping} onChange={e => setGrouping(e.target.value as 'month' | 'payday')}><option value="month">Monthly</option><option value="payday">Per payday</option></select></label></div></div>
      <div className="statement-metrics pay-metrics" aria-label="Confirmed pay totals"><div><span>Gross earnings</span><strong>{aud(t.gross)}</strong><small>Before withholding and deductions</small></div><div><span>Take-home pay</span><strong>{aud(t.net)}</strong><small>Net pay recorded on payslips</small></div><div><span>Tax withheld</span><strong>{aud(t.withheld)}</strong><small>{t.percentage === null ? 'No percentage available' : `${t.percentage}% of gross`} · not your final tax rate</small></div><div><span>Super recorded</span><strong>{t.superKnown ? aud(t.superCents) : 'Unknown'}</strong><small>{t.superKnown}/{t.count} records have an amount · not verified as paid</small></div></div>
      {confirmed.length > 0 ? <PayslipCharts slips={confirmed} grouping={grouping} /> : <div className="statement-panel pay-empty"><h3>{pending.length ? 'Your figures need a quick check.' : 'No confirmed payslips in this view.'}</h3><p>Only confirmed records appear in the charts. Review a payslip below or change the filters.</p></div>}
      <div className="statement-insights"><section className="statement-panel"><div className="panel-heading"><h3>What changed?</h3><span>Based on uploaded records</span></div>{notes.length ? <ul className="pay-notes">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : <p className="empty-note">Add and confirm more periods from the same employer to compare changes. Missing periods are never filled with guessed earnings.</p>}</section><section className="statement-panel review-callout"><p className="eyebrow">Your tax outlook</p><h3>Understand today. Prepare for later.</h3><p>This release shows recorded pay and withholding. A year-end forecast needs your tax profile and verified calculations; it is not available yet.</p><p>Your history can already help you collect the figures and questions you need for tax preparation.</p><small>No tax liability or refund has been calculated.</small></section></div>
      <section className="statement-panel pay-history"><div className="panel-heading"><h3>Payslips & reviews</h3><span>All {slips.length} records · filters above apply to charts and confirmed export</span></div><div className="statement-table-wrap"><table><thead><tr><th>Pay date</th><th>Employer / source</th><th>Gross</th><th>Withheld</th><th>Status</th><th>Action</th></tr></thead><tbody>{slips.map(s => <tr key={s.id}><td>{s.facts.payDate || 'Not supplied'}</td><td>{s.facts.employer || 'Employer needed'}<small>{s.name}</small></td><td>{money(s.facts.gross) === null ? 'Unknown' : aud(money(s.facts.gross)!)}</td><td>{money(s.facts.withheld) === null ? 'Unknown' : aud(money(s.facts.withheld)!)}</td><td><span className={`pay-badge ${s.confirmed && !confirmationIssues(s, slips).length ? 'confirmed' : ''}`}>{s.confirmed && !confirmationIssues(s, slips).length ? 'Confirmed' : 'Needs review'}</span></td><td><button className="text-button" disabled={busy} aria-label={`Review ${s.name} ${s.facts.payDate}`} onClick={() => openReview(s.id)}>Review</button></td></tr>)}</tbody></table></div></section>
      <div ref={review}>{current && !busy && <PayslipReview key={current.id} slip={current} all={slips} onChange={facts => setSlips(rows => rows.map(s => s.id === current.id ? changedFacts(s, facts) : s))} onConfirm={() => { if (confirmationIssues(current, slips).length) return; setSlips(rows => rows.map(s => s.id === current.id ? { ...s, confirmed: true } : s)); setMessage('Figures confirmed. The charts now include this payslip.'); setSelected(null) }} onClose={() => setSelected(null)} onRemove={() => { setSlips(rows => rows.filter(s => s.id !== current.id)); setSelected(null); setYear('all'); setEmployer('all'); setMessage('Payslip removed. Totals updated.') }} />}</div>
      <div className="statement-export"><div><h3>Keep your pay history.</h3><p>Download confirmed figures, source references and outstanding questions. This session clears on refresh or workspace change.</p></div><div><button className="primary-button" disabled={busy} onClick={() => { downloadPayReport(payslipReport(confirmed, slips, `${year === 'all' ? 'All financial years' : year} · ${employer === 'all' ? 'All employers' : employers.find(([k]) => k === employer)?.[1] ?? employer}`)); setMessage('Pay history report downloaded. Keep the original payslips separately.') }}>Download pay report</button><button className="text-button" disabled={busy} onClick={clear}>Clear pay history</button></div></div>
    </>}
    <details className="statement-help"><summary>What these checks can tell you</summary><p>We check recorded amounts and whether gross minus withholding and other deductions equals net pay. This does not verify your award rate, hours worked, employer tax remittances or super fund receipts. Super can be shown as an intended contribution on a payslip. <a href="https://www.fairwork.gov.au/pay-and-wages/paying-wages/pay-slips" target="_blank" rel="noreferrer">Fair Work explains payslip requirements.</a></p><p>No payslip is uploaded, sent to an AI model or saved in browser storage. Reading and explanations use local code. Reports remain on your device after downloading; no original PDF is embedded. The example contains invented figures and is not a payroll calculation reference.</p></details>
  </section>
}
