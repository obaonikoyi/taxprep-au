import { useRef, useState } from 'react'
import type { YearEndReconciliation } from '../payslips/yearEndReconciliation'
import type { YearEndPreparationAnswers } from '../payslips/yearEndPreparation'
import type { YearEndHandoff } from './yearEndHandoff'
import {
  createPreparationBackup,
  decryptPreparationBackup,
  downloadPreparationBackup,
  MIN_BACKUP_PASSPHRASE_LENGTH,
  readEncryptedPreparationBackup,
  type PreparationBackupPayload,
} from './preparationBackup'

type Props = {
  reconciliation: YearEndReconciliation
  answers: YearEndPreparationAnswers
  handoffs: YearEndHandoff[]
  onRestore: (payload: PreparationBackupPayload) => void
}

export default function PreparationBackupPanel({ reconciliation, answers, handoffs, onRestore }: Props) {
  const [createPassphrase, setCreatePassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createMessage, setCreateMessage] = useState('')
  const [createError, setCreateError] = useState('')

  const [encryptedCandidate, setEncryptedCandidate] = useState<unknown | null>(null)
  const [encryptedName, setEncryptedName] = useState('')
  const [restorePassphrase, setRestorePassphrase] = useState('')
  const [restoreCandidate, setRestoreCandidate] = useState<PreparationBackupPayload | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const restoreInput = useRef<HTMLInputElement>(null)

  async function createBackup() {
    setCreateError('')
    setCreateMessage('')
    if (createPassphrase !== confirmPassphrase) {
      setCreateError('The backup passphrases do not match.')
      return
    }
    setCreateBusy(true)
    try {
      const envelope = await createPreparationBackup(reconciliation, answers, handoffs, createPassphrase)
      downloadPreparationBackup(envelope, reconciliation.year)
      setCreatePassphrase('')
      setConfirmPassphrase('')
      setCreateMessage('Encrypted backup downloaded. Keep the file and passphrase separately; Xoba Paycheck cannot recover the passphrase.')
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'The encrypted preparation backup could not be created.')
    } finally {
      setCreateBusy(false)
    }
  }

  async function chooseBackup(file: File) {
    setRestoreCandidate(null)
    setRestoreError('')
    setRestoreMessage('Checking encrypted backup file…')
    try {
      const envelope = await readEncryptedPreparationBackup(file)
      setEncryptedCandidate(envelope)
      setEncryptedName(file.name)
      setRestoreMessage('Encrypted backup selected. Enter its passphrase to decrypt and validate it against the current reconciliation.')
    } catch (error) {
      setEncryptedCandidate(null)
      setEncryptedName('')
      setRestoreMessage('')
      setRestoreError(error instanceof Error ? error.message : 'This encrypted preparation backup could not be read.')
    } finally {
      if (restoreInput.current) restoreInput.current.value = ''
    }
  }

  async function decryptBackup() {
    if (!encryptedCandidate) {
      setRestoreError('Choose an encrypted preparation backup first.')
      return
    }
    setRestoreBusy(true)
    setRestoreError('')
    setRestoreCandidate(null)
    setRestoreMessage('Decrypting and checking this backup locally…')
    try {
      const payload = await decryptPreparationBackup(encryptedCandidate, restorePassphrase, reconciliation)
      setRestoreCandidate(payload)
      setRestorePassphrase('')
      setRestoreMessage('Backup decrypted and matched to the current financial year and reconciliation. Review it before restoring.')
    } catch (error) {
      setRestoreMessage('')
      setRestoreError(error instanceof Error ? error.message : 'This preparation backup could not be decrypted.')
    } finally {
      setRestoreBusy(false)
    }
  }

  function restore() {
    if (!restoreCandidate) return
    onRestore(restoreCandidate)
    setRestoreCandidate(null)
    setEncryptedCandidate(null)
    setEncryptedName('')
    setRestorePassphrase('')
    setRestoreError('')
    setRestoreMessage('Preparation answers restored from the encrypted local backup. No source documents were restored or uploaded.')
  }

  return <section className="year-end-prep-section year-end-backup" aria-labelledby="year-end-backup-heading">
    <div className="year-end-prep-section-heading">
      <div>
        <p className="eyebrow">User-controlled save/resume</p>
        <h5 id="year-end-backup-heading">Encrypted local preparation backup</h5>
      </div>
      <span>No cloud storage</span>
    </div>
    <p className="year-end-prep-help">This optional backup contains preparation answers and applied workspace-summary handoffs only. It does not include raw payslip PDFs, annual-statement files, bank transactions, receipt/OCR text, TFNs or a tax/refund result.</p>
    <p className="year-end-prep-help"><strong>Important:</strong> Xoba Paycheck does not receive or store the backup passphrase and cannot recover it. Restore is allowed only after you load the same financial year and matching checked-pay/annual-source reconciliation.</p>

    <div className="year-end-backup-grid">
      <article className="year-end-backup-card">
        <p className="eyebrow">Create backup</p>
        <h6>Download an encrypted file</h6>
        <label>Backup passphrase
          <input aria-label="Year-end backup passphrase" type="password" autoComplete="new-password" minLength={MIN_BACKUP_PASSPHRASE_LENGTH} maxLength={200} value={createPassphrase} onChange={event => setCreatePassphrase(event.target.value)} />
          <small>At least {MIN_BACKUP_PASSPHRASE_LENGTH} characters. Keep it somewhere separate from the backup file.</small>
        </label>
        <label>Confirm passphrase
          <input aria-label="Confirm year-end backup passphrase" type="password" autoComplete="new-password" minLength={MIN_BACKUP_PASSPHRASE_LENGTH} maxLength={200} value={confirmPassphrase} onChange={event => setConfirmPassphrase(event.target.value)} />
        </label>
        <button className="secondary-button" disabled={createBusy} onClick={() => void createBackup()}>{createBusy ? 'Encrypting…' : 'Download encrypted preparation backup'}</button>
        <p className="year-end-handoff-message" role="status">{createMessage}</p>
        {createError && <div className="annual-statement-error" role="alert"><strong>Backup not created.</strong><p>{createError}</p></div>}
      </article>

      <article className="year-end-backup-card">
        <p className="eyebrow">Restore backup</p>
        <h6>Import, decrypt, then review</h6>
        <label className="secondary-button year-end-backup-file">Choose encrypted preparation backup
          <input ref={restoreInput} aria-label="Import encrypted preparation backup" type="file" accept=".json,application/json" disabled={restoreBusy} onChange={event => {
            const file = event.target.files?.[0]
            if (file) void chooseBackup(file)
          }} />
        </label>
        {encryptedName && <p className="year-end-backup-selected">Selected: <strong>{encryptedName}</strong></p>}
        <label>Backup passphrase
          <input aria-label="Restore year-end backup passphrase" type="password" autoComplete="current-password" minLength={MIN_BACKUP_PASSPHRASE_LENGTH} maxLength={200} value={restorePassphrase} onChange={event => setRestorePassphrase(event.target.value)} />
        </label>
        <button className="secondary-button" disabled={restoreBusy || !encryptedCandidate} onClick={() => void decryptBackup()}>{restoreBusy ? 'Decrypting…' : 'Decrypt and check backup'}</button>
        <p className="year-end-handoff-message" role="status">{restoreMessage}</p>
        {restoreError && <div className="annual-statement-error" role="alert"><strong>Backup not restored.</strong><p>{restoreError}</p></div>}

        {restoreCandidate && <div className="year-end-backup-candidate" role="region" aria-label="Review decrypted preparation backup">
          <p className="eyebrow">Candidate only</p>
          <h6>{restoreCandidate.financialYear} preparation backup</h6>
          <ul>
            <li>Created: {restoreCandidate.createdAt}</li>
            <li>{Object.keys(restoreCandidate.answers.bank).length} employer bank-check answer{Object.keys(restoreCandidate.answers.bank).length === 1 ? '' : 's'}</li>
            <li>{restoreCandidate.handoffs.length} applied workspace handoff{restoreCandidate.handoffs.length === 1 ? '' : 's'}</li>
            <li>Matched current reconciliation fingerprint</li>
          </ul>
          <p>Nothing has changed yet. Restore replaces only the current preparation answers and applied handoff summaries.</p>
          <button className="primary-button" onClick={restore}>Restore preparation answers</button>
        </div>}
      </article>
    </div>
  </section>
}
