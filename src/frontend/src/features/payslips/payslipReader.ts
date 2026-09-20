import { PAYSLIP_VERSION, type Payslip } from './payslip'
import { detectFormat, FORMATS, type TextRow, type TextToken } from './payslipFormats'
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

export function parsePayslip(lines: string[], hash: string, name: string, sample = false, rows?: TextRow[]): Payslip {
  const format = detectFormat(lines)
  if (!format) throw unsupported()
  if (lines.join('\n').length > 20_000) throw new Error('This payslip contains too much text.')
  // Every format reads current-period values only; cumulative YTD figures are
  // never extracted, so they can never be summed across payslips.
  const facts = format.parse({ lines, rows: rows ?? lines.map(text => ({ text, tokens: [] })) })
  return { id: hash, hash, name, text: lines.join('\n'), facts, original: { ...facts }, confirmed: false, sample, format: format.id }
}
export async function readPayslip(file: File, signal: AbortSignal, sample = false): Promise<Payslip> {
  if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 2_000_000 || file.name.length > 180) throw new Error('Choose a PDF of 1 byte–2 MB with a file name of at most 180 characters.')
  const check = () => { if (signal.aborted) throw new Error('Reading cancelled. Existing payslips are unchanged.') }
  check(); const bytes = new Uint8Array(await file.arrayBuffer()); check()
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('The selected file is not a PDF.')
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); check()
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
    const rows = textRows(tokens)
    const result = parsePayslip(rows.map(r => r.text), hash, file.name, sample, rows)
    page.cleanup(); return result
  } finally { signal.removeEventListener('abort', abort); await task.destroy() }
}
export { PAYSLIP_VERSION }
