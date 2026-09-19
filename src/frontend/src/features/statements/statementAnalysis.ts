import type { StatementRow } from './statementParser'
export const categories=['Groceries','Food & dining','Transport','Bills','Subscriptions','Shopping','Health','Education','Bank fees','Cash','Transfers','Repayments','Money received','Refunds','Other'] as const
export type Category=typeof categories[number]
export interface Review { category: Category; work:'unreviewed'|'personal'|'check'; note:string }
export type Reviews=Record<string,Review>
const rules:[Category,RegExp,string][]=[
  ['Transfers',/\btransfer\b|\bpayid\b|\bosko\b/i,'Transfer wording; check whether it moved your own money.'],
  ['Repayments',/steppay|afterpay|zip pay|repayment|loan payment|credit card payment/i,'Repayment wording; the original purchases may be separate.'],
  ['Refunds',/refund|reversal/i,'Refund/reversal wording; check against the original payment.'],
  ['Bank fees',/transaction fee|account fee|debit interest|overdraw/i,'Bank fee or interest wording.'],
  ['Food & dining',/ubereats|uber eats|doordash|menulog|restaurant|cafe|coffee|kfc|mcdonald|pizza/i,'Food, cafe or delivery merchant wording.'],
  ['Groceries',/woolworth|coles|aldi|foodland|supermarket/i,'Grocery merchant wording; individual items are unknown.'],
  ['Transport',/\buber\b|didi|taxi|metro|parking|petrol|fuel|ampol|bp connect/i,'Transport or fuel wording; purpose is unknown.'],
  ['Bills',/telstra|optus|vodafone|mobile service|electricity|energy|water bill|internet bill/i,'Utility or phone provider wording.'],
  ['Subscriptions',/netflix|spotify|youtube|patreon|adobe|microsoft|openai|subscription|software plan/i,'Service or subscription wording; recurring status needs checking.'],
  ['Health',/pharmacy|chemist|medical|dental|hospital/i,'Health provider wording.'],
  ['Education',/university|tafe|course|training/i,'Education or training wording.'],
  ['Cash',/\batm\b|cash withdrawal/i,'Cash withdrawal; subsequent use is unknown.'],
  ['Shopping',/amazon|kmart|target|ebay|officeworks|bunnings|retail|store/i,'Retail merchant wording; individual items are unknown.'],
]
export function suggestion(row:StatementRow):{category:Category;reason:string}{
  const rule=rules.find(([,pattern])=>pattern.test(row.description))
  if(rule)return{category:rule[0],reason:rule[2]}
  return row.cents>0?{category:'Money received',reason:'A credit is money received, not necessarily taxable income.'}:{category:'Other',reason:'No clear merchant match. Choose a category after reviewing the entry.'}
}
export const reviewFor=(row:StatementRow,reviews:Reviews):Review=>reviews[row.id]??{category:suggestion(row).category,work:'unreviewed',note:''}
export function merchant(description:string){return description.split(/Card\s+xx|Value\s*Date|CommBank App/i)[0].replace(/\s+/g,' ').trim()}
export function analyse(rows:StatementRow[],reviews:Reviews){
  const debits=rows.reduce((s,r)=>s+Math.max(0,-r.cents),0),credits=rows.reduce((s,r)=>s+Math.max(0,r.cents),0)
  const groups=categories.map(category=>({category,cents:rows.filter(r=>r.cents<0&&reviewFor(r,reviews).category===category).reduce((s,r)=>s-r.cents,0)})).filter(g=>g.cents>0).sort((a,b)=>b.cents-a.cents)
  const months=[...new Set(rows.map(r=>r.date.slice(0,7)))].sort().map(month=>({month,debits:rows.filter(r=>r.date.startsWith(month)).reduce((s,r)=>s+Math.max(0,-r.cents),0),credits:rows.filter(r=>r.date.startsWith(month)).reduce((s,r)=>s+Math.max(0,r.cents),0)}))
  const merchants=new Map<string,StatementRow[]>()
  for(const row of rows.filter(r=>r.cents<0&&!['Transfers','Repayments'].includes(reviewFor(r,reviews).category))){const key=merchant(row.description).toLowerCase();merchants.set(key,[...(merchants.get(key)??[]),row])}
  const recurring=[...merchants.values()].flatMap(items=>{
    const dates=[...new Set(items.map(i=>i.date))].sort(),amounts=items.map(i=>-i.cents)
    if(dates.length<3||Math.min(...amounts)<=0||Math.max(...amounts)>Math.min(...amounts)*1.2)return[]
    const gaps=dates.slice(1).map((d,i)=>(Date.parse(d)-Date.parse(dates[i]))/86400000).sort((a,b)=>a-b)
    const middle=gaps[Math.floor(gaps.length/2)]
    const cadence=middle>=20&&middle<=40?'Roughly monthly':middle>=11&&middle<=18?'Roughly fortnightly':middle>=5&&middle<=9?'Roughly weekly':null
    return cadence&&gaps.at(-1)!<=middle*1.8?[{name:merchant(items[0].description),count:items.length,cents:amounts.reduce((a,b)=>a+b,0),cadence}]:[]
  }).sort((a,b)=>b.cents-a.cents)
  const similar=new Map<string,number>()
  for(const row of rows){const key=[row.date,row.cents,row.description.toLowerCase().replace(/\s+/g,' ')].join('|');similar.set(key,(similar.get(key)??0)+1)}
  return{debits,credits,net:credits-debits,groups,months,recurring,similar:[...similar.values()].filter(n=>n>1).reduce((a,b)=>a+b,0),flagged:rows.filter(r=>reviewFor(r,reviews).work==='check').length,uncategorised:rows.filter(r=>reviewFor(r,reviews).category==='Other').length}
}
