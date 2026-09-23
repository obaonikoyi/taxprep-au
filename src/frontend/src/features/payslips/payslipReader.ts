import { PAYSLIP_VERSION, type Payslip } from './payslip'
import { ASSISTED_FORMAT, readWithAssistance } from './assistedReader'
import { detectFormat, FORMATS, type TextRow, type TextToken } from './payslipFormats'
import { isPicture, MAX_PICTURE_BYTES, pictureCanvas, recogniseRows } from './payslipPicture'
export type { TextRow, TextToken } from './payslipFormats'

/** Group tokens into visual rows, keeping each row's tokens for column work. */
export function textRows(tokens: TextToken[]): TextRow[] {
  const rows: { y: number; tokens: TextToken[] }[] = []
  for (const token of [...tokens].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find(r => Math.abs(r.y - token.y) < 2)
    if (row) row.tokens.push(token); else rows.push({ y: token.y, tokens: [token] })
  }
  return rows
    .map(r => { const tokens = r.tokens.sort((a, b) => a.x - b.x); return { text: tokens.map(t => t.text).join(' ').trim(), tokens } })
    .filter(r => r.text)
}
export function textLines(tokens: TextToken[]): string[] {
  return textRows(tokens).map(r => r.text)
}

const unsupported = () => new Error(`This PDF layout is not supported yet. The reader currently understands ${FORMATS.map(f => f.marker).join(' and ')}. Enter the figures manually for any other layout.`)

export function parsePayslip(lines: string[], hash: string, name: string, sample = false, rows?: TextRow[], recognised = false): Payslip {
  const format = detectFormat(lines, recognised)
  if (!format) throw unsupported()
  if (lines.join('\n').length > 20_000) throw new Error('This payslip contains too much text.')
  // Every format reads current-period values only; cumulative YTD figures are
  // never extracted, so they can never be summed across payslips.
  const facts = format.parse({ lines, rows: rows ?? lines.map(text => ({ text, tokens: [] })) })
  return { id: hash, hash, name, text: lines.join('\n'), facts, original: { ...facts }, confirmed: false, sample, format: format.id }
}
/*
 * `assist` decides what happens when no documented layout matches: throw, as
 * this reader always has, or send the extracted text to the app's own server to
 * be read. It is off unless the person asked for it, and it never changes how a
 * layout we do understand is read — a documented parser is always preferred,
 * because it can be held to its arithmetic and a model cannot.
 */
/*
 * `progress` reports what is happening to a file that takes a while. Reading a
 * picture is seconds of work, not milliseconds, and a screen that says nothing
 * for ten seconds reads as a screen that has crashed.
 */
export async function readPayslip(file: File, signal: AbortSignal, sample = false, assist = false, progress: (message: string) => void = () => {}): Promise<Payslip> {
  const picture = isPicture(file.name)
  const limit = picture ? MAX_PICTURE_BYTES : 2_000_000
  if ((!picture && !/\.pdf$/i.test(file.name)) || !file.size || file.size > limit || file.name.length > 180)
    throw new Error(`Choose a PDF of 1 byte–2 MB, or a PNG or JPG of up to 5 MB, with a file name of at most 180 characters.`)
  const check = () => { if (signal.aborted) throw new Error('Reading cancelled. Existing payslips are unchanged.') }
  check(); const bytes = new Uint8Array(await file.arrayBuffer()); check()
  const hashOf = async () => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')

  /*
   * A picture never has a text layer to try first, so it goes straight to the
   * recogniser and then through exactly the same parsers, confirm screen and
   * checks as a PDF. Nothing about what happens after this point differs.
   */
  if (picture) {
    const hash = await hashOf(); check()
    const canvas = await pictureCanvas(file, bytes); check()
    try {
      const rows = await recogniseRows(canvas, signal, progress)
      return await fromRows(rows, hash, file.name, sample, assist, signal, true)
    } finally { canvas.width = 0; canvas.height = 0 }
  }

  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('The selected file is not a PDF.')
  const hash = await hashOf(); check()
  const pdfjs = await import('pdfjs-dist'); check()
  pdfjs.GlobalWorkerOptions.workerSrc = '/document-engine/pdf.worker.min.mjs'
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true, standardFontDataUrl: '/document-engine/standard_fonts/', wasmUrl: '/document-engine/wasm/', cMapUrl: '/document-engine/cmaps/', cMapPacked: true, stopAtErrors: true })
  const abort = () => { void task.destroy() }
  signal.addEventListener('abort', abort, { once: true })
  try {
    const pdf = await task.promise; check()
    if (pdf.numPages !== 1) throw new Error('Use one single-page payslip per PDF. Combined files are not supported yet.')
    const page = await pdf.getPage(1), content = await page.getTextContent(); check()
    if (content.items.length > 4000) throw new Error('This payslip contains too much text.')
    // Width matters: amounts in a table are right-aligned, so a token's centre
    // identifies its column far more reliably than its left edge.
    const tokens = content.items.flatMap(i => 'str' in i && i.str.trim() ? [{ text: i.str, x: i.transform[4], y: i.transform[5], width: i.width }] : [])
    /*
     * A scan is a PDF with no text of its own: the page is a picture of a
     * payslip. Rendering it and recognising it is the same work a photo needs,
     * so it takes the same path rather than being refused.
     */
    if (!tokens.length) {
      progress('This PDF has no text of its own. Reading the page as a picture…')
      const original = page.getViewport({ scale: 1 })
      const scale = Math.min(2, 1800 / Math.max(original.width, original.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, viewport }).promise; check()
      try {
        const rows = await recogniseRows(canvas, signal, progress)
        const result = await fromRows(rows, hash, file.name, sample, assist, signal, true)
        page.cleanup(); return result
      } finally { canvas.width = 0; canvas.height = 0 }
    }
    const result = await fromRows(textRows(tokens), hash, file.name, sample, assist, signal, false)
    page.cleanup(); return result
  } finally { signal.removeEventListener('abort', abort); await task.destroy() }
}

/*
 * From rows of positioned words to a payslip, whether those rows came from a
 * PDF's own text or from a picture. A documented layout is always preferred;
 * only when none matches, and only when the person asked for it, is the text
 * sent to be read.
 */
async function fromRows(rows: TextRow[], hash: string, name: string, sample: boolean, assist: boolean, signal: AbortSignal, fromPicture: boolean): Promise<Payslip> {
  const lines = rows.map(r => r.text)
  if (!lines.length) throw new Error(fromPicture
    ? 'No text could be read from this picture. Try a sharper, straighter photo of the whole payslip, or enter the figures yourself.'
    : 'No text could be read from this PDF.')
  try {
    return { ...parsePayslip(lines, hash, name, sample, rows, fromPicture), fromPicture }
  } catch (error) {
    if (!assist || !(error instanceof Error) || !error.message.startsWith('This PDF layout is not supported')) throw error
    const text = lines.join('\n')
    if (text.length > 20_000) throw new Error('This payslip contains too much text.')
    const facts = await readWithAssistance(text, signal)
    return { id: hash, hash, name, text, facts, original: { ...facts }, confirmed: false, sample, format: ASSISTED_FORMAT, fromPicture }
  }
}
export { PAYSLIP_VERSION }
