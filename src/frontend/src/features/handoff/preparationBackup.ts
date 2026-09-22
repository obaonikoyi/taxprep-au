import type { YearEndReconciliation } from '../payslips/yearEndReconciliation'
import {
  blankBankDepositAnswer,
  blankExpenseCoverageAnswers,
  type BankDepositAnswer,
  type CoverageStatus,
  type YearEndPreparationAnswers,
} from '../payslips/yearEndPreparation'
import { handoffConflicts, parseYearEndHandoffValue, type YearEndHandoff } from './yearEndHandoff'

/*
 * The `taxprep-` prefix below is deliberate, and outlives the rename to Xoba
 * Paycheck (September 2026). These strings are checked when a backup is
 * restored, so renaming them would refuse a file somebody downloaded before
 * the rename. A version identifier names a format, not a product, which is
 * why it carries a version suffix; it changes when the format changes.
 * See docs/RENAME_TO_XOBA_PAYCHECK.md.
 */
export const PREPARATION_BACKUP_VERSION = 'taxprep-year-end-preparation-backup-v1'
export const PREPARATION_BACKUP_PAYLOAD_VERSION = 'taxprep-year-end-preparation-payload-v1'
export const PREPARATION_BACKUP_ITERATIONS = 210_000
export const MAX_PREPARATION_BACKUP_BYTES = 262_144
export const MIN_BACKUP_PASSPHRASE_LENGTH = 12

type BackupEnvelope = {
  version: typeof PREPARATION_BACKUP_VERSION
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    iv: string
  }
  ciphertext: string
}

export type PreparationBackupPayload = {
  version: typeof PREPARATION_BACKUP_PAYLOAD_VERSION
  financialYear: string
  reconciliationFingerprint: string
  createdAt: string
  answers: YearEndPreparationAnswers
  handoffs: YearEndHandoff[]
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const coverage = (value: unknown): value is CoverageStatus => value === '' || value === 'complete' || value === 'partial' || value === 'not-reviewed' || value === 'not-applicable'
const bankStatus = (value: unknown): value is BankDepositAnswer['status'] => value === '' || value === 'matched' || value === 'split-timing' || value === 'missing-deposit' || value === 'not-checked' || value === 'unsure'
const boundedString = (value: unknown, max: number) => typeof value === 'string' && value.length <= max
const numericText = (value: unknown, max = 64) => boundedString(value, max) && (!String(value).trim() || /^\d+(?:\.\d{1,2})?$/.test(String(value).trim()))
const timestamp = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)))
  }
  return btoa(binary)
}

function base64ToBytes(value: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error('The encrypted backup contains invalid encoded data.')
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    throw new Error('The encrypted backup contains invalid encoded data.')
  }
}

