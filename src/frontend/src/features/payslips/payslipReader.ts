import { blankFacts, dateValue, labels, fields, PAYSLIP_VERSION, type Payslip } from './payslip'
export type TextToken = { text: string; x: number; y: number }
export function textLines(tokens: TextToken[]): string[] {
  const rows: { y: number; tokens: TextToken[] }[] = []
  for (const token of [...tokens].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find(r => Math.abs(r.y - token.y) < 2)
    if (row) row.tokens.push(token); else rows.push({ y: token.y, tokens: [token] })
  }
  return rows.map(r => r.tokens.sort((a, b) => a.x - b.x).map(t => t.text).join(' ').trim()).filter(Boolean)
}
export function parsePayslip(lines: string[], hash: string, name: string, sample = false): Payslip {
  if (!lines.some(s => s === 'PAYSLIP SUMMARY v1')) throw new Error('This PDF layout is not supported yet. Use the labelled summary example or enter the figures manually.')
  if (lines.join('\n').length > 20_000) throw new Error('This payslip contains too much text.')
  const facts = blankFacts()
  for (const key of fields) {
    const prefix = labels[key] + ':'
    const values = lines.filter(s => s.startsWith(prefix)).map(s => s.slice(prefix.length).trim())
    if (values.length > 1) throw new Error(`More than one ${labels[key].toLowerCase()} value was found. Use one payslip per file.`)
    facts[key] = values[0] ?? ''
    if (facts[key].length > 120) throw new Error(`The ${labels[key].toLowerCase()} field is too long.`)
    if (key === 'periodStart' || key === 'periodEnd' || key === 'payDate') facts[key] = dateValue(facts[key]) ?? facts[key]
  }
  // Exact field labels select current-period values; cumulative YTD fields never enter totals.
  return { id: hash, hash, name, text: lines.join('\n'), facts, original: { ...facts }, confirmed: false, sample }
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
    const tokens = content.items.flatMap(i => 'str' in i && i.str.trim() ? [{ text: i.str, x: i.transform[4], y: i.transform[5] }] : [])
    const result = parsePayslip(textLines(tokens), hash, file.name, sample)
    page.cleanup(); return result
  } finally { signal.removeEventListener('abort', abort); await task.destroy() }
}
export { PAYSLIP_VERSION }
