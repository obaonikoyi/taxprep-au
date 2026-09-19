// Deliberately supports native-text CommBank Date/Transaction/Debit/Credit/Balance tables.
// No identity/header text is retained in the returned model.
export interface PdfToken { text: string; x: number; y: number; width: number }
export interface PdfPage { number: number; width: number; height: number; tokens: PdfToken[] }
export interface StatementRow { id: string; date: string; description: string; cents: number; balanceCents: number | null; page: number; valueDate: string | null }
export interface Statement {
  id: string; name: string; format: 'commbank-text' | 'csv'; from: string; to: string
  opening: number | null; closing: number | null; printedDebits: number | null; printedCredits: number | null
  rows: StatementRow[]; notices: string[]; issues: string[]; pages: number; reconciled: boolean
}
export const STATEMENT_VERSION = 'statement-analysis.v1'
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function statementMoney(text: string): number | null {
  if (/^Nil$/i.test(text.trim())) return 0
  const match = text.trim().match(/^\$?((?:\d{1,3}(?:,\d{3})+|\d{1,9}))\.(\d{2})(?:\s*(CR|DR))?$/i)
  if (!match) return null
  const cents = Number(match[1].replaceAll(',', '')) * 100 + Number(match[2])
  return cents <= 100_000_000_000 ? cents * (match[3]?.toUpperCase() === 'DR' ? -1 : 1) : null
}
export function isoDate(day: number, month: number, year: number): string | null {
  const date = new Date(Date.UTC(year, month, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? date.toISOString().slice(0,10) : null
}
export function pageLines(page: PdfPage): PdfToken[][] {
  const result: PdfToken[][] = []
  for (const token of [...page.tokens].sort((a,b) => a.y-b.y || a.x-b.x)) {
    const previous = result.at(-1)
    if (previous && Math.abs(previous[0].y-token.y) < 2) previous.push(token)
    else result.push([token])
  }
  return result.map(line=>line.sort((a,b)=>a.x-b.x))
}
const lineText = (line: PdfToken[]) => line.map(t=>t.text.trim()).join(' ').replace(/\s+/g,' ').trim()
export function parseStatement(pages: PdfPage[], id: string, name: string): Statement {
  if (!pages.length || pages.length > 60) throw new Error('Use a native-text statement with 1–60 pages.')
  const lines = pages.map(pageLines)
  const allText = lines.flat().map(lineText).join('\n')
  const period = allText.match(/\bPeriod\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})\s*[-–]\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})/)
  if (!period) throw new Error('Statement period not found. Use a supported CommBank PDF with selectable text, or CSV.')
  const from = isoDate(+period[1],months.indexOf(period[2]),+period[3]), to = isoDate(+period[4],months.indexOf(period[5]),+period[6])
  if (!from || !to || from > to || Date.parse(to)-Date.parse(from) > 366*86400000) throw new Error('The statement period is invalid or longer than one year.')
  const result: Statement = { id, name, format:'commbank-text', from, to, opening:null, closing:null, printedDebits:null, printedCredits:null, rows:[], notices:[], issues:[], pages:pages.length, reconciled:false }
  let current: { date:string; page:number; description:string[]; debit:number[]; credit:number[]; balance:number[] } | null = null
  let closed = false, opened = false, summaryFound = false, tables = 0
  const flush = () => {
    if (!current) return
    const row = current; current = null
    const description = row.description.join(' ').replace(/\s+/g,' ').trim()
    if (!row.debit.length && !row.credit.length && !row.balance.length && /^DEBIT INTEREST CHARGED on this account\b/i.test(description)) {
      result.notices.push(`Page ${row.page}: informational interest notice, not a posted transaction.`); return
    }
    if (row.debit.length + row.credit.length !== 1 || row.balance.length !== 1 || !description) {
      result.issues.push(`Page ${row.page}, ${row.date}: a transaction has missing or ambiguous amounts, balance or description.`); return
    }
    const magnitude = row.debit[0] ?? row.credit[0]
    if (magnitude < 0) { result.issues.push(`Page ${row.page}: signed debit/credit column needs review.`); return }
    const vd = description.match(/Value\s*Date\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i)
    result.rows.push({id:`${id}:${result.rows.length+1}`,date:row.date,description,cents:row.debit.length ? -magnitude : magnitude,balanceCents:row.balance[0],page:row.page,valueDate:vd ? isoDate(+vd[1],+vd[2]-1,+vd[3]) : null})
  }
  for (const [pageIndex, page] of pages.entries()) {
    let header: { date:number; transaction:number; debit:number; credit:number; balance:number } | null = null
    let summaryNext = false
    for (const rawLine of lines[pageIndex]) {
      const line = rawLine.filter(t=>t.x >= (header?.date ?? 60)-20)
      if (!line.length) continue
      const text = lineText(line)
      if (/Opening balance\s*-?\s*Total debits\s+Total credits\s*=?\s*Closing balance/i.test(text)) { flush(); header=null; summaryNext=true; continue }
      if (summaryNext) {
        const amounts = text.match(/Nil|\$?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}(?:\s*(?:CR|DR))?/gi)?.map(statementMoney)
        if (amounts?.length !== 4 || amounts.some(a=>a===null)) result.issues.push('The printed statement totals could not be read.')
        else {
          if (summaryFound) result.issues.push('More than one totals summary found; combined statements are unsupported.')
          summaryFound=true; result.printedDebits=amounts[1];result.printedCredits=amounts[2]
          if (result.opening!==amounts[0] || result.closing!==amounts[3]) result.issues.push('Printed opening/closing totals disagree with the ledger.')
        }
        summaryNext=false;continue
      }
      if (/^Date Transaction Debit Credit Balance$/.test(text)) {
        const field = (name:string) => line.find(t=>t.text.trim()===name)
        const names=['Date','Transaction','Debit','Credit','Balance'];if(names.some(n=>!field(n))) throw new Error('Unsupported statement column layout.')
        header={date:field('Date')!.x,transaction:field('Transaction')!.x,debit:field('Debit')!.x+field('Debit')!.width,credit:field('Credit')!.x+field('Credit')!.width,balance:field('Balance')!.x+field('Balance')!.width};tables++;continue
      }
      if (!header || closed || line[0].y > page.height-35) continue
      const dated = text.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(20\d{2}))?\b/)
      const cells: {debit:number[];credit:number[];balance:number[]}={debit:[],credit:[],balance:[]}
      const moneyTokens = new Set<PdfToken>()
      for (const token of line) {
        const value=statementMoney(token.text)
        if(value===null)continue
        const end=token.x+token.width
        const candidates=(['debit','credit','balance'] as const).filter(k=>Math.abs(end-header![k])<22)
        if(candidates.length===1){cells[candidates[0]].push(value);moneyTokens.add(token)}
      }
      if (dated) {
        flush()
        const month=months.indexOf(dated[2]);const years=[+from.slice(0,4),+to.slice(0,4)].filter((y,i,a)=>a.indexOf(y)===i)
        const possible = (dated[3] ? [+dated[3]] : years).map(y=>isoDate(+dated[1],month,y)).filter((d):d is string=>!!d&&d>=from&&d<=to)
        if(possible.length!==1){result.issues.push(`Page ${page.number}: transaction date is ambiguous or outside the statement period.`);continue}
        if (/OPENING BALANCE/.test(text)) { if(opened)result.issues.push('Repeated opening balance.');opened=true;result.opening=cells.balance.length===1?cells.balance[0]:null;continue }
        if (/CLOSING BALANCE/.test(text)) {closed=true;result.closing=cells.balance.length===1?cells.balance[0]:null;continue}
        current={date:possible[0],page:page.number,description:[],debit:[],credit:[],balance:[]}
      }
      if(current) {
        let description=line.filter(t=>!moneyTokens.has(t)).map(t=>t.text).join(' ').trim()
        if(dated)description=description.slice(dated[0].length).trim()
        if(description)current.description.push(description)
        current.debit.push(...cells.debit);current.credit.push(...cells.credit);current.balance.push(...cells.balance)
      }
    }
  }
  flush()
  if(!tables)throw new Error('No supported transaction table found. Scans and other PDF layouts are not supported yet.')
  if(!opened||!closed||!summaryFound||result.opening===null||result.closing===null)result.issues.push('Opening balance, closing balance or printed totals are missing.')
  if(result.rows.length>5000)throw new Error('Use a statement with no more than 5,000 transactions.')
  let running=result.opening
  for(const row of result.rows){if(running!==null){running+=row.cents;if(running!==row.balanceCents)result.issues.push(`Page ${row.page}, ${row.date}: running balance does not match.`)}}
  const debits=result.rows.reduce((s,r)=>s+Math.max(0,-r.cents),0),credits=result.rows.reduce((s,r)=>s+Math.max(0,r.cents),0)
  if(debits!==result.printedDebits||credits!==result.printedCredits)result.issues.push('Extracted debits/credits do not match the printed totals.')
  if(running!==result.closing)result.issues.push('Opening balance plus all transactions does not equal the closing balance.')
  result.issues=[...new Set(result.issues)];result.reconciled=result.issues.length===0
  return result
}