async function sha256Text(value: string) {
  const bytes = encoder.encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function canonicalReconciliation(reconciliation: YearEndReconciliation) {
  const payslips = reconciliation.checkedSlips.map(slip => ({
    hash: slip.hash || '',
    name: slip.name,
    employer: slip.facts.employer.trim(),
    payDate: slip.facts.payDate,
    periodStart: slip.facts.periodStart,
    periodEnd: slip.facts.periodEnd,
    gross: slip.facts.gross,
    withheld: slip.facts.withheld,
    deductions: slip.facts.deductions,
    net: slip.facts.net,
    super: slip.facts.super,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  const annualSources = reconciliation.sourceRows.map(({ source }) => ({
    payer: source.payer.trim(),
    reference: source.reference.trim(),
    gross: source.gross,
    withheld: source.withheld,
    sourceType: source.sourceType,
    finalStatus: source.finalStatus,
    linkedEmployer: source.linkedEmployer,
    documentHash: source.documentHash || '',
    reviewed: source.reviewed !== false,
    unresolvedCoverage: [...(source.unresolvedCoverage ?? [])].sort(),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  return {
    reconciliationVersion: reconciliation.version,
    year: reconciliation.year,
    coverageAnswer: reconciliation.coverageAnswer,
    payslips,
    annualSources,
  }
}

export async function reconciliationFingerprint(reconciliation: YearEndReconciliation) {
  return sha256Text(JSON.stringify(canonicalReconciliation(reconciliation)))
}

function validatePassphrase(passphrase: string) {
  if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) throw new Error(`Use a backup passphrase of at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters.`)
  if (passphrase.length > 200) throw new Error('Use a backup passphrase of 200 characters or fewer.')
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const passphraseBytes = encoder.encode(passphrase)
  const material = await crypto.subtle.importKey('raw', passphraseBytes.slice().buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.slice().buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function cloneAnswers(value: unknown): YearEndPreparationAnswers {
  if (!object(value) || !object(value.bank) || !object(value.expenses)) throw new Error('The decrypted backup preparation answers are invalid.')
  const bank: Record<string, BankDepositAnswer> = {}
  const bankEntries = Object.entries(value.bank)
  if (bankEntries.length > 50) throw new Error('The decrypted backup contains too many bank-check records.')

  for (const [key, answer] of bankEntries) {
    if (!boundedString(key, 160) || !object(answer) || !bankStatus(answer.status) || !numericText(answer.depositTotal) || !boundedString(answer.note, 800)) {
      throw new Error('The decrypted backup contains an invalid bank-check answer.')
    }
    bank[key] = { ...blankBankDepositAnswer(), status: answer.status, depositTotal: String(answer.depositTotal), note: String(answer.note) }
  }

  const source = value.expenses
  for (const key of ['bankSpending', 'receiptEvidence', 'workPurpose', 'ruleReview'] as const) {
    if (!coverage(source[key])) throw new Error('The decrypted backup contains an invalid expense-coverage answer.')
  }
  for (const key of ['reviewedTransactions', 'workReviewTransactions', 'receiptCount', 'workPurposeCount'] as const) {
    if (!boundedString(source[key], 12) || (String(source[key]).trim() && !/^\d+$/.test(String(source[key]).trim()))) throw new Error('The decrypted backup contains an invalid preparation count.')
  }
  if (!numericText(source.flaggedWorkAmount) || !boundedString(source.note, 1200)) throw new Error('The decrypted backup contains invalid preparation details.')

  return {
    bank,
    expenses: {
      ...blankExpenseCoverageAnswers(),
      bankSpending: source.bankSpending as CoverageStatus,
      receiptEvidence: source.receiptEvidence as CoverageStatus,
      workPurpose: source.workPurpose as CoverageStatus,
      ruleReview: source.ruleReview as CoverageStatus,
      reviewedTransactions: String(source.reviewedTransactions),
      workReviewTransactions: String(source.workReviewTransactions),
      receiptCount: String(source.receiptCount),
      workPurposeCount: String(source.workPurposeCount),
      flaggedWorkAmount: String(source.flaggedWorkAmount),
      note: String(source.note),
    },
  }
}

function validatePayload(value: unknown): PreparationBackupPayload {
  if (!object(value) || value.version !== PREPARATION_BACKUP_PAYLOAD_VERSION) throw new Error('This decrypted preparation-backup payload version is not supported.')
  if (typeof value.financialYear !== 'string' || !/^\d{4}[–-]\d{2}$/.test(value.financialYear)) throw new Error('The decrypted backup financial year is invalid.')
  if (typeof value.reconciliationFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.reconciliationFingerprint)) throw new Error('The decrypted backup reconciliation fingerprint is invalid.')
  if (!timestamp(value.createdAt)) throw new Error('The decrypted backup creation time is invalid.')
  if (!Array.isArray(value.handoffs) || value.handoffs.length > 20) throw new Error('The decrypted backup handoff list is invalid.')
  const handoffs = value.handoffs.map(parseYearEndHandoffValue)
  const financialYear = String(value.financialYear).replace('-', '–')
  if (handoffs.some(handoff => handoff.financialYear !== financialYear)) throw new Error('The decrypted backup contains a handoff for a different financial year.')
  for (let index = 0; index < handoffs.length; index++) {
    if (handoffConflicts(handoffs.slice(0, index), handoffs[index])) throw new Error('The decrypted backup contains duplicate or conflicting workspace handoffs.')
  }
  return {
    version: PREPARATION_BACKUP_PAYLOAD_VERSION,
    financialYear,
    reconciliationFingerprint: value.reconciliationFingerprint,
    createdAt: value.createdAt,
    answers: cloneAnswers(value.answers),
    handoffs,
  }
}

function parseEnvelope(value: unknown): BackupEnvelope {
  if (!object(value) || value.version !== PREPARATION_BACKUP_VERSION || !object(value.kdf) || !object(value.cipher)) throw new Error('This encrypted preparation-backup format is not supported.')
  if (value.kdf.name !== 'PBKDF2' || value.kdf.hash !== 'SHA-256' || value.kdf.iterations !== PREPARATION_BACKUP_ITERATIONS) throw new Error('This encrypted preparation-backup key derivation is not supported.')
  if (value.cipher.name !== 'AES-GCM') throw new Error('This encrypted preparation-backup cipher is not supported.')
  if (typeof value.kdf.salt !== 'string' || typeof value.cipher.iv !== 'string' || typeof value.ciphertext !== 'string') throw new Error('This encrypted preparation backup is incomplete.')
  const salt = base64ToBytes(value.kdf.salt), iv = base64ToBytes(value.cipher.iv), ciphertext = base64ToBytes(value.ciphertext)
  if (salt.length !== 16 || iv.length !== 12 || !ciphertext.length || ciphertext.length > MAX_PREPARATION_BACKUP_BYTES) throw new Error('This encrypted preparation backup has invalid cryptographic fields.')
  return value as unknown as BackupEnvelope
}

export async function createPreparationBackup(
  reconciliation: YearEndReconciliation,
  answers: YearEndPreparationAnswers,
  handoffs: YearEndHandoff[],
  passphrase: string,
) {
  validatePassphrase(passphrase)
  const payload: PreparationBackupPayload = {
    version: PREPARATION_BACKUP_PAYLOAD_VERSION,
    financialYear: reconciliation.year,
    reconciliationFingerprint: await reconciliationFingerprint(reconciliation),
    createdAt: new Date().toISOString(),
    answers: cloneAnswers(answers),
    handoffs: handoffs.map(handoff => parseYearEndHandoffValue(handoff)),
  }
  const plaintext = encoder.encode(JSON.stringify(payload))
  if (plaintext.length > 180_000) throw new Error('This preparation backup is too large to encrypt safely in this prototype.')

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, PREPARATION_BACKUP_ITERATIONS)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer }, key, plaintext.slice().buffer as ArrayBuffer)
  const envelope: BackupEnvelope = {
    version: PREPARATION_BACKUP_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PREPARATION_BACKUP_ITERATIONS, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', iv: bytesToBase64(iv) },
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  }
  return envelope
}

export async function decryptPreparationBackup(
  envelopeValue: unknown,
  passphrase: string,
  reconciliation: YearEndReconciliation,
) {
  validatePassphrase(passphrase)
  const envelope = parseEnvelope(envelopeValue)
  const salt = base64ToBytes(envelope.kdf.salt)
  const iv = base64ToBytes(envelope.cipher.iv)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const key = await deriveKey(passphrase, salt, envelope.kdf.iterations)

  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer }, key, ciphertext.slice().buffer as ArrayBuffer)
  } catch {
    throw new Error('Backup could not be decrypted. Check the passphrase and confirm the file has not been changed.')
  }

  let value: unknown
  try {
    value = JSON.parse(decoder.decode(plaintext))
  } catch {
    throw new Error('The decrypted backup payload is not valid JSON.')
  }
  const payload = validatePayload(value)
  const expectedYear = reconciliation.year.replace('-', '–')
  if (payload.financialYear !== expectedYear) throw new Error(`This backup is for ${payload.financialYear}, not the selected ${expectedYear} financial year.`)
  const fingerprint = await reconciliationFingerprint(reconciliation)
  if (payload.reconciliationFingerprint !== fingerprint) throw new Error('This backup belongs to different checked pay or annual-source facts. Load the matching reconciliation before restoring it.')
  const employerKeys = new Set(reconciliation.employerNames.map(([key]) => key))
  if (Object.keys(payload.answers.bank).some(key => !employerKeys.has(key))) throw new Error('This backup contains a bank-check answer that does not belong to the matched reconciliation.')
  return payload
}

export async function readEncryptedPreparationBackup(file: File) {
  if (!/\.json$/i.test(file.name)) throw new Error('Choose a Xoba Paycheck encrypted preparation-backup JSON file.')
  if (!file.size || file.size > MAX_PREPARATION_BACKUP_BYTES) throw new Error('Use an encrypted preparation backup from 1 byte to 256 KB.')
  try {
    return JSON.parse(await file.text()) as unknown
  } catch {
    throw new Error('This encrypted preparation backup is not valid JSON.')
  }
}

export function downloadPreparationBackup(envelope: unknown, financialYear: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(envelope, null, 2) + '\n'], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `xoba-paycheck-year-end-${financialYear.replace('–', '-')}-encrypted-backup.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
