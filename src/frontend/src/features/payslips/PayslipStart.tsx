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
      {/*
        * One thing to do, said in one line. What used to be here asked a person
        * to understand three separate controls — a manual-entry button, a
        * privacy checkbox and a file picker — before they could do anything at
        * all, and named "documented layouts" to explain the difference. Nobody
        * arrives knowing what a layout is. They arrive holding a payslip.
        */}
      <p>Add your payslip and it fills in the figures. You check them, then you see your pay.</p>
      <label className="statement-file pay-file-main">Choose your payslip<input aria-label="Choose payslips or photos" type="file" accept=".pdf,application/pdf,.png,.jpg,.jpeg,image/png,image/jpeg" multiple disabled={busy || fictional} onChange={e => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) onImport(files) }} /></label>
      <span className="pay-start-hint">A PDF, or a photo taken on your phone. Your file stays on this device.</span>
      {/*
        * Typing it all in by hand is a real answer — a paper payslip, a format
        * nothing can read — but it is the harder road, so it is offered as one
        * rather than presented as the way in.
        */}
      <p className="pay-start-alt">No file to hand? <button className="text-button" disabled={busy || fictional} onClick={onManual}>Type the figures in yourself</button></p>
      <details className="pay-format"><summary>What files can I use?</summary>
        <p>A PDF of one page, up to 2 MB. Or a photo of your payslip — PNG or JPG, up to 5 MB. Up to 20 files at once.</p>
        <p>
          A photo is read on this device by recognising the words in the picture. Nothing is uploaded and no picture leaves your phone or computer.
          It takes a few seconds and it can misread a figure, so check every one before you confirm it. A straight, sharp photo of the whole payslip in good light reads best.
        </p>
        <ul className="pay-format-list">
          <li>
            <strong>Want to try it first?</strong>
            <p>Download a made-up payslip and add it like your own.</p>
            <button className="text-button" disabled={busy} onClick={() => void downloadExample('summary')}>Download a simple one</button>
            <button className="text-button" disabled={busy} onClick={() => void downloadExample('advice')}>Download one with a table</button>
          </li>
        </ul>
      </details>
    </section>
    {!hasRecords && <section className="pay-start-card pay-demo-card">
      <span className="pay-demo-label">Just looking around?</span><h2>See it with an example</h2><p>No files needed. Explore six made-up payslips and see what your dashboard could look like.</p>
      <div className="pay-demo-preview" aria-label="Fictional example preview"><span>Example take-home pay</span><strong>$8,815.00</strong><div className="pay-preview-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div><small>Six payslips · Two employers</small></div>
      <button className="secondary-button" disabled={busy} onClick={() => onImport()}>Try example payslips <span aria-hidden="true">→</span></button>
      <span className="pay-start-hint">You can switch to your own figures afterwards.</span>
    </section>}
  </div>
}
