import {beforeAll,describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs'
import {parseStatement,statementMoney,isoDate,type PdfPage} from './statementParser'
import {parseStatementCsv} from './statementReader'
import {analyse,reviewFor,suggestion} from './statementAnalysis'
import {statementReport} from './statementReport'
let pages:PdfPage[],empty:PdfPage[],mismatch:PdfPage[]
async function fixture(name:string):Promise<PdfPage[]>{
 const input=JSON.parse(readFileSync(new URL(`../../../../../sample-data/statements/${name}.json`,import.meta.url),'utf8'))
 const task=getDocument({data:new Uint8Array(Buffer.from(input.pdfBase64,'base64')),useSystemFonts:true})
 try{const doc=await task.promise;const result:PdfPage[]=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),content=await p.getTextContent();result.push({number:n,width:p.view![2],height:p.view![3],tokens:content.items.flatMap(i=>'str'in i&&i.str.trim()?[{text:i.str,x:i.transform[4],y:p.view![3]-i.transform[5],width:i.width}]:[])})}return result}finally{await task.destroy()}
}
beforeAll(async()=>{[pages,empty,mismatch]=await Promise.all([fixture('example'),fixture('empty'),fixture('mismatch')])})
const sample=()=>parseStatement(pages,'sample','example.pdf')
describe('native-text statement extraction',()=>{
 it('reads actual multi-page PDF text with split descriptions and reconciles every balance',()=>{const s=sample();expect(s).toMatchObject({from:'2025-07-01',to:'2025-09-30',opening:125000,closing:888225,printedDebits:501675,printedCredits:1264900,reconciled:true,issues:[]});expect(s.rows).toHaveLength(33);expect(s.rows.filter(r=>r.valueDate)).toHaveLength(3);expect(s.rows[14].description).toContain('Payment for the month')})
 it('keeps an empty statement distinct from a failed extraction',()=>{expect(parseStatement(empty,'empty','empty.pdf')).toMatchObject({rows:[],opening:0,closing:0,printedDebits:0,printedCredits:0,reconciled:true})})
 it('rejects inconsistent printed totals and missing transactions',()=>{expect(parseStatement(mismatch,'bad','bad.pdf').reconciled).toBe(false);const changed=structuredClone(pages);changed[0].tokens=changed[0].tokens.filter(t=>t.text!=='4200.00'&&t.text!=='4,200.00');expect(parseStatement(changed,'bad','bad.pdf').reconciled).toBe(false)})
 it('ignores left-margin printer marks without losing dated entries',()=>{const changed=structuredClone(pages);const row=changed[0].tokens.find(t=>t.text.startsWith('03 Jul'))!;changed[0].tokens.push({text:'printer mark',x:20,y:row.y,width:200});expect(parseStatement(changed,'margin','margin.pdf').reconciled).toBe(true)})
 it('does not accept a scan, missing period, or excessive page count',()=>{expect(()=>parseStatement([{number:1,width:595,height:842,tokens:[]}],'s','scan.pdf')).toThrow('period');expect(()=>parseStatement(Array.from({length:61},()=>pages[0]),'s','big.pdf')).toThrow('60 pages')})
 it('retains posting dates separately from earlier value dates',()=>{const row=sample().rows.find(r=>r.valueDate)!;expect(row.date).toBe('2025-07-06');expect(row.valueDate).toBe('2025-07-01')})
 it.each([['1,234.56 CR',123456],['14.50 DR',-1450],['0.00',0],['Nil',0],['12,34.00',null],['1.001',null],['',null]] as const)('parses money %s strictly', (s,n)=>expect(statementMoney(s)).toBe(n))
 it('checks calendar dates',()=>{expect(isoDate(29,1,2025)).toBeNull();expect(isoDate(29,1,2024)).toBe('2024-02-29')})
})
describe('CSV contract',()=>{
 it('supports zero and Australian dates without claiming reconciliation',()=>{const s=parseStatementCsv('Date,Description,Amount\n01/07/2025,Example,-10.20\n2025-07-02,Transfer,0','csv','example.csv');expect(s.rows.map(r=>r.cents)).toEqual([-1020,0]);expect(s.reconciled).toBe(false);expect(s.opening).toBeNull()})
 it.each(['Date,Date,Amount\n2025-07-01,Example,10','Date,Description,Amount\n2025-02-30,Example,10','Date,Description,Amount\n2025-07-01,Example,','Date,Description,Amount\n2025-07-01,Example,1e4','Date,Description,Amount\n2025-07-01,Example,1.001','Date,Description,Amount\n2025-07-01,Example,12,34'])('rejects malformed rows atomically',text=>expect(()=>parseStatementCsv(text,'csv','bad.csv')).toThrow())
})
describe('analysis and corrections',()=>{
 it('keeps transfers and repayments in cash movements and in separate categories',()=>{const a=analyse(sample().rows,{});expect(a).toMatchObject({credits:1264900,debits:501675,net:763225,similar:2});expect(a.groups.find(g=>g.category==='Transfers')?.cents).toBe(240000);expect(a.groups.find(g=>g.category==='Repayments')?.cents).toBe(75000)})
 it('suggests recurring payments without counting same-day duplicates as subscriptions',()=>{const a=analyse(sample().rows,{});expect(a.recurring.some(r=>r.name==='Example Software Plan')).toBe(true);expect(a.recurring.some(r=>r.name==='Harbour Repairs')).toBe(false)})
 it('user corrections change category totals but never the source amounts',()=>{const s=sample(),row=s.rows.find(r=>r.description==='Harbour Repairs')!;const reviews={[row.id]:{category:'Transport' as const,work:'check' as const,note:'Confirm purpose'}};const a=analyse(s.rows,reviews);expect(a.debits).toBe(501675);expect(a.flagged).toBe(1);expect(reviewFor(row,reviews).category).toBe('Transport');expect(s.rows.find(r=>r.id===row.id)?.cents).toBe(-9750)})
 it('does not call ordinary credits taxable income',()=>{expect(suggestion(sample().rows[0]).category).toBe('Money received')})
 it('exports only the date range while describing the whole-statement checks and escaping text',()=>{const s=sample();s.name='<script>bad</script>';const r=s.rows[0];const html=statementReport(s,{[r.id]:{category:'Money received',work:'unreviewed',note:'<img src=x onerror=bad()>'}},'2025-07-01','2025-07-31');expect(html).toContain('10 transactions');expect(html).toContain('2025-07-01 to 2025-09-30');expect(html).toContain('&lt;img');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('2025-08-02</td>')})
})
