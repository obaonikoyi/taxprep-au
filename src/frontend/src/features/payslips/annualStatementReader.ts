import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { parseAnnualStatement, MAX_ANNUAL_STATEMENT_BYTES, type AnnualStatementCandidate } from './annualStatement'
import { textLines, type TextToken } from './payslipReader'

export function validateAnnualStatementFile(file: File) {
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) throw new Error('Choose a PDF, PNG or JPG annual statement.')
  if (!file.size || file.size > MAX_ANNUAL_STATEMENT_BYTES) throw new Error('Use a file of 1 byte–2 MB.')
  if (file.name.length > 180) throw new Error('Shorten the file name to 180 characters or fewer.')
}

async function sha256(bytes: Uint8Array) {
  const stable = bytes.slice().buffer as ArrayBuffer
  const hash = await crypto.subtle.digest('SHA-256', stable)
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function recogniseCanvas(canvas: HTMLCanvasElement, signal: AbortSignal, progress: (message: string) => void) {
  const check = () => { if (signal.aborted) throw new Error('Reading cancelled. Existing annual sources are unchanged.') }
  check()
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    workerPath: '/document-engine/worker.min.js',
    corePath: '/document-engine',
    langPath: '/document-engine',
    cacheMethod: 'none',
    workerBlobURL: false,
    logger: event => { if (!signal.aborted) progress(`Reading image: ${event.status}${event.progress ? ` ${Math.round(event.progress * 100)}%` : ''}`) },
  })
  const abort = () => { void worker.terminate() }
  signal.addEventListener('abort', abort, { once: true })
  try {
    const { data } = await worker.recognize(canvas)
    check()
    return data.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  } finally {
    signal.removeEventListener('abort', abort)
    await worker.terminate()
  }
}

async function imageLines(file: File, signal: AbortSignal, progress: (message: string) => void) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if ((!png || !/\.png$/i.test(file.name)) && (!jpeg || !/\.jpe?g$/i.test(file.name))) throw new Error('The image content does not match a supported PNG or JPG file.')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 12_000_000) throw new Error('Choose an image of no more than 12 megapixels.')
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(bitmap.width * scale)
    canvas.height = Math.ceil(bitmap.height * scale)
    const context = canvas.getContext('2d')!
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const lines = await recogniseCanvas(canvas, signal, progress)
    canvas.width = 0
    canvas.height = 0
    return lines
  } finally {
    bitmap.close()
  }
}

export async function readAnnualStatement(
  file: File,
  signal: AbortSignal,
  progress: (message: string) => void,
  sample = false,
): Promise<AnnualStatementCandidate> {
  validateAnnualStatementFile(file)
  const check = () => { if (signal.aborted) throw new Error('Reading cancelled. Existing annual sources are unchanged.') }
  const bytes = new Uint8Array(await file.arrayBuffer())
  check()
  const hash = await sha256(bytes)
  check()

  let lines: string[]
  if (/\.pdf$/i.test(file.name)) {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('The selected file is not a PDF.')
    GlobalWorkerOptions.workerSrc = '/document-engine/pdf.worker.min.mjs'
    const task = getDocument({
      data: bytes,
      useSystemFonts: true,
      standardFontDataUrl: '/document-engine/standard_fonts/',
      wasmUrl: '/document-engine/wasm/',
      cMapUrl: '/document-engine/cmaps/',
      cMapPacked: true,
      stopAtErrors: true,
    })
    const abort = () => { void task.destroy() }
    signal.addEventListener('abort', abort, { once: true })
    try {
      const pdf = await task.promise
      check()
      if (pdf.numPages !== 1) throw new Error('Use one single-page annual statement per PDF.')
      const page = await pdf.getPage(1)
      const content = await page.getTextContent()
      check()
      const tokens = content.items.flatMap(item => 'str' in item && item.str.trim()
        ? [{ text: item.str, x: item.transform[4], y: item.transform[5] } satisfies TextToken]
        : [])
      if (tokens.length) {
        progress('Reading annual statement text…')
        lines = textLines(tokens)
      } else {
        progress('No native text found. Reading the page image locally…')
        const original = page.getViewport({ scale: 1 })
        const scale = Math.min(2, 1800 / Math.max(original.width, original.height))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await page.render({ canvas, viewport }).promise
        lines = await recogniseCanvas(canvas, signal, progress)
        canvas.width = 0
      }
      page.cleanup()
    } finally {
      signal.removeEventListener('abort', abort)
      await task.destroy()
    }
  } else {
    lines = await imageLines(file, signal, progress)
  }

  check()
  return parseAnnualStatement(lines, hash, file.name, sample)
}
