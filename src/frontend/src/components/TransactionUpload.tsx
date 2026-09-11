import { useState, type ChangeEvent, type FormEvent } from 'react'
import { parseTransactionCsv, type ImportedTransaction } from '../features/transactions/transactionCsv'

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

function TransactionUpload() {
  // Before the user chooses a file, the tray is empty, so the state is null.
  // File is a browser type containing details such as the file name and size.
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    setErrorMessage('')
    setStatusMessage('')
    setTransactions([])
    setValidationErrors([])

    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      setSelectedFile(null)
      setErrorMessage('Please choose a CSV file.')
      event.target.value = ''
      return
    }

    setSelectedFile(file)
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedFile) {
      setStatusMessage('')
      setErrorMessage('Select a CSV file before importing transactions.')
      return
    }

    if (selectedFile.size > 1_000_000) {
      setErrorMessage('The file is too large. Choose a CSV smaller than 1 MB.')
      return
    }

    const result = parseTransactionCsv(await selectedFile.text())
    setErrorMessage('')
    setTransactions(result.transactions)
    setValidationErrors(result.errors)
    setStatusMessage(
      result.transactions.length > 0
        ? `${result.transactions.length} transaction${result.transactions.length === 1 ? '' : 's'} ready for review.`
        : '',
    )
  }

  return (
    <section className="transaction-upload" aria-labelledby="transaction-upload-title">
      <div>
        <p className="eyebrow">Milestone 3</p>
        <h2 id="transaction-upload-title">Import transactions</h2>
        <p className="upload-description">
          Choose a fictional CSV file to begin preparing a transaction preview.
          Do not use real bank or financial information during development.
        </p>
      </div>

      <form className="upload-panel" onSubmit={handleImport}>
        <label htmlFor="transaction-file">Transaction CSV</label>
        <input
          id="transaction-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
        />

        <p className="selected-file" aria-live="polite">
          {selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}
        </p>

        {errorMessage && <p className="form-message form-message--error">{errorMessage}</p>}
        {statusMessage && <p className="form-message form-message--success">{statusMessage}</p>}

        <button type="submit">Import Transactions</button>
      </form>

      {validationErrors.length > 0 && (
        <aside className="import-errors" aria-labelledby="import-errors-title">
          <h3 id="import-errors-title">Check these rows</h3>
          <ul>{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </aside>
      )}

      {transactions.length > 0 && (
        <div className="transaction-preview">
          <div className="preview-heading">
            <div><p className="eyebrow">Import preview</p><h3>Review before saving</h3></div>
            <span>{currency.format(transactions.reduce((total, item) => total + item.amount, 0))} net</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.date}</td><td>{transaction.description}</td>
                    <td className={transaction.amount < 0 ? 'expense' : 'income'}>{currency.format(transaction.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="privacy-note">Preview only. Transactions are not uploaded or stored yet.</p>
        </div>
      )}
    </section>
  )
}

export default TransactionUpload
