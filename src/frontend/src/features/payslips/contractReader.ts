import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { isPicture, pictureCanvas, recogniseRows } from './payslipPicture'
import { textLines } from './payslipReader'
import type { RateBasis } from './payRate'

/*
 * Reading the agreed rate out of a contract.
 *
 * The app has always taken this rate by hand, and that was a deliberate
 * refusal rather than an omission: a contract carries a salary, a signature and
 * other people's names, and a wrong rate here is worse than a wrong figure on a
 * payslip. A payslip's gross is one row in a total. A contract's rate becomes
 * the baseline every payslip is compared against, so one wrong number produces
 * a run of confident, specific, wrong findings — and this app exists to turn
 * those into a message somebody sends their employer.
 *
 * So this is built to refuse. The reading comes back with the sentence it was
 * read from, the server throws the whole answer away if that sentence is not in
 * the contract, and what survives lands in the rate form for the person to
 * confirm. Nothing is saved until they do, and what is saved is what was always
 * saved: a rate and their own note. The contract itself is never stored, never
 * uploaded, and never leaves this device — only its text does, to this origin.
 */
export const CONTRACT_ENDPOINT = '/api/contract/read'
export const MAX_CONTRACT_BYTES = 5_000_000
const MAX_CONTRACT_TEXT = 60_000

export type ContractReading = {
  employer: string
  basis: RateBasis | ''
  amount: string
  weeklyHours: string
  from: string
  /** The sentence the rate was read from, checked against the contract by the server. */
  quote: string
  /** Why there is no rate, when there is none. Written for the person to read. */
  why: string
}

export class ContractReadError extends Error {}

const blank = (): ContractReading => ({ employer: '', basis: '', amount: '', weeklyHours: '', from: '', quote: '', why: '' })

/** What the server may be believed about. Anything else is nothing. */
export function contractReading(value: unknown): ContractReading {
  const reading = blank()
  if (value === null || typeof value !== 'object') return reading
  const source = value as Record<string, unknown>
  const text = (key: string, longest: number) => {
    const read = source[key]
    return typeof read === 'string' && read.length <= longest ? read.trim() : ''
  }
  reading.employer = text('employer', 120)
  reading.amount = text('amount', 120)
  reading.weeklyHours = text('weeklyHours', 120)
  reading.from = text('from', 120)
  reading.quote = text('quote', 300)
  reading.why = text('why', 300)
  const basis = text('basis', 120)
  // Narrowed again here: the server already does this, and either end could
  // change without the other.
  if (basis === 'hourly' || basis === 'annual') reading.basis = basis
  // A rate with no basis is not a rate, and a basis with no rate is nothing.
  if (!reading.amount || !reading.basis) { reading.amount = ''; reading.basis = ''; reading.quote = '' }
  return reading
}

/** Pull the words out of a contract, on this device, whatever shape it arrives in. */
export async function contractText(file: File, signal: AbortSignal, progress: (message: string) => void): Promise<string> {
  const check = () => { if (signal.aborted) throw new Error('Reading cancelled. Your recorded rates are unchanged.') }
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name) || !file.size || file.size > MAX_CONTRACT_BYTES || file.name.length > 180)
    throw new ContractReadError('Choose a PDF, PNG or JPG contract of up to 5 MB, with a file name of at most 180 characters.')
  const bytes = new Uint8Array(await file.arrayBuffer()); check()

  if (isPicture(file.name)) {
    const canvas = await pictureCanvas(file, bytes); check()
    try { return (await recogniseRows(canvas, signal, progress)).map(row => row.text).join('\n') }
    finally { canvas.width = 0; canvas.height = 0 }
  }

  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new ContractReadError('The selected file is not a PDF.')
  GlobalWorkerOptions.workerSrc = '/document-engine/pdf.worker.min.mjs'
  const task = getDocument({ data: bytes, useSystemFonts: true, standardFontDataUrl: '/document-engine/standard_fonts/', wasmUrl: '/document-engine/wasm/', cMapUrl: '/document-engine/cmaps/', cMapPacked: true, stopAtErrors: true })
  const abort = () => { void task.destroy() }
  signal.addEventListener('abort', abort, { once: true })
  try {
    const pdf = await task.promise; check()
    // A contract runs to several pages, unlike a payslip. The rate clause is
    // rarely on the first, so every page is read.
    if (pdf.numPages > 20) throw new ContractReadError('Use a contract of no more than 20 pages.')
    const pages: string[] = []
    for (let number = 1; number <= pdf.numPages; number++) {
      check()
      progress(`Reading page ${number} of ${pdf.numPages}…`)
      const page = await pdf.getPage(number)
      const content = await page.getTextContent()
      const tokens = content.items.flatMap(i => 'str' in i && i.str.trim() ? [{ text: i.str, x: i.transform[4], y: i.transform[5], width: i.width }] : [])
      if (tokens.length) pages.push(textLines(tokens).join('\n'))
      else {
        // A scanned contract, which is most of them.
        progress(`Page ${number} has no text of its own. Reading it as a picture…`)
        const original = page.getViewport({ scale: 1 })
        const scale = Math.min(2, 1800 / Math.max(original.width, original.height))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
        await page.render({ canvas, viewport }).promise; check()
        try { pages.push((await recogniseRows(canvas, signal, progress)).map(row => row.text).join('\n')) }
        finally { canvas.width = 0; canvas.height = 0 }
      }
      page.cleanup()
    }
    return pages.join('\n')
  } finally { signal.removeEventListener('abort', abort); await task.destroy() }
}

/** Ask the server to read one contract's text. Always ends somewhere the person can type. */
export async function readContract(text: string, signal: AbortSignal): Promise<ContractReading> {
  if (text.trim().length < 200) throw new ContractReadError('Almost no text could be read from that file. Enter the rate from your contract instead.')
  if (text.length > MAX_CONTRACT_TEXT) throw new ContractReadError('That contract is too long to read. Enter the rate from it instead.')

  let response: Response
  try {
    response = await fetch(CONTRACT_ENDPOINT, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    if (signal.aborted) throw new Error('Reading cancelled. Your recorded rates are unchanged.')
    throw new ContractReadError('Could not reach the contract reader. Enter the rate from your contract instead.')
  }

  let body: unknown = null
  try { body = await response.json() } catch { /* an error page, or nothing at all */ }
  const message = typeof (body as { message?: unknown })?.message === 'string'
    ? (body as { message: string }).message
    : 'The contract could not be read. Enter the rate from your contract instead.'
  if (!response.ok) throw new ContractReadError(message)
  return contractReading((body as { fields?: unknown })?.fields)
}
