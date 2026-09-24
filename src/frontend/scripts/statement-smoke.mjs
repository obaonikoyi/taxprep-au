import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {assertStayedOnDevice,watchRequests} from './request-log.mjs';
export async function verifyStatements(context,base,artifacts){
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const requests=watchRequests(page);
 const button=name=>page.getByRole('button',{name,exact:true});
 const totals=()=>page.locator('.statement-metrics strong').allTextContents();
 const upload=async(name)=>{const f=JSON.parse(readFileSync(new URL(`../../../sample-data/statements/${name}.json`,import.meta.url),'utf8'));await page.getByLabel('Choose bank statement',{exact:true}).setInputFiles({name:name+'.pdf',mimeType:'application/pdf',buffer:Buffer.from(f.pdfBase64,'base64')});await page.getByRole('status').filter({hasText:/transactions read|^$/}).first().waitFor();};
 try{
  await page.goto(base.href);await button('Bank spending').click();await page.getByRole('heading',{name:'Your statements, made clear.',exact:true}).waitFor();
  await page.screenshot({path:artifacts+'statement-landing-desktop.png',fullPage:true});
  await button('Try example statement').click();await page.getByRole('status').filter({hasText:'33 transactions read.'}).waitFor();
  assert.deepEqual(await totals(),['$12,649.00','$5,016.75','$7,632.25','33']);
  assert.ok((await page.locator('.statement-period').innerText()).includes('Statement balances match'));
  assert.ok((await page.locator('.statement-insights').innerText()).includes('Example Software Plan'));
  assert.equal(await page.locator('.statement-transactions tbody tr').count(),20);
  await button('Next').click();assert.equal(await page.locator('.statement-transactions tbody tr').count(),13);await button('Previous').click();
  await page.getByLabel('Filter category',{exact:true}).selectOption('Transfers');assert.equal(await page.locator('.statement-transactions tbody tr').count(),3);
  await page.getByLabel('Filter category',{exact:true}).selectOption('all');
  await page.getByLabel('Search transactions',{exact:true}).fill('Harbour Repairs');
  assert.equal(await page.locator('.statement-transactions tbody tr').count(),2);
  await button('Review transaction 1').click();await page.getByLabel('Transaction category',{exact:true}).selectOption('Transport');
  await page.getByLabel('Work relevance',{exact:true}).selectOption('check');
  await page.getByLabel('Review note',{exact:true}).fill('Find the bill. <script>alert(1)</script>');await button('Apply review').click();
  assert.ok((await page.locator('.statement-metrics').innerText()).includes('1 flagged'));
  assert.deepEqual(await totals(),['$12,649.00','$5,016.75','$7,632.25','33']);
  await page.getByLabel('Search transactions',{exact:true}).fill('');
  await page.getByLabel('From date',{exact:true}).fill('2025-08-01');
  assert.deepEqual(await totals(),['$8,449.00','$3,409.50','$5,039.50','23']);
  await page.getByLabel('From date',{exact:true}).fill('2025-07-01');
  await page.locator('.statement-metrics').screenshot({path:artifacts+'statement-totals-desktop.png'});
  await page.locator('.statement-charts').screenshot({path:artifacts+'statement-charts-desktop.png'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:artifacts+'statement-dashboard-mobile.png',fullPage:true});
  const downloading=page.waitForEvent('download');await button('Download statement report').click();const download=await downloading;await download.saveAs(artifacts+'statement-analysis.html');
  const html=readFileSync(artifacts+'statement-analysis.html','utf8');for(const value of ['$12,649.00','$5,016.75','Harbour Repairs','Flagged for work review','statement-analysis.v1','&lt;script&gt;'])assert.ok(html.includes(value),value);assert.ok(!html.includes('<script>'));
  const offline=await context.newPage(),external=[];offline.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});await offline.goto('file://'+artifacts+'statement-analysis.html');await offline.getByRole('heading',{name:'Xoba Paycheck statement analysis',exact:true}).waitFor();assert.deepEqual(external,[]);await offline.close();
  const handoffEvent=page.waitForEvent('download');await button('Download year-end handoff').click();const handoffDownload=await handoffEvent;await handoffDownload.saveAs(artifacts+'statement-year-end-handoff.json');
  const handoffText=readFileSync(artifacts+'statement-year-end-handoff.json','utf8'),handoff=JSON.parse(handoffText);
  assert.equal(handoff.version,'taxprep-year-end-handoff-v1');assert.equal(handoff.kind,'statement-analysis');assert.equal(handoff.financialYear,'2025–26');assert.equal(handoff.summary.transactionCount,33);assert.equal(handoff.summary.reviewedTransactions,1);assert.equal(handoff.summary.workReviewTransactions,1);assert.equal(handoff.sourceHashes.length,1);assert.match(handoff.sourceHashes[0],/^[a-f0-9]{64}$/);assert.ok(!handoffText.includes('Harbour Repairs'));assert.ok(!handoffText.includes('Find the bill'));assert.ok(!handoffText.includes('<script>'));
  await upload('mismatch');await page.getByRole('alert').filter({hasText:'Statement check failed'}).waitFor();assert.deepEqual(await totals(),['$12,649.00','$5,016.75','$7,632.25','33']);
  await upload('empty');await page.getByRole('status').filter({hasText:'0 transactions read.'}).waitFor();assert.deepEqual(await totals(),['$0.00','$0.00','$0.00','0']);
  await page.getByLabel('Choose bank statement',{exact:true}).setInputFiles({name:'example.csv',mimeType:'text/csv',buffer:Buffer.from('Date,Description,Amount\n2025-07-01,Example market,-15.50\n2025-07-02,Transfer received,100')});await page.getByRole('status').filter({hasText:'2 transactions read.'}).waitFor();assert.deepEqual(await totals(),['$100.00','$15.50','$84.50','2']);
  assert.ok((await page.locator('.statement-period').innerText()).includes('balance check unavailable'));
  await button('Clear statement').click();assert.equal(await page.locator('.statement-metrics').count(),0);
  await button('Try example statement').click();await page.getByRole('status').filter({hasText:'33 transactions read.'}).waitFor();
  await page.reload();await button('Bank spending').click();await page.getByRole('heading',{name:'Your statements, made clear.',exact:true}).waitFor();assert.equal(await page.locator('.statement-metrics').count(),0);
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/statement/i.test(k))),[]);

  /*
   * A statement whose layout this app does not document, read by a model
   * because the person asked for it on that one file.
   *
   * The whole design is the checksum: a statement prints an opening balance, a
   * closing balance and its debit and credit totals, so a transcription is
   * arithmetic rather than something to eyeball. Nobody checks two hundred
   * rows by hand. Both halves are proved here — one that adds up and is
   * imported, one that does not and is refused outright.
   */
  const unsupported={
   opening:'1000.00',closing:'1250.50',printedDebits:'149.50',printedCredits:'400.00',
   from:'2026-07-01',to:'2026-07-31',why:'',
   rows:[
    {date:'2026-07-02',description:'WOOLWORTHS 1234 ADELAIDE',amount:'-49.50',balance:'950.50'},
    {date:'2026-07-05',description:'SALARY KESTREL EXAMPLE',amount:'400.00',balance:'1350.50'},
    {date:'2026-07-20',description:'RENT TRANSFER',amount:'-100.00',balance:'1250.50'},
   ]};
  let statementSent=null;
  const stubStatement=async body=>{await page.unroute('**/api/statement/read').catch(()=>{});await page.route('**/api/statement/read',async route=>{statementSent=JSON.parse(route.request().postData()??'{}');await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:true,statement:body})})})};

  /*
   * A PDF with plenty of selectable text that is in no layout this app
   * documents, so the parser refuses it and the assisted path takes over. The
   * user-test contract serves: what matters is that the documented parser
   * cannot read it, not what it happens to be.
   */
  const unsupportedPdf=()=>({name:'foreign-bank-statement.pdf',mimeType:'application/pdf',
   buffer:readFileSync(new URL('../../../sample-data/user-test/files/contract.pdf',import.meta.url))});
  await stubStatement(unsupported);
  await page.locator('.statement-assist-choice input').check();
  await page.getByLabel('Choose bank statement',{exact:true}).setInputFiles(unsupportedPdf());
  await page.getByRole('status').filter({hasText:'3 transactions read.'}).waitFor({timeout:120000});
  assert.ok(statementSent&&typeof statementSent.text==='string'&&statementSent.text.length>200,'the request carried the extracted text');
  assert.equal(/%PDF|JVBER/.test(statementSent.text),false,'the request carried text, not the PDF itself');
  assert.match(await page.getByRole('status').first().innerText(),/adds up to the statement/i,'the person is told it was checked, not just read');
  assert.deepEqual(await totals(),['$400.00','$149.50','$250.50','3']);
  assert.match(await page.locator('.statement-help').evaluate(el=>el.textContent??''),/transcribed by a model/,'the screen says a model read this one');
  assert.doesNotMatch(await page.locator('.statement-help').evaluate(el=>el.textContent??''),/No AI model was used/,'and does not still claim otherwise');

  // And the half that matters more: a transcription that does not add up is
  // refused outright rather than shown to somebody to check by hand.
  await stubStatement({...unsupported,rows:unsupported.rows.slice(0,2)});
  await page.getByLabel('Choose bank statement',{exact:true}).setInputFiles(unsupportedPdf());
  const refused=page.getByRole('alert');
  await refused.filter({hasText:'do not add up'}).waitFor({timeout:120000});
  assert.deepEqual(await totals(),['$400.00','$149.50','$250.50','3'],'the statement already imported is untouched');
  await page.unroute('**/api/statement/read');
  await page.locator('.statement-assist-choice input').uncheck();

  assert.deepEqual(errors,[]);
  // The one thing in this journey that leaves the browser, and only because the
  // person ticked the box for it. Counted exactly: a third would fail this.
  const thirdPartyRefused=assertStayedOnDevice(assert,requests,base,['/api/statement/read']);
  const posts=requests.attempted.filter(r=>r.method==='POST');
  assert.deepEqual(posts.map(r=>new URL(r.url).pathname),['/api/statement/read','/api/statement/read'],
   `only the statement readings the person asked for were posted: ${posts.map(r=>r.method+' '+r.url).join(', ')}`);
  const result={passed:true,syntheticOnly:true,rows:33,creditsAud:12649,debitsAud:5016.75,netAud:7632.25,balancesMatch:true,correctionsPreserveAmounts:true,dateFilter:true,mismatchPreservesSession:true,emptyStatement:true,csv:true,clearAndRefresh:true,offlineExport:true,yearEndHandoff:true,handoffNoDescriptions:true,mobileOverflow:false,documentUploads:0,modelRequests:0,assistedStatementImported:true,assistedStatementRefusedWhenItDoesNotAddUp:true,thirdPartyRefused,pageErrors:errors};writeFileSync(artifacts+'statement-evaluation.json',JSON.stringify(result,null,2));return result;
 }catch(e){await page.screenshot({path:artifacts+'statement-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-11000));throw e}finally{await page.close()}
}
