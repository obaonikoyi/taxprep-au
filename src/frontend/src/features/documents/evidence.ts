import Papa from 'papaparse'

export const YEAR = '2025–26'
export interface Facts { merchant: string; date: string; description: string; cents: number | null }
export interface Answers { purpose: string; reimbursed: '' | 'no' | 'yes' | 'unsure'; workUse: string; basis: string }
export interface Evidence {
  id: string; documentId: string; fileName: string; location: string; kind: 'bank' | 'receipt'
  original: Facts; facts: Facts; raw: string; credit: boolean; confirmed: boolean
  excluded: string; answers: Answers
}
export interface EvidenceLink { bank: string; receipt: string }
export const emptyAnswers = (): Answers => ({ purpose: '', reimbursed: '', workUse: '', basis: '' })
export const money = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export const inYear = (date: string) => validDate(date) && date >= '2025-07-01' && date <= '2026-06-30'
export function parseMoney(value: string): number | null {
  const input = value.trim().replace(/^(?:AUD\s*|\$)/i, '').trim()
  if (input.includes(',') && !/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(input)) return null
  const text = input.replace(/,/g, '')
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return cents > 0 && cents <= 100_000_000 ? cents : null
}
export function normaliseDate(value: string): string {
  const text = value.trim()
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : text
  return validDate(iso) ? iso : ''
}
// Conservative labelled extraction. Multiple distinct candidates remain unresolved.
// Document text is never executed, rendered as HTML, or sent to an instruction-following model.
export function extractFacts(text: string, confidence = 100): Facts {
  const blank: Facts = { merchant: '', date: '', description: '', cents: null }
  if (confidence < 60) return blank
  const lines = text.slice(0, 20000).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const unique = (values: string[]) => [...new Set(values)]
  const labels = (label: string) => unique(lines.flatMap(line => {
    const match = new RegExp(`^(?:${label})\\s*:\\s*(.{1,160})$`, 'i').exec(line)
    return match ? [match[1].trim()] : []
  }))
  const merchants = labels('merchant|supplier|sold by')
  const descriptions = labels('description|item|service')
  const dates = unique(lines.flatMap(line => [...line.matchAll(/\b(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/g)].map(match => normaliseDate(match[0]))).filter(Boolean))
  const totals = unique(lines.flatMap(line => {
    const match = /^(?:grand total|total(?: paid)?|amount paid)\s*:?\s*((?:AUD\s*|\$)?\s*[\d,.]+)\s*(?:AUD)?$/i.exec(line)
    return match && parseMoney(match[1]) !== null ? [String(parseMoney(match[1]))] : []
  }))
  return { merchant: merchants.length === 1 ? merchants[0] : '', description: descriptions.length === 1 ? descriptions[0] : '', date: dates.length === 1 ? dates[0] : '', cents: totals.length === 1 ? Number(totals[0]) : null }
}
export function makeEvidence(documentId: string, fileName: string, location: string, facts: Facts, kind: Evidence['kind'], raw: string, credit = false): Evidence {
  return { id: `${documentId}:${location}`, documentId, fileName, location, kind, original: { ...facts }, facts: { ...facts }, raw: raw.slice(0, 20000), credit, confirmed: false, excluded: '', answers: emptyAnswers() }
}
export function parseBankCsv(text: string, id: string, name: string): Evidence[] {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
  if (parsed.errors.length) throw new Error('CSV could not be read. Check quoting and comma-separated columns, then retry.')
  const [header, ...rows] = parsed.data
  if (!header || header.map(value => value.trim().toLowerCase()).join(',') !== 'date,description,amount') throw new Error('CSV needs exactly Date,Description,Amount columns. Use ISO or DD/MM/YYYY dates and negative spending amounts.')
  if (!rows.length || rows.length > 100) throw new Error('Use 1–100 CSV transactions in this document workspace.')
  return rows.map((row, index) => {
    const date = normaliseDate(row[0] ?? '')
    const signed = (row[2] ?? '').trim()
    const cents = parseMoney(signed.replace(/^-/, ''))
    if (row.length !== 3 || !date || !row[1]?.trim() || row[1].length > 160 || cents === null) throw new Error(`CSV row ${index + 2} needs a valid date, description (up to 160 characters), and non-zero amount. No rows were imported; correct the file and retry.`)
    return makeEvidence(id, name, `Row ${index + 2}`, { merchant: row[1].trim(), description: row[1].trim(), date, cents }, 'bank', row.join(' | '), !signed.startsWith('-'))
  })
}
const merchantKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
export function potentialMatch(a: Evidence, b: Evidence): boolean {
  return a.id !== b.id && !a.credit && !b.credit && !a.excluded && !b.excluded
    && a.facts.cents !== null && a.facts.cents === b.facts.cents && validDate(a.facts.date) && validDate(b.facts.date)
    && Math.abs(Date.parse(a.facts.date) - Date.parse(b.facts.date)) <= 7 * 86_400_000
    // Same-day equal amounts may be the same payment even with different bank wording.
    && (a.facts.date === b.facts.date || (merchantKey(a.facts.merchant).length > 2 && merchantKey(a.facts.merchant) === merchantKey(b.facts.merchant)))
}
export function validLink(link: EvidenceLink, records: Evidence[]) {
  const bank = records.find(item => item.id === link.bank)
  const receipt = records.find(item => item.id === link.receipt)
  return !!bank && !!receipt && bank.kind === 'bank' && receipt.kind === 'receipt' && bank.confirmed && receipt.confirmed && potentialMatch(bank, receipt) && inYear(receipt.facts.date) && bank.facts.date === receipt.facts.date && merchantKey(bank.facts.merchant).length > 2 && merchantKey(bank.facts.merchant) === merchantKey(receipt.facts.merchant)
}
export const pairKey = (a: string, b: string) => [a, b].sort().join('|')
export function reconcile(records: Evidence[], links: EvidenceLink[], separate: string[]) {
  const validLinks = links.filter(link => validLink(link, records))
  const bankIds = new Set(validLinks.map(link => link.bank))
  const groups = records.filter(item => !bankIds.has(item.id)).map(item => {
    const link = validLinks.find(link => link.receipt === item.id)
    const evidence = link ? [item, records.find(record => record.id === link.bank)!] : [item]
    return { item, evidence }
  })
  const conflicts = groups.flatMap((group, i) => groups.slice(i + 1).filter(other => potentialMatch(group.item, other.item) && !separate.includes(pairKey(group.item.id, other.item.id))).map(other => [group.item.id, other.item.id] as const))
  const blocked = new Set(conflicts.flat())
  return {
    groups: groups.map(group => ({ ...group, unresolved: questions(group.item, group.evidence, blocked.has(group.item.id)), counted: group.item.confirmed && !group.item.excluded && !group.item.credit && inYear(group.item.facts.date) && group.item.facts.cents !== null && !blocked.has(group.item.id) })),
    conflicts,
  }
}
export function questions(item: Evidence, evidence: Evidence[], conflict: boolean): string[] {
  if (item.excluded) return [`Excluded: ${item.excluded}`]
  const result: string[] = []
  if (!item.confirmed) result.push('Check and confirm extracted facts against the source.')
  if (!inYear(item.facts.date)) result.push('Date is missing or outside 2025–26; excluded from the reviewed spending total.')
  if (item.credit) result.push('Credit or possible refund: establish its purpose and relationship to spending. Not automatically offset.')
  if (conflict) result.push('Possible duplicate or matching evidence: resolve before this spending is counted.')
  if (!evidence.some(source => source.kind === 'receipt')) result.push('Receipt or itemised evidence is missing.')
  if (item.answers.reimbursed === 'yes') result.push('Record the reimbursed amount before assessing any work-related claim; gross spending is unchanged here.')
  if (!item.answers.purpose.trim()) result.push('Explain the work purpose.')
  if (!item.answers.reimbursed || item.answers.reimbursed === 'unsure') result.push('Confirm whether the employer reimbursed any of this cost.')
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(item.answers.workUse) || Number(item.answers.workUse) > 100) result.push('Record a work-use percentage from 0 to 100.')
  if (!item.answers.basis.trim()) result.push('Describe the records supporting the work-use percentage.')
  return result
}
export function factError(facts: Facts): string | null {
  if (!facts.merchant.trim() || !facts.description.trim()) return 'Enter a merchant and description.'
  if (facts.merchant.length > 160 || facts.description.length > 160) return 'Keep merchant and description to 160 characters.'
  if (!validDate(facts.date)) return 'Enter a valid date.'
  if (facts.cents === null || !Number.isSafeInteger(facts.cents) || facts.cents <= 0 || facts.cents > 100_000_000) return 'Enter an amount greater than zero and no more than $1,000,000.'
  return null
}
