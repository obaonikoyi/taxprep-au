export const MAXIMUM_FILE_SIZE = 1_000_000
export const UPLOAD_TIMEOUT_MS = 15_000

export interface ImportedTransaction {
  rowNumber: number
  date: string
  description: string
  amount: number
}
export interface ImportValidationError {
  rowNumber: number | null
  message: string
}
export interface ImportPreview {
  transactions: ImportedTransaction[]
  errors: ImportValidationError[]
  netTotal: number
}

export function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) return 'Please choose a CSV file.'
  if (file.size === 0) return 'The CSV file is empty.'
  if (file.size > MAXIMUM_FILE_SIZE) return 'Choose a CSV up to 1 MB (1,000,000 bytes).'
  return null
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'
const isRowNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

// TypeScript annotations do not validate JSON. Check the response at this boundary.
function isPreview(value: unknown): value is ImportPreview {
  if (!isObject(value) || !Array.isArray(value.transactions) || !Array.isArray(value.errors)) return false
  const rows = value.transactions
  return typeof value.netTotal === 'number' && Number.isFinite(value.netTotal)
    && rows.length <= 5000
    && rows.every(row => isObject(row) && isRowNumber(row.rowNumber)
      && typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
      && typeof row.description === 'string'
      && typeof row.amount === 'number' && Number.isFinite(row.amount))
    && new Set(rows.map(row => row.rowNumber)).size === rows.length
    && value.errors.every(error => isObject(error)
      && (error.rowNumber === null || isRowNumber(error.rowNumber))
      && typeof error.message === 'string')
}

export async function fetchImportPreview(file: File, signal: AbortSignal): Promise<ImportPreview> {
  const body = new FormData()
  body.append('file', file)
  let response: Response
  try {
    response = await fetch('/api/transactions/import-preview', { method: 'POST', body, signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Could not reach the preview service. Please try again shortly.')
  }
  if (response.status === 413) throw new Error('Choose a CSV up to 1 MB (1,000,000 bytes).')
  if (response.status >= 500) throw new Error('The preview service is unavailable. Please try again shortly.')
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error('The preview service returned an unreadable response. Please try again.')
  }
  if (!response.ok) {
    throw new Error(isObject(data) && typeof data.message === 'string' && data.message.length < 300
      ? data.message : 'The upload could not be processed. Check the CSV and try again.')
  }
  if (!isPreview(data)) throw new Error('The preview service returned an unexpected response. Please try again.')
  return data
}
