import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { fetchImportPreview, validateFile, UPLOAD_TIMEOUT_MS, type ImportPreview } from '../features/transactions/importPreview'
import sampleCsv from '../../../../sample-data/transactions.csv?raw'
import TransactionSelection, { type SelectionProps } from '../features/transactions/TransactionSelection'

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

function TransactionUpload({ selection }: { selection?: SelectionProps }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => activeRequest.current?.abort(), [])

  function clearPreview() {
    activeRequest.current?.abort()
    activeRequest.current = null
    setIsLoading(false)
    setPreview(null)
    setErrorMessage('')
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    clearPreview()
    const file = event.target.files?.[0] ?? null
    const error = file ? validateFile(file) : null
    setSelectedFile(error ? null : file)
    if (error) {
      setErrorMessage(error)
      event.target.value = ''
    }
  }

  async function upload(file: File) {
    clearPreview()
    setSelectedFile(file)
    const validationError = validateFile(file)
    if (validationError) { setErrorMessage(validationError); return }

    const controller = new AbortController()
    activeRequest.current = controller
    setIsLoading(true)
    let timedOut = false
    const timer = window.setTimeout(() => { timedOut = true; controller.abort() }, UPLOAD_TIMEOUT_MS)
    try {
      const result = await fetchImportPreview(file, controller.signal)
      // Aborted requests may still settle: only the current selection may update the UI.
      if (activeRequest.current === controller && !controller.signal.aborted) setPreview(result)
    } catch (error) {
      if (activeRequest.current !== controller) return
      if (timedOut) setErrorMessage('The preview took too long. Please try again.')
      else if (!controller.signal.aborted) setErrorMessage(error instanceof Error ? error.message : 'Could not preview this file. Please try again.')
    } finally {
      window.clearTimeout(timer)
      if (activeRequest.current === controller) { activeRequest.current = null; setIsLoading(false) }
    }
  }

  function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFile) { clearPreview(); setErrorMessage('Select a CSV file before previewing transactions.'); return }
    void upload(selectedFile)
  }

  function reset() {
    clearPreview()
    setSelectedFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <section className="transaction-upload" aria-labelledby="transaction-upload-title">
      <div>
        <p className="eyebrow">Transaction preparation</p>
        <h2 id="transaction-upload-title">Review your transactions</h2>
        <p className="upload-description">Try the fictional sample or choose a fictional CSV with date, description and amount columns. Up to 1 MB and 5,000 data rows.</p>
        <p className="upload-description">The file is sent to Xoba Paycheck for validation and processed in memory. It is not saved. Use fictional data for this prototype.</p>
        <button className="secondary-button" type="button" disabled={isLoading} onClick={() => {
          if (fileInput.current) fileInput.current.value = ''
          void upload(new File([sampleCsv], 'sample-transactions.csv', { type: 'text/csv' }))
        }}>Try sample CSV</button>
      </div>

      <form className="upload-panel" onSubmit={handleImport} aria-busy={isLoading}>
        <label htmlFor="transaction-file">Transaction CSV</label>
        <input ref={fileInput} id="transaction-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} aria-describedby="upload-help" />
        <p id="upload-help" className="selected-file">UTF-8 CSV. Negative amounts are spending; positive amounts are incoming money.</p>
        <p className="selected-file">{selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}</p>
        {errorMessage && <p role="alert" className="form-message form-message--error">{errorMessage}</p>}
        <p role="status" className="upload-status">
          {isLoading ? 'Validating transactions…' : preview ? `${preview.transactions.length} valid transaction${preview.transactions.length === 1 ? '' : 's'} ready for review. ${preview.errors.length} item${preview.errors.length === 1 ? '' : 's'} to check.` : ''}
        </p>
        <button type="submit" disabled={isLoading}>{isLoading ? 'Validating…' : 'Preview transactions'}</button>
        {(selectedFile || preview || isLoading) && <button className="clear-upload" type="button" onClick={reset}>{isLoading ? 'Cancel upload' : 'Clear preview'}</button>}
      </form>

      {preview && preview.errors.length > 0 && (
        <aside className="import-errors" aria-labelledby="import-errors-title">
          <h3 id="import-errors-title">Check these items</h3>
          <ul>{preview.errors.map((error, index) => <li key={index}>{error.rowNumber !== null ? `Row ${error.rowNumber}: ` : ''}{error.message}</li>)}</ul>
        </aside>
      )}
      {preview && preview.transactions.length > 0 && (
        <div className="transaction-preview">
          <div className="preview-heading">
            <div><p className="eyebrow">Validated preview</p><h3>Review valid rows</h3></div>
            <span>{currency.format(preview.netTotal)} net</span>
          </div>
          {preview.errors.length > 0 && <p>Some items need correction. This total includes only the valid rows below.</p>}
          {selection ? <TransactionSelection {...selection} transactions={preview.transactions} fileName={selectedFile!.name} /> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Transaction preview table">
            <table>
              <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Amount</th></tr></thead>
              <tbody>{preview.transactions.map(transaction => (
                <tr key={transaction.rowNumber}>
                  <td>{transaction.date}</td><td>{transaction.description}</td>
                  <td className={transaction.amount < 0 ? 'expense' : 'income'}>{currency.format(transaction.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>}
          <p className="upload-description">{selection ? 'Only rows you review and save enter the summary. Clearing this preview keeps saved expenses. Restart the demo to clear everything.' : 'Preview only. No transactions have been saved or assessed as tax deductions.'}</p>
        </div>
      )}
    </section>
  )
}

export default TransactionUpload
