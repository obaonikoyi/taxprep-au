import Papa from 'papaparse'
import { isoDate, pageLines, parseStatement, type PdfPage, type Statement } from './statementParser'
import { readStatementWithAssistance } from './assistedStatement'
export const MAX_STATEMENT_BYTES = 10_000_000
export function parseStatementCsv(text: string, id: string, name: string): Statement {
  const parsed=Papa.parse<string[]>(text.replace(/^\uFEFF/,''),{skipEmptyLines:'greedy'})
  if(parsed.errors.length || parsed.data[0]?.join(',')!=='Date,Description,Amount')throw new Error('CSV needs exactly Date,Description,Amount. Use YYYY-MM-DD or DD/MM/YYYY dates; negative amounts are debits.')
  const data=parsed.data.slice(1)
  if(!data.length||data.length>5000)throw new Error('CSV must contain 1–5,000 transactions.')
  const rows=data.map((row,index)=>{
    const [dateText,description,amount]=row
    const match=dateText?.match(/^(\d{4})-(\d{2})-(\d{2})$/),au=dateText?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    const date=match?isoDate(+match[3],+match[2]-1,+match[1]):au?isoDate(+au[1],+au[2]-1,+au[3]):null
    const money=amount?.trim().match(/^(-?)(\d{1,9})(?:\.(\d{1,2}))?$/)
    if(row.length!==3||!date||!description?.trim()||description.length>1000||!money)throw new Error(`CSV row ${index+2} has an invalid date, description or amount. Nothing was imported.`)
    const cents=(Number(money[2])*100+Number((money[3]??'').padEnd(2,'0')))*(money[1]? -1:1)
    return{id:`${id}:${index+1}`,date,description:description.trim(),cents,balanceCents:null,page:index+2,valueDate:null}
  })
  const dates=rows.map(r=>r.date).sort()
  return{id,name,format:'csv',from:dates[0],to:dates.at(-1)!,opening:null,closing:null,printedDebits:null,printedCredits:null,rows,notices:['CSV has no statement balances. Totals cannot be checked against a bank ledger.'],issues:[],pages:0,reconciled:false}
}
/*
 * `assist` decides what happens when the documented parser cannot read a PDF:
 * refuse, as this reader always has, or send the text it already extracted to
 * this app's own server to be transcribed. It is off unless the person asked
 * for it on this file, and it never changes how a layout we do understand is
 * read — the documented parser is always preferred, because it can be held to
 * its own arithmetic and a model can only be held to the statement's.
 */
export async function readStatement(file: File, signal: AbortSignal, progress:(text:string)=>void, assist = false):Promise<Statement> {
  if(!/\.(pdf|csv)$/i.test(file.name)||!file.size||file.size>MAX_STATEMENT_BYTES)throw new Error('Choose a PDF or CSV between 1 byte and 10 MB.')
  if(file.name.length>180)throw new Error('Shorten the file name to 180 characters or fewer.')
  const check=()=>{if(signal.aborted)throw new Error('Reading cancelled. Your previous statement is unchanged.')}
  check();const bytes=new Uint8Array(await file.arrayBuffer());check()
  const hash=await crypto.subtle.digest('SHA-256',bytes);check()
  const id=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')
  if(/\.csv$/i.test(file.name))return parseStatementCsv(new TextDecoder('utf-8',{fatal:true}).decode(bytes),id,file.name)
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('The selected file is not a valid PDF.')
  const pdfjs=await import('pdfjs-dist');check()
  pdfjs.GlobalWorkerOptions.workerSrc='/document-engine/pdf.worker.min.mjs'
  const task=pdfjs.getDocument({data:bytes,useSystemFonts:true,standardFontDataUrl:'/document-engine/standard_fonts/',wasmUrl:'/document-engine/wasm/',cMapUrl:'/document-engine/cmaps/',cMapPacked:true,stopAtErrors:true})
  const abort=()=>{void task.destroy()};signal.addEventListener('abort',abort,{once:true})
  try{
    const doc=await task.promise;check()
    if(doc.numPages>60)throw new Error('Use a PDF with no more than 60 pages.')
    const pages:PdfPage[]=[];let tokenCount=0
    for(let n=1;n<=doc.numPages;n++){
      check();progress(`Reading page ${n} of ${doc.numPages}…`)
      const page=await doc.getPage(n);const content=await page.getTextContent();check()
      const tokens=content.items.flatMap(item=>'str'in item&&item.str.trim()?[{text:item.str,x:item.transform[4],y:page.view![3]-item.transform[5],width:item.width}]:[])
      tokenCount+=tokens.length;if(tokenCount>200000)throw new Error('This PDF contains too much text for the local analyser.')
      pages.push({number:n,width:page.view![2],height:page.view![3],tokens});page.cleanup()
    }
    let result: Statement
    try {
      result=parseStatement(pages,id,file.name)
      if(result.issues.length)throw new Error(`Statement check failed. ${result.issues.slice(0,3).join(' ')} Use a bank CSV export if this layout differs. Nothing was imported.`)
    } catch (error) {
      if(!assist)throw error
      /*
       * The text of every page, laid out line by line as it appears. Not the
       * PDF, and not the columns the documented parser needs — a transcriber
       * reads a page the way a person does.
       */
      progress('This layout is not one we document. Asking the reader to transcribe it…')
      const text=pages.map(page=>`--- page ${page.number} ---\n${pageLines(page).map(line=>line.map(t=>t.text.trim()).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n')}`).join('\n')
      if(text.length>200_000)throw new Error('This statement contains too much text to be read. Use a shorter period, or a CSV export from your bank.')
      check()
      result=await readStatementWithAssistance(text,id,file.name,signal)
    }
    return result
  }finally{signal.removeEventListener('abort',abort);await task.destroy()}
}
