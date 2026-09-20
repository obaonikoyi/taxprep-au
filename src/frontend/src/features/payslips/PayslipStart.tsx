import type { Ref } from 'react'
type Props = { headingRef: Ref<HTMLHeadingElement>; busy: boolean; hasRecords: boolean; fictional: boolean; onManual: () => void; onImport: (files?: File[]) => void }

export default function PayslipStart({ headingRef, busy, hasRecords, fictional, onManual, onImport }: Props) {
  async function downloadExample(layout: 'summary' | 'advice') {
    const { default: examples } = layout === 'summary'
      ? await import('../../../../../sample-data/payslips/examples.json')
      : await import('../../../../../sample-data/payslips/advice-examples.json')
    const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(examples[0].pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url; link.download = examples[0].name; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className={`pay-start ${hasRecords ? 'has-records' : ''}`}>
    <section className="pay-start-card">
      <span className="pay-card-icon" aria-hidden="true">↗</span>
      <h2 ref={headingRef} tabIndex={-1}>{hasRecords ? 'Add another payslip' : 'Start with your payslip'}</h2>
      <p>Have your payslip ready. Add its figures, check them, then see your pay summary.</p>
      <button className="primary-button" disabled={busy || fictional} onClick={onManual}>Enter figures manually <span aria-hidden="true">→</span></button>
      <span className="pay-start-hint">Copy the figures shown on your payslip.</span>
      <div className="pay-upload-option">
        <h3>Have a supported PDF?</h3>
        <p>PDF upload reads two documented layouts. Use manual entry for other employer layouts or photos.</p>
        <label className="statement-file pay-file-secondary">Choose payslip PDFs<input aria-label="Choose payslip PDFs" type="file" accept=".pdf,application/pdf" multiple disabled={busy || fictional} onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) onImport(files) }} /></label>
        <details className="pay-format"><summary>Which PDFs work?</summary>
          <p>One page with selectable text, up to 2 MB per file, and up to 20 PDFs at once. Scans, photos and other employer layouts are not read automatically yet — enter those figures yourself.</p>
          <ul className="pay-format-list">
            <li>
              <strong>PAYSLIP SUMMARY v1</strong>
              <p>One labelled line per figure.</p>
              <button className="text-button" disabled={busy} onClick={() => void downloadExample('summary')}>Download example</button>
            </li>
            <li>
              <strong>PAY ADVICE v2</strong>
              <p>A table with <em>This pay</em> and <em>Year to date</em> columns. Only the <em>This pay</em> column is read — year-to-date figures are never used.</p>
              <button className="text-button" disabled={busy} onClick={() => void downloadExample('advice')}>Download example</button>
            </li>
          </ul>
        </details>
      </div>
    </section>
    {!hasRecords && <section className="pay-start-card pay-demo-card">
      <span className="pay-demo-label">Just looking around?</span><h2>See it with an example</h2><p>No files needed. Explore six made-up payslips and see what your dashboard could look like.</p>
      <div className="pay-demo-preview" aria-label="Fictional example preview"><span>Example take-home pay</span><strong>$8,815.00</strong><div className="pay-preview-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div><small>Six payslips · Two employers</small></div>
      <button className="secondary-button" disabled={busy} onClick={() => onImport()}>Try example payslips <span aria-hidden="true">→</span></button>
      <span className="pay-start-hint">You can switch to your own figures afterwards.</span>
    </section>}
  </div>
}
