import { extractFacts, makeEvidence, parseBankCsv, type Evidence } from './evidence'

export const MAX_FILES = 6
export const MAX_BYTES = 2_000_000
export interface DocumentSource { id: string; name: string; file: File; previews: string[]; milliseconds: number; pages: number }
export interface ReadResult { source: DocumentSource; records: Evidence[] }
export function validateDocument(file: File) {
  if (!/\.(csv|png|jpe?g|pdf)$/i.test(file.name)) throw new Error('Choose CSV, PNG, JPG or PDF files.')
  if (file.size === 0 || file.size > MAX_BYTES) throw new Error('Each file must contain data and be no larger than 2 MB.')
  if (file.name.length > 180) throw new Error('Shorten the file name to 180 characters or fewer.')
}
export async function fingerprint(file: File) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function readDocument(file: File, id: string, signal: AbortSignal, progress: (message: string) => void): Promise<ReadResult> {
  validateDocument(file)
  const started = performance.now()
  const previews: string[] = []
  const records: Evidence[] = []
  let worker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | undefined
  let loadingTask: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined
  let closed = false
  const abort = () => { closed = true; void worker?.terminate(); void loadingTask?.destroy() }
  signal.addEventListener('abort', abort, { once: true })
  const check = () => { if (signal.aborted || closed) throw new Error('Processing cancelled. You can retry the file.') }
  async function recognise(canvas: HTMLCanvasElement, page: number) {
    check()
    progress(`Reading page ${page}…`)
    if (!worker) {
      const { createWorker } = await import('tesseract.js')
      check()
      worker = await createWorker('eng', 1, {
        workerPath: '/document-engine/worker.min.js', corePath: '/document-engine', langPath: '/document-engine',
        cacheMethod: 'none', workerBlobURL: false,
        logger: event => { if (!closed && !signal.aborted) progress(`Page ${page}: ${event.status}${event.progress ? ` ${Math.round(event.progress * 100)}%` : ''}`) },
      })
      if (closed || signal.aborted) { await worker.terminate(); check() }
    }
    const { data } = await worker.recognize(canvas)
    check()
    previews.push(canvas.toDataURL('image/jpeg', 0.85))
    records.push(makeEvidence(id, file.name, `Page ${page}`, extractFacts(data.text, data.confidence), 'receipt', data.text))
  }
  // Cancellation also rejects work waiting on a failed/stalled engine download.
  let abortListener: (() => void) | undefined
  const cancelled = new Promise<never>((_, reject) => {
    abortListener = () => reject(new Error('Processing cancelled. You can retry the file.'))
    signal.addEventListener('abort', abortListener, { once: true })
  })
  const work = async () => {
    check()
    const bytes = new Uint8Array(await file.arrayBuffer())
    check()
    if (/\.csv$/i.test(file.name)) {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
      records.push(...parseBankCsv(text, id, file.name))
    } else if (/\.pdf$/i.test(file.name)) {
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('This file does not have a valid PDF signature.')
      const pdfjs = await import('pdfjs-dist')
      check()
      pdfjs.GlobalWorkerOptions.workerSrc = '/document-engine/pdf.worker.min.mjs'
      loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true, standardFontDataUrl: '/document-engine/standard_fonts/', wasmUrl: '/document-engine/wasm/', cMapUrl: '/document-engine/cmaps/', cMapPacked: true, iccUrl: '/document-engine/iccs/', stopAtErrors: true, maxImageSize: 12_000_000 })
      const pdf = await loadingTask.promise
      if (pdf.numPages > 3) throw new Error('Use a PDF with no more than 3 pages.')
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        check()
        const page = await pdf.getPage(pageNumber)
        const original = page.getViewport({ scale: 1 })
        const scale = Math.min(2, 1800 / Math.max(original.width, original.height))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
        await page.render({ canvas, viewport }).promise
        await recognise(canvas, pageNumber)
        canvas.width = 0; canvas.height = 0; page.cleanup()
      }
    } else {
      const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      if ((!png || !/\.png$/i.test(file.name)) && (!jpeg || !/\.jpe?g$/i.test(file.name))) throw new Error('The image content does not match a supported PNG or JPG file.')
      const bitmap = await createImageBitmap(file)
      try {
        if (bitmap.width * bitmap.height > 12_000_000) throw new Error('Choose an image of no more than 12 megapixels.')
        const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(bitmap.width * scale); canvas.height = Math.ceil(bitmap.height * scale)
        const context = canvas.getContext('2d')!
        context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        await recognise(canvas, 1)
        canvas.width = 0; canvas.height = 0
      } finally { bitmap.close() }
    }
    check()
    return { source: { id, name: file.name, file, previews, milliseconds: Math.round(performance.now() - started), pages: previews.length }, records }
  }
  try { return await Promise.race([work(), cancelled]) }
  finally {
    closed = true
    signal.removeEventListener('abort', abort)
    if (abortListener) signal.removeEventListener('abort', abortListener)
    await worker?.terminate(); await loadingTask?.destroy()
  }
}
