import type { TextRow, TextToken } from './payslipFormats'

/*
 * Reading a payslip that is a picture.
 *
 * Until now a payslip had to be a PDF whose own text could be extracted. Most
 * people do not have one of those. They have a photo on their phone, or a scan
 * their employer emailed, and the app's answer to both was to type twelve
 * figures by hand — which is the answer that makes people not come back.
 *
 * Nothing new leaves the device. The recogniser is the same one this app
 * already runs for receipts and annual statements: WebAssembly served from this
 * origin, under the same Content-Security-Policy, working on a canvas in the
 * browser. The picture is never uploaded, and no part of this file talks to a
 * network.
 *
 * What comes back is words with positions, not a wall of text. The documented
 * parsers read a payslip by its columns — which figure sits under "This pay"
 * and which under "Year to date" — so throwing the positions away would mean
 * throwing away the one rule that stops a year-to-date figure being read as a
 * fortnight's pay.
 */
export const MAX_PICTURE_BYTES = 5_000_000
export const MAX_PIXELS = 12_000_000
/** Bigger than this is slower without reading any better. */
const LONGEST_EDGE = 1800

export const isPicture = (name: string) => /\.(png|jpe?g)$/i.test(name)

/** Draw a photo onto a canvas the recogniser can work from. */
export async function pictureCanvas(file: File, bytes: Uint8Array): Promise<HTMLCanvasElement> {
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if ((!png || !/\.png$/i.test(file.name)) && (!jpeg || !/\.jpe?g$/i.test(file.name)))
    throw new Error('The image content does not match a supported PNG or JPG file.')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error('Choose an image of no more than 12 megapixels.')
    const scale = Math.min(1, LONGEST_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(bitmap.width * scale)
    canvas.height = Math.ceil(bitmap.height * scale)
    const context = canvas.getContext('2d')!
    // A photo with transparency would otherwise recognise as black on black.
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally { bitmap.close() }
}

/*
 * The recogniser groups words into lines itself, and those groupings are used
 * rather than re-derived. The app's own row grouping treats anything within two
 * units of the same height as one line, which is right for a PDF measured in
 * points and wrong for a photo measured in pixels, where a line of print can
 * wander by ten.
 *
 * Coordinates are flipped to measure upwards from the bottom of the page,
 * because that is what a PDF does and what every parser here already expects.
 */
export function rowsFromBlocks(blocks: unknown, height: number): TextRow[] {
  const rows: TextRow[] = []
  for (const block of asArray(blocks)) {
    for (const paragraph of asArray(read(block, 'paragraphs'))) {
      for (const line of asArray(read(paragraph, 'lines'))) {
        const tokens: TextToken[] = []
        for (const word of asArray(read(line, 'words'))) {
          const text = typeof read(word, 'text') === 'string' ? (read(word, 'text') as string).trim() : ''
          const box = read(word, 'bbox')
          const x0 = number(read(box, 'x0')), x1 = number(read(box, 'x1')), y1 = number(read(box, 'y1'))
          if (!text || x0 === null || x1 === null || y1 === null) continue
          tokens.push({ text, x: x0, y: height - y1, width: Math.max(0, x1 - x0) })
        }
        const text = tokens.map(t => t.text).join(' ').trim()
        if (text) rows.push({ text, tokens })
      }
    }
  }
  return rows
}

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const read = (value: unknown, key: string): unknown =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null

/**
 * Recognise a canvas into positioned rows. The recogniser is loaded only when a
 * picture is actually read, because it is the largest thing this app can fetch.
 */
export async function recogniseRows(canvas: HTMLCanvasElement, signal: AbortSignal, progress: (message: string) => void): Promise<TextRow[]> {
  const check = () => { if (signal.aborted) throw new Error('Reading cancelled. Existing payslips are unchanged.') }
  check()
  const { createWorker } = await import('tesseract.js')
  check()
  const worker = await createWorker('eng', 1, {
    workerPath: '/document-engine/worker.min.js',
    corePath: '/document-engine',
    langPath: '/document-engine',
    cacheMethod: 'none',
    workerBlobURL: false,
    logger: event => { if (!signal.aborted) progress(`Reading the picture: ${event.status}${event.progress ? ` ${Math.round(event.progress * 100)}%` : ''}`) },
  })
  const abort = () => { void worker.terminate() }
  signal.addEventListener('abort', abort, { once: true })
  try {
    // blocks: true is what carries the word positions. Without it the answer is
    // one string and every column in the payslip is lost.
    const { data } = await worker.recognize(canvas, {}, { blocks: true })
    check()
    return rowsFromBlocks(data.blocks, canvas.height)
  } finally {
    signal.removeEventListener('abort', abort)
    await worker.terminate()
  }
}
