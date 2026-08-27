import { useState, type ChangeEvent, type FormEvent } from 'react'

function TransactionUpload() {
  // Before the user chooses a file, the tray is empty, so the state is null.
  // File is a browser type containing details such as the file name and size.
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    setErrorMessage('')
    setStatusMessage('')

    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      setSelectedFile(null)
      setErrorMessage('Please choose a CSV file.')
      event.target.value = ''
      return
    }

    setSelectedFile(file)
  }

  function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedFile) {
      setStatusMessage('')
      setErrorMessage('Select a CSV file before importing transactions.')
      return
    }

    // This stage proves the browser can safely receive a CSV selection.
    // Sending the file to ASP.NET will be added with the import API endpoint.
    setErrorMessage('')
    setStatusMessage(`${selectedFile.name} is ready to import.`)
  }

  return (
    <section className="transaction-upload" aria-labelledby="transaction-upload-title">
      <div>
        <p className="eyebrow">Milestone 2</p>
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
    </section>
  )
}

export default TransactionUpload
