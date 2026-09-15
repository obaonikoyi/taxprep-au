import { useRef, useState } from 'react'
import { demoProfile } from '../demo/demoData'
import type { Expense, ExpenseReviewResult } from '../expenses/expenseReview'
import { createPreparationReport, downloadPreparationReport } from './preparationReport'

export default function ReportExport({ expenses, review }: { expenses: Expense[]; review: ExpenseReviewResult }) {
  // The parent summary remounts after every edit: this immutable report belongs to that exact review.
  const [snapshot] = useState(() => {
    try { return { report: createPreparationReport(expenses, review, demoProfile), error: null } }
    catch { return { report: null, error: 'The report could not be prepared. Return to an expense and save it to refresh the review.' } }
  })
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const preview = useRef<HTMLDetailsElement>(null)

  function download() {
    setError(''); setMessage('')
    try {
      downloadPreparationReport(snapshot.report!)
      setMessage('Report download requested. Check your browser’s downloads.')
    } catch { setError('The download could not start. Try again, or use Print / save PDF.') }
  }
  function print() {
    setError(''); setMessage('')
    try {
      const target = frame.current?.contentWindow
      if (!ready || !target || typeof target.print !== 'function') throw new Error('Print unavailable')
      // Show the document being printed; some browsers cannot print a hidden frame.
      if (preview.current) preview.current.open = true
      target.focus(); target.print()
      setMessage('Print requested. Choose Save as PDF in the print options if available.')
    } catch { setError('Printing could not start. Download the HTML report and use your browser’s Print command.') }
  }
  return (
    <section className="report-export" aria-labelledby="report-export-title">
      <h4 id="report-export-title">Keep your preparation report</h4>
      <p>Download an offline HTML copy with these totals, evidence references and next actions, or print it from your browser.</p>
      {snapshot.error ? <p role="alert">{snapshot.error}</p> : <>
        <div className="button-row"><button className="primary-button" type="button" onClick={download}>Download report (HTML)</button><button className="secondary-button" type="button" disabled={!ready} onClick={print}>Print / save PDF</button></div>
        <p role="status" className="export-status">{message || (ready ? 'Report ready. Later edits do not change downloaded copies.' : 'Preparing print preview…')}</p>
        {error && <p className="form-message form-message--error" role="alert">{error}</p>}
        <details ref={preview} className="report-preview"><summary>Preview report</summary>
          <iframe ref={frame} title="Preparation report preview" srcDoc={snapshot.report!.html} sandbox="allow-same-origin allow-modals" onLoad={() => setReady(frame.current?.contentDocument?.documentElement.dataset.report === 'taxprep-expenses-v1')} />
        </details>
      </>}
    </section>
  )
}
